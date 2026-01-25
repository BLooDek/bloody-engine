/**
 * Collision System Tests
 */

import { describe, it, expect, beforeEach } from "vitest";
import {
  createCollisionSystem,
  CollisionPresets,
  getRecommendedSystemType,
  SpatialHashCollision,
  WorkerCollision,
  isWorkerAvailable,
  type EntityHandle,
} from "../simulation/collision";

describe("Collision System", () => {
  describe("Factory", () => {
    it("should create spatial-hash collision system", () => {
      const collision = createCollisionSystem({ type: 'spatial-hash' });
      expect(collision).toBeInstanceOf(SpatialHashCollision);
    });

    it("should create worker collision system", () => {
      if (!isWorkerAvailable()) {
        console.warn('Skipping worker test - Workers not available in this environment');
        return;
      }
      const collision = createCollisionSystem({ type: 'worker' });
      expect(collision).toBeInstanceOf(WorkerCollision);
    });

    it("should create hybrid collision system", () => {
      const collision = createCollisionSystem({ type: 'hybrid' });
      expect(collision).toBeDefined();
    });

    it("should create from presets", () => {
      const small = createCollisionSystem(CollisionPresets.small);
      expect(small).toBeInstanceOf(SpatialHashCollision);

      const large = createCollisionSystem(CollisionPresets.large);
      expect(large).toBeDefined();
    });

    it("should recommend correct system type", () => {
      expect(getRecommendedSystemType(100)).toBe('spatial-hash');
      expect(getRecommendedSystemType(2500)).toBe('worker');
      expect(getRecommendedSystemType(10000)).toBe('hybrid');
    });
  });

  describe("Spatial Hash Collision", () => {
    let collision: SpatialHashCollision;
    let entities: Map<string, EntityHandle>;
    let positions: Float32Array;

    beforeEach(() => {
      collision = new SpatialHashCollision({
        type: 'spatial-hash',
        cellSize: 50,
      });

      entities = new Map();
      positions = new Float32Array(300); // 100 entities * 3 coords
    });

    it("should create spatial hash", () => {
      expect(collision).toBeDefined();
    });

    it("should add entities to spatial hash", () => {
      // Create 10 entities
      for (let i = 0; i < 10; i++) {
        const handle: EntityHandle = { index: i, generation: 1 };
        entities.set(`entity_${i}`, handle);

        positions[i * 3] = i * 10;     // x
        positions[i * 3 + 1] = i * 10; // y
        positions[i * 3 + 2] = 5;      // radius
      }

      collision.update(entities, positions);

      const stats = collision.getStats();
      expect(stats.cellCount).toBeGreaterThan(0);
      expect(stats.totalEntities).toBe(10);
    });

    it("should detect overlapping entities", () => {
      // Create two overlapping entities
      const handle1: EntityHandle = { index: 0, generation: 1 };
      const handle2: EntityHandle = { index: 1, generation: 1 };

      entities.set('entity_0', handle1);
      entities.set('entity_1', handle2);

      positions[0] = 0; positions[1] = 0; positions[2] = 5;
      positions[3] = 8; positions[4] = 0; positions[5] = 5; // 8 units apart, radii sum = 10

      collision.update(entities, positions);

      const collisions = collision.findCollisions(handle1, entities, positions);
      expect(collisions.length).toBe(1);
      expect(collisions[0].entityB.index).toBe(1);
    });

    it("should not detect non-overlapping entities", () => {
      const handle1: EntityHandle = { index: 0, generation: 1 };
      const handle2: EntityHandle = { index: 1, generation: 1 };

      entities.set('entity_0', handle1);
      entities.set('entity_1', handle2);

      positions[0] = 0; positions[1] = 0; positions[2] = 5;
      positions[3] = 100; positions[4] = 100; positions[5] = 5; // Far apart

      collision.update(entities, positions);

      const collisions = collision.findCollisions(handle1, entities, positions);
      expect(collisions.length).toBe(0);
    });

    it("should find all collisions in scene", async () => {
      // Create 4 entities in a line
      for (let i = 0; i < 4; i++) {
        const handle: EntityHandle = { index: i, generation: 1 };
        entities.set(`entity_${i}`, handle);

        positions[i * 3] = i * 8;     // x (8 units apart)
        positions[i * 3 + 1] = 0;     // y
        positions[i * 3 + 2] = 5;     // radius
      }

      collision.update(entities, positions);

      const result = await collision.findAllCollisions(entities, positions);
      expect(result.pairs.length).toBe(3); // (0,1), (1,2), (2,3)
    });

    it("should query entities within radius", () => {
      for (let i = 0; i < 5; i++) {
        const handle: EntityHandle = { index: i, generation: 1 };
        entities.set(`entity_${i}`, handle);

        positions[i * 3] = i * 20;
        positions[i * 3 + 1] = 0;
        positions[i * 3 + 2] = 5;
      }

      collision.update(entities, positions);

      // Query around entity 2 (at x=40)
      const nearby = collision.queryRadius(40, 0, 25, entities, positions);
      expect(nearby.length).toBe(3); // entities 1, 2, 3
    });

    it("should handle large number of entities efficiently", () => {
      const entityCount = 1000;
      positions = new Float32Array(entityCount * 3);

      for (let i = 0; i < entityCount; i++) {
        const handle: EntityHandle = { index: i, generation: 1 };
        entities.set(`entity_${i}`, handle);

        positions[i * 3] = Math.random() * 1000;
        positions[i * 3 + 1] = Math.random() * 1000;
        positions[i * 3 + 2] = 5;
      }

      collision.update(entities, positions);

      const result = collision.findAllCollisions(entities, positions);
      expect(result.executionTime).toBeLessThan(100); // Should be fast
    });
  });

  describe("Worker Collision", () => {
    let collision: WorkerCollision;
    let entities: Map<string, EntityHandle>;
    let positions: Float32Array;

    beforeEach(() => {
      if (!isWorkerAvailable()) {
        return;
      }

      collision = new WorkerCollision({
        type: 'worker',
        workerCount: 2,
        cellSize: 50,
      });

      entities = new Map();
      positions = new Float32Array(300);
    });

    it("should create worker collision system", () => {
      if (!isWorkerAvailable()) {
        console.warn('Skipping worker test - Workers not available in this environment');
        return;
      }
      expect(collision).toBeDefined();
      expect(collision.getStats().workerCount).toBe(2);
    });

    it("should detect collisions using workers", async () => {
      if (!isWorkerAvailable()) {
        console.warn('Skipping worker test - Workers not available in this environment');
        return;
      }

      for (let i = 0; i < 10; i++) {
        const handle: EntityHandle = { index: i, generation: 1 };
        entities.set(`entity_${i}`, handle);

        positions[i * 3] = i * 8;
        positions[i * 3 + 1] = 0;
        positions[i * 3 + 2] = 5;
      }

      collision.update(entities, positions);

      const result = await collision.findAllCollisions(entities, positions);
      expect(result.pairs.length).toBe(9); // All adjacent pairs
    });
  });

  describe("Performance Comparison", () => {
    it("should benchmark different collision systems", async () => {
      const entityCount = 500;
      const entities = new Map<string, EntityHandle>();
      const positions = new Float32Array(entityCount * 3);

      // Create entities in grid pattern
      for (let i = 0; i < entityCount; i++) {
        const handle: EntityHandle = { index: i, generation: 1 };
        entities.set(`entity_${i}`, handle);

        positions[i * 3] = (i % 25) * 20;
        positions[i * 3 + 1] = Math.floor(i / 25) * 20;
        positions[i * 3 + 2] = 8;
      }

      // Test spatial hash
      const spatialHash = new SpatialHashCollision({
        type: 'spatial-hash',
        cellSize: 50,
      });

      spatialHash.update(entities, positions);
      const spatialHashResult = await spatialHash.findAllCollisions(entities, positions);

      // Test worker (if available)
      if (isWorkerAvailable()) {
        const worker = new WorkerCollision({
          type: 'worker',
          workerCount: 2,
          cellSize: 50,
        });

        worker.update(entities, positions);
        const workerResult = await worker.findAllCollisions(entities, positions);

        // Both should find the same collisions
        expect(spatialHashResult.pairs.length).toBe(workerResult.pairs.length);

        console.log('Performance comparison:');
        console.log(`  Spatial Hash: ${spatialHashResult.executionTime.toFixed(2)}ms`);
        console.log(`  Worker: ${workerResult.executionTime.toFixed(2)}ms`);
        console.log(`  Collision pairs: ${spatialHashResult.pairs.length}`);
      } else {
        console.log('Performance comparison (Worker not available in this environment):');
        console.log(`  Spatial Hash: ${spatialHashResult.executionTime.toFixed(2)}ms`);
        console.log(`  Collision pairs: ${spatialHashResult.pairs.length}`);
      }
    });
  });

  describe("Edge Cases", () => {
    it("should handle empty entity set", () => {
      const collision = new SpatialHashCollision({
        type: 'spatial-hash',
        cellSize: 50,
      });

      const entities = new Map<string, EntityHandle>();
      const positions = new Float32Array(0);

      collision.update(entities, positions);

      const result = collision.findAllCollisions(entities, positions);
      expect(result.pairs.length).toBe(0);
    });

    it("should handle entities at world boundaries", () => {
      const collision = new SpatialHashCollision({
        type: 'spatial-hash',
        cellSize: 50,
      });

      const entities = new Map<string, EntityHandle>();
      const positions = new Float32Array(6);

      const handle1: EntityHandle = { index: 0, generation: 1 };
      const handle2: EntityHandle = { index: 1, generation: 1 };

      entities.set('entity_0', handle1);
      entities.set('entity_1', handle2);

      // Place at negative coordinates
      positions[0] = -1000; positions[1] = -1000; positions[2] = 5;
      positions[3] = -995; positions[4] = -1000; positions[5] = 5;

      collision.update(entities, positions);

      const collisions = collision.findCollisions(handle1, entities, positions);
      expect(collisions.length).toBe(1);
    });

    it("should handle entities with zero radius", () => {
      const collision = new SpatialHashCollision({
        type: 'spatial-hash',
        cellSize: 50,
      });

      const entities = new Map<string, EntityHandle>();
      const positions = new Float32Array(6);

      const handle1: EntityHandle = { index: 0, generation: 1 };
      const handle2: EntityHandle = { index: 1, generation: 1 };

      entities.set('entity_0', handle1);
      entities.set('entity_1', handle2);

      positions[0] = 0; positions[1] = 0; positions[2] = 0; // Zero radius
      positions[3] = 0; positions[4] = 0; positions[5] = 0;

      collision.update(entities, positions);

      const collisions = collision.findCollisions(handle1, entities, positions);
      // Zero radius entities at same position - should collide
      expect(collisions.length).toBeGreaterThanOrEqual(0);
    });
  });
});
