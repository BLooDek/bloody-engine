/**
 * Generic Object Pool for reducing GC pressure
 *
 * Object pools reduce garbage collection overhead by reusing objects
 * instead of creating new instances. This is especially important for
 * frequently allocated objects like Float32Array matrices.
 *
 * Usage:
 * ```typescript
 * const pool = new ObjectPool(
 *   () => new Float32Array(16),  // factory function
 *   (arr) => arr.fill(0),         // reset function
 *   { initialSize: 100, maxSize: 500 }
 * );
 *
 * const obj = pool.acquire();
 * // ... use obj ...
 * pool.release(obj);
 * ```
 */

/**
 * Configuration for object pool
 */
export interface ObjectPoolConfig {
  /** Number of objects to pre-allocate (default: 10) */
  initialSize?: number;
  /** Maximum pool size (0 = unlimited, default: 1000) */
  maxSize?: number;
}

/**
 * Pool statistics for monitoring and debugging
 */
export interface PoolStats {
  /** Current number of objects in pool (available for acquire) */
  size: number;
  /** Number of objects currently acquired (in use) */
  active: number;
  /** Total number of objects created by this pool */
  totalCreated: number;
  /** Percentage of acquires served from pool vs new allocations */
  hitRate: number;
}

/**
 * Generic object pool for reusing objects
 *
 * @template T The type of object to pool
 */
export class ObjectPool<T> {
  private readonly factory: () => T;
  private readonly reset: (obj: T) => void;
  private readonly maxSize: number;
  private readonly pool: T[] = [];
  private totalCreated: number = 0;
  private totalAcquires: number = 0;
  private totalHits: number = 0;

  /**
   * Create a new object pool
   * @param factory Function to create new objects
   * @param reset Function to reset objects before returning to pool
   * @param config Pool configuration
   */
  constructor(
    factory: () => T,
    reset: (obj: T) => void,
    config: ObjectPoolConfig = {}
  ) {
    this.factory = factory;
    this.reset = reset;
    this.maxSize = config.maxSize ?? 1000;

    // Pre-allocate objects
    const initialSize = config.initialSize ?? 10;
    for (let i = 0; i < initialSize; i++) {
      this.pool.push(this.factory());
      this.totalCreated++;
    }
  }

  /**
   * Acquire an object from the pool
   * Returns a pooled object if available, or creates a new one
   */
  acquire(): T {
    this.totalAcquires++;

    if (this.pool.length > 0) {
      this.totalHits++;
      return this.pool.pop()!;
    }

    // No object available, create new
    this.totalCreated++;
    return this.factory();
  }

  /**
   * Release an object back to the pool
   * The object is reset before being added back to the pool
   * @param obj Object to release (must have been acquired from this pool)
   */
  release(obj: T): void {
    // Reset object state
    this.reset(obj);

    // Add back to pool if under max size
    if (this.maxSize === 0 || this.pool.length < this.maxSize) {
      this.pool.push(obj);
    }
    // If pool is full, object is discarded (will be garbage collected)
  }

  /**
   * Clear all objects from the pool
   * Useful for cleanup or memory reclamation
   */
  clear(): void {
    this.pool.length = 0;
  }

  /**
   * Get pool statistics
   */
  getStats(): PoolStats {
    return {
      size: this.pool.length,
      active: this.totalCreated - this.pool.length,
      totalCreated: this.totalCreated,
      hitRate: this.totalAcquires > 0
        ? (this.totalHits / this.totalAcquires) * 100
        : 0,
    };
  }

  /**
   * Get current pool size (number of available objects)
   */
  get size(): number {
    return this.pool.length;
  }
}
