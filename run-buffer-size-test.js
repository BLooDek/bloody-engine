/**
 * Test to identify if the issue is buffer size or instance count
 */

import { GraphicsDevice } from "./dist/node/index.js";
import { Shader } from "./dist/node/index.js";
import { Texture } from "./dist/node/index.js";
import { Camera } from "./dist/node/index.js";
import { InstancedRenderer } from "./dist/node/index.js";
import { SHADERS_V5 } from "./dist/node/index.js";

console.log("Testing buffer size vs instance count");
console.log("=====================================\n");

async function runTests() {
  const testCases = [
    { maxInstances: 1, actualInstances: 1, label: "max=1, instances=1" },
    { maxInstances: 1000, actualInstances: 1, label: "max=1000, instances=1" },
    { maxInstances: 1000, actualInstances: 3, label: "max=1000, instances=3" },
    { maxInstances: 100, actualInstances: 1, label: "max=100, instances=1" },
    { maxInstances: 10, actualInstances: 1, label: "max=10, instances=1" },
  ];

  for (const testCase of testCases) {
    console.log(`\nTest: ${testCase.label}`);
    console.log("-".repeat(40));

    const gdevice = new GraphicsDevice(800, 600);
    const gl = gdevice.getGLContext();
    const camera = new Camera(400, 300, 1.0);
    const texture = Texture.createSolid(gl, 1, 1, 255, 255, 255);

    // Clear errors
    while (gl.getError() !== gl.NO_ERROR) {}

    const shader = gdevice.createShader(SHADERS_V5.vertex, SHADERS_V5.fragment);
    const renderer = new InstancedRenderer(gl, shader, { maxInstances: testCase.maxInstances, zScale: 1.0 });

    renderer.setResolution(800, 600);
    renderer.setTexture(texture);
    renderer.setDepthTestEnabled(false);

    // Add instances
    for (let i = 0; i < testCase.actualInstances; i++) {
      renderer.addInstance({
        gridX: 400 + i * 50,
        gridY: 300,
        z: 0,
        color: { r: 1, g: 0, b: 0, a: 1 },
        texIndex: 0,
        uvOffset: { u: 0, v: 0 },
        size: { width: 64, height: 64 },
      });
    }

    gdevice.clear({ r: 0.1, g: 0.1, b: 0.15, a: 1.0 });

    // Clear errors before render
    while (gl.getError() !== gl.NO_ERROR) {}

    const drawCalls = renderer.render(camera);

    // Check for errors IMMEDIATELY after render
    const error = gl.getError();
    const status = error === gl.NO_ERROR ? 'NO_ERROR' : error + ' (0x' + error.toString(16) + ')';

    console.log(`  Draw calls: ${drawCalls}`);
    console.log(`  WebGL error: ${status}`);

    // Cleanup
    renderer.dispose();
    shader.dispose();
    texture.dispose();
    gdevice.dispose();
  }

  console.log("\nTest complete!");
}

runTests();
