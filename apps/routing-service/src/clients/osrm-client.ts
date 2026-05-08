import { z } from "zod";
import type {
  Coordinate,
  MatrixRequest,
  RouteGeoJsonFeatureCollection,
  RouteRequest,
  TripRequest
} from "../types.js";

const waypointSchema = z.object({
  distance: z.number().nonnegative().optional(),
  name: z.string().optional(),
  location: z.tuple([z.number(), z.number()]),
  waypoint_index: z.number().int().nonnegative().optional()
});

const routeSchema = z.object({
  distance: z.number().nonnegative(),
  duration: z.number().nonnegative(),
  geometry: z.object({
    coordinates: z.array(z.tuple([z.number(), z.number()])).min(2)
  })
});

const routeResponseSchema = z.object({
  code: z.literal("Ok"),
  routes: z.array(routeSchema).min(1),
  waypoints: z.array(waypointSchema).min(2)
});

const tableResponseSchema = z.object({
  code: z.literal("Ok"),
  durations: z.array(z.array(z.number().nonnegative().nullable())),
  distances: z.array(z.array(z.number().nonnegative().nullable())).optional(),
  sources: z.array(waypointSchema),
  destinations: z.array(waypointSchema)
});

const tripResponseSchema = z.object({
  code: z.literal("Ok"),
  trips: z.array(routeSchema).min(1),
  waypoints: z.array(waypointSchema).min(2)
});

export type OsrmRouteResult = z.infer<typeof routeResponseSchema>;
export type OsrmTableResult = z.infer<typeof tableResponseSchema>;
export type OsrmTripResult = z.infer<typeof tripResponseSchema>;

export interface OsrmClient {
  route(request: RouteRequest): Promise<OsrmRouteResult>;
  matrix(request: MatrixRequest): Promise<OsrmTableResult>;
  trip(request: TripRequest): Promise<OsrmTripResult>;
}

function toCoordinateList(coordinates: Coordinate[]): string {
  return coordinates.map((point) => `${point.lng},${point.lat}`).join(";");
}

function toGeojsonCollection(distance: number, duration: number, coordinates: [number, number][]): RouteGeoJsonFeatureCollection {
  return {
    type: "FeatureCollection",
    features: [
      {
        type: "Feature",
        geometry: {
          type: "LineString",
          coordinates
        },
        properties: {
          distanceMeters: distance,
          durationSeconds: duration,
          mode: "driving"
        }
      }
    ]
  };
}

async function delay(ms: number): Promise<void> {
  await new Promise((resolve) => setTimeout(resolve, ms));
}

export class HttpOsrmClient implements OsrmClient {
  constructor(
    private readonly baseUrl: string,
    private readonly timeoutMs = 5000,
    private readonly maxRetries = 2
  ) {}

  private async request<T>(path: string, schema: z.ZodSchema<T>, attempt = 0): Promise<T> {
    try {
      const response = await fetch(`${this.baseUrl}${path}`, {
        signal: AbortSignal.timeout(this.timeoutMs)
      });

      if (!response.ok) {
        throw new Error(`OSRM request failed: ${response.status}`);
      }

      const payload = await response.json();
      return schema.parse(payload);
    } catch (error) {
      if (attempt >= this.maxRetries) {
        throw error;
      }

      await delay(150 * (attempt + 1));
      return this.request(path, schema, attempt + 1);
    }
  }

  async route(request: RouteRequest): Promise<OsrmRouteResult> {
    const coords = toCoordinateList(request.coordinates);
    const query = new URLSearchParams({
      overview: request.overview,
      geometries: "geojson",
      steps: String(request.steps)
    });

    return this.request(`/route/v1/driving/${coords}?${query.toString()}`, routeResponseSchema);
  }

  async matrix(request: MatrixRequest): Promise<OsrmTableResult> {
    const coords = toCoordinateList(request.coordinates);
    const query = new URLSearchParams({ annotations: "duration,distance" });

    if (request.sources?.length) {
      query.set("sources", request.sources.join(";"));
    }

    if (request.destinations?.length) {
      query.set("destinations", request.destinations.join(";"));
    }

    return this.request(`/table/v1/driving/${coords}?${query.toString()}`, tableResponseSchema);
  }

  async trip(request: TripRequest): Promise<OsrmTripResult> {
    const coords = toCoordinateList(request.coordinates);
    const query = new URLSearchParams({
      roundtrip: String(request.roundtrip),
      source: request.source,
      destination: request.destination,
      geometries: "geojson",
      overview: "full"
    });

    return this.request(`/trip/v1/driving/${coords}?${query.toString()}`, tripResponseSchema);
  }
}

export function buildRouteGeojson(distance: number, duration: number, coordinates: [number, number][]): RouteGeoJsonFeatureCollection {
  return toGeojsonCollection(distance, duration, coordinates);
}
