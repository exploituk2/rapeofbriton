"use client";

import { useEffect, useId, useState, type FormEvent } from "react";
import { lookupKnownPlace } from "@/lib/places";
import type { NewsIncident } from "@/lib/types";

type GeocodeHit = {
  label: string;
  lat: number;
  lng: number;
};

type Props = {
  incident: NewsIncident;
  onClose: () => void;
  onSaved: (incident: NewsIncident) => void;
};

export default function LocationModal({ incident, onClose, onSaved }: Props) {
  const titleId = useId();
  const [query, setQuery] = useState(incident.locationLabel ?? "");
  const [results, setResults] = useState<GeocodeHit[]>([]);
  const [selected, setSelected] = useState<GeocodeHit | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    function onKey(event: KeyboardEvent) {
      if (event.key === "Escape") onClose();
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  async function resolvePlace(q: string): Promise<GeocodeHit | null> {
    const known = lookupKnownPlace(q);
    if (known) {
      return { label: known.label, lat: known.lat, lng: known.lng };
    }

    const res = await fetch(`/api/geocode?q=${encodeURIComponent(q)}`);
    const data = await res.json();
    if (!res.ok) {
      throw new Error(data.error ?? "Search failed");
    }
    const hits = data as GeocodeHit[];
    return hits[0] ?? null;
  }

  async function search(event: FormEvent) {
    event.preventDefault();
    const q = query.trim();
    if (!q) return;

    setBusy(true);
    setError(null);
    setSelected(null);

    try {
      const res = await fetch(`/api/geocode?q=${encodeURIComponent(q)}`);
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? "Search failed");
        setResults([]);
        return;
      }
      const hits = data as GeocodeHit[];
      setResults(hits);
      if (hits.length === 0) {
        setError(
          "No places found in the UK or Ireland. Try a town or city name.",
        );
      } else {
        setSelected(hits[0]);
      }
    } catch {
      const known = lookupKnownPlace(q);
      if (known) {
        const hit = { label: known.label, lat: known.lat, lng: known.lng };
        setResults([hit]);
        setSelected(hit);
      } else {
        setError("Search failed");
      }
    } finally {
      setBusy(false);
    }
  }

  async function save() {
    const q = query.trim();
    let place = selected;

    setBusy(true);
    setError(null);

    try {
      if (!place && q) {
        place = await resolvePlace(q);
        if (place) {
          setSelected(place);
          setResults((prev) => (prev.length ? prev : [place as GeocodeHit]));
        }
      }

      if (!place) {
        setError("Search and pick a place first (e.g. Dublin).");
        return;
      }

      const res = await fetch(`/api/incidents/${incident.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          locationLabel: q || place.label.split(",")[0],
          lat: place.lat,
          lng: place.lng,
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(
          typeof data.error === "string"
            ? data.error
            : `Could not save location (${res.status})`,
        );
        return;
      }
      onSaved(data as NewsIncident);
    } catch {
      setError("Could not save location — check you are online and try again.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div
      className="anim-fade fixed inset-0 z-[1000] flex items-end justify-center bg-[rgba(16,24,32,0.45)] p-0 backdrop-blur-[2px] sm:items-center sm:p-4"
      role="presentation"
      onClick={onClose}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        className="anim-rise max-h-[min(92dvh,720px)] w-full overflow-y-auto rounded-t-3xl border border-[var(--line)] border-b-0 bg-[var(--paper)] p-5 pb-[calc(1.25rem+var(--safe-bottom))] shadow-[0_24px_60px_rgba(16,24,32,0.22)] sm:max-h-[85dvh] sm:max-w-md sm:rounded-2xl sm:border-b sm:pb-5"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="mb-3 flex justify-center sm:hidden">
          <span className="h-1 w-10 rounded-full bg-[rgba(16,24,32,0.22)]" />
        </div>
        <h2
          id={titleId}
          className="font-[family-name:var(--font-display)] text-2xl tracking-tight text-[var(--ink)]"
        >
          Add location
        </h2>
        <p className="mt-1 text-sm text-[var(--ink-soft)]">
          Type a place (e.g. Dublin), press Search, then Save pin — or Save
          directly after typing a known city.
        </p>
        <p className="mt-3 line-clamp-2 text-sm font-semibold text-[var(--ink)]">
          {incident.title}
        </p>

        <form onSubmit={search} className="mt-4 flex flex-col gap-2 sm:flex-row">
          <input
            autoFocus
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="e.g. Dublin, Manchester, Cork"
            className="min-h-11 min-w-0 flex-1 rounded-xl border border-[var(--line)] bg-white px-3.5 py-2.5 text-base outline-none focus:border-[var(--accent)] focus:ring-2 focus:ring-[var(--accent)]/20 sm:text-sm"
          />
          <button
            type="submit"
            disabled={busy}
            className="min-h-11 rounded-xl bg-[var(--ink)] px-3.5 py-2.5 text-sm font-semibold text-white transition hover:bg-[var(--ink-soft)] disabled:opacity-55"
          >
            Search
          </button>
        </form>

        {results.length > 0 ? (
          <ul className="mt-3 max-h-[35dvh] overflow-y-auto rounded-xl border border-[var(--line)] bg-white sm:max-h-40">
            {results.map((hit) => {
              const active =
                selected?.lat === hit.lat && selected?.lng === hit.lng;
              return (
                <li
                  key={`${hit.lat}-${hit.lng}-${hit.label}`}
                  className="border-b border-[var(--line)] last:border-b-0"
                >
                  <button
                    type="button"
                    onClick={() => setSelected(hit)}
                    className={`min-h-11 w-full px-3.5 py-2.5 text-left text-sm transition ${
                      active
                        ? "bg-[var(--accent)] font-medium text-white"
                        : "text-[var(--ink-soft)] hover:bg-[rgba(31,111,120,0.08)] hover:text-[var(--ink)]"
                    }`}
                  >
                    {hit.label}
                  </button>
                </li>
              );
            })}
          </ul>
        ) : null}

        {error ? (
          <p className="mt-3 text-sm text-[var(--danger)]" role="alert">
            {error}
          </p>
        ) : null}

        <div className="mt-5 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
          <button
            type="button"
            onClick={onClose}
            className="min-h-11 rounded-xl px-3.5 py-2.5 text-sm font-medium text-[var(--ink-soft)] transition hover:text-[var(--ink)]"
          >
            Skip
          </button>
          <button
            type="button"
            onClick={() => void save()}
            disabled={busy || (!selected && !query.trim())}
            className="min-h-11 rounded-xl bg-[var(--accent)] px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-[var(--accent-strong)] disabled:cursor-not-allowed disabled:opacity-55"
          >
            Save pin
          </button>
        </div>
      </div>
    </div>
  );
}
