import { NextRequest, NextResponse } from "next/server";

type GeoapifyFeature = {
  properties?: {
    formatted?: string;
    lat?: number;
    lon?: number;
    city?: string;
    state?: string;
    country?: string;
    postcode?: string;
  };
  formatted?: string;
  lat?: number;
  lon?: number;
  city?: string;
  state?: string;
  country?: string;
  postcode?: string;
};

type AddressSuggestion = {
  formatted: string;
  lat: number | null;
  lon: number | null;
  city: string | null;
  state: string | null;
  country: string | null;
  postcode: string | null;
};

function apiKeyFromEnv(): string {
  return process.env.GEOAPIFY_API_KEY ?? "";
}

function mapFeature(feature: GeoapifyFeature): AddressSuggestion | null {
  const properties = feature.properties;
  const formatted = properties?.formatted ?? feature.formatted;
  if (!formatted) {
    return null;
  }

  const lat = properties?.lat ?? feature.lat;
  const lon = properties?.lon ?? feature.lon;
  const city = properties?.city ?? feature.city;
  const state = properties?.state ?? feature.state;
  const country = properties?.country ?? feature.country;
  const postcode = properties?.postcode ?? feature.postcode;

  return {
    formatted,
    lat: typeof lat === "number" ? lat : null,
    lon: typeof lon === "number" ? lon : null,
    city: city ?? null,
    state: state ?? null,
    country: country ?? null,
    postcode: postcode ?? null
  };
}

function asNumber(value: string | null): number | null {
  if (!value) {
    return null;
  }

  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

async function fetchJson(url: URL): Promise<GeoapifyFeature[]> {
  const response = await fetch(url, {
    method: "GET",
    cache: "no-store"
  });

  if (!response.ok) {
    throw new Error("Geoapify request failed");
  }

  const payload = (await response.json()) as { features?: GeoapifyFeature[]; results?: GeoapifyFeature[] };
  
  // Autocomplete returns "results", reverse geocode returns "features"
  const features = Array.isArray(payload.results) ? payload.results : Array.isArray(payload.features) ? payload.features : [];
  return features;
}

export async function GET(request: NextRequest) {
  const apiKey = apiKeyFromEnv();
  if (!apiKey) {
    return NextResponse.json({ error: "Geoapify API key is not configured." }, { status: 500 });
  }

  const text = request.nextUrl.searchParams.get("text")?.trim() ?? "";
  const lat = asNumber(request.nextUrl.searchParams.get("lat"));
  const lon = asNumber(request.nextUrl.searchParams.get("lon"));

  try {
    if (lat !== null && lon !== null) {
      const reverseUrl = new URL("https://api.geoapify.com/v1/geocode/reverse");
      reverseUrl.searchParams.set("lat", String(lat));
      reverseUrl.searchParams.set("lon", String(lon));
      reverseUrl.searchParams.set("format", "json");
      reverseUrl.searchParams.set("limit", "1");
      reverseUrl.searchParams.set("apiKey", apiKey);

      const features = await fetchJson(reverseUrl);
      const first = mapFeature(features[0] ?? {});
      return NextResponse.json({ result: first });
    }

    if (text.length < 5) {
      return NextResponse.json({ results: [] });
    }

    const autocompleteUrl = new URL("https://api.geoapify.com/v1/geocode/autocomplete");
    autocompleteUrl.searchParams.set("text", text);
    autocompleteUrl.searchParams.set("format", "json");
    autocompleteUrl.searchParams.set("limit", "10");
    autocompleteUrl.searchParams.set("country", "US");
    autocompleteUrl.searchParams.set("apiKey", apiKey);

    const features = await fetchJson(autocompleteUrl);
    const results = features.map(mapFeature).filter((item): item is AddressSuggestion => item !== null);

    return NextResponse.json({ results });
  } catch (err) {
    const errorMsg = err instanceof Error ? err.message : String(err);
    console.error("[Geoapify API Route] Error:", errorMsg);
    return NextResponse.json({ error: "Unable to resolve address right now." }, { status: 502 });
  }
}
