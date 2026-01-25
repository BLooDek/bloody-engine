/**
 * Collision Detection System
 *
 * A flexible, high-performance collision detection system with multiple backends:
 * - Spatial Hashing (CPU): O(n) broad phase for sparse worlds
 * - Worker-based (CPU): Parallel processing for dense worlds
 * - GPU Compute: Massive parallelism for 5000+ entities
 * - Hybrid: Auto-selects optimal method
 *
 * @example
 * ```typescript
 * import { createCollisionSystem, CollisionPresets } from './collision';
 *
 * // Simple usage - auto-select best method
 * const collision = createCollisionSystem();
 *
 * // Or use a preset
 * const collision = createCollisionSystem(CollisionPresets.large);
 *
 * // Or configure manually
 * const collision = createCollisionSystem({
 *   type: 'spatial-hash',
 *   cellSize: 50
 * });
 *
 * // Update every frame
 * collision.update(entities, positions);
 *
 * // Find all collisions
 * const result = await collision.findAllCollisions(entities, positions, radii);
 * console.log(`Found ${result.pairs.length} collisions in ${result.executionTime}ms`);
 *
 * // Query nearby entities
 * const nearby = collision.queryRadius(x, y, radius, entities, positions);
 * ```
 */

// Base types and interfaces
export type {
  BoundingBox,
  Circle,
  CollisionPair,
  CollisionConfig,
  CollisionResult,
  EntityHandle,
  CollisionResponse,
  SimulationCollisionConfig,
} from './base';

export { CollisionSystem } from './base';

// Concrete implementations
export { SpatialHashCollision } from './spatial-hash';
export { WorkerCollision, isWorkerAvailable } from './worker-collision';
export { GPUComputeCollision } from './gpu-compute';
export { HybridCollision } from './hybrid';

// Factory and helpers
export {
  createCollisionSystem,
  getRecommendedSystemType,
  CollisionPresets,
  createCollisionFromPreset,
} from './factory';
