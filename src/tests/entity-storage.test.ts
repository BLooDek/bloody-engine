/**
 * Unit tests for EntityStorage (SoA entity storage)
 */

import { describe, it, expect, beforeEach } from "vitest";
import { EntityStorage } from "../simulation/entity-storage";
import type { EntityHandle } from "../simulation/entity-handle";

describe("EntityStorage", () => {
  let storage: EntityStorage;

  beforeEach(() => {
    storage = new EntityStorage(100);
  });

  describe("Basic Operations", () => {
    it("should allocate and deallocate entities", () => {
      const handle = storage.allocate(0);

      expect(storage.getCount()).toBe(1);
      expect(storage.isValidHandle(handle)).toBe(true);

      storage.deallocate(handle);
      expect(storage.getCount()).toBe(0);
      expect(storage.isValidHandle(handle)).toBe(false);
    });

    it("should expand capacity when needed", () => {
      const initialCapacity = storage.getCapacity();

      // Allocate more entities than capacity
      for (let i = 0; i < initialCapacity + 10; i++) {
        storage.allocate(0);
      }

      expect(storage.getCapacity()).toBeGreaterThan(initialCapacity);
    });

    it("should reuse free slots", () => {
      const handle1 = storage.allocate(0);
      const index1 = handle1.index;

      storage.deallocate(handle1);
      const handle2 = storage.allocate(0);

      // Should reuse the same index
      expect(handle2.index).toBe(index1);
      // But with different generation
      expect(handle2.generation).not.toBe(handle1.generation);
    });
  });

  describe("Property Accessors", () => {
    it("should get and set position", () => {
      const handle = storage.allocate(0);

      storage.setPosition(handle.index, 10.5, 20.3, 5.1);
      const pos = storage.getPosition(handle.index);

      expect(pos.x).toBeCloseTo(10.5);
      expect(pos.y).toBeCloseTo(20.3);
      expect(pos.z).toBeCloseTo(5.1);
    });

    it("should move entity by relative amount", () => {
      const handle = storage.allocate(0);
      storage.setPosition(handle.index, 10, 10, 0);

      storage.move(handle.index, 5, -3, 2);
      const pos = storage.getPosition(handle.index);

      expect(pos.x).toBe(15);
      expect(pos.y).toBe(7);
      expect(pos.z).toBe(2);
    });

    it("should get and set velocity", () => {
      const handle = storage.allocate(0);

      storage.setVelocity(handle.index, 1.5, 2.0, 0.5);
      const vel = storage.getVelocity(handle.index);

      expect(vel.x).toBe(1.5);
      expect(vel.y).toBe(2.0);
      expect(vel.z).toBe(0.5);
    });

    it("should set isMoving flag based on velocity", () => {
      const handle = storage.allocate(0);

      storage.setVelocity(handle.index, 1, 0, 0);
      expect(storage.getIsMoving(handle.index)).toBe(true);

      storage.setVelocity(handle.index, 0, 0, 0);
      expect(storage.getIsMoving(handle.index)).toBe(false);
    });

    it("should get and set rotation", () => {
      const handle = storage.allocate(0);

      storage.setRotation(handle.index, Math.PI / 4);
      expect(storage.getRotation(handle.index)).toBeCloseTo(Math.PI / 4);
    });

    it("should get and set speed", () => {
      const handle = storage.allocate(0);

      storage.setSpeed(handle.index, 2.5);
      expect(storage.getSpeed(handle.index)).toBe(2.5);

      // Negative speed should be clamped to 0
      storage.setSpeed(handle.index, -1);
      expect(storage.getSpeed(handle.index)).toBe(0);
    });

    it("should get and set texture ID", () => {
      const handle = storage.allocate(0);

      storage.setTextureId(handle.index, 42);
      expect(storage.getTextureId(handle.index)).toBe(42);
    });

    it("should get and set color", () => {
      const handle = storage.allocate(0);

      storage.setColor(handle.index, 1.0, 0.5, 0.25, 0.8);
      const color = storage.getColor(handle.index);

      expect(color.r).toBe(1.0);
      expect(color.g).toBeCloseTo(0.5);
      expect(color.b).toBeCloseTo(0.25);
      expect(color.a).toBeCloseTo(0.8);
    });
  });

  describe("State Management", () => {
    it("should get and set entity state", () => {
      const handle = storage.allocate(0);
      storage.setId(handle.index, "entity_1");

      const state = {
        gridPos: { xgrid: 10.5, ygrid: 20.3, zheight: 5 },
        velocity: { x: 1, y: 2, z: 0 },
        rotation: Math.PI / 4,
        speed: 2.0,
        isMoving: true,
      };

      storage.setState(handle.index, state);
      const retrievedState = storage.getState(handle.index);

      expect(retrievedState.gridPos.xgrid).toBeCloseTo(10.5);
      expect(retrievedState.gridPos.ygrid).toBeCloseTo(20.3);
      expect(retrievedState.gridPos.zheight).toBeCloseTo(5);
      expect(retrievedState.velocity.x).toBeCloseTo(1);
      expect(retrievedState.velocity.y).toBeCloseTo(2);
      expect(retrievedState.rotation).toBeCloseTo(Math.PI / 4);
      expect(retrievedState.speed).toBeCloseTo(2.0);
      expect(retrievedState.isMoving).toBe(true);
    });

    it("should save current state as previous state", () => {
      const handle = storage.allocate(0);

      storage.setPosition(handle.index, 10, 20, 5);
      storage.setRotation(handle.index, Math.PI / 4);

      storage.saveState(handle.index);

      // Modify current state
      storage.setPosition(handle.index, 30, 40, 10);
      storage.setRotation(handle.index, Math.PI / 2);

      // Previous state should be unchanged
      const prevState = storage.getPreviousState(handle.index);
      expect(prevState.gridPos.xgrid).toBe(10);
      expect(prevState.gridPos.ygrid).toBe(20);
      expect(prevState.gridPos.zheight).toBe(5);
      expect(prevState.rotation).toBeCloseTo(Math.PI / 4);
    });

    it("should save all states in batch", () => {
      const handles = [
        storage.allocate(0),
        storage.allocate(0),
        storage.allocate(0),
      ];

      storage.setPosition(handles[0].index, 10, 20, 5);
      storage.setPosition(handles[1].index, 30, 40, 10);
      storage.setPosition(handles[2].index, 50, 60, 15);

      storage.saveAllStates();

      // Modify all entities
      storage.setPosition(handles[0].index, 100, 200, 50);
      storage.setPosition(handles[1].index, 300, 400, 100);
      storage.setPosition(handles[2].index, 500, 600, 150);

      // Previous states should be preserved
      expect(storage.getPreviousState(handles[0].index).gridPos.xgrid).toBe(10);
      expect(storage.getPreviousState(handles[1].index).gridPos.xgrid).toBe(30);
      expect(storage.getPreviousState(handles[2].index).gridPos.xgrid).toBe(50);
    });
  });

  describe("Velocity Update", () => {
    it("should update position based on velocity and delta time", () => {
      const handle = storage.allocate(0);
      storage.setPosition(handle.index, 0, 0, 0);
      storage.setVelocity(handle.index, 1, 2, 0);
      storage.setSpeed(handle.index, 10);

      const moved = storage.updateVelocity(handle.index, 0.1);

      expect(moved).toBe(true);
      const pos = storage.getPosition(handle.index);
      expect(pos.x).toBeCloseTo(1.0); // 1 * 10 * 0.1
      expect(pos.y).toBeCloseTo(2.0); // 2 * 10 * 0.1
    });

    it("should return false when not moving", () => {
      const handle = storage.allocate(0);
      storage.setVelocity(handle.index, 0, 0, 0);

      const moved = storage.updateVelocity(handle.index, 0.1);

      expect(moved).toBe(false);
    });
  });

  describe("Custom Properties", () => {
    it("should register and use custom properties", () => {
      storage.registerCustomProperty("health", Float32Array);
      storage.registerCustomProperty("mana", Uint32Array);

      const handle = storage.allocate(0);

      storage.setCustomProperty(handle.index, "health", 100.5);
      storage.setCustomProperty(handle.index, "mana", 50);

      expect(storage.getCustomProperty(handle.index, "health")).toBe(100.5);
      expect(storage.getCustomProperty(handle.index, "mana")).toBe(50);
    });

    it("should throw error when getting unregistered property", () => {
      const handle = storage.allocate(0);

      expect(() => {
        storage.getCustomProperty(handle.index, "unregistered");
      }).toThrow('Custom property "unregistered" not registered');
    });

    it("should throw error when setting unregistered property", () => {
      const handle = storage.allocate(0);

      expect(() => {
        storage.setCustomProperty(handle.index, "unregistered", 100);
      }).toThrow('Custom property "unregistered" not registered');
    });
  });

  describe("Query Operations", () => {
    it("should find entity by ID", () => {
      const handle1 = storage.allocate(0);
      storage.setId(handle1.index, "entity_1");

      const handle2 = storage.allocate(0);
      storage.setId(handle2.index, "entity_2");

      const found = storage.find("entity_1");
      expect(found).toBeDefined();
      expect(found?.index).toBe(handle1.index);
    });

    it("should return undefined for non-existent ID", () => {
      const found = storage.find("non_existent");
      expect(found).toBeUndefined();
    });

    it("should find all handles by type", () => {
      const type0 = 0;
      const type1 = 1;

      storage.allocate(type0);
      storage.allocate(type0);
      storage.allocate(type1);

      const type0Handles = storage.findHandlesByType(type0);
      const type1Handles = storage.findHandlesByType(type1);

      expect(type0Handles.length).toBe(2);
      expect(type1Handles.length).toBe(1);
    });

    it("should get all active handles", () => {
      const handle1 = storage.allocate(0);
      const handle2 = storage.allocate(0);

      const handles = storage.getAllHandles();

      expect(handles.length).toBe(2);
      expect(handles).toContainEqual(handle1);
      expect(handles).toContainEqual(handle2);
    });
  });

  describe("Direct Array Access", () => {
    it("should provide direct access to position array", () => {
      const handle = storage.allocate(0);
      storage.setPosition(handle.index, 10, 20, 5);

      const positions = storage.getPositions();

      expect(positions[0]).toBe(10);
      expect(positions[1]).toBe(20);
      expect(positions[2]).toBe(5);
    });

    it("should provide direct access to color array", () => {
      const handle = storage.allocate(0);
      storage.setColor(handle.index, 1.0, 0.5, 0.25, 0.8);

      const colors = storage.getColors();

      expect(colors[0]).toBe(1.0);
      expect(colors[1]).toBe(0.5);
      expect(colors[2]).toBe(0.25);
      expect(colors[3]).toBeCloseTo(0.8);
    });

    it("should provide direct access to texture ID array", () => {
      const handle = storage.allocate(0);
      storage.setTextureId(handle.index, 42);

      const texIds = storage.getTextureIds();

      expect(texIds[0]).toBe(42);
    });
  });

  describe("Handle Validation", () => {
    it("should detect stale handles", () => {
      const handle1 = storage.allocate(0);
      storage.deallocate(handle1);

      // Reuse the slot
      const handle2 = storage.allocate(0);

      expect(handle1.index).toBe(handle2.index);
      expect(handle1.generation).not.toBe(handle2.generation);

      // Old handle should be invalid
      expect(storage.isValidHandle(handle1)).toBe(false);
      expect(storage.isValidHandle(handle2)).toBe(true);
    });

    it("should invalidate handle after deallocation", () => {
      const handle = storage.allocate(0);

      expect(storage.isValidHandle(handle)).toBe(true);

      storage.deallocate(handle);

      expect(storage.isValidHandle(handle)).toBe(false);
    });

    it("should throw error when deallocating same handle twice", () => {
      const handle = storage.allocate(0);
      storage.deallocate(handle);

      expect(() => {
        storage.deallocate(handle);
      }).toThrow("already inactive");
    });

    it("should throw error when deallocating with stale handle", () => {
      const handle1 = storage.allocate(0);
      storage.deallocate(handle1);

      // Slot gets reused with new generation
      const handle2 = storage.allocate(0);

      // Old handle should now be stale
      expect(() => {
        storage.deallocate(handle1);
      }).toThrow("Stale handle");
    });

    it("should throw error when accessing inactive entity", () => {
      const handle = storage.allocate(0);
      storage.deallocate(handle);

      expect(() => {
        storage.getPosition(handle.index);
      }).toThrow("Entity at index");
    });
  });

  describe("Zero-Copy Buffer Access", () => {
    it("should provide zero-copy view into position array", () => {
      storage.allocate(0);
      storage.setPosition(0, 10, 20, 5);

      const positions = storage.getPositions();
      const view = positions.subarray(0, 3);

      // Verify it's a view (not a copy)
      expect(view.buffer).toBe(positions.buffer);
      expect(view.byteOffset).toBe(0);

      expect(view[0]).toBe(10);
      expect(view[1]).toBe(20);
      expect(view[2]).toBe(5);
    });
  });
});
