"""
Re-fetch existing incident URLs and extract peopleInvolved.
Preserves locationLabel / lat / lng / id / createdAt.
"""

from __future__ import annotations

import asyncio
import json
import sys
from pathlib import Path

import httpx
from bs4 import BeautifulSoup

from main import USER_AGENT, extract_article, extract_people

ROOT = Path(__file__).resolve().parents[1]
DATA_PATH = ROOT / "data" / "incidents.json"


async def fetch_people(client: httpx.AsyncClient, url: str, title: str, summary: str) -> list[str]:
    # Always mine stored title/summary first (works even if fetch fails).
    found = extract_people(title, summary, "")

    try:
        response = await client.get(url)
        if response.status_code >= 400:
            return found
        content_type = response.headers.get("content-type", "")
        if "html" not in content_type and "text/" not in content_type:
            return found

        soup = BeautifulSoup(response.text, "html.parser")
        fresh_title, fresh_summary, _published, body = extract_article(soup)
        scraped = extract_people(fresh_title, fresh_summary, body)
        for name in scraped:
            if name not in found:
                found.append(name)
    except httpx.HTTPError:
        pass

    return found[:8]


async def main() -> int:
    if not DATA_PATH.exists():
        print(f"Missing {DATA_PATH}")
        return 1

    incidents = json.loads(DATA_PATH.read_text(encoding="utf-8"))
    print(f"Rescanning {len(incidents)} incidents…")

    headers = {
        "User-Agent": USER_AGENT,
        "Accept": "text/html,application/xhtml+xml",
        "Accept-Language": "en-GB,en;q=0.9",
    }

    updated = 0
    async with httpx.AsyncClient(
        timeout=25.0,
        headers=headers,
        follow_redirects=True,
    ) as client:
        for index, item in enumerate(incidents, start=1):
            url = item.get("url", "")
            title = item.get("title", "")
            summary = item.get("summary", "")
            before = list(item.get("peopleInvolved") or [])

            # Keep location fields untouched.
            location_label = item.get("locationLabel")
            lat = item.get("lat")
            lng = item.get("lng")

            people = await fetch_people(client, url, title, summary)
            item["peopleInvolved"] = people
            item["locationLabel"] = location_label
            item["lat"] = lat
            item["lng"] = lng

            label = title[:70].encode("ascii", "replace").decode("ascii")
            if people != before:
                updated += 1
                print(f"[{index}/{len(incidents)}] + {people}  <-  {label}")
            else:
                print(f"[{index}/{len(incidents)}] (no new names)  {label}")

            # Be polite to remote hosts.
            await asyncio.sleep(0.8)

    DATA_PATH.write_text(
        json.dumps(incidents, indent=2, ensure_ascii=False) + "\n",
        encoding="utf-8",
    )
    print(f"\nDone. Updated names on {updated}/{len(incidents)} stories.")
    print(f"Locations preserved. Wrote {DATA_PATH}")
    return 0


if __name__ == "__main__":
    sys.exit(asyncio.run(main()))
