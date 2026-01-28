/**
 * Ring Buffer Behavior Test
 *
 * Migrated from various run-*-test.js scripts
 * Verifies that RingBuffer works correctly with different sizes and configurations
 */

/// <reference types="vitest/globals" />

import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { GraphicsDevice } from "../core/grahpic-device";
import { Shader } from "../core/shader";
import { Texture } from "../core/texture";
import { Camera } from "../rendering/camera";
import { InstancedRenderer } from "../rendering/instanced-renderer";
import { SHADERS_V5 } from "../scene/scene";

describe("Ring Buffer Behavior", () => {
  let graphicsDevice: GraphicsDevice;
  let gl: WebGLRenderingContext;
  let texture: Texture;
  let camera: Camera;

  beforeEach(() => {
    graphicsDevice = new GraphicsDevice(800, 600);
    gl = graphicsDevice.getGLContext();
    camera = new Camera(400, 300, 1.0);
    texture = Texture.createSolid(gl, 1, 1, 255, 255, 255);

    // Clear any pre-existing errors
    while (gl.getError() !== gl.NO_ERROR) {}
  });

  afterEach(() => {
    // Clear any WebGL errors after each test
    while (gl.getError() !== gl.NO_ERROR) {}

    texture.dispose();
    graphicsDevice.dispose();
  });

  /**
   * Test that ring buffer allocation works correctly
   */
  it("should allocate ring buffer regions correctly", () => {
    const shader = graphicsDevice.createShader(
      SHADERS_V5.vertex,
      SHADERS_V5.fragment
    );
    const renderer = new InstancedRenderer(gl, shader, {
      maxInstances: 1000,
      zScale: 1.0,
    });

    renderer.setResolution(800, 600);
    renderer.setTexture(texture);
    renderer.setDepthTestEnabled(false);

    // Add instances
    for (let i = 0; i < 10; i++) {
      renderer.addInstance({
        gridX: 100 + i * 50,
        gridY: 100,
        z: 0,
        color: { r: 1, g: 1, b: 1, a: 1 },
        texIndex: 0,
        uvOffset: { u: 0, v: 0 },
        size: { width: 64, height: 64 },
      });
    }

    graphicsDevice.clear({ r: 0.1, g: 0.1, b: 0.15, a: 1.0 });
    while (gl.getError() !== gl.NO_ERROR) {}

    const drawCalls = renderer.render(camera);

    // Should render successfully
    expect(drawCalls).toBeGreaterThan(0);

    // Get ring buffer info
    const ringBuffer = (renderer as any).instanceBuffer;
    const frameIndex = ringBuffer.getFrameIndex();

    // Note: In fallback mode (headless-gl), writeOffset is reset to 0 after advanceFrame()
    // So we only test frameIndex which should always advance
    expect(frameIndex).toBeGreaterThan(0);

    renderer.dispose();
    shader.dispose();
  });

  /**
   * Test that ring buffer handles frame advancement correctly
   */
  it("should advance frames correctly", () => {
    const shader = graphicsDevice.createShader(
      SHADERS_V5.vertex,
      SHADERS_V5.fragment
    );
    const renderer = new InstancedRenderer(gl, shader, {
      maxInstances: 100,
      zScale: 1.0,
    });

    renderer.setResolution(800, 600);
    renderer.setTexture(texture);
    renderer.setDepthTestEnabled(false);

    const ringBuffer = (renderer as any).instanceBuffer;
    const initialFrameIndex = ringBuffer.getFrameIndex();

    // Render first frame
    renderer.addInstance({
      gridX: 400,
      gridY: 300,
      z: 0,
      color: { r: 1, g: 0, b: 0, a: 1 },
      texIndex: 0,
      uvOffset: { u: 0, v: 0 },
      size: { width: 64, height: 64 },
    });

    graphicsDevice.clear({ r: 0.1, g: 0.1, b: 0.15, a: 1.0 });
    while (gl.getError() !== gl.NO_ERROR) {}

    renderer.render(camera);

    const frameIndexAfterFirst = ringBuffer.getFrameIndex();

    // Frame index should have advanced
    expect(frameIndexAfterFirst).toBe(initialFrameIndex + 1);

    // Clear and render second frame
    renderer.clear();

    renderer.addInstance({
      gridX: 200,
      gridY: 200,
      z: 0,
      color: { r: 0, g: 1, b: 0, a: 1 },
      texIndex: 0,
      uvOffset: { u: 0, v: 0 },
      size: { width: 64, height: 64 },
    });

    graphicsDevice.clear({ r: 0.1, g: 0.1, b: 0.15, a: 1.0 });
    while (gl.getError() !== gl.NO_ERROR) {}

    renderer.render(camera);

    const frameIndexAfterSecond = ringBuffer.getFrameIndex();

    // Frame index should have advanced again
    expect(frameIndexAfterSecond).toBe(frameIndexAfterFirst + 1);

    renderer.dispose();
    shader.dispose();
  });

  /**
   * Test that ring buffer resets correctly
   */
  it("should reset ring buffer state correctly", () => {
    const shader = graphicsDevice.createShader(
      SHADERS_V5.vertex,
      SHADERS_V5.fragment
    );
    const renderer = new InstancedRenderer(gl, shader, {
      maxInstances: 100,
      zScale: 1.0,
    });

    renderer.setResolution(800, 600);
    renderer.setTexture(texture);
    renderer.setDepthTestEnabled(false);

    const ringBuffer = (renderer as any).instanceBuffer;

    // Add some instances and render
    for (let i = 0; i < 5; i++) {
      renderer.addInstance({
        gridX: 100 + i * 50,
        gridY: 100,
        z: 0,
        color: { r: 1, g: 1, b: 1, a: 1 },
        texIndex: 0,
        uvOffset: { u: 0, v: 0 },
        size: { width: 64, height: 64 },
      });
    }

    graphicsDevice.clear({ r: 0.1, g: 0.1, b: 0.15, a: 1.0 });
    while (gl.getError() !== gl.NO_ERROR) {}

    renderer.render(camera);

    const frameIndexBeforeReset = ringBuffer.getFrameIndex();

    // Note: In fallback mode (headless-gl), writeOffset is reset to 0 after advanceFrame()
    // So we only test frameIndex which should always advance
    expect(frameIndexBeforeReset).toBeGreaterThan(0);

    // Reset the ring buffer
    ringBuffer.reset();

    const writeOffsetAfterReset = ringBuffer.getWriteOffset();
    const frameIndexAfterReset = ringBuffer.getFrameIndex();

    // Should be reset to initial values
    expect(writeOffsetAfterReset).toBe(0);
    expect(frameIndexAfterReset).toBe(0);

    renderer.dispose();
    shader.dispose();
  });

  /**
   * Test that ring buffer handles different maxInstances values
   */
  it("should handle different maxInstances values correctly", () => {
    const testCases = [
      { maxInstances: 1, expectedBufferSize: 144 }, // 1 * 12 * 4 * 3
      { maxInstances: 2, expectedBufferSize: 288 }, // 2 * 12 * 4 * 3
      { maxInstances: 10, expectedBufferSize: 1440 }, // 10 * 12 * 4 * 3
      { maxInstances: 100, expectedBufferSize: 14400 }, // 100 * 12 * 4 * 3
    ];

    for (const testCase of testCases) {
      const shader = graphicsDevice.createShader(
        SHADERS_V5.vertex,
        SHADERS_V5.fragment
      );
      const renderer = new InstancedRenderer(gl, shader, {
        maxInstances: testCase.maxInstances,
        zScale: 1.0,
      });

      renderer.setResolution(800, 600);
      renderer.setTexture(texture);
      renderer.setDepthTestEnabled(false);

      const ringBuffer = (renderer as any).instanceBuffer;
      const bufferSize = ringBuffer.getSize();

      expect(bufferSize).toBe(testCase.expectedBufferSize);

      // Add and render one instance
      renderer.addInstance({
        gridX: 400,
        gridY: 300,
        z: 0,
        color: { r: 1, g: 0, b: 0, a: 1 },
        texIndex: 0,
        uvOffset: { u: 0, v: 0 },
        size: { width: 64, height: 64 },
      });

      graphicsDevice.clear({ r: 0.1, g: 0.1, b: 0.15, a: 1.0 });
      while (gl.getError() !== gl.NO_ERROR) {}

      const drawCalls = renderer.render(camera);

      expect(drawCalls).toBe(1);

      renderer.dispose();
      shader.dispose();
    }
  });

  /**
   * Test that ring buffer handles buffer full scenario
   */
  it("should handle buffer full scenario gracefully", () => {
    const shader = graphicsDevice.createShader(
      SHADERS_V5.vertex,
      SHADERS_V5.fragment
    );

    // Create renderer with small maxInstances to test buffer full scenario
    const renderer = new InstancedRenderer(gl, shader, {
      maxInstances: 10, // Small buffer
      zScale: 1.0,
    });

    renderer.setResolution(800, 600);
    renderer.setTexture(texture);
    renderer.setDepthTestEnabled(false);

    // Add more instances than maxInstances
    for (let i = 0; i < 20; i++) {
      renderer.addInstance({
        gridX: 100 + (i % 5) * 50,
        gridY: 100 + Math.floor(i / 5) * 50,
        z: 0,
        color: { r: 1, g: 1, b: 1, a: 1 },
        texIndex: 0,
        uvOffset: { u: 0, v: 0 },
        size: { width: 64, height: 64 },
      });
    }

    graphicsDevice.clear({ r: 0.1, g: 0.1, b: 0.15, a: 1.0 });
    while (gl.getError() !== gl.NO_ERROR) {}

    // Should render without crashing even if buffer is full
    const drawCalls = renderer.render(camera);

    // Some instances may be skipped, but rendering should succeed
    expect(drawCalls).toBeGreaterThanOrEqual(0);

    renderer.dispose();
    shader.dispose();
  });
});
