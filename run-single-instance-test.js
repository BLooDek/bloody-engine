/**
 * Test with a single instance to match run-diagnostics.js behavior
 */

import { GraphicsDevice } from "./dist/node/index.js";
import { Shader } from "./dist/node/index.js";
import { Texture } from "./dist/node/index.js";
import { Camera } from "./dist/node/index.js";
import { InstancedRenderer } from "./dist/node/index.js";
import { SHADERS_V5 } from "./dist/node/index.js";

console.log("Testing V5 with SINGLE instance (like run-diagnostics.js)");
console.log("========================================================\n");

const gdevice = new GraphicsDevice(800, 600);
const gl = gdevice.getGLContext();
const camera = new Camera(400, 300, 1.0);
const texture = Texture.createSolid(gl, 1, 1, 255, 255, 255);

// Clear errors
while (gl.getError() !== gl.NO_ERROR) {}

const shader = gdevice.createShader(SHADERS_V5.vertex, SHADERS_V5.fragment);
const renderer = new InstancedRenderer(gl, shader, { maxInstances: 1000, zScale: 1.0 });

renderer.setResolution(800, 600);
renderer.setTexture(texture);
renderer.setDepthTestEnabled(false);

// Add exactly ONE instance (64x64)
renderer.addInstance({
  gridX: 400,
  gridY: 300,
  z: 0,
  color: { r: 1, g: 0, b: 0, a: 1 },
  texIndex: 0,
  uvOffset: { u: 0, v: 0 },
  size: { width: 64, height: 64 },
});

gdevice.clear({ r: 0.1, g: 0.1, b: 0.15, a: 1.0 });

// Clear errors before render
while (gl.getError() !== gl.NO_ERROR) {}

console.log("Calling renderer.render()...");
const drawCalls = renderer.render(camera);
console.log("Draw calls: " + drawCalls);

// Check for errors IMMEDIATELY after render
const error = gl.getError();
const status = error === gl.NO_ERROR ? 'NO_ERROR' : error + ' (0x' + error.toString(16) + ')';
console.log('\nWebGL error after render: ' + status);

if (error === gl.NO_ERROR) {
  console.log('✅ SUCCESS: No WebGL error!');
} else {
  console.log('❌ FAILURE: WebGL error detected');
}

// Cleanup
renderer.dispose();
shader.dispose();
texture.dispose();
gdevice.dispose();

console.log("\nTest complete!");
