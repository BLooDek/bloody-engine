/**
 * Resource Loading Pipeline
 * High-level utilities for loading and managing resources asynchronously
 */

import type {
  IResourceLoader,
  BatchLoadResult,
  ResourceLoadResult,
  ResourceLoadOptions,
} from "./resource-loader";

/**
 * Shader source code container
 */
export interface ShaderSource {
  /** Vertex shader source code */
  vertex: string;
  /** Fragment shader source code */
  fragment: string;
}

/**
 * Named shader source (for shader libraries)
 */
export interface NamedShaderSource extends ShaderSource {
  /** Shader identifier/name */
  name: string;
}

/**
 * Resource loading pipeline configuration
 */
export interface ResourcePipelineOptions extends ResourceLoadOptions {
  /** Maximum number of concurrent loads (default: 10) */
  concurrency?: number;
  /** Whether to cache loaded resources (default: true) */
  cache?: boolean;
}

/**
 * Resource cache for storing loaded resources
 */
class ResourceCache {
  private cache: Map<string, string> = new Map();
  private enabled: boolean;

  constructor(enabled: boolean = true) {
    this.enabled = enabled;
  }

  get(key: string): string | undefined {
    if (!this.enabled) return undefined;
    return this.cache.get(key);
  }

  set(key: string, value: string): void {
    if (this.enabled) {
      this.cache.set(key, value);
    }
  }

  has(key: string): boolean {
    if (!this.enabled) return false;
    return this.cache.has(key);
  }

  clear(): void {
    this.cache.clear();
  }

  size(): number {
    return this.cache.size;
  }

  enable(): void {
    this.enabled = true;
  }

  disable(): void {
    this.enabled = false;
  }
}

/**
 * Resource Loading Pipeline
 * High-level API for loading and managing resources with caching,
 * batch operations, and shader-specific utilities
 */
export class ResourcePipeline {
  private loader: IResourceLoader;
  private cache: ResourceCache;
  private concurrency: number;

  /**
   * Create a new resource loading pipeline
   * @param loader Resource loader instance
   * @param options Pipeline configuration options
   */
  constructor(loader: IResourceLoader, options?: ResourcePipelineOptions) {
    this.loader = loader;
    this.concurrency = options?.concurrency ?? 10;
    this.cache = new ResourceCache(options?.cache ?? true);
  }

  /**
   * Load a single resource with caching support
   * @param path Resource path or URL
   * @param options Optional loading options
   * @returns Promise resolving to the resource content
   */
  async load(
    path: string,
    options?: ResourceLoadOptions,
  ): Promise<string> {
    // Check cache first
    const cached = this.cache.get(path);
    if (cached !== undefined) {
      return cached;
    }

    // Load the resource
    const content = await this.loader.load(path, options);

    // Cache the result
    this.cache.set(path, content);

    return content;
  }

  /**
   * Load multiple resources with concurrency control
   * @param paths Array of resource paths
   * @param options Optional loading options
   * @returns Promise resolving to batch load result
   */
  async loadBatch(
    paths: string[],
    options?: ResourceLoadOptions,
  ): Promise<BatchLoadResult> {
    const succeeded = new Map<string, string>();
    const failed = new Map<string, string>();

    // Process in batches to control concurrency
    for (let i = 0; i < paths.length; i += this.concurrency) {
      const batch = paths.slice(i, i + this.concurrency);
      const results = await this.loader.loadMultiple(batch, options);

      for (const result of results) {
        if (result.success) {
          succeeded.set(result.path, result.data);
          this.cache.set(result.path, result.data);
        } else {
          failed.set(result.path, result.error || "Unknown error");
        }
      }
    }

    return {
      succeeded,
      failed,
      total: paths.length,
      successCount: succeeded.size,
      failureCount: failed.size,
    };
  }

  /**
   * Load a shader from separate vertex and fragment files
   * @param vertexPath Path to vertex shader file
   * @param fragmentPath Path to fragment shader file
   * @param options Optional loading options
   * @returns Promise resolving to shader source code
   */
  async loadShader(
    vertexPath: string,
    fragmentPath: string,
    options?: ResourceLoadOptions,
  ): Promise<ShaderSource> {
    const [vertex, fragment] = await Promise.all([
      this.load(vertexPath, options),
      this.load(fragmentPath, options),
    ]);

    return { vertex, fragment };
  }

  /**
   * Load multiple shaders
   * @param shaders Array of shader definitions
   * @param options Optional loading options
   * @returns Promise resolving to array of named shader sources
   */
  async loadShaders(
    shaders: Array<{
      name: string;
      vertex: string;
      fragment: string;
    }>,
    options?: ResourceLoadOptions,
  ): Promise<NamedShaderSource[]> {
    const results = await Promise.all(
      shaders.map(async (shader) => {
        const source = await this.loadShader(
          shader.vertex,
          shader.fragment,
          options,
        );
        return {
          name: shader.name,
          ...source,
        };
      }),
    );

    return results;
  }

  /**
   * Load resources from a manifest file
   * @param manifestPath Path to JSON manifest file
   * @param options Optional loading options
   * @returns Promise resolving to batch load result
   */
  async loadFromManifest(
    manifestPath: string,
    options?: ResourceLoadOptions,
  ): Promise<BatchLoadResult> {
    // Load the manifest
    const manifestContent = await this.load(manifestPath, options);
    const manifest: { resources: string[] } = JSON.parse(manifestContent);

    // Load all resources in the manifest
    return this.loadBatch(manifest.resources, options);
  }

  /**
   * Preload resources for faster access later
   * @param paths Array of resource paths to preload
   * @param options Optional loading options
   * @returns Promise resolving when all resources are loaded
   */
  async preload(
    paths: string[],
    options?: ResourceLoadOptions,
  ): Promise<void> {
    await this.loadBatch(paths, options);
  }

  /**
   * Check if a resource is cached
   * @param path Resource path
   * @returns true if the resource is in the cache
   */
  isCached(path: string): boolean {
    return this.cache.has(path);
  }

  /**
   * Get a resource from cache without loading
   * @param path Resource path
   * @returns Cached content or undefined if not cached
   */
  getCached(path: string): string | undefined {
    return this.cache.get(path);
  }

  /**
   * Clear the resource cache
   */
  clearCache(): void {
    this.cache.clear();
  }

  /**
   * Get cache statistics
   * @returns Number of cached resources
   */
  getCacheSize(): number {
    return this.cache.size();
  }

  /**
   * Enable caching
   */
  enableCache(): void {
    this.cache.enable();
  }

  /**
   * Disable caching
   */
  disableCache(): void {
    this.cache.disable();
  }

  /**
   * Set the maximum concurrency for batch operations
   * @param concurrency Maximum concurrent loads
   */
  setConcurrency(concurrency: number): void {
    this.concurrency = Math.max(1, concurrency);
  }

  /**
   * Get the underlying resource loader
   * @returns The resource loader instance
   */
  getLoader(): IResourceLoader {
    return this.loader;
  }
}

/**
 * Create a resource pipeline with automatic environment detection
 * @param options Optional pipeline and loader configuration
 * @returns A new resource pipeline instance
 */
export async function createResourcePipeline(
  options?: ResourcePipelineOptions & {
    baseUrl?: string;
    baseDir?: string;
    timeout?: number;
  },
): Promise<ResourcePipeline> {
  // Dynamically import factory to avoid circular dependencies
  const { ResourceLoaderFactory } = await import("./resource-loader-factory");

  const loader = await ResourceLoaderFactory.create({
    baseUrl: options?.baseUrl,
    baseDir: options?.baseDir,
    timeout: options?.timeout,
  });

  return new ResourcePipeline(loader, options);
}
