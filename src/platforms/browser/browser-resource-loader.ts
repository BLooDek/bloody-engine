/**
 * Browser-based Resource Loader
 * Loads resources using the Fetch API (browser environment)
 */

import type {
  IResourceLoader,
  ResourceLoadOptions,
  ResourceLoadResult,
} from "../../core/resource-loader";

/**
 * Resource loader implementation for browser environments
 * Uses the Fetch API to load resources from URLs
 */
export class BrowserResourceLoader implements IResourceLoader {
  /**
   * Base URL for resolving relative paths
   */
  private baseUrl: string;

  /**
   * Default request timeout in milliseconds
   */
  private defaultTimeout: number;

  /**
   * Create a new browser resource loader
   * @param baseUrl Optional base URL for resolving relative paths (defaults to current origin)
   * @param timeout Default timeout for requests in milliseconds (default: 10000)
   */
  constructor(baseUrl: string = "", timeout: number = 10000) {
    this.baseUrl = baseUrl || this.getCurrentOrigin();
    this.defaultTimeout = timeout;
  }

  /**
   * Get the current origin (protocol + host + port)
   */
  private getCurrentOrigin(): string {
    return typeof window !== "undefined"
      ? window.location.origin
      : "http://localhost";
  }

  /**
   * Resolve a relative path against the base URL
   * @param path Relative or absolute path
   * @returns Resolved absolute URL
   */
  private resolvePath(path: string): string {
    try {
      // If path is already an absolute URL, return it
      if (path.startsWith("http://") || path.startsWith("https://")) {
        return path;
      }

      // Handle protocol-relative URLs
      if (path.startsWith("//")) {
        return window.location.protocol + path;
      }

      // Handle absolute paths (starting with /)
      if (path.startsWith("/")) {
        return this.baseUrl + path;
      }

      // Handle relative paths
      return `${this.baseUrl}/${path}`;
    } catch {
      // If we can't resolve, return as-is
      return path;
    }
  }

  /**
   * Load a single resource from a URL
   * @param path URL or relative path to the resource
   * @param options Optional loading configuration
   * @returns Promise resolving to the resource content
   */
  async load(path: string, options?: ResourceLoadOptions): Promise<string> {
    const url = this.resolvePath(path);

    try {
      // Configure fetch options
      const fetchOptions: RequestInit = {
        credentials: options?.credentials || "same-origin",
      };

      // Add custom headers if provided
      if (options?.headers) {
        fetchOptions.headers = options.headers;
      }

      // Create abort controller for timeout
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), this.defaultTimeout);
      fetchOptions.signal = controller.signal;

      // Fetch the resource
      const response = await fetch(url, fetchOptions);
      clearTimeout(timeoutId);

      // Check for HTTP errors
      if (!response.ok) {
        throw new Error(
          `HTTP ${response.status}: ${response.statusText} for URL: ${url}`,
        );
      }

      // Get the text content
      const text = await response.text();
      return text;
    } catch (error) {
      if (error instanceof Error) {
        if (error.name === "AbortError") {
          throw new Error(
            `Request timeout after ${this.defaultTimeout}ms for URL: ${url}`,
          );
        }
        throw new Error(`Failed to load resource from ${url}: ${error.message}`);
      }
      throw new Error(`Failed to load resource from ${url}: Unknown error`);
    }
  }

  /**
   * Load multiple resources in parallel
   * @param paths Array of URLs or paths
   * @param options Optional loading configuration
   * @returns Promise resolving to array of load results
   */
  async loadMultiple(
    paths: string[],
    options?: ResourceLoadOptions,
  ): Promise<ResourceLoadResult[]> {
    const promises = paths.map(async (path) => {
      try {
        const data = await this.load(path, options);
        return {
          data,
          path,
          success: true,
        };
      } catch (error) {
        return {
          data: "",
          path,
          success: false,
          error: error instanceof Error ? error.message : String(error),
        };
      }
    });

    return Promise.all(promises);
  }

  /**
   * Check if the path is valid for loading in the browser
   * @param path URL or path to check
   * @returns true if the path can be loaded
   */
  canLoad(path: string): boolean {
    // Check for valid URL patterns
    const validPatterns = [
      /^https?:\/\//i, // Absolute HTTP(S) URLs
      /^\/\//, // Protocol-relative URLs
      /^\//, // Absolute paths
      /^\.\.?\//, // Relative paths starting with ./ or ../
    ];

    // Also accept paths that look like files
    const hasFileExtension = /\.[a-z0-9]+$/i.test(path);

    return validPatterns.some((pattern) => pattern.test(path)) || hasFileExtension;
  }

  /**
   * Set a new base URL for resolving relative paths
   * @param baseUrl New base URL
   */
  setBaseUrl(baseUrl: string): void {
    this.baseUrl = baseUrl;
  }

  /**
   * Get the current base URL
   * @returns Current base URL
   */
  getBaseUrl(): string {
    return this.baseUrl;
  }

  /**
   * Set the default request timeout
   * @param timeout Timeout in milliseconds
   */
  setTimeout(timeout: number): void {
    this.defaultTimeout = timeout;
  }
}
