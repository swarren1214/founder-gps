"use client";

const SESSION_KEY = "founder-gps-dashboard-run";

export function saveDashboardRun(payload: unknown) {
  if (typeof window === "undefined") {
    return;
  }

  window.sessionStorage.setItem(SESSION_KEY, JSON.stringify(payload));
}

export function loadDashboardRun<T>() {
  if (typeof window === "undefined") {
    return null as T | null;
  }

  const raw = window.sessionStorage.getItem(SESSION_KEY);
  if (!raw) {
    return null as T | null;
  }

  try {
    return JSON.parse(raw) as T;
  } catch {
    return null as T | null;
  }
}
