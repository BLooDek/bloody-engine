/**
 * SnapshotManager - Circular buffer for entity state snapshots
 *
 * Manages a rolling history of entity state snapshots for:
 * - Client-side prediction and rollback
 * - Server reconciliation
 * - Network interpolation
 * - Debug recording
 *
 * Uses a circular buffer to bound memory usage while maintaining
 * sufficient history for reconciliation.
 */

import type { Entity } from "../simulation/entity";
import type { EntityState } from "../simulation/entity";
import type { SnapshotConfig } from "./network-types";
import { StateSnapshot, type SnapshotOptions } from "./state-snapshot";

/**
 * Default snapshot configuration
 */
const DEFAULT_SNAPSHOT_CONFIG: SnapshotConfig = {
  maxSnapshots: 60,         // ~3 seconds at 20 ticks/sec
  snapshotInterval: 1,      // Snapshot every tick
  compressionEnabled: false,
};

/**
 * Circular buffer implementation for snapshots
 */
class CircularBuffer<T> {
  private buffer: (T | undefined)[];
  private capacity: number;
  private head: number = 0;    // Index of oldest element
  private tail: number = 0;    // Index where next element goes
  private size: number = 0;    // Current number of elements

  constructor(capacity: number) {
    this.capacity = capacity;
    this.buffer = new Array(capacity).fill(undefined);
  }

  /**
   * Add an element to the buffer
   */
  push(item: T): void {
    this.buffer[this.tail] = item;
    this.tail = (this.tail + 1) % this.capacity;

    if (this.size < this.capacity) {
      this.size++;
    } else {
      // Buffer is full, head moves forward
      this.head = (this.head + 1) % this.capacity;
    }
  }

  /**
   * Get element by index (0 = oldest, size-1 = newest)
   */
  get(index: number): T | undefined {
    if (index < 0 || index >= this.size) {
      return undefined;
    }
    const actualIndex = (this.head + index) % this.capacity;
    return this.buffer[actualIndex];
  }

  /**
   * Get the newest element
   */
  getNewest(): T | undefined {
    if (this.size === 0) {
      return undefined;
    }
    const newestIndex = (this.tail - 1 + this.capacity) % this.capacity;
    return this.buffer[newestIndex];
  }

  /**
   * Get the oldest element
   */
  getOldest(): T | undefined {
    if (this.size === 0) {
      return undefined;
    }
    return this.buffer[this.head];
  }

  /**
   * Get all elements in order (oldest to newest)
   */
  getAll(): T[] {
    const result: T[] = [];
    for (let i = 0; i < this.size; i++) {
      const item = this.get(i);
      if (item !== undefined) {
        result.push(item);
      }
    }
    return result;
  }

  /**
   * Clear the buffer
   */
  clear(): void {
    this.buffer.fill(undefined);
    this.head = 0;
    this.tail = 0;
    this.size = 0;
  }

  /**
   * Get current number of elements
   */
  getSize(): number {
    return this.size;
  }

  /**
   * Get buffer capacity
   */
  getCapacity(): number {
    return this.capacity;
  }

  /**
   * Check if buffer is empty
   */
  isEmpty(): boolean {
    return this.size === 0;
  }

  /**
   * Check if buffer is full
   */
  isFull(): boolean {
    return this.size === this.capacity;
  }
}

/**
 * SnapshotManager - Manages rolling snapshots using circular buffer
 */
export class SnapshotManager {
  private buffer: CircularBuffer<StateSnapshot>;
  private tickIndex: Map<number, number>; // tick -> buffer index
  private config: SnapshotConfig;
  private ticksSinceLastSnapshot: number = 0;
  private newestTick: number = -1;
  private oldestTick: number = -1;

  constructor(config: Partial<SnapshotConfig> = {}) {
    this.config = { ...DEFAULT_SNAPSHOT_CONFIG, ...config };
    this.buffer = new CircularBuffer(this.config.maxSnapshots);
    this.tickIndex = new Map();
  }

  /**
   * Save a snapshot for the current tick
   * Only saves if snapshotInterval ticks have passed since last snapshot
   */
  saveSnapshot(tick: number, entities: Entity[], options?: SnapshotOptions): void {
    this.ticksSinceLastSnapshot++;

    // Check if we should save based on interval
    if (this.ticksSinceLastSnapshot < this.config.snapshotInterval) {
      return;
    }

    this.ticksSinceLastSnapshot = 0;

    // Create snapshot
    const snapshot = StateSnapshot.fromEntities(tick, entities, options);

    // Add to buffer
    this.buffer.push(snapshot);

    // Update tick tracking
    this.tickIndex.set(tick, this.buffer.getSize() - 1);
    this.newestTick = tick;

    // Update oldest tick
    if (this.oldestTick === -1 || tick < this.oldestTick) {
      this.oldestTick = tick;
    }

    // Clean up old tick indices when buffer wraps
    if (this.buffer.isFull()) {
      this.cleanupOldTickIndices();
    }
  }

  /**
   * Get snapshot for a specific tick
   */
  getSnapshot(tick: number): StateSnapshot | undefined {
    const index = this.tickIndex.get(tick);
    if (index === undefined) {
      return undefined;
    }
    return this.buffer.get(index);
  }

  /**
   * Get the nearest snapshot before or at the given tick
   */
  getSnapshotBefore(tick: number): StateSnapshot | undefined {
    let bestSnapshot: StateSnapshot | undefined;
    let bestTick = -1;

    const snapshots = this.buffer.getAll();
    for (const snapshot of snapshots) {
      if (snapshot.tick <= tick && snapshot.tick > bestTick) {
        bestSnapshot = snapshot;
        bestTick = snapshot.tick;
      }
    }

    return bestSnapshot;
  }

  /**
   * Get the nearest snapshot after or at the given tick
   */
  getSnapshotAfter(tick: number): StateSnapshot | undefined {
    let bestSnapshot: StateSnapshot | undefined;
    let bestTick = Infinity;

    const snapshots = this.buffer.getAll();
    for (const snapshot of snapshots) {
      if (snapshot.tick >= tick && snapshot.tick < bestTick) {
        bestSnapshot = snapshot;
        bestTick = snapshot.tick;
      }
    }

    return bestSnapshot;
  }

  /**
   * Get all snapshots between two ticks (inclusive)
   */
  getSnapshotsInRange(startTick: number, endTick: number): StateSnapshot[] {
    const result: StateSnapshot[] = [];
    const snapshots = this.buffer.getAll();

    for (const snapshot of snapshots) {
      if (snapshot.tick >= startTick && snapshot.tick <= endTick) {
        result.push(snapshot);
      }
    }

    return result;
  }

  /**
   * Remove all snapshots older than the given tick
   */
  removeSnapshotsOlderThan(tick: number): number {
    let removed = 0;
    const snapshots = this.buffer.getAll();

    for (const snapshot of snapshots) {
      if (snapshot.tick < tick) {
        this.tickIndex.delete(snapshot.tick);
        removed++;
      }
    }

    // Update oldest tick tracking
    if (removed > 0) {
      const remaining = snapshots.filter(s => s.tick >= tick);
      if (remaining.length > 0) {
        this.oldestTick = remaining[0].tick;
      } else {
        this.oldestTick = -1;
      }
    }

    return removed;
  }

  /**
   * Remove all snapshots newer than the given tick
   */
  removeSnapshotsNewerThan(tick: number): number {
    let removed = 0;
    const snapshots = this.buffer.getAll();

    for (const snapshot of snapshots) {
      if (snapshot.tick > tick) {
        this.tickIndex.delete(snapshot.tick);
        removed++;
      }
    }

    // Update newest tick tracking
    if (removed > 0) {
      const remaining = snapshots.filter(s => s.tick <= tick);
      if (remaining.length > 0) {
        this.newestTick = remaining[remaining.length - 1].tick;
      } else {
        this.newestTick = -1;
      }
    }

    return removed;
  }

  /**
   * Clear all snapshots
   */
  clear(): void {
    this.buffer.clear();
    this.tickIndex.clear();
    this.ticksSinceLastSnapshot = 0;
    this.newestTick = -1;
    this.oldestTick = -1;
  }

  /**
   * Get the newest snapshot
   */
  getNewestSnapshot(): StateSnapshot | undefined {
    return this.buffer.getNewest();
  }

  /**
   * Get the oldest snapshot
   */
  getOldestSnapshot(): StateSnapshot | undefined {
    return this.buffer.getOldest();
  }

  /**
   * Get the number of snapshots stored
   */
  getSnapshotCount(): number {
    return this.buffer.getSize();
  }

  /**
   * Get the newest tick number stored
   */
  getNewestTick(): number {
    return this.newestTick;
  }

  /**
   * Get the oldest tick number stored
   */
  getOldestTick(): number {
    return this.oldestTick;
  }

  /**
   * Get the configuration
   */
  getConfig(): SnapshotConfig {
    return { ...this.config };
  }

  /**
   * Update configuration
   * Note: Changing maxSnapshots will clear the buffer
   */
  updateConfig(newConfig: Partial<SnapshotConfig>): void {
    const needsClear = newConfig.maxSnapshots !== undefined &&
                       newConfig.maxSnapshots !== this.config.maxSnapshots;

    this.config = { ...this.config, ...newConfig };

    if (needsClear) {
      this.clear();
      // Recreate buffer with new capacity
      this.buffer = new CircularBuffer(this.config.maxSnapshots);
    }
  }

  /**
   * Check if we have a snapshot for the given tick
   */
  hasSnapshot(tick: number): boolean {
    return this.tickIndex.has(tick);
  }

  /**
   * Get memory usage statistics
   */
  getMemoryStats(): {
    snapshotCount: number;
    maxSnapshots: number;
    totalEntities: number;
    estimatedBytes: number;
  } {
    const snapshots = this.buffer.getAll();
    let totalEntities = 0;

    for (const snapshot of snapshots) {
      totalEntities += snapshot.size;
    }

    // Estimate: ~100 bytes per entity state
    const estimatedBytes = totalEntities * 100;

    return {
      snapshotCount: snapshots.length,
      maxSnapshots: this.config.maxSnapshots,
      totalEntities,
      estimatedBytes,
    };
  }

  /**
   * Clean up old tick indices when buffer wraps around
   */
  private cleanupOldTickIndices(): void {
    const oldestSnapshot = this.buffer.getOldest();
    if (oldestSnapshot) {
      // Remove all indices older than the oldest snapshot in buffer
      for (const [tick, _] of this.tickIndex.entries()) {
        if (tick < oldestSnapshot.tick) {
          this.tickIndex.delete(tick);
        }
      }
      this.oldestTick = oldestSnapshot.tick;
    }
  }

  /**
   * For debugging: get all snapshots as an array
   */
  debugGetAllSnapshots(): StateSnapshot[] {
    return this.buffer.getAll();
  }

  /**
   * For debugging: validate internal state
   */
  debugValidate(): boolean {
    const snapshots = this.buffer.getAll();

    // Check tick index consistency
    for (const [tick, index] of this.tickIndex.entries()) {
      const snapshot = this.buffer.get(index);
      if (!snapshot || snapshot.tick !== tick) {
        return false;
      }
    }

    // Check tick ordering
    for (let i = 1; i < snapshots.length; i++) {
      if (snapshots[i].tick <= snapshots[i - 1].tick) {
        return false;
      }
    }

    return true;
  }
}
