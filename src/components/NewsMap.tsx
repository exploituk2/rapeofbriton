"use client";

import { MapContainer, Marker, Popup, TileLayer, ZoomControl } from "react-leaflet";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import type { NewsIncident } from "@/lib/types";

const markerIcon = L.divIcon({
  className: "map-marker",
  html: '<span class="map-pin" aria-hidden="true"></span>',
  iconSize: [22, 22],
  iconAnchor: [11, 11],
  popupAnchor: [0, -12],
});

type Props = {
  incidents: NewsIncident[];
};

const UK_CENTER: [number, number] = [54.5, -2.5];

export default function NewsMap({ incidents }: Props) {
  const mapped = incidents.filter(
    (item) => item.lat != null && item.lng != null,
  );

  return (
    <MapContainer
      center={UK_CENTER}
      zoom={6}
      className="h-full w-full"
      zoomControl={false}
      scrollWheelZoom
    >
      <TileLayer
        attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OSM</a> &copy; <a href="https://carto.com/">CARTO</a>'
        url="https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png"
      />
      <ZoomControl position="bottomright" />
      {mapped.map((item) => (
        <Marker
          key={item.id}
          position={[item.lat as number, item.lng as number]}
          icon={markerIcon}
        >
          <Popup>
            <div className="max-w-[220px] space-y-1.5">
              <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-[var(--ink-soft)]">
                {item.source}
                {item.locationLabel ? ` · ${item.locationLabel}` : ""}
              </p>
              <a
                href={item.url}
                target="_blank"
                rel="noopener noreferrer"
                className="block text-[15px] font-semibold leading-snug text-[var(--ink)] no-underline hover:text-[var(--accent)]"
              >
                {item.title}
              </a>
              {item.summary ? (
                <p className="text-[13px] leading-relaxed text-[var(--ink-soft)]">
                  {item.summary}
                </p>
              ) : null}
              {item.peopleInvolved?.length ? (
                <p className="text-[12px] leading-snug text-[var(--ink)]">
                  <span className="font-semibold">Named:</span>{" "}
                  {item.peopleInvolved.join(", ")}
                </p>
              ) : null}
            </div>
          </Popup>
        </Marker>
      ))}
    </MapContainer>
  );
}
