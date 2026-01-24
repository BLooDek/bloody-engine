/**
 * Camera System for 2D/2.5D Rendering
 *
 * Provides camera positioning (x, y), zoom control, and view matrix generation
 * for offsetting global rendering position.
 */

import type { Matrix4Pool } from '../core/matrix-pool.js';
import { getGlobalPool } from '../core/matrix-pool.js';

/**
 * Matrix4 utilities for 2D camera transformations
 * Matrices are stored in column-major order (WebGL convention)
 *
 * All static methods support optional pool parameter for object pooling.
 * If no pool is provided, uses the global pool by default.
 */
export class Matrix4 {
  /**
   * Create an identity matrix
   * @param pool Optional pool to use (defaults to global pool)
   * @returns 4x4 identity matrix in column-major order
   */
  static identity(pool?: Matrix4Pool): Float32Array {
    const target = pool ?? getGlobalPool();
    return target.acquireIdentity();
  }

  /**
   * Create a translation matrix
   * @param x Translation along X axis
   * @param y Translation along Y axis
   * @param z Translation along Z axis (default 0)
   * @param pool Optional pool to use (defaults to global pool)
   * @returns 4x4 translation matrix in column-major order
   */
  static translation(x: number, y: number, z: number = 0, pool?: Matrix4Pool): Float32Array {
    const target = pool ?? getGlobalPool();
    return target.acquireTranslation(x, y, z);
  }

  /**
   * Create a scale matrix
   * @param x Scale factor along X axis
   * @param y Scale factor along Y axis
   * @param z Scale factor along Z axis (default 1)
   * @param pool Optional pool to use (defaults to global pool)
   * @returns 4x4 scale matrix in column-major order
   */
  static scale(x: number, y: number, z: number = 1, pool?: Matrix4Pool): Float32Array {
    const target = pool ?? getGlobalPool();
    return target.acquireScale(x, y, z);
  }

  /**
   * Multiply two matrices (result = a * b)
   * @param a First matrix (left operand)
   * @param b Second matrix (right operand)
   * @param pool Optional pool to use (defaults to global pool)
   * @returns Result of matrix multiplication in column-major order
   */
  static multiply(a: Float32Array, b: Float32Array, pool?: Matrix4Pool): Float32Array {
    const targetPool = pool ?? getGlobalPool();
    const result = targetPool.acquireMatrix();

    // Matrix multiplication in column-major order
    // result[i][j] = sum(a[k][j] * b[i][k]) for k = 0..3
    // In linear (column-major) storage: result[col*4 + row]
    for (let col = 0; col < 4; col++) {
      for (let row = 0; row < 4; row++) {
        let sum = 0;
        for (let k = 0; k < 4; k++) {
          sum += a[k * 4 + row] * b[col * 4 + k];
        }
        result[col * 4 + row] = sum;
      }
    }

    return result;
  }

  /**
   * Create a view matrix from camera position and zoom
   * The view matrix transforms world coordinates to camera/eye coordinates
   *
   * View = Translation(-cameraX, -cameraY, 0) * Scale(zoom, zoom, 1)
   *
   * @param x Camera X position (translation will be negative)
   * @param y Camera Y position (translation will be negative)
   * @param zoom Camera zoom level (1.0 = no zoom, >1 = zoom in, <1 = zoom out)
   * @param pool Optional pool to use (defaults to global pool)
   * @returns 4x4 view matrix in column-major order
   */
  static createViewMatrix(x: number, y: number, zoom: number, pool?: Matrix4Pool): Float32Array {
    const targetPool = pool ?? getGlobalPool();
    // First translate to negate camera position
    const translation = Matrix4.translation(-x, -y, 0, targetPool);
    // Then scale by zoom
    const scale = Matrix4.scale(zoom, zoom, 1, targetPool);
    // View = T * S (apply scale first, then translation)
    const result = Matrix4.multiply(translation, scale, targetPool);

    // Release intermediate matrices
    targetPool.releaseMatrix(translation);
    targetPool.releaseMatrix(scale);

    return result;
  }
}

/**
 * Camera for 2D/2.5D rendering
 * Controls the viewport position and zoom level
 */
export class Camera {
  private _x: number;
  private _y: number;
  private _zoom: number;
  private _viewMatrix: Float32Array | null = null;
  private _viewMatrixDirty: boolean = true;
  private _pool: Matrix4Pool | undefined;

  /**
   * Create a new camera
   * @param x Initial X position (default 0)
   * @param y Initial Y position (default 0)
   * @param zoom Initial zoom level (default 1.0)
   * @param pool Optional pool to use for matrix allocations
   */
  constructor(x: number = 0, y: number = 0, zoom: number = 1.0, pool?: Matrix4Pool) {
    this._x = x;
    this._y = y;
    this._zoom = zoom;
    this._pool = pool;
  }

  /**
   * Set the pool to use for matrix allocations
   * @param pool Pool to use, or undefined to use global pool
   */
  setPool(pool?: Matrix4Pool): void {
    this._pool = pool;
  }

  /**
   * Get the current pool (or undefined if using global pool)
   */
  getPool(): Matrix4Pool | undefined {
    return this._pool;
  }

  /**
   * Get the camera X position
   */
  get x(): number {
    return this._x;
  }

  /**
   * Set the camera X position
   */
  set x(value: number) {
    this._x = value;
    this._viewMatrixDirty = true;
  }

  /**
   * Get the camera Y position
   */
  get y(): number {
    return this._y;
  }

  /**
   * Set the camera Y position
   */
  set y(value: number) {
    this._y = value;
    this._viewMatrixDirty = true;
  }

  /**
   * Get the camera zoom level
   */
  get zoom(): number {
    return this._zoom;
  }

  /**
   * Set the camera zoom level
   * Values: 1.0 = no zoom, >1 = zoom in, <1 = zoom out
   */
  set zoom(value: number) {
    this._zoom = Math.max(0.001, value); // Prevent zoom of 0 or negative
    this._viewMatrixDirty = true;
  }

  /**
   * Set both X and Y position at once
   * @param x New X position
   * @param y New Y position
   */
  setPosition(x: number, y: number): void {
    this._x = x;
    this._y = y;
    this._viewMatrixDirty = true;
  }

  /**
   * Move the camera by a relative offset
   * @param dx X offset to add to current position
   * @param dy Y offset to add to current position
   */
  move(dx: number, dy: number): void {
    this._x += dx;
    this._y += dy;
    this._viewMatrixDirty = true;
  }

  /**
   * Scale the zoom by a factor
   * @param factor Multiplier for current zoom (e.g., 1.1 to zoom in 10%)
   */
  zoomBy(factor: number): void {
    this._zoom = Math.max(0.001, this._zoom * factor);
    this._viewMatrixDirty = true;
  }

  /**
   * Reset camera to default position and zoom
   */
  reset(): void {
    this._x = 0;
    this._y = 0;
    this._zoom = 1.0;
    // Release old matrix if exists
    if (this._viewMatrix) {
      const pool = this._pool ?? getGlobalPool();
      pool.releaseMatrix(this._viewMatrix);
      this._viewMatrix = null;
    }
    this._viewMatrixDirty = true;
  }

  /**
   * Get the view matrix for this camera
   * The view matrix transforms world coordinates to camera space
   * Caches the result until camera properties change
   *
   * @returns 4x4 view matrix in column-major order
   */
  getViewMatrix(): Float32Array {
    if (this._viewMatrixDirty || this._viewMatrix === null) {
      // Release old matrix if using pool
      if (this._viewMatrix) {
        const pool = this._pool ?? getGlobalPool();
        pool.releaseMatrix(this._viewMatrix);
      }
      // Create new using pool (or global pool if no custom pool)
      this._viewMatrix = Matrix4.createViewMatrix(this._x, this._y, this._zoom, this._pool);
      this._viewMatrixDirty = false;
    }
    return this._viewMatrix;
  }

  /**
   * Convert screen coordinates to world coordinates
   * Useful for mouse picking and interaction
   *
   * @param screenX Screen X coordinate (pixels)
   * @param screenY Screen Y coordinate (pixels)
   * @param viewportWidth Viewport width in pixels
   * @param viewportHeight Viewport height in pixels
   * @returns World coordinates {x, y}
   */
  screenToWorld(
    screenX: number,
    screenY: number,
    viewportWidth: number,
    viewportHeight: number,
  ): { x: number; y: number } {
    // Convert screen to centered coordinates
    const centeredX = screenX - viewportWidth / 2;
    const centeredY = screenY - viewportHeight / 2;

    // Apply inverse zoom
    const worldX = centeredX / this._zoom + this._x;
    const worldY = centeredY / this._zoom + this._y;

    return { x: worldX, y: worldY };
  }

  /**
   * Convert world coordinates to screen coordinates
   * Useful for UI positioning and debug rendering
   *
   * @param worldX World X coordinate
   * @param worldY World Y coordinate
   * @param viewportWidth Viewport width in pixels
   * @param viewportHeight Viewport height in pixels
   * @returns Screen coordinates {x, y} in pixels
   */
  worldToScreen(
    worldX: number,
    worldY: number,
    viewportWidth: number,
    viewportHeight: number,
  ): { x: number; y: number } {
    // Apply camera transform
    const centeredX = (worldX - this._x) * this._zoom;
    const centeredY = (worldY - this._y) * this._zoom;

    // Convert to screen coordinates
    const screenX = centeredX + viewportWidth / 2;
    const screenY = centeredY + viewportHeight / 2;

    return { x: screenX, y: screenY };
  }
}
