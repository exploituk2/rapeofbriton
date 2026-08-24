export type NewsIncident = {
  id: string;
  url: string;
  source: string;
  title: string;
  summary: string;
  locationLabel: string | null;
  lat: number | null;
  lng: number | null;
  publishedAt: string | null;
  createdAt: string;
};
