/**
 * Resource Loader Abstraction Layer
 * Provides a unified interface for loading resources (shaders, textures, etc.)
 * across different platforms (Browser and Node.js)
 */

/**
 * Result of a resource loading operation
 */
export interface ResourceLoadResult {
  /** The loaded resource content */
  data: string;
  /** Path or URL that was loaded */
  path: string;
  /** Whether the load was successful */
  success: boolean;
  /** Error message if loading failed */
  error?: string;
}

/**
 * Options for resource loading
 */
export interface ResourceLoadOptions {
  /** Character encoding (default: 'utf-8') */
  encoding?: BufferEncoding;
  /** Custom headers for browser requests */
  headers?: Record<string, string>;
  /** Request credentials mode for fetch ('same-origin', 'include', 'omit') */
  credentials?: RequestCredentials;
}

/**
 * Interface for loading resources (shaders, textures, etc.)
 * Provides platform-agnostic API for resource loading
 */
export interface IResourceLoader {
  /**
   * Load a single resource from a path or URL
   * @param path File path (Node.js) or URL (browser)
   * @param options Optional loading configuration
   * @returns Promise resolving to the loaded resource content
   */
  load(path: string, options?: ResourceLoadOptions): Promise<string>;

  /**
   * Load multiple resources in parallel
   * @param paths Array of file paths or URLs
   * @param options Optional loading configuration
   * @returns Promise resolving to array of loaded resources
   */
  loadMultiple(
    paths: string[],
    options?: ResourceLoadOptions,
  ): Promise<ResourceLoadResult[]>;

  /**
   * Check if this loader can handle the given path
   * @param path File path or URL to check
   * @returns true if the path is valid for this loader
   */
  canLoad(path: string): boolean;
}

/**
 * Batch load result for loading multiple resources
 */
export interface BatchLoadResult {
  /** Successfully loaded resources indexed by path */
  succeeded: Map<string, string>;
  /** Failed resources indexed by path with error messages */
  failed: Map<string, string>;
  /** Total number of resources requested */
  total: number;
  /** Number of successfully loaded resources */
  successCount: number;
  /** Number of failed resources */
  failureCount: number;
}
