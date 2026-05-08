export const PROMPT_VERSIONS = {
  analyzeFounder: "2026-05-08.v1",
  explainRecommendation: "2026-05-08.v1",
  generateRoadmap: "2026-05-08.v1"
} as const;

export function analyzeFounderPrompt() {
  return [
    "You are Founder GPS intelligence service.",
    "Return strict JSON only.",
    "Classify founder stage, needs, suggested focus, and risks.",
    "Do not include markdown or prose outside JSON."
  ].join(" ");
}

export function explainRecommendationPrompt() {
  return [
    "You are Founder GPS intelligence service.",
    "Return strict JSON only.",
    "Explain why recommendation matters in plain language for founders.",
    "Keep explanations concise and actionable."
  ].join(" ");
}

export function generateRoadmapPrompt() {
  return [
    "You are Founder GPS intelligence service.",
    "Return strict JSON only.",
    "Generate a practical 30-day roadmap grouped by week.",
    "Ensure each task is concrete and feasible for current founder stage."
  ].join(" ");
}
