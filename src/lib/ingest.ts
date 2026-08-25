import * as cheerio from "cheerio";
import { KNOWN_PLACES, lookupKnownPlace } from "@/lib/places";
import type { NewsIncident } from "@/lib/types";

const USER_AGENT =
  "RapeOfBriton/0.1 (+https://github.com/exploituk2/rapeofbriton; news-map ingest)";

const SOURCE_ALIASES: Record<string, string> = {
  "bbc.co.uk": "BBC",
  "bbc.com": "BBC",
  "gbnews.com": "GB News",
  "sky.com": "Sky News",
  "news.sky.com": "Sky News",
  "theguardian.com": "The Guardian",
  "telegraph.co.uk": "The Telegraph",
  "independent.co.uk": "The Independent",
  "dailymail.co.uk": "Daily Mail",
  "mirror.co.uk": "Mirror",
  "x.com": "X",
  "twitter.com": "X",
};

const PLACE_NAMES = Object.values(KNOWN_PLACES)
  .map((p) => p.label)
  .concat([
    "Cornwall",
    "Devon",
    "Kent",
    "Essex",
    "Yorkshire",
    "Wales",
    "Scotland",
    "County Cork",
    "County Dublin",
  ])
  .sort((a, b) => b.length - a.length);

const NAME_TOKEN =
  "[A-Z][a-z]+(?:['’][A-Z]?[a-z]+)?(?:-[A-Z][a-z]+)?";
const PERSON_NAME = `${NAME_TOKEN}(?:\\s+${NAME_TOKEN}){1,3}`;

const NAME_STOPWORDS = new Set([
  "British",
  "Crown",
  "Court",
  "Police",
  "Force",
  "News",
  "Monday",
  "Tuesday",
  "Wednesday",
  "Thursday",
  "Friday",
  "Saturday",
  "Sunday",
  "January",
  "February",
  "March",
  "April",
  "June",
  "July",
  "August",
  "September",
  "October",
  "November",
  "December",
  "United",
  "Kingdom",
  "Northern",
  "Ireland",
  "Great",
  "Britain",
  "Metropolitan",
  "Detective",
  "Constable",
  "Inspector",
  "Sergeant",
  "Judge",
  "Justice",
  "Home",
  "Office",
]);

function cleanText(value: string | undefined | null): string {
  if (!value) return "";
  return value.replace(/\s+/g, " ").trim();
}

function sourceFromUrl(url: string): string {
  try {
    const host = new URL(url).hostname.replace(/^www\./, "");
    return SOURCE_ALIASES[host] ?? host;
  } catch {
    return "unknown";
  }
}

function meta($: cheerio.CheerioAPI, ...keys: string[]): string {
  for (const key of keys) {
    const content =
      $(`meta[property="${key}"]`).attr("content") ||
      $(`meta[name="${key}"]`).attr("content");
    if (content) return cleanText(content);
  }
  return "";
}

function extractArticle(html: string) {
  const $ = cheerio.load(html);
  let title =
    meta($, "og:title", "twitter:title") ||
    cleanText($("title").first().text()) ||
    "Untitled article";
  title = title
    .replace(/\s*[|\-–—]\s*(BBC News|GB News|Sky News).*$/i, "")
    .trim();

  let summary = meta(
    $,
    "og:description",
    "twitter:description",
    "description",
  );
  const published =
    meta(
      $,
      "article:published_time",
      "og:updated_time",
      "pubdate",
      "publish-date",
      "date",
    ) || null;

  const paragraphs = $(
    "article p, [data-component='text-block'] p, .article-body p, main p, .article__body p, [itemprop='articleBody'] p",
  )
    .toArray()
    .map((el) => cleanText($(el).text()))
    .filter(Boolean);

  const bodyText = paragraphs.slice(0, 12).join(" ");
  if (!summary && paragraphs.length) {
    summary = paragraphs.slice(0, 4).join(" ").slice(0, 280);
  }

  return {
    title,
    summary: summary.slice(0, 400),
    published,
    bodyText,
  };
}

function looksLikePerson(name: string): boolean {
  const parts = name.split(/\s+/);
  if (parts.length < 2 || parts.length > 4) return false;
  if (parts.some((part) => NAME_STOPWORDS.has(part))) return false;
  if (PLACE_NAMES.some((place) => place.toLowerCase() === name.toLowerCase())) {
    return false;
  }
  if (
    parts.some((part) =>
      PLACE_NAMES.some((place) => place.toLowerCase() === part.toLowerCase()),
    )
  ) {
    return false;
  }
  return true;
}

function extractPeople(title: string, summary: string, body: string): string[] {
  const text = `${title}. ${summary}. ${body}`;
  const found: string[] = [];
  const patterns = [
    new RegExp(`\\b(${PERSON_NAME}),\\s*(?:aged\\s+)?\\d{1,3}\\b`, "g"),
    new RegExp(
      `\\b(${PERSON_NAME}),\\s*\\d{1,3},\\s*and\\s+(${PERSON_NAME}),\\s*\\d{1,3}\\b`,
      "g",
    ),
    new RegExp(
      `\\b(?:charged|arrested|jailed|sentenced|convicted)\\s+(${PERSON_NAME})\\b`,
      "g",
    ),
    new RegExp(
      `\\b(${PERSON_NAME})\\s+(?:was|has been|have been|were)\\s+(?:charged|arrested|jailed|sentenced|convicted|remanded)\\b`,
      "g",
    ),
    new RegExp(
      `\\b(${PERSON_NAME})\\s+(?:jailed|sentenced|convicted|remanded)\\b`,
      "g",
    ),
    new RegExp(
      `\\b(?:defendant|suspect|accused|offender|attacker)\\s+(${PERSON_NAME})\\b`,
      "g",
    ),
    new RegExp(`\\bnamed(?:\\s+in\\s+court)?\\s+as\\s+(${PERSON_NAME})\\b`, "g"),
  ];

  for (const pattern of patterns) {
    for (const match of text.matchAll(pattern)) {
      for (const group of match.slice(1)) {
        if (!group) continue;
        let name = cleanText(group).replace(/^(?:Mr|Mrs|Ms|Miss|Dr)\s+/, "");
        if (looksLikePerson(name) && !found.includes(name)) {
          found.push(name);
        }
      }
    }
  }

  return found.slice(0, 8);
}

function findPlace(text: string): string | null {
  for (const place of PLACE_NAMES) {
    const re = new RegExp(`\\b${place.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\b`, "i");
    if (re.test(text)) return place;
  }
  return null;
}

async function geocodePlace(
  place: string,
): Promise<{ lat: number; lng: number } | null> {
  const known = lookupKnownPlace(place);
  if (known) return { lat: known.lat, lng: known.lng };

  const params = new URLSearchParams({
    q: place,
    format: "json",
    limit: "1",
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
  if (!res.ok) return null;
  const data = (await res.json()) as Array<{ lat: string; lon: string }>;
  if (!data[0]) return null;
  return { lat: Number(data[0].lat), lng: Number(data[0].lon) };
}

export async function ingestUrl(url: string): Promise<NewsIncident> {
  const response = await fetch(url, {
    headers: {
      "User-Agent": USER_AGENT,
      Accept: "text/html,application/xhtml+xml",
      "Accept-Language": "en-GB,en;q=0.9",
    },
    redirect: "follow",
    cache: "no-store",
  });

  if (!response.ok) {
    throw new Error(`Upstream returned HTTP ${response.status}`);
  }

  const contentType = response.headers.get("content-type") ?? "";
  if (!contentType.includes("html") && !contentType.includes("text/")) {
    throw new Error("URL did not return HTML");
  }

  const html = await response.text();
  const { title, summary, published, bodyText } = extractArticle(html);
  const place = findPlace(`${title}. ${summary}. ${bodyText}`);
  const people = extractPeople(title, summary, bodyText);

  let lat: number | null = null;
  let lng: number | null = null;
  if (place) {
    const coords = await geocodePlace(place);
    if (coords) {
      lat = coords.lat;
      lng = coords.lng;
    }
  }

  return {
    id: crypto.randomUUID(),
    url,
    source: sourceFromUrl(url),
    title,
    summary,
    peopleInvolved: people,
    locationLabel: place,
    lat,
    lng,
    publishedAt: published,
    createdAt: new Date().toISOString(),
  };
}
