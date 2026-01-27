/**
 * OpenAPI specification loader - fetches spec from API server
 */

import { OpenAPISpecError, NetworkError } from "../errors/index.js";
import type { Config } from "../config.js";

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
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), this.timeoutMs);

    try {
      const response = await fetch(this.url, {
        method: "GET",
        headers: {
          Accept: "application/yaml, application/x-yaml, text/yaml, text/plain",
        },
        signal: controller.signal,
      });

      clearTimeout(timeoutId);

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
      clearTimeout(timeoutId);

      if (error instanceof OpenAPISpecError) {
        throw error;
      }

      if (error instanceof Error) {
        if (error.name === "AbortError") {
          throw new NetworkError(
            this.url,
            `Request to ${this.url} timed out after ${this.timeoutMs}ms`
          );
        }
        throw new OpenAPISpecError("fetch_failed", error.message);
      }

      throw new OpenAPISpecError("fetch_failed", "Unknown fetch error");
    }
  }
}
