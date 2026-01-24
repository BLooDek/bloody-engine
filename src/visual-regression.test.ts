/**
 * Visual Regression Test for Bloody Engine
 *
 * This test:
 * 1. Initializes the engine in headless mode
 * 2. Loads a test scene
 * 3. Renders one frame
 * 4. Captures the framebuffer using gl.readPixels
 * 5. Saves as output.png
 * 6. Compares against reference.png (if exists)
 */

import { GraphicsDevice } from "./core/grahpic-device";
import { Shader } from "./core/shader";
import { Texture } from "./core/texture";
import { VertexBuffer } from "./core/buffer";
import { NodeRenderingContext } from "./platforms/node/node-context";
import { SCENE_CONFIG, GEOMETRY, SHADERS_V2, PROJECTION_ENTITIES, PROJECTION_CONFIG } from "./scene/scene";
import { gridToScreen, type GridCoord, type ScreenCoord } from "./rendering/projection";
import { PNG } from "pngjs";
import fs from "fs";
import path from "path";

// ============================================================================
// Configuration
// ============================================================================

const TEST_CONFIG = {
  width: SCENE_CONFIG.width,
  height: SCENE_CONFIG.height,
  outputDir: "./test-output",
  outputPath: "./test-output/output.png",
  referencePath: "./test-output/reference.png",
  diffPath: "./test-output/diff.png",
  tolerance: 5, // Allow 5 units of difference per channel (0-255)
  maxDifferentPixels: 100, // Allow up to 100 pixels to differ
};

// ============================================================================
// Helper Functions
// ============================================================================

/**
 * Ensure the output directory exists
 */
function ensureOutputDir(): void {
  if (!fs.existsSync(TEST_CONFIG.outputDir)) {
    fs.mkdirSync(TEST_CONFIG.outputDir, { recursive: true });
    console.log(`✓ Created output directory: ${TEST_CONFIG.outputDir}`);
  }
}

/**
 * Save RGBA pixel data as PNG file
 */
function savePNG(pixelData: Uint8Array, width: number, height: number, outputPath: string): void {
  const png = new PNG({
    width,
    height,
    filterType: 4, // Adaptive filtering
  });

  // Copy pixel data (flip Y for PNG format - OpenGL renders bottom-up)
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const srcIdx = ((height - 1 - y) * width + x) * 4;
      const dstIdx = (y * width + x) * 4;
      png.data[dstIdx] = pixelData[srcIdx];         // R
      png.data[dstIdx + 1] = pixelData[srcIdx + 1]; // G
      png.data[dstIdx + 2] = pixelData[srcIdx + 2]; // B
      png.data[dstIdx + 3] = pixelData[srcIdx + 3]; // A
    }
  }

  // Write PNG file
  const buffer = PNG.sync.write(png);
  fs.writeFileSync(outputPath, buffer);
  console.log(`✓ Saved PNG: ${outputPath}`);
}

/**
 * Load PNG file and return pixel data
 */
function loadPNG(inputPath: string): { data: Buffer; width: number; height: number } | null {
  if (!fs.existsSync(inputPath)) {
    return null;
  }

  const buffer = fs.readFileSync(inputPath);
  const png = PNG.sync.read(buffer);
  return {
    data: png.data,
    width: png.width,
    height: png.height,
  };
}

/**
 * Compare two images and return diff statistics
 */
interface CompareResult {
  passed: boolean;
  totalPixels: number;
  differentPixels: number;
  maxDiffPerChannel: number;
  avgDiff: number;
}

function compareImages(
  actualData: Uint8Array,
  referenceData: Buffer,
  width: number,
  height: number
): CompareResult {
  let differentPixels = 0;
  let totalDiff = 0;
  let maxDiffPerChannel = 0;

  // Convert actualData to match PNG format (flipped Y)
  const actualFlipped = new Uint8Array(actualData.length);
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const srcIdx = ((height - 1 - y) * width + x) * 4;
      const dstIdx = (y * width + x) * 4;
      actualFlipped[dstIdx] = actualData[srcIdx];
      actualFlipped[dstIdx + 1] = actualData[srcIdx + 1];
      actualFlipped[dstIdx + 2] = actualData[srcIdx + 2];
      actualFlipped[dstIdx + 3] = actualData[srcIdx + 3];
    }
  }

  for (let i = 0; i < referenceData.length; i += 4) {
    // Compare each channel
    let pixelDiff = false;
    for (let c = 0; c < 4; c++) {
      const diff = Math.abs(actualFlipped[i + c] - referenceData[i + c]);
      if (diff > maxDiffPerChannel) {
        maxDiffPerChannel = diff;
      }
      if (diff > TEST_CONFIG.tolerance) {
        pixelDiff = true;
      }
      totalDiff += diff;
    }
    if (pixelDiff) {
      differentPixels++;
    }
  }

  const totalPixels = width * height;
  const avgDiff = totalDiff / (totalPixels * 4);

  return {
    passed: differentPixels <= TEST_CONFIG.maxDifferentPixels,
    totalPixels,
    differentPixels,
    maxDiffPerChannel,
    avgDiff,
  };
}

/**
 * Create a diff image highlighting differences
 */
function createDiffImage(
  actualData: Uint8Array,
  referenceData: Buffer,
  width: number,
  height: number,
  outputPath: string
): void {
  const png = new PNG({ width, height });

  // Convert actualData to match PNG format (flipped Y)
  const actualFlipped = new Uint8Array(actualData.length);
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const srcIdx = ((height - 1 - y) * width + x) * 4;
      const dstIdx = (y * width + x) * 4;
      actualFlipped[dstIdx] = actualData[srcIdx];
      actualFlipped[dstIdx + 1] = actualData[srcIdx + 1];
      actualFlipped[dstIdx + 2] = actualData[srcIdx + 2];
      actualFlipped[dstIdx + 3] = actualData[srcIdx + 3];
    }
  }

  for (let i = 0; i < referenceData.length; i += 4) {
    let diff = false;
    for (let c = 0; c < 4; c++) {
      if (Math.abs(actualFlipped[i + c] - referenceData[i + c]) > TEST_CONFIG.tolerance) {
        diff = true;
        break;
      }
    }

    if (diff) {
      // Highlight differences in bright red
      png.data[i] = 255;     // R
      png.data[i + 1] = 0;   // G
      png.data[i + 2] = 0;   // B
      png.data[i + 3] = 255; // A
    } else {
      // Show reference image in grayscale
      const gray = Math.round(
        (referenceData[i] * 0.299 +
          referenceData[i + 1] * 0.587 +
          referenceData[i + 2] * 0.114)
      );
      png.data[i] = gray;
      png.data[i + 1] = gray;
      png.data[i + 2] = gray;
      png.data[i + 3] = referenceData[i + 3];
    }
  }

  const buffer = PNG.sync.write(png);
  fs.writeFileSync(outputPath, buffer);
  console.log(`✓ Saved diff image: ${outputPath}`);
}

/**
 * Create transformation matrix for entity positioning
 */
function createEntityMatrix(screenX: number, screenY: number, size: number): Float32Array {
  // Convert screen position to NDC
  const ndcX = (screenX / TEST_CONFIG.width) * 2 - 1;
  const ndcY = 1 - (screenY / TEST_CONFIG.height) * 2;

  return new Float32Array([
    size, 0,    0, 0,
    0,    size, 0, 0,
    0,    0,    1, 0,
    ndcX, ndcY, 0, 1,
  ]);
}

// ============================================================================
// Test Implementation
// ============================================================================

/**
 * Run the visual regression test
 */
async function runVisualRegressionTest(): Promise<void> {
  console.log("\n" + "=".repeat(60));
  console.log("🎨 VISUAL REGRESSION TEST");
  console.log("=".repeat(60));

  ensureOutputDir();

  // ==========================================================================
  // Step 1: Initialize Engine
  // ==========================================================================
  console.log("\n📋 Step 1: Initialize Graphics Device");
  const gdevice = new GraphicsDevice(TEST_CONFIG.width, TEST_CONFIG.height);
  const gl = gdevice.getGLContext();
  const renderingContext = gdevice.getRenderingContext() as NodeRenderingContext;
  console.log(`✓ Graphics device created (${TEST_CONFIG.width}x${TEST_CONFIG.height})`);
  console.log(`✓ Headless WebGL context initialized`);

  // ==========================================================================
  // Step 2: Create Resources
  // ==========================================================================
  console.log("\n📋 Step 2: Create Rendering Resources");

  // Create shader
  const shader = gdevice.createShader(SHADERS_V2.vertex, SHADERS_V2.fragment);
  console.log("✓ Shader compiled");

  // Create gradient texture
  const texture = Texture.createGradient(gl, 256, 256);
  console.log("✓ Gradient texture created");

  // Create quad geometry
  const quadBuffer = new VertexBuffer(gl, GEOMETRY.quad.vertices, GEOMETRY.quad.stride);
  console.log(`✓ Quad buffer created (${quadBuffer.getVertexCount()} vertices)`);

  // Setup shader attributes
  shader.use();
  const posAttr = shader.getAttributeLocation("aPosition");
  const texCoordAttr = shader.getAttributeLocation("aTexCoord");
  const colorAttr = shader.getAttributeLocation("aColor");
  const texIndexAttr = shader.getAttributeLocation("aTexIndex");
  const textureUniform = shader.getUniformLocation("uTexture");
  const matrixUniform = shader.getUniformLocation("uMatrix");

  quadBuffer.bind();
  gl.enableVertexAttribArray(posAttr);
  gl.vertexAttribPointer(posAttr, 3, gl.FLOAT, false, GEOMETRY.quad.stride, 0);
  gl.enableVertexAttribArray(texCoordAttr);
  gl.vertexAttribPointer(texCoordAttr, 2, gl.FLOAT, false, GEOMETRY.quad.stride, 3 * 4);

  // Setup constant vertex attributes (color and texIndex will use defaults)
  // Since V2 shader expects per-vertex attributes but we're using V1 style geometry,
  // we need to disable or provide default values for these attributes
  gl.disableVertexAttribArray(colorAttr);
  gl.vertexAttrib4f(colorAttr, 1.0, 1.0, 1.0, 1.0);
  gl.disableVertexAttribArray(texIndexAttr);
  gl.vertexAttrib1f(texIndexAttr, 0.0);

  texture.bind(0);
  if (textureUniform) gl.uniform1i(textureUniform, 0);

  console.log("✓ Shader attributes configured");

  // ==========================================================================
  // Step 3: Render Test Frame
  // ==========================================================================
  console.log("\n📋 Step 3: Render Test Frame");

  // Clear with dark background
  gdevice.clear({ r: 0.1, g: 0.1, b: 0.12, a: 1.0 });
  console.log("✓ Screen cleared");

  // Render each projection entity
  console.log(`✓ Rendering ${PROJECTION_ENTITIES.length} entities...`);
  for (const entity of PROJECTION_ENTITIES) {
    const screenPos = gridToScreen(entity.gridPos, PROJECTION_CONFIG);
    const matrix = createEntityMatrix(screenPos.xscreen, screenPos.yscreen, entity.size * 0.1);

    if (matrixUniform) gl.uniformMatrix4fv(matrixUniform, false, matrix);

    const colorAttr = shader.getAttributeLocation("aColor");
    gl.vertexAttrib4f(
      colorAttr,
      entity.color[0],
      entity.color[1],
      entity.color[2],
      1.0
    );

    gl.drawArrays(gl.TRIANGLES, 0, quadBuffer.getVertexCount());
  }

  gdevice.present();
  console.log("✓ Frame rendered and presented");

  // ==========================================================================
  // Step 4: Capture Framebuffer
  // ==========================================================================
  console.log("\n📋 Step 4: Capture Framebuffer");
  const pixelData = renderingContext.readPixels();
  console.log(`✓ Captured ${pixelData.length} bytes (${TEST_CONFIG.width}x${TEST_CONFIG.height} RGBA)`);

  // ==========================================================================
  // Step 5: Save Output
  // ==========================================================================
  console.log("\n📋 Step 5: Save Output Image");
  savePNG(pixelData, TEST_CONFIG.width, TEST_CONFIG.height, TEST_CONFIG.outputPath);

  // ==========================================================================
  // Step 6: Compare Against Reference (if exists)
  // ==========================================================================
  console.log("\n📋 Step 6: Compare Against Reference");

  const reference = loadPNG(TEST_CONFIG.referencePath);

  if (reference === null) {
    console.log(`⚠ Reference image not found: ${TEST_CONFIG.referencePath}`);
    console.log(`  To create a reference, copy the output:`);
    console.log(`    cp ${TEST_CONFIG.outputPath} ${TEST_CONFIG.referencePath}`);
    console.log(`\n✅ Test skipped - no reference to compare against`);
  } else {
    if (reference.width !== TEST_CONFIG.width || reference.height !== TEST_CONFIG.height) {
      console.log(`✗ Reference image size mismatch!`);
      console.log(`  Expected: ${TEST_CONFIG.width}x${TEST_CONFIG.height}`);
      console.log(`  Got: ${reference.width}x${reference.height}`);
      console.log(`\n✅ Test failed - size mismatch`);
    } else {
      const result = compareImages(pixelData, reference.data, TEST_CONFIG.width, TEST_CONFIG.height);

      console.log(`\n📊 Comparison Results:`);
      console.log(`  Total pixels: ${result.totalPixels}`);
      console.log(`  Different pixels: ${result.differentPixels}`);
      console.log(`  Max difference per channel: ${result.maxDiffPerChannel}`);
      console.log(`  Average difference: ${result.avgDiff.toFixed(2)}`);
      console.log(`  Tolerance: ${TEST_CONFIG.tolerance} per channel`);
      console.log(`  Max allowed different pixels: ${TEST_CONFIG.maxDifferentPixels}`);

      if (result.passed) {
        console.log(`\n✅ Test PASSED - Images match within tolerance`);
      } else {
        console.log(`\n✗ Test FAILED - Images differ beyond tolerance`);
        createDiffImage(
          pixelData,
          reference.data,
          TEST_CONFIG.width,
          TEST_CONFIG.height,
          TEST_CONFIG.diffPath
        );
        console.log(`  Diff image saved to: ${TEST_CONFIG.diffPath}`);
      }
    }
  }

  // ==========================================================================
  // Step 7: Cleanup
  // ==========================================================================
  console.log("\n📋 Step 7: Cleanup");
  quadBuffer.dispose();
  texture.dispose();
  shader.dispose();
  gdevice.dispose();
  console.log("✓ Resources cleaned up");

  console.log("\n" + "=".repeat(60));
  console.log("✨ Visual Regression Test Complete");
  console.log("=".repeat(60) + "\n");
}

// Run the test
runVisualRegressionTest().catch((error) => {
  console.error("✗ Test failed with error:", error);
  process.exit(1);
});
