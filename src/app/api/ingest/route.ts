import { NextResponse } from "next/server";
import { ingestUrl } from "@/lib/ingest";
import { upsertIncident } from "@/lib/incidents";
import type { NewsIncident } from "@/lib/types";

export const runtime = "nodejs";
export const maxDuration = 60;

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

  try {
    // Prefer built-in ingest (works on Vercel). Optional local Python bot override.
    const botUrl = process.env.INGEST_BOT_URL;
    let incident: NewsIncident;

    if (botUrl) {
      try {
        const botResponse = await fetch(`${botUrl}/ingest`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ url }),
          cache: "no-store",
        });
        const payload = await botResponse.json();
        if (!botResponse.ok) {
          throw new Error(
            payload.detail ?? payload.error ?? "Python bot ingest failed",
          );
        }
        incident = {
          ...(payload as NewsIncident),
          peopleInvolved: Array.isArray(payload.peopleInvolved)
            ? payload.peopleInvolved
            : [],
        };
      } catch {
        incident = await ingestUrl(url);
      }
    } else {
      incident = await ingestUrl(url);
    }

    const saved = await upsertIncident(incident);
    return NextResponse.json(saved, { status: 201 });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Could not ingest URL";
    return NextResponse.json({ error: message }, { status: 502 });
  }
}
