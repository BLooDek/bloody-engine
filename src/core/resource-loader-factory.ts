/**
 * Resource Loader Factory
 * Creates the appropriate resource loader based on the runtime environment
 * Follows the same pattern as RenderingContextFactory
 */

import type { IResourceLoader } from "./resource-loader";

/**
 * Environment type enumeration
 */
export enum Environment {
  /** Browser environment (DOM APIs available) */
  BROWSER = "browser",
  /** Node.js environment (file system APIs available) */
  NODE = "node",
  /** Unknown environment */
  UNKNOWN = "unknown",
}

/**
 * Resource loader factory configuration
 */
export interface ResourceLoaderFactoryOptions {
  /**
   * Force a specific environment (useful for testing)
   * If not specified, the factory will auto-detect the environment
   */
  forceEnvironment?: Environment;

  /**
   * Base URL for browser resource loader
   */
  baseUrl?: string;

  /**
   * Request timeout for browser resource loader (in milliseconds)
   */
  timeout?: number;

  /**
   * Base directory for Node.js resource loader
   */
  baseDir?: string;
}

/**
 * Factory class for creating resource loaders
 * Automatically detects the runtime environment and creates the appropriate loader
 */
export class ResourceLoaderFactory {
  /**
   * Detect the current runtime environment
   * @returns The detected environment type
   */
  static detectEnvironment(): Environment {
    // Check for browser environment
    if (
      typeof window !== "undefined" &&
      typeof window.document !== "undefined" &&
      typeof fetch !== "undefined"
    ) {
      return Environment.BROWSER;
    }

    // Check for Node.js environment
    if (
      typeof process !== "undefined" &&
      process.versions != null &&
      process.versions.node != null
    ) {
      return Environment.NODE;
    }

    return Environment.UNKNOWN;
  }

  /**
   * Check if the current environment is a browser
   * @returns true if running in a browser
   */
  static isBrowser(): boolean {
    return this.detectEnvironment() === Environment.BROWSER;
  }

  /**
   * Check if the current environment is Node.js
   * @returns true if running in Node.js
   */
  static isNode(): boolean {
    return this.detectEnvironment() === Environment.NODE;
  }

  /**
   * Create a resource loader for the current environment
   * @param options Optional factory configuration
   * @returns A resource loader instance appropriate for the current platform
   * @throws Error if the environment is not supported
   */
  static async create(options?: ResourceLoaderFactoryOptions): Promise<IResourceLoader> {
    // Use forced environment if specified, otherwise detect
    const environment =
      options?.forceEnvironment || this.detectEnvironment();

    switch (environment) {
      case Environment.BROWSER:
        return await this.createBrowserLoader(options);

      case Environment.NODE:
        return await this.createNodeLoader(options);

      case Environment.UNKNOWN:
        throw new Error(
          "Unsupported environment: Unable to determine runtime environment. " +
            "Please specify forceEnvironment in options.",
        );

      default:
        throw new Error(`Unsupported environment: ${environment}`);
    }
  }

  /**
   * Create a browser resource loader
   * @param options Optional factory configuration
   * @returns A browser resource loader instance
   */
  static async createBrowserLoader(
    options?: ResourceLoaderFactoryOptions,
  ): Promise<IResourceLoader> {
    // Dynamically import the browser loader
    const { BrowserResourceLoader: Loader } = await import(
      "../platforms/browser/browser-resource-loader.js"
    );
    return new Loader(options?.baseUrl, options?.timeout);
  }

  /**
   * Create a Node.js resource loader
   * @param options Optional factory configuration
   * @returns A Node.js resource loader instance
   */
  static async createNodeLoader(
    options?: ResourceLoaderFactoryOptions,
  ): Promise<IResourceLoader> {
    // Dynamically import the Node loader
    const { NodeResourceLoader: Loader } = await import(
      "../platforms/node/node-resource-loader.js"
    );
    return new Loader(options?.baseDir);
  }

  /**
   * Create a resource loader with automatic fallback
   * If the preferred loader is not available, falls back to the available loader
   * @param preferredEnvironment Preferred environment
   * @param options Optional factory configuration
   * @returns A resource loader instance
   */
  static async createWithFallback(
    preferredEnvironment: Environment,
    options?: ResourceLoaderFactoryOptions,
  ): Promise<IResourceLoader> {
    try {
      options = { ...options, forceEnvironment: preferredEnvironment };
      return await this.create(options);
    } catch {
      // Fallback to auto-detected environment
      return await this.create({ ...options, forceEnvironment: undefined });
    }
  }
}

/**
 * Convenience function to create a resource loader
 * Shortcut for ResourceLoaderFactory.create()
 * @param options Optional factory configuration
 * @returns A resource loader instance
 */
export async function createResourceLoader(
  options?: ResourceLoaderFactoryOptions,
): Promise<IResourceLoader> {
  return await ResourceLoaderFactory.create(options);
}
