import { promises as fs } from "fs";
import path from "path";
import { getSupabase, isSupabaseConfigured } from "@/lib/supabase";
import type { NewsIncident } from "./types";

const DATA_PATH = path.join(process.cwd(), "data", "incidents.json");

type DbRow = {
  id: string;
  url: string;
  source: string;
  title: string;
  summary: string;
  people_involved: string[] | null;
  location_label: string | null;
  lat: number | null;
  lng: number | null;
  published_at: string | null;
  created_at: string;
};

function fromRow(row: DbRow): NewsIncident {
  return {
    id: row.id,
    url: row.url,
    source: row.source,
    title: row.title,
    summary: row.summary,
    peopleInvolved: row.people_involved ?? [],
    locationLabel: row.location_label,
    lat: row.lat,
    lng: row.lng,
    publishedAt: row.published_at,
    createdAt: row.created_at,
  };
}

function toRow(incident: NewsIncident) {
  return {
    id: incident.id,
    url: incident.url,
    source: incident.source,
    title: incident.title,
    summary: incident.summary,
    people_involved: incident.peopleInvolved ?? [],
    location_label: incident.locationLabel,
    lat: incident.lat,
    lng: incident.lng,
    published_at: incident.publishedAt,
    created_at: incident.createdAt,
  };
}

function requireRemoteStore(): void {
  if (isSupabaseConfigured()) return;
  if (process.env.VERCEL) {
    throw new Error(
      "Supabase is not configured on Vercel. Add SUPABASE_URL and SUPABASE_ANON_KEY, then redeploy.",
    );
  }
}

async function ensureStore(): Promise<void> {
  await fs.mkdir(path.dirname(DATA_PATH), { recursive: true });
  try {
    await fs.access(DATA_PATH);
  } catch {
    await fs.writeFile(DATA_PATH, "[]", "utf8");
  }
}

async function listLocal(): Promise<NewsIncident[]> {
  await ensureStore();
  const raw = await fs.readFile(DATA_PATH, "utf8");
  const parsed = JSON.parse(raw) as NewsIncident[];
  return parsed
    .map((item) => ({
      ...item,
      peopleInvolved: item.peopleInvolved ?? [],
    }))
    .sort(
      (a, b) =>
        new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
    );
}

async function listRemote(): Promise<NewsIncident[]> {
  const supabase = getSupabase();
  const { data, error } = await supabase
    .from("news_incidents")
    .select("*")
    .order("created_at", { ascending: false });

  if (error) throw new Error(error.message);
  return (data as DbRow[]).map(fromRow);
}

export async function listIncidents(): Promise<NewsIncident[]> {
  requireRemoteStore();
  if (isSupabaseConfigured()) return listRemote();
  return listLocal();
}

export async function getIncidentById(
  id: string,
): Promise<NewsIncident | null> {
  requireRemoteStore();
  if (isSupabaseConfigured()) {
    const supabase = getSupabase();
    const { data, error } = await supabase
      .from("news_incidents")
      .select("*")
      .eq("id", id)
      .maybeSingle();
    if (error) throw new Error(error.message);
    return data ? fromRow(data as DbRow) : null;
  }

  const items = await listLocal();
  return items.find((item) => item.id === id) ?? null;
}

export async function upsertIncident(
  incident: NewsIncident,
): Promise<NewsIncident> {
  requireRemoteStore();
  const normalized: NewsIncident = {
    ...incident,
    peopleInvolved: incident.peopleInvolved ?? [],
  };

  if (isSupabaseConfigured()) {
    const supabase = getSupabase();
    const row = toRow(normalized);

    const { data: byUrl } = await supabase
      .from("news_incidents")
      .select("id")
      .eq("url", normalized.url)
      .maybeSingle();

    const id = byUrl?.id ?? normalized.id;
    const payload = { ...row, id };

    const { data, error } = await supabase
      .from("news_incidents")
      .upsert(payload, { onConflict: "id" })
      .select("*")
      .single();

    if (error) throw new Error(error.message);
    return fromRow(data as DbRow);
  }

  await ensureStore();
  const items = await listLocal();
  const existingIndex = items.findIndex(
    (item) => item.url === normalized.url || item.id === normalized.id,
  );

  if (existingIndex >= 0) {
    items[existingIndex] = { ...items[existingIndex], ...normalized };
  } else {
    items.unshift(normalized);
  }

  await fs.writeFile(DATA_PATH, JSON.stringify(items, null, 2), "utf8");
  return normalized;
}
