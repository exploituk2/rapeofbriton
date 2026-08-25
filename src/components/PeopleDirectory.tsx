"use client";

import { useMemo, useState } from "react";
import type { NewsIncident } from "@/lib/types";
import { buildPeopleDirectory, type PersonEntry } from "@/lib/people";

type Props = {
  incidents: NewsIncident[];
};

export default function PeopleDirectory({ incidents }: Props) {
  const people = useMemo(() => buildPeopleDirectory(incidents), [incidents]);
  const [selected, setSelected] = useState<PersonEntry | null>(null);

  return (
    <div className="flex h-full min-h-0 flex-col bg-[linear-gradient(180deg,#e7eef1_0%,#d5dee3_100%)]">
      <div className="mx-auto w-full max-w-6xl flex-1 overflow-y-auto px-4 py-5 sm:px-6 sm:py-8">
        <div className="mb-5 sm:mb-7">
          <h1 className="font-[family-name:var(--font-display)] text-3xl tracking-tight text-[var(--ink)] sm:text-4xl">
            People named
          </h1>
          <p className="mt-2 max-w-2xl text-sm leading-relaxed text-[var(--ink-soft)] sm:text-base">
            Full list of names pulled from added news posts. Photos use initials
            for now — news sites usually don’t provide a reliable headshot URL.
          </p>
          <p className="mt-3 text-xs font-semibold uppercase tracking-[0.14em] text-[var(--ink-soft)]">
            {people.length} {people.length === 1 ? "person" : "people"}
          </p>
        </div>

        {people.length === 0 ? (
          <div className="rounded-2xl border border-[var(--line)] bg-[var(--panel)] px-5 py-10 text-sm text-[var(--ink-soft)] backdrop-blur-xl">
            No names yet. Add a news URL on the Map tab — when the article names
            someone (often a defendant), they’ll show up here.
          </div>
        ) : (
          <ul className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {people.map((person, index) => (
              <li
                key={person.name}
                className="anim-rise"
                style={{ animationDelay: `${Math.min(index, 12) * 35}ms` }}
              >
                <button
                  type="button"
                  onClick={() => setSelected(person)}
                  className="flex w-full items-center gap-4 rounded-2xl border border-[var(--line)] bg-[var(--panel)] p-4 text-left shadow-[0_10px_30px_rgba(16,24,32,0.08)] backdrop-blur-xl transition hover:border-[rgba(31,111,120,0.35)] hover:bg-white/80"
                >
                  <span
                    className="flex h-16 w-16 shrink-0 items-center justify-center rounded-full text-lg font-semibold text-white sm:h-[4.5rem] sm:w-[4.5rem] sm:text-xl"
                    style={{ backgroundColor: person.color }}
                    aria-hidden
                  >
                    {person.initials}
                  </span>
                  <span className="min-w-0">
                    <span className="block truncate text-base font-semibold text-[var(--ink)] sm:text-lg">
                      {person.name}
                    </span>
                    <span className="mt-1 block text-xs text-[var(--ink-soft)] sm:text-sm">
                      {person.storyCount}{" "}
                      {person.storyCount === 1 ? "story" : "stories"}
                      {person.locations[0]
                        ? ` · ${person.locations.slice(0, 2).join(", ")}`
                        : ""}
                    </span>
                  </span>
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>

      {selected ? (
        <div
          className="anim-fade fixed inset-0 z-[1100] flex items-end justify-center bg-[rgba(16,24,32,0.45)] p-0 backdrop-blur-[2px] sm:items-center sm:p-4"
          role="presentation"
          onClick={() => setSelected(null)}
        >
          <div
            role="dialog"
            aria-modal="true"
            aria-label={selected.name}
            className="anim-rise max-h-[min(92dvh,720px)] w-full overflow-y-auto rounded-t-3xl border border-[var(--line)] border-b-0 bg-[var(--paper)] p-5 pb-[calc(1.25rem+var(--safe-bottom))] shadow-[0_24px_60px_rgba(16,24,32,0.22)] sm:max-h-[85dvh] sm:max-w-lg sm:rounded-2xl sm:border-b sm:pb-5"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="flex items-center gap-4">
              <span
                className="flex h-20 w-20 shrink-0 items-center justify-center rounded-full text-2xl font-semibold text-white"
                style={{ backgroundColor: selected.color }}
              >
                {selected.initials}
              </span>
              <div className="min-w-0">
                <h2 className="font-[family-name:var(--font-display)] text-2xl tracking-tight text-[var(--ink)]">
                  {selected.name}
                </h2>
                <p className="mt-1 text-sm text-[var(--ink-soft)]">
                  {selected.storyCount} linked{" "}
                  {selected.storyCount === 1 ? "story" : "stories"}
                  {selected.locations.length
                    ? ` · ${selected.locations.join(", ")}`
                    : ""}
                </p>
              </div>
            </div>

            <ul className="mt-5 space-y-2">
              {selected.stories.map((story) => (
                <li key={story.id}>
                  <a
                    href={story.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="block rounded-xl border border-[var(--line)] bg-white px-3.5 py-3 transition hover:border-[var(--accent)]"
                  >
                    <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-[var(--ink-soft)]">
                      {story.source}
                      {story.locationLabel ? ` · ${story.locationLabel}` : ""}
                    </p>
                    <p className="mt-1 text-sm font-semibold leading-snug text-[var(--ink)]">
                      {story.title}
                    </p>
                  </a>
                </li>
              ))}
            </ul>

            <button
              type="button"
              onClick={() => setSelected(null)}
              className="mt-5 min-h-11 w-full rounded-xl bg-[var(--ink)] px-4 py-2.5 text-sm font-semibold text-white sm:w-auto"
            >
              Close
            </button>
          </div>
        </div>
      ) : null}
    </div>
  );
}
