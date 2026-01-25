/**
 * Base collision system interface and types
 */

/**
 * Entity handle - lightweight reference to an entity
 * Uses index + generation for validation (like ECS handles)
 */
export interface EntityHandle {
  index: number;
  generation: number;
}

/**
 * Bounding box for collision detection
 */
export interface BoundingBox {
  minX: number;
  minY: number;
  maxX: number;
  maxY: number;
}

/**
 * Circle collision shape
 */
export interface Circle {
  x: number;
  y: number;
  radius: number;
}

/**
 * Collision pair result
 */
export interface CollisionPair {
  entityA: EntityHandle;
  entityB: EntityHandle;
  distance: number;
}

/**
 * Collision system configuration
 */
export interface CollisionConfig {
  /**
   * Type of collision system to use
   * - 'spatial-hash': CPU spatial hashing (good for sparse worlds, 1000-5000 entities)
   * - 'worker': Multi-threaded CPU (good for dense worlds, 1000-10000 entities)
   * - 'gpu': GPU compute shaders (good for massive scale, 5000+ entities)
   * - 'hybrid': Auto-select based on entity count
   */
  type: 'spatial-hash' | 'worker' | 'gpu' | 'hybrid';

  /**
   * Cell size for spatial hashing (in world units)
   * Should be >= max entity radius
   */
  cellSize?: number;

  /**
   * Number of worker threads for CPU parallel processing
   * Defaults to hardware concurrency
   */
  workerCount?: number;

  /**
   * Entity count threshold for switching from CPU to GPU
   * Only used when type is 'hybrid'
   */
  hybridThreshold?: number;

  /**
   * Maximum distance to check for collisions
   * Entities farther apart are ignored
   */
  maxDistance?: number;
}

/**
 * Collision detection result
 */
export interface CollisionResult {
  pairs: CollisionPair[];
  checkedCount: number;
  executionTime: number;
  executionMethod?: 'spatial-hash' | 'worker' | 'gpu';
}

/**
 * Abstract base class for collision systems
 */
export abstract class CollisionSystem {
  protected config: CollisionConfig;

  constructor(config: CollisionConfig) {
    this.config = config;
  }

  /**
   * Update spatial partitioning structure
   * Called after entity positions change
   */
  abstract update(entities: Map<string, EntityHandle>, positions: Float32Array): void;

  /**
   * Find all collision pairs for an entity
   * @returns Array of colliding entities with distances
   */
  abstract findCollisions(
    entity: EntityHandle,
    allEntities: Map<string, EntityHandle>,
    positions: Float32Array,
    radii?: Float32Array
  ): CollisionPair[];

  /**
   * Find all collision pairs in the scene
   * @returns All colliding entity pairs
   */
  abstract findAllCollisions(
    entities: Map<string, EntityHandle>,
    positions: Float32Array,
    radii?: Float32Array
  ): CollisionResult | Promise<CollisionResult>;

  /**
   * Query entities within a radius
   */
  abstract queryRadius(
    x: number,
    y: number,
    radius: number,
    entities: Map<string, EntityHandle>,
    positions: Float32Array
  ): EntityHandle[];

  /**
   * Get collision pair candidates (broad phase)
   * Internal use only
   */
  abstract getPotentialCollisions(): EntityHandle[][];
}
