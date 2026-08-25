import { NextResponse } from "next/server";
import { lookupKnownPlace } from "@/lib/places";

const USER_AGENT = "RapeOfBriton/0.1 (local; location lookup)";

type Hit = { label: string; lat: number; lng: number };

async function nominatimSearch(q: string): Promise<Hit[]> {
  const params = new URLSearchParams({
    q,
    format: "json",
    limit: "8",
    countrycodes: "gb,ie",
  });

  const res = await fetch(
    `https://nominatim.openstreetmap.org/search?${params}`,
    {
      headers: {
        "User-Agent": USER_AGENT,
        Accept: "application/json",
        "Accept-Language": "en",
      },
      cache: "no-store",
    },
  );

  if (!res.ok) return [];

  const data = (await res.json()) as Array<{
    display_name: string;
    lat: string;
    lon: string;
  }>;

  return data.map((item) => ({
    label: item.display_name,
    lat: Number(item.lat),
    lng: Number(item.lon),
  }));
}

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const q = searchParams.get("q")?.trim();

  if (!q) {
    return NextResponse.json({ error: "q is required" }, { status: 400 });
  }

  try {
    let hits = await nominatimSearch(q);

    const known = lookupKnownPlace(q);
    if (known) {
      const already = hits.some(
        (hit) =>
          Math.abs(hit.lat - known.lat) < 0.05 &&
          Math.abs(hit.lng - known.lng) < 0.05,
      );
      if (!already) {
        hits = [{ label: known.label, lat: known.lat, lng: known.lng }, ...hits];
      }
    }

    if (hits.length === 0 && known) {
      hits = [{ label: known.label, lat: known.lat, lng: known.lng }];
    }

    return NextResponse.json(hits);
  } catch {
    const known = lookupKnownPlace(q);
    if (known) {
      return NextResponse.json([
        { label: known.label, lat: known.lat, lng: known.lng },
      ]);
    }
    return NextResponse.json(
      { error: "Geocoding service failed" },
      { status: 502 },
    );
  }
}
