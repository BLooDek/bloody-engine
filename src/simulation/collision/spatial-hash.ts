/**
 * Spatial Hashing Collision System
 *
 * Uses spatial hashing for O(n) broad-phase collision detection.
 * Best for sparse worlds with 1000-5000 entities.
 *
 * Algorithm:
 * 1. Divide world into grid cells
 * 2. Hash each cell coordinate to bucket key
 * 3. Only check collisions within same or adjacent cells
 * 4. Use typed arrays for cache efficiency
 */

import type { EntityHandle } from "./base";
import {
  CollisionSystem,
  CollisionConfig,
  CollisionPair,
  CollisionResult,
  BoundingBox,
} from "./base";

/**
 * Spatial hash cell
 */
interface HashCell {
  entities: EntityHandle[];
  dirty: boolean;
}

/**
 * Spatial hash configuration
 */
interface SpatialHashConfig extends CollisionConfig {
  cellSize: number;
  worldBounds?: {
    minX: number;
    minY: number;
    maxX: number;
    maxY: number;
  };
}

/**
 * Spatial hashing collision system
 */
export class SpatialHashCollision extends CollisionSystem {
  private cellSize: number;
  private buckets: Map<string, HashCell> = new Map();
  private entityCells: Map<number, Set<string>> = new Map();
  private worldBounds?: BoundingBox;
  private cachedPairs: EntityHandle[][] = [];
  private cacheDirty: boolean = true;

  constructor(config: SpatialHashConfig) {
    super(config);
    this.cellSize = config.cellSize;
    this.worldBounds = config.worldBounds;
  }

  /**
   * Convert world position to cell key
   */
  private getCellKey(x: number, y: number): string {
    const cx = Math.floor(x / this.cellSize);
    const cy = Math.floor(y / this.cellSize);
    return `${cx},${cy}`;
  }

  /**
   * Get all cells an entity occupies (handles entities larger than cell size)
   */
  private getEntityCells(x: number, y: number, radius: number): string[] {
    const minX = Math.floor((x - radius) / this.cellSize);
    const maxX = Math.floor((x + radius) / this.cellSize);
    const minY = Math.floor((y - radius) / this.cellSize);
    const maxY = Math.floor((y + radius) / this.cellSize);

    const cells: string[] = [];
    for (let cx = minX; cx <= maxX; cx++) {
      for (let cy = minY; cy <= maxY; cy++) {
        cells.push(`${cx},${cy}`);
      }
    }
    return cells;
  }

  /**
   * Get adjacent cell keys (including diagonal)
   */
  private getAdjacentCells(cellKey: string): string[] {
    const [cx, cy] = cellKey.split(',').map(Number);
    const adjacent: string[] = [];

    for (let dx = -1; dx <= 1; dx++) {
      for (let dy = -1; dy <= 1; dy++) {
        adjacent.push(`${cx + dx},${cy + dy}`);
      }
    }
    return adjacent;
  }

  /**
   * Update spatial hash with new entity positions
   */
  update(entities: Map<string, EntityHandle>, positions: Float32Array): void {
    this.cacheDirty = true;

    // Clear existing entity-to-cell mappings
    this.entityCells.clear();

    // Mark all buckets as not dirty
    for (const cell of this.buckets.values()) {
      cell.dirty = false;
    }

    // Rebuild spatial hash
    for (const [id, handle] of entities) {
      const idx = handle.index * 3;
      const x = positions[idx];
      const y = positions[idx + 1];
      const radius = positions[idx + 2]; // Using Z as radius for now

      const cellKeys = this.getEntityCells(x, y, radius);
      const cellSet = new Set(cellKeys);
      this.entityCells.set(handle.index, cellSet);

      for (const key of cellKeys) {
        let cell = this.buckets.get(key);
        if (!cell) {
          cell = { entities: [], dirty: true };
          this.buckets.set(key, cell);
        }

        // Add entity if not already present
        if (!cell.entities.some(e => e.index === handle.index)) {
          cell.entities.push(handle);
        }
        cell.dirty = true;
      }
    }

    // Remove old entities from non-dirty cells
    for (const [key, cell] of this.buckets) {
      if (!cell.dirty) {
        // This cell wasn't touched, remove it
        this.buckets.delete(key);
      } else {
        // Filter out entities that are no longer in this cell
        cell.entities = cell.entities.filter(handle => {
          const cellSet = this.entityCells.get(handle.index);
          return cellSet?.has(key) ?? false;
        });
      }
    }
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
    const idx = entity.index * 3;
    const x = positions[idx];
    const y = positions[idx + 1];
    const radius = radii ? radii[entity.index] : positions[idx + 2];

    const collisions: CollisionPair[] = [];
    const checked = new Set<number>();

    // Get cells this entity is in
    const cellKeys = this.entityCells.get(entity.index) || new Set();

    // Check all adjacent cells
    for (const key of cellKeys) {
      const cell = this.buckets.get(key);
      if (!cell) continue;

      for (const other of cell.entities) {
        if (other.index === entity.index) continue;
        if (checked.has(other.index)) continue;
        checked.add(other.index);

        // Narrow phase: precise distance check
        const otherIdx = other.index * 3;
        const otherX = positions[otherIdx];
        const otherY = positions[otherIdx + 1];
        const otherRadius = radii ? radii[other.index] : positions[otherIdx + 2];

        const dx = x - otherX;
        const dy = y - otherY;
        const dist = Math.sqrt(dx * dx + dy * dy);
        const minDist = radius + otherRadius;

        if (dist < minDist) {
          collisions.push({
            entityA: entity,
            entityB: other,
            distance: dist,
          });
        }
      }
    }

    return collisions;
  }

  /**
   * Find all collision pairs in the scene
   */
  findAllCollisions(
    entities: Map<string, EntityHandle>,
    positions: Float32Array,
    radii?: Float32Array
  ): CollisionResult {
    const startTime = performance.now();
    const pairs: CollisionPair[] = [];
    const checkedPairs = new Set<string>();

    // Iterate through all cells
    for (const [key, cell] of this.buckets) {
      for (let i = 0; i < cell.entities.length; i++) {
        const entityA = cell.entities[i];
        const idxA = entityA.index * 3;
        const xA = positions[idxA];
        const yA = positions[idxA + 1];
        const radiusA = radii ? radii[entityA.index] : positions[idxA + 2];

        // Check against other entities in same and adjacent cells
        const adjacentKeys = this.getAdjacentCells(key);

        for (const adjKey of adjacentKeys) {
          const adjCell = this.buckets.get(adjKey);
          if (!adjCell) continue;

          for (const entityB of adjCell.entities) {
            // Skip if same entity or already checked
            if (entityB.index <= entityA.index) continue;

            const pairKey = `${entityA.index}-${entityB.index}`;
            if (checkedPairs.has(pairKey)) continue;
            checkedPairs.add(pairKey);

            const idxB = entityB.index * 3;
            const xB = positions[idxB];
            const yB = positions[idxB + 1];
            const radiusB = radii ? radii[entityB.index] : positions[idxB + 2];

            // Quick AABB rejection
            const maxDist = radiusA + radiusB;
            const dx = Math.abs(xA - xB);
            const dy = Math.abs(yA - yB);

            if (dx > maxDist || dy > maxDist) continue;

            // Precise distance check
            const dist = Math.sqrt(dx * dx + dy * dy);
            if (dist < maxDist) {
              pairs.push({
                entityA: entityA,
                entityB: entityB,
                distance: dist,
              });
            }
          }
        }
      }
    }

    const endTime = performance.now();

    return {
      pairs,
      checkedCount: checkedPairs.size,
      executionTime: endTime - startTime,
    };
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
    const results: EntityHandle[] = [];
    const checked = new Set<number>();  // Track entity indices to avoid duplicates
    const cellKeys = this.getEntityCells(x, y, radius);

    for (const key of cellKeys) {
      const cell = this.buckets.get(key);
      if (!cell) continue;

      for (const entity of cell.entities) {
        // Skip if already checked
        if (checked.has(entity.index)) continue;
        checked.add(entity.index);

        const idx = entity.index * 3;
        const ex = positions[idx];
        const ey = positions[idx + 1];

        const dx = x - ex;
        const dy = y - ey;
        const dist = Math.sqrt(dx * dx + dy * dy);

        if (dist <= radius) {
          results.push(entity);
        }
      }
    }

    return results;
  }

  /**
   * Get potential collision pairs (broad phase only)
   * For use with custom narrow phase implementations
   */
  getPotentialCollisions(): EntityHandle[][] {
    if (this.cacheDirty) {
      this.cachedPairs = [];
      const processedPairs = new Set<string>();

      for (const [key, cell] of this.buckets) {
        const adjacentKeys = this.getAdjacentCells(key);

        for (const adjKey of adjacentKeys) {
          const adjCell = this.buckets.get(adjKey);
          if (!adjCell) continue;

          for (const entityA of cell.entities) {
            for (const entityB of adjCell.entities) {
              if (entityB.index <= entityA.index) continue;

              const pairKey = `${entityA.index}-${entityB.index}`;
              if (processedPairs.has(pairKey)) continue;
              processedPairs.add(pairKey);

              this.cachedPairs.push([entityA, entityB]);
            }
          }
        }
      }

      this.cacheDirty = false;
    }

    return this.cachedPairs;
  }

  /**
   * Get statistics about the spatial hash
   */
  getStats() {
    let totalEntities = 0;
    let maxCellSize = 0;
    const uniqueEntities = new Set<number>();

    for (const cell of this.buckets.values()) {
      totalEntities += cell.entities.length;
      maxCellSize = Math.max(maxCellSize, cell.entities.length);

      // Count unique entities
      for (const entity of cell.entities) {
        uniqueEntities.add(entity.index);
      }
    }

    return {
      cellCount: this.buckets.size,
      totalEntities: uniqueEntities.size,  // Unique entity count
      avgEntitiesPerCell: totalEntities / Math.max(1, this.buckets.size),
      maxCellSize,
      memoryEstimate: this.buckets.size * 100, // Rough estimate in bytes
    };
  }

  /**
   * Clear all spatial hash data
   */
  clear(): void {
    this.buckets.clear();
    this.entityCells.clear();
    this.cachedPairs = [];
    this.cacheDirty = true;
  }
}
