# Rape of Briton

Next.js map app with OpenStreetMap. Paste a news URL to add a story, location pin, and named people.

## Stack

- **Next.js on Vercel** — UI + built-in URL ingest (no separate Python server required)
- **Supabase** — persistent `news_incidents` storage for web users
- **Optional local Python bot** — `bot/` for offline/dev scraping if you want it

## Why not a Python bot on Vercel?

Vercel runs serverless functions, not a long-lived `uvicorn` process. Ingest now lives in `/api/ingest` inside Next.js so production users can add URLs without a second host.

## Vercel env vars

In the Vercel project → Settings → Environment Variables, add:

```env
NEXT_PUBLIC_SUPABASE_URL=https://jmpncxhcqlqjxyoteacb.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=<your anon key>
```

Do **not** set `INGEST_BOT_URL` on Vercel (that forces a local Python bot).

Redeploy after saving env vars.

## Run locally

```bash
cp .env.example .env.local
# fill in Supabase anon key
npm install
npm run dev
```

Optional Python bot (local only):

```bash
cd bot
.\.venv\Scripts\activate
uvicorn main:app --reload --port 8001
```

Then in `.env.local`:

```env
INGEST_BOT_URL=http://127.0.0.1:8001
```

If the Python bot is down, Next.js falls back to built-in ingest automatically.

## Notes

- Only metadata is stored (title, short summary, URL, location, named people)
- Some sites block scrapers or return app shells (especially X/Twitter)
- Public insert/update RLS is enabled so visitors can add URLs — tighten later if spam appears
