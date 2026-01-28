/**
 * Trace exactly where the error occurs
 */

import { GraphicsDevice } from "./dist/node/index.js";
import { Shader } from "./dist/node/index.js";
import { Texture } from "./dist/node/index.js";
import { Camera } from "./dist/node/index.js";
import { InstancedRenderer } from "./dist/node/index.js";
import { SHADERS_V5 } from "./dist/node/index.js";

console.log("Tracing exact error location");
console.log("=====================================\n");

const gdevice = new GraphicsDevice(800, 600);
const gl = gdevice.getGLContext();
const camera = new Camera(400, 300, 1.0);
const texture = Texture.createSolid(gl, 1, 1, 255, 255, 255);

function checkError(label) {
  const error = gl.getError();
  const status = error === gl.NO_ERROR ? 'NO_ERROR' : error + ' (0x' + error.toString(16) + ')';
  console.log(`  ${label}: ${status}`);
  return error === gl.NO_ERROR;
}

// Clear errors
while (gl.getError() !== gl.NO_ERROR) {}

const shader = gdevice.createShader(SHADERS_V5.vertex, SHADERS_V5.fragment);
const renderer = new InstancedRenderer(gl, shader, { maxInstances: 1000, zScale: 1.0 });

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

gdevice.clear({ r: 0.1, g: 0.1, b: 0.15, a: 1.0 });

while (gl.getError() !== gl.NO_ERROR) {}

console.log("Before render:");
checkError("state");

console.log("\nRendering...");
const drawCalls = renderer.render(camera);
console.log("Draw calls: " + drawCalls);

console.log("\nAfter render:");
checkError("immediate");

console.log("\nChecking multiple times:");
for (let i = 0; i < 5; i++) {
  checkError(`check ${i + 1}`);
}

// Cleanup
console.log("\nBefore dispose:");
checkError("state");

renderer.dispose();

console.log("\nAfter dispose:");
checkError("immediate");

shader.dispose();
texture.dispose();
gdevice.dispose();

console.log("\nTest complete!");
