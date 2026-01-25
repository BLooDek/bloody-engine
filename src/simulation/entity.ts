/**
 * Entity - Simulation state for a game entity
 * Contains only simulation data, no rendering logic
 */

import type { GridCoord } from "../rendering/projection";

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
 */
export class Entity {
  readonly id: string;
  readonly type: string;
  private _state: EntityState;
  private _previousState: EntityState;

  constructor(id: string, type: string, initialState: Partial<EntityState> = {}) {
    this.id = id;
    this.type = type;

    // Default initial state
    this._state = {
      gridPos: { xgrid: 0, ygrid: 0, zheight: 0 },
      velocity: { x: 0, y: 0, z: 0 },
      rotation: 0,
      speed: 1.0,
      isMoving: false,
      ...initialState,
    };

    // Initialize previous state as copy of current
    this._previousState = { ...this._state, gridPos: { ...this._state.gridPos } };
  }

  /**
   * Get current entity state
   */
  get state(): Readonly<EntityState> {
    return this._state;
  }

  /**
   * Get previous entity state (for interpolation)
   */
  get previousState(): Readonly<EntityState> {
    return this._previousState;
  }

  /**
   * Get position as floats (for smooth movement and rendering)
   * Returns a copy to prevent mutation
   */
  getPosition(): { x: number; y: number; z: number } {
    return {
      x: this._state.gridPos.xgrid,
      y: this._state.gridPos.ygrid,
      z: this._state.gridPos.zheight,
    };
  }

  /**
   * Get grid position as integers (for logic that needs discrete cells)
   * Uses Math.floor for consistent cell mapping
   */
  getGridPos(): { x: number; y: number; z: number } {
    return {
      x: Math.floor(this._state.gridPos.xgrid),
      y: Math.floor(this._state.gridPos.ygrid),
      z: Math.floor(this._state.gridPos.zheight),
    };
  }

  /**
   * Get rounded grid position (nearest integer)
   * Uses Math.round for picking/clicking operations
   */
  getRoundedGridPos(): { x: number; y: number; z: number } {
    return {
      x: Math.round(this._state.gridPos.xgrid),
      y: Math.round(this._state.gridPos.ygrid),
      z: Math.round(this._state.gridPos.zheight),
    };
  }

  /**
   * Store current state as previous state before updating
   */
  saveState(): void {
    this._previousState = {
      ...this._state,
      gridPos: { ...this._state.gridPos },
      velocity: { ...this._state.velocity },
    };
  }

  /**
   * Set grid position directly (instant movement)
   * Accepts floats for sub-grid positioning
   */
  setGridPos(x: number, y: number, z: number = 0): void {
    this._state.gridPos = { xgrid: x, ygrid: y, zheight: z };
  }

  /**
   * Set position using integers (for discrete grid movement)
   * Convenience method for logic that works with integer coordinates
   */
  setGridPosInt(x: number, y: number, z: number = 0): void {
    this._state.gridPos = { xgrid: x, ygrid: y, zheight: z };
  }

  /**
   * Set velocity for continuous movement
   */
  setVelocity(x: number, y: number, z: number = 0): void {
    this._state.velocity = { x, y, z };
    this._state.isMoving = x !== 0 || y !== 0 || z !== 0;
  }

  /**
   * Move by relative amount
   * Accepts floats for smooth, sub-grid movement
   * @param dx Movement in X (can be fractional)
   * @param dy Movement in Y (can be fractional)
   * @param dz Movement in Z (can be fractional)
   */
  move(dx: number, dy: number, dz: number = 0): void {
    this._state.gridPos.xgrid += dx;
    this._state.gridPos.ygrid += dy;
    this._state.gridPos.zheight += dz;
  }

  /**
   * Move by integer grid cells (for discrete movement)
   * Convenience method for logic that needs whole-cell movement
   */
  moveGridCells(dx: number, dy: number, dz: number = 0): void {
    this._state.gridPos.xgrid += Math.floor(dx);
    this._state.gridPos.ygrid += Math.floor(dy);
    this._state.gridPos.zheight += Math.floor(dz);
  }

  /**
   * Set rotation angle (in radians)
   */
  setRotation(angle: number): void {
    this._state.rotation = angle;
  }

  /**
   * Set movement speed multiplier
   */
  setSpeed(speed: number): void {
    this._state.speed = Math.max(0, speed);
  }

  /**
   * Update entity based on velocity and delta time
   * Now properly tracks fractional movement for smooth animation
   * Returns true if position changed (by any amount)
   */
  updateVelocity(dt: number): boolean {
    if (!this._state.isMoving) {
      return false;
    }

    const dx = this._state.velocity.x * this._state.speed * dt;
    const dy = this._state.velocity.y * this._state.speed * dt;
    const dz = this._state.velocity.z * this._state.speed * dt;

    // Apply movement directly to position (now supports fractional movement)
    this._state.gridPos.xgrid += dx;
    this._state.gridPos.ygrid += dy;
    this._state.gridPos.zheight += dz;

    // Return true if there was any movement
    return dx !== 0 || dy !== 0 || dz !== 0;
  }

  /**
   * Clone this entity (for state snapshots)
   */
  clone(): Entity {
    const cloned = new Entity(this.id, this.type, this._state);
    cloned._previousState = {
      ...this._previousState,
      gridPos: { ...this._previousState.gridPos },
      velocity: { ...this._previousState.velocity },
    };
    return cloned;
  }

  /**
   * Serialize entity state for transmission/saving
   * Preserves floating-point positions for smooth movement
   */
  serialize(): string {
    return JSON.stringify({
      id: this.id,
      type: this.type,
      state: this._state,
    });
  }

  /**
   * Deserialize entity from serialized data
   */
  static deserialize(data: string): Entity {
    const parsed = JSON.parse(data);
    const entity = new Entity(parsed.id, parsed.type, parsed.state);
    return entity;
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
   */
  static async deserializeBinary(data: Uint8Array): Promise<Entity> {
    // Dynamic import to avoid circular dependency
    const { EntitySerializer } = await import("../networking/entity-serializer");
    return EntitySerializer.deserializeEntity(data);
  }

  /**
   * Restore entity state from a provided state object
   * Used for server reconciliation and state restoration
   * @param state The state to restore
   */
  restoreState(state: EntityState): void {
    this._state = {
      ...state,
      gridPos: { ...state.gridPos },
      velocity: { ...state.velocity },
    };
  }

  /**
   * Get a deep copy of the current entity state
   * Useful for creating snapshots without reference sharing
   */
  getStateCopy(): EntityState {
    return {
      ...this._state,
      gridPos: { ...this._state.gridPos },
      velocity: { ...this._state.velocity },
    };
  }
}
