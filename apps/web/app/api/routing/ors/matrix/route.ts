import { NextResponse } from "next/server";
import { isSameOriginRequest } from "@/lib/request-security";

const ORS_MATRIX_URL = "https://api.openrouteservice.org/v2/matrix/driving-car";
const ORS_DIRECTIONS_URL = "https://api.openrouteservice.org/v2/directions/driving-car/geojson";
const MAX_DESTINATIONS = 60;
const AVERAGE_DRIVE_SPEED_METERS_PER_SECOND = 15.65; // ~35 mph heuristic for duration estimation

type LngLat = [number, number];

type MatrixRequest = {
  origin?: unknown;
  destinations?: unknown;
};

type DestinationInput = {
  id: string;
  coordinates: LngLat;
};

function isValidCoordinate(value: unknown): value is LngLat {
  if (!Array.isArray(value) || value.length !== 2) {
    return false;
  }

  const [lng, lat] = value;
  return (
    typeof lng === "number" &&
    Number.isFinite(lng) &&
    lng >= -180 &&
    lng <= 180 &&
    typeof lat === "number" &&
    Number.isFinite(lat) &&
    lat >= -90 &&
    lat <= 90
  );
}

function parseDestinations(raw: unknown): DestinationInput[] | null {
  if (!Array.isArray(raw)) {
    return null;
  }

  const parsed = raw
    .map((value) => {
      if (!value || typeof value !== "object") {
        return null;
      }

      const candidate = value as { id?: unknown; coordinates?: unknown };
      if (typeof candidate.id !== "string" || candidate.id.trim().length === 0) {
        return null;
      }

      if (!isValidCoordinate(candidate.coordinates)) {
        return null;
      }

      return {
        id: candidate.id,
        coordinates: candidate.coordinates
      } satisfies DestinationInput;
    })
    .filter((value): value is DestinationInput => value !== null);

  return parsed.length === raw.length ? parsed : null;
}

function parseDirectionsSummary(payload: unknown): { distanceMeters: number; durationSeconds: number } | null {
  if (!payload || typeof payload !== "object") {
    return null;
  }

  const root = payload as {
    features?: Array<{
      properties?: {
        summary?: { distance?: unknown; duration?: unknown };
        segments?: Array<{ distance?: unknown; duration?: unknown }>;
      };
    }>;
  };

  const firstFeature = Array.isArray(root.features) ? root.features[0] : undefined;
  const summary = firstFeature?.properties?.summary;
  if (
    summary &&
    typeof summary.distance === "number" &&
    Number.isFinite(summary.distance) &&
    typeof summary.duration === "number" &&
    Number.isFinite(summary.duration)
  ) {
    return { distanceMeters: summary.distance, durationSeconds: summary.duration };
  }

  const segments = firstFeature?.properties?.segments;
  if (!Array.isArray(segments) || segments.length === 0) {
    return null;
  }

  let distanceMeters = 0;
  let durationSeconds = 0;

  for (const segment of segments) {
    if (
      typeof segment.distance !== "number" ||
      !Number.isFinite(segment.distance) ||
      typeof segment.duration !== "number" ||
      !Number.isFinite(segment.duration)
    ) {
      return null;
    }

    distanceMeters += segment.distance;
    durationSeconds += segment.duration;
  }

  return { distanceMeters, durationSeconds };
}

function haversineDistanceMeters(from: LngLat, to: LngLat): number {
  const [fromLng, fromLat] = from;
  const [toLng, toLat] = to;
  const toRadians = (degrees: number) => (degrees * Math.PI) / 180;

  const earthRadiusMeters = 6371000;
  const dLat = toRadians(toLat - fromLat);
  const dLng = toRadians(toLng - fromLng);

  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(toRadians(fromLat)) * Math.cos(toRadians(toLat)) * Math.sin(dLng / 2) * Math.sin(dLng / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

  return earthRadiusMeters * c;
}

function estimateDurationSeconds(distanceMeters: number): number {
  if (!Number.isFinite(distanceMeters) || distanceMeters <= 0) {
    return 0;
  }

  return Math.max(60, Math.round(distanceMeters / AVERAGE_DRIVE_SPEED_METERS_PER_SECOND));
}

async function matrixRequest(apiKey: string, origin: LngLat, destinations: DestinationInput[]) {
  const locations = [origin, ...destinations.map((destination) => destination.coordinates)];
  const response = await fetch(ORS_MATRIX_URL, {
    method: "POST",
    headers: {
      Authorization: apiKey,
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      locations,
      sources: [0],
      destinations: destinations.map((_, index) => index + 1),
      metrics: ["distance", "duration"]
    }),
    cache: "no-store"
  });

  const raw = await response.text();
  if (!response.ok) {
    throw new Error(`matrix_failed:${response.status}:${raw.slice(0, 200)}`);
  }

  const payload = JSON.parse(raw) as {
    distances?: number[][];
    durations?: number[][];
  };

  const distanceRow = payload.distances?.[0];
  const durationRow = payload.durations?.[0];
  if (!Array.isArray(distanceRow) || !Array.isArray(durationRow)) {
    throw new Error("matrix_invalid_shape");
  }

  if (distanceRow.length !== destinations.length || durationRow.length !== destinations.length) {
    throw new Error("matrix_mismatched_length");
  }

  return destinations.map((destination, index) => ({
    id: destination.id,
    distanceMeters: Number(distanceRow[index]),
    durationSeconds: Number(durationRow[index])
  }));
}

async function directionsFallbackRequest(apiKey: string, origin: LngLat, destinations: DestinationInput[]) {
  const settled = await Promise.allSettled(
    destinations.map(async (destination) => {
      const response = await fetch(ORS_DIRECTIONS_URL, {
        method: "POST",
        headers: {
          Authorization: apiKey,
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          coordinates: [origin, destination.coordinates],
          instructions: false
        }),
        cache: "no-store"
      });

      const raw = await response.text();
      if (!response.ok) {
        throw new Error(`directions_failed:${response.status}:${raw.slice(0, 200)}`);
      }

      const parsed = parseDirectionsSummary(JSON.parse(raw));
      if (!parsed) {
        throw new Error("directions_invalid_summary");
      }

      return {
        id: destination.id,
        distanceMeters: parsed.distanceMeters,
        durationSeconds: parsed.durationSeconds
      };
    })
  );

  return settled
    .filter((result): result is PromiseFulfilledResult<{ id: string; distanceMeters: number; durationSeconds: number }> =>
      result.status === "fulfilled"
    )
    .map((result) => result.value);
}

export async function POST(request: Request) {
  if (!isSameOriginRequest(request)) {
    return NextResponse.json({ error: { code: "FORBIDDEN", message: "Invalid request origin." } }, { status: 403 });
  }

  const apiKey = process.env.OPENROUTESERVICE_API_KEY ?? process.env.ORS_API_KEY;
  if (!apiKey) {
    return NextResponse.json(
      { error: { code: "ORS_API_KEY_MISSING", message: "OpenRouteService API key is missing." } },
      { status: 503 }
    );
  }

  try {
    const payload = (await request.json()) as MatrixRequest;
    const origin = payload.origin;
    const destinations = parseDestinations(payload.destinations);

    if (!isValidCoordinate(origin)) {
      return NextResponse.json(
        { error: { code: "VALIDATION_ERROR", message: "origin must be a valid [lng, lat] coordinate." } },
        { status: 400 }
      );
    }

    if (!destinations || destinations.length === 0) {
      return NextResponse.json(
        { error: { code: "VALIDATION_ERROR", message: "destinations must include at least one valid destination." } },
        { status: 400 }
      );
    }

    if (destinations.length > MAX_DESTINATIONS) {
      return NextResponse.json(
        {
          error: {
            code: "VALIDATION_ERROR",
            message: `Too many destinations. Maximum allowed is ${MAX_DESTINATIONS}.`
          }
        },
        { status: 400 }
      );
    }

    try {
      const matrix = await matrixRequest(apiKey, origin, destinations);
      return NextResponse.json({ results: matrix, source: "matrix" }, { status: 200 });
    } catch {
      const directionsResults = await directionsFallbackRequest(apiKey, origin, destinations);

      const byId = new Map(
        directionsResults.map((result) => [result.id, result] as const)
      );

      const mergedResults = destinations.map((destination) => {
        const fromDirections = byId.get(destination.id);
        if (fromDirections) {
          return fromDirections;
        }

        const distanceMeters = haversineDistanceMeters(origin, destination.coordinates);
        return {
          id: destination.id,
          distanceMeters,
          durationSeconds: estimateDurationSeconds(distanceMeters)
        };
      });

      const source =
        directionsResults.length === destinations.length
          ? "directions_fallback"
          : directionsResults.length > 0
            ? "directions_plus_haversine_fallback"
            : "haversine_fallback";

      return NextResponse.json({ results: mergedResults, source }, { status: 200 });
    }
  } catch {
    return NextResponse.json(
      { error: { code: "ORS_UNAVAILABLE", message: "Unable to compute ORS matrix distances." } },
      { status: 503 }
    );
  }
}
