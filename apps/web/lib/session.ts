"use client";

const SESSION_KEY = "founder-gps-dashboard-run";

export function saveDashboardRun(payload: unknown) {
  if (typeof window === "undefined") {
    return;
  }

  const serialized = JSON.stringify(payload);
  window.localStorage.setItem(SESSION_KEY, serialized);
  window.sessionStorage.setItem(SESSION_KEY, serialized);
}

export function loadDashboardRun<T>() {
  if (typeof window === "undefined") {
    return null as T | null;
  }

  const raw =
    window.localStorage.getItem(SESSION_KEY) ?? window.sessionStorage.getItem(SESSION_KEY);

  if (!raw) {
    return null as T | null;
  }

  try {
    const parsed = JSON.parse(raw) as T;
    // Backfill any older session-only state into localStorage for returning users.
    window.localStorage.setItem(SESSION_KEY, raw);
    return parsed;
  } catch {
    return null as T | null;
  }
}

export function clearDashboardRun() {
  if (typeof window === "undefined") {
    return;
  }

  window.localStorage.removeItem(SESSION_KEY);
  window.sessionStorage.removeItem(SESSION_KEY);
}
