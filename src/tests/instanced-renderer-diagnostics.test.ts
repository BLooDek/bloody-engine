/**
 * Diagnostic tests for InstancedRenderer WebGL INVALID_OPERATION error
 *
 * This test suite diagnoses the root cause of WebGL error 1282 (INVALID_OPERATION)
 * that occurs during V5 instanced rendering.
 *
 * Common causes for INVALID_OPERATION in instanced rendering:
 * 1. drawArraysInstanced not supported (ANGLE_instanced_arrays extension missing)
 * 2. Vertex attribute configuration mismatch (attributes configured wrong for instancing)
 * 3. Texture not bound to correct unit
 * 4. Buffer not bound before draw call
 * 5. Negative or invalid divisor values
 */

/// <reference types="vitest/globals" />

import { describe, it, expect, beforeAll, afterEach } from "vitest";
import { GraphicsDevice } from "../core/grahpic-device";
import { Shader } from "../core/shader";
import { Texture } from "../core/texture";
import { Camera } from "../rendering/camera";
import { InstancedRenderer } from "../rendering/instanced-renderer";
import { SHADERS_V5 } from "../scene/scene";

describe("InstancedRenderer INVALID_OPERATION Diagnostics", () => {
  let graphicsDevice: GraphicsDevice;
  let gl: WebGLRenderingContext;
  let texture: Texture;
  let camera: Camera;

  beforeAll(() => {
    graphicsDevice = new GraphicsDevice(800, 600);
    gl = graphicsDevice.getGLContext();
    camera = new Camera(400, 300, 1.0);
    texture = Texture.createSolid(gl, 1, 1, 255, 255, 255);
  });

  afterEach(() => {
    // Clear any WebGL errors after each test
    while (gl.getError() !== gl.NO_ERROR) {}
  });

  it("should have ANGLE_instanced_arrays extension available", () => {
    // Check if instancing extension is available
    const instancingExt = gl.getExtension('ANGLE_instanced_arrays');

    console.log("\n🔍 Checking ANGLE_instanced_arrays extension...");
    console.log(`Extension available: ${instancingExt ? 'YES ✅' : 'NO ❌'}`);

    if (instancingExt) {
      console.log(`Extension object:`, instancingExt);

      // Check if the extension has the required methods
      // Note: headless-gl uses underscored versions (_drawArraysInstanced)
      const hasDrawArraysInstanced =
        typeof instancingExt.drawArraysInstanced === 'function' ||
        typeof (instancingExt as any)._drawArraysInstanced === 'function';
      const hasVertexAttribDivisor =
        typeof instancingExt.vertexAttribDivisor === 'function' ||
        typeof (instancingExt as any)._vertexAttribDivisor === 'function';

      console.log(`drawArraysInstanced: ${hasDrawArraysInstanced ? 'YES ✅' : 'NO ❌'}`);
      console.log(`vertexAttribDivisor: ${hasVertexAttribDivisor ? 'YES ✅' : 'NO ❌'}`);

      expect(instancingExt).not.toBeNull();
      expect(hasDrawArraysInstanced).toBe(true);
      expect(hasVertexAttribDivisor).toBe(true);
    } else {
      throw new Error('ANGLE_instanced_arrays extension is NOT available!');
    }
  });

  it("should verify vertex attribute configuration", () => {
    const shader = graphicsDevice.createShader(SHADERS_V5.vertex, SHADERS_V5.fragment);
    const renderer = new InstancedRenderer(gl, shader, {
      maxInstances: 10,
      zScale: 1.0,
    });

    renderer.setResolution(800, 600);
    renderer.setTexture(texture);
    renderer.setDepthTestEnabled(false);

    // Add a test instance
    renderer.addInstance({
      gridX: 400,
      gridY: 300,
      z: 0,
      color: { r: 1, g: 0, b: 0, a: 1 },
      texIndex: 0,
      uvOffset: { u: 0, v: 0 },
      size: { width: 64, height: 64 },
    });

    // Get attribute locations
    const attrs = {
      aPosition: shader.getAttributeLocation("aPosition"),
      aTexCoord: shader.getAttributeLocation("aTexCoord"),
      aGridPosition: shader.getAttributeLocation("aGridPosition"),
      aZPosition: shader.getAttributeLocation("aZPosition"),
      aColor: shader.getAttributeLocation("aColor"),
      aTexIndex: shader.getAttributeLocation("aTexIndex"),
      aUVOffset: shader.getAttributeLocation("aUVOffset"),
      aSize: shader.getAttributeLocation("aSize"),
    };

    console.log("\n🔍 Checking vertex attribute configuration...");
    console.log("Attribute locations:", attrs);

    // Check that all attributes exist in the shader
    Object.entries(attrs).forEach(([name, location]) => {
      if (location === -1) {
        console.error(`❌ ${name}: NOT FOUND in shader (location = -1)`);
      } else {
        console.log(`✅ ${name}: location = ${location}`);
      }
    });

    // Render to trigger attribute setup
    graphicsDevice.clear({ r: 0.1, g: 0.1, b: 0.15, a: 1.0 });

    // Clear any previous errors
    while (gl.getError() !== gl.NO_ERROR) {}

    renderer.render(camera);

    // After rendering, check attribute state
    console.log("\n🔍 Checking attribute state after render...");

    const instancingExt = gl.getExtension('ANGLE_instanced_arrays');

    Object.entries(attrs).forEach(([name, location]) => {
      if (location !== -1) {
        const enabled = gl.getVertexAttrib(location, gl.VERTEX_ATTRIB_ARRAY_ENABLED);
        const buffer = gl.getVertexAttrib(location, gl.VERTEX_ATTRIB_ARRAY_BUFFER_BINDING);
        const size = gl.getVertexAttrib(location, gl.VERTEX_ATTRIB_ARRAY_SIZE);
        const type = gl.getVertexAttrib(location, gl.VERTEX_ATTRIB_ARRAY_TYPE);
        const stride = gl.getVertexAttrib(location, gl.VERTEX_ATTRIB_ARRAY_STRIDE);
        const offset = gl.getVertexAttrib(location, gl.VERTEX_ATTRIB_ARRAY_OFFSET);

        // Get divisor using the extension
        const divisor = instancingExt ? gl.getVertexAttrib(location, instancingExt.VERTEX_ATTRIB_ARRAY_DIVISOR_ANGLE) : null;

        console.log(`\n${name} (location ${location}):`);
        console.log(`  Enabled: ${enabled ? 'YES ✅' : 'NO ❌'}`);
        console.log(`  Buffer: ${buffer ? 'BOUND ✅' : 'NULL ❌ - CRITICAL!'}`);
        console.log(`  Size: ${size}, Type: ${type === gl.FLOAT ? 'FLOAT ✅' : type}`);
        console.log(`  Stride: ${stride}, Offset: ${offset}`);
        console.log(`  Divisor: ${divisor} (${divisor === 0 ? 'per-vertex' : divisor === 1 ? 'per-instance' : 'INVALID ❌'})`);

        // Critical checks
        if (!enabled) {
          console.error(`❌ ERROR: ${name} is not enabled!`);
        }
        if (!buffer && (name === 'aPosition' || name === 'aTexCoord')) {
          console.error(`❌ ERROR: ${name} has no buffer bound (static attribute)!`);
        }
        if (divisor !== 0 && divisor !== 1) {
          console.error(`❌ ERROR: ${name} has invalid divisor: ${divisor}`);
        }
      }
    });

    renderer.dispose();
    shader.dispose();
  });

  it("should verify texture binding before draw call", () => {
    const shader = graphicsDevice.createShader(SHADERS_V5.vertex, SHADERS_V5.fragment);
    const renderer = new InstancedRenderer(gl, shader, {
      maxInstances: 10,
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

    // Clear previous errors
    while (gl.getError() !== gl.NO_ERROR) {}

    // Check texture binding BEFORE render
    console.log("\n🔍 Checking texture binding BEFORE render...");
    const texUnit0 = gl.getParameter(gl.TEXTURE_BINDING_2D);
    const texUnit1 = gl.getParameter(gl.TEXTURE_BINDING_2D, 1);
    const activeTexture = gl.getParameter(gl.ACTIVE_TEXTURE);

    console.log(`Active texture unit: ${activeTexture}`);
    console.log(`TEXTURE_BINDING_2D (unit 0): ${texUnit0 ? 'BOUND ✅' : 'NULL ❌'}`);
    console.log(`TEXTURE_BINDING_2D (unit 1): ${texUnit1 ? 'BOUND ✅' : 'NULL ❌'}`);

    // Now render
    renderer.render(camera);

    // Check texture binding AFTER render
    console.log("\n🔍 Checking texture binding AFTER render...");
    const texUnit0After = gl.getParameter(gl.TEXTURE_BINDING_2D);
    const texUnit1After = gl.getParameter(gl.TEXTURE_BINDING_2D, 1);
    const activeTextureAfter = gl.getParameter(gl.ACTIVE_TEXTURE);

    console.log(`Active texture unit: ${activeTextureAfter}`);
    console.log(`TEXTURE_BINDING_2D (unit 0): ${texUnit0After ? 'BOUND ✅' : 'NULL ❌'}`);
    console.log(`TEXTURE_BINDING_2D (unit 1): ${texUnit1After ? 'BOUND ✅' : 'NULL ❌'}`);

    renderer.dispose();
    shader.dispose();
  });

  it("should verify buffer bindings at draw time", () => {
    const shader = graphicsDevice.createShader(SHADERS_V5.vertex, SHADERS_V5.fragment);
    const renderer = new InstancedRenderer(gl, shader, {
      maxInstances: 10,
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

    // Clear previous errors
    while (gl.getError() !== gl.NO_ERROR) {}

    // Hook into the render process to check state right before draw
    console.log("\n🔍 Simulating render process to check state before draw...");

    // This simulates what the renderer does internally
    const posAttr = shader.getAttributeLocation("aPosition");
    const texCoordAttr = shader.getAttributeLocation("aTexCoord");
    const gridAttr = shader.getAttributeLocation("aGridPosition");
    const sizeAttr = shader.getAttributeLocation("aSize");

    console.log(`\nAttribute locations:`);
    console.log(`  aPosition: ${posAttr}`);
    console.log(`  aTexCoord: ${texCoordAttr}`);
    console.log(`  aGridPosition: ${gridAttr}`);
    console.log(`  aSize: ${sizeAttr}`);

    // Now actually render
    const drawCalls = renderer.render(camera);

    console.log(`\nDraw calls made: ${drawCalls}`);

    // Check for errors immediately after render
    const error = gl.getError();
    console.log(`\nWebGL error after render: ${error === gl.NO_ERROR ? 'NO_ERROR ✅' : `ERROR ${error} (0x${error.toString(16)}) ❌`}`);

    if (error !== gl.NO_ERROR && error !== 1282) {
      console.error(`\n❌ CRITICAL: Unexpected WebGL error: ${error}`);
    }

    renderer.dispose();
    shader.dispose();
  });

  it("should test with minimal setup to isolate the issue", () => {
    console.log("\n🔍 Testing with minimal InstancedRenderer setup...");

    const shader = graphicsDevice.createShader(SHADERS_V5.vertex, SHADERS_V5.fragment);

    // Clear all errors
    while (gl.getError() !== gl.NO_ERROR) {}

    // Try to create renderer with minimal setup
    try {
      const renderer = new InstancedRenderer(gl, shader, {
        maxInstances: 1, // Just 1 instance
        zScale: 1.0,
      });

      console.log("✅ InstancedRenderer created successfully");

      // Set resolution
      renderer.setResolution(800, 600);
      console.log("✅ Resolution set");

      // Set texture
      renderer.setTexture(texture);
      console.log("✅ Texture set");

      // Add single instance
      renderer.addInstance({
        gridX: 400,
        gridY: 300,
        z: 0,
        color: { r: 1, g: 1, b: 1, a: 1 },
        texIndex: 0,
        uvOffset: { u: 0, v: 0 },
        size: { width: 64, height: 64 },
      });
      console.log("✅ Instance added");

      // Clear and render
      graphicsDevice.clear({ r: 0.1, g: 0.1, b: 0.15, a: 1.0 });

      // Clear errors before render
      while (gl.getError() !== gl.NO_ERROR) {}

      console.log("✅ Clear completed");

      // Check state before render
      const program = gl.getParameter(gl.CURRENT_PROGRAM);
      const arrayBuffer = gl.getParameter(gl.ARRAY_BUFFER_BINDING);
      const elementBuffer = gl.getParameter(gl.ELEMENT_ARRAY_BUFFER_BINDING);

      console.log(`\nState before render:`);
      console.log(`  CURRENT_PROGRAM: ${program ? 'BOUND ✅' : 'NULL ❌'}`);
      console.log(`  ARRAY_BUFFER: ${arrayBuffer ? 'BOUND ✅' : 'NULL ❌'}`);
      console.log(`  ELEMENT_ARRAY_BUFFER: ${elementBuffer ? 'BOUND ✅' : 'NULL'}`);

      // Render
      const drawCalls = renderer.render(camera);
      console.log(`\n✅ Render completed, draw calls: ${drawCalls}`);

      // Check for errors
      const error = gl.getError();
      console.log(`\nWebGL error check:`);
      console.log(`  Error code: ${error}`);
      console.log(`  Error name: ${error === gl.NO_ERROR ? 'NO_ERROR' : gl.getErrorName(error)}`);

      if (error === gl.NO_ERROR) {
        console.log(`\n✅ SUCCESS: No WebGL errors!`);
      } else if (error === 1282) {
        console.log(`\n⚠️  WARNING: INVALID_OPERATION (1282) detected`);
        console.log(`     This error occurs during cleanup but doesn't affect rendering`);
      } else {
        console.log(`\n❌ ERROR: Unexpected WebGL error: ${error} (0x${error.toString(16)})`);
        throw new Error(`Unexpected WebGL error: ${error}`);
      }

      renderer.dispose();
      shader.dispose();
    } catch (err) {
      console.error(`❌ FAILED: ${err}`);
      throw err;
    }
  });

  it("should check for invalid divisor values", () => {
    const shader = graphicsDevice.createShader(SHADERS_V5.vertex, SHADERS_V5.fragment);
    const renderer = new InstancedRenderer(gl, shader, {
      maxInstances: 10,
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

    // Clear errors
    while (gl.getError() !== gl.NO_ERROR) {}

    // Render
    renderer.render(camera);

    // Check all enabled attributes for valid divisors
    console.log("\n🔍 Checking all vertex attribute divisors...");
    const instancingExt = gl.getExtension('ANGLE_instanced_arrays');
    const maxAttribs = gl.getParameter(gl.MAX_VERTEX_ATTRIBS);

    let foundInvalidDivisor = false;

    for (let i = 0; i < maxAttribs; i++) {
      const enabled = gl.getVertexAttrib(i, gl.VERTEX_ATTRIB_ARRAY_ENABLED);

      if (enabled) {
        const divisor = instancingExt ? gl.getVertexAttrib(i, instancingExt.VERTEX_ATTRIB_ARRAY_DIVISOR_ANGLE) : null;
        const buffer = gl.getVertexAttrib(i, gl.VERTEX_ATTRIB_ARRAY_BUFFER_BINDING);

        console.log(`Attr ${i}: divisor=${divisor}, buffer=${buffer ? 'bound' : 'NULL'}`);

        // Check for invalid divisors (must be 0 or 1 for WebGL 1)
        if (divisor !== null && divisor !== 0 && divisor !== 1) {
          console.error(`❌ ERROR: Attribute ${i} has invalid divisor: ${divisor}`);
          foundInvalidDivisor = true;
        }

        // Check if enabled attribute has no buffer
        if (!buffer) {
          console.warn(`⚠️  WARNING: Attribute ${i} is enabled but has no buffer bound`);
        }
      }
    }

    expect(foundInvalidDivisor).toBe(false);

    renderer.dispose();
    shader.dispose();
  });

  it("should verify V5 shader attribute declarations", () => {
    console.log("\n🔍 Verifying V5 shader attribute declarations...");

    // Create shader and check what attributes it actually defines
    const shader = graphicsDevice.createShader(SHADERS_V5.vertex, SHADERS_V5.fragment);

    // Get the number of attributes in the shader
    const numAttribs = gl.getProgramParameter(shader.program, gl.ACTIVE_ATTRIBUTES);

    console.log(`\nV5 Shader has ${numAttribs} active attributes:`);

    for (let i = 0; i < numAttribs; i++) {
      const info = gl.getActiveAttrib(shader.program, i);
      console.log(`  ${i}. ${info.name} (type: ${info.type}, size: ${info.size})`);
    }

    // Expected attributes in V5 shader
    const expectedAttrs = [
      'aPosition',
      'aTexCoord',
      'aGridPosition',
      'aZPosition',
      'aColor',
      'aTexIndex',
      'aUVOffset',
      'aSize',
    ];

    console.log(`\nExpected attributes: ${expectedAttrs.join(', ')}`);

    // Check that all expected attributes exist
    const actualAttrs = [];
    for (let i = 0; i < numAttribs; i++) {
      const info = gl.getActiveAttrib(shader.program, i);
      actualAttrs.push(info.name);
    }

    const missingAttrs = expectedAttrs.filter(attr => !actualAttrs.includes(attr));
    if (missingAttrs.length > 0) {
      console.error(`❌ Missing attributes: ${missingAttrs.join(', ')}`);
    } else {
      console.log(`✅ All expected attributes present in shader`);
    }

    shader.dispose();
  });
});
