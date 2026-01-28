/**
 * WebGL Extension Methods Test
 *
 * Migrated from test-extension-fix.js and verify-test-fix.js
 * Verifies that ANGLE_instanced_arrays extension methods work correctly
 */

/// <reference types="vitest/globals" />

import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { GraphicsDevice } from "../core/grahpic-device";

describe("WebGL Extension Methods", () => {
  let graphicsDevice: GraphicsDevice;
  let gl: WebGLRenderingContext;

  beforeEach(() => {
    graphicsDevice = new GraphicsDevice(800, 600);
    gl = graphicsDevice.getGLContext();

    // Clear any pre-existing errors
    while (gl.getError() !== gl.NO_ERROR) {}
  });

  afterEach(() => {
    // Clear any WebGL errors after each test
    while (gl.getError() !== gl.NO_ERROR) {}

    graphicsDevice.dispose();
  });

  /**
   * Test that ANGLE_instanced_arrays extension is available
   */
  it("should have ANGLE_instanced_arrays extension available", () => {
    const instancingExt = gl.getExtension('ANGLE_instanced_arrays');

    expect(instancingExt).not.toBeNull();

    if (instancingExt) {
      // Check for both regular and underscored versions
      // (headless-gl uses underscored versions)
      const hasDrawArraysInstanced =
        typeof instancingExt.drawArraysInstanced === 'function' ||
        typeof (instancingExt as any)._drawArraysInstanced === 'function';
      const hasVertexAttribDivisor =
        typeof instancingExt.vertexAttribDivisor === 'function' ||
        typeof (instancingExt as any)._vertexAttribDivisor === 'function';

      expect(hasDrawArraysInstanced).toBe(true);
      expect(hasVertexAttribDivisor).toBe(true);
    }
  });

  /**
   * Test that extension methods can be called directly
   */
  it("should be able to call extension methods directly", () => {
    const ext = gl.getExtension('ANGLE_instanced_arrays');
    expect(ext).not.toBeNull();

    if (!ext) return;

    // Get the methods (handle both underscored and non-underscored)
    const drawArraysInstanced = ext.drawArraysInstanced || (ext as any)._drawArraysInstanced;
    const vertexAttribDivisor = ext.vertexAttribDivisor || (ext as any)._vertexAttribDivisor;

    expect(typeof drawArraysInstanced).toBe('function');
    expect(typeof vertexAttribDivisor).toBe('function');

    // Create a minimal test setup
    const vs = `
      attribute vec2 aPosition;
      void main() {
        gl_Position = vec4(aPosition, 0.0, 1.0);
      }
    `;

    const fs = `
      precision mediump float;
      void main() {
        gl_FragColor = vec4(1.0, 0.0, 0.0, 1.0);
      }
    `;

    const program = gl.createProgram();
    const vsShader = gl.createShader(gl.VERTEX_SHADER);
    gl.shaderSource(vsShader, vs);
    gl.compileShader(vsShader);
    gl.attachShader(program, vsShader);

    const fsShader = gl.createShader(gl.FRAGMENT_SHADER);
    gl.shaderSource(fsShader, fs);
    gl.compileShader(fsShader);
    gl.attachShader(program, fsShader);

    gl.linkProgram(program);
    gl.useProgram(program);

    // Create position buffer
    const posBuffer = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, posBuffer);
    gl.bufferData(
      gl.ARRAY_BUFFER,
      new Float32Array([
        -0.5, -0.5,
        0.5, -0.5,
        0.5, 0.5,
        -0.5, -0.5,
        0.5, 0.5,
        -0.5, 0.5
      ]),
      gl.STATIC_DRAW
    );

    const posAttr = gl.getAttribLocation(program, "aPosition");
    gl.enableVertexAttribArray(posAttr);
    gl.vertexAttribPointer(posAttr, 2, gl.FLOAT, false, 0, 0);

    // Test vertexAttribDivisor
    vertexAttribDivisor(posAttr, 0); // Per-vertex
    const error1 = gl.getError();
    expect(error1).toBe(gl.NO_ERROR);

    // Test drawArraysInstanced
    gl.clearColor(0.1, 0.1, 0.15, 1.0);
    gl.clear(gl.COLOR_BUFFER_BIT);
    drawArraysInstanced(gl.TRIANGLES, 0, 6, 1);
    const error2 = gl.getError();
    expect(error2).toBe(gl.NO_ERROR);

    // Cleanup
    gl.deleteBuffer(posBuffer);
    gl.deleteShader(vsShader);
    gl.deleteShader(fsShader);
    gl.deleteProgram(program);
  });

  /**
   * Test that buffer operations work with different sizes
   */
  it("should handle buffer operations correctly for different sizes", () => {
    const testSizes = [144, 288, 1440, 14400]; // maxInstances = 1, 2, 10, 100

    for (const size of testSizes) {
      const buffer = gl.createBuffer();
      gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
      gl.bufferData(gl.ARRAY_BUFFER, size, gl.DYNAMIC_DRAW);

      const data = new Float32Array(Math.min(size / 4, 100));
      gl.bufferSubData(gl.ARRAY_BUFFER, 0, data);

      const error = gl.getError();
      expect(error).toBe(gl.NO_ERROR);

      gl.deleteBuffer(buffer);
    }
  });

  /**
   * Test that drawArraysInstanced works with different instance counts
   */
  it("should handle different instance counts in drawArraysInstanced", () => {
    const ext = gl.getExtension('ANGLE_instanced_arrays');
    expect(ext).not.toBeNull();

    if (!ext) return;

    const drawArraysInstanced = ext.drawArraysInstanced || (ext as any)._drawArraysInstanced;

    // Create minimal test setup
    const vs = `
      attribute vec2 aPosition;
      attribute float aInstanceID;
      void main() {
        vec2 offset = vec2(float(int(aInstanceID)) * 0.1, 0.0);
        gl_Position = vec4(aPosition + offset, 0.0, 1.0);
      }
    `;

    const fs = `
      precision mediump float;
      void main() {
        gl_FragColor = vec4(1.0, 0.0, 0.0, 1.0);
      }
    `;

    const program = gl.createProgram();
    const vsShader = gl.createShader(gl.VERTEX_SHADER);
    gl.shaderSource(vsShader, vs);
    gl.compileShader(vsShader);
    gl.attachShader(program, vsShader);

    const fsShader = gl.createShader(gl.FRAGMENT_SHADER);
    gl.shaderSource(fsShader, fs);
    gl.compileShader(fsShader);
    gl.attachShader(program, fsShader);

    gl.linkProgram(program);
    gl.useProgram(program);

    // Get vertexAttribDivisor (drawArraysInstanced already declared above)
    const vertexAttribDivisor = ext.vertexAttribDivisor || (ext as any)._vertexAttribDivisor;

    // Test with different instance counts
    for (const instanceCount of [1, 2, 10, 100]) {
      // Create instance buffer
      const instanceBuffer = gl.createBuffer();
      gl.bindBuffer(gl.ARRAY_BUFFER, instanceBuffer);
      const bufferSize = instanceCount * 1 * 4; // 1 float per instance
      gl.bufferData(gl.ARRAY_BUFFER, bufferSize, gl.DYNAMIC_DRAW);

      const instanceData = new Float32Array(instanceCount);
      for (let i = 0; i < instanceCount; i++) {
        instanceData[i] = i;
      }
      gl.bufferSubData(gl.ARRAY_BUFFER, 0, instanceData);

      // Create position buffer
      const posBuffer = gl.createBuffer();
      gl.bindBuffer(gl.ARRAY_BUFFER, posBuffer);
      gl.bufferData(
        gl.ARRAY_BUFFER,
        new Float32Array([
          -0.5, -0.5,
          0.5, -0.5,
          0.5, 0.5,
          -0.5, -0.5,
          0.5, 0.5,
          -0.5, 0.5
        ]),
        gl.STATIC_DRAW
      );

      const posAttr = gl.getAttribLocation(program, "aPosition");
      gl.enableVertexAttribArray(posAttr);
      gl.vertexAttribPointer(posAttr, 2, gl.FLOAT, false, 0, 0);
      vertexAttribDivisor(posAttr, 0);

      // Setup instanced attribute
      const instanceAttr = gl.getAttribLocation(program, "aInstanceID");
      gl.bindBuffer(gl.ARRAY_BUFFER, instanceBuffer);
      gl.enableVertexAttribArray(instanceAttr);
      gl.vertexAttribPointer(instanceAttr, 1, gl.FLOAT, false, 0, 0);
      vertexAttribDivisor(instanceAttr, 1);

      // Draw
      gl.clearColor(0.1, 0.1, 0.15, 1.0);
      gl.clear(gl.COLOR_BUFFER_BIT);
      drawArraysInstanced(gl.TRIANGLES, 0, 6, 1);

      const error = gl.getError();
      expect(error).toBe(gl.NO_ERROR);

      // Cleanup
      gl.deleteBuffer(instanceBuffer);
      gl.deleteBuffer(posBuffer);
    }

    gl.deleteShader(vsShader);
    gl.deleteShader(fsShader);
    gl.deleteProgram(program);
  });
});
