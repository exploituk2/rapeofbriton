import { NextResponse } from "next/server";

const USER_AGENT = "RapeOfBriton/0.1 (local; location lookup)";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const q = searchParams.get("q")?.trim();

  if (!q) {
    return NextResponse.json({ error: "q is required" }, { status: 400 });
  }

  const params = new URLSearchParams({
    q: `${q}, United Kingdom`,
    format: "json",
    limit: "5",
    countrycodes: "gb",
  });

  const res = await fetch(
    `https://nominatim.openstreetmap.org/search?${params}`,
    {
      headers: { "User-Agent": USER_AGENT },
      cache: "no-store",
    },
  );

  if (!res.ok) {
    return NextResponse.json(
      { error: "Geocoding service failed" },
      { status: 502 },
    );
  }

  const data = (await res.json()) as Array<{
    display_name: string;
    lat: string;
    lon: string;
  }>;

  return NextResponse.json(
    data.map((item) => ({
      label: item.display_name,
      lat: Number(item.lat),
      lng: Number(item.lon),
    })),
  );
}
