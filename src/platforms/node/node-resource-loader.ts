/**
 * Node.js-based Resource Loader
 * Loads resources from the file system using fs.promises
 */

import * as fs from "fs/promises";
import * as path from "path";
import type { Stats } from "fs";
import type {
  IResourceLoader,
  ResourceLoadOptions,
  ResourceLoadResult,
} from "../../core/resource-loader";

/**
 * Resource loader implementation for Node.js environments
 * Uses fs.promises to load resources from the file system
 */
export class NodeResourceLoader implements IResourceLoader {
  /**
   * Base directory for resolving relative paths
   */
  private baseDir: string;

  /**
   * Create a new Node.js resource loader
   * @param baseDir Optional base directory for resolving relative paths (defaults to current working directory)
   */
  constructor(baseDir: string = process.cwd()) {
    this.baseDir = baseDir;
  }

  /**
   * Resolve a relative path against the base directory
   * @param filePath Relative or absolute file path
   * @returns Resolved absolute file path
   */
  private resolvePath(filePath: string): string {
    // If already an absolute path, normalize it
    if (path.isAbsolute(filePath)) {
      return path.normalize(filePath);
    }

    // Resolve relative path against base directory
    return path.normalize(path.join(this.baseDir, filePath));
  }

  /**
   * Load a single resource from a file
   * @param filePath File path (relative or absolute)
   * @param options Optional loading configuration
   * @returns Promise resolving to the file content
   */
  async load(filePath: string, options?: ResourceLoadOptions): Promise<string> {
    const resolvedPath = this.resolvePath(filePath);
    const encoding = options?.encoding || "utf-8";

    try {
      // Read file with specified encoding (encoding as second parameter for fs/promises)
      const content = await fs.readFile(resolvedPath, encoding);
      return content;
    } catch (error) {
      if (error instanceof Error) {
        // Provide more helpful error messages for common issues
        const errorCode = (error as any).code;

        if (errorCode === "ENOENT") {
          throw new Error(
            `File not found: ${resolvedPath} (resolved from: ${filePath})`,
          );
        }
        if (errorCode === "EACCES") {
          throw new Error(
            `Permission denied reading file: ${resolvedPath}`,
          );
        }
        if (errorCode === "EISDIR") {
          throw new Error(
            `Path is a directory, not a file: ${resolvedPath}`,
          );
        }

        throw new Error(
          `Failed to load resource from ${resolvedPath}: ${error.message}`,
        );
      }
      throw new Error(
        `Failed to load resource from ${resolvedPath}: Unknown error`,
      );
    }
  }

  /**
   * Load multiple resources in parallel
   * @param filePaths Array of file paths
   * @param options Optional loading configuration
   * @returns Promise resolving to array of load results
   */
  async loadMultiple(
    filePaths: string[],
    options?: ResourceLoadOptions,
  ): Promise<ResourceLoadResult[]> {
    const promises = filePaths.map(async (filePath) => {
      try {
        const data = await this.load(filePath, options);
        return {
          data,
          path: filePath,
          success: true,
        };
      } catch (error) {
        return {
          data: "",
          path: filePath,
          success: false,
          error: error instanceof Error ? error.message : String(error),
        };
      }
    });

    return Promise.all(promises);
  }

  /**
   * Check if the path is valid for loading in Node.js
   * @param filePath File path to check
   * @returns true if the path can be loaded
   */
  canLoad(filePath: string): boolean {
    // Check for valid file path patterns
    const validPatterns = [
      /^\//, // Unix absolute paths
      /^[a-zA-Z]:/, // Windows absolute paths (e.g., C:\)
      /^\.\.?\//, // Relative paths starting with ./ or ../
      /^[^/\\]+\//, // Relative paths without explicit prefix (e.g., "shaders/")
    ];

    return validPatterns.some((pattern) => pattern.test(filePath));
  }

  /**
   * Check if a file exists without loading it
   * @param filePath File path to check
   * @returns Promise resolving to true if file exists
   */
  async exists(filePath: string): Promise<boolean> {
    const resolvedPath = this.resolvePath(filePath);
    try {
      await fs.access(resolvedPath, fs.constants.F_OK);
      return true;
    } catch {
      return false;
    }
  }

  /**
   * Get file statistics (size, modification time, etc.)
   * @param filePath File path to check
   * @returns Promise resolving to file stats
   */
  async getStats(filePath: string): Promise<Stats> {
    const resolvedPath = this.resolvePath(filePath);
    return fs.stat(resolvedPath);
  }

  /**
   * Set a new base directory for resolving relative paths
   * @param baseDir New base directory
   */
  setBaseDir(baseDir: string): void {
    this.baseDir = baseDir;
  }

  /**
   * Get the current base directory
   * @returns Current base directory
   */
  getBaseDir(): string {
    return this.baseDir;
  }

  /**
   * List all files in a directory
   * @param dirPath Directory path to list
   * @param recursive Whether to recursively list subdirectories (default: false)
   * @returns Promise resolving to array of file paths
   */
  async listDirectory(
    dirPath: string,
    recursive: boolean = false,
  ): Promise<string[]> {
    const resolvedPath = this.resolvePath(dirPath);
    const entries = await fs.readdir(resolvedPath, { withFileTypes: true });
    const files: string[] = [];

    for (const entry of entries) {
      const fullPath = path.join(resolvedPath, entry.name);

      if (entry.isDirectory() && recursive) {
        const subFiles = await this.listDirectory(fullPath, true);
        files.push(...subFiles);
      } else if (entry.isFile()) {
        files.push(fullPath);
      }
    }

    return files;
  }
}
