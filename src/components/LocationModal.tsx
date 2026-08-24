"use client";

import { useEffect, useId, useState, type FormEvent } from "react";
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
        setError("No UK places found. Try a town or city name.");
      } else {
        setSelected(hits[0]);
      }
    } catch {
      setError("Search failed");
    } finally {
      setBusy(false);
    }
  }

  async function save() {
    if (!selected) {
      setError("Search and pick a place first.");
      return;
    }

    setBusy(true);
    setError(null);

    try {
      const res = await fetch(`/api/incidents/${incident.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          locationLabel: query.trim() || selected.label.split(",")[0],
          lat: selected.lat,
          lng: selected.lng,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? "Could not save location");
        return;
      }
      onSaved(data as NewsIncident);
    } catch {
      setError("Could not save location");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div
      className="anim-fade fixed inset-0 z-[1000] flex items-end justify-center bg-[rgba(16,24,32,0.45)] p-3 backdrop-blur-[2px] sm:items-center sm:p-4"
      role="presentation"
      onClick={onClose}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        className="anim-rise w-full max-w-md rounded-2xl border border-[var(--line)] bg-[var(--paper)] p-5 shadow-[0_24px_60px_rgba(16,24,32,0.22)]"
        onClick={(event) => event.stopPropagation()}
      >
        <h2
          id={titleId}
          className="font-[family-name:var(--font-display)] text-2xl tracking-tight text-[var(--ink)]"
        >
          Add location
        </h2>
        <p className="mt-1 text-sm text-[var(--ink-soft)]">
          No map pin was found. Search a UK place to drop one.
        </p>
        <p className="mt-3 line-clamp-2 text-sm font-semibold text-[var(--ink)]">
          {incident.title}
        </p>

        <form onSubmit={search} className="mt-4 flex gap-2">
          <input
            autoFocus
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="e.g. Manchester, Leeds, Cornwall"
            className="min-w-0 flex-1 rounded-xl border border-[var(--line)] bg-white px-3.5 py-2.5 text-sm outline-none focus:border-[var(--accent)] focus:ring-2 focus:ring-[var(--accent)]/20"
          />
          <button
            type="submit"
            disabled={busy}
            className="rounded-xl bg-[var(--ink)] px-3.5 py-2.5 text-sm font-semibold text-white transition hover:bg-[var(--ink-soft)] disabled:opacity-55"
          >
            Search
          </button>
        </form>

        {results.length > 0 ? (
          <ul className="mt-3 max-h-40 overflow-y-auto rounded-xl border border-[var(--line)] bg-white">
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
                    className={`w-full px-3.5 py-2.5 text-left text-sm transition ${
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

        <div className="mt-5 flex justify-end gap-2">
          <button
            type="button"
            onClick={onClose}
            className="rounded-xl px-3.5 py-2.5 text-sm font-medium text-[var(--ink-soft)] transition hover:text-[var(--ink)]"
          >
            Skip
          </button>
          <button
            type="button"
            onClick={() => void save()}
            disabled={busy || !selected}
            className="rounded-xl bg-[var(--accent)] px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-[var(--accent-strong)] disabled:cursor-not-allowed disabled:opacity-55"
          >
            Save pin
          </button>
        </div>
      </div>
    </div>
  );
}
