/**
 * EntityManager - Manages a collection of entities for the simulation
 * Provides CRUD operations and queries for entities
 */

import { Entity } from "./entity";
import type { EntityState } from "./entity";

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
 */
export class EntityManager {
  private entities: Map<string, Entity> = new Map();
  private _nextId: number = 1;

  /**
   * Create a new entity
   * @param type - Entity type identifier
   * @param initialState - Optional initial state
   * @returns The created entity
   */
  createEntity(type: string, initialState?: Partial<EntityState>): Entity {
    const id = `entity_${this._nextId++}`;
    const entity = new Entity(id, type, initialState);
    this.entities.set(id, entity);
    return entity;
  }

  /**
   * Add an existing entity to the manager
   * @param entity - Entity to add
   */
  addEntity(entity: Entity): void {
    if (this.entities.has(entity.id)) {
      throw new Error(`Entity with id ${entity.id} already exists`);
    }
    this.entities.set(entity.id, entity);

    // Update next ID to avoid conflicts
    const idNum = parseInt(entity.id.split("_")[1] || "0");
    if (idNum >= this._nextId) {
      this._nextId = idNum + 1;
    }
  }

  /**
   * Get an entity by ID
   * @param id - Entity ID
   * @returns Entity or undefined if not found
   */
  getEntity(id: string): Entity | undefined {
    return this.entities.get(id);
  }

  /**
   * Remove an entity by ID
   * @param id - Entity ID to remove
   * @returns True if entity was removed, false if not found
   */
  removeEntity(id: string): boolean {
    return this.entities.delete(id);
  }

  /**
   * Check if an entity exists
   * @param id - Entity ID
   */
  hasEntity(id: string): boolean {
    return this.entities.has(id);
  }

  /**
   * Get all entities
   * @returns Array of all entities
   */
  getAllEntities(): Entity[] {
    return Array.from(this.entities.values());
  }

  /**
   * Get entities by type
   * @param type - Entity type to filter by
   * @returns Array of entities of the specified type
   */
  getEntitiesByType(type: string): Entity[] {
    return this.getAllEntities().filter(e => e.type === type);
  }

  /**
   * Query entities based on filter criteria
   * @param query - Query filter
   * @returns Array of matching entities
   */
  queryEntities(query: EntityQuery): Entity[] {
    let results = this.getAllEntities();

    if (query.id) {
      results = results.filter(e => e.id === query.id);
    }

    if (query.type) {
      results = results.filter(e => e.type === query.type);
    }

    if (query.position) {
      const { minX, maxX, minY, maxY, minZ = -Infinity, maxZ = Infinity } = query.position;
      results = results.filter(e => {
        const pos = e.state.gridPos;
        return (
          pos.xgrid >= minX && pos.xgrid <= maxX &&
          pos.ygrid >= minY && pos.ygrid <= maxY &&
          pos.zheight >= minZ && pos.zheight <= maxZ
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
    return this.getAllEntities().filter(e => {
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
    for (const entity of this.entities.values()) {
      entity.saveState();
    }
  }

  /**
   * Clear all entities
   */
  clear(): void {
    this.entities.clear();
    this._nextId = 1;
  }

  /**
   * Get the number of entities
   */
  get count(): number {
    return this.entities.size;
  }

  /**
   * Serialize all entities for transmission/saving
   */
  serializeAll(): string[] {
    const serialized: string[] = [];
    for (const entity of this.entities.values()) {
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
      const entity = Entity.deserialize(item);
      manager.addEntity(entity);
    }
    return manager;
  }

  /**
   * Get statistics about entities
   */
  getStats(): { total: number; byType: Record<string, number> } {
    const byType: Record<string, number> = {};
    for (const entity of this.entities.values()) {
      byType[entity.type] = (byType[entity.type] || 0) + 1;
    }
    return {
      total: this.entities.size,
      byType,
    };
  }
}
