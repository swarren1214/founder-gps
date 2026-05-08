"use client";

import {
  analyticsEventTaxonomy,
  type AnalyticsEventName
} from "@/lib/analytics-events";

declare global {
  interface Window {
    founderGpsEvents?: Array<{ name: string; payload?: Record<string, unknown>; at: string }>;
  }
}

export function trackEvent(name: AnalyticsEventName, payload?: Record<string, unknown>) {
  if (typeof window === "undefined") {
    return;
  }

  if (!(name in analyticsEventTaxonomy)) {
    return;
  }

  const event = { name, payload, at: new Date().toISOString() };
  window.founderGpsEvents = [...(window.founderGpsEvents ?? []), event];
  window.dispatchEvent(new CustomEvent("founder-gps:event", { detail: event }));
}
