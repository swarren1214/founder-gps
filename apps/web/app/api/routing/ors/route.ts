import { NextResponse } from "next/server";
import { isSameOriginRequest } from "@/lib/request-security";

const ORS_DIRECTIONS_URL = "https://api.openrouteservice.org/v2/directions/driving-car/geojson";

function isValidCoordinate(value: unknown): value is [number, number] {
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
    const payload = (await request.json()) as { coordinates?: unknown };
    const coordinates = Array.isArray(payload.coordinates) ? payload.coordinates : [];

    if (coordinates.length < 2 || coordinates.length > 26 || !coordinates.every(isValidCoordinate)) {
      return NextResponse.json(
        { error: { code: "VALIDATION_ERROR", message: "Provide 2-26 valid [lng, lat] coordinates." } },
        { status: 400 }
      );
    }

    const response = await fetch(ORS_DIRECTIONS_URL, {
      method: "POST",
      headers: {
        Authorization: apiKey,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        coordinates,
        instructions: false
      }),
      cache: "no-store"
    });

    const raw = await response.text();
    if (!response.ok) {
      return NextResponse.json(
        {
          error: {
            code: "ORS_REQUEST_FAILED",
            message: `OpenRouteService request failed (${response.status}).`,
            details: raw.slice(0, 600)
          }
        },
        { status: 502 }
      );
    }

    const ors = JSON.parse(raw) as {
      features?: Array<{
        geometry?: { coordinates?: unknown };
      }>;
    };

    const routeCoordinates = ors.features?.[0]?.geometry?.coordinates;
    if (!Array.isArray(routeCoordinates) || routeCoordinates.length < 2 || !routeCoordinates.every(isValidCoordinate)) {
      return NextResponse.json(
        { error: { code: "ORS_INVALID_GEOMETRY", message: "OpenRouteService returned invalid route geometry." } },
        { status: 502 }
      );
    }

    return NextResponse.json({ coordinates: routeCoordinates }, { status: 200 });
  } catch {
    return NextResponse.json(
      { error: { code: "ORS_UNAVAILABLE", message: "Unable to generate ORS route." } },
      { status: 503 }
    );
  }
}