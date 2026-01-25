/**
 * EntityStorage - Structure of Arrays (SoA) entity storage
 *
 * Stores entity data in typed arrays for cache efficiency and zero-copy GPU transfers.
 * Uses sparse arrays with free list for efficient entity allocation/deallocation.
 *
 * Memory Layout:
 * - positions[i*3 + 0] = entity_i.position.x
 * - positions[i*3 + 1] = entity_i.position.y
 * - positions[i*3 + 2] = entity_i.position.z
 * - velocities[i*3 + 0] = entity_i.velocity.x
 * - ... etc
 */

import type { EntityHandle } from "./entity-handle";
import type { EntityState } from "./entity";
import type { GridCoord } from "../rendering/projection";

/**
 * Typed array constructor for custom properties
 */
type TypedArrayConstructor = {
  new (length: number): TypedArray;
};

/**
 * Custom property metadata
 */
interface CustomProperty {
  array: TypedArray;
  type: 'Float32Array' | 'Uint32Array' | 'Uint8Array' | 'Int32Array' | 'Float64Array';
}

export class EntityStorage {
  // Entity metadata
  private ids: string[] = [];
  private types: Uint16Array;          // Type IDs
  private active: Uint8Array;           // 1 = active, 0 = deleted
  private generation: Uint32Array;      // For handle validation

  // Current state arrays (interpolation)
  private positions: Float32Array;      // [x0, y0, z0, x1, y1, z1, ...]
  private velocities: Float32Array;     // [vx0, vy0, vz0, ...]
  private rotations: Float32Array;      // [rot0, rot1, ...]
  private speeds: Float32Array;         // [speed0, speed1, ...]
  private isMoving: Uint8Array;         // [moving0, moving1, ...]

  // Previous state arrays (for interpolation)
  private prevPositions: Float32Array;
  private prevVelocities: Float32Array;
  private prevRotations: Float32Array;
  private prevSpeeds: Float32Array;
  private prevIsMoving: Uint8Array;

  // Renderer properties
  private textureIds: Uint32Array;      // Texture atlas indices
  private colors: Float32Array;         // [r0, g0, b0, a0, r1, g1, b1, a1, ...]

  // Custom properties (extensible, opt-in)
  private customProperties: Map<string, CustomProperty> = new Map();

  // Capacity tracking
  private capacity: number;
  private count: number = 0;
  private freeSlots: number[] = [];

  constructor(initialCapacity: number = 1000) {
    this.capacity = initialCapacity;

    // Allocate all typed arrays
    this.types = new Uint16Array(initialCapacity);
    this.active = new Uint8Array(initialCapacity);
    this.generation = new Uint32Array(initialCapacity);

    this.positions = new Float32Array(initialCapacity * 3);
    this.velocities = new Float32Array(initialCapacity * 3);
    this.rotations = new Float32Array(initialCapacity);
    this.speeds = new Float32Array(initialCapacity);
    this.isMoving = new Uint8Array(initialCapacity);

    this.prevPositions = new Float32Array(initialCapacity * 3);
    this.prevVelocities = new Float32Array(initialCapacity * 3);
    this.prevRotations = new Float32Array(initialCapacity);
    this.prevSpeeds = new Float32Array(initialCapacity);
    this.prevIsMoving = new Uint8Array(initialCapacity);

    this.textureIds = new Uint32Array(initialCapacity);
    this.colors = new Float32Array(initialCapacity * 4);
  }

  /**
   * Allocate a new entity slot
   */
  allocate(typeId: number): EntityHandle {
    let index: number;

    // Reuse free slot if available
    if (this.freeSlots.length > 0) {
      index = this.freeSlots.pop()!;
    } else {
      // Expand capacity if needed
      if (this.count >= this.capacity) {
        this.expandCapacity();
      }
      index = this.count;
    }

    // Initialize entity
    this.active[index] = 1;
    this.types[index] = typeId;
    this.generation[index]++;

    // Initialize state to defaults
    this.initDefaultState(index);

    this.count++;
    return { index, generation: this.generation[index] };
  }

  /**
   * Deallocate an entity slot (marks as inactive, adds to free list)
   */
  deallocate(handle: EntityHandle): void {
    // Validate generation first (before checking active status)
    // This catches stale handles even if the slot was reused
    if (this.generation[handle.index] !== handle.generation) {
      throw new Error(`Stale handle: entity at index ${handle.index} has been deallocated`);
    }

    if (!this.active[handle.index]) {
      throw new Error(`Entity at index ${handle.index} is already inactive`);
    }

    // Mark as inactive
    this.active[handle.index] = 0;

    // Add to free list for reuse
    this.freeSlots.push(handle.index);

    this.count--;
  }

  /**
   * Check if a handle is valid
   */
  isValidHandle(handle: EntityHandle): boolean {
    return (
      handle.index >= 0 &&
      handle.index < this.capacity &&
      this.active[handle.index] === 1 &&
      this.generation[handle.index] === handle.generation
    );
  }

  /**
   * Find entity index by ID
   */
  findIndex(id: string): number | undefined {
    return this.ids.findIndex((entityId, idx) =>
      idx < this.count && this.active[idx] && entityId === id
    );
  }

  /**
   * Find entity handle by ID
   */
  find(id: string): EntityHandle | undefined {
    const index = this.findIndex(id);
    if (index === undefined || index === -1) {
      return undefined;
    }
    return { index, generation: this.generation[index] };
  }

  /**
   * Get entity ID by index
   */
  getId(index: number): string {
    this.validateIndex(index);
    return this.ids[index];
  }

  /**
   * Set entity ID
   */
  setId(index: number, id: string): void {
    this.validateIndex(index);
    this.ids[index] = id;
  }

  /**
   * Get entity type ID by index
   */
  getTypeId(index: number): number {
    this.validateIndex(index);
    return this.types[index];
  }

  /**
   * Get position (returns object for compatibility)
   */
  getPosition(index: number): { x: number; y: number; z: number } {
    this.validateIndex(index);
    const i = index * 3;
    return {
      x: this.positions[i],
      y: this.positions[i + 1],
      z: this.positions[i + 2],
    };
  }

  /**
   * Set position
   */
  setPosition(index: number, x: number, y: number, z: number): void {
    this.validateIndex(index);
    const i = index * 3;
    this.positions[i] = x;
    this.positions[i + 1] = y;
    this.positions[i + 2] = z;
  }

  /**
   * Move by relative amount
   */
  move(index: number, dx: number, dy: number, dz: number = 0): void {
    this.validateIndex(index);
    const i = index * 3;
    this.positions[i] += dx;
    this.positions[i + 1] += dy;
    this.positions[i + 2] += dz;
  }

  /**
   * Get velocity
   */
  getVelocity(index: number): { x: number; y: number; z: number } {
    this.validateIndex(index);
    const i = index * 3;
    return {
      x: this.velocities[i],
      y: this.velocities[i + 1],
      z: this.velocities[i + 2],
    };
  }

  /**
   * Set velocity
   */
  setVelocity(index: number, x: number, y: number, z: number = 0): void {
    this.validateIndex(index);
    const i = index * 3;
    this.velocities[i] = x;
    this.velocities[i + 1] = y;
    this.velocities[i + 2] = z;

    // Update isMoving flag
    this.isMoving[index] = (x !== 0 || y !== 0 || z !== 0) ? 1 : 0;
  }

  /**
   * Get rotation
   */
  getRotation(index: number): number {
    this.validateIndex(index);
    return this.rotations[index];
  }

  /**
   * Set rotation
   */
  setRotation(index: number, angle: number): void {
    this.validateIndex(index);
    this.rotations[index] = angle;
  }

  /**
   * Get speed
   */
  getSpeed(index: number): number {
    this.validateIndex(index);
    return this.speeds[index];
  }

  /**
   * Set speed
   */
  setSpeed(index: number, speed: number): void {
    this.validateIndex(index);
    this.speeds[index] = Math.max(0, speed);
  }

  /**
   * Get isMoving flag
   */
  getIsMoving(index: number): boolean {
    this.validateIndex(index);
    return this.isMoving[index] === 1;
  }

  /**
   * Get texture ID
   */
  getTextureId(index: number): number {
    this.validateIndex(index);
    return this.textureIds[index];
  }

  /**
   * Set texture ID
   */
  setTextureId(index: number, textureId: number): void {
    this.validateIndex(index);
    this.textureIds[index] = textureId;
  }

  /**
   * Get color
   */
  getColor(index: number): { r: number; g: number; b: number; a: number } {
    this.validateIndex(index);
    const i = index * 4;
    return {
      r: this.colors[i],
      g: this.colors[i + 1],
      b: this.colors[i + 2],
      a: this.colors[i + 3],
    };
  }

  /**
   * Set color
   */
  setColor(
    index: number,
    r: number,
    g: number,
    b: number,
    a: number = 1
  ): void {
    this.validateIndex(index);
    const i = index * 4;
    this.colors[i] = r;
    this.colors[i + 1] = g;
    this.colors[i + 2] = b;
    this.colors[i + 3] = a;
  }

  /**
   * Get complete entity state
   */
  getState(index: number): EntityState {
    this.validateIndex(index);
    const i = index * 3;
    return {
      gridPos: {
        xgrid: this.positions[i],
        ygrid: this.positions[i + 1],
        zheight: this.positions[i + 2],
      },
      velocity: {
        x: this.velocities[i],
        y: this.velocities[i + 1],
        z: this.velocities[i + 2],
      },
      rotation: this.rotations[index],
      speed: this.speeds[index],
      isMoving: this.isMoving[index] === 1,
    };
  }

  /**
   * Set entity state from partial state object
   */
  setState(index: number, state: Partial<EntityState>): void {
    this.validateIndex(index);

    if (state.gridPos) {
      const i = index * 3;
      this.positions[i] = state.gridPos.xgrid;
      this.positions[i + 1] = state.gridPos.ygrid;
      this.positions[i + 2] = state.gridPos.zheight ?? 0;
    }

    if (state.velocity) {
      const i = index * 3;
      this.velocities[i] = state.velocity.x;
      this.velocities[i + 1] = state.velocity.y;
      this.velocities[i + 2] = state.velocity.z ?? 0;

      this.isMoving[index] =
        (state.velocity.x !== 0 || state.velocity.y !== 0 || state.velocity.z !== 0)
          ? 1
          : 0;
    }

    if (state.rotation !== undefined) {
      this.rotations[index] = state.rotation;
    }

    if (state.speed !== undefined) {
      this.speeds[index] = state.speed;
    }

    if (state.isMoving !== undefined) {
      this.isMoving[index] = state.isMoving ? 1 : 0;
    }
  }

  /**
   * Save current state as previous state (for interpolation)
   */
  saveState(index: number): void {
    this.validateIndex(index);
    const i = index * 3;

    this.prevPositions[i] = this.positions[i];
    this.prevPositions[i + 1] = this.positions[i + 1];
    this.prevPositions[i + 2] = this.positions[i + 2];

    this.prevVelocities[i] = this.velocities[i];
    this.prevVelocities[i + 1] = this.velocities[i + 1];
    this.prevVelocities[i + 2] = this.velocities[i + 2];

    this.prevRotations[index] = this.rotations[index];
    this.prevSpeeds[index] = this.speeds[index];
    this.prevIsMoving[index] = this.isMoving[index];
  }

  /**
   * Save all states (fast batch operation)
   */
  saveAllStates(): void {
    // Fast memcpy of entire arrays
    this.prevPositions.set(this.positions);
    this.prevVelocities.set(this.velocities);
    this.prevRotations.set(this.rotations);
    this.prevSpeeds.set(this.speeds);
    this.prevIsMoving.set(this.isMoving);
  }

  /**
   * Get previous state
   */
  getPreviousState(index: number): EntityState {
    this.validateIndex(index);
    const i = index * 3;
    return {
      gridPos: {
        xgrid: this.prevPositions[i],
        ygrid: this.prevPositions[i + 1],
        zheight: this.prevPositions[i + 2],
      },
      velocity: {
        x: this.prevVelocities[i],
        y: this.prevVelocities[i + 1],
        z: this.prevVelocities[i + 2],
      },
      rotation: this.prevRotations[index],
      speed: this.prevSpeeds[index],
      isMoving: this.prevIsMoving[index] === 1,
    };
  }

  /**
   * Update entity based on velocity and delta time
   */
  updateVelocity(index: number, dt: number): boolean {
    this.validateIndex(index);

    if (this.isMoving[index] === 0) {
      return false;
    }

    const i = index * 3;
    const speed = this.speeds[index];

    const dx = this.velocities[i] * speed * dt;
    const dy = this.velocities[i + 1] * speed * dt;
    const dz = this.velocities[i + 2] * speed * dt;

    this.positions[i] += dx;
    this.positions[i + 1] += dy;
    this.positions[i + 2] += dz;

    return dx !== 0 || dy !== 0 || dz !== 0;
  }

  /**
   * Register a custom property (opt-in extension)
   */
  registerCustomProperty(
    name: string,
    type: TypedArrayConstructor
  ): void {
    if (this.customProperties.has(name)) {
      throw new Error(`Custom property "${name}" already registered`);
    }

    const array = new type(this.capacity);
    const typeStr = array.constructor.name;

    if (
      typeStr !== 'Float32Array' &&
      typeStr !== 'Uint32Array' &&
      typeStr !== 'Uint8Array' &&
      typeStr !== 'Int32Array' &&
      typeStr !== 'Float64Array'
    ) {
      throw new Error(`Unsupported typed array type: ${typeStr}`);
    }

    this.customProperties.set(name, {
      array,
      type: typeStr as CustomProperty['type'],
    });
  }

  /**
   * Set custom property value
   */
  setCustomProperty(index: number, name: string, value: number): void {
    this.validateIndex(index);
    const prop = this.customProperties.get(name);
    if (!prop) {
      throw new Error(`Custom property "${name}" not registered`);
    }
    prop.array[index] = value;
  }

  /**
   * Get custom property value
   */
  getCustomProperty(index: number, name: string): number {
    this.validateIndex(index);
    const prop = this.customProperties.get(name);
    if (!prop) {
      throw new Error(`Custom property "${name}" not registered`);
    }
    return prop.array[index];
  }

  /**
   * Find all handles by type ID
   */
  findHandlesByType(typeId: number): EntityHandle[] {
    const results: EntityHandle[] = [];
    for (let i = 0; i < this.capacity; i++) {
      if (this.active[i] && this.types[i] === typeId) {
        results.push({ index: i, generation: this.generation[i] });
      }
    }
    return results;
  }

  /**
   * Get all active handles
   */
  getAllHandles(): EntityHandle[] {
    const results: EntityHandle[] = [];
    for (let i = 0; i < this.capacity; i++) {
      if (this.active[i]) {
        results.push({ index: i, generation: this.generation[i] });
      }
    }
    return results;
  }

  /**
   * Get direct access to position array (for zero-copy GPU transfer)
   */
  getPositions(): Float32Array {
    return this.positions;
  }

  /**
   * Get direct access to color array (for zero-copy GPU transfer)
   */
  getColors(): Float32Array {
    return this.colors;
  }

  /**
   * Get direct access to texture ID array (for zero-copy GPU transfer)
   */
  getTextureIds(): Uint32Array {
    return this.textureIds;
  }

  /**
   * Get count of active entities
   */
  getCount(): number {
    return this.count;
  }

  /**
   * Get total capacity
   */
  getCapacity(): number {
    return this.capacity;
  }

  /**
   * Validate index is within bounds and active
   */
  private validateIndex(index: number): void {
    if (index < 0 || index >= this.capacity) {
      throw new Error(`Index ${index} out of bounds [0, ${this.capacity})`);
    }
    if (!this.active[index]) {
      throw new Error(`Entity at index ${index} is inactive`);
    }
  }

  /**
   * Initialize default state for an entity
   */
  private initDefaultState(index: number): void {
    const i = index * 3;

    // Position
    this.positions[i] = 0;
    this.positions[i + 1] = 0;
    this.positions[i + 2] = 0;

    // Velocity
    this.velocities[i] = 0;
    this.velocities[i + 1] = 0;
    this.velocities[i + 2] = 0;

    // Other properties
    this.rotations[index] = 0;
    this.speeds[index] = 1.0;
    this.isMoving[index] = 0;

    // Previous state (same as current)
    this.prevPositions[i] = 0;
    this.prevPositions[i + 1] = 0;
    this.prevPositions[i + 2] = 0;

    this.prevVelocities[i] = 0;
    this.prevVelocities[i + 1] = 0;
    this.prevVelocities[i + 2] = 0;

    this.prevRotations[index] = 0;
    this.prevSpeeds[index] = 1.0;
    this.prevIsMoving[index] = 0;

    // Renderer properties
    this.textureIds[index] = 0;

    const colorIndex = index * 4;
    this.colors[colorIndex] = 1; // r
    this.colors[colorIndex + 1] = 1; // g
    this.colors[colorIndex + 2] = 1; // b
    this.colors[colorIndex + 3] = 1; // a
  }

  /**
   * Expand capacity by doubling
   */
  private expandCapacity(): void {
    const newCapacity = this.capacity * 2;

    // Create new arrays
    const newTypes = new Uint16Array(newCapacity);
    const newActive = new Uint8Array(newCapacity);
    const newGeneration = new Uint32Array(newCapacity);

    const newPositions = new Float32Array(newCapacity * 3);
    const newVelocities = new Float32Array(newCapacity * 3);
    const newRotations = new Float32Array(newCapacity);
    const newSpeeds = new Float32Array(newCapacity);
    const newIsMoving = new Uint8Array(newCapacity);

    const newPrevPositions = new Float32Array(newCapacity * 3);
    const newPrevVelocities = new Float32Array(newCapacity * 3);
    const newPrevRotations = new Float32Array(newCapacity);
    const newPrevSpeeds = new Float32Array(newCapacity);
    const newPrevIsMoving = new Uint8Array(newCapacity);

    const newTextureIds = new Uint32Array(newCapacity);
    const newColors = new Float32Array(newCapacity * 4);

    // Copy existing data
    newTypes.set(this.types);
    newActive.set(this.active);
    newGeneration.set(this.generation);

    newPositions.set(this.positions);
    newVelocities.set(this.velocities);
    newRotations.set(this.rotations);
    newSpeeds.set(this.speeds);
    newIsMoving.set(this.isMoving);

    newPrevPositions.set(this.prevPositions);
    newPrevVelocities.set(this.prevVelocities);
    newPrevRotations.set(this.prevRotations);
    newPrevSpeeds.set(this.prevSpeeds);
    newPrevIsMoving.set(this.prevIsMoving);

    newTextureIds.set(this.textureIds);
    newColors.set(this.colors);

    // Replace references
    this.types = newTypes;
    this.active = newActive;
    this.generation = newGeneration;

    this.positions = newPositions;
    this.velocities = newVelocities;
    this.rotations = newRotations;
    this.speeds = newSpeeds;
    this.isMoving = newIsMoving;

    this.prevPositions = newPrevPositions;
    this.prevVelocities = newPrevVelocities;
    this.prevRotations = newPrevRotations;
    this.prevSpeeds = newPrevSpeeds;
    this.prevIsMoving = newPrevIsMoving;

    this.textureIds = newTextureIds;
    this.colors = newColors;

    this.capacity = newCapacity;
  }
}
