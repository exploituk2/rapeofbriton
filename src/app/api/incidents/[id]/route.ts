import { NextResponse } from "next/server";
import { getIncidentById, upsertIncident } from "@/lib/incidents";

type Params = { params: Promise<{ id: string }> };

export async function PATCH(request: Request, { params }: Params) {
  try {
    const { id } = await params;
    const existing = await getIncidentById(id);

    if (!existing) {
      return NextResponse.json(
        { error: "Incident not found" },
        { status: 404 },
      );
    }

    const body = (await request.json()) as {
      locationLabel?: string | null;
      lat?: number | null;
      lng?: number | null;
    };

    if (
      body.lat == null ||
      body.lng == null ||
      Number.isNaN(body.lat) ||
      Number.isNaN(body.lng)
    ) {
      return NextResponse.json(
        { error: "lat and lng are required" },
        { status: 400 },
      );
    }

    const saved = await upsertIncident({
      ...existing,
      peopleInvolved: existing.peopleInvolved ?? [],
      locationLabel: body.locationLabel?.trim() || existing.locationLabel,
      lat: body.lat,
      lng: body.lng,
    });

    return NextResponse.json(saved);
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Could not save location";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
