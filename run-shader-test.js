/**
 * Script to run V5/V6 shader compatibility tests and save results to a file
 */

import { GraphicsDevice } from "./dist/node/index.js";
import { Shader } from "./dist/node/index.js";
import { Texture } from "./dist/node/index.js";
import { Camera } from "./dist/node/index.js";
import { InstancedRenderer } from "./dist/node/index.js";
import { GPUBasedSpriteBatchRenderer } from "./dist/node/index.js";
import { SHADERS_V5, SHADERS_V6 } from "./dist/node/index.js";
import fs from "fs";
import { PNG } from "pngjs";

const TEST_CONFIG = {
  width: 800,
  height: 600,
  outputDir: "./test-output/shader-compatibility",
  tolerance: 2,
};

// Ensure output directory exists
if (!fs.existsSync(TEST_CONFIG.outputDir)) {
  fs.mkdirSync(TEST_CONFIG.outputDir, { recursive: true });
}

// Create test sprites
const sprites = [
  { x: 400, y: 300, z: 0, width: 64, height: 64, color: { r: 1.0, g: 0.2, b: 0.2, a: 1.0 }, gridX: 400, gridY: 300 },
  { x: 200, y: 150, z: 0, width: 48, height: 48, color: { r: 0.2, g: 0.7, b: 0.9, a: 1.0 }, gridX: 200, gridY: 150 },
  { x: 600, y: 450, z: 5, width: 96, height: 96, color: { r: 0.2, g: 1.0, b: 0.4, a: 1.0 }, gridX: 600, gridY: 450 },
];

// Initialize graphics device
const gdevice = new GraphicsDevice(TEST_CONFIG.width, TEST_CONFIG.height);
const gl = gdevice.getGLContext();
const camera = new Camera(TEST_CONFIG.width / 2, TEST_CONFIG.height / 2, 1.0);
const texture = Texture.createSolid(gl, 1, 1, 255, 255, 255);

console.log("✅ Graphics device initialized");
console.log(`📐 Canvas: ${TEST_CONFIG.width}x${TEST_CONFIG.height}`);
console.log(`🎮 Test sprites: ${sprites.length}`);

// Render with V5
console.log("\n🔷 Rendering with V5 (InstancedRenderer)...");
const v5Shader = gdevice.createShader(SHADERS_V5.vertex, SHADERS_V5.fragment);
const v5Renderer = new InstancedRenderer(gl, v5Shader, { maxInstances: 1000, zScale: 1.0 });
v5Renderer.setResolution(TEST_CONFIG.width, TEST_CONFIG.height);
v5Renderer.setTexture(texture);
v5Renderer.setDepthTestEnabled(false);

sprites.forEach(sprite => {
  v5Renderer.addInstance({
    gridX: sprite.gridX ?? sprite.x,
    gridY: sprite.gridY ?? sprite.y,
    z: sprite.z ?? 0,
    color: sprite.color ?? { r: 1, g: 1, b: 1, a: 1 },
    texIndex: 0,
    uvOffset: { u: 0, v: 0 },
    size: { width: sprite.width, height: sprite.height },
  });
});

// Clear any previous errors
while (gl.getError() !== gl.NO_ERROR) {}

gdevice.clear({ r: 0.1, g: 0.1, b: 0.15, a: 1.0 });

// Check enabled attributes before render
console.log("\n🔍 Checking enabled attributes before V5 render...");
const numAttribs = gl.getParameter(gl.MAX_VERTEX_ATTRIBS);
for (let i = 0; i < numAttribs; i++) {
  const enabled = gl.getVertexAttrib(i, gl.VERTEX_ATTRIB_ARRAY_ENABLED);
  if (enabled) {
    const buffer = gl.getVertexAttrib(i, gl.VERTEX_ATTRIB_ARRAY_BUFFER_BINDING);
    const divisor = gl.getVertexAttrib(i, gl.VERTEX_ATTRIB_ARRAY_DIVISOR);
    console.log(`  Attr ${i}: enabled=true, buffer=${buffer ? "bound" : "NULL"}, divisor=${divisor}`);
  }
}

v5Renderer.render(camera);

// Check for errors immediately after render
let error = gl.getError();
if (error !== gl.NO_ERROR) {
  console.error(`\n[ERROR] WebGL error after V5 render: ${error} (0x${error.toString(16)})`);
  console.error("Error: INVALID_OPERATION (1282)");

  // Try to get more info
  console.error("\n🔍 Checking WebGL state after error...");
  const shader = gl.getParameter(gl.CURRENT_PROGRAM);
  console.error(`Current program: ${shader ? "bound" : "NULL"}`);

  const arrayBuffer = gl.getParameter(gl.ARRAY_BUFFER_BINDING);
  console.error(`Array buffer: ${arrayBuffer ? "bound" : "NULL"}`);

  console.error("\n🔍 Checking enabled attributes after error...");
  for (let i = 0; i < Math.min(numAttribs, 16); i++) {
    const enabled = gl.getVertexAttrib(i, gl.VERTEX_ATTRIB_ARRAY_ENABLED);
    if (enabled) {
      const buffer = gl.getVertexAttrib(i, gl.VERTEX_ATTRIB_ARRAY_BUFFER_BINDING);
      const divisor = gl.getVertexAttrib(i, gl.VERTEX_ATTRIB_ARRAY_DIVISOR);
      const size = gl.getVertexAttrib(i, gl.VERTEX_ATTRIB_ARRAY_SIZE);
      const type = gl.getVertexAttrib(i, gl.VERTEX_ATTRIB_ARRAY_TYPE);
      console.log(`  Attr ${i}: size=${size}, type=${type}, buffer=${buffer ? "bound" : "NULL"}, divisor=${divisor}`);
    }
  }
} else {
  console.log("✅ No WebGL errors detected after V5 render");
}

gdevice.present();

const renderingContext = gdevice.getRenderingContext();
const v5Pixels = renderingContext.readPixels();
console.log(`✅ V5 rendered: ${v5Pixels.length} pixels`);

v5Renderer.dispose();
v5Shader.dispose();

// Render with V6
console.log("\n🔶 Rendering with V6 (BatchRenderer)...");
const v6Shader = gdevice.createShader(SHADERS_V6.vertex, SHADERS_V6.fragment);
const v6Renderer = new GPUBasedSpriteBatchRenderer(gl, v6Shader, 1000, { width: 64, height: 64 }, 1.0, 64);
v6Renderer.setResolution(TEST_CONFIG.width, TEST_CONFIG.height);
v6Renderer.setTexture(texture);
v6Renderer.setDepthTestEnabled(false);

sprites.forEach(sprite => v6Renderer.addQuad(sprite));

gdevice.clear({ r: 0.1, g: 0.1, b: 0.15, a: 1.0 });
v6Renderer.render(camera);
gdevice.present();

const v6Pixels = renderingContext.readPixels();
console.log(`✅ V6 rendered: ${v6Pixels.length} pixels`);

v6Renderer.dispose();
v6Shader.dispose();

// Save output images
console.log("\n💾 Saving output images...");

function savePNG(pixelData, width, height, outputPath) {
  const png = new PNG({ width, height });
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const srcIdx = ((height - 1 - y) * width + x) * 4;
      const dstIdx = (y * width + x) * 4;
      png.data[dstIdx] = pixelData[srcIdx];
      png.data[dstIdx + 1] = pixelData[srcIdx + 1];
      png.data[dstIdx + 2] = pixelData[srcIdx + 2];
      png.data[dstIdx + 3] = pixelData[srcIdx + 3];
    }
  }
  const buffer = PNG.sync.write(png);
  fs.writeFileSync(outputPath, buffer);
}

savePNG(v5Pixels, TEST_CONFIG.width, TEST_CONFIG.height, `${TEST_CONFIG.outputDir}/v5-output.png`);
savePNG(v6Pixels, TEST_CONFIG.width, TEST_CONFIG.height, `${TEST_CONFIG.outputDir}/v6-output.png`);

console.log(`  V5: ${TEST_CONFIG.outputDir}/v5-output.png`);
console.log(`  V6: ${TEST_CONFIG.outputDir}/v6-output.png`);

// Compare images
console.log("\n🔍 Comparing V5 and V6 outputs...");
let differentPixels = 0;
let maxDiff = 0;

for (let i = 0; i < v5Pixels.length; i += 4) {
  for (let c = 0; c < 4; c++) {
    const diff = Math.abs(v5Pixels[i + c] - v6Pixels[i + c]);
    if (diff > maxDiff) maxDiff = diff;
    if (diff > TEST_CONFIG.tolerance) {
      differentPixels++;
      break;
    }
  }
}

console.log("\n📊 Comparison Results:");
console.log("=".repeat(50));
console.log(`Total Pixels: ${TEST_CONFIG.width * TEST_CONFIG.height}`);
console.log(`Different Pixels: ${differentPixels}`);
console.log(`Max Diff Per Channel: ${maxDiff}`);
console.log(`Tolerance: ${TEST_CONFIG.tolerance}`);

if (differentPixels === 0) {
  console.log("\n✅ SUCCESS: V5 and V6 produce IDENTICAL output!");
} else {
  console.log("\n⚠️  WARNING: V5 and V6 produce DIFFERENT output!");
  console.log(`   ${differentPixels} pixels differ beyond tolerance`);
}

// Cleanup
texture.dispose();
gdevice.dispose();

console.log("\n✨ Test complete!");
