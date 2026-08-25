import type { NewsIncident } from "./types";

export type PersonEntry = {
  name: string;
  initials: string;
  color: string;
  storyCount: number;
  locations: string[];
  sources: string[];
  stories: Array<{
    id: string;
    title: string;
    url: string;
    source: string;
    locationLabel: string | null;
  }>;
};

function initialsFromName(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "?";
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return `${parts[0][0]}${parts[parts.length - 1][0]}`.toUpperCase();
}

function colorFromName(name: string): string {
  let hash = 0;
  for (let i = 0; i < name.length; i += 1) {
    hash = name.charCodeAt(i) + ((hash << 5) - hash);
  }
  const palette = [
    "#1f6f78",
    "#3d5a80",
    "#8b4a3a",
    "#5c6b4a",
    "#6b4f71",
    "#2f5d50",
    "#7a5c2e",
  ];
  return palette[Math.abs(hash) % palette.length];
}

export function buildPeopleDirectory(
  incidents: NewsIncident[],
): PersonEntry[] {
  const map = new Map<string, PersonEntry>();

  for (const incident of incidents) {
    for (const raw of incident.peopleInvolved ?? []) {
      const name = raw.trim();
      if (!name) continue;
      const key = name.toLowerCase();
      const existing = map.get(key);
      const story = {
        id: incident.id,
        title: incident.title,
        url: incident.url,
        source: incident.source,
        locationLabel: incident.locationLabel,
      };

      if (!existing) {
        map.set(key, {
          name,
          initials: initialsFromName(name),
          color: colorFromName(name),
          storyCount: 1,
          locations: incident.locationLabel ? [incident.locationLabel] : [],
          sources: [incident.source],
          stories: [story],
        });
        continue;
      }

      existing.storyCount += 1;
      existing.stories.push(story);
      if (
        incident.locationLabel &&
        !existing.locations.includes(incident.locationLabel)
      ) {
        existing.locations.push(incident.locationLabel);
      }
      if (!existing.sources.includes(incident.source)) {
        existing.sources.push(incident.source);
      }
    }
  }

  return Array.from(map.values()).sort((a, b) =>
    a.name.localeCompare(b.name, "en", { sensitivity: "base" }),
  );
}
