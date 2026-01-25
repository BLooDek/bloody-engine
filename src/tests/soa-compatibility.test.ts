/**
 * API Compatibility Tests for SoA Refactor
 *
 * These tests ensure that the refactored Entity and EntityManager classes
 * maintain full backward compatibility with the existing API.
 */

import { describe, it, expect, beforeEach } from "vitest";
import { EntityManager } from "../simulation/entity-manager";
import type { EntityState } from "../simulation/entity";

describe("SoA API Compatibility", () => {
  let manager: EntityManager;

  beforeEach(() => {
    manager = new EntityManager();
  });

  describe("Entity Creation", () => {
    it("should create entity with type", () => {
      const entity = manager.createEntity("player");

      expect(entity.id).toBeDefined();
      expect(entity.type).toBe("player");
    });

    it("should create entity with initial state", () => {
      const entity = manager.createEntity("player", {
        gridPos: { xgrid: 10, ygrid: 20, zheight: 5 },
        speed: 2.0,
      });

      expect(entity.state.gridPos.xgrid).toBe(10);
      expect(entity.state.gridPos.ygrid).toBe(20);
      expect(entity.state.speed).toBe(2.0);
    });

    it("should generate unique IDs", () => {
      const entity1 = manager.createEntity("player");
      const entity2 = manager.createEntity("player");

      expect(entity1.id).not.toBe(entity2.id);
    });
  });

  describe("Entity State Access", () => {
    it("should provide read-only access to current state", () => {
      const entity = manager.createEntity("player", {
        gridPos: { xgrid: 10, ygrid: 20, zheight: 5 },
      });

      const state = entity.state;

      expect(state.gridPos.xgrid).toBe(10);
      expect(state.gridPos.ygrid).toBe(20);
      expect(state.gridPos.zheight).toBe(5);
    });

    it("should provide read-only access to previous state", () => {
      const entity = manager.createEntity("player", {
        gridPos: { xgrid: 10, ygrid: 20, zheight: 5 },
      });

      entity.saveState();
      entity.setGridPos(30, 40, 10);

      const prevState = entity.previousState;

      expect(prevState.gridPos.xgrid).toBe(10);
      expect(prevState.gridPos.ygrid).toBe(20);
      expect(prevState.gridPos.zheight).toBe(5);

      expect(entity.state.gridPos.xgrid).toBe(30);
      expect(entity.state.gridPos.ygrid).toBe(40);
    });
  });

  describe("Position Operations", () => {
    it("should get position as floats", () => {
      const entity = manager.createEntity("player", {
        gridPos: { xgrid: 10.5, ygrid: 20.3, zheight: 5.1 },
      });

      const pos = entity.getPosition();

      expect(pos.x).toBe(10.5);
      expect(pos.y).toBeCloseTo(20.3);
      expect(pos.z).toBeCloseTo(5.1);
    });

    it("should get grid position as integers", () => {
      const entity = manager.createEntity("player", {
        gridPos: { xgrid: 10.7, ygrid: 20.3, zheight: 5.9 },
      });

      const gridPos = entity.getGridPos();

      expect(gridPos.x).toBe(Math.floor(10.7));
      expect(gridPos.y).toBe(Math.floor(20.3));
      expect(gridPos.z).toBe(Math.floor(5.9));
    });

    it("should get rounded grid position", () => {
      const entity = manager.createEntity("player", {
        gridPos: { xgrid: 10.4, ygrid: 20.6, zheight: 5.5 },
      });

      const roundedPos = entity.getRoundedGridPos();

      expect(roundedPos.x).toBe(Math.round(10.4));
      expect(roundedPos.y).toBe(Math.round(20.6));
      expect(roundedPos.z).toBe(Math.round(5.5));
    });

    it("should set grid position", () => {
      const entity = manager.createEntity("player");

      entity.setGridPos(50, 60, 10);

      expect(entity.state.gridPos.xgrid).toBe(50);
      expect(entity.state.gridPos.ygrid).toBe(60);
      expect(entity.state.gridPos.zheight).toBe(10);
    });

    it("should move by relative amount", () => {
      const entity = manager.createEntity("player", {
        gridPos: { xgrid: 10, ygrid: 20, zheight: 5 },
      });

      entity.move(5, -3, 2);

      expect(entity.state.gridPos.xgrid).toBe(15);
      expect(entity.state.gridPos.ygrid).toBe(17);
      expect(entity.state.gridPos.zheight).toBe(7);
    });

    it("should move by integer grid cells", () => {
      const entity = manager.createEntity("player", {
        gridPos: { xgrid: 10.5, ygrid: 20.5, zheight: 5 },
      });

      entity.moveGridCells(2, 3, 1);

      expect(entity.state.gridPos.xgrid).toBe(12.5);
      expect(entity.state.gridPos.ygrid).toBe(23.5);
      expect(entity.state.gridPos.zheight).toBe(6);
    });
  });

  describe("Velocity Operations", () => {
    it("should set velocity", () => {
      const entity = manager.createEntity("player");

      entity.setVelocity(1.5, 2.0, 0.5);

      expect(entity.state.velocity.x).toBe(1.5);
      expect(entity.state.velocity.y).toBe(2.0);
      expect(entity.state.velocity.z).toBe(0.5);
    });

    it("should update isMoving flag based on velocity", () => {
      const entity = manager.createEntity("player");

      entity.setVelocity(1, 0, 0);
      expect(entity.state.isMoving).toBe(true);

      entity.setVelocity(0, 0, 0);
      expect(entity.state.isMoving).toBe(false);
    });

    it("should update position based on velocity", () => {
      const entity = manager.createEntity("player", {
        gridPos: { xgrid: 0, ygrid: 0, zheight: 0 },
      });

      entity.setVelocity(1, 2, 0);
      entity.setSpeed(10);

      entity.updateVelocity(0.1);

      expect(entity.state.gridPos.xgrid).toBeCloseTo(1.0);
      expect(entity.state.gridPos.ygrid).toBeCloseTo(2.0);
    });
  });

  describe("Rotation and Speed", () => {
    it("should set rotation", () => {
      const entity = manager.createEntity("player");

      entity.setRotation(Math.PI / 4);

      expect(entity.state.rotation).toBeCloseTo(Math.PI / 4);
    });

    it("should set speed", () => {
      const entity = manager.createEntity("player");

      entity.setSpeed(2.5);

      expect(entity.state.speed).toBe(2.5);
    });

    it("should clamp negative speed to 0", () => {
      const entity = manager.createEntity("player");

      entity.setSpeed(-1);

      expect(entity.state.speed).toBe(0);
    });
  });

  describe("Entity Queries", () => {
    beforeEach(() => {
      manager.createEntity("player", {
        gridPos: { xgrid: 0, ygrid: 0, zheight: 0 },
      });
      manager.createEntity("player", {
        gridPos: { xgrid: 10, ygrid: 10, zheight: 0 },
      });
      manager.createEntity("enemy", {
        gridPos: { xgrid: 100, ygrid: 100, zheight: 0 },
      });
    });

    it("should get entity by ID", () => {
      const entity = manager.createEntity("player");
      const found = manager.getEntity(entity.id);

      expect(found).toBeDefined();
      expect(found?.id).toBe(entity.id);
    });

    it("should return undefined for non-existent entity", () => {
      const found = manager.getEntity("non_existent");
      expect(found).toBeUndefined();
    });

    it("should get all entities", () => {
      const allEntities = manager.getAllEntities();

      expect(allEntities.length).toBe(3);
    });

    it("should get entities by type", () => {
      const players = manager.getEntitiesByType("player");
      const enemies = manager.getEntitiesByType("enemy");

      expect(players.length).toBe(2);
      expect(enemies.length).toBe(1);
    });

    it("should query entities with filter", () => {
      const results = manager.queryEntities({
        type: "player",
        position: { minX: 0, maxX: 10, minY: 0, maxY: 10 },
      });

      // Both players at (0,0) and (10,10) are within bounds
      expect(results.length).toBe(2);
    });

    it("should get entities in range", () => {
      const nearby = manager.getEntitiesInRange(5, 5, 10);

      // Both players at (0,0) and (10,10) are within range 10 of (5,5)
      expect(nearby.length).toBe(2);
    });
  });

  describe("Entity Removal", () => {
    it("should remove entity by ID", () => {
      const entity = manager.createEntity("player");

      const removed = manager.removeEntity(entity.id);

      expect(removed).toBe(true);
      expect(manager.getEntity(entity.id)).toBeUndefined();
    });

    it("should return false when removing non-existent entity", () => {
      const removed = manager.removeEntity("non_existent");

      expect(removed).toBe(false);
    });

    it("should check if entity exists", () => {
      const entity = manager.createEntity("player");

      expect(manager.hasEntity(entity.id)).toBe(true);

      manager.removeEntity(entity.id);

      expect(manager.hasEntity(entity.id)).toBe(false);
    });
  });

  describe("Batch Operations", () => {
    it("should save all states", () => {
      const entity1 = manager.createEntity("player", {
        gridPos: { xgrid: 10, ygrid: 20, zheight: 5 },
      });
      const entity2 = manager.createEntity("enemy", {
        gridPos: { xgrid: 30, ygrid: 40, zheight: 10 },
      });

      manager.saveAllStates();

      // Modify entities
      entity1.setGridPos(100, 200, 50);
      entity2.setGridPos(300, 400, 100);

      // Previous states should be preserved
      expect(entity1.previousState.gridPos.xgrid).toBe(10);
      expect(entity2.previousState.gridPos.xgrid).toBe(30);
    });

    it("should clear all entities", () => {
      manager.createEntity("player");
      manager.createEntity("enemy");

      expect(manager.count).toBe(2);

      manager.clear();

      expect(manager.count).toBe(0);
    });

    it("should get entity count", () => {
      manager.createEntity("player");
      manager.createEntity("enemy");

      expect(manager.count).toBe(2);
    });
  });

  describe("Serialization", () => {
    it("should serialize entity", () => {
      const entity = manager.createEntity("player", {
        gridPos: { xgrid: 10, ygrid: 20, zheight: 5 },
      });

      const serialized = entity.serialize();

      expect(typeof serialized).toBe("string");

      const parsed = JSON.parse(serialized);
      expect(parsed.id).toBe(entity.id);
      expect(parsed.type).toBe("player");
      expect(parsed.state.gridPos.xgrid).toBe(10);
    });

    it("should serialize all entities", () => {
      manager.createEntity("player");
      manager.createEntity("enemy");

      const serialized = manager.serializeAll();

      expect(serialized.length).toBe(2);
    });

    it("should deserialize entities", () => {
      const entity1 = manager.createEntity("player", {
        gridPos: { xgrid: 10, ygrid: 20, zheight: 5 },
      });
      const entity2 = manager.createEntity("enemy", {
        gridPos: { xgrid: 30, ygrid: 40, zheight: 10 },
      });

      const serialized = manager.serializeAll();
      const newManager = EntityManager.deserializeAll(serialized);

      expect(newManager.count).toBe(2);

      const restoredPlayer = newManager.getEntity(entity1.id);
      expect(restoredPlayer?.state.gridPos.xgrid).toBe(10);

      const restoredEnemy = newManager.getEntity(entity2.id);
      expect(restoredEnemy?.state.gridPos.xgrid).toBe(30);
    });
  });

  describe("State Restoration", () => {
    it("should restore entity state", () => {
      const entity = manager.createEntity("player", {
        gridPos: { xgrid: 10, ygrid: 20, zheight: 5 },
      });

      const newState: Partial<EntityState> = {
        gridPos: { xgrid: 50, ygrid: 60, zheight: 10 },
        speed: 2.0,
      };

      entity.restoreState(newState as EntityState);

      expect(entity.state.gridPos.xgrid).toBe(50);
      expect(entity.state.speed).toBe(2.0);
    });

    it("should restore snapshot in manager", () => {
      const entity1 = manager.createEntity("player", {
        gridPos: { xgrid: 10, ygrid: 20, zheight: 5 },
      });
      const entity2 = manager.createEntity("enemy", {
        gridPos: { xgrid: 30, ygrid: 40, zheight: 10 },
      });

      // Create snapshot
      const snapshot = new Map<string, EntityState>();
      snapshot.set(entity1.id, entity1.getStateCopy());
      snapshot.set(entity2.id, entity2.getStateCopy());

      // Modify entities
      entity1.setGridPos(100, 200, 50);
      entity2.setGridPos(300, 400, 100);

      // Restore from snapshot
      manager.restoreSnapshot(snapshot);

      expect(entity1.state.gridPos.xgrid).toBe(10);
      expect(entity2.state.gridPos.xgrid).toBe(30);
    });
  });

  describe("Statistics", () => {
    it("should get entity stats", () => {
      manager.createEntity("player");
      manager.createEntity("player");
      manager.createEntity("enemy");

      const stats = manager.getStats();

      expect(stats.total).toBe(3);
      expect(stats.byType.player).toBe(2);
      expect(stats.byType.enemy).toBe(1);
    });
  });

  describe("Custom Properties", () => {
    it("should register custom property", () => {
      manager.registerCustomProperty("health", Float32Array);

      const entity = manager.createEntity("player");

      // Access storage to set custom property
      const storage = (manager as any).getStorage();
      const handle = (entity as any).getHandle();

      storage.setCustomProperty(handle.index, "health", 100);

      expect(storage.getCustomProperty(handle.index, "health")).toBe(100);
    });
  });

  describe("Error Handling", () => {
    it("should throw error when adding duplicate entity", () => {
      const entity = manager.createEntity("player");

      // Try to add entity with same ID
      expect(() => {
        (manager as any).addEntity(entity);
      }).toThrow();
    });

    it("should handle getting non-existent entity gracefully", () => {
      const entity = manager.getEntity("non_existent");

      expect(entity).toBeUndefined();
    });
  });

  describe("Backward Compatibility", () => {
    it("should support existing usage patterns", () => {
      // Old AoS-style usage
      const entity = manager.createEntity("player", {
        gridPos: { xgrid: 10, ygrid: 20, zheight: 5 },
        speed: 2.0,
      });

      // All these should work unchanged
      expect(entity.id).toBeDefined();
      expect(entity.type).toBe("player");

      entity.setGridPos(50, 60, 10);
      expect(entity.state.gridPos.xgrid).toBe(50);

      entity.move(5, 5, 0);
      expect(entity.state.gridPos.xgrid).toBe(55);

      entity.setVelocity(1, 0, 0);
      expect(entity.state.velocity.x).toBe(1);
      expect(entity.state.isMoving).toBe(true);

      entity.setRotation(Math.PI / 2);
      expect(entity.state.rotation).toBeCloseTo(Math.PI / 2);

      entity.setSpeed(3.0);
      expect(entity.state.speed).toBe(3.0);

      entity.saveState();
      entity.setGridPos(100, 100, 0);
      expect(entity.previousState.gridPos.xgrid).toBe(55);
    });
  });
});
