/**
 * OpenAPI specification loader - fetches spec from API server
 */

import { OpenAPISpecError, NetworkError } from "../errors/index.js";
import type { Config } from "../config.js";
import { fetchWithTimeout, isTimeoutError } from "../http/fetch-with-timeout.js";

/**
 * Interface for spec loading (allows mocking in tests)
 */
export interface SpecLoader {
  fetch(): Promise<string>;
}

/**
 * HTTP-based spec loader
 */
export class HttpSpecLoader implements SpecLoader {
  private readonly url: string;
  private readonly timeoutMs: number;

  constructor(config: Config) {
    this.url = `${config.baseUrl}${config.openapiSpecPath}`;
    this.timeoutMs = config.timeoutMs;
  }

  async fetch(): Promise<string> {
    try {
      const response = await fetchWithTimeout(this.url, {
        method: "GET",
        headers: {
          Accept: "application/yaml, application/x-yaml, text/yaml, text/plain",
        },
        timeoutMs: this.timeoutMs,
      });

      if (!response.ok) {
        throw new OpenAPISpecError(
          "fetch_failed",
          `HTTP ${response.status}: ${response.statusText}`
        );
      }

      // Validate content type (should be YAML, not HTML)
      const contentType = response.headers.get("content-type") || "";
      if (contentType.includes("text/html")) {
        throw new OpenAPISpecError(
          "fetch_failed",
          "Received HTML instead of YAML. Is the API server running? Check the URL."
        );
      }

      return await response.text();
    } catch (error) {
      if (error instanceof OpenAPISpecError) {
        throw error;
      }

      if (isTimeoutError(error)) {
        throw new NetworkError(
          this.url,
          `Request to ${this.url} timed out after ${this.timeoutMs}ms`
        );
      }

      if (error instanceof Error) {
        throw new OpenAPISpecError("fetch_failed", error.message);
      }

      throw new OpenAPISpecError("fetch_failed", "Unknown fetch error");
    }
  }
}
