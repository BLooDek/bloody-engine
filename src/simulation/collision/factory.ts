/**
 * Collision System Factory
 *
 * Factory for creating collision systems with automatic selection based on configuration.
 * Provides a simple API for users to get the optimal collision detection system.
 */

import {
  CollisionSystem,
  CollisionConfig,
} from "./base";
import { SpatialHashCollision } from "./spatial-hash";
import { WorkerCollision, isWorkerAvailable } from "./worker-collision";
import { GPUComputeCollision } from "./gpu-compute";
import { HybridCollision } from "./hybrid";

/**
 * Default collision configuration
 */
const DEFAULT_CONFIG: CollisionConfig = {
  type: 'hybrid',
  cellSize: 50,
  workerCount: navigator.hardwareConcurrency || 4,
  hybridThreshold: 5000,
  maxDistance: 1000,
};

/**
 * Create a collision system based on configuration
 *
 * @param config - Collision system configuration
 * @returns Configured collision system instance
 *
 * @example
 * ```typescript
 * // Auto-select based on entity count (recommended)
 * const collision = createCollisionSystem({ type: 'hybrid' });
 *
 * // Force spatial hashing (good for sparse worlds)
 * const collision = createCollisionSystem({
 *   type: 'spatial-hash',
 *   cellSize: 50
 * });
 *
 * // Force worker-based (good for dense worlds)
 * const collision = createCollisionSystem({
 *   type: 'worker',
 *   workerCount: 8
 * });
 *
 * // Force GPU (good for massive scale)
 * const collision = createCollisionSystem({
 *   type: 'gpu',
 *   maxDistance: 100
 * });
 * ```
 */
export function createCollisionSystem(
  config: Partial<CollisionConfig> = {}
): CollisionSystem {
  const fullConfig = { ...DEFAULT_CONFIG, ...config };

  switch (fullConfig.type) {
    case 'spatial-hash':
      return new SpatialHashCollision({
        ...fullConfig,
        cellSize: fullConfig.cellSize || 50,
      });

    case 'worker': {
      if (!isWorkerAvailable()) {
        console.warn('Worker API not available, falling back to spatial-hash');
        return new SpatialHashCollision({
          ...fullConfig,
          cellSize: fullConfig.cellSize || 50,
        });
      }
      return new WorkerCollision({
        ...fullConfig,
        workerCount: fullConfig.workerCount || (typeof navigator !== 'undefined' ? navigator.hardwareConcurrency : 4) || 4,
        spatialConfig: {
          cellSize: fullConfig.cellSize || 50,
        },
      });
    }

    case 'gpu':
      if (!GPUComputeCollision.isAvailable()) {
        console.warn('GPU collision not available, falling back to hybrid');
        return new HybridCollision(fullConfig);
      }
      return new GPUComputeCollision({
        ...fullConfig,
        maxEntities: fullConfig.maxDistance ? undefined : 10000,
      });

    case 'hybrid':
    default:
      return new HybridCollision(fullConfig);
  }
}

/**
 * Get recommended collision system type based on expected entity count
 *
 * @param entityCount - Expected number of entities
 * @param worldSize - Size of the game world (width/height)
 * @returns Recommended collision system type
 *
 * @example
 * ```typescript
 * const type = getRecommendedSystemType(5000, 10000);
 * console.log(type); // 'gpu'
 *
 * const collision = createCollisionSystem({ type });
 * ```
 */
export function getRecommendedSystemType(
  entityCount: number,
  worldSize: number = 1000
): CollisionConfig['type'] {
  const density = entityCount / (worldSize * worldSize);

  // Sparse world - spatial hash is fastest
  if (entityCount < 2000 || density < 0.001) {
    return 'spatial-hash';
  }

  // Medium scale - workers are good
  if (entityCount < 5000) {
    return 'worker';
  }

  // Large scale - GPU for massive parallelism
  if (entityCount >= 5000 && GPUComputeCollision.isAvailable()) {
    return 'gpu';
  }

  // Fallback
  return 'hybrid';
}

/**
 * Collision system presets for common scenarios
 */
export const CollisionPresets = {
  /**
   * Small game (e.g., puzzle game, < 100 entities)
   */
  small: {
    type: 'spatial-hash' as const,
    cellSize: 32,
  },

  /**
   * Medium game (e.g., strategy game, 100-2000 entities)
   */
  medium: {
    type: 'spatial-hash' as const,
    cellSize: 50,
  },

  /**
   * Large game (e.g., RTS, 2000-5000 entities)
   */
  large: {
    type: 'worker' as const,
    workerCount: 4,
    cellSize: 64,
  },

  /**
   * Massive game (e.g., particle system, 5000+ entities)
   */
  massive: {
    type: 'gpu' as const,
    cellSize: 100,
  },

  /**
   * Auto (hybrid - recommended for most games)
   */
  auto: {
    type: 'hybrid' as const,
  },
} as const;

/**
 * Create collision system from preset
 *
 * @example
 * ```typescript
 * const collision = createCollisionFromPreset('large');
 * ```
 */
export function createCollisionFromPreset(
  preset: keyof typeof CollisionPresets
): CollisionSystem {
  return createCollisionSystem(CollisionPresets[preset]);
}
