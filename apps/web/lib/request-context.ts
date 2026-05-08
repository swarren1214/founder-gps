/**
 * Request Context and ID Management
 * Ensures request IDs are propagated across all service calls for traceability
 */

import { randomUUID } from "node:crypto";

export function generateRequestId(): string {
  return randomUUID();
}

export type RequestOptions = {
  requestId: string;
  timeout?: number;
  maxRetries?: number;
  retryDelayMs?: number;
};

/**
 * Default timeout for service calls (10 seconds)
 */
const DEFAULT_TIMEOUT = 10000;

/**
 * Default max retries for transient failures
 */
const DEFAULT_MAX_RETRIES = 2;

/**
 * Default retry delay (exponential backoff)
 */
const DEFAULT_RETRY_DELAY_MS = 100;

/**
 * Wrapper for fetch that adds request ID and implements retry logic
 */
export async function fetchWithRetry(
  url: string,
  options: RequestInit & { requestId?: string; timeout?: number; maxRetries?: number } = {}
): Promise<Response> {
  const {
    requestId = generateRequestId(),
    timeout = DEFAULT_TIMEOUT,
    maxRetries = DEFAULT_MAX_RETRIES,
    ...fetchOptions
  } = options;

  const headers = new Headers(fetchOptions.headers || {});
  headers.set("X-Request-ID", requestId);

  let lastError: Error | null = null;

  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), timeout);

      const response = await fetch(url, {
        ...fetchOptions,
        headers,
        signal: controller.signal
      });

      clearTimeout(timeoutId);

      // Retry on 5xx errors or 429 (rate limit)
      if ((response.status >= 500 || response.status === 429) && attempt < maxRetries) {
        const delayMs = DEFAULT_RETRY_DELAY_MS * Math.pow(2, attempt);
        await new Promise((resolve) => setTimeout(resolve, delayMs));
        continue;
      }

      return response;
    } catch (error) {
      lastError = error instanceof Error ? error : new Error(String(error));

      // Retry on timeout or network errors
      if (
        (error instanceof Error &&
          (error.name === "AbortError" || error.message.includes("fetch failed"))) ||
        error instanceof TypeError
      ) {
        if (attempt < maxRetries) {
          const delayMs = DEFAULT_RETRY_DELAY_MS * Math.pow(2, attempt);
          await new Promise((resolve) => setTimeout(resolve, delayMs));
          continue;
        }
      }

      throw lastError;
    }
  }

  throw lastError || new Error("Unknown fetch error");
}
