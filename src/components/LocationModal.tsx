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
      className="fixed inset-0 z-[1000] flex items-center justify-center bg-stone-950/55 p-4"
      role="presentation"
      onClick={onClose}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        className="w-full max-w-md border border-stone-300 bg-stone-50 p-5 shadow-[0_20px_60px_rgba(20,15,10,0.35)]"
        onClick={(event) => event.stopPropagation()}
      >
        <h2
          id={titleId}
          className="font-[family-name:var(--font-display)] text-2xl text-stone-900"
        >
          Add location
        </h2>
        <p className="mt-1 text-sm text-stone-600">
          No map pin was found for this story. Search for a UK place to pin it.
        </p>
        <p className="mt-3 line-clamp-2 text-sm font-medium text-stone-800">
          {incident.title}
        </p>

        <form onSubmit={search} className="mt-4 flex gap-2">
          <input
            autoFocus
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="e.g. Manchester, Leeds, Cornwall"
            className="min-w-0 flex-1 border border-stone-300 bg-white px-3 py-2 text-sm outline-none ring-stone-800 focus:ring-2"
          />
          <button
            type="submit"
            disabled={busy}
            className="bg-stone-800 px-3 py-2 text-sm text-stone-50 hover:bg-stone-700 disabled:opacity-60"
          >
            Search
          </button>
        </form>

        {results.length > 0 ? (
          <ul className="mt-3 max-h-40 divide-y divide-stone-200 overflow-y-auto border border-stone-200">
            {results.map((hit) => {
              const active =
                selected?.lat === hit.lat && selected?.lng === hit.lng;
              return (
                <li key={`${hit.lat}-${hit.lng}-${hit.label}`}>
                  <button
                    type="button"
                    onClick={() => setSelected(hit)}
                    className={`w-full px-3 py-2 text-left text-sm ${
                      active
                        ? "bg-stone-900 text-stone-50"
                        : "bg-white text-stone-700 hover:bg-stone-100"
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
          <p className="mt-3 text-sm text-red-700" role="alert">
            {error}
          </p>
        ) : null}

        <div className="mt-5 flex justify-end gap-2">
          <button
            type="button"
            onClick={onClose}
            className="px-3 py-2 text-sm text-stone-600 hover:text-stone-900"
          >
            Skip
          </button>
          <button
            type="button"
            onClick={() => void save()}
            disabled={busy || !selected}
            className="bg-stone-900 px-4 py-2 text-sm font-medium text-stone-50 hover:bg-stone-700 disabled:cursor-not-allowed disabled:opacity-60"
          >
            Save pin
          </button>
        </div>
      </div>
    </div>
  );
}
