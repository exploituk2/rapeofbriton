"use client";

import dynamic from "next/dynamic";
import { useCallback, useEffect, useState, type FormEvent } from "react";
import LocationModal from "@/components/LocationModal";
import type { NewsIncident } from "@/lib/types";

const NewsMap = dynamic(() => import("@/components/NewsMap"), {
  ssr: false,
  loading: () => (
    <div className="flex h-full items-center justify-center bg-[#dbe4e8] text-[var(--ink-soft)]">
      <div className="anim-rise text-sm tracking-wide">Loading map…</div>
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
    <div className="relative h-svh w-full overflow-hidden bg-[#dbe4e8] text-[var(--ink)]">
      <div className="absolute inset-0 anim-fade">
        <NewsMap incidents={incidents} />
      </div>

      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_20%_0%,rgba(255,255,255,0.35),transparent_45%),linear-gradient(90deg,rgba(219,228,232,0.55)_0%,rgba(219,228,232,0.08)_42%,transparent_58%)]" />

      <aside className="anim-panel pointer-events-auto absolute inset-x-3 top-3 z-[500] flex max-h-[calc(100svh-1.5rem)] w-auto flex-col overflow-hidden rounded-2xl border border-[var(--line)] bg-[var(--panel)] shadow-[0_18px_50px_rgba(16,24,32,0.12)] backdrop-blur-xl md:inset-x-auto md:left-5 md:top-5 md:w-[380px] md:max-h-[calc(100svh-2.5rem)]">
        <header className="shrink-0 border-b border-[var(--line)] px-5 pb-4 pt-5">
          <p className="font-[family-name:var(--font-display)] text-[1.85rem] leading-none tracking-tight text-[var(--ink)] md:text-[2.15rem]">
            Rape of Briton
          </p>
          <p className="mt-2 text-sm leading-relaxed text-[var(--ink-soft)]">
            Paste a news URL. Stories land on the map when a UK place is found.
          </p>
          <div className="mt-4 flex items-center gap-3 text-xs font-medium tracking-wide text-[var(--ink-soft)]">
            <span className="inline-flex items-center gap-1.5">
              <span className="inline-block h-2 w-2 rounded-full bg-[var(--accent)]" />
              {mappedCount} mapped
            </span>
            <span className="h-3 w-px bg-[var(--line)]" />
            <span>{incidents.length} total</span>
          </div>
        </header>

        <form
          onSubmit={onSubmit}
          className="shrink-0 space-y-3 border-b border-[var(--line)] px-5 py-4"
        >
          <label
            className="block text-xs font-semibold uppercase tracking-[0.14em] text-[var(--ink-soft)]"
            htmlFor="news-url"
          >
            Article URL
          </label>
          <div className="flex gap-2">
            <input
              id="news-url"
              type="url"
              required
              placeholder="https://www.bbc.co.uk/news/..."
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              className="min-w-0 flex-1 rounded-xl border border-[var(--line)] bg-white/80 px-3.5 py-2.5 text-sm outline-none transition placeholder:text-[var(--ink-soft)]/60 focus:border-[var(--accent)] focus:ring-2 focus:ring-[var(--accent)]/20"
            />
            <button
              type="submit"
              disabled={busy}
              className="shrink-0 rounded-xl bg-[var(--accent)] px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-[var(--accent-strong)] disabled:cursor-not-allowed disabled:opacity-55"
            >
              {busy ? "…" : "Add"}
            </button>
          </div>
          {status ? (
            <p
              className="anim-rise text-sm leading-snug text-[var(--ink-soft)]"
              role="status"
            >
              {status}
            </p>
          ) : null}
        </form>

        <section className="flex min-h-0 flex-1 flex-col">
          <div className="shrink-0 px-5 py-3 text-xs font-semibold uppercase tracking-[0.14em] text-[var(--ink-soft)]">
            Recent stories
          </div>
          <ul className="min-h-0 flex-1 overflow-y-auto px-2 pb-3">
            {incidents.length === 0 ? (
              <li className="px-3 py-8 text-sm leading-relaxed text-[var(--ink-soft)]">
                Nothing here yet. Paste a BBC or GB News URL above — keep the
                Python bot running.
              </li>
            ) : (
              incidents.map((item, index) => {
                const hasPin = item.lat != null && item.lng != null;
                return (
                  <li
                    key={item.id}
                    className="anim-rise rounded-xl px-3 py-3 transition hover:bg-white/55"
                    style={{ animationDelay: `${Math.min(index, 8) * 40}ms` }}
                  >
                    <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-[var(--ink-soft)]">
                      {item.source}
                      {item.locationLabel
                        ? ` · ${item.locationLabel}`
                        : " · no pin"}
                    </p>
                    <a
                      href={item.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="mt-1 block text-[15px] font-semibold leading-snug text-[var(--ink)] transition hover:text-[var(--accent)]"
                    >
                      {item.title}
                    </a>
                    {!hasPin ? (
                      <button
                        type="button"
                        onClick={() => setLocationTarget(item)}
                        className="mt-2 text-xs font-semibold text-[var(--accent)] transition hover:text-[var(--accent-strong)]"
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
