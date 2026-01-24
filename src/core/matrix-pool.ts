/**
 * Matrix4 Pool for reducing Float32Array allocations
 *
 * Provides a specialized pool for 16-element Float32Array matrices
 * with convenience methods for common matrix operations.
 *
 * The global pool is automatically initialized and used by default.
 * Advanced users can create custom pools for specific scenarios.
 *
 * Usage (default global pool):
 * ```typescript
 * import { getGlobalPool } from 'bloody-engine';
 * const pool = getGlobalPool();
 * const identity = pool.acquireIdentity();
 * // ... use matrix ...
 * pool.releaseMatrix(identity);
 * ```
 *
 * Usage (custom pool):
 * ```typescript
 * import { Matrix4Pool, setGlobalPool } from 'bloody-engine';
 * const customPool = new Matrix4Pool({ initialSize: 500, maxSize: 5000 });
 * setGlobalPool(customPool);
 * ```
 */

import { ObjectPool, type ObjectPoolConfig, type PoolStats } from './object-pool.js';

/**
 * Configuration for Matrix4 pool
 */
export interface Matrix4PoolConfig {
  /** Number of matrices to pre-allocate (default: 100) */
  initialSize?: number;
  /** Maximum pool size (0 = unlimited, default: 500) */
  maxSize?: number;
}

/**
 * Global matrix pool (lazy initialized)
 */
let globalPool: Matrix4Pool | null = null;

/**
 * Get the global matrix pool
 * Creates a default pool on first call
 */
export function getGlobalPool(): Matrix4Pool {
  if (!globalPool) {
    globalPool = new Matrix4Pool({ initialSize: 100, maxSize: 500 });
  }
  return globalPool;
}

/**
 * Set a custom global pool
 * Use this to override the default pool with a custom configuration
 */
export function setGlobalPool(pool: Matrix4Pool): void {
  globalPool = pool;
}

/**
 * Reset the global pool
 * Clears and recreates the global pool with default settings
 */
export function resetGlobalPool(): void {
  globalPool = null;
}

/**
 * Specialized pool for 4x4 matrices (Float32Array with 16 elements)
 */
export class Matrix4Pool {
  private readonly pool: ObjectPool<Float32Array>;

  /**
   * Create a new matrix pool
   * @param config Pool configuration
   */
  constructor(config: Matrix4PoolConfig = {}) {
    // Explicitly type factory and reset for better type compatibility
    const factory: () => Float32Array = () => new Float32Array(16);
    const reset: (arr: Float32Array) => void = (arr) => arr.fill(0);

    this.pool = new ObjectPool<Float32Array>(
      factory,
      reset,
      {
        initialSize: config.initialSize ?? 100,
        maxSize: config.maxSize ?? 500,
      }
    );
  }

  /**
   * Acquire a matrix from the pool
   * Returns a zero-initialized Float32Array with 16 elements
   */
  acquireMatrix(): Float32Array {
    return this.pool.acquire();
  }

  /**
   * Release a matrix back to the pool
   * @param matrix Matrix to release (must be a 16-element Float32Array)
   */
  releaseMatrix(matrix: Float32Array): void {
    this.pool.release(matrix);
  }

  /**
   * Acquire an identity matrix from the pool
   * Matrix is pre-initialized to identity:
   * [1,0,0,0, 0,1,0,0, 0,0,1,0, 0,0,0,1]
   */
  acquireIdentity(): Float32Array {
    const matrix = this.pool.acquire();
    matrix[0] = 1;
    matrix[1] = 0;
    matrix[2] = 0;
    matrix[3] = 0;
    matrix[4] = 0;
    matrix[5] = 1;
    matrix[6] = 0;
    matrix[7] = 0;
    matrix[8] = 0;
    matrix[9] = 0;
    matrix[10] = 1;
    matrix[11] = 0;
    matrix[12] = 0;
    matrix[13] = 0;
    matrix[14] = 0;
    matrix[15] = 1;
    return matrix;
  }

  /**
   * Acquire a translation matrix from the pool
   * @param x Translation along X axis
   * @param y Translation along Y axis
   * @param z Translation along Z axis (default 0)
   */
  acquireTranslation(x: number, y: number, z: number = 0): Float32Array {
    const matrix = this.pool.acquire();
    matrix[0] = 1;
    matrix[1] = 0;
    matrix[2] = 0;
    matrix[3] = 0;
    matrix[4] = 0;
    matrix[5] = 1;
    matrix[6] = 0;
    matrix[7] = 0;
    matrix[8] = 0;
    matrix[9] = 0;
    matrix[10] = 1;
    matrix[11] = 0;
    matrix[12] = x;
    matrix[13] = y;
    matrix[14] = z;
    matrix[15] = 1;
    return matrix;
  }

  /**
   * Acquire a scale matrix from the pool
   * @param x Scale factor along X axis
   * @param y Scale factor along Y axis
   * @param z Scale factor along Z axis (default 1)
   */
  acquireScale(x: number, y: number, z: number = 1): Float32Array {
    const matrix = this.pool.acquire();
    matrix[0] = x;
    matrix[1] = 0;
    matrix[2] = 0;
    matrix[3] = 0;
    matrix[4] = 0;
    matrix[5] = y;
    matrix[6] = 0;
    matrix[7] = 0;
    matrix[8] = 0;
    matrix[9] = 0;
    matrix[10] = z;
    matrix[11] = 0;
    matrix[12] = 0;
    matrix[13] = 0;
    matrix[14] = 0;
    matrix[15] = 1;
    return matrix;
  }

  /**
   * Clear all matrices from the pool
   */
  clear(): void {
    this.pool.clear();
  }

  /**
   * Get pool statistics
   */
  getStats(): PoolStats {
    return this.pool.getStats();
  }

  /**
   * Get current pool size
   */
  get size(): number {
    return this.pool.size;
  }
}
