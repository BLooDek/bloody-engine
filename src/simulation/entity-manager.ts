/**
 * EntityManager - Manages a collection of entities for the simulation
 * Provides CRUD operations and queries for entities
 *
 * REFACTORED: Now uses SoA (Structure of Arrays) storage internally.
 * Maintains full backward compatibility with existing API.
 */

import { Entity } from "./entity";
import type { EntityState } from "./entity";
import { EntityStorage } from "./entity-storage";
import { EntityTypeRegistry } from "./entity-type-registry";
import type { EntityHandle } from "./entity-handle";

// Typed array constructor for custom properties
type TypedArrayConstructor =
  | Float32ArrayConstructor
  | Uint32ArrayConstructor
  | Uint8ArrayConstructor
  | Int32ArrayConstructor
  | Float64ArrayConstructor;

/**
 * Query filter for entity searches
 */
export interface EntityQuery {
  id?: string;
  type?: string;
  position?: { minX: number; maxX: number; minY: number; maxY: number; minZ?: number; maxZ?: number };
}

/**
 * EntityManager - manages the simulation's entity collection
 * Zero rendering code - pure simulation logic only
 *
 * REFACTORED: Uses SoA storage internally for performance.
 */
export class EntityManager {
  private soaStorage: EntityStorage;
  private typeRegistry: EntityTypeRegistry;
  private _nextId: number = 1;

  constructor() {
    this.soaStorage = new EntityStorage(1000);
    this.typeRegistry = new EntityTypeRegistry();
  }

  /**
   * Create a new entity
   * @param type - Entity type identifier
   * @param initialState - Optional initial state
   * @returns The created entity
   */
  createEntity(type: string, initialState?: Partial<EntityState>): Entity {
    const id = `entity_${this._nextId++}`;
    const typeId = this.typeRegistry.registerType(type);

    // Allocate entity in SoA storage
    const handle = this.soaStorage.allocate(typeId);

    // Set the ID
    this.soaStorage.setId(handle.index, id);

    // Set initial state if provided
    if (initialState) {
      this.soaStorage.setState(handle.index, initialState);
    }

    // Return Entity facade
    const entity = new Entity(handle, this.soaStorage);
    (entity as any).type = type; // Set type property directly
    return entity;
  }

  /**
   * Add an existing entity to the manager
   * @param entity - Entity to add
   * NOTE: This method has limited functionality with SoA storage
   * since entities are managed by the storage system
   */
  addEntity(entity: Entity): void {
    const handle = (entity as any).handle;
    const storage = (entity as any).storage;

    // Check if entity already exists
    if (this.soaStorage.find(entity.id)) {
      throw new Error(`Entity with id ${entity.id} already exists`);
    }

    // For now, we'll create a new entity with the same state
    // In the future, we could support merging storage systems
    const state = entity.getStateCopy();
    const typeId = this.typeRegistry.registerType(entity.type);

    const newHandle = this.soaStorage.allocate(typeId);
    this.soaStorage.setId(newHandle.index, entity.id);
    this.soaStorage.setState(newHandle.index, state);
  }

  /**
   * Get an entity by ID
   * @param id - Entity ID
   * @returns Entity or undefined if not found
   */
  getEntity(id: string): Entity | undefined {
    const handle = this.soaStorage.find(id);
    if (!handle) {
      return undefined;
    }

    const entity = new Entity(handle, this.soaStorage);
    const typeId = this.soaStorage.getTypeId(handle.index);
    (entity as any).type = this.typeRegistry.getTypeName(typeId);
    return entity;
  }

  /**
   * Remove an entity by ID
   * @param id - Entity ID to remove
   * @returns True if entity was removed, false if not found
   */
  removeEntity(id: string): boolean {
    const handle = this.soaStorage.find(id);
    if (!handle) {
      return false;
    }

    this.soaStorage.deallocate(handle);
    return true;
  }

  /**
   * Check if an entity exists
   * @param id - Entity ID
   */
  hasEntity(id: string): boolean {
    const handle = this.soaStorage.find(id);
    return handle !== undefined;
  }

  /**
   * Get all entities
   * @returns Array of all entities
   */
  getAllEntities(): Entity[] {
    const handles = this.soaStorage.getAllHandles();
    return handles.map((handle) => {
      const entity = new Entity(handle, this.soaStorage);
      const typeId = this.soaStorage.getTypeId(handle.index);
      (entity as any).type = this.typeRegistry.getTypeName(typeId);
      return entity;
    });
  }

  /**
   * Get entities by type
   * @param type - Entity type to filter by
   * @returns Array of entities of the specified type
   */
  getEntitiesByType(type: string): Entity[] {
    const typeId = this.typeRegistry.getTypeId(type);
    if (typeId === undefined) {
      return [];
    }

    const handles = this.soaStorage.findHandlesByType(typeId);
    return handles.map((handle) => {
      const entity = new Entity(handle, this.soaStorage);
      (entity as any).type = type;
      return entity;
    });
  }

  /**
   * Query entities based on filter criteria
   * @param query - Query filter
   * @returns Array of matching entities
   */
  queryEntities(query: EntityQuery): Entity[] {
    let results = this.getAllEntities();

    if (query.id) {
      results = results.filter((e) => e.id === query.id);
    }

    if (query.type) {
      results = results.filter((e) => e.type === query.type);
    }

    if (query.position) {
      const {
        minX,
        maxX,
        minY,
        maxY,
        minZ = -Infinity,
        maxZ = Infinity,
      } = query.position;
      results = results.filter((e) => {
        const pos = e.state.gridPos;
        return (
          pos.xgrid >= minX &&
          pos.xgrid <= maxX &&
          pos.ygrid >= minY &&
          pos.ygrid <= maxY &&
          pos.zheight >= minZ &&
          pos.zheight <= maxZ
        );
      });
    }

    return results;
  }

  /**
   * Get entities within a certain range of a position
   * @param x - Center X coordinate
   * @param y - Center Y coordinate
   * @param range - Range radius (in grid units)
   * @returns Array of entities within range
   */
  getEntitiesInRange(x: number, y: number, range: number): Entity[] {
    return this.getAllEntities().filter((e) => {
      const dx = e.state.gridPos.xgrid - x;
      const dy = e.state.gridPos.ygrid - y;
      const distance = Math.sqrt(dx * dx + dy * dy);
      return distance <= range;
    });
  }

  /**
   * Save state for all entities (call before update)
   * This stores current state as previous state for interpolation
   */
  saveAllStates(): void {
    // Fast batch operation in SoA storage
    this.soaStorage.saveAllStates();
  }

  /**
   * Clear all entities
   */
  clear(): void {
    // Create new storage to reset everything
    this.soaStorage = new EntityStorage(1000);
    this._nextId = 1;
  }

  /**
   * Get the number of entities
   */
  get count(): number {
    return this.soaStorage.getCount();
  }

  /**
   * Serialize all entities for transmission/saving
   */
  serializeAll(): string[] {
    const serialized: string[] = [];
    for (const entity of this.getAllEntities()) {
      serialized.push(entity.serialize());
    }
    return serialized;
  }

  /**
   * Deserialize and add entities from serialized data
   */
  static deserializeAll(data: string[]): EntityManager {
    const manager = new EntityManager();
    for (const item of data) {
      const parsed = JSON.parse(item);
      // Create entity with the deserialized state
      manager.createEntity(parsed.type, parsed.state);
      // Override ID to match serialized ID
      const entity = manager.getEntity(parsed.id);
      if (entity) {
        const handle = (entity as any).handle;
        manager['soaStorage'].setId(handle.index, parsed.id);
      }
    }
    return manager;
  }

  /**
   * Serialize all entities to binary format for efficient network transmission
   * @returns Binary representation of all entities
   */
  async serializeAllBinary(): Promise<Uint8Array> {
    // Dynamic import to avoid circular dependency
    const { EntitySerializer } = await import("../networking/entity-serializer");
    const entities = this.getAllEntities();
    return EntitySerializer.serializeEntities(entities);
  }

  /**
   * Deserialize and add entities from binary format
   * @param data Binary representation of entities
   * @returns New EntityManager with deserialized entities
   */
  static async deserializeAllBinary(
    data: Uint8Array
  ): Promise<EntityManager> {
    // Dynamic import to avoid circular dependency
    const { EntitySerializer } = await import("../networking/entity-serializer");
    const entityDataArray = await EntitySerializer.deserializeEntityData(data);

    const manager = new EntityManager();

    for (const { id, type, state } of entityDataArray) {
      // Create entity with the deserialized state
      const typeId = manager.typeRegistry.registerType(type);
      const handle = manager.soaStorage.allocate(typeId);

      // Set ID and state
      manager.soaStorage.setId(handle.index, id);
      manager.soaStorage.setState(handle.index, state);
    }

    return manager;
  }

  /**
   * Deserialize a single entity from binary format
   * Wraps single-entity data in multi-entity format for deserialization
   * @param data Binary representation of a single entity
   * @returns New EntityManager with the deserialized entity
   */
  static async deserializeEntityBinary(
    data: Uint8Array
  ): Promise<EntityManager> {
    // Wrap single-entity data in multi-entity format
    const { BinarySerializer } = await import("../networking/binary-serializer");

    const wrapper = new BinarySerializer();
    wrapper.writeUint16(1); // count = 1
    wrapper.writeBytes(data);

    return this.deserializeAllBinary(wrapper.toBuffer());
  }

  /**
   * Restore entity states from a snapshot map
   * Used for server reconciliation
   * @param snapshot Map of entity ID to state
   */
  restoreSnapshot(
    snapshot: Map<string, import("./entity").EntityState>
  ): void {
    for (const [id, state] of snapshot.entries()) {
      const handle = this.soaStorage.find(id);
      if (handle) {
        this.soaStorage.setState(handle.index, state);
      }
    }
  }

  /**
   * Get statistics about entities
   */
  getStats(): { total: number; byType: Record<string, number> } {
    const byType: Record<string, number> = {};
    for (const entity of this.getAllEntities()) {
      byType[entity.type] = (byType[entity.type] || 0) + 1;
    }
    return {
      total: this.count,
      byType,
    };
  }

  /**
   * Register a custom property for all entities (opt-in extension)
   * This allows developers to add game-specific properties stored in typed arrays
   * @param name - Name of the custom property
   * @param type - Typed array constructor (Float32Array, Uint32Array, etc.)
   */
  registerCustomProperty(
    name: string,
    type:
      | typeof Float32Array
      | typeof Uint32Array
      | typeof Uint8Array
      | typeof Int32Array
      | typeof Float64Array
  ): void {
    this.soaStorage.registerCustomProperty(name, type);
  }

  /**
   * Get direct access to SoA storage (advanced use)
   * Enables zero-copy GPU transfers and high-performance operations
   * @internal
   */
  getStorage(): EntityStorage {
    return this.soaStorage;
  }

  /**
   * Get type registry (advanced use)
   * @internal
   */
  getTypeRegistry(): EntityTypeRegistry {
    return this.typeRegistry;
  }
}
