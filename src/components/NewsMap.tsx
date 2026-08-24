"use client";

import { MapContainer, Marker, Popup, TileLayer } from "react-leaflet";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import type { NewsIncident } from "@/lib/types";

const markerIcon = L.icon({
  iconUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png",
  iconRetinaUrl:
    "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png",
  shadowUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png",
  iconSize: [25, 41],
  iconAnchor: [12, 41],
  popupAnchor: [1, -34],
  shadowSize: [41, 41],
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
      scrollWheelZoom
    >
      <TileLayer
        attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
        url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
      />
      {mapped.map((item) => (
        <Marker
          key={item.id}
          position={[item.lat as number, item.lng as number]}
          icon={markerIcon}
        >
          <Popup>
            <div className="max-w-xs space-y-1">
              <p className="text-[10px] uppercase tracking-wide text-stone-500">
                {item.source}
                {item.locationLabel ? ` · ${item.locationLabel}` : ""}
              </p>
              <a
                href={item.url}
                target="_blank"
                rel="noopener noreferrer"
                className="font-semibold text-stone-900 underline-offset-2 hover:underline"
              >
                {item.title}
              </a>
              {item.summary ? (
                <p className="text-sm text-stone-600">{item.summary}</p>
              ) : null}
            </div>
          </Popup>
        </Marker>
      ))}
    </MapContainer>
  );
}
