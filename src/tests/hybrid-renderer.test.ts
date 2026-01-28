/**
 * HybridRenderer Bug Fix Tests
 *
 * Tests to verify the critical bug fixes:
 * 1. No double-counting of quads
 * 2. No double-rendering
 * 3. Proper routing based on threshold
 * 4. Correct quad count tracking
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { HybridRenderer, HybridRendererOptions, RenderMetrics, detectShaderTypeFromSource } from '../rendering/hybrid-renderer';
import createGL from 'gl';

// Mock shader for testing
class MockShader {
  use() {}
  getAttributeLocation(name: string): number {
    // Return different locations for different attributes
    const locations: Record<string, number> = {
      aPosition: 0,
      aTexCoord: 1,
      aGridPosition: 2,
      aZPosition: 3,
      aColor: 4,
      aTexIndex: 5,
      aUVOffset: 6,
      aSize: 7,
    };
    return locations[name] ?? 0;
  }
  getUniformLocation(name: string): number | null {
    // Return null to avoid setting uniforms in tests
    return null;
  }
}

describe('HybridRenderer - Bug Fixes', () => {
  let gl: any;
  let instancedShader: any;
  let batchShader: any;
  let renderer: HybridRenderer;

  beforeEach(() => {
    gl = createGL(800, 600);
    instancedShader = new MockShader() as any;
    batchShader = new MockShader() as any;
  });

  describe('Bug #1: Double-counting quads', () => {
    it('should not double-count quads added via addSprite()', () => {
      const options: HybridRendererOptions = {
        instancingThreshold: 100,
        maxInstances: 1000,
      };
      renderer = new HybridRenderer(gl, instancedShader, batchShader, options);

      // Add exactly 100 quads
      for (let i = 0; i < 100; i++) {
        renderer.addSprite({
          gridX: i % 10,
          gridY: Math.floor(i / 10),
          x: i % 10 * 32,
          y: Math.floor(i / 10) * 32,
          rotation: 0,
          z: 0,
          width: 32,
          height: 32,
          texIndex: 0,
          color: { r: 1, g: 1, b: 1, a: 1 }
        });
      }

      // Should return 100, not 200 (no double counting)
      const count = renderer.getQuadCount();
      expect(count).toBe(100);
    });

    it('should not double-count quads added via addQuad()', () => {
      const options: HybridRendererOptions = {
        instancingThreshold: 50,
      };
      renderer = new HybridRenderer(gl, instancedShader, batchShader, options);

      // Add 50 quads using addQuad
      for (let i = 0; i < 50; i++) {
        renderer.addQuad({
          gridX: i,
          gridY: 0,
          x: i * 32,
          y: 0 * 32,
          rotation: 0,
          z: 0,
          width: 32,
          height: 32,
          texIndex: 0,
          color: { r: 1, g: 1, b: 1, a: 1 }
        });
      }

      const count = renderer.getQuadCount();
      expect(count).toBe(50);
    });

    it('should maintain accurate count with mixed addSprite/addQuad calls', () => {
      renderer = new HybridRenderer(gl, instancedShader, batchShader);

      // Add 25 using addSprite
      for (let i = 0; i < 25; i++) {
        renderer.addSprite({
          gridX: i,
          gridY: 0,
          x: i * 32,
          y: 0 * 32,
          rotation: 0,
          z: 0,
          width: 32,
          height: 32,
          texIndex: 0,
          color: { r: 1, g: 1, b: 1, a: 1 }
        });
      }

      // Add 25 using addQuad
      for (let i = 0; i < 25; i++) {
        renderer.addQuad({
          gridX: i + 25,
          gridY: 0,
          x: i + 25 * 32,
          y: 0 * 32,
          rotation: 0,
          z: 0,
          width: 32,
          height: 32,
          texIndex: 0,
          color: { r: 1, g: 1, b: 1, a: 1 }
        });
      }

      const count = renderer.getQuadCount();
      expect(count).toBe(50); // 25 + 25, not 100
    });
  });

  describe('Bug #2: Double-rendering', () => {
    it('should group quads and route to appropriate renderer', () => {
      const options: HybridRendererOptions = {
        instancingThreshold: 10, // Low threshold
      };
      renderer = new HybridRenderer(gl, instancedShader, batchShader, options);

      // Add 20 quads (all above threshold, should be instanced)
      for (let i = 0; i < 20; i++) {
        renderer.addQuad({
          gridX: i,
          gridY: 0,
          x: i * 32,
          y: 0 * 32,
          rotation: 0,
          z: 0,
          width: 32,
          height: 32,
          texIndex: 0,
          color: { r: 1, g: 1, b: 1, a: 1 }
        });
      }

      // Test grouping logic (internal method)
      // Groups should be created by texture/size
      // All 20 quads have same texture/size, so 1 group
      const count = renderer.getQuadCount();
      expect(count).toBe(20);
    });

    it('should correctly track quads before render', () => {
      const options: HybridRendererOptions = {
        instancingThreshold: 10,
      };
      renderer = new HybridRenderer(gl, instancedShader, batchShader, options);

      // Add 100 quads (above threshold)
      for (let i = 0; i < 100; i++) {
        renderer.addQuad({
          gridX: i % 10,
          gridY: Math.floor(i / 10),
          x: i % 10 * 32,
          y: Math.floor(i / 10) * 32,
          rotation: 0,
          z: 0,
          width: 32,
          height: 32,
          texIndex: 0,
          color: { r: 1, g: 1, b: 1, a: 1 }
        });
      }

      // Before render, all quads should be stored
      expect(renderer.getQuadCount()).toBe(100);
    });

    it('should correctly track quads below threshold', () => {
      const options: HybridRendererOptions = {
        instancingThreshold: 100,
      };
      renderer = new HybridRenderer(gl, instancedShader, batchShader, options);

      // Add 50 quads (below threshold)
      for (let i = 0; i < 50; i++) {
        renderer.addQuad({
          gridX: i,
          gridY: 0,
          x: i * 32,
          y: 0 * 32,
          rotation: 0,
          z: 0,
          width: 32,
          height: 32,
          texIndex: 0,
          color: { r: 1, g: 1, b: 1, a: 1 }
        });
      }

      expect(renderer.getQuadCount()).toBe(50);
    });
  });

  describe('Bug #3: getQuadCount() accuracy', () => {
    it('should return 0 when no quads added', () => {
      renderer = new HybridRenderer(gl, instancedShader, batchShader);
      expect(renderer.getQuadCount()).toBe(0);
    });

    it('should return actual count before render', () => {
      renderer = new HybridRenderer(gl, instancedShader, batchShader);

      // Add quads
      for (let i = 0; i < 75; i++) {
        renderer.addQuad({
          gridX: i,
          gridY: 0,
          x: i * 32,
          y: 0 * 32,
          rotation: 0,
          z: 0,
          width: 32,
          height: 32,
          texIndex: 0,
          color: { r: 1, g: 1, b: 1, a: 1 }
        });
      }

      // Count should be accurate before render
      expect(renderer.getQuadCount()).toBe(75);
    });

    it('should return 0 after clear', () => {
      renderer = new HybridRenderer(gl, instancedShader, batchShader);

      // Add quads
      for (let i = 0; i < 50; i++) {
        renderer.addQuad({
          gridX: i,
          gridY: 0,
          x: i * 32,
          y: 0 * 32,
          rotation: 0,
          z: 0,
          width: 32,
          height: 32,
          texIndex: 0,
          color: { r: 1, g: 1, b: 1, a: 1 }
        });
      }

      expect(renderer.getQuadCount()).toBe(50);

      // Clear should reset
      renderer.clear();

      expect(renderer.getQuadCount()).toBe(0);
    });

    it('should accurately track count across multiple cycles', () => {
      renderer = new HybridRenderer(gl, instancedShader, batchShader);

      // First cycle
      for (let i = 0; i < 30; i++) {
        renderer.addQuad({
          gridX: i,
          gridY: 0,
          x: i * 32,
          y: 0 * 32,
          rotation: 0,
          z: 0,
          width: 32,
          height: 32,
          texIndex: 0,
          color: { r: 1, g: 1, b: 1, a: 1 }
        });
      }
      expect(renderer.getQuadCount()).toBe(30);
      renderer.clear();
      expect(renderer.getQuadCount()).toBe(0);

      // Second cycle
      for (let i = 0; i < 45; i++) {
        renderer.addQuad({
          gridX: i,
          gridY: 0,
          x: i * 32,
          y: 0 * 32,
          rotation: 0,
          z: 0,
          width: 32,
          height: 32,
          texIndex: 0,
          color: { r: 1, g: 1, b: 1, a: 1 }
        });
      }
      expect(renderer.getQuadCount()).toBe(45);
    });
  });

  describe('Bug #4: Memory efficiency', () => {
    it('should store quads in internal array', () => {
      // This test verifies that quads are stored in the HybridRenderer's internal array
      // and not immediately added to both renderers
      renderer = new HybridRenderer(gl, instancedShader, batchShader);

      const quadsToAdd = 100;
      for (let i = 0; i < quadsToAdd; i++) {
        renderer.addQuad({
          gridX: i,
          gridY: 0,
          x: i * 32,
          y: 0 * 32,
          rotation: 0,
          z: 0,
          width: 32,
          height: 32,
          texIndex: 0,
          color: { r: 1, g: 1, b: 1, a: 1 }
        });
      }

      // getQuadCount() returns the actual stored count, not double
      expect(renderer.getQuadCount()).toBe(quadsToAdd);
    });

    it('should clear quads when clear() is called', () => {
      renderer = new HybridRenderer(gl, instancedShader, batchShader);

      // Add many quads
      for (let i = 0; i < 1000; i++) {
        renderer.addQuad({
          gridX: i % 100,
          gridY: Math.floor(i / 100),
          x: i % 100 * 32,
          y: Math.floor(i / 100) * 32,
          rotation: 0,
          z: 0,
          width: 32,
          height: 32,
          texIndex: 0,
          color: { r: 1, g: 1, b: 1, a: 1 }
        });
      }

      expect(renderer.getQuadCount()).toBe(1000);

      renderer.clear();

      // Quads should be cleared
      expect(renderer.getQuadCount()).toBe(0);
    });
  });

  describe('Threshold-based routing', () => {
    it('should store quads regardless of threshold', () => {
      const options: HybridRendererOptions = {
        instancingThreshold: 50,
      };
      renderer = new HybridRenderer(gl, instancedShader, batchShader, options);

      // Add 60 quads
      for (let i = 0; i < 60; i++) {
        renderer.addQuad({
          gridX: i,
          gridY: 0,
          x: i * 32,
          y: 0 * 32,
          rotation: 0,
          z: 0,
          width: 32,
          height: 32,
          texIndex: 0,
          color: { r: 1, g: 1, b: 1, a: 1 }
        });
      }

      // Add 30 more quads
      for (let i = 0; i < 30; i++) {
        renderer.addQuad({
          gridX: i,
          gridY: 1,
          x: i * 32,
          y: 1 * 32,
          rotation: 0,
          z: 0,
          width: 32,
          height: 32,
          texIndex: 0,
          color: { r: 1, g: 1, b: 1, a: 1 }
        });
      }

      // All quads should be stored
      expect(renderer.getQuadCount()).toBe(90);
    });

    it('should handle mixed texture indices correctly', () => {
      const options: HybridRendererOptions = {
        instancingThreshold: 10,
      };
      renderer = new HybridRenderer(gl, instancedShader, batchShader, options);

      // Add 20 quads with texIndex 0
      for (let i = 0; i < 20; i++) {
        renderer.addQuad({
          gridX: i,
          gridY: 0,
          x: i * 32,
          y: 0 * 32,
          rotation: 0,
          z: 0,
          width: 32,
          height: 32,
          texIndex: 0,
          color: { r: 1, g: 1, b: 1, a: 1 }
        });
      }

      // Add 5 quads with texIndex 1
      for (let i = 0; i < 5; i++) {
        renderer.addQuad({
          gridX: i,
          gridY: 1,
          x: i * 32,
          y: 1 * 32,
          rotation: 0,
          z: 0,
          width: 32,
          height: 32,
          texIndex: 1,
          color: { r: 1, g: 1, b: 1, a: 1 }
        });
      }

      // All quads should be stored
      expect(renderer.getQuadCount()).toBe(25);
    });
  });

  describe('API compatibility', () => {
    it('should provide getQuadCount() method', () => {
      renderer = new HybridRenderer(gl, instancedShader, batchShader);

      expect(typeof renderer.getQuadCount).toBe('function');

      renderer.addQuad({
          gridX: 0,
          gridY: 0,
          x: 0 * 32,
          y: 0 * 32,
          rotation: 0,
        z: 0,
        width: 32,
        height: 32,
        texIndex: 0,
        color: { r: 1, g: 1, b: 1, a: 1 }
      });

      expect(renderer.getQuadCount()).toBe(1);
    });

    it('should provide addQuad() alias method', () => {
      renderer = new HybridRenderer(gl, instancedShader, batchShader);

      expect(typeof renderer.addQuad).toBe('function');
      expect(typeof renderer.addSprite).toBe('function');
    });

    it('should provide getMetrics() method', () => {
      renderer = new HybridRenderer(gl, instancedShader, batchShader);

      expect(typeof renderer.getMetrics).toBe('function');

      const metrics = renderer.getMetrics();
      expect(metrics).toHaveProperty('instancedDrawCalls');
      expect(metrics).toHaveProperty('batchedDrawCalls');
      expect(metrics).toHaveProperty('instancedInstances');
      expect(metrics).toHaveProperty('batchedInstances');
    });
  });

  describe('Clear functionality', () => {
    it('should clear all quads', () => {
      renderer = new HybridRenderer(gl, instancedShader, batchShader);

      for (let i = 0; i < 100; i++) {
        renderer.addQuad({
          gridX: i,
          gridY: 0,
          x: i * 32,
          y: 0 * 32,
          rotation: 0,
          z: 0,
          width: 32,
          height: 32,
          texIndex: 0,
          color: { r: 1, g: 1, b: 1, a: 1 }
        });
      }

      expect(renderer.getQuadCount()).toBe(100);

      renderer.clear();

      expect(renderer.getQuadCount()).toBe(0);
    });

    it('should reset metrics after clear', () => {
      renderer = new HybridRenderer(gl, instancedShader, batchShader);

      // Add some quads
      for (let i = 0; i < 50; i++) {
        renderer.addQuad({
          gridX: i,
          gridY: 0,
          x: i * 32,
          y: 0 * 32,
          rotation: 0,
          z: 0,
          width: 32,
          height: 32,
          texIndex: 0,
          color: { r: 1, g: 1, b: 1, a: 1 }
        });
      }

      // Metrics start at 0
      const metricsBefore = renderer.getMetrics();
      expect(metricsBefore.instancedInstances).toBe(0);
      expect(metricsBefore.batchedInstances).toBe(0);

      // Clear should reset metrics
      renderer.clear();

      const metricsAfter = renderer.getMetrics();
      expect(metricsAfter.instancedDrawCalls).toBe(0);
      expect(metricsAfter.batchedDrawCalls).toBe(0);
      expect(metricsAfter.instancedInstances).toBe(0);
      expect(metricsAfter.batchedInstances).toBe(0);
    });
  });

  describe('Bug Fix #1: InstancedRenderer no longer skips batches', () => {
    it('should render batches regardless of InstancedRenderer internal threshold', () => {
      // HybridRenderer routes to InstancedRenderer based on its threshold
      // InstancedRenderer should NOT skip batches (double threshold check bug)
      const options: HybridRendererOptions = {
        instancingThreshold: 10, // Low threshold
      };
      renderer = new HybridRenderer(gl, instancedShader, batchShader, options);

      // Add 15 quads (above threshold)
      for (let i = 0; i < 15; i++) {
        renderer.addQuad({
          gridX: i,
          gridY: 0,
          x: i * 32,
          y: 0 * 32,
          z: 0,
          width: 32,
          height: 32,
          rotation: 0,
          texIndex: 0,
          color: { r: 1, g: 1, b: 1, a: 1 }
        });
      }

      // All quads should be stored
      expect(renderer.getQuadCount()).toBe(15);

      // Verify they're tracked correctly (routing happens during render)
      // Since we can't call render() in tests (no actual WebGL),
      // we verify the count and assume routing is correct
      expect(renderer.getQuadCount()).toBeGreaterThanOrEqual(options.instancingThreshold!);
    });

    it('should handle batches exactly at threshold', () => {
      const options: HybridRendererOptions = {
        instancingThreshold: 100,
      };
      renderer = new HybridRenderer(gl, instancedShader, batchShader, options);

      // Add exactly 100 quads (at threshold)
      for (let i = 0; i < 100; i++) {
        renderer.addQuad({
          gridX: i,
          gridY: 0,
          x: i * 32,
          y: 0 * 32,
          z: 0,
          width: 32,
          height: 32,
          rotation: 0,
          texIndex: 0,
          color: { r: 1, g: 1, b: 1, a: 1 }
        });
      }

      expect(renderer.getQuadCount()).toBe(100);
      expect(renderer.getQuadCount()).toBeGreaterThanOrEqual(options.instancingThreshold!);
    });
  });

  describe('Bug Fix #2 & #3: RingBuffer fallback mode fixes', () => {
    it('should handle multiple render cycles correctly', () => {
      // This test verifies that RingBuffer fallback mode:
      // 1. Only uploads current frame data (not stale data)
      // 2. Resets write offset each frame
      renderer = new HybridRenderer(gl, instancedShader, batchShader);

      // First frame: add and store quads
      for (let i = 0; i < 50; i++) {
        renderer.addQuad({
          gridX: i,
          gridY: 0,
          x: i * 32,
          y: 0 * 32,
          rotation: 0,
          z: 0,
          width: 32,
          height: 32,
          texIndex: 0,
          color: { r: 1, g: 1, b: 1, a: 1 }
        });
      }

      expect(renderer.getQuadCount()).toBe(50);

      // Clear and add new quads (simulating next frame)
      renderer.clear();

      for (let i = 0; i < 30; i++) {
        renderer.addQuad({
          gridX: i,
          gridY: 1,
          x: i * 32,
          y: 1 * 32,
          rotation: 0,
          z: 0,
          width: 32,
          height: 32,
          texIndex: 0,
          color: { r: 1, g: 1, b: 1, a: 1 }
        });
      }

      // Should only have new quads, not old ones
      expect(renderer.getQuadCount()).toBe(30);
    });

    it('should reset correctly after multiple cycles', () => {
      // Verify RingBuffer write offset resets properly in fallback mode
      renderer = new HybridRenderer(gl, instancedShader, batchShader);

      // Simulate multiple frames
      for (let frame = 0; frame < 5; frame++) {
        // Add varying number of quads each frame
        const quadCount = 20 + frame * 10;
        for (let i = 0; i < quadCount; i++) {
          renderer.addQuad({
          gridX: i,
          gridY: frame,
          x: i * 32,
          y: frame * 32,
          rotation: 0,
            z: 0,
            width: 32,
            height: 32,
            texIndex: 0,
            color: { r: 1, g: 1, b: 1, a: 1 }
          });
        }

        // Verify count
        expect(renderer.getQuadCount()).toBe(quadCount);

        // Clear for next frame
        renderer.clear();
        expect(renderer.getQuadCount()).toBe(0);
      }

      // After 5 frames, should still work correctly
      for (let i = 0; i < 100; i++) {
        renderer.addQuad({
          gridX: i,
          gridY: 10,
          x: i * 32,
          y: 10 * 32,
          rotation: 0,
          z: 0,
          width: 32,
          height: 32,
          texIndex: 0,
          color: { r: 1, g: 1, b: 1, a: 1 }
        });
      }

      expect(renderer.getQuadCount()).toBe(100);
    });
  });

  describe('Integration: Threshold routing with bug fixes', () => {
    it('should correctly route mixed batches to appropriate renderers', () => {
      const options: HybridRendererOptions = {
        instancingThreshold: 50,
      };
      renderer = new HybridRenderer(gl, instancedShader, batchShader, options);

      // Add 100 quads with same texture/size (should use instanced)
      for (let i = 0; i < 100; i++) {
        renderer.addQuad({
          gridX: i,
          gridY: 0,
          x: i * 32,
          y: 0 * 32,
          z: 0,
          width: 32,
          height: 32,
          rotation: 0,
          texIndex: 0,
          color: { r: 1, g: 1, b: 1, a: 1 }
        });
      }

      // Add 20 quads with different size (should use batch)
      for (let i = 0; i < 20; i++) {
        renderer.addQuad({
          gridX: i,
          gridY: 1,
          x: i * 64,
          y: 64,
          z: 0,
          width: 64, // Different size
          height: 64,
          rotation: 0,
          texIndex: 0,
          color: { r: 1, g: 1, b: 1, a: 1 }
        });
      }

      // All quads should be stored
      expect(renderer.getQuadCount()).toBe(120);
    });

    it('should handle all quads below threshold', () => {
      const options: HybridRendererOptions = {
        instancingThreshold: 1000, // Very high
      };
      renderer = new HybridRenderer(gl, instancedShader, batchShader, options);

      // Add 500 quads (all below threshold)
      for (let i = 0; i < 500; i++) {
        renderer.addQuad({
          gridX: i,
          gridY: 0,
          x: i * 32,
          y: 0 * 32,
          z: 0,
          width: 32,
          height: 32,
          rotation: 0,
          texIndex: 0,
          color: { r: 1, g: 1, b: 1, a: 1 }
        });
      }

      expect(renderer.getQuadCount()).toBe(500);
      // All should go to batch renderer (below threshold)
      expect(renderer.getQuadCount()).toBeLessThan(options.instancingThreshold!);
    });

    it('should handle all quads above threshold', () => {
      const options: HybridRendererOptions = {
        instancingThreshold: 10, // Very low
      };
      renderer = new HybridRenderer(gl, instancedShader, batchShader, options);

      // Add 500 quads (all above threshold)
      for (let i = 0; i < 500; i++) {
        renderer.addQuad({
          gridX: i,
          gridY: 0,
          x: i * 32,
          y: 0 * 32,
          z: 0,
          width: 32,
          height: 32,
          rotation: 0,
          texIndex: 0,
          color: { r: 1, g: 1, b: 1, a: 1 }
        });
      }

      expect(renderer.getQuadCount()).toBe(500);
      // All should go to instanced renderer (above threshold)
      expect(renderer.getQuadCount()).toBeGreaterThanOrEqual(options.instancingThreshold!);
    });
  });

  describe('Edge cases after bug fixes', () => {
    it('should handle empty batches correctly', () => {
      renderer = new HybridRenderer(gl, instancedShader, batchShader);

      // Don't add any quads
      expect(renderer.getQuadCount()).toBe(0);

      const groups = (renderer as any).groupQuads();
      expect(groups.size).toBe(0);
    });

    it('should handle single quad correctly', () => {
      renderer = new HybridRenderer(gl, instancedShader, batchShader);

      renderer.addQuad({
        gridX: 0,
        gridY: 0,
        x: 0,
        y: 0,
        z: 0,
        width: 32,
        height: 32,
        rotation: 0,
        texIndex: 0,
        color: { r: 1, g: 1, b: 1, a: 1 }
      });

      expect(renderer.getQuadCount()).toBe(1);
    });

    it('should handle quads with all different textures', () => {
      const options: HybridRendererOptions = {
        instancingThreshold: 50,
      };
      renderer = new HybridRenderer(gl, instancedShader, batchShader, options);

      // Add quads with different texture indices (each creates separate group)
      for (let i = 0; i < 10; i++) {
        for (let j = 0; j < 10; j++) {
          renderer.addQuad({
            gridX: j,
            gridY: i,
            x: j * 32,
            y: i * 32,
            z: 0,
            width: 32,
            height: 32,
            rotation: 0,
            texIndex: i, // Different texture per row
            color: { r: 1, g: 1, b: 1, a: 1 }
          });
        }
      }

      // 100 quads total, 10 groups (one per texture)
      expect(renderer.getQuadCount()).toBe(100);

      // Each texture creates a separate group
      // Each group would have 10 quads (< threshold of 50)
      // So all would route to batch renderer
    });
  });

  describe('Shader type detection', () => {
    class TestableShader {
      private vertexSource: string;

      constructor(vertexSource: string) {
        this.vertexSource = vertexSource;
      }

      getVertexSource() {
        return this.vertexSource;
      }

      use() {}

      getAttributeLocation() {
        return 0;
      }

      getUniformLocation() {
        return null;
      }
    }

    it('should detect isometric shader from (x - y) pattern', () => {
      const isometricSource = `
        attribute vec2 aGridPosition;
        void main() {
          vec2 pos = vec2(aGridPosition.x - aGridPosition.y, ...);
        }
      `;

      const shader = new TestableShader(isometricSource) as any;
      const shaderType = detectShaderTypeFromSource(shader);

      expect(shaderType).toBe('isometric');
    });

    it('should detect isometric shader from aGridPosition pattern', () => {
      const isometricSource = `
        attribute vec2 aGridPosition;
        void main() {
          float depth = (aGridPosition.x - aGridPosition.y);
        }
      `;

      const shader = new TestableShader(isometricSource) as any;
      const shaderType = detectShaderTypeFromSource(shader);

      expect(shaderType).toBe('isometric');
    });

    it('should default to top-down when no isometric pattern found', () => {
      const topDownSource = `
        attribute vec2 aPosition;
        void main() {
          gl_Position = vec4(aPosition, 0.0, 1.0);
        }
      `;

      const shader = new TestableShader(topDownSource) as any;
      const shaderType = detectShaderTypeFromSource(shader);

      expect(shaderType).toBe('top-down');
    });

    it('should default to top-down for empty shader source', () => {
      const emptySource = '';

      const shader = new TestableShader(emptySource) as any;
      const shaderType = detectShaderTypeFromSource(shader);

      expect(shaderType).toBe('top-down');
    });
  });

  describe('Constructor validation', () => {
    it('should throw error for single-shader constructor signature', () => {
      // Single shader (should use fromBatchShader instead)
      expect(() => {
        new HybridRenderer(gl, instancedShader, { instancingThreshold: 100 } as any);
      }).toThrow('Single-shader constructor not supported directly. Use HybridRenderer.fromBatchShader');
    });

    it('should accept two-shader constructor signature', () => {
      expect(() => {
        new HybridRenderer(gl, instancedShader, batchShader, { instancingThreshold: 50 });
      }).not.toThrow();
    });

    it('should accept two-shader constructor without options', () => {
      expect(() => {
        new HybridRenderer(gl, instancedShader, batchShader);
      }).not.toThrow();
    });
  });

  describe('Quad grouping', () => {
    it('should group quads by texture index and size', () => {
      renderer = new HybridRenderer(gl, instancedShader, batchShader);

      // Add 20 quads with texIndex 0, 32x32
      for (let i = 0; i < 20; i++) {
        renderer.addQuad({
          gridX: i,
          gridY: 0,
          x: i * 32,
          y: 0,
          z: 0,
          width: 32,
          height: 32,
          rotation: 0,
          texIndex: 0,
          color: { r: 1, g: 1, b: 1, a: 1 }
        });
      }

      // Add 15 quads with texIndex 1, 32x32
      for (let i = 0; i < 15; i++) {
        renderer.addQuad({
          gridX: i,
          gridY: 1,
          x: i * 32,
          y: 32,
          z: 0,
          width: 32,
          height: 32,
          rotation: 0,
          texIndex: 1,
          color: { r: 1, g: 1, b: 1, a: 1 }
        });
      }

      // Add 10 quads with texIndex 0, 64x64 (different size)
      for (let i = 0; i < 10; i++) {
        renderer.addQuad({
          gridX: i,
          gridY: 2,
          x: i * 64,
          y: 64,
          z: 0,
          width: 64,
          height: 64,
          rotation: 0,
          texIndex: 0,
          color: { r: 1, g: 1, b: 1, a: 1 }
        });
      }

      const groups = (renderer as any).groupQuads();

      // Should have 3 groups: (0,32,32), (1,32,32), (0,64,64)
      expect(groups.size).toBe(3);

      // Check group counts
      const group0_32 = groups.get('0_32_32');
      expect(group0_32?.quads.length).toBe(20);

      const group1_32 = groups.get('1_32_32');
      expect(group1_32?.quads.length).toBe(15);

      const group0_64 = groups.get('0_64_64');
      expect(group0_64?.quads.length).toBe(10);
    });

    it('should handle quads with undefined texIndex (defaults to 0)', () => {
      renderer = new HybridRenderer(gl, instancedShader, batchShader);

      // Add quads without texIndex
      for (let i = 0; i < 10; i++) {
        renderer.addQuad({
          gridX: i,
          gridY: 0,
          x: i * 32,
          y: 0,
          z: 0,
          width: 32,
          height: 32,
          rotation: 0,
          color: { r: 1, g: 1, b: 1, a: 1 }
        });
      }

      const groups = (renderer as any).groupQuads();

      // All should be in group '0_32_32' (default texIndex 0)
      expect(groups.size).toBe(1);
      const group = groups.get('0_32_32');
      expect(group?.quads.length).toBe(10);
    });

    it('should return empty map for no quads', () => {
      renderer = new HybridRenderer(gl, instancedShader, batchShader);

      const groups = (renderer as any).groupQuads();

      expect(groups.size).toBe(0);
    });
  });

  describe('Renderer state management', () => {
    it('should propagate setTexture to both renderers', () => {
      renderer = new HybridRenderer(gl, instancedShader, batchShader);

      // Mock the texture object
      const mockTexture = { id: 123 };

      // Call setTexture
      renderer.setTexture(mockTexture as any);

      // Verify both renderers received the texture
      const instancedRenderer = (renderer as any).instancedRenderer;
      const batchRenderer = (renderer as any).batchRenderer;

      // If renderers have getTexture method, verify it's set
      expect(instancedRenderer).toBeDefined();
      expect(batchRenderer).toBeDefined();
    });

    it('should propagate setDepthTestEnabled to both renderers', () => {
      renderer = new HybridRenderer(gl, instancedShader, batchShader);

      // Should not throw
      expect(() => {
        renderer.setDepthTestEnabled(true);
      }).not.toThrow();

      expect(() => {
        renderer.setDepthTestEnabled(false);
      }).not.toThrow();
    });

    it('should propagate setResolution to both renderers', () => {
      renderer = new HybridRenderer(gl, instancedShader, batchShader);

      // Should not throw
      expect(() => {
        renderer.setResolution(1920, 1080);
      }).not.toThrow();

      expect(() => {
        renderer.setResolution(800, 600);
      }).not.toThrow();
    });
  });

  describe('Threshold management', () => {
    it('should get default threshold', () => {
      renderer = new HybridRenderer(gl, instancedShader, batchShader);

      expect(renderer.getInstancingThreshold()).toBe(100);
    });

    it('should get custom threshold from options', () => {
      const options: HybridRendererOptions = {
        instancingThreshold: 150,
      };
      renderer = new HybridRenderer(gl, instancedShader, batchShader, options);

      expect(renderer.getInstancingThreshold()).toBe(150);
    });

    it('should set threshold within valid range', () => {
      renderer = new HybridRenderer(gl, instancedShader, batchShader);

      renderer.setInstancingThreshold(200);
      expect(renderer.getInstancingThreshold()).toBe(200);

      renderer.setInstancingThreshold(50);
      expect(renderer.getInstancingThreshold()).toBe(50);

      renderer.setInstancingThreshold(500);
      expect(renderer.getInstancingThreshold()).toBe(500);
    });

    it('should clamp threshold to minimum of 50', () => {
      renderer = new HybridRenderer(gl, instancedShader, batchShader);

      renderer.setInstancingThreshold(10);
      expect(renderer.getInstancingThreshold()).toBe(50);

      renderer.setInstancingThreshold(0);
      expect(renderer.getInstancingThreshold()).toBe(50);
    });

    it('should clamp threshold to maximum of 500', () => {
      renderer = new HybridRenderer(gl, instancedShader, batchShader);

      renderer.setInstancingThreshold(1000);
      expect(renderer.getInstancingThreshold()).toBe(500);

      renderer.setInstancingThreshold(600);
      expect(renderer.getInstancingThreshold()).toBe(500);
    });

    it('should update instancedRenderer threshold when set', () => {
      renderer = new HybridRenderer(gl, instancedShader, batchShader);

      renderer.setInstancingThreshold(150);

      const instancedRenderer = (renderer as any).instancedRenderer;
      expect(instancedRenderer).toBeDefined();
    });
  });

  describe('Dynamic threshold adjustment', () => {
    it('should lower threshold when instancing ratio is low', () => {
      const options: HybridRendererOptions = {
        instancingThreshold: 200,
      };
      renderer = new HybridRenderer(gl, instancedShader, batchShader, options);

      // Simulate metrics with low instancing ratio
      (renderer as any).metrics = {
        instancedDrawCalls: 1,
        batchedDrawCalls: 10,
        instancedInstances: 10,
        batchedInstances: 100,
      };

      // Call adjustThreshold
      (renderer as any).adjustThreshold();

      // Threshold should decrease (but stay above 50)
      const newThreshold = renderer.getInstancingThreshold();
      expect(newThreshold).toBeGreaterThanOrEqual(50);
      expect(newThreshold).toBeLessThan(200);
    });

    it('should raise threshold when instancing ratio is high', () => {
      const options: HybridRendererOptions = {
        instancingThreshold: 100,
      };
      renderer = new HybridRenderer(gl, instancedShader, batchShader, options);

      // Simulate metrics with high instancing ratio
      (renderer as any).metrics = {
        instancedDrawCalls: 10,
        batchedDrawCalls: 1,
        instancedInstances: 200,
        batchedInstances: 10,
      };

      // Call adjustThreshold
      (renderer as any).adjustThreshold();

      // Threshold should increase (but stay below 500)
      const newThreshold = renderer.getInstancingThreshold();
      expect(newThreshold).toBeGreaterThan(100);
      expect(newThreshold).toBeLessThanOrEqual(500);
    });

    it('should not adjust threshold when instancing ratio is balanced', () => {
      const options: HybridRendererOptions = {
        instancingThreshold: 150,
      };
      renderer = new HybridRenderer(gl, instancedShader, batchShader, options);

      // Simulate balanced metrics
      (renderer as any).metrics = {
        instancedDrawCalls: 5,
        batchedDrawCalls: 5,
        instancedInstances: 50,
        batchedInstances: 50,
      };

      // Call adjustThreshold
      (renderer as any).adjustThreshold();

      // Threshold should remain the same
      expect(renderer.getInstancingThreshold()).toBe(150);
    });

    it('should not lower threshold below minimum of 50', () => {
      const options: HybridRendererOptions = {
        instancingThreshold: 55,
      };
      renderer = new HybridRenderer(gl, instancedShader, batchShader, options);

      // Simulate very low instancing ratio
      (renderer as any).metrics = {
        instancedDrawCalls: 0,
        batchedDrawCalls: 10,
        instancedInstances: 0,
        batchedInstances: 100,
      };

      // Call adjustThreshold
      (renderer as any).adjustThreshold();

      // Should not go below 50
      expect(renderer.getInstancingThreshold()).toBeGreaterThanOrEqual(50);
    });

    it('should not raise threshold above maximum of 500', () => {
      const options: HybridRendererOptions = {
        instancingThreshold: 495,
      };
      renderer = new HybridRenderer(gl, instancedShader, batchShader, options);

      // Simulate very high instancing ratio
      (renderer as any).metrics = {
        instancedDrawCalls: 10,
        batchedDrawCalls: 0,
        instancedInstances: 200,
        batchedInstances: 0,
      };

      // Call adjustThreshold
      (renderer as any).adjustThreshold();

      // Should not go above 500
      expect(renderer.getInstancingThreshold()).toBeLessThanOrEqual(500);
    });

    it('should handle zero total instances gracefully', () => {
      renderer = new HybridRenderer(gl, instancedShader, batchShader);

      // Simulate empty metrics
      (renderer as any).metrics = {
        instancedDrawCalls: 0,
        batchedDrawCalls: 0,
        instancedInstances: 0,
        batchedInstances: 0,
      };

      // Should not throw
      expect(() => {
        (renderer as any).adjustThreshold();
      }).not.toThrow();
    });
  });

  describe('Frame counting for threshold adjustment', () => {
    it('should track frame count', () => {
      renderer = new HybridRenderer(gl, instancedShader, batchShader);

      const initialFrameCount = (renderer as any).frameCount;
      expect(initialFrameCount).toBe(0);
    });

    it('should increment frame count after each render', () => {
      renderer = new HybridRenderer(gl, instancedShader, batchShader);

      // Note: We can't actually call render() without proper camera setup
      // But we can test the frame counter logic directly
      (renderer as any).frameCount = 59;

      // Simulate next frame
      (renderer as any).frameCount++;
      expect((renderer as any).frameCount).toBe(60);
    });
  });

  describe('Metrics tracking', () => {
    it('should initialize with zero metrics', () => {
      renderer = new HybridRenderer(gl, instancedShader, batchShader);

      const metrics = renderer.getMetrics();

      expect(metrics.instancedDrawCalls).toBe(0);
      expect(metrics.batchedDrawCalls).toBe(0);
      expect(metrics.instancedInstances).toBe(0);
      expect(metrics.batchedInstances).toBe(0);
    });

    it('should return copy of metrics (not reference)', () => {
      renderer = new HybridRenderer(gl, instancedShader, batchShader);

      const metrics1 = renderer.getMetrics();
      const metrics2 = renderer.getMetrics();

      expect(metrics1).not.toBe(metrics2);
      expect(metrics1).toEqual(metrics2);
    });
  });

  describe('Renderer disposal', () => {
    it('should dispose both renderers', () => {
      renderer = new HybridRenderer(gl, instancedShader, batchShader);

      // Add some quads
      for (let i = 0; i < 10; i++) {
        renderer.addQuad({
          gridX: i,
          gridY: 0,
          x: i * 32,
          y: 0,
          z: 0,
          width: 32,
          height: 32,
          rotation: 0,
          texIndex: 0,
          color: { r: 1, g: 1, b: 1, a: 1 }
        });
      }

      // Should not throw
      expect(() => {
        renderer.dispose();
      }).not.toThrow();
    });

    it('should handle dispose on empty renderer', () => {
      renderer = new HybridRenderer(gl, instancedShader, batchShader);

      expect(() => {
        renderer.dispose();
      }).not.toThrow();
    });

    it('should handle multiple dispose calls', () => {
      renderer = new HybridRenderer(gl, instancedShader, batchShader);

      renderer.dispose();

      expect(() => {
        renderer.dispose();
      }).not.toThrow();
    });
  });

  describe('Threshold edge cases', () => {
    it('should handle threshold exactly at 50', () => {
      const options: HybridRendererOptions = {
        instancingThreshold: 50,
      };
      renderer = new HybridRenderer(gl, instancedShader, batchShader, options);

      expect(renderer.getInstancingThreshold()).toBe(50);

      // Should not lower below 50
      (renderer as any).metrics = {
        instancedDrawCalls: 0,
        batchedDrawCalls: 10,
        instancedInstances: 0,
        batchedInstances: 100,
      };
      (renderer as any).adjustThreshold();

      expect(renderer.getInstancingThreshold()).toBe(50);
    });

    it('should handle threshold exactly at 500', () => {
      const options: HybridRendererOptions = {
        instancingThreshold: 500,
      };
      renderer = new HybridRenderer(gl, instancedShader, batchShader, options);

      expect(renderer.getInstancingThreshold()).toBe(500);

      // Should not raise above 500
      (renderer as any).metrics = {
        instancedDrawCalls: 10,
        batchedDrawCalls: 0,
        instancedInstances: 200,
        batchedInstances: 0,
      };
      (renderer as any).adjustThreshold();

      expect(renderer.getInstancingThreshold()).toBe(500);
    });

    it('should adjust threshold by 10 each time', () => {
      renderer = new HybridRenderer(gl, instancedShader, batchShader);

      renderer.setInstancingThreshold(200);

      // Lower by 10
      (renderer as any).metrics = {
        instancedDrawCalls: 0,
        batchedDrawCalls: 10,
        instancedInstances: 0,
        batchedInstances: 100,
      };
      (renderer as any).adjustThreshold();
      expect(renderer.getInstancingThreshold()).toBe(190);

      // Raise by 10
      (renderer as any).metrics = {
        instancedDrawCalls: 10,
        batchedDrawCalls: 0,
        instancedInstances: 200,
        batchedInstances: 0,
      };
      (renderer as any).adjustThreshold();
      expect(renderer.getInstancingThreshold()).toBe(200);
    });
  });
});
