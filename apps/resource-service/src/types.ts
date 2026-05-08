import type { FounderStage, ResourceCategory } from "@founder-gps/shared-types";

export type ResourceFilters = {
  category?: ResourceCategory;
  city?: string;
  stage?: FounderStage;
  industry?: string;
  q?: string;
  limit?: number;
  offset?: number;
  lat?: number;
  lng?: number;
  radiusMiles?: number;
};

export type StartupFilters = {
  city?: string;
  q?: string;
  limit?: number;
  offset?: number;
};
