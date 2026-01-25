/**
 * Entity - Simulation state for a game entity
 * Contains only simulation data, no rendering logic
 *
 * REFACTORED: Now acts as a facade over SoA (Structure of Arrays) storage.
 * Maintains full backward compatibility with existing API.
 */

import type { GridCoord } from "../rendering/projection";
import type { EntityHandle } from "./entity-handle";
import type { EntityStorage } from "./entity-storage";

/**
 * Entity state at a specific point in time
 * Used for state interpolation and deterministic replay
 *
 * Position is stored as floats for smooth, continuous movement.
 * Use getGridPos() to get integer grid coordinates when needed.
 */
export interface EntityState {
  gridPos: GridCoord; // Float positions for sub-grid tracking
  velocity: { x: number; y: number; z: number };
  rotation: number;
  speed: number;
  isMoving: boolean;
}

/**
 * Entity - represents a game object in the simulation
 * Entities have a unique ID and maintain their current simulation state
 *
 * REFACTORED: Now a facade over SoA storage. All methods delegate to EntityStorage.
 * Maintains full backward compatibility with existing code.
 */
export class Entity {
  readonly id: string;
  readonly type: string;

  // Internal storage (not exposed in public API)
  private handle: EntityHandle;
  private storage: EntityStorage;

  /**
   * Create an Entity facade over SoA storage
   * @param handle Handle to the entity in SoA storage
   * @param storage The SoA storage instance
   * @deprecated Use EntityManager.createEntity() instead
   * @internal
   */
  constructor(handle: EntityHandle, storage: EntityStorage) {
    this.handle = handle;
    this.storage = storage;
    this.id = storage.getId(handle.index);
    this.type = ""; // Will be set by EntityManager via getTypeRegistry
  }

  /**
   * Get current entity state
   */
  get state(): Readonly<EntityState> {
    return this.storage.getState(this.handle.index);
  }

  /**
   * Get previous entity state (for interpolation)
   */
  get previousState(): Readonly<EntityState> {
    return this.storage.getPreviousState(this.handle.index);
  }

  /**
   * Get position as floats (for smooth movement and rendering)
   * Returns a copy to prevent mutation
   */
  getPosition(): { x: number; y: number; z: number } {
    return this.storage.getPosition(this.handle.index);
  }

  /**
   * Get grid position as integers (for logic that needs discrete cells)
   * Uses Math.floor for consistent cell mapping
   */
  getGridPos(): { x: number; y: number; z: number } {
    const pos = this.storage.getPosition(this.handle.index);
    return {
      x: Math.floor(pos.x),
      y: Math.floor(pos.y),
      z: Math.floor(pos.z),
    };
  }

  /**
   * Get rounded grid position (nearest integer)
   * Uses Math.round for picking/clicking operations
   */
  getRoundedGridPos(): { x: number; y: number; z: number } {
    const pos = this.storage.getPosition(this.handle.index);
    return {
      x: Math.round(pos.x),
      y: Math.round(pos.y),
      z: Math.round(pos.z),
    };
  }

  /**
   * Store current state as previous state before updating
   */
  saveState(): void {
    this.storage.saveState(this.handle.index);
  }

  /**
   * Set grid position directly (instant movement)
   * Accepts floats for sub-grid positioning
   */
  setGridPos(x: number, y: number, z: number = 0): void {
    this.storage.setPosition(this.handle.index, x, y, z);
  }

  /**
   * Set position using integers (for discrete grid movement)
   * Convenience method for logic that works with integer coordinates
   */
  setGridPosInt(x: number, y: number, z: number = 0): void {
    this.storage.setPosition(this.handle.index, x, y, z);
  }

  /**
   * Set velocity for continuous movement
   */
  setVelocity(x: number, y: number, z: number = 0): void {
    this.storage.setVelocity(this.handle.index, x, y, z);
  }

  /**
   * Move by relative amount
   * Accepts floats for smooth, sub-grid movement
   * @param dx Movement in X (can be fractional)
   * @param dy Movement in Y (can be fractional)
   * @param dz Movement in Z (can be fractional)
   */
  move(dx: number, dy: number, dz: number = 0): void {
    this.storage.move(this.handle.index, dx, dy, dz);
  }

  /**
   * Move by integer grid cells (for discrete movement)
   * Convenience method for logic that needs whole-cell movement
   */
  moveGridCells(dx: number, dy: number, dz: number = 0): void {
    this.storage.move(this.handle.index, Math.floor(dx), Math.floor(dy), Math.floor(dz));
  }

  /**
   * Set rotation angle (in radians)
   */
  setRotation(angle: number): void {
    this.storage.setRotation(this.handle.index, angle);
  }

  /**
   * Set movement speed multiplier
   */
  setSpeed(speed: number): void {
    this.storage.setSpeed(this.handle.index, speed);
  }

  /**
   * Update entity based on velocity and delta time
   * Now properly tracks fractional movement for smooth animation
   * Returns true if position changed (by any amount)
   */
  updateVelocity(dt: number): boolean {
    return this.storage.updateVelocity(this.handle.index, dt);
  }

  /**
   * Clone this entity (for state snapshots)
   * NOTE: This creates a new Entity facade pointing to the same storage
   */
  clone(): Entity {
    // For SoA, cloning creates a facade with the same handle
    // To truly clone, you'd need to allocate a new entity and copy state
    // This maintains backward compatibility but may not be a deep clone
    return new Entity(this.handle, this.storage);
  }

  /**
   * Serialize entity state for transmission/saving
   * Preserves floating-point positions for smooth movement
   */
  serialize(): string {
    return JSON.stringify({
      id: this.id,
      type: this.type,
      state: this.storage.getState(this.handle.index),
    });
  }

  /**
   * Deserialize entity from serialized data
   * NOTE: This static method cannot work with SoA storage without a storage instance
   * Use EntityManager.deserializeEntity() instead
   * @deprecated Use EntityManager methods instead
   */
  static deserialize(data: string): Entity {
    throw new Error(
      "Entity.deserialize() is not supported with SoA storage. " +
      "Use EntityManager.deserializeEntity() or EntityManager.addEntity() instead."
    );
  }

  /**
   * Serialize entity state to binary format for efficient network transmission
   * @returns Binary representation of this entity
   */
  async serializeBinary(): Promise<Uint8Array> {
    // Dynamic import to avoid circular dependency
    const { EntitySerializer } = await import("../networking/entity-serializer");
    return EntitySerializer.serializeEntity(this);
  }

  /**
   * Deserialize entity from binary format
   * @param data Binary representation of an entity
   * @returns Deserialized entity
   * @deprecated Use EntityManager.deserializeEntityBinary() instead
   */
  static async deserializeBinary(data: Uint8Array): Promise<Entity> {
    throw new Error(
      "Entity.deserializeBinary() is not supported with SoA storage. " +
      "Use EntityManager.deserializeEntityBinary() instead."
    );
  }

  /**
   * Restore entity state from a provided state object
   * Used for server reconciliation and state restoration
   * @param state The state to restore
   */
  restoreState(state: EntityState): void {
    this.storage.setState(this.handle.index, state);
  }

  /**
   * Get a deep copy of the current entity state
   * Useful for creating snapshots without reference sharing
   */
  getStateCopy(): EntityState {
    return this.storage.getState(this.handle.index);
  }

  /**
   * Get the entity's handle (internal use)
   * @internal
   */
  getHandle(): EntityHandle {
    return this.handle;
  }

  /**
   * Get the entity's storage (internal use)
   * @internal
   */
  getStorage(): EntityStorage {
    return this.storage;
  }
}

/**
 * Legacy Entity constructor for backward compatibility
 * Creates a new Entity instance - but this no longer works with SoA storage
 * @deprecated Use EntityManager.createEntity() instead
 * @internal
 */
export function createLegacyEntity(
  id: string,
  type: string,
  initialState: Partial<EntityState> = {}
): Entity {
  throw new Error(
    "Direct Entity construction is not supported with SoA storage. " +
    "Use EntityManager.createEntity() instead."
  );
}
