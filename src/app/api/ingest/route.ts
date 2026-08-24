import { NextResponse } from "next/server";
import { upsertIncident } from "@/lib/incidents";
import type { NewsIncident } from "@/lib/types";

const BOT_URL = process.env.INGEST_BOT_URL ?? "http://127.0.0.1:8000";

export async function POST(request: Request) {
  const { url } = (await request.json()) as { url?: string };

  if (!url || typeof url !== "string") {
    return NextResponse.json({ error: "url is required" }, { status: 400 });
  }

  try {
    new URL(url);
  } catch {
    return NextResponse.json({ error: "invalid url" }, { status: 400 });
  }

  let botResponse: Response;
  try {
    botResponse = await fetch(`${BOT_URL}/ingest`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ url }),
      cache: "no-store",
    });
  } catch {
    return NextResponse.json(
      {
        error:
          "Python ingest bot is not running. Start it with: cd bot && python -m uvicorn main:app --reload --port 8000",
      },
      { status: 503 },
    );
  }

  const payload = await botResponse.json();
  if (!botResponse.ok) {
    return NextResponse.json(
      { error: payload.detail ?? payload.error ?? "ingest failed" },
      { status: botResponse.status },
    );
  }

  const incident = payload as NewsIncident;
  const saved = await upsertIncident(incident);
  return NextResponse.json(saved, { status: 201 });
}
