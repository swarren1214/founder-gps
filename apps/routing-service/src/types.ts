import { z } from "zod";
import { FOUNDER_STAGES, RESOURCE_CATEGORIES } from "../../../packages/shared-types/dist/index.js";

export const CoordinateSchema = z.object({
  lat: z.number().min(-90).max(90),
  lng: z.number().min(-180).max(180)
});

export const FounderOriginSchema = CoordinateSchema.extend({
  city: z.string().min(1).optional()
});

export const StartupResourceSchema = z.object({
  id: z.string().uuid(),
  name: z.string(),
  category: z.enum(RESOURCE_CATEGORIES),
  description: z.string(),
  website: z.string().nullable(),
  logoUrl: z.string().nullable(),
  address: z.string().nullable(),
  city: z.string(),
  state: z.string(),
  lat: z.number(),
  lng: z.number(),
  stageFit: z.array(z.enum(FOUNDER_STAGES)),
  industryFit: z.array(z.string()),
  tags: z.array(z.string()),
  createdAt: z.string(),
  updatedAt: z.string()
});

export const RouteRequestSchema = z.object({
  coordinates: z.array(CoordinateSchema).min(2).max(25),
  overview: z.enum(["full", "simplified", "false"]).default("full"),
  steps: z.boolean().default(false)
});

export const MatrixRequestSchema = z.object({
  coordinates: z.array(CoordinateSchema).min(2).max(100),
  sources: z.array(z.number().int().min(0)).optional(),
  destinations: z.array(z.number().int().min(0)).optional()
});

export const TripRequestSchema = z.object({
  coordinates: z.array(CoordinateSchema).min(2).max(25),
  roundtrip: z.boolean().default(false),
  source: z.enum(["any", "first"]).default("first"),
  destination: z.enum(["any", "last"]).default("last")
});

export const FounderPathRequestSchema = z.object({
  origin: FounderOriginSchema,
  resources: z.array(StartupResourceSchema).min(1).max(20),
  topN: z.number().int().min(1).max(20).default(5),
  roundtrip: z.boolean().default(false)
});

export const RouteGeoJsonFeatureSchema = z.object({
  type: z.literal("Feature"),
  geometry: z.object({
    type: z.literal("LineString"),
    coordinates: z.array(z.tuple([z.number(), z.number()])).min(2)
  }),
  properties: z.object({
    distanceMeters: z.number().nonnegative(),
    durationSeconds: z.number().nonnegative(),
    mode: z.literal("driving")
  })
});

export const RouteGeoJsonFeatureCollectionSchema = z.object({
  type: z.literal("FeatureCollection"),
  features: z.array(RouteGeoJsonFeatureSchema).min(1)
});

export const FounderRouteSchema = z.object({
  orderedStops: z.array(StartupResourceSchema),
  totalDriveTimeMinutes: z.number().nonnegative(),
  totalDistanceMiles: z.number().nonnegative(),
  geojson: RouteGeoJsonFeatureCollectionSchema
});

export type Coordinate = z.infer<typeof CoordinateSchema>;
export type FounderOrigin = z.infer<typeof FounderOriginSchema>;
export type StartupResource = z.infer<typeof StartupResourceSchema>;
export type RouteRequest = z.infer<typeof RouteRequestSchema>;
export type MatrixRequest = z.infer<typeof MatrixRequestSchema>;
export type TripRequest = z.infer<typeof TripRequestSchema>;
export type FounderPathRequest = z.infer<typeof FounderPathRequestSchema>;
export type RouteGeoJsonFeature = z.infer<typeof RouteGeoJsonFeatureSchema>;
export type RouteGeoJsonFeatureCollection = z.infer<typeof RouteGeoJsonFeatureCollectionSchema>;
export type FounderRoute = z.infer<typeof FounderRouteSchema>;
