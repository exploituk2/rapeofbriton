import { NextResponse } from "next/server";
import { ingestUrl } from "@/lib/ingest";
import { assertIngestAllowed, IngestDenied } from "@/lib/ingest-security";
import { upsertIncident } from "@/lib/incidents";
import type { NewsIncident } from "@/lib/types";

export const runtime = "nodejs";
export const maxDuration = 60;

export async function POST(request: Request) {
  let body: { url?: string; website?: string };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "invalid json" }, { status: 400 });
  }

  const { url, website } = body;

  if (!url || typeof url !== "string") {
    return NextResponse.json({ error: "url is required" }, { status: 400 });
  }

  try {
    const { url: parsed } = await assertIngestAllowed(request, url, website);

    const botUrl = process.env.INGEST_BOT_URL;
    let incident: NewsIncident;

    if (botUrl) {
      try {
        const botResponse = await fetch(`${botUrl}/ingest`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ url: parsed.href }),
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
        incident = await ingestUrl(parsed.href);
      }
    } else {
      incident = await ingestUrl(parsed.href);
    }

    const saved = await upsertIncident(incident);
    return NextResponse.json(saved, { status: 201 });
  } catch (error) {
    if (error instanceof IngestDenied) {
      return NextResponse.json(
        { error: error.message },
        { status: error.status },
      );
    }
    const message =
      error instanceof Error ? error.message : "Could not ingest URL";
    return NextResponse.json({ error: message }, { status: 502 });
  }
}
