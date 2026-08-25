import { NextResponse } from "next/server";
import { listIncidents, upsertIncident } from "@/lib/incidents";
import type { NewsIncident } from "@/lib/types";

export async function GET() {
  const incidents = await listIncidents();
  return NextResponse.json(incidents);
}

export async function POST(request: Request) {
  const body = (await request.json()) as Partial<NewsIncident>;

  if (!body.url || !body.title) {
    return NextResponse.json(
      { error: "url and title are required" },
      { status: 400 },
    );
  }

  const incident: NewsIncident = {
    id: body.id ?? crypto.randomUUID(),
    url: body.url,
    source: body.source ?? new URL(body.url).hostname.replace(/^www\./, ""),
    title: body.title,
    summary: body.summary ?? "",
    peopleInvolved: body.peopleInvolved ?? [],
    locationLabel: body.locationLabel ?? null,
    lat: body.lat ?? null,
    lng: body.lng ?? null,
    publishedAt: body.publishedAt ?? null,
    createdAt: body.createdAt ?? new Date().toISOString(),
  };

  const saved = await upsertIncident(incident);
  return NextResponse.json(saved, { status: 201 });
}
