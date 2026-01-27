/**
 * Generic HTTP client implementation for OpenAPI-documented APIs
 */

import type { HttpClient } from "./client.js";
import type { Config } from "../config.js";
import type { HttpMethod, ApiResponse, RequestOptions } from "../types.js";
import {
  ApiError,
  AuthenticationError,
  RateLimitError,
  NetworkError,
} from "../errors/index.js";

/**
 * HTTP client for API requests
 */
export class ApiHttpClient implements HttpClient {
  private readonly config: Config;

  constructor(config: Config) {
    this.config = config;
  }

  async request<T = unknown>(
    method: HttpMethod,
    path: string,
    options: RequestOptions = {}
  ): Promise<ApiResponse<T>> {
    const url = this.buildUrl(path, options.pathParams, options.query);
    const headers = this.buildHeaders(options.headers);
    const timeout = options.timeout || this.config.timeoutMs;

    let lastError: Error | null = null;
    let retryCount = 0;

    while (retryCount <= this.config.maxRetries) {
      try {
        const response = await this.executeRequest<T>(
          method,
          url,
          headers,
          options.body,
          timeout
        );
        return response;
      } catch (error) {
        lastError = error as Error;

        // Only retry on 429 if configured
        if (
          error instanceof RateLimitError &&
          this.config.retryOn429 &&
          retryCount < this.config.maxRetries
        ) {
          const backoffMs = this.calculateBackoff(retryCount, error.retryAfterSeconds);
          await this.sleep(backoffMs);
          retryCount++;
          continue;
        }

        throw error;
      }
    }

    throw lastError || new Error("Request failed after retries");
  }

  private async executeRequest<T>(
    method: HttpMethod,
    url: string,
    headers: Record<string, string>,
    body: unknown | undefined,
    timeout: number
  ): Promise<ApiResponse<T>> {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), timeout);

    try {
      const response = await fetch(url, {
        method,
        headers,
        body: body ? JSON.stringify(body) : undefined,
        signal: controller.signal,
      });

      clearTimeout(timeoutId);

      // Extract headers
      const responseHeaders: Record<string, string> = {};
      response.headers.forEach((value, key) => {
        responseHeaders[key.toLowerCase()] = value;
      });

      // Check content type before parsing
      const contentType = responseHeaders["content-type"] || "";
      if (contentType.includes("text/html") && !response.ok) {
        throw new ApiError(
          "Received HTML error page instead of JSON. Check if the API server is running correctly.",
          response.status,
          url
        );
      }

      // Parse response body
      let data: T;
      const responseText = await response.text();

      if (responseText) {
        try {
          data = JSON.parse(responseText) as T;
        } catch {
          // If it's not JSON and successful, return raw text
          if (response.ok) {
            data = responseText as unknown as T;
          } else {
            throw new ApiError(
              `Failed to parse response: ${responseText.slice(0, 200)}`,
              response.status,
              url
            );
          }
        }
      } else {
        data = null as unknown as T;
      }

      // Handle error status codes
      if (!response.ok) {
        this.handleErrorStatus(response.status, url, data, responseHeaders);
      }

      return {
        status: response.status,
        data,
        headers: responseHeaders,
      };
    } catch (error) {
      clearTimeout(timeoutId);

      if (
        error instanceof ApiError ||
        error instanceof AuthenticationError ||
        error instanceof RateLimitError
      ) {
        throw error;
      }

      if (error instanceof Error) {
        if (error.name === "AbortError") {
          throw new NetworkError(url, `Request timed out after ${timeout}ms`);
        }
        throw new NetworkError(url, error.message, error);
      }

      throw new NetworkError(url, "Unknown network error");
    }
  }

  private handleErrorStatus(
    status: number,
    url: string,
    data: unknown,
    headers: Record<string, string>
  ): never {
    const message =
      data && typeof data === "object" && "message" in data
        ? String((data as { message: unknown }).message)
        : `HTTP ${status}`;

    switch (status) {
      case 401:
        throw new AuthenticationError(url, 401, message);
      case 403:
        throw new AuthenticationError(url, 403, message);
      case 429: {
        const retryAfter = headers["retry-after"]
          ? parseInt(headers["retry-after"], 10)
          : undefined;
        throw new RateLimitError(url, retryAfter);
      }
      default:
        throw new ApiError(message, status, url, data);
    }
  }

  private buildUrl(
    path: string,
    pathParams?: Record<string, string>,
    query?: Record<string, string>
  ): string {
    let resolvedPath = path;

    // Substitute path parameters
    if (pathParams) {
      for (const [key, value] of Object.entries(pathParams)) {
        resolvedPath = resolvedPath.replace(`{${key}}`, encodeURIComponent(value));
      }
    }

    const url = new URL(resolvedPath, this.config.baseUrl);

    // Add query parameters
    if (query) {
      for (const [key, value] of Object.entries(query)) {
        url.searchParams.set(key, value);
      }
    }

    return url.toString();
  }

  private buildHeaders(additionalHeaders?: Record<string, string>): Record<string, string> {
    const headers: Record<string, string> = {
      "Content-Type": "application/json",
      Accept: "application/json",
      ...additionalHeaders,
    };

    // Add authentication
    if (this.config.auth.type === "apiKey") {
      headers[this.config.auth.header] = this.config.auth.key;
    } else if (this.config.auth.type === "bearer") {
      headers["Authorization"] = `Bearer ${this.config.auth.token}`;
    }

    return headers;
  }

  private calculateBackoff(retryCount: number, retryAfterSeconds?: number): number {
    if (retryAfterSeconds) {
      return retryAfterSeconds * 1000;
    }
    // Exponential backoff: 1s, 2s, 4s, ...
    return Math.pow(2, retryCount) * 1000;
  }

  private sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }
}
