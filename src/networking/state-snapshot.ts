/**
 * State Snapshot - Entity state snapshots for rollback and re-simulation
 *
 * Provides efficient snapshot storage and retrieval for:
 * - Client-side prediction rollback
 * - Server reconciliation
 * - Debug recording and replay
 * - Determinism testing
 */

import type { Entity } from "../simulation/entity";
import type { EntityState } from "../simulation/entity";
import type { EntityStateSnapshot } from "./network-types";

/**
 * Snapshot creation options
 */
export interface SnapshotOptions {
  includeEntities?: string[];  // Specific entity IDs to include (empty = all)
  deepCopy?: boolean;          // Deep copy state (default: true)
  compress?: boolean;          // Use delta compression (default: false)
}

/**
 * StateSnapshot - Immutable snapshot of entity states at a specific tick
 */
export class StateSnapshot implements EntityStateSnapshot {
  readonly tick: number;
  readonly entities: Map<string, EntityState>;
  readonly timestamp: number;

  constructor(tick: number, entities: Map<string, EntityState>, timestamp?: number) {
    this.tick = tick;
    this.entities = entities;
    this.timestamp = timestamp ?? Date.now();
  }

  /**
   * Create a snapshot from an array of entities
   */
  static fromEntities(
    tick: number,
    entities: Entity[],
    options: SnapshotOptions = {}
  ): StateSnapshot {
    const entityMap = new Map<string, EntityState>();

    for (const entity of entities) {
      // Filter entities if specific IDs requested
      if (options.includeEntities && options.includeEntities.length > 0) {
        if (!options.includeEntities.includes(entity.id)) {
          continue;
        }
      }

      // Get entity state (deep copy by default)
      const state = options.deepCopy !== false
        ? entity.getStateCopy()
        : entity.state;

      entityMap.set(entity.id, state);
    }

    return new StateSnapshot(tick, entityMap);
  }

  /**
   * Create a snapshot from an existing entity state map
   */
  static fromMap(
    tick: number,
    entityMap: Map<string, EntityState>,
    timestamp?: number
  ): StateSnapshot {
    // Deep copy the map to ensure immutability
    const copiedMap = new Map<string, EntityState>();
    for (const [id, state] of entityMap.entries()) {
      copiedMap.set(id, {
        ...state,
        gridPos: { ...state.gridPos },
        velocity: { ...state.velocity },
      });
    }

    return new StateSnapshot(tick, copiedMap, timestamp);
  }

  /**
   * Get the state for a specific entity
   */
  getEntityState(entityId: string): EntityState | undefined {
    const state = this.entities.get(entityId);
    if (!state) {
      return undefined;
    }

    // Return a copy to prevent external modification
    return {
      ...state,
      gridPos: { ...state.gridPos },
      velocity: { ...state.velocity },
    };
  }

  /**
   * Check if an entity exists in this snapshot
   */
  hasEntity(entityId: string): boolean {
    return this.entities.has(entityId);
  }

  /**
   * Get all entity IDs in this snapshot
   */
  getEntityIds(): string[] {
    return Array.from(this.entities.keys());
  }

  /**
   * Get the number of entities in this snapshot
   */
  get size(): number {
    return this.entities.size;
  }

  /**
   * Check if snapshot is empty
   */
  isEmpty(): boolean {
    return this.entities.size === 0;
  }

  /**
   * Create a new snapshot with only the specified entities
   */
  filter(entityIds: string[]): StateSnapshot {
    const filteredMap = new Map<string, EntityState>();
    for (const id of entityIds) {
      const state = this.entities.get(id);
      if (state) {
        filteredMap.set(id, {
          ...state,
          gridPos: { ...state.gridPos },
          velocity: { ...state.velocity },
        });
      }
    }
    return new StateSnapshot(this.tick, filteredMap, this.timestamp);
  }

  /**
   * Merge this snapshot with another (other takes precedence for conflicts)
   */
  merge(other: StateSnapshot): StateSnapshot {
    const mergedMap = new Map<string, EntityState>();

    // Copy all entities from this snapshot
    for (const [id, state] of this.entities.entries()) {
      mergedMap.set(id, {
        ...state,
        gridPos: { ...state.gridPos },
        velocity: { ...state.velocity },
      });
    }

    // Overlay entities from other snapshot
    for (const [id, state] of other.entities.entries()) {
      mergedMap.set(id, {
        ...state,
        gridPos: { ...state.gridPos },
        velocity: { ...state.velocity },
      });
    }

    // Use the later tick
    const tick = Math.max(this.tick, other.tick);
    const timestamp = Math.max(this.timestamp, other.timestamp);

    return new StateSnapshot(tick, mergedMap, timestamp);
  }

  /**
   * Clone this snapshot
   */
  clone(): StateSnapshot {
    return StateSnapshot.fromMap(this.tick, this.entities, this.timestamp);
  }

  /**
   * Convert to a plain object (for serialization)
   */
  toPlain(): EntityStateSnapshot {
    return {
      tick: this.tick,
      entities: new Map(this.entities), // Shallow copy is fine for Map
      timestamp: this.timestamp,
    };
  }

  /**
   * Create a snapshot from a plain object
   */
  static fromPlain(plain: EntityStateSnapshot): StateSnapshot {
    return new StateSnapshot(plain.tick, plain.entities, plain.timestamp);
  }

  /**
   * Serialize snapshot to binary format
   */
  toBinary(): Uint8Array {
    // Lazy import to avoid circular dependency
    const { BinarySerializer } = require("./binary-serializer");

    const serializer = new BinarySerializer();

    // Write tick number
    serializer.writeUint32(this.tick);

    // Write timestamp
    serializer.writeFloat64(this.timestamp);

    // Write entity count
    serializer.writeUint16(this.entities.size);

    // Write each entity state
    for (const [entityId, state] of this.entities.entries()) {
      // Write entity ID
      serializer.writeString(entityId);

      // Lazy import EntitySerializer
      const { EntitySerializer } = require("./entity-serializer");

      // Serialize entity state
      const stateData = EntitySerializer.serializeEntityState(state);
      serializer.writeBytes(stateData);
    }

    return serializer.toBuffer();
  }

  /**
   * Deserialize snapshot from binary format
   */
  static fromBinary(data: Uint8Array): StateSnapshot {
    // Lazy import
    const { BinaryReader } = require("./binary-serializer");
    const { EntitySerializer } = require("./entity-serializer");

    const reader = new BinaryReader(data);

    // Read tick number
    const tick = reader.readUint32();

    // Read timestamp
    const timestamp = reader.readFloat64();

    // Read entity count
    const entityCount = reader.readUint16();

    // Read entities
    const entities = new Map<string, EntityState>();
    for (let i = 0; i < entityCount; i++) {
      const entityId = reader.readString();
      const stateData = reader.readBytes(reader.peekUint8()); // Read flags first to get size
      reader.setOffset(reader.getOffset() - 1); // Go back to read properly

      // Re-read with proper size
      const stateDataLength = StateSnapshot.estimateEntityStateSize();
      const actualData = reader.readBytes(stateDataLength);

      const state = EntitySerializer.deserializeEntityState(actualData);
      entities.set(entityId, state);
    }

    return new StateSnapshot(tick, entities, timestamp);
  }

  /**
   * Estimate entity state size for binary serialization
   * This is a rough estimate - actual size may vary due to delta encoding
   */
  private static estimateEntityStateSize(): number {
    // Flags (1) + position (12) + velocity (12) + rotation (4) + speed (4) + isMoving (1)
    return 34; // Approximate max size
  }

  /**
   * Get a string representation (for debugging)
   */
  toString(): string {
    return `StateSnapshot[tick=${this.tick}, entities=${this.entities.size}, timestamp=${this.timestamp}]`;
  }

  /**
   * Compare two snapshots for equality
   */
  equals(other: StateSnapshot): boolean {
    if (this.tick !== other.tick) {
      return false;
    }

    if (this.entities.size !== other.entities.size) {
      return false;
    }

    for (const [id, state] of this.entities.entries()) {
      const otherState = other.entities.get(id);
      if (!otherState) {
        return false;
      }

      // Compare state properties
      if (state.gridPos.xgrid !== otherState.gridPos.xgrid ||
          state.gridPos.ygrid !== otherState.gridPos.ygrid ||
          state.gridPos.zheight !== otherState.gridPos.zheight ||
          state.velocity.x !== otherState.velocity.x ||
          state.velocity.y !== otherState.velocity.y ||
          state.velocity.z !== otherState.velocity.z ||
          state.rotation !== otherState.rotation ||
          state.speed !== otherState.speed ||
          state.isMoving !== otherState.isMoving) {
        return false;
      }
    }

    return true;
  }
}
