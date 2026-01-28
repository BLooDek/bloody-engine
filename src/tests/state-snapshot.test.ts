/**
 * State Snapshot Unit Tests
 *
 * Comprehensive tests for StateSnapshot functionality:
 * - Snapshot creation and cloning
 * - Delta computation between snapshots
 * - Snapshot application
 * - Serialization/deserialization
 *
 * Run with: npm run test -- state-snapshot
 */

/// <reference types="vitest/globals" />

import { describe, it, expect, beforeEach } from "vitest";
import { StateSnapshot, type SnapshotOptions } from "../networking/state-snapshot";
import type { EntityState } from "../simulation/entity";
import type { Entity } from "../simulation/entity";
import type { GridCoord } from "../rendering/projection";

/**
 * Mock Entity implementation for testing
 */
class MockEntity implements Entity {
  readonly id: string;
  readonly type: string;
  private _state: EntityState;

  constructor(id: string, type: string, state: EntityState) {
    this.id = id;
    this.type = type;
    this._state = state;
  }

  get state(): Readonly<EntityState> {
    return this._state;
  }

  getStateCopy(): EntityState {
    return {
      gridPos: { ...this._state.gridPos },
      velocity: { ...this._state.velocity },
      rotation: this._state.rotation,
      speed: this._state.speed,
      isMoving: this._state.isMoving,
    };
  }

  // Other required methods (not used in tests)
  get previousState(): Readonly<EntityState> {
    return this._state;
  }
  getPosition() { return { x: this._state.gridPos.xgrid, y: this._state.gridPos.ygrid, z: this._state.gridPos.zheight }; }
  getGridPos() { return { x: Math.floor(this._state.gridPos.xgrid), y: Math.floor(this._state.gridPos.ygrid), z: Math.floor(this._state.gridPos.zheight) }; }
  getRoundedGridPos() { return { x: Math.round(this._state.gridPos.xgrid), y: Math.round(this._state.gridPos.ygrid), z: Math.round(this._state.gridPos.zheight) }; }
  setPosition() {}
  setVelocity() {}
  setRotation() {}
  setSpeed() {}
  setMoving() {}
  update() {}
  setState() {}
  getHandle() { return { index: 0, generation: 0 }; }
  getStorage() { return null as any; }
}

/**
 * Helper to create a mock entity state
 */
function createEntityState(overrides: Partial<EntityState> = {}): EntityState {
  return {
    gridPos: { xgrid: 0, ygrid: 0, zheight: 0, ...overrides.gridPos },
    velocity: { x: 0, y: 0, z: 0, ...overrides.velocity },
    rotation: 0,
    speed: 1.0,
    isMoving: false,
    ...overrides,
  };
}

/**
 * Helper to create a mock entity
 */
function createMockEntity(id: string, stateOverrides: Partial<EntityState> = {}): MockEntity {
  const state = createEntityState(stateOverrides);
  return new MockEntity(id, "test", state);
}

describe("StateSnapshot", () => {
  describe("Constructor and Basic Properties", () => {
    it("should create snapshot with tick and entities", () => {
      const entityMap = new Map<string, EntityState>();
      entityMap.set("entity1", createEntityState());
      entityMap.set("entity2", createEntityState({ gridPos: { xgrid: 10, ygrid: 20, zheight: 5 } }));

      const snapshot = new StateSnapshot(100, entityMap);

      expect(snapshot.tick).toBe(100);
      expect(snapshot.size).toBe(2);
      expect(snapshot.entities).toBe(entityMap);
    });

    it("should use default timestamp when not provided", () => {
      const before = Date.now();
      const snapshot = new StateSnapshot(0, new Map());
      const after = Date.now();

      expect(snapshot.timestamp).toBeGreaterThanOrEqual(before);
      expect(snapshot.timestamp).toBeLessThanOrEqual(after);
    });

    it("should use provided timestamp", () => {
      const timestamp = 1234567890;
      const snapshot = new StateSnapshot(0, new Map(), timestamp);

      expect(snapshot.timestamp).toBe(timestamp);
    });

    it("should provide size property", () => {
      const entityMap = new Map<string, EntityState>();
      entityMap.set("e1", createEntityState());
      entityMap.set("e2", createEntityState());
      entityMap.set("e3", createEntityState());

      const snapshot = new StateSnapshot(0, entityMap);
      expect(snapshot.size).toBe(3);
    });
  });

  describe("fromEntities - Snapshot Creation", () => {
    it("should create snapshot from entity array", () => {
      const entities: MockEntity[] = [
        createMockEntity("entity1"),
        createMockEntity("entity2", { gridPos: { xgrid: 5, ygrid: 10, zheight: 2 } }),
      ];

      const snapshot = StateSnapshot.fromEntities(50, entities);

      expect(snapshot.tick).toBe(50);
      expect(snapshot.size).toBe(2);
      expect(snapshot.hasEntity("entity1")).toBe(true);
      expect(snapshot.hasEntity("entity2")).toBe(true);
    });

    it("should deep copy entity states by default", () => {
      const entity = createMockEntity("entity1", {
        gridPos: { xgrid: 10, ygrid: 20, zheight: 5 },
      });

      const snapshot = StateSnapshot.fromEntities(0, [entity]);
      const state = snapshot.getEntityState("entity1");

      // Modify the original entity state
      entity._state.gridPos.xgrid = 999;

      // Snapshot should be unchanged
      expect(state?.gridPos.xgrid).toBe(10);
    });

    it("should use shallow copy when deepCopy is false", () => {
      const entity = createMockEntity("entity1", {
        gridPos: { xgrid: 10, ygrid: 20, zheight: 5 },
      });

      const snapshot = StateSnapshot.fromEntities(0, [entity], { deepCopy: false });

      expect(snapshot.size).toBe(1);
    });

    it("should filter entities when includeEntities is specified", () => {
      const entities: MockEntity[] = [
        createMockEntity("entity1"),
        createMockEntity("entity2"),
        createMockEntity("entity3"),
      ];

      const options: SnapshotOptions = {
        includeEntities: ["entity1", "entity3"],
      };

      const snapshot = StateSnapshot.fromEntities(0, entities, options);

      expect(snapshot.size).toBe(2);
      expect(snapshot.hasEntity("entity1")).toBe(true);
      expect(snapshot.hasEntity("entity2")).toBe(false);
      expect(snapshot.hasEntity("entity3")).toBe(true);
    });

    it("should include all entities when includeEntities is empty", () => {
      const entities: MockEntity[] = [
        createMockEntity("entity1"),
        createMockEntity("entity2"),
      ];

      const snapshot = StateSnapshot.fromEntities(0, entities, {
        includeEntities: [],
      });

      expect(snapshot.size).toBe(2);
    });

    it("should handle empty entity array", () => {
      const snapshot = StateSnapshot.fromEntities(0, []);

      expect(snapshot.size).toBe(0);
      expect(snapshot.isEmpty()).toBe(true);
    });
  });

  describe("fromMap - Snapshot from Entity Map", () => {
    it("should create snapshot from entity map", () => {
      const entityMap = new Map<string, EntityState>();
      entityMap.set("e1", createEntityState({ gridPos: { xgrid: 1, ygrid: 2, zheight: 3 } }));
      entityMap.set("e2", createEntityState({ gridPos: { xgrid: 4, ygrid: 5, zheight: 6 } }));

      const snapshot = StateSnapshot.fromMap(100, entityMap);

      expect(snapshot.tick).toBe(100);
      expect(snapshot.size).toBe(2);
    });

    it("should deep copy entity map for immutability", () => {
      const entityMap = new Map<string, EntityState>();
      const originalState = createEntityState({ gridPos: { xgrid: 10, ygrid: 20, zheight: 5 } });
      entityMap.set("e1", originalState);

      const snapshot = StateSnapshot.fromMap(0, entityMap);
      const snapshotState = snapshot.getEntityState("e1");

      // Modify original
      originalState.gridPos.xgrid = 999;

      // Snapshot should be unchanged
      expect(snapshotState?.gridPos.xgrid).toBe(10);
    });

    it("should use provided timestamp", () => {
      const entityMap = new Map<string, EntityState>();
      entityMap.set("e1", createEntityState());

      const timestamp = 999999;
      const snapshot = StateSnapshot.fromMap(0, entityMap, timestamp);

      expect(snapshot.timestamp).toBe(timestamp);
    });
  });

  describe("getEntityState", () => {
    let snapshot: StateSnapshot;

    beforeEach(() => {
      const entityMap = new Map<string, EntityState>();
      entityMap.set("e1", createEntityState({
        gridPos: { xgrid: 10, ygrid: 20, zheight: 5 },
        velocity: { x: 1, y: 2, z: 3 },
        rotation: 1.5,
        speed: 2.5,
        isMoving: true,
      }));
      entityMap.set("e2", createEntityState());

      snapshot = new StateSnapshot(0, entityMap);
    });

    it("should return entity state for existing entity", () => {
      const state = snapshot.getEntityState("e1");

      expect(state).toBeDefined();
      expect(state?.gridPos.xgrid).toBe(10);
      expect(state?.gridPos.ygrid).toBe(20);
      expect(state?.gridPos.zheight).toBe(5);
      expect(state?.velocity.x).toBe(1);
      expect(state?.velocity.y).toBe(2);
      expect(state?.velocity.z).toBe(3);
      expect(state?.rotation).toBe(1.5);
      expect(state?.speed).toBe(2.5);
      expect(state?.isMoving).toBe(true);
    });

    it("should return undefined for non-existent entity", () => {
      const state = snapshot.getEntityState("nonexistent");

      expect(state).toBeUndefined();
    });

    it("should return a copy to prevent external modification", () => {
      const state1 = snapshot.getEntityState("e1");
      const state2 = snapshot.getEntityState("e1");

      // They should be different objects
      expect(state1).not.toBe(state2);

      // But have the same values
      expect(state1).toEqual(state2);

      // Modifying one should not affect the other
      if (state1) {
        state1.gridPos.xgrid = 999;
      }
      expect(state2?.gridPos.xgrid).toBe(10);
    });
  });

  describe("hasEntity", () => {
    it("should return true for existing entity", () => {
      const entityMap = new Map<string, EntityState>();
      entityMap.set("e1", createEntityState());

      const snapshot = new StateSnapshot(0, entityMap);

      expect(snapshot.hasEntity("e1")).toBe(true);
    });

    it("should return false for non-existent entity", () => {
      const snapshot = new StateSnapshot(0, new Map());

      expect(snapshot.hasEntity("e1")).toBe(false);
    });
  });

  describe("getEntityIds", () => {
    it("should return array of all entity IDs", () => {
      const entityMap = new Map<string, EntityState>();
      entityMap.set("e1", createEntityState());
      entityMap.set("e2", createEntityState());
      entityMap.set("e3", createEntityState());

      const snapshot = new StateSnapshot(0, entityMap);
      const ids = snapshot.getEntityIds();

      expect(ids).toHaveLength(3);
      expect(ids).toContain("e1");
      expect(ids).toContain("e2");
      expect(ids).toContain("e3");
    });

    it("should return empty array for empty snapshot", () => {
      const snapshot = new StateSnapshot(0, new Map());
      const ids = snapshot.getEntityIds();

      expect(ids).toHaveLength(0);
      expect(ids).toEqual([]);
    });

    it("should return independent copy (modifications don't affect snapshot)", () => {
      const entityMap = new Map<string, EntityState>();
      entityMap.set("e1", createEntityState());

      const snapshot = new StateSnapshot(0, entityMap);
      const ids1 = snapshot.getEntityIds();
      const ids2 = snapshot.getEntityIds();

      // Different arrays
      expect(ids1).not.toBe(ids2);

      // Same contents
      expect(ids1).toEqual(ids2);
    });
  });

  describe("isEmpty", () => {
    it("should return true for empty snapshot", () => {
      const snapshot = new StateSnapshot(0, new Map());

      expect(snapshot.isEmpty()).toBe(true);
    });

    it("should return false for snapshot with entities", () => {
      const entityMap = new Map<string, EntityState>();
      entityMap.set("e1", createEntityState());

      const snapshot = new StateSnapshot(0, entityMap);

      expect(snapshot.isEmpty()).toBe(false);
    });
  });

  describe("filter - Create Snapshot Subset", () => {
    let snapshot: StateSnapshot;

    beforeEach(() => {
      const entityMap = new Map<string, EntityState>();
      entityMap.set("e1", createEntityState({ gridPos: { xgrid: 1, ygrid: 2, zheight: 3 } }));
      entityMap.set("e2", createEntityState({ gridPos: { xgrid: 4, ygrid: 5, zheight: 6 } }));
      entityMap.set("e3", createEntityState({ gridPos: { xgrid: 7, ygrid: 8, zheight: 9 } }));

      snapshot = new StateSnapshot(100, entityMap, 12345);
    });

    it("should create filtered snapshot with specified entities", () => {
      const filtered = snapshot.filter(["e1", "e3"]);

      expect(filtered.tick).toBe(100);
      expect(filtered.size).toBe(2);
      expect(filtered.hasEntity("e1")).toBe(true);
      expect(filtered.hasEntity("e3")).toBe(true);
      expect(filtered.hasEntity("e2")).toBe(false);
    });

    it("should preserve timestamp in filtered snapshot", () => {
      const filtered = snapshot.filter(["e1"]);

      expect(filtered.timestamp).toBe(12345);
    });

    it("should create deep copy of filtered entities", () => {
      const filtered = snapshot.filter(["e1"]);
      const state = filtered.getEntityState("e1");

      // Modify the snapshot's state
      const originalState = snapshot.getEntityState("e1");
      if (originalState) {
        originalState.gridPos.xgrid = 999;
      }

      // Filtered snapshot should be unchanged
      expect(state?.gridPos.xgrid).toBe(1);
    });

    it("should handle non-existent entity IDs", () => {
      const filtered = snapshot.filter(["e1", "nonexistent", "e3"]);

      expect(filtered.size).toBe(2);
      expect(filtered.hasEntity("e1")).toBe(true);
      expect(filtered.hasEntity("e3")).toBe(true);
    });

    it("should create empty snapshot when no IDs match", () => {
      const filtered = snapshot.filter(["nonexistent1", "nonexistent2"]);

      expect(filtered.size).toBe(0);
      expect(filtered.isEmpty()).toBe(true);
    });
  });

  describe("merge - Combine Snapshots", () => {
    it("should merge two snapshots", () => {
      const map1 = new Map<string, EntityState>();
      map1.set("e1", createEntityState({ gridPos: { xgrid: 1, ygrid: 2, zheight: 3 } }));
      map1.set("e2", createEntityState({ gridPos: { xgrid: 4, ygrid: 5, zheight: 6 } }));

      const map2 = new Map<string, EntityState>();
      map2.set("e2", createEntityState({ gridPos: { xgrid: 99, ygrid: 88, zheight: 77 } }));
      map2.set("e3", createEntityState({ gridPos: { xgrid: 7, ygrid: 8, zheight: 9 } }));

      const snapshot1 = new StateSnapshot(100, map1, 1000);
      const snapshot2 = new StateSnapshot(150, map2, 2000);

      const merged = snapshot1.merge(snapshot2);

      expect(merged.tick).toBe(150); // Later tick
      expect(merged.timestamp).toBe(2000); // Later timestamp
      expect(merged.size).toBe(3);
      expect(merged.getEntityState("e1")?.gridPos.xgrid).toBe(1); // From snapshot1
      expect(merged.getEntityState("e2")?.gridPos.xgrid).toBe(99); // From snapshot2 (overwrites)
      expect(merged.getEntityState("e3")?.gridPos.xgrid).toBe(7); // From snapshot2
    });

    it("should handle merging with empty snapshot", () => {
      const map1 = new Map<string, EntityState>();
      map1.set("e1", createEntityState());

      const snapshot1 = new StateSnapshot(100, map1);
      const emptySnapshot = new StateSnapshot(50, new Map());

      const merged1 = snapshot1.merge(emptySnapshot);
      const merged2 = emptySnapshot.merge(snapshot1);

      expect(merged1.size).toBe(1);
      expect(merged1.tick).toBe(100);
      expect(merged2.size).toBe(1);
      expect(merged2.tick).toBe(100);
    });

    it("should create deep copy of merged entities", () => {
      const map1 = new Map<string, EntityState>();
      const state1 = createEntityState({ gridPos: { xgrid: 1, ygrid: 2, zheight: 3 } });
      map1.set("e1", state1);

      const snapshot1 = new StateSnapshot(0, map1);
      const snapshot2 = new StateSnapshot(0, new Map());

      const merged = snapshot1.merge(snapshot2);
      const mergedState = merged.getEntityState("e1");

      // Modify original
      state1.gridPos.xgrid = 999;

      // Merged should be unchanged
      expect(mergedState?.gridPos.xgrid).toBe(1);
    });
  });

  describe("clone - Create Snapshot Copy", () => {
    it("should create independent clone", () => {
      const map = new Map<string, EntityState>();
      map.set("e1", createEntityState({ gridPos: { xgrid: 1, ygrid: 2, zheight: 3 } }));

      const snapshot = new StateSnapshot(100, map, 12345);
      const cloned = snapshot.clone();

      expect(cloned.tick).toBe(100);
      expect(cloned.timestamp).toBe(12345);
      expect(cloned.size).toBe(1);
      expect(cloned.getEntityState("e1")?.gridPos.xgrid).toBe(1);
    });

    it("should create deep copy of entities", () => {
      const map = new Map<string, EntityState>();
      const state = createEntityState({ gridPos: { xgrid: 1, ygrid: 2, zheight: 3 } });
      map.set("e1", state);

      const snapshot = new StateSnapshot(0, map);
      const cloned = snapshot.clone();

      // Modify original state
      state.gridPos.xgrid = 999;

      // Clone should be unchanged
      const clonedState = cloned.getEntityState("e1");
      expect(clonedState?.gridPos.xgrid).toBe(1);
    });

    it("should not share entity map reference", () => {
      const snapshot = new StateSnapshot(0, new Map());
      const cloned = snapshot.clone();

      expect(cloned.entities).not.toBe(snapshot.entities);
    });
  });

  describe("toPlain and fromPlain - Serialization", () => {
    it("should convert to plain object", () => {
      const map = new Map<string, EntityState>();
      map.set("e1", createEntityState({ gridPos: { xgrid: 1, ygrid: 2, zheight: 3 } }));

      const snapshot = new StateSnapshot(100, map, 12345);
      const plain = snapshot.toPlain();

      expect(plain.tick).toBe(100);
      expect(plain.timestamp).toBe(12345);
      expect(plain.entities).toBeInstanceOf(Map);
      expect(plain.entities.size).toBe(1);
    });

    it("should create snapshot from plain object", () => {
      const map = new Map<string, EntityState>();
      map.set("e1", createEntityState({ gridPos: { xgrid: 1, ygrid: 2, zheight: 3 } }));

      const plain: any = {
        tick: 100,
        timestamp: 12345,
        entities: map,
      };

      const snapshot = StateSnapshot.fromPlain(plain);

      expect(snapshot.tick).toBe(100);
      expect(snapshot.timestamp).toBe(12345);
      expect(snapshot.size).toBe(1);
      expect(snapshot.getEntityState("e1")?.gridPos.xgrid).toBe(1);
    });

    it("should round-trip through plain format", () => {
      const map = new Map<string, EntityState>();
      map.set("e1", createEntityState({
        gridPos: { xgrid: 10, ygrid: 20, zheight: 5 },
        velocity: { x: 1, y: 2, z: 3 },
        rotation: 1.5,
        speed: 2.5,
        isMoving: true,
      }));

      const original = new StateSnapshot(100, map, 12345);
      const plain = original.toPlain();
      const restored = StateSnapshot.fromPlain(plain);

      expect(restored.tick).toBe(original.tick);
      expect(restored.timestamp).toBe(original.timestamp);
      expect(restored.size).toBe(original.size);
      expect(restored.equals(original)).toBe(true);
    });
  });

  describe("toBinary and fromBinary - Binary Serialization", () => {
    it("should serialize and deserialize snapshot", () => {
      const map = new Map<string, EntityState>();
      map.set("e1", createEntityState({
        gridPos: { xgrid: 10.5, ygrid: 20.3, zheight: 5.7 },
        velocity: { x: 1.2, y: -2.5, z: 3.8 },
        rotation: 1.57,
        speed: 2.5,
        isMoving: true,
      }));
      map.set("e2", createEntityState({
        gridPos: { xgrid: 100, ygrid: 200, zheight: 50 },
      }));

      const original = new StateSnapshot(12345, map, 999999);
      const binary = original.toBinary();
      const restored = StateSnapshot.fromBinary(binary);

      expect(restored.tick).toBe(12345);
      expect(restored.timestamp).toBe(999999);
      expect(restored.size).toBe(2);
      expect(restored.getEntityState("e1")?.gridPos.xgrid).toBeCloseTo(10.5, 4);
      expect(restored.getEntityState("e1")?.velocity.y).toBeCloseTo(-2.5, 4);
      expect(restored.getEntityState("e1")?.rotation).toBeCloseTo(1.57, 4);
      expect(restored.getEntityState("e1")?.speed).toBeCloseTo(2.5, 4);
      expect(restored.getEntityState("e1")?.isMoving).toBe(true);
    });

    it("should handle empty snapshot", () => {
      const original = new StateSnapshot(0, new Map(), 0);
      const binary = original.toBinary();
      const restored = StateSnapshot.fromBinary(binary);

      expect(restored.tick).toBe(0);
      expect(restored.timestamp).toBe(0);
      expect(restored.size).toBe(0);
    });

    it("should preserve entity data integrity through round-trip", () => {
      const map = new Map<string, EntityState>();
      map.set("entity-123", createEntityState({
        gridPos: { xgrid: 1, ygrid: 2, zheight: 3 },
        velocity: { x: 0.1, y: 0.2, z: 0.3 },
        rotation: Math.PI / 4,
        speed: 1.5,
        isMoving: true,
      }));

      const original = new StateSnapshot(500, map);
      const binary = original.toBinary();
      const restored = StateSnapshot.fromBinary(binary);

      const originalState = original.getEntityState("entity-123");
      const restoredState = restored.getEntityState("entity-123");

      expect(restoredState?.gridPos.xgrid).toBeCloseTo(originalState?.gridPos.xgrid || 0, 4);
      expect(restoredState?.gridPos.ygrid).toBeCloseTo(originalState?.gridPos.ygrid || 0, 4);
      expect(restoredState?.gridPos.zheight).toBeCloseTo(originalState?.gridPos.zheight || 0, 4);
      expect(restoredState?.velocity.x).toBeCloseTo(originalState?.velocity.x || 0, 4);
      expect(restoredState?.velocity.y).toBeCloseTo(originalState?.velocity.y || 0, 4);
      expect(restoredState?.velocity.z).toBeCloseTo(originalState?.velocity.z || 0, 4);
      expect(restoredState?.rotation).toBeCloseTo(originalState?.rotation || 0, 4);
      expect(restoredState?.speed).toBeCloseTo(originalState?.speed || 0, 4);
      expect(restoredState?.isMoving).toBe(originalState?.isMoving);
    });
  });

  describe("toString - String Representation", () => {
    it("should return string representation", () => {
      const map = new Map<string, EntityState>();
      map.set("e1", createEntityState());
      map.set("e2", createEntityState());

      const snapshot = new StateSnapshot(100, map, 12345);
      const str = snapshot.toString();

      expect(str).toContain("100");
      expect(str).toContain("2");
      expect(str).toContain("12345");
    });

    it("should handle empty snapshot", () => {
      const snapshot = new StateSnapshot(0, new Map());
      const str = snapshot.toString();

      expect(str).toContain("0");
      expect(str).toContain("0");
    });
  });

  describe("equals - Snapshot Comparison", () => {
    it("should return true for equal snapshots", () => {
      const state = createEntityState({
        gridPos: { xgrid: 1, ygrid: 2, zheight: 3 },
        velocity: { x: 1, y: 2, z: 3 },
        rotation: 1.5,
        speed: 2.5,
        isMoving: true,
      });

      const map1 = new Map<string, EntityState>();
      map1.set("e1", state);
      map1.set("e2", createEntityState());

      const map2 = new Map<string, EntityState>();
      map2.set("e1", { ...state, gridPos: { ...state.gridPos }, velocity: { ...state.velocity } });
      map2.set("e2", createEntityState());

      const snapshot1 = new StateSnapshot(100, map1);
      const snapshot2 = new StateSnapshot(100, map2);

      expect(snapshot1.equals(snapshot2)).toBe(true);
    });

    it("should return false for different ticks", () => {
      const map = new Map<string, EntityState>();
      map.set("e1", createEntityState());

      const snapshot1 = new StateSnapshot(100, map);
      const snapshot2 = new StateSnapshot(200, map);

      expect(snapshot1.equals(snapshot2)).toBe(false);
    });

    it("should return false for different entity counts", () => {
      const map1 = new Map<string, EntityState>();
      map1.set("e1", createEntityState());

      const map2 = new Map<string, EntityState>();
      map2.set("e1", createEntityState());
      map2.set("e2", createEntityState());

      const snapshot1 = new StateSnapshot(0, map1);
      const snapshot2 = new StateSnapshot(0, map2);

      expect(snapshot1.equals(snapshot2)).toBe(false);
    });

    it("should return false for different entity states", () => {
      const map1 = new Map<string, EntityState>();
      map1.set("e1", createEntityState({ gridPos: { xgrid: 1, ygrid: 2, zheight: 3 } }));

      const map2 = new Map<string, EntityState>();
      map2.set("e1", createEntityState({ gridPos: { xgrid: 99, ygrid: 2, zheight: 3 } }));

      const snapshot1 = new StateSnapshot(0, map1);
      const snapshot2 = new StateSnapshot(0, map2);

      expect(snapshot1.equals(snapshot2)).toBe(false);
    });

    it("should return false when one snapshot missing entity", () => {
      const map1 = new Map<string, EntityState>();
      map1.set("e1", createEntityState());
      map1.set("e2", createEntityState());

      const map2 = new Map<string, EntityState>();
      map2.set("e1", createEntityState());

      const snapshot1 = new StateSnapshot(0, map1);
      const snapshot2 = new StateSnapshot(0, map2);

      expect(snapshot1.equals(snapshot2)).toBe(false);
    });

    it("should compare all state properties", () => {
      const state1 = createEntityState({
        gridPos: { xgrid: 1, ygrid: 2, zheight: 3 },
        velocity: { x: 1, y: 2, z: 3 },
        rotation: 1.5,
        speed: 2.5,
        isMoving: true,
      });

      const state2 = createEntityState({
        gridPos: { xgrid: 1, ygrid: 2, zheight: 3 },
        velocity: { x: 1, y: 2, z: 3 },
        rotation: 1.5,
        speed: 2.5,
        isMoving: false, // Different isMoving
      });

      const map1 = new Map([["e1", state1]]);
      const map2 = new Map([["e1", state2]]);

      const snapshot1 = new StateSnapshot(0, map1);
      const snapshot2 = new StateSnapshot(0, map2);

      expect(snapshot1.equals(snapshot2)).toBe(false);
    });

    it("should handle velocity differences", () => {
      const state1 = createEntityState({
        velocity: { x: 1, y: 2, z: 3 },
      });

      const state2 = createEntityState({
        velocity: { x: 1, y: 2, z: 99 }, // Different z
      });

      const map1 = new Map([["e1", state1]]);
      const map2 = new Map([["e1", state2]]);

      const snapshot1 = new StateSnapshot(0, map1);
      const snapshot2 = new StateSnapshot(0, map2);

      expect(snapshot1.equals(snapshot2)).toBe(false);
    });

    it("should handle rotation differences", () => {
      const state1 = createEntityState({ rotation: Math.PI });
      const state2 = createEntityState({ rotation: 0 });

      const map1 = new Map([["e1", state1]]);
      const map2 = new Map([["e1", state2]]);

      const snapshot1 = new StateSnapshot(0, map1);
      const snapshot2 = new StateSnapshot(0, map2);

      expect(snapshot1.equals(snapshot2)).toBe(false);
    });

    it("should handle speed differences", () => {
      const state1 = createEntityState({ speed: 2.0 });
      const state2 = createEntityState({ speed: 1.0 });

      const map1 = new Map([["e1", state1]]);
      const map2 = new Map([["e1", state2]]);

      const snapshot1 = new StateSnapshot(0, map1);
      const snapshot2 = new StateSnapshot(0, map2);

      expect(snapshot1.equals(snapshot2)).toBe(false);
    });

    it("should return true for empty snapshots with same tick", () => {
      const snapshot1 = new StateSnapshot(100, new Map());
      const snapshot2 = new StateSnapshot(100, new Map());

      expect(snapshot1.equals(snapshot2)).toBe(true);
    });

    it("should return false for empty snapshots with different ticks", () => {
      const snapshot1 = new StateSnapshot(100, new Map());
      const snapshot2 = new StateSnapshot(200, new Map());

      expect(snapshot1.equals(snapshot2)).toBe(false);
    });
  });

  describe("Edge Cases and Complex Scenarios", () => {
    it("should handle large tick numbers", () => {
      const snapshot = new StateSnapshot(Number.MAX_SAFE_INTEGER, new Map());

      expect(snapshot.tick).toBe(Number.MAX_SAFE_INTEGER);
    });

    it("should handle negative velocities", () => {
      const state = createEntityState({
        velocity: { x: -1.5, y: -2.5, z: -3.5 },
      });

      const snapshot = new StateSnapshot(0, new Map([["e1", state]]));
      const retrieved = snapshot.getEntityState("e1");

      expect(retrieved?.velocity.x).toBe(-1.5);
      expect(retrieved?.velocity.y).toBe(-2.5);
      expect(retrieved?.velocity.z).toBe(-3.5);
    });

    it("should handle zero rotation and speed", () => {
      const state = createEntityState({
        rotation: 0,
        speed: 0,
      });

      const snapshot = new StateSnapshot(0, new Map([["e1", state]]));
      const retrieved = snapshot.getEntityState("e1");

      expect(retrieved?.rotation).toBe(0);
      expect(retrieved?.speed).toBe(0);
    });

    it("should handle multiple filter and merge operations", () => {
      const map = new Map<string, EntityState>();
      map.set("e1", createEntityState({ gridPos: { xgrid: 1, ygrid: 2, zheight: 3 } }));
      map.set("e2", createEntityState({ gridPos: { xgrid: 4, ygrid: 5, zheight: 6 } }));
      map.set("e3", createEntityState({ gridPos: { xgrid: 7, ygrid: 8, zheight: 9 } }));
      map.set("e4", createEntityState({ gridPos: { xgrid: 10, ygrid: 11, zheight: 12 } }));

      const snapshot1 = new StateSnapshot(100, map);
      const filtered1 = snapshot1.filter(["e1", "e2"]);
      const filtered2 = snapshot1.filter(["e3", "e4"]);
      const merged = filtered1.merge(filtered2);

      expect(merged.size).toBe(4);
      expect(merged.tick).toBe(100);
    });

    it("should handle clone-merge combinations", () => {
      const map1 = new Map<string, EntityState>();
      map1.set("e1", createEntityState({ gridPos: { xgrid: 1, ygrid: 2, zheight: 3 } }));

      const snapshot1 = new StateSnapshot(100, map1);
      const cloned = snapshot1.clone();

      const map2 = new Map<string, EntityState>();
      map2.set("e2", createEntityState({ gridPos: { xgrid: 4, ygrid: 5, zheight: 6 } }));

      const snapshot2 = new StateSnapshot(200, map2);
      const merged = cloned.merge(snapshot2);

      expect(merged.tick).toBe(200);
      expect(merged.size).toBe(2);
      expect(merged.getEntityState("e1")?.gridPos.xgrid).toBe(1);
      expect(merged.getEntityState("e2")?.gridPos.xgrid).toBe(4);
    });
  });
});
