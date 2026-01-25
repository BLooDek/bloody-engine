/**
 * Hybrid Collision System
 *
 * Automatically selects the best collision detection method based on entity count.
 * Provides the best of all worlds:
 * - Spatial hash for small counts (< 2000)
 * - Workers for medium counts (2000-5000)
 * - GPU for large counts (> 5000)
 */

import type { EntityHandle } from "./base";
import {
  CollisionSystem,
  CollisionConfig,
  CollisionPair,
  CollisionResult,
} from "./base";
import { SpatialHashCollision } from "./spatial-hash";
import { WorkerCollision } from "./worker-collision";
import { GPUComputeCollision } from "./gpu-compute";

/**
 * Hybrid collision configuration
 */
interface HybridCollisionConfig extends CollisionConfig {
  /**
   * Entity count thresholds for switching methods
   */
  thresholds?: {
    spatialToWorker: number;   // Default: 2000
    workerToGPU: number;        // Default: 5000
  };
}

/**
 * Active collision method
 */
type CollisionMethod = 'spatial-hash' | 'worker' | 'gpu';

/**
 * Hybrid collision system that auto-selects the best method
 */
export class HybridCollision extends CollisionSystem {
  private spatialHash: SpatialHashCollision;
  private workerCollision: WorkerCollision | null = null;
  private gpuCollision: GPUComputeCollision | null = null;

  private currentMethod: CollisionMethod = 'spatial-hash';
  private thresholds: {
    spatialToWorker: number;
    workerToGPU: number;
  };

  constructor(config: HybridCollisionConfig) {
    super(config);

    this.thresholds = config.thresholds || {
      spatialToWorker: 2000,
      workerToGPU: 5000,
    };

    // Initialize spatial hash (always available)
    this.spatialHash = new SpatialHashCollision({
      ...config,
      cellSize: config.cellSize || 50,
    });

    // Initialize worker collision
    try {
      this.workerCollision = new WorkerCollision({
        ...config,
        workerCount: config.workerCount || navigator.hardwareConcurrency || 4,
        spatialConfig: {
          cellSize: config.cellSize || 50,
        },
      });
    } catch (error) {
      console.warn('Worker collision not available:', error);
    }

    // Initialize GPU collision
    if (GPUComputeCollision.isAvailable()) {
      try {
        this.gpuCollision = new GPUComputeCollision({
          ...config,
          maxEntities: config.maxDistance ? undefined : 10000,
        });
      } catch (error) {
        console.warn('GPU collision not available:', error);
      }
    }
  }

  /**
   * Select the best collision method based on entity count
   */
  private selectMethod(entityCount: number): CollisionMethod {
    if (entityCount < this.thresholds.spatialToWorker) {
      return 'spatial-hash';
    } else if (entityCount < this.thresholds.workerToGPU) {
      return this.workerCollision ? 'worker' : 'spatial-hash';
    } else {
      return this.gpuCollision ? 'gpu' :
             this.workerCollision ? 'worker' : 'spatial-hash';
    }
  }

  /**
   * Get the active collision system
   */
  private getActiveSystem(): CollisionSystem {
    switch (this.currentMethod) {
      case 'spatial-hash':
        return this.spatialHash;
      case 'worker':
        return this.workerCollision!;
      case 'gpu':
        return this.gpuCollision!;
    }
  }

  /**
   * Update spatial partitioning
   */
  update(entities: Map<string, EntityHandle>, positions: Float32Array): void {
    const newMethod = this.selectMethod(entities.size);
    this.currentMethod = newMethod;

    this.getActiveSystem().update(entities, positions);
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
    return this.getActiveSystem().findCollisions(entity, allEntities, positions, radii);
  }

  /**
   * Find all collisions
   */
  async findAllCollisions(
    entities: Map<string, EntityHandle>,
    positions: Float32Array,
    radii?: Float32Array
  ): Promise<CollisionResult> {
    const system = this.getActiveSystem();
    const result = await system.findAllCollisions(entities, positions, radii);
    result.executionMethod = this.currentMethod;
    return result;
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
    return this.getActiveSystem().queryRadius(x, y, radius, entities, positions);
  }

  /**
   * Get potential collision pairs
   */
  getPotentialCollisions(): EntityHandle[][] {
    return this.getActiveSystem().getPotentialCollisions();
  }

  /**
   * Get statistics about the hybrid system
   */
  getStats() {
    return {
      currentMethod: this.currentMethod,
      thresholds: this.thresholds,
      spatialHashStats: this.spatialHash.getStats(),
      workerStats: this.workerCollision?.getStats(),
      gpuStats: this.gpuCollision?.getStats(),
    };
  }

  /**
   * Destroy all systems
   */
  destroy(): void {
    this.workerCollision?.destroy();
    this.gpuCollision?.destroy();
  }
}
