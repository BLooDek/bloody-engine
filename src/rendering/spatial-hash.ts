/**
 * Spatial Hash Grid for optimized depth sorting and spatial queries
 *
 * Provides O(1) lookup for objects in a specific grid cell and
 * enables efficient topological sorting for 2.5D isometric rendering.
 *
 * Key benefits:
 * - Fast spatial queries (find objects near position X)
 * - Reduced pairwise comparisons for topological sort
 * - Better performance for large scenes with many objects
 */

import type { SpriteQuadInstance } from "./batch-renderer";

/**
 * Spatial hash cell containing quads in that grid region
 */
interface SpatialCell {
  quads: SpriteQuadInstance[];
}

/**
 * Spatial hash options
 */
export interface SpatialHashOptions {
  /** Cell size in world units (default: 64) */
  cellSize?: number;
  /** Initial capacity hint (default: 1024) */
  initialCapacity?: number;
}

/**
 * Spatial Hash Grid for depth sorting optimization
 *
 * Partitions the world into a grid of cells for fast spatial queries.
 * Each cell contains quads that overlap that region.
 */
export class SpatialHashGrid {
  private cellSize: number;
  private cells: Map<string, SpatialCell> = new Map();
  private quadToCells: Map<SpriteQuadInstance, Set<string>> = new Map();

  /**
   * Create a new spatial hash grid
   * @param options Configuration options
   */
  constructor(options: SpatialHashOptions = {}) {
    this.cellSize = options.cellSize ?? 64;
  }

  /**
   * Convert world position to cell key
   * @private
   */
  private getCellKey(x: number, y: number): string {
    const cellX = Math.floor(x / this.cellSize);
    const cellY = Math.floor(y / this.cellSize);
    return `${cellX},${cellY}`;
  }

  /**
   * Get all cells that a quad overlaps
   * For simplicity, we use the quad's center point
   * TODO: Calculate overlapping cells based on quad width/height
   * @private
   */
  private getQuadCells(quad: SpriteQuadInstance): string[] {
    const x = quad.gridX ?? quad.x;
    const y = quad.gridY ?? quad.y;
    const z = quad.z ?? 0;

    // For now, use a single cell based on position
    // In 2.5D isometric, we consider Z as part of the position
    return [this.getCellKey(x + z, y + z)];
  }

  /**
   * Add a quad to the spatial hash
   * @param quad Quad to add
   */
  insert(quad: SpriteQuadInstance): void {
    const cells = this.getQuadCells(quad);

    // Track which cells this quad belongs to
    this.quadToCells.set(quad, new Set(cells));

    // Add quad to each cell
    for (const cellKey of cells) {
      let cell = this.cells.get(cellKey);
      if (!cell) {
        cell = { quads: [] };
        this.cells.set(cellKey, cell);
      }
      cell.quads.push(quad);
    }
  }

  /**
   * Remove a quad from the spatial hash
   * @param quad Quad to remove
   */
  remove(quad: SpriteQuadInstance): void {
    const cells = this.quadToCells.get(quad);
    if (!cells) return;

    // Remove quad from each cell
    for (const cellKey of cells) {
      const cell = this.cells.get(cellKey);
      if (cell) {
        cell.quads = cell.quads.filter(q => q !== quad);
      }
    }

    // Clean up tracking
    this.quadToCells.delete(quad);
  }

  /**
   * Get all quads in a specific cell
   * @param x World X position
   * @param y World Y position
   * @returns Array of quads in the cell (may be empty)
   */
  getObjectsInCell(x: number, y: number): SpriteQuadInstance[] {
    const cellKey = this.getCellKey(x, y);
    const cell = this.cells.get(cellKey);
    return cell ? [...cell.quads] : [];
  }

  /**
   * Get all quads in cells near a position
   * Returns quads from the same cell and adjacent cells
   * @param x World X position
   * @param y World Y position
   * @returns Array of nearby quads
   */
  getNearbyObjects(x: number, y: number): SpriteQuadInstance[] {
    const nearby = new Set<SpriteQuadInstance>();
    const cellX = Math.floor(x / this.cellSize);
    const cellY = Math.floor(y / this.cellSize);

    // Check 3x3 grid of cells around the position
    for (let dx = -1; dx <= 1; dx++) {
      for (let dy = -1; dy <= 1; dy++) {
        const checkX = cellX + dx;
        const checkY = cellY + dy;
        const cellKey = `${checkX},${checkY}`;
        const cell = this.cells.get(cellKey);
        if (cell) {
          for (const quad of cell.quads) {
            nearby.add(quad);
          }
        }
      }
    }

    return Array.from(nearby);
  }

  /**
   * Get all quads currently in the spatial hash
   * @returns Array of all quads
   */
  getAllObjects(): SpriteQuadInstance[] {
    const all = new Set<SpriteQuadInstance>();
    for (const cell of this.cells.values()) {
      for (const quad of cell.quads) {
        all.add(quad);
      }
    }
    return Array.from(all);
  }

  /**
   * Clear all quads from the spatial hash
   */
  clear(): void {
    this.cells.clear();
    this.quadToCells.clear();
  }

  /**
   * Get the number of cells currently in use
   */
  getCellCount(): number {
    return this.cells.size;
  }

  /**
   * Get statistics about the spatial hash
   */
  getStats(): { totalCells: number; totalQuads: number; avgQuadsPerCell: number } {
    let totalQuads = 0;
    for (const cell of this.cells.values()) {
      totalQuads += cell.quads.length;
    }
    return {
      totalCells: this.cells.size,
      totalQuads,
      avgQuadsPerCell: this.cells.size > 0 ? totalQuads / this.cells.size : 0,
    };
  }
}

/**
 * Represents a depth relationship between two quads for topological sorting
 */
interface DepthRelation {
  /** The quad that should be drawn first (behind) */
  behind: SpriteQuadInstance;
  /** The quad that should be drawn last (in front) */
  front: SpriteQuadInstance;
}

/**
 * Depth sorting with topological sort support
 *
 * Uses spatial hashing to optimize depth comparisons and
 * handles complex overlapping geometry with topological sorting.
 */
export class DepthSorter {
  private spatialHash: SpatialHashGrid;

  constructor(options: SpatialHashOptions = {}) {
    this.spatialHash = new SpatialHashGrid(options);
  }

  /**
   * Calculate sort key for a quad (Painter's Algorithm)
   * @private
   */
  private calculateSortKey(quad: SpriteQuadInstance): number {
    const gridX = quad.gridX ?? quad.x;
    const gridY = quad.gridY ?? quad.y;
    const z = quad.z ?? 0;
    return gridX + gridY + z;
  }

  /**
   * Check if two quads overlap in screen space
   * Uses spatial hashing to quickly determine if detailed comparison is needed
   * @private
   */
  private quadsOverlap(a: SpriteQuadInstance, b: SpriteQuadInstance): boolean {
    // Simple bounding box check
    const aLeft = Math.min(a.x, a.x + a.width);
    const aRight = Math.max(a.x, a.x + a.width);
    const aTop = Math.min(a.y, a.y + a.height);
    const aBottom = Math.max(a.y, a.y + a.height);

    const bLeft = Math.min(b.x, b.x + b.width);
    const bRight = Math.max(b.x, b.x + b.width);
    const bTop = Math.min(b.y, b.y + b.height);
    const bBottom = Math.max(b.y, b.y + b.height);

    // Check if bounding boxes overlap
    return !(aRight < bLeft || aLeft > bRight || aBottom < bTop || aTop > bBottom);
  }

  /**
   * Determine draw order between two overlapping quads
   * Returns true if A should be drawn before B (A is behind B)
   * @private
   */
  private compareDepth(a: SpriteQuadInstance, b: SpriteQuadInstance): boolean {
    // Use spatial hash to get nearby objects for comparison
    const sortKeyA = this.calculateSortKey(a);
    const sortKeyB = this.calculateSortKey(b);

    // Simple case: different depth levels
    if (sortKeyA !== sortKeyB) {
      return sortKeyA < sortKeyB;
    }

    // Complex case: same depth level, need detailed comparison
    // In isometric 2.5D, use Y position as tiebreaker
    const gridYA = a.gridY ?? a.y;
    const gridYB = b.gridY ?? b.y;
    if (gridYA !== gridYB) {
      return gridYA < gridYB;
    }

    // Final tiebreaker: X position
    const gridXA = a.gridX ?? a.x;
    const gridXB = b.gridX ?? b.x;
    return gridXA < gridXB;
  }

  /**
   * Build depth relations for topological sort
   * Only compares quads that are spatially close (using spatial hash)
   * @private
   */
  private buildDepthRelations(quads: SpriteQuadInstance[]): DepthRelation[] {
    const relations: DepthRelation[] = [];

    // Insert all quads into spatial hash
    for (const quad of quads) {
      this.spatialHash.insert(quad);
    }

    // Build relations only between nearby quads
    for (const quad of quads) {
      const x = quad.gridX ?? quad.x;
      const y = quad.gridY ?? quad.y;

      // Get nearby quads using spatial hash
      const nearby = this.spatialHash.getNearbyObjects(x, y);

      for (const other of nearby) {
        if (quad === other) continue;

        // Only build relation if quads overlap
        if (this.quadsOverlap(quad, other)) {
          if (this.compareDepth(quad, other)) {
            relations.push({ behind: quad, front: other });
          }
        }
      }
    }

    // Clean up spatial hash
    this.spatialHash.clear();

    return relations;
  }

  /**
   * Topological sort using Kahn's algorithm
   * Handles complex overlapping geometry
   * @private
   */
  private topologicalSort(quads: SpriteQuadInstance[], relations: DepthRelation[]): SpriteQuadInstance[] {
    // Build adjacency list and in-degree count
    const inDegree = new Map<SpriteQuadInstance, number>();
    const adjacency = new Map<SpriteQuadInstance, SpriteQuadInstance[]>();

    // Initialize
    for (const quad of quads) {
      inDegree.set(quad, 0);
      adjacency.set(quad, []);
    }

    // Build graph from relations
    for (const relation of relations) {
      const behindList = adjacency.get(relation.behind) ?? [];
      behindList.push(relation.front);
      adjacency.set(relation.behind, behindList);

      inDegree.set(relation.front, (inDegree.get(relation.front) ?? 0) + 1);
    }

    // Find all nodes with in-degree 0 (no dependencies)
    const queue: SpriteQuadInstance[] = [];
    for (const [quad, degree] of inDegree) {
      if (degree === 0) {
        queue.push(quad);
      }
    }

    // Process nodes in topological order
    const sorted: SpriteQuadInstance[] = [];
    while (queue.length > 0) {
      const quad = queue.shift()!;
      sorted.push(quad);

      // Reduce in-degree for dependents
      const dependents = adjacency.get(quad) ?? [];
      for (const dependent of dependents) {
        const newDegree = (inDegree.get(dependent) ?? 0) - 1;
        inDegree.set(dependent, newDegree);
        if (newDegree === 0) {
          queue.push(dependent);
        }
      }
    }

    // If we couldn't sort all quads, there's a cycle
    // Fall back to simple sort for remaining quads
    if (sorted.length !== quads.length) {
      const remaining = quads.filter(q => !sorted.includes(q));
      remaining.sort((a, b) => this.calculateSortKey(a) - this.calculateSortKey(b));
      sorted.push(...remaining);
    }

    return sorted;
  }

  /**
   * Sort quads using spatial hashing and topological sort
   * @param quads Quads to sort
   * @returns Sorted quads (back-to-front order)
   */
  sortQuads(quads: SpriteQuadInstance[]): SpriteQuadInstance[] {
    if (quads.length <= 1) {
      return [...quads];
    }

    // Build depth relations using spatial hash optimization
    const relations = this.buildDepthRelations(quads);

    // Use topological sort if we have complex relations
    if (relations.length > 0) {
      return this.topologicalSort(quads, relations);
    }

    // Fall back to simple Painter's Algorithm
    return [...quads].sort((a, b) => this.calculateSortKey(a) - this.calculateSortKey(b));
  }

  /**
   * Get statistics about the last sort operation
   */
  getStats(): { totalCells: number; totalQuads: number; avgQuadsPerCell: number } {
    return this.spatialHash.getStats();
  }

  /**
   * Clear internal state
   */
  clear(): void {
    this.spatialHash.clear();
  }
}
