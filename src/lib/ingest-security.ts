import { getSupabase, isSupabaseConfigured } from "@/lib/supabase";

const HOURLY_LIMIT = Number(process.env.INGEST_HOURLY_LIMIT ?? 8);
const DAILY_LIMIT = Number(process.env.INGEST_DAILY_LIMIT ?? 30);

/** Always-blocked domains (spam / shortener abuse). */
const STATIC_BANNED_DOMAINS = new Set(
  [
    "bit.ly",
    "tinyurl.com",
    "t.co",
    "goo.gl",
    "ow.ly",
    "is.gd",
    "buff.ly",
    "cutt.ly",
    ...(process.env.BANNED_DOMAINS ?? "")
      .split(",")
      .map((d) => d.trim().toLowerCase())
      .filter(Boolean),
  ].map((d) => d.toLowerCase()),
);

export function clientIp(request: Request): string {
  const forwarded = request.headers.get("x-forwarded-for");
  if (forwarded) return forwarded.split(",")[0]?.trim() || "unknown";
  return (
    request.headers.get("x-real-ip") ||
    request.headers.get("cf-connecting-ip") ||
    "unknown"
  );
}

function normalizeUrl(raw: string): URL {
  const url = new URL(raw);
  if (url.protocol !== "http:" && url.protocol !== "https:") {
    throw new Error("Only http(s) URLs are allowed");
  }
  return url;
}

function hostOf(url: URL): string {
  return url.hostname.replace(/^www\./, "").toLowerCase();
}

export async function assertIngestAllowed(
  request: Request,
  rawUrl: string,
  honeypot?: string,
): Promise<{ url: URL; ip: string }> {
  // Bots that fill hidden fields get rejected quietly.
  if (honeypot && honeypot.trim().length > 0) {
    throw new IngestDenied("Rejected", 400);
  }

  let url: URL;
  try {
    url = normalizeUrl(rawUrl.trim());
  } catch {
    throw new IngestDenied("invalid url", 400);
  }

  if (rawUrl.length > 2000) {
    throw new IngestDenied("URL is too long", 400);
  }

  const host = hostOf(url);
  if (STATIC_BANNED_DOMAINS.has(host)) {
    throw new IngestDenied("This domain is not allowed", 403);
  }

  const ip = clientIp(request);

  if (isSupabaseConfigured()) {
    const supabase = getSupabase();

    const { data: bans } = await supabase
      .from("ingest_bans")
      .select("ban_type, value");

    for (const ban of bans ?? []) {
      const value = String(ban.value).toLowerCase();
      if (ban.ban_type === "domain" && host === value) {
        throw new IngestDenied("This domain is banned", 403);
      }
      if (ban.ban_type === "url" && url.href.toLowerCase() === value) {
        throw new IngestDenied("This URL is banned", 403);
      }
      if (
        ban.ban_type === "prefix" &&
        url.href.toLowerCase().startsWith(value)
      ) {
        throw new IngestDenied("This URL is banned", 403);
      }
    }

    const hourAgo = new Date(Date.now() - 60 * 60 * 1000).toISOString();
    const dayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();

    const [{ count: hourCount }, { count: dayCount }] = await Promise.all([
      supabase
        .from("ingest_attempts")
        .select("*", { count: "exact", head: true })
        .eq("ip", ip)
        .gte("created_at", hourAgo),
      supabase
        .from("ingest_attempts")
        .select("*", { count: "exact", head: true })
        .eq("ip", ip)
        .gte("created_at", dayAgo),
    ]);

    if ((hourCount ?? 0) >= HOURLY_LIMIT) {
      throw new IngestDenied(
        "Too many submissions from your network. Try again later.",
        429,
      );
    }
    if ((dayCount ?? 0) >= DAILY_LIMIT) {
      throw new IngestDenied(
        "Daily submission limit reached. Try again tomorrow.",
        429,
      );
    }

    await supabase.from("ingest_attempts").insert({
      ip,
      url: url.href,
    });
  }

  return { url, ip };
}

export class IngestDenied extends Error {
  status: number;
  constructor(message: string, status: number) {
    super(message);
    this.status = status;
  }
}

export async function listBans() {
  if (!isSupabaseConfigured()) return [];
  const { data, error } = await getSupabase()
    .from("ingest_bans")
    .select("*")
    .order("created_at", { ascending: false });
  if (error) throw new Error(error.message);
  return data ?? [];
}

export async function addBan(input: {
  banType: "url" | "domain" | "prefix";
  value: string;
  reason?: string;
}) {
  if (!isSupabaseConfigured()) {
    throw new Error("Supabase is required to store bans");
  }
  const value = input.value.trim().toLowerCase();
  const { data, error } = await getSupabase()
    .from("ingest_bans")
    .upsert(
      {
        ban_type: input.banType,
        value,
        reason: input.reason ?? null,
      },
      { onConflict: "ban_type,value" },
    )
    .select("*")
    .single();
  if (error) throw new Error(error.message);
  return data;
}

export async function removeBan(id: string) {
  if (!isSupabaseConfigured()) {
    throw new Error("Supabase is required to store bans");
  }
  const { error } = await getSupabase()
    .from("ingest_bans")
    .delete()
    .eq("id", id);
  if (error) throw new Error(error.message);
}
