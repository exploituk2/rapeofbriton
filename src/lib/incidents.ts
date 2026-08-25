import { promises as fs } from "fs";
import path from "path";
import type { NewsIncident } from "./types";

const DATA_PATH = path.join(process.cwd(), "data", "incidents.json");

async function ensureStore(): Promise<void> {
  await fs.mkdir(path.dirname(DATA_PATH), { recursive: true });
  try {
    await fs.access(DATA_PATH);
  } catch {
    await fs.writeFile(DATA_PATH, "[]", "utf8");
  }
}

export async function listIncidents(): Promise<NewsIncident[]> {
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

export async function getIncidentById(
  id: string,
): Promise<NewsIncident | null> {
  const items = await listIncidents();
  return items.find((item) => item.id === id) ?? null;
}

export async function upsertIncident(
  incident: NewsIncident,
): Promise<NewsIncident> {
  await ensureStore();
  const items = await listIncidents();
  const existingIndex = items.findIndex(
    (item) => item.url === incident.url || item.id === incident.id,
  );

  if (existingIndex >= 0) {
    items[existingIndex] = { ...items[existingIndex], ...incident };
  } else {
    items.unshift(incident);
  }

  await fs.writeFile(DATA_PATH, JSON.stringify(items, null, 2), "utf8");
  return incident;
}
