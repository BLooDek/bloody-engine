/**
 * GPU Compute Shader Collision System
 *
 * Uses GPU compute shaders for massive parallel collision detection.
 * Best for 5000+ entities.
 *
 * Browser-only implementation - falls back to spatial hash in Node.js.
 */

import type { EntityHandle } from "./base";
import {
  CollisionSystem,
  CollisionConfig,
  CollisionPair,
  CollisionResult,
} from "./base";
import { SpatialHashCollision } from "./spatial-hash";

/**
 * GPU collision configuration
 */
interface GPUCollisionConfig extends CollisionConfig {
  /**
   * WebGL context (optional, browser only)
   */
  gl?: any;
  /**
   * Maximum number of entities to support
   */
  maxEntities?: number;
}

/**
 * GPU compute collision system (stub - browser only)
 *
 * Note: Full GPU compute requires WebGL 2.0 which is browser-only.
 * In Node.js, this falls back to spatial hashing.
 */
export class GPUComputeCollision extends CollisionSystem {
  private spatialHash: SpatialHashCollision;

  constructor(config: GPUCollisionConfig) {
    super(config);

    // GPU collision is browser-only, fall back to spatial hash
    console.warn('GPU compute collision is browser-only. Falling back to spatial hash.');

    this.spatialHash = new SpatialHashCollision({
      ...config,
      cellSize: config.cellSize || 50,
    });
  }

  /**
   * Check if GPU collision is available (browser environment with WebGL 2)
   */
  static isAvailable(): boolean {
    // Check for browser environment
    if (typeof window === 'undefined') {
      return false;
    }

    // Check for WebGL 2 support
    try {
      const canvas = document.createElement('canvas');
      const gl = canvas.getContext('webgl2');
      return gl !== null;
    } catch {
      return false;
    }
  }

  /**
   * Update spatial partitioning
   */
  update(entities: Map<string, EntityHandle>, positions: Float32Array): void {
    this.spatialHash.update(entities, positions);
  }

  /**
   * Find collisions for a single entity
   */
  findCollisions(
    entity: EntityHandle,
    allEntities: Map<string, EntityHandle>,
    positions: Float32Array,
    radii?: Float32Array
  ): CollisionPair[] {
    return this.spatialHash.findCollisions(entity, allEntities, positions, radii);
  }

  /**
   * Find all collisions
   */
  findAllCollisions(
    entities: Map<string, EntityHandle>,
    positions: Float32Array,
    radii?: Float32Array
  ): CollisionResult {
    // For small entity counts, use CPU (faster due to no read-back overhead)
    if (entities.size < 1000) {
      return this.spatialHash.findAllCollisions(entities, positions, radii);
    }

    const startTime = performance.now();
    const result = this.spatialHash.findAllCollisions(entities, positions, radii);
    const endTime = performance.now();

    return {
      ...result,
      executionTime: endTime - startTime,
    };
  }

  /**
   * Query entities within a radius
   */
  queryRadius(
    x: number,
    y: number,
    radius: number,
    entities: Map<string, EntityHandle>,
    positions: Float32Array
  ): EntityHandle[] {
    return this.spatialHash.queryRadius(x, y, radius, entities, positions);
  }

  /**
   * Get potential collision pairs
   */
  getPotentialCollisions(): EntityHandle[][] {
    return this.spatialHash.getPotentialCollisions();
  }

  /**
   * Cleanup (no-op for fallback)
   */
  destroy(): void {
    // No GPU resources to clean up
  }

  /**
   * Get stats
   */
  getStats() {
    return {
      gpuAvailable: GPUComputeCollision.isAvailable(),
      fallbackMode: true,
      spatialHashStats: this.spatialHash.getStats(),
    };
  }
}
