/**
 * Node.js Texture Loader
 * Loads PNG textures from the file system and prepares them for WebGL
 */

import * as fs from "fs/promises";
import * as path from "path";
// @ts-ignore - pngjs doesn't have built-in types
import { PNG } from "pngjs";

/**
 * Result of a texture loading operation
 */
export interface TextureLoadResult {
  /** Decoded pixel data (RGBA, Uint8Array) */
  data: Uint8Array;
  /** Texture width in pixels */
  width: number;
  /** Texture height in pixels */
  height: number;
  /** Number of color channels (always 4 for RGBA) */
  channels: number;
}

/**
 * Options for texture loading
 */
export interface TextureLoadOptions {
  /**
   * Whether to flip the texture vertically (Y-axis)
   * Default: true (to match WebGL's UNPACK_FLIP_Y_WEBGL behavior)
   */
  flipY?: boolean;
}

/**
 * Texture loader for Node.js environments
 * Loads PNG files and prepares them for use with WebGL texImage2D
 */
export class NodeTextureLoader {
  /**
   * Base directory for resolving relative paths
   */
  private baseDir: string;

  /**
   * Create a new Node.js texture loader
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
   * Load a PNG texture from a file
   * @param filePath Path to the PNG file
   * @param options Optional loading configuration
   * @returns Promise resolving to the texture data
   */
  async load(
    filePath: string,
    options?: TextureLoadOptions,
  ): Promise<TextureLoadResult> {
    const resolvedPath = this.resolvePath(filePath);
    const flipY = options?.flipY !== false; // Default to true

    try {
      // Read the PNG file as a buffer
      const buffer = await fs.readFile(resolvedPath);

      // Parse the PNG using pngjs
      const png = PNG.sync.read(buffer);

      // Get the pixel data
      let data = png.data;

      // Flip the image vertically if requested
      if (flipY) {
        data = this.flipYAxis(data, png.width, png.height);
      }

      return {
        data,
        width: png.width,
        height: png.height,
        channels: 4, // PNG always returns RGBA
      };
    } catch (error) {
      if (error instanceof Error) {
        // Provide more helpful error messages for common issues
        const errorCode = (error as any).code;

        if (errorCode === "ENOENT") {
          throw new Error(
            `Texture file not found: ${resolvedPath} (resolved from: ${filePath})`,
          );
        }
        if (errorCode === "EACCES") {
          throw new Error(
            `Permission denied reading texture file: ${resolvedPath}`,
          );
        }
        if (errorCode === "EISDIR") {
          throw new Error(
            `Path is a directory, not a file: ${resolvedPath}`,
          );
        }

        throw new Error(
          `Failed to load texture from ${resolvedPath}: ${error.message}`,
        );
      }
      throw new Error(
        `Failed to load texture from ${resolvedPath}: Unknown error`,
      );
    }
  }

  /**
   * Manually flip pixel buffer on Y-axis
   * This is needed because UNPACK_FLIP_Y_WEBGL is often buggy/unsupported
   * in headless WebGL implementations
   *
   * @param data Source pixel data (RGBA)
   * @param width Image width in pixels
   * @param height Image height in pixels
   * @returns Flipped pixel data
   */
  private flipYAxis(
    data: Uint8Array,
    width: number,
    height: number,
  ): Uint8Array {
    const flipped = new Uint8Array(data.length);
    const rowSize = width * 4; // 4 bytes per pixel (RGBA)

    for (let y = 0; y < height; y++) {
      // Calculate source and destination row positions
      const srcRowStart = y * rowSize;
      const destRowStart = (height - 1 - y) * rowSize;

      // Copy the entire row
      flipped.set(
        data.subarray(srcRowStart, srcRowStart + rowSize),
        destRowStart,
      );
    }

    return flipped;
  }

  /**
   * Load multiple textures in parallel
   * @param filePaths Array of PNG file paths
   * @param options Optional loading configuration
   * @returns Promise resolving to array of texture load results
   */
  async loadMultiple(
    filePaths: string[],
    options?: TextureLoadOptions,
  ): Promise<Array<{ path: string; result: TextureLoadResult } | { path: string; error: string }>> {
    const promises = filePaths.map(async (filePath) => {
      try {
        const result = await this.load(filePath, options);
        return { path: filePath, result };
      } catch (error) {
        return {
          path: filePath,
          error: error instanceof Error ? error.message : String(error),
        };
      }
    });

    return Promise.all(promises);
  }

  /**
   * Check if the path is valid for loading
   * @param filePath File path to check
   * @returns true if the path can be loaded
   */
  canLoad(filePath: string): boolean {
    // Check for valid file path patterns
    const validPatterns = [
      /\.png$/i, // Must end with .png (case-insensitive)
    ];

    // Also check general path validity
    const pathValidPatterns = [
      /^\//, // Unix absolute paths
      /^[a-zA-Z]:/, // Windows absolute paths (e.g., C:\)
      /^\.\.?\//, // Relative paths starting with ./ or ../
      /^[^/\\]+\//, // Relative paths without explicit prefix (e.g., "textures/")
    ];

    return (
      validPatterns.some((pattern) => pattern.test(filePath)) &&
      pathValidPatterns.some((pattern) => pattern.test(filePath))
    );
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
}
