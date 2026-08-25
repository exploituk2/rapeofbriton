from __future__ import annotations

import re
import uuid
from datetime import datetime, timezone
from urllib.parse import urlparse

import httpx
from bs4 import BeautifulSoup
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, HttpUrl

app = FastAPI(title="News ingest bot", version="0.1.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

USER_AGENT = "RapeOfBritonBot/0.1 (+local-dev; news-map ingest)"

# Common UK + Ireland places to look for in titles/summaries (longest first).
KNOWN_PLACES = sorted(
    {
        "Aberdeen",
        "Belfast",
        "Birmingham",
        "Blackburn",
        "Bolton",
        "Bournemouth",
        "Bradford",
        "Brighton",
        "Bristol",
        "Cambridge",
        "Cardiff",
        "Cork",
        "Coventry",
        "Derby",
        "Derry",
        "Doncaster",
        "Dublin",
        "Dundee",
        "Edinburgh",
        "Exeter",
        "Galway",
        "Glasgow",
        "Gloucester",
        "Huddersfield",
        "Hull",
        "Ipswich",
        "Kilkenny",
        "Leeds",
        "Leicester",
        "Limerick",
        "Liverpool",
        "London",
        "Luton",
        "Manchester",
        "Middlesbrough",
        "Milton Keynes",
        "Newcastle",
        "Newport",
        "Norwich",
        "Nottingham",
        "Oldham",
        "Oxford",
        "Peterborough",
        "Plymouth",
        "Portsmouth",
        "Preston",
        "Reading",
        "Rochdale",
        "Rotherham",
        "Sheffield",
        "Slough",
        "Southampton",
        "Southend",
        "Stoke-on-Trent",
        "Sunderland",
        "Swansea",
        "Swindon",
        "Waterford",
        "Walsall",
        "Warrington",
        "Watford",
        "Winsford",
        "Wolverhampton",
        "York",
        "Cheshire",
        "Cornwall",
        "Devon",
        "Dorset",
        "Essex",
        "Hampshire",
        "Kent",
        "Lancashire",
        "Norfolk",
        "Somerset",
        "Surrey",
        "Sussex",
        "Yorkshire",
        "Wales",
        "Scotland",
        "Northern Ireland",
        "Ireland",
        "County Cork",
        "County Dublin",
        "County Galway",
    },
    key=len,
    reverse=True,
)


class IngestRequest(BaseModel):
    url: HttpUrl


class IncidentOut(BaseModel):
    id: str
    url: str
    source: str
    title: str
    summary: str
    peopleInvolved: list[str]
    locationLabel: str | None
    lat: float | None
    lng: float | None
    publishedAt: str | None
    createdAt: str


def source_from_url(url: str) -> str:
    host = urlparse(url).hostname or "unknown"
    host = host.removeprefix("www.")
    aliases = {
        "bbc.co.uk": "BBC",
        "bbc.com": "BBC",
        "gbnews.com": "GB News",
        "sky.com": "Sky News",
        "news.sky.com": "Sky News",
        "theguardian.com": "The Guardian",
        "telegraph.co.uk": "The Telegraph",
        "independent.co.uk": "The Independent",
        "dailymail.co.uk": "Daily Mail",
        "mirror.co.uk": "Mirror",
    }
    return aliases.get(host, host)


def clean_text(value: str | None) -> str:
    if not value:
        return ""
    return re.sub(r"\s+", " ", value).strip()


def extract_meta(soup: BeautifulSoup, *keys: str) -> str:
    for key in keys:
        tag = soup.find("meta", property=key) or soup.find("meta", attrs={"name": key})
        if tag and tag.get("content"):
            return clean_text(tag["content"])
    return ""


def extract_article(soup: BeautifulSoup) -> tuple[str, str, str | None, str]:
    title = (
        extract_meta(soup, "og:title", "twitter:title")
        or clean_text(soup.title.string if soup.title else "")
        or "Untitled article"
    )
    # Drop common site suffix noise.
    title = re.sub(r"\s*[\|\-–—]\s*(BBC News|GB News|Sky News).*$", "", title).strip()

    summary = extract_meta(
        soup,
        "og:description",
        "twitter:description",
        "description",
    )

    published = extract_meta(
        soup,
        "article:published_time",
        "og:updated_time",
        "pubdate",
        "publish-date",
        "date",
    ) or None

    paragraphs = [
        clean_text(p.get_text(" ", strip=True))
        for p in soup.select(
            "article p, [data-component='text-block'] p, .article-body p, "
            "main p, .article__body p, [itemprop='articleBody'] p"
        )
        if clean_text(p.get_text(" ", strip=True))
    ]
    body_text = " ".join(paragraphs[:12])
    body_hint = " ".join(paragraphs[:4])

    if not summary and body_hint:
        summary = body_hint[:280]

    return title, summary[:400], published, body_text


NAME_TOKEN = r"[A-Z][a-z]+(?:['’][A-Z]?[a-z]+)?(?:-[A-Z][a-z]+)?"
PERSON_NAME = rf"{NAME_TOKEN}(?:\s+{NAME_TOKEN}){{1,3}}"

NAME_STOPWORDS = {
    "British",
    "Crown",
    "Court",
    "Police",
    "Force",
    "News",
    "Monday",
    "Tuesday",
    "Wednesday",
    "Thursday",
    "Friday",
    "Saturday",
    "Sunday",
    "January",
    "February",
    "March",
    "April",
    "June",
    "July",
    "August",
    "September",
    "October",
    "November",
    "December",
    "United",
    "Kingdom",
    "Northern",
    "Ireland",
    "Great",
    "Britain",
    "Met",
    "Metropolitan",
    "Detective",
    "Constable",
    "Inspector",
    "Sergeant",
    "Judge",
    "Justice",
    "Lord",
    "Lady",
    "Sir",
    "Dame",
    "Home",
    "Office",
    "Crown Prosecution",
    "High Court",
    "Crown Court",
    "Magistrates",
    "Piccadilly",
    "Gardens",
}


def _looks_like_person(name: str) -> bool:
    parts = name.split()
    if len(parts) < 2 or len(parts) > 4:
        return False
    if any(part in NAME_STOPWORDS for part in parts):
        return False
    if name in KNOWN_PLACES:
        return False
    # Reject if any token is a known place on its own (London Bridge style noise).
    if any(part in KNOWN_PLACES for part in parts):
        return False
    return True


def extract_people(title: str, summary: str, body: str) -> list[str]:
    """Pull published person names from crime/news copy (often defendants)."""
    text = f"{title}. {summary}. {body}"
    found: list[str] = []

    patterns = [
        # "John Smith, 24" / "John Smith, aged 24"
        rf"\b({PERSON_NAME}),\s*(?:aged\s+)?\d{{1,3}}\b",
        # "John Smith, 25, and Jane Doe, 29"
        rf"\b({PERSON_NAME}),\s*\d{{1,3}},\s*and\s+({PERSON_NAME}),\s*\d{{1,3}}\b",
        # "charged John Smith" / "jailed John Smith"
        rf"\b(?:charged|arrested|jailed|sentenced|convicted)\s+({PERSON_NAME})\b",
        # "John Smith was charged/arrested/jailed"
        rf"\b({PERSON_NAME})\s+(?:was|has been|have been|were)\s+(?:charged|arrested|jailed|sentenced|convicted|remanded)\b",
        # "John Smith jailed" / "John Smith sentenced"
        rf"\b({PERSON_NAME})\s+(?:jailed|sentenced|convicted|remanded)\b",
        # "defendant John Smith" / "suspect John Smith"
        rf"\b(?:defendant|suspect|accused|offender|attacker)\s+({PERSON_NAME})\b",
        # "named as John Smith"
        rf"\bnamed(?:\s+in\s+court)?\s+as\s+({PERSON_NAME})\b",
    ]

    for pattern in patterns:
        for match in re.finditer(pattern, text):
            for group in match.groups():
                if not group:
                    continue
                name = clean_text(group)
                name = re.sub(r"^(?:Mr|Mrs|Ms|Miss|Dr)\s+", "", name)
                if _looks_like_person(name) and name not in found:
                    found.append(name)

    return found[:8]


def find_place(text: str) -> str | None:
    for place in KNOWN_PLACES:
        if re.search(rf"\b{re.escape(place)}\b", text, flags=re.IGNORECASE):
            return place
    return None


async def geocode_place(place: str) -> tuple[float, float] | None:
    params = {
        "q": place,
        "format": "json",
        "limit": 1,
        "countrycodes": "gb,ie",
    }
    headers = {"User-Agent": USER_AGENT}
    async with httpx.AsyncClient(timeout=20.0, headers=headers) as client:
        res = await client.get("https://nominatim.openstreetmap.org/search", params=params)
        res.raise_for_status()
        data = res.json()
        if not data:
            return None
        return float(data[0]["lat"]), float(data[0]["lon"])


@app.get("/health")
async def health():
    return {"ok": True}


@app.post("/ingest", response_model=IncidentOut)
async def ingest(payload: IngestRequest):
    url = str(payload.url)
    headers = {
        "User-Agent": USER_AGENT,
        "Accept": "text/html,application/xhtml+xml",
        "Accept-Language": "en-GB,en;q=0.9",
    }

    try:
        async with httpx.AsyncClient(
            timeout=25.0,
            headers=headers,
            follow_redirects=True,
        ) as client:
            response = await client.get(url)
    except httpx.HTTPError as exc:
        raise HTTPException(status_code=502, detail=f"Could not fetch URL: {exc}") from exc

    if response.status_code >= 400:
        raise HTTPException(
            status_code=502,
            detail=f"Upstream returned HTTP {response.status_code}",
        )

    content_type = response.headers.get("content-type", "")
    if "html" not in content_type and "text/" not in content_type:
        raise HTTPException(status_code=400, detail="URL did not return HTML")

    soup = BeautifulSoup(response.text, "html.parser")
    title, summary, published, body_text = extract_article(soup)
    place = find_place(f"{title}. {summary}. {body_text}")
    people = extract_people(title, summary, body_text)

    lat = lng = None
    if place:
        coords = await geocode_place(place)
        if coords:
            lat, lng = coords

    return IncidentOut(
        id=str(uuid.uuid4()),
        url=url,
        source=source_from_url(url),
        title=title,
        summary=summary,
        peopleInvolved=people,
        locationLabel=place,
        lat=lat,
        lng=lng,
        publishedAt=published,
        createdAt=datetime.now(timezone.utc).isoformat(),
    )
