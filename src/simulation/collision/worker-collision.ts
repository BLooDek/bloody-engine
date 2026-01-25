/**
 * Worker-Based Parallel Collision System
 *
 * Uses Web Workers to parallelize collision detection across multiple CPU threads.
 * Best for dense worlds with 1000-10000 entities.
 *
 * Architecture:
 * - Main thread: Broad phase (spatial partitioning)
 * - Worker threads: Narrow phase (parallel collision checks)
 * - SharedArrayBuffer: Zero-copy data transfer
 *
 * Note: This requires a browser environment or Node.js with worker support.
 */

import type { EntityHandle } from "./base";
import {
  CollisionSystem,
  CollisionConfig,
  CollisionPair,
  CollisionResult,
} from "./base";
import { SpatialHashCollision } from "./spatial-hash";

/**
 * Check if Workers are available in current environment
 */
export function isWorkerAvailable(): boolean {
  return typeof Worker !== 'undefined';
}

/**
 * Worker message types
 */
interface WorkerMessage {
  type: 'init' | 'update' | 'check' | 'result';
  workerId: number;
  pairs?: number[][];  // Array of [indexA, indexB] pairs
  results?: CollisionPair[];
  positions?: Float32Array;
  radii?: Float32Array;
}

/**
 * Worker collision configuration
 */
interface WorkerCollisionConfig extends CollisionConfig {
  workerCount: number;
  spatialConfig?: {
    cellSize: number;
  };
}

/**
 * Worker-based parallel collision system
 */
export class WorkerCollision extends CollisionSystem {
  private workers: Worker[] = [];
  private spatialHash: SpatialHashCollision;
  private workerCount: number;
  private pendingResults: Map<number, CollisionPair[]> = new Map();
  private resolveMap: Map<number, (results: CollisionPair[]) => void> = new Map();
  private workerIdCounter: number = 0;

  constructor(config: WorkerCollisionConfig) {
    super(config);

    if (!isWorkerAvailable()) {
      throw new Error(
        'Worker API is not available in this environment. ' +
        'Worker-based collision requires a browser or Node.js with worker support. ' +
        'Use type: "spatial-hash" instead.'
      );
    }

    this.workerCount = config.workerCount || (typeof navigator !== 'undefined' ? navigator.hardwareConcurrency : 4) || 4;

    // Create spatial hash for broad phase
    this.spatialHash = new SpatialHashCollision({
      ...config,
      cellSize: config.spatialConfig?.cellSize || config.cellSize || 50,
    });

    this.initWorkers();
  }

  /**
   * Initialize worker threads
   */
  private initWorkers(): void {
    const workerCode = this.getWorkerCode();

    for (let i = 0; i < this.workerCount; i++) {
      const blob = new Blob([workerCode], { type: 'application/javascript' });
      const url = URL.createObjectURL(blob);
      const worker = new Worker(url);

      worker.onmessage = (e: MessageEvent<WorkerMessage>) => {
        this.handleWorkerMessage(e.data);
      };

      worker.onerror = (error) => {
        console.error(`Worker ${i} error:`, error);
      };

      this.workers.push(worker);
    }
  }

  /**
   * Get worker code as string
   */
  private getWorkerCode(): string {
    return `
      self.onmessage = function(e: MessageEvent) {
        const message = e.data;

        if (message.type === 'check') {
          const pairs = message.pairs || [];
          const positions = message.positions || new Float32Array();
          const radii = message.radii || new Float32Array();
          const results = [];

          for (const [idxA, idxB] of pairs) {
            const posA = idxA * 3;
            const posB = idxB * 3;

            const xA = positions[posA];
            const yA = positions[posA + 1];
            const radiusA = radii[idxA] || positions[posA + 2];

            const xB = positions[posB];
            const yB = positions[posB + 1];
            const radiusB = radii[idxB] || positions[posB + 2];

            const dx = xA - xB;
            const dy = yA - yB;
            const dist = Math.sqrt(dx * dx + dy * dy);
            const minDist = radiusA + radiusB;

            if (dist < minDist) {
              results.push({
                entityA: { index: idxA, generation: 0 },
                entityB: { index: idxB, generation: 0 },
                distance: dist
              });
            }
          }

          self.postMessage({
            type: 'result',
            workerId: message.workerId,
            results: results
          });
        }
      };
    `;
  }

  /**
   * Handle messages from workers
   */
  private handleWorkerMessage(message: WorkerMessage): void {
    if (message.type === 'result' && message.results) {
      this.pendingResults.set(message.workerId, message.results);

      const resolve = this.resolveMap.get(message.workerId);
      if (resolve) {
        resolve(message.results || []);
        this.resolveMap.delete(message.workerId);
      }
    }
  }

  /**
   * Update spatial partitioning
   */
  update(entities: Map<string, EntityHandle>, positions: Float32Array): void {
    this.spatialHash.update(entities, positions);
  }

  /**
   * Find collisions for a single entity
   * Uses spatial hash (no workers needed for single query)
   */
  findCollisions(
    entity: EntityHandle,
    allEntities: Map<string, EntityHandle>,
    positions: Float32Array,
    radii?: Float32Array
  ): CollisionPair[] {
    return this.spatialHash.findCollisions(entity, allEntities, positions, radii);
  }

  /**
   * Find all collisions using parallel workers
   */
  async findAllCollisions(
    entities: Map<string, EntityHandle>,
    positions: Float32Array,
    radii?: Float32Array
  ): Promise<CollisionResult> {
    const startTime = performance.now();

    // Get potential collision pairs from spatial hash (broad phase)
    const potentialPairs = this.spatialHash.getPotentialCollisions();

    // Split pairs across workers
    const pairsPerWorker = Math.ceil(potentialPairs.length / this.workers.length);
    const promises: Promise<CollisionPair[]>[] = [];

    for (let i = 0; i < this.workers.length; i++) {
      const startIdx = i * pairsPerWorker;
      const endIdx = Math.min(startIdx + pairsPerWorker, potentialPairs.length);

      if (startIdx >= potentialPairs.length) break;

      const workerPairs = potentialPairs.slice(startIdx, endIdx);
      const pairIndices = workerPairs.map(([a, b]) => [a.index, b.index]);

      const promise = new Promise<CollisionPair[]>((resolve) => {
        const workerId = this.workerIdCounter++;
        this.resolveMap.set(workerId, resolve);

        // Build transfer list (only transfer ArrayBuffers that exist)
        const transferList: ArrayBuffer[] = [
          positions.buffer as ArrayBuffer
        ];
        if (radii?.buffer) {
          transferList.push(radii.buffer as ArrayBuffer);
        }

        this.workers[i].postMessage({
          type: 'check',
          workerId,
          pairs: pairIndices,
          positions: positions.buffer,
          radii: radii?.buffer,
        }, transferList);
      });

      promises.push(promise);
    }

    // Wait for all workers to complete
    const allResults = await Promise.all(promises);
    const pairs = allResults.flat();

    const endTime = performance.now();

    return {
      pairs,
      checkedCount: potentialPairs.length,
      executionTime: endTime - startTime,
    };
  }

  /**
   * Query entities within a radius
   * Delegates to spatial hash
   */
  queryRadius(
    x: number,
    y: number,
    radius: number,
    entities: Map<string, EntityHandle>,
    positions: Float32Array
  ): EntityHandle[] {
    return this.spatialHash.queryRadius(x, y, radius, entities, positions);
  }

  /**
   * Get potential collision pairs
   */
  getPotentialCollisions(): EntityHandle[][] {
    return this.spatialHash.getPotentialCollisions();
  }

  /**
   * Terminate all workers
   */
  destroy(): void {
    for (const worker of this.workers) {
      worker.terminate();
    }
    this.workers = [];
    this.pendingResults.clear();
    this.resolveMap.clear();
  }

  /**
   * Get worker statistics
   */
  getStats() {
    return {
      workerCount: this.workers.length,
      spatialHashStats: this.spatialHash.getStats(),
    };
  }
}
