/**
 * Minimal diagnostic script to identify the exact cause of INVALID_OPERATION error
 */

import { GraphicsDevice } from "./dist/node/index.js";
import { Shader } from "./dist/node/index.js";
import { Texture } from "./dist/node/index.js";
import { Camera } from "./dist/node/index.js";
import { InstancedRenderer } from "./dist/node/index.js";
import { SHADERS_V5 } from "./dist/node/index.js";

console.log("🔍 Starting INVALID_OPERATION diagnostics...\n");

const gdevice = new GraphicsDevice(800, 600);
const gl = gdevice.getGLContext();
const camera = new Camera(400, 300, 1.0);
const texture = Texture.createSolid(gl, 1, 1, 255, 255, 255);

// Test 1: Check ANGLE_instanced_arrays extension
console.log("Test 1: Check ANGLE_instanced_arrays extension");
console.log("=".repeat(60));

const ext = gl.getExtension('ANGLE_instanced_arrays');
console.log(`Extension available: ${ext ? 'YES ✅' : 'NO ❌'}`);

if (ext) {
  console.log(`drawArraysInstanced: ${typeof ext.drawArraysInstanced === 'function' ? 'YES ✅' : 'NO ❌'}`);
  console.log(`vertexAttribDivisor: ${typeof ext.vertexAttribDivisor === 'function' ? 'YES ✅' : 'NO ❌'}`);
}

// Test 2: Create InstancedRenderer and add instance
console.log("\nTest 2: Create InstancedRenderer with minimal setup");
console.log("=".repeat(60));

const shader = gdevice.createShader(SHADERS_V5.vertex, SHADERS_V5.fragment);
const renderer = new InstancedRenderer(gl, shader, { maxInstances: 1, zScale: 1.0 });

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

console.log("✅ InstancedRenderer created and configured");

// Test 3: Check shader attributes
console.log("\nTest 3: Check V5 shader attributes");
console.log("=".repeat(60));

const numAttribs = gl.getProgramParameter(shader.program, gl.ACTIVE_ATTRIBUTES);
console.log(`Number of active attributes: ${numAttribs}`);

for (let i = 0; i < numAttribs; i++) {
  const info = gl.getActiveAttrib(shader.program, i);
  console.log(`  ${i}. ${info.name} (size: ${info.size}, type: ${info.type})`);
}

// Test 4: Clear errors and render
console.log("\nTest 4: Render with error checking");
console.log("=".repeat(60));

// Clear all errors
let error;
while ((error = gl.getError()) !== gl.NO_ERROR) {
  console.log(`Cleared pre-existing error: ${error} (0x${error.toString(16)})`);
}

gdevice.clear({ r: 0.1, g: 0.1, b: 0.15, a: 1.0 });

// Check state before render
const programBefore = gl.getParameter(gl.CURRENT_PROGRAM);
const arrayBufferBefore = gl.getParameter(gl.ARRAY_BUFFER_BINDING);
const texture2DBefore = gl.getParameter(gl.TEXTURE_BINDING_2D);

console.log(`State before render:`);
console.log(`  Program: ${programBefore ? 'bound ✅' : 'NULL ❌'}`);
console.log(`  ARRAY_BUFFER: ${arrayBufferBefore ? 'bound ✅' : 'NULL'}`);
console.log(`  TEXTURE_2D: ${texture2DBefore ? 'bound ✅' : 'NULL'}`);

// Render
console.log("\n⚡ Calling renderer.render()...");
const drawCalls = renderer.render(camera);
console.log(`Draw calls: ${drawCalls}`);

// Check for errors immediately
error = gl.getError();
console.log(`\nFirst gl.getError() after render: ${error === gl.NO_ERROR ? 'NO_ERROR ✅' : `${error} (0x${error.toString(16)}) ❌`}`);

if (error !== gl.NO_ERROR) {
  if (error === 1282) {
    console.log(`\n⚠️  INVALID_OPERATION detected`);
    console.log(`    Checking for common causes...`);

    // Check if drawArraysInstanced is supported
    if (!ext || !ext.drawArraysInstanced) {
      console.log(`    ❌ drawArraysInstanced not available!`);
    }

    // Check enabled attributes
    console.log(`\n    Checking enabled attributes:`);
    for (let i = 0; i < 16; i++) {
      const enabled = gl.getVertexAttrib(i, gl.VERTEX_ATTRIB_ARRAY_ENABLED);
      if (enabled) {
        const buffer = gl.getVertexAttrib(i, gl.VERTEX_ATTRIB_ARRAY_BUFFER_BINDING);
        const size = gl.getVertexAttrib(i, gl.VERTEX_ATTRIB_ARRAY_SIZE);
        const divisor = ext ? gl.getVertexAttrib(i, ext.VERTEX_ATTRIB_ARRAY_DIVISOR_ANGLE) : null;

        console.log(`      Attr ${i}: size=${size}, buffer=${buffer ? 'bound ✅' : 'NULL ❌'}, divisor=${divisor}`);

        if (!buffer) {
          console.log(`        ❌ ERROR: Enabled attribute with no buffer!`);
        }
      }
    }
  }
}

// Test 5: Check if rendering actually worked
console.log("\nTest 5: Verify rendering worked");
console.log("=".repeat(60));

const renderingContext = gdevice.getRenderingContext();
const pixels = renderingContext.readPixels();

console.log(`Framebuffer size: ${pixels.length} bytes`);
console.log(`Expected size: ${800 * 600 * 4} bytes`);

if (pixels.length === 800 * 600 * 4) {
  console.log("✅ Rendering produced valid framebuffer data");

  // Check if pixels are not all black (which would indicate rendering failed)
  let nonBlackPixels = 0;
  for (let i = 0; i < pixels.length; i += 4) {
    if (pixels[i] !== 10 || pixels[i+1] !== 10 || pixels[i+2] !== 15) {
      nonBlackPixels++;
    }
  }

  console.log(`Non-background pixels: ${nonBlackPixels}`);

  if (nonBlackPixels > 0) {
    console.log("✅ Rendering WORKS - sprites were drawn!");
  } else {
    console.log("❌ Rendering FAILED - framebuffer is clear color only");
  }
}

// Cleanup
renderer.dispose();
shader.dispose();
texture.dispose();
gdevice.dispose();

console.log("\n✨ Diagnostics complete!");
