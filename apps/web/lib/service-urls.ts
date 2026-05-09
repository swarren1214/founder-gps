function readEnv(...keys: string[]): string | undefined {
  for (const key of keys) {
    const value = process.env[key]?.trim();
    if (value) {
      return value;
    }
  }

  return undefined;
}

export function getResourceServiceUrl(): string {
  return readEnv("RESOURCE_SERVICE_URL", "NEXT_PUBLIC_RESOURCE_SERVICE_URL") ?? "http://localhost:4001";
}

export function getRoutingServiceUrl(): string | undefined {
  return readEnv("ROUTING_SERVICE_URL", "NEXT_PUBLIC_ROUTING_SERVICE_URL");
}

export function getIntelligenceServiceUrl(): string {
  return readEnv("INTELLIGENCE_SERVICE_URL", "NEXT_PUBLIC_INTELLIGENCE_SERVICE_URL") ?? "http://localhost:4003";
}

export function getRecommendationServiceUrl(): string {
  return readEnv("RECOMMENDATION_SERVICE_URL", "NEXT_PUBLIC_RECOMMENDATION_SERVICE_URL") ?? "http://localhost:4004";
}

export function getAuthServiceUrl(): string {
  return readEnv("AUTH_SERVICE_URL", "NEXT_PUBLIC_AUTH_SERVICE_URL") ?? "http://localhost:4005";
}
