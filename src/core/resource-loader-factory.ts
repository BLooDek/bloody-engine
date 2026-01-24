/**
 * Resource Loader Factory (Node.js)
 * Creates resource loaders for Node.js environments
 */

import type { IResourceLoader } from "./resource-loader";
import { NodeResourceLoader } from "../platforms/node/node-resource-loader";

/**
 * Environment type enumeration
 */
export enum Environment {
  /** Node.js environment (file system APIs available) */
  NODE = "node",
}

/**
 * Resource loader factory configuration
 */
export interface ResourceLoaderFactoryOptions {
  /**
   * Base directory for Node.js resource loader
   */
  baseDir?: string;
}

/**
 * Factory class for creating resource loaders
 * Creates Node.js resource loaders
 */
export class ResourceLoaderFactory {
  /**
   * Detect the current runtime environment
   * @returns The detected environment type (always NODE)
   */
  static detectEnvironment(): Environment {
    return Environment.NODE;
  }

  /**
   * Check if the current environment is a browser
   * @returns false (not browser)
   */
  static isBrowser(): boolean {
    return false;
  }

  /**
   * Check if the current environment is Node.js
   * @returns true
   */
  static isNode(): boolean {
    return true;
  }

  /**
   * Create a Node.js resource loader
   * @param options Optional factory configuration
   * @returns A Node.js resource loader instance
   */
  static async create(options?: ResourceLoaderFactoryOptions): Promise<IResourceLoader> {
    return new NodeResourceLoader(options?.baseDir);
  }

  /**
   * Create a Node.js resource loader
   * @param options Optional factory configuration
   * @returns A Node.js resource loader instance
   */
  static async createNodeLoader(
    options?: ResourceLoaderFactoryOptions,
  ): Promise<IResourceLoader> {
    return new NodeResourceLoader(options?.baseDir);
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
