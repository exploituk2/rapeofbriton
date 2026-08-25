# Rape of Briton

Next.js map app with OpenStreetMap. Paste a news URL to add a story, location pin, and named people.

## Stack

- **Next.js on Vercel** — UI + built-in URL ingest (no separate Python server required)
- **Supabase** — persistent `news_incidents` storage for web users
- **Optional local Python bot** — `bot/` for offline/dev scraping if you want it

## Free Python bot hosting (optional)

Vercel already has built-in ingest. Host the Python bot separately only if you want it as a backup or for heavier scraping.

### Best free option: [Render](https://render.com)

1. Sign up at https://render.com (free)
2. **New → Web Service** → connect `exploituk2/rapeofbriton`
3. Settings:
   - **Root Directory:** `bot`
   - **Runtime:** Python
   - **Build Command:** `pip install -r requirements.txt`
   - **Start Command:** `uvicorn main:app --host 0.0.0.0 --port $PORT`
4. Deploy, then copy the URL (e.g. `https://rapeofbriton-bot.onrender.com`)
5. In **Vercel → Environment Variables** add:

```env
INGEST_BOT_URL=https://YOUR-BOT.onrender.com
```

6. Redeploy the Next.js app

Notes:
- Free Render apps **sleep after ~15 minutes** idle (first request can take 30–60s)
- Keep `NEXT_PUBLIC_SUPABASE_*` set so stories still save
- If the bot is asleep/down, Next.js falls back to built-in ingest

### Other free-ish options

| Host | Notes |
|------|--------|
| **Render** | Easiest free FastAPI web service |
| **Koyeb** | Free tier, similar to Render |
| **Fly.io** | Free allowance; needs `flyctl` + Dockerfile in `bot/` |
| **Railway** | Easy, but free credits run out |

Avoid trying to run `uvicorn` on Vercel itself — it only supports serverless functions.

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
