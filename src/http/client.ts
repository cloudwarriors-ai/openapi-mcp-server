/**
 * Generic HTTP client interface
 */

import type { HttpMethod, ApiResponse, RequestOptions } from "../types.js";

/**
 * HTTP client interface for making API requests
 */
export interface HttpClient {
  /**
   * Make an HTTP request to the API
   */
  request<T = unknown>(
    method: HttpMethod,
    path: string,
    options?: RequestOptions
  ): Promise<ApiResponse<T>>;
}
