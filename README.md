# Rape of Briton

Next.js map app (OpenStreetMap) plus a Python bot that turns pasted news URLs into map pins.

## Stack

- **Next.js** — UI, OpenStreetMap via Leaflet, APIs
- **Python FastAPI bot** — fetch article HTML, extract title/summary, find UK place, geocode with Nominatim
- **Local JSON store** — `data/incidents.json` (MVP; easy to swap for Supabase later)

## Run locally

### 1. Python ingest bot

```bash
cd bot
python -m venv .venv
.\.venv\Scripts\activate
pip install -r requirements.txt
uvicorn main:app --reload --port 8000
```

### 2. Next.js app

```bash
npm install
npm run dev
```

Open [http://localhost:3000](http://localhost:3000), paste a BBC / GB News (or similar) article URL, and click **Add to map**.

## How ingest works

1. Browser posts the URL to `/api/ingest`
2. Next.js forwards it to the bot at `http://127.0.0.1:8000/ingest`
3. Bot fetches the page, reads Open Graph / meta tags, looks for a UK place name, geocodes it
4. Next.js saves the result into `data/incidents.json` and the map updates

Optional env:

```env
INGEST_BOT_URL=http://127.0.0.1:8000
```

## Notes

- Only metadata is stored (title, short summary, URL, location) — not full article text
- Respect site terms of use; this is for personal/local tooling
- Some sites block scrapers; if ingest fails, try another URL or improve the bot selectors
