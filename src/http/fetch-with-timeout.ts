/**
 * Fetch wrapper with timeout support using AbortController
 */

export interface TimeoutFetchOptions extends RequestInit {
  timeoutMs: number;
}

/**
 * Fetch with automatic timeout
 * @throws Error with name 'AbortError' on timeout
 */
export async function fetchWithTimeout(
  url: string,
  { timeoutMs, ...fetchOptions }: TimeoutFetchOptions
): Promise<Response> {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

  try {
    return await fetch(url, {
      ...fetchOptions,
      signal: controller.signal,
    });
  } finally {
    clearTimeout(timeoutId);
  }
}

/**
 * Type guard for timeout errors
 */
export function isTimeoutError(error: unknown): error is Error {
  return error instanceof Error && error.name === "AbortError";
}
