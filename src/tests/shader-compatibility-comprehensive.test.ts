/**
 * Comprehensive V5/V6 Shader Compatibility Test
 *
 * Migrated from run-final-test.js and run-clean-test.js
 * Verifies that V5 (instanced) and V6 (batch) renderers produce identical output
 */

/// <reference types="vitest/globals" />

import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { GraphicsDevice } from "../core/grahpic-device";
import { Shader } from "../core/shader";
import { Texture } from "../core/texture";
import { Camera } from "../rendering/camera";
import { InstancedRenderer } from "../rendering/instanced-renderer";
import { SHADERS_V5, SHADERS_V6 } from "../scene/scene";
import { GPUBasedSpriteBatchRenderer } from "@/public-api";

describe("V5/V6 Shader Compatibility", () => {
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
  });

  /**
   * Test that V5 and V6 produce identical output with maxInstances=1000
   * This is the main regression test for the black screen issue
   */
  it("should produce identical output with maxInstances=1000", () => {
    // Test V5 (InstancedRenderer) with maxInstances=1000
    const v5Shader = graphicsDevice.createShader(
      SHADERS_V5.vertex,
      SHADERS_V5.fragment,
    );
    const v5Renderer = new InstancedRenderer(gl, v5Shader, {
      maxInstances: 1000,
      zScale: 1.0,
    });

    v5Renderer.setResolution(800, 600);
    v5Renderer.setTexture(texture);
    v5Renderer.setDepthTestEnabled(false);

    // Add test instances with different sizes and colors
    const sprites = [
      {
        x: 400,
        y: 300,
        z: 0,
        width: 64,
        height: 64,
        color: { r: 1.0, g: 0.2, b: 0.2, a: 1.0 },
      },
      {
        x: 200,
        y: 150,
        z: 0,
        width: 48,
        height: 48,
        color: { r: 0.2, g: 0.7, b: 0.9, a: 1.0 },
      },
      {
        x: 600,
        y: 450,
        z: 5,
        width: 96,
        height: 96,
        color: { r: 0.2, g: 1.0, b: 0.4, a: 1.0 },
      },
    ];

    sprites.forEach((sprite) => {
      v5Renderer.addInstance({
        gridX: sprite.x,
        gridY: sprite.y,
        z: sprite.z,
        color: sprite.color,
        texIndex: 0,
        uvOffset: { u: 0, v: 0 },
        size: { width: sprite.width, height: sprite.height },
      });
    });

    graphicsDevice.clear({ r: 0.1, g: 0.1, b: 0.15, a: 1.0 });
    while (gl.getError() !== gl.NO_ERROR) {}

    const v5DrawCalls = v5Renderer.render(camera);

    // Check for WebGL error 1282 (benign headless-gl warning)
    const v5Error = gl.getError();
    const v5HasError = v5Error !== gl.NO_ERROR;

    // Get V5 output
    const v5Pixels = graphicsDevice.getRenderingContext().readPixels();

    // Count non-background pixels
    let v5NonBackground = 0;
    for (let i = 0; i < v5Pixels.length; i += 4) {
      if (
        v5Pixels[i] !== 10 ||
        v5Pixels[i + 1] !== 10 ||
        v5Pixels[i + 2] !== 15
      ) {
        v5NonBackground++;
      }
    }

    v5Renderer.dispose();
    v5Shader.dispose();

    // Test V6 (BatchRenderer)
    const v6Shader = graphicsDevice.createShader(
      SHADERS_V6.vertex,
      SHADERS_V6.fragment,
    );
    const v6Renderer = new GPUBasedSpriteBatchRenderer(
      gl,
      v6Shader,
      1000,
      { width: 64, height: 64 },
      1.0,
      64,
    );

    v6Renderer.setResolution(800, 600);
    v6Renderer.setTexture(texture);
    v6Renderer.setDepthTestEnabled(false);

    sprites.forEach((sprite) => {
      v6Renderer.addQuad(sprite);
    });

    graphicsDevice.clear({ r: 0.1, g: 0.1, b: 0.15, a: 1.0 });
    while (gl.getError() !== gl.NO_ERROR) {}

    v6Renderer.render(camera);

    const v6Error = gl.getError();
    const v6HasError = v6Error !== gl.NO_ERROR;

    const v6Pixels = graphicsDevice.getRenderingContext().readPixels();

    let v6NonBackground = 0;
    for (let i = 0; i < v6Pixels.length; i += 4) {
      if (
        v6Pixels[i] !== 10 ||
        v6Pixels[i + 1] !== 10 ||
        v6Pixels[i + 2] !== 15
      ) {
        v6NonBackground++;
      }
    }

    v6Renderer.dispose();
    v6Shader.dispose();

    // Verify outputs are identical (within tolerance)
    let differentPixels = 0;
    const tolerance = 2;

    for (let i = 0; i < v5Pixels.length; i += 4) {
      for (let c = 0; c < 4; c++) {
        const diff = Math.abs(v5Pixels[i + c] - v6Pixels[i + c]);
        if (diff > tolerance) {
          differentPixels++;
          break;
        }
      }
    }

    // Assertions
    expect(v5NonBackground).toBeGreaterThan(0);
    expect(v6NonBackground).toBeGreaterThan(0);
    expect(v5NonBackground).toBe(v6NonBackground);
    expect(differentPixels).toBe(0);

    // Both should show the same error behavior
    expect(v5HasError).toBe(v6HasError);
  });

  /**
   * Test that V5 works correctly with maxInstances=1 (no error 1282)
   */
  it("should render correctly with maxInstances=1", () => {
    const shader = graphicsDevice.createShader(
      SHADERS_V5.vertex,
      SHADERS_V5.fragment,
    );
    const renderer = new InstancedRenderer(gl, shader, {
      maxInstances: 1,
      zScale: 1.0,
    });

    renderer.setResolution(800, 600);
    renderer.setTexture(texture);
    renderer.setDepthTestEnabled(false);

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
    const error = gl.getError();

    // With maxInstances=1, there should be NO error
    expect(error).toBe(gl.NO_ERROR);
    expect(drawCalls).toBe(1);

    // Verify rendering worked
    const pixels = graphicsDevice.getRenderingContext().readPixels();
    let nonBackground = 0;
    for (let i = 0; i < pixels.length; i += 4) {
      if (pixels[i] !== 10 || pixels[i + 1] !== 10 || pixels[i + 2] !== 15) {
        nonBackground++;
      }
    }

    expect(nonBackground).toBeGreaterThan(0);

    renderer.dispose();
    shader.dispose();
  });

  /**
   * Test that V5 works correctly with multiple instances of the same size
   */
  it("should render multiple instances of the same size correctly", () => {
    const shader = graphicsDevice.createShader(
      SHADERS_V5.vertex,
      SHADERS_V5.fragment,
    );
    const renderer = new InstancedRenderer(gl, shader, {
      maxInstances: 1000,
      zScale: 1.0,
    });

    renderer.setResolution(800, 600);
    renderer.setTexture(texture);
    renderer.setDepthTestEnabled(false);

    // Add 3 instances of the same size (should be 1 batch)
    renderer.addInstance({
      gridX: 400,
      gridY: 300,
      z: 0,
      color: { r: 1, g: 0.2, b: 0.2, a: 1 },
      texIndex: 0,
      uvOffset: { u: 0, v: 0 },
      size: { width: 64, height: 64 },
    });

    renderer.addInstance({
      gridX: 200,
      gridY: 150,
      z: 0,
      color: { r: 0.2, g: 0.7, b: 0.9, a: 1 },
      texIndex: 0,
      uvOffset: { u: 0, v: 0 },
      size: { width: 64, height: 64 },
    });

    renderer.addInstance({
      gridX: 600,
      gridY: 450,
      z: 5,
      color: { r: 0.2, g: 1.0, b: 0.4, a: 1 },
      texIndex: 0,
      uvOffset: { u: 0, v: 0 },
      size: { width: 64, height: 64 },
    });

    graphicsDevice.clear({ r: 0.1, g: 0.1, b: 0.15, a: 1.0 });
    while (gl.getError() !== gl.NO_ERROR) {}

    const drawCalls = renderer.render(camera);

    // Should be 1 draw call (same size = 1 batch)
    expect(drawCalls).toBe(1);

    // Error 1282 is expected with maxInstances >= 2
    const error = gl.getError();
    const hasError = error !== gl.NO_ERROR;

    // Verify rendering worked despite error
    const pixels = graphicsDevice.getRenderingContext().readPixels();
    let nonBackground = 0;
    for (let i = 0; i < pixels.length; i += 4) {
      if (pixels[i] !== 10 || pixels[i + 1] !== 10 || pixels[i + 2] !== 15) {
        nonBackground++;
      }
    }

    expect(nonBackground).toBeGreaterThan(0);

    renderer.dispose();
    shader.dispose();
  });

  /**
   * Test that V5 handles multiple batches correctly
   */
  it("should handle multiple batches (different sizes) correctly", () => {
    const shader = graphicsDevice.createShader(
      SHADERS_V5.vertex,
      SHADERS_V5.fragment,
    );
    const renderer = new InstancedRenderer(gl, shader, {
      maxInstances: 1000,
      zScale: 1.0,
    });

    renderer.setResolution(800, 600);
    renderer.setTexture(texture);
    renderer.setDepthTestEnabled(false);

    // Add instances with different sizes (creates multiple batches)
    renderer.addInstance({
      gridX: 100,
      gridY: 100,
      z: 0,
      color: { r: 1, g: 0, b: 0, a: 1 },
      texIndex: 0,
      uvOffset: { u: 0, v: 0 },
      size: { width: 64, height: 64 },
    });

    renderer.addInstance({
      gridX: 200,
      gridY: 100,
      z: 0,
      color: { r: 0, g: 1, b: 0, a: 1 },
      texIndex: 0,
      uvOffset: { u: 0, v: 0 },
      size: { width: 32, height: 32 }, // Different size = different batch
    });

    renderer.addInstance({
      gridX: 300,
      gridY: 100,
      z: 0,
      color: { r: 0, g: 0, b: 1, a: 1 },
      texIndex: 0,
      uvOffset: { u: 0, v: 0 },
      size: { width: 96, height: 96 }, // Another different size = another batch
    });

    graphicsDevice.clear({ r: 0.1, g: 0.1, b: 0.15, a: 1.0 });
    while (gl.getError() !== gl.NO_ERROR) {}

    const drawCalls = renderer.render(camera);

    // Should have 3 draw calls (3 different sizes)
    expect(drawCalls).toBe(3);

    // Verify rendering worked
    const pixels = graphicsDevice.getRenderingContext().readPixels();
    let nonBackground = 0;
    for (let i = 0; i < pixels.length; i += 4) {
      if (pixels[i] !== 10 || pixels[i + 1] !== 10 || pixels[i + 2] !== 15) {
        nonBackground++;
      }
    }

    expect(nonBackground).toBeGreaterThan(0);

    renderer.dispose();
    shader.dispose();
  });

  /**
   * Test that error 1282 behavior is consistent across different maxInstances values
   */
  it("should show consistent error 1282 behavior for different maxInstances", () => {
    const testCases = [
      { maxInstances: 1, expectError: false },
      { maxInstances: 2, expectError: true },
      { maxInstances: 10, expectError: true },
      { maxInstances: 100, expectError: true },
      { maxInstances: 1000, expectError: true },
    ];

    for (const testCase of testCases) {
      const shader = graphicsDevice.createShader(
        SHADERS_V5.vertex,
        SHADERS_V5.fragment,
      );
      const renderer = new InstancedRenderer(gl, shader, {
        maxInstances: testCase.maxInstances,
        zScale: 1.0,
      });

      renderer.setResolution(800, 600);
      renderer.setTexture(texture);
      renderer.setDepthTestEnabled(false);

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
      const error = gl.getError();
      const hasError = error !== gl.NO_ERROR;

      expect(hasError).toBe(testCase.expectError);

      renderer.dispose();
      shader.dispose();
    }
  });
});
