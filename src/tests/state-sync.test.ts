/**
 * State Synchronization Integration Test
 *
 * Tests the complete state synchronization pipeline:
 * 1. Binary serialization
 * 2. State snapshots
 * 3. Client-side prediction
 * 4. Server reconciliation
 *
 * Run with: npm run test:state-sync
 */

/// <reference types="vitest/globals" />

import {
  BinarySerializer,
  BinaryReader,
  EntitySerializer,
  StateSnapshot,
  SnapshotManager,
  PredictedInputBuffer,
} from "../networking";
import { Entity, EntityManager, SimulationLoop } from "../simulation";
import { CommandQueue, CommandType } from "../input";

describe("State Synchronization Integration", () => {
  describe("Binary Serialization", () => {
    it("should serialize and deserialize a single entity", async () => {
      // Create entity
      const entity = new Entity("test_entity", "player", {
        gridPos: { xgrid: 10, ygrid: 20, zheight: 5 },
        velocity: { x: 1, y: 0, z: 0 },
        rotation: Math.PI / 4,
        speed: 2.5,
        isMoving: true,
      });

      // Serialize
      const serialized = await entity.serializeBinary();

      // Deserialize
      const deserialized = await Entity.deserializeBinary(serialized);

      // Verify
      expect(deserialized.id).toBe(entity.id);
      expect(deserialized.type).toBe(entity.type);
      expect(deserialized.state.gridPos.xgrid).toBeCloseTo(entity.state.gridPos.xgrid);
      expect(deserialized.state.gridPos.ygrid).toBeCloseTo(entity.state.gridPos.ygrid);
      expect(deserialized.state.gridPos.zheight).toBeCloseTo(
        entity.state.gridPos.zheight,
      );
      expect(deserialized.state.velocity.x).toBeCloseTo(entity.state.velocity.x);
      expect(deserialized.state.velocity.y).toBeCloseTo(entity.state.velocity.y);
      expect(deserialized.state.velocity.z).toBeCloseTo(entity.state.velocity.z);
      expect(deserialized.state.rotation).toBeCloseTo(entity.state.rotation);
      expect(deserialized.state.speed).toBeCloseTo(entity.state.speed);
      expect(deserialized.state.isMoving).toBe(entity.state.isMoving);
    });

    it("should serialize multiple entities", async () => {
      const entities: Entity[] = [
        new Entity("entity1", "player", {
          gridPos: { xgrid: 0, ygrid: 0, zheight: 0 },
        }),
        new Entity("entity2", "enemy", {
          gridPos: { xgrid: 100, ygrid: 200, zheight: 10 },
          velocity: { x: -1, y: 1, z: 0 },
        }),
      ];

      const serialized = EntitySerializer.serializeEntities(entities);
      const deserialized = await EntitySerializer.deserializeEntities(serialized);

      expect(deserialized.length).toBe(entities.length);

      for (let i = 0; i < entities.length; i++) {
        expect(deserialized[i].id).toBe(entities[i].id);
        expect(deserialized[i].type).toBe(entities[i].type);
      }
    });

    it("should produce smaller binary output than JSON", async () => {
      const entity = new Entity("test_entity", "player", {
        gridPos: { xgrid: 10, ygrid: 20, zheight: 5 },
        velocity: { x: 1, y: 0, z: 0 },
        rotation: Math.PI / 4,
        speed: 2.5,
        isMoving: true,
      });

      const jsonSize = entity.serialize().length;
      const binarySize = (await entity.serializeBinary()).length;

      expect(binarySize).toBeLessThan(jsonSize);
      console.log(
        `JSON: ${jsonSize} bytes, Binary: ${binarySize} bytes (${Math.round((1 - binarySize / jsonSize) * 100)}% reduction)`,
      );
    });

    it("should handle all primitive types in BinarySerializer", () => {
      const serializer = new BinarySerializer();

      // Write various types
      serializer.writeUint8(255);
      serializer.writeUint16(65535);
      serializer.writeUint32(4294967295);
      serializer.writeInt32(-2147483648);
      serializer.writeFloat32(3.14159);
      serializer.writeBoolean(true);
      serializer.writeString("Hello, World!");

      const buffer = serializer.toBuffer();
      const reader = new BinaryReader(buffer);

      expect(reader.readUint8()).toBe(255);
      expect(reader.readUint16()).toBe(65535);
      expect(reader.readUint32()).toBe(4294967295);
      expect(reader.readInt32()).toBe(-2147483648);
      expect(reader.readFloat32()).toBeCloseTo(3.14159, 5);
      expect(reader.readBoolean()).toBe(true);
      expect(reader.readString()).toBe("Hello, World!");
      expect(reader.isAtEnd()).toBe(true);
    });
  });

  describe("State Snapshots", () => {
    let entities: Entity[];

    beforeEach(() => {
      entities = [
        new Entity("player1", "player", {
          gridPos: { xgrid: 10, ygrid: 10, zheight: 0 },
        }),
        new Entity("enemy1", "enemy", {
          gridPos: { xgrid: 50, ygrid: 50, zheight: 0 },
        }),
      ];
    });

    it("should create and retrieve snapshots", () => {
      const snapshot = StateSnapshot.fromEntities(100, entities);

      expect(snapshot.tick).toBe(100);
      expect(snapshot.size).toBe(2);

      const playerState = snapshot.getEntityState("player1");
      expect(playerState).toBeDefined();
      expect(playerState!.gridPos.xgrid).toBe(10);
    });

    it("should clone snapshots immutably", () => {
      const snapshot = StateSnapshot.fromEntities(100, entities);
      const cloned = snapshot.clone();

      expect(cloned.tick).toBe(snapshot.tick);
      expect(cloned.size).toBe(snapshot.size);
      expect(cloned).not.toBe(snapshot);
    });

    it("should filter snapshots by entity IDs", () => {
      const snapshot = StateSnapshot.fromEntities(100, entities);
      const filtered = snapshot.filter(["player1"]);

      expect(filtered.size).toBe(1);
      expect(filtered.hasEntity("player1")).toBe(true);
      expect(filtered.hasEntity("enemy1")).toBe(false);
    });

    it("should merge snapshots", () => {
      const snapshot1 = StateSnapshot.fromEntities(100, [entities[0]]);
      const snapshot2 = StateSnapshot.fromEntities(101, [entities[1]]);

      const merged = snapshot1.merge(snapshot2);

      expect(merged.size).toBe(2);
      expect(merged.hasEntity("player1")).toBe(true);
      expect(merged.hasEntity("enemy1")).toBe(true);
    });
  });

  describe("Snapshot Manager", () => {
    let entities: Entity[];
    let manager: SnapshotManager;

    beforeEach(() => {
      entities = [
        new Entity("player1", "player", {
          gridPos: { xgrid: 10, ygrid: 10, zheight: 0 },
        }),
        new Entity("enemy1", "enemy", {
          gridPos: { xgrid: 50, ygrid: 50, zheight: 0 },
        }),
      ];

      manager = new SnapshotManager({
        maxSnapshots: 10,
        snapshotInterval: 1,
      });
    });

    it("should save and retrieve snapshots", () => {
      manager.saveSnapshot(100, entities);
      manager.saveSnapshot(101, entities);
      manager.saveSnapshot(102, entities);

      expect(manager.getSnapshotCount()).toBe(3);
      expect(manager.hasSnapshot(101)).toBe(true);

      const snapshot = manager.getSnapshot(101);
      expect(snapshot).toBeDefined();
      expect(snapshot!.tick).toBe(101);
    });

    it("should use circular buffer for bounded memory", () => {
      // Fill beyond capacity
      for (let i = 0; i < 15; i++) {
        manager.saveSnapshot(i, entities);
      }

      // Should only keep maxSnapshots (10)
      expect(manager.getSnapshotCount()).toBe(10);
      expect(manager.hasSnapshot(0)).toBe(false); // Oldest evicted
      expect(manager.hasSnapshot(14)).toBe(true); // Newest present
    });

    it("should get snapshots in range", () => {
      for (let i = 100; i < 110; i++) {
        manager.saveSnapshot(i, entities);
      }

      const range = manager.getSnapshotsInRange(102, 105);
      expect(range.length).toBe(4);
      expect(range[0].tick).toBe(102);
      expect(range[3].tick).toBe(105);
    });

    it("should get nearest snapshot before tick", () => {
      manager.saveSnapshot(100, entities);
      manager.saveSnapshot(105, entities);
      manager.saveSnapshot(110, entities);

      const before = manager.getSnapshotBefore(107);
      expect(before).toBeDefined();
      expect(before!.tick).toBe(105);
    });

    it("should track memory usage", () => {
      for (let i = 0; i < 5; i++) {
        manager.saveSnapshot(i, entities);
      }

      const stats = manager.getMemoryStats();
      expect(stats.snapshotCount).toBe(5);
      expect(stats.totalEntities).toBe(10); // 5 snapshots × 2 entities
      expect(stats.estimatedBytes).toBeGreaterThan(0);
    });
  });

  describe("Predicted Input Buffer", () => {
    let buffer: PredictedInputBuffer;

    beforeEach(() => {
      buffer = new PredictedInputBuffer();
    });

    it("should store and retrieve commands", () => {
      const command1 = {
        type: CommandType.MOVE,
        tick: 100,
        direction: "N",
      } as any;
      const command2 = {
        type: CommandType.MOVE,
        tick: 101,
        direction: "E",
      } as any;

      buffer.addCommand(100, command1);
      buffer.addCommand(101, command2);

      expect(buffer.hasTick(100)).toBe(true);
      expect(buffer.hasTick(101)).toBe(true);

      const commands = buffer.getCommandsInRange(100, 101);
      expect(commands.length).toBe(2);
    });

    it("should mark commands as processed", () => {
      const command = {
        type: CommandType.MOVE,
        tick: 100,
        direction: "N",
      } as any;

      buffer.addCommand(100, command);
      expect(buffer.getStats().unprocessedCommands).toBe(1);

      buffer.markProcessed(100);
      expect(buffer.getStats().unprocessedCommands).toBe(0);
    });

    it("should remove old commands", () => {
      for (let i = 0; i < 100; i++) {
        buffer.addCommand(i, { type: CommandType.MOVE, tick: i } as any);
      }

      expect(buffer.getTotalCommands()).toBe(100);

      buffer.removeUpTo(49);
      expect(buffer.getTotalCommands()).toBe(50);
      expect(buffer.getOldestTick()).toBe(50);
    });

    it("should track bounds correctly", () => {
      buffer.addCommand(50, { type: CommandType.MOVE, tick: 50 } as any);
      buffer.addCommand(100, { type: CommandType.MOVE, tick: 100 } as any);

      expect(buffer.getOldestTick()).toBe(50);
      expect(buffer.getNewestTick()).toBe(100);
    });
  });

  describe("End-to-End Integration", () => {
    it("should serialize world state and restore it", async () => {
      // Create a world with multiple entities
      const manager1 = new EntityManager();
      const player = manager1.createEntity("player", {
        gridPos: { xgrid: 0, ygrid: 0, zheight: 0 },
      });
      const enemy = manager1.createEntity("enemy", {
        gridPos: { xgrid: 100, ygrid: 100, zheight: 0 },
      });

      // Serialize
      const serialized = await manager1.serializeAllBinary();

      // Deserialize into new manager
      const manager2 = await EntityManager.deserializeAllBinary(serialized);

      // Verify all entities restored
      expect(manager2.count).toBe(manager1.count);

      const restoredPlayer = manager2.getEntity(player.id);
      const restoredEnemy = manager2.getEntity(enemy.id);

      expect(restoredPlayer).toBeDefined();
      expect(restoredEnemy).toBeDefined();

      if (restoredPlayer && restoredEnemy) {
        expect(restoredPlayer.id).toBe(player.id);
        expect(restoredPlayer.type).toBe(player.type);
        expect(restoredPlayer.state.gridPos.xgrid).toBe(
          player.state.gridPos.xgrid,
        );

        expect(restoredEnemy.id).toBe(enemy.id);
        expect(restoredEnemy.type).toBe(enemy.type);
      }
    });

    it("should create snapshots and restore entity state", () => {
      const manager = new EntityManager();
      const entity = manager.createEntity("player", {
        gridPos: { xgrid: 10, ygrid: 20, zheight: 5 },
        velocity: { x: 1, y: 0, z: 0 },
      });

      // Create snapshot
      const snapshot = StateSnapshot.fromEntities(
        100,
        manager.getAllEntities(),
      );

      // Modify entity
      entity.setGridPos(50, 60, 10);
      entity.setVelocity(-1, -1, 0);

      // Restore from snapshot
      const state = snapshot.getEntityState(entity.id);
      expect(state).toBeDefined();

      if (state) {
        entity.restoreState(state);
        expect(entity.state.gridPos.xgrid).toBe(10);
        expect(entity.state.velocity.x).toBe(1);
      }
    });

    it("should support snapshot-based rollback", () => {
      const commandQueue = new CommandQueue();
      const simLoop = new SimulationLoop(commandQueue);
      const snapshotManager = new SnapshotManager();

      // Create player
      const player = simLoop.createPlayer(0, 0, 0);

      // Save initial snapshot
      snapshotManager.saveSnapshot(0, simLoop.entities.getAllEntities());
      const initialX = player.state.gridPos.xgrid;

      // Simulate some ticks
      for (let i = 0; i < 10; i++) {
        commandQueue.enqueue({
          type: CommandType.MOVE_EAST,
          tick: i,
        } as any);
        simLoop.update(0.05);

        if (i % 2 === 0) {
          snapshotManager.saveSnapshot(
            i + 1,
            simLoop.entities.getAllEntities(),
          );
        }
      }

      const movedX = player.state.gridPos.xgrid;
      expect(movedX).toBeGreaterThan(initialX);

      // Rollback to tick 5
      const snapshot = snapshotManager.getSnapshot(5);
      expect(snapshot).toBeDefined();

      if (snapshot) {
        const state = snapshot.getEntityState(player.id);
        if (state) {
          player.restoreState(state);
          expect(player.state.gridPos.xgrid).toBeLessThan(movedX);
        }
      }
    });
  });
});
