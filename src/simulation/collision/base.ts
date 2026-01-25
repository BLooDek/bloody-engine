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
 * Collision response type
 */
export type CollisionResponse = 'BLOCK' | 'BOUNCE' | 'SLIDE' | 'TRIGGER' | 'IGNORE';

/**
 * Collision pair result
 */
export interface CollisionPair {
  entityA: EntityHandle;
  entityB: EntityHandle;
  distance: number;
  /**
   * Collision normal (direction from A to B, normalized)
   */
  normal?: { x: number; y: number };
  /**
   * Penetration depth (how much entities overlap)
   */
  penetration?: number;
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
 * Simulation collision configuration (for SimulationLoop)
 */
export interface SimulationCollisionConfig {
  /**
   * Enable collision detection
   * @default false
   */
  enabled?: boolean;

  /**
   * Collision system type
   * @default 'spatial-hash'
   */
  type?: 'spatial-hash' | 'worker' | 'gpu' | 'hybrid';

  /**
   * Cell size for spatial hashing
   * @default 50
   */
  cellSize?: number;

  /**
   * Default collision response for all entities
   * @default 'BLOCK'
   */
  defaultResponse?: CollisionResponse;

  /**
   * Per-entity-type collision responses
   * Maps entity type ID to response type
   */
  perTypeResponses?: Map<number, CollisionResponse>;

  /**
   * Number of worker threads (for 'worker' type)
   */
  workerCount?: number;

  /**
   * Callback function for TRIGGER response
   * Called when entities with TRIGGER response collide
   */
  onTrigger?: (pair: CollisionPair) => void;
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
