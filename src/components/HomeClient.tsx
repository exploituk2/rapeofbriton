"use client";

import dynamic from "next/dynamic";
import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type CSSProperties,
  type FormEvent,
} from "react";
import LocationModal from "@/components/LocationModal";
import PeopleDirectory from "@/components/PeopleDirectory";
import type { NewsIncident } from "@/lib/types";

const NewsMap = dynamic(() => import("@/components/NewsMap"), {
  ssr: false,
  loading: () => (
    <div className="flex h-full items-center justify-center bg-[#dbe4e8] text-[var(--ink-soft)]">
      <div className="anim-rise text-sm tracking-wide">Loading map…</div>
    </div>
  ),
});

type Tab = "map" | "people";

export default function HomeClient() {
  const [tab, setTab] = useState<Tab>("map");
  const [incidents, setIncidents] = useState<NewsIncident[]>([]);
  const [url, setUrl] = useState("");
  const [honeypot, setHoneypot] = useState("");
  const [status, setStatus] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [locationTarget, setLocationTarget] = useState<NewsIncident | null>(
    null,
  );
  const [sheetExpanded, setSheetExpanded] = useState(false);
  const sheetRef = useRef<HTMLElement | null>(null);

  const loadIncidents = useCallback(async () => {
    const res = await fetch("/api/incidents", { cache: "no-store" });
    if (!res.ok) return;
    const data = (await res.json()) as NewsIncident[];
    setIncidents(data);
  }, []);

  useEffect(() => {
    void loadIncidents();
  }, [loadIncidents]);

  useEffect(() => {
    if (tab !== "map") {
      document.documentElement.style.removeProperty("--sheet-offset");
      return;
    }

    const node = sheetRef.current;
    if (!node || typeof ResizeObserver === "undefined") return;

    const syncOffset = () => {
      const height = Math.ceil(node.getBoundingClientRect().height);
      document.documentElement.style.setProperty(
        "--sheet-offset",
        `${height}px`,
      );
    };

    syncOffset();
    const observer = new ResizeObserver(syncOffset);
    observer.observe(node);
    return () => {
      observer.disconnect();
      document.documentElement.style.removeProperty("--sheet-offset");
    };
  }, [tab, sheetExpanded, status, incidents.length]);

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
        body: JSON.stringify({ url: trimmed, website: honeypot }),
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
        const named = incident.peopleInvolved?.length
          ? ` · ${incident.peopleInvolved.join(", ")}`
          : "";
        setStatus(`Added: ${incident.title}${named}`);
        setSheetExpanded(true);
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
    setSheetExpanded(true);
  }

  const mappedCount = incidents.filter((i) => i.lat != null && i.lng != null)
    .length;

  return (
    <div className="flex h-dvh w-full flex-col overflow-hidden bg-[#dbe4e8] text-[var(--ink)]">
      <header
        className="z-[600] shrink-0 border-b border-[var(--line)] bg-[rgba(244,247,248,0.92)] backdrop-blur-xl"
        style={{ paddingTop: "var(--safe-top)" }}
      >
        <div className="mx-auto flex w-full max-w-6xl items-center justify-between gap-3 px-4 py-3 sm:px-6">
          <p className="font-[family-name:var(--font-display)] text-xl tracking-tight sm:text-2xl">
            Rape of Briton
          </p>
          <nav
            className="flex rounded-xl border border-[var(--line)] bg-white/70 p-1"
            aria-label="Main"
          >
            <button
              type="button"
              onClick={() => setTab("map")}
              className={`min-h-10 rounded-lg px-3.5 text-sm font-semibold transition sm:px-4 ${
                tab === "map"
                  ? "bg-[var(--accent)] text-white"
                  : "text-[var(--ink-soft)] hover:text-[var(--ink)]"
              }`}
            >
              Map
            </button>
            <button
              type="button"
              onClick={() => setTab("people")}
              className={`min-h-10 rounded-lg px-3.5 text-sm font-semibold transition sm:px-4 ${
                tab === "people"
                  ? "bg-[var(--accent)] text-white"
                  : "text-[var(--ink-soft)] hover:text-[var(--ink)]"
              }`}
            >
              People
            </button>
          </nav>
        </div>
      </header>

      <main className="relative min-h-0 flex-1">
        {tab === "people" ? (
          <PeopleDirectory incidents={incidents} />
        ) : (
          <>
            <div className="absolute inset-0 anim-fade">
              <NewsMap incidents={incidents} />
            </div>

            <div
              className="pointer-events-none absolute inset-0 hidden bg-[radial-gradient(ellipse_at_20%_0%,rgba(255,255,255,0.35),transparent_45%),linear-gradient(90deg,rgba(219,228,232,0.55)_0%,rgba(219,228,232,0.08)_42%,transparent_58%)] md:block"
              aria-hidden
            />

            <aside
              ref={sheetRef}
              className="anim-panel pointer-events-auto absolute inset-x-0 bottom-0 z-[500] flex max-h-[min(78dvh,720px)] w-full flex-col overflow-hidden rounded-t-3xl border border-[var(--line)] border-b-0 bg-[var(--panel)] shadow-[0_-12px_40px_rgba(16,24,32,0.14)] backdrop-blur-xl md:inset-x-auto md:bottom-auto md:left-5 md:top-5 md:max-h-[calc(100%-2.5rem)] md:w-[min(380px,calc(100vw-2.5rem))] md:rounded-2xl md:border-b md:shadow-[0_18px_50px_rgba(16,24,32,0.12)]"
              style={
                {
                  paddingBottom: "var(--safe-bottom)",
                } as CSSProperties
              }
            >
              <div className="flex shrink-0 justify-center pt-2 md:hidden">
                <button
                  type="button"
                  aria-expanded={sheetExpanded}
                  aria-label={
                    sheetExpanded ? "Collapse panel" : "Expand panel"
                  }
                  onClick={() => setSheetExpanded((open) => !open)}
                  className="flex h-8 w-full items-center justify-center"
                >
                  <span className="h-1 w-10 rounded-full bg-[rgba(16,24,32,0.22)]" />
                </button>
              </div>

              <header className="shrink-0 border-b border-[var(--line)] px-4 pb-3 pt-1 sm:px-5 md:pb-4 md:pt-5">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="text-sm font-semibold text-[var(--ink)] sm:text-base">
                      Add a news story
                    </p>
                    <p className="mt-1 text-sm leading-relaxed text-[var(--ink-soft)]">
                      Paste a URL. Names and places are pulled when the article
                      includes them.
                    </p>
                  </div>
                  <button
                    type="button"
                    className="mt-1 inline-flex min-h-11 shrink-0 items-center rounded-xl border border-[var(--line)] bg-white/70 px-3 text-xs font-semibold text-[var(--ink-soft)] md:hidden"
                    onClick={() => setSheetExpanded((open) => !open)}
                  >
                    {sheetExpanded ? "Map" : "Stories"}
                  </button>
                </div>
                <div className="mt-3 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs font-medium tracking-wide text-[var(--ink-soft)]">
                  <span className="inline-flex items-center gap-1.5">
                    <span className="inline-block h-2 w-2 rounded-full bg-[var(--accent)]" />
                    {mappedCount} mapped
                  </span>
                  <span className="hidden h-3 w-px bg-[var(--line)] sm:block" />
                  <span>{incidents.length} total</span>
                </div>
              </header>

              <form
                onSubmit={onSubmit}
                className="shrink-0 space-y-3 border-b border-[var(--line)] px-4 py-3 sm:px-5 sm:py-4"
              >
                <label
                  className="block text-xs font-semibold uppercase tracking-[0.14em] text-[var(--ink-soft)]"
                  htmlFor="news-url"
                >
                  Article URL
                </label>
                <div className="flex flex-col gap-2 sm:flex-row">
                  <input
                    id="news-url"
                    type="url"
                    inputMode="url"
                    autoCapitalize="off"
                    autoCorrect="off"
                    required
                    placeholder="https://www.bbc.co.uk/news/..."
                    value={url}
                    onChange={(e) => setUrl(e.target.value)}
                    className="min-h-11 min-w-0 flex-1 rounded-xl border border-[var(--line)] bg-white/80 px-3.5 py-2.5 text-base outline-none transition placeholder:text-[var(--ink-soft)]/60 focus:border-[var(--accent)] focus:ring-2 focus:ring-[var(--accent)]/20 sm:text-sm"
                  />
                  {/* Honeypot: hidden from people, bots often fill it */}
                  <input
                    type="text"
                    name="website"
                    tabIndex={-1}
                    autoComplete="off"
                    value={honeypot}
                    onChange={(e) => setHoneypot(e.target.value)}
                    className="absolute -left-[9999px] h-0 w-0 opacity-0"
                    aria-hidden
                  />
                  <button
                    type="submit"
                    disabled={busy}
                    className="min-h-11 shrink-0 rounded-xl bg-[var(--accent)] px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-[var(--accent-strong)] disabled:cursor-not-allowed disabled:opacity-55 sm:w-auto"
                  >
                    {busy ? "Adding…" : "Add"}
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

              <section
                className={`flex min-h-0 flex-col ${
                  sheetExpanded ? "flex-1" : "hidden md:flex md:flex-1"
                }`}
              >
                <div className="flex shrink-0 items-center justify-between gap-2 px-4 py-3 sm:px-5">
                  <div className="text-xs font-semibold uppercase tracking-[0.14em] text-[var(--ink-soft)]">
                    Recent stories
                  </div>
                  <button
                    type="button"
                    className="text-xs font-semibold text-[var(--accent)] md:hidden"
                    onClick={() => setSheetExpanded(false)}
                  >
                    Show map
                  </button>
                </div>
                <ul className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-2 pb-3 [-webkit-overflow-scrolling:touch]">
                  {incidents.length === 0 ? (
                    <li className="px-3 py-6 text-sm leading-relaxed text-[var(--ink-soft)] sm:py-8">
                      Nothing here yet. Paste a BBC or GB News URL above — keep
                      the Python bot running.
                    </li>
                  ) : (
                    incidents.map((item, index) => {
                      const hasPin = item.lat != null && item.lng != null;
                      return (
                        <li
                          key={item.id}
                          className="anim-rise rounded-xl px-3 py-3 transition hover:bg-white/55 active:bg-white/70"
                          style={{
                            animationDelay: `${Math.min(index, 8) * 40}ms`,
                          }}
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
                          {item.peopleInvolved?.length ? (
                            <p className="mt-1.5 text-xs leading-snug text-[var(--ink-soft)]">
                              People named: {item.peopleInvolved.join(", ")}
                            </p>
                          ) : null}
                          {!hasPin ? (
                            <button
                              type="button"
                              onClick={() => setLocationTarget(item)}
                              className="mt-2 min-h-10 text-xs font-semibold text-[var(--accent)] transition hover:text-[var(--accent-strong)]"
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

              {!sheetExpanded ? (
                <div className="shrink-0 px-4 pb-3 pt-1 md:hidden">
                  <button
                    type="button"
                    onClick={() => setSheetExpanded(true)}
                    className="flex min-h-11 w-full items-center justify-center rounded-xl border border-[var(--line)] bg-white/70 text-sm font-semibold text-[var(--ink)]"
                  >
                    View stories ({incidents.length})
                  </button>
                </div>
              ) : null}
            </aside>
          </>
        )}
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
