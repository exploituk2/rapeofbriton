"use client";

import dynamic from "next/dynamic";
import { useCallback, useEffect, useState, type FormEvent } from "react";
import LocationModal from "@/components/LocationModal";
import type { NewsIncident } from "@/lib/types";

const NewsMap = dynamic(() => import("@/components/NewsMap"), {
  ssr: false,
  loading: () => (
    <div className="flex h-full items-center justify-center bg-stone-200 text-stone-600">
      Loading map…
    </div>
  ),
});

export default function HomeClient() {
  const [incidents, setIncidents] = useState<NewsIncident[]>([]);
  const [url, setUrl] = useState("");
  const [status, setStatus] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [locationTarget, setLocationTarget] = useState<NewsIncident | null>(
    null,
  );

  const loadIncidents = useCallback(async () => {
    const res = await fetch("/api/incidents", { cache: "no-store" });
    if (!res.ok) return;
    const data = (await res.json()) as NewsIncident[];
    setIncidents(data);
  }, []);

  useEffect(() => {
    void loadIncidents();
  }, [loadIncidents]);

  async function onSubmit(event: FormEvent) {
    event.preventDefault();
    const trimmed = url.trim();
    if (!trimmed) return;

    setBusy(true);
    setStatus("Fetching article…");

    try {
      const res = await fetch("/api/ingest", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url: trimmed }),
      });
      const payload = await res.json();

      if (!res.ok) {
        setStatus(payload.error ?? "Could not ingest URL");
        return;
      }

      const incident = payload as NewsIncident;
      setUrl("");
      await loadIncidents();

      if (incident.lat == null || incident.lng == null) {
        setStatus("Story added — choose a location for the map pin.");
        setLocationTarget(incident);
      } else {
        setStatus(`Added: ${incident.title}`);
      }
    } catch {
      setStatus("Request failed");
    } finally {
      setBusy(false);
    }
  }

  function onLocationSaved(updated: NewsIncident) {
    setIncidents((prev) =>
      prev.map((item) => (item.id === updated.id ? updated : item)),
    );
    setLocationTarget(null);
    setStatus(`Pinned: ${updated.locationLabel ?? updated.title}`);
  }

  const mappedCount = incidents.filter((i) => i.lat != null && i.lng != null)
    .length;

  return (
    <div className="flex min-h-screen flex-col bg-[radial-gradient(ellipse_at_top,_#e8dfd0_0%,_#cfc4b0_45%,_#9ea8a3_100%)] text-stone-900">
      <header className="border-b border-stone-800/15 bg-stone-950/85 px-4 py-4 text-stone-50 backdrop-blur md:px-8">
        <div className="mx-auto flex max-w-7xl flex-col gap-4 md:flex-row md:items-end md:justify-between">
          <div>
            <p className="font-[family-name:var(--font-display)] text-3xl tracking-tight md:text-4xl">
              Rape of Briton
            </p>
            <p className="mt-1 max-w-xl text-sm text-stone-300">
              Paste a BBC, GB News, or other news URL. The bot extracts the story
              and places it on the OpenStreetMap view when a UK location is found.
            </p>
          </div>
          <p className="text-xs uppercase tracking-[0.2em] text-stone-400">
            {mappedCount} mapped · {incidents.length} total
          </p>
        </div>
      </header>

      <main className="mx-auto grid w-full max-w-7xl flex-1 gap-4 p-4 md:grid-cols-[340px_1fr] md:gap-6 md:p-8">
        <aside className="flex flex-col gap-4">
          <form
            onSubmit={onSubmit}
            className="space-y-3 border border-stone-800/20 bg-stone-50/90 p-4 shadow-[0_12px_40px_rgba(40,30,20,0.12)]"
          >
            <label className="block text-sm font-medium" htmlFor="news-url">
              News article URL
            </label>
            <input
              id="news-url"
              type="url"
              required
              placeholder="https://www.bbc.co.uk/news/..."
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              className="w-full border border-stone-300 bg-white px-3 py-2 text-sm outline-none ring-stone-800 focus:ring-2"
            />
            <button
              type="submit"
              disabled={busy}
              className="w-full bg-stone-900 px-4 py-2.5 text-sm font-medium text-stone-50 transition hover:bg-stone-700 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {busy ? "Adding…" : "Add to map"}
            </button>
            {status ? (
              <p className="text-sm text-stone-600" role="status">
                {status}
              </p>
            ) : null}
          </form>

          <section className="flex-1 overflow-hidden border border-stone-800/20 bg-stone-50/90">
            <div className="border-b border-stone-200 px-4 py-3 text-sm font-medium">
              Recent stories
            </div>
            <ul className="max-h-[50vh] divide-y divide-stone-200 overflow-y-auto md:max-h-[calc(100vh-280px)]">
              {incidents.length === 0 ? (
                <li className="px-4 py-6 text-sm text-stone-500">
                  No stories yet. Paste a URL above (Python bot must be running).
                </li>
              ) : (
                incidents.map((item) => {
                  const hasPin = item.lat != null && item.lng != null;
                  return (
                    <li key={item.id} className="px-4 py-3">
                      <p className="text-[10px] uppercase tracking-wide text-stone-500">
                        {item.source}
                        {item.locationLabel
                          ? ` · ${item.locationLabel}`
                          : " · no pin"}
                      </p>
                      <a
                        href={item.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="mt-0.5 block text-sm font-medium leading-snug hover:underline"
                      >
                        {item.title}
                      </a>
                      {!hasPin ? (
                        <button
                          type="button"
                          onClick={() => setLocationTarget(item)}
                          className="mt-2 text-xs font-medium text-stone-700 underline underline-offset-2 hover:text-stone-900"
                        >
                          Add location
                        </button>
                      ) : null}
                    </li>
                  );
                })
              )}
            </ul>
          </section>
        </aside>

        <section className="min-h-[55vh] overflow-hidden border border-stone-800/25 shadow-[0_16px_50px_rgba(40,30,20,0.18)] md:min-h-[calc(100vh-160px)]">
          <NewsMap incidents={incidents} />
        </section>
      </main>

      {locationTarget ? (
        <LocationModal
          incident={locationTarget}
          onClose={() => setLocationTarget(null)}
          onSaved={onLocationSaved}
        />
      ) : null}
    </div>
  );
}
