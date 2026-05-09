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

export interface ResourceLocation {
  id: string;
  locationName: string;
  address: string;
  city: string;
  state: string;
  lat: number;
  lng: number;
  isPrimary: boolean;
}

export interface StartupResource {
  id: string;
  name: string;
  category: ResourceCategory;
  description: string;
  sourceExternalId?: string | null;
  website: string | null;
  logoUrl: string | null;
  contactEmail?: string | null;
  communities?: string[];
  address: string | null;
  city: string;
  state: string;
  lat: number;
  lng: number;
  locations: ResourceLocation[];
  stageFit: FounderStage[];
  industryFit: string[];
  tags: string[];
  createdAt: string;
  updatedAt: string;
}

export interface StartupOnboardingInterviewTurn {
  question: string;
  answer: string;
  answeredAt: string;
}

export interface StartupOnboardingContext {
  schemaVersion: number;
  identity?: {
    firstName?: string;
    lastName?: string;
    phone?: string;
  };
  company?: {
    companyName?: string;
    companySize?: string;
    dateFounded?: string;
    website?: string;
    address?: string;
  };
  details?: {
    stage?: string;
    description?: string;
  };
  interview?: StartupOnboardingInterviewTurn[];
}

export interface StartupProfile {
  id: string;
  name: string;
  website: string | null;
  logoUrl: string | null;
  employees: string | null;
  sector: string | null;
  yearFounded: number | null;
  linkedin: string | null;
  description: string | null;
  address: string | null;
  hiringStatus: string | null;
  jobPostings: unknown[];
  photoGallery: unknown[];
  lat: number | null;
  lng: number | null;
  /** Funding/growth stage from founder intake (e.g. pre-revenue, seed, series-a). */
  stage: string | null;
  /** Full date the company was founded. */
  dateFounded: string | null;
  /** Primary contact phone number. */
  phone: string | null;
  /** Full structured intake data captured during onboarding. */
  onboardingContext: StartupOnboardingContext;
  createdAt: string;
  updatedAt: string;
}

export interface CreateStartupProfileInput {
  name: string;
  website?: string | null;
  employees?: number | null;
  sector?: string | null;
  yearFounded?: number | null;
  description?: string | null;
  address?: string | null;
  stage?: string | null;
  dateFounded?: string | null;
  phone?: string | null;
  onboardingContext?: StartupOnboardingContext;
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

export * from "./chat.js";
export * from "./errors.js";
