export const RESOURCE_CATEGORIES = [
  "accelerator",
  "incubator",
  "investor",
  "coworking",
  "university",
  "event",
  "mentor",
  "government",
  "service_provider",
  "community"
] as const;

export type ResourceCategory = (typeof RESOURCE_CATEGORIES)[number];

export const FOUNDER_STAGES = [
  "idea",
  "validation",
  "mvp",
  "launched",
  "traction",
  "fundraising",
  "scale"
] as const;

export type FounderStage = (typeof FOUNDER_STAGES)[number];

export interface StartupResource {
  id: string;
  name: string;
  category: ResourceCategory;
  description: string;
  website: string | null;
  logoUrl: string | null;
  address: string | null;
  city: string;
  state: string;
  lat: number;
  lng: number;
  stageFit: FounderStage[];
  industryFit: string[];
  tags: string[];
  createdAt: string;
  updatedAt: string;
}

export interface ResourceFeature {
  type: "Feature";
  geometry: {
    type: "Point";
    coordinates: [number, number];
  };
  properties: {
    id: string;
    name: string;
    category: ResourceCategory;
    score?: number;
    logoUrl?: string;
  };
}

export interface ResourceFeatureCollection {
  type: "FeatureCollection";
  features: ResourceFeature[];
}

export interface Coordinate {
  lat: number;
  lng: number;
}

export interface RouteGeoJsonFeature {
  type: "Feature";
  geometry: {
    type: "LineString";
    coordinates: [number, number][];
  };
  properties: {
    distanceMeters: number;
    durationSeconds: number;
    mode: "driving";
  };
}

export interface RouteGeoJsonFeatureCollection {
  type: "FeatureCollection";
  features: RouteGeoJsonFeature[];
}

export interface FounderRoute {
  orderedStops: StartupResource[];
  totalDriveTimeMinutes: number;
  totalDistanceMiles: number;
  geojson: RouteGeoJsonFeatureCollection;
}

export * from "./errors.js";
