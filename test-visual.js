/**
 * Visual Regression Test for Bloody Engine (Standalone JS version)
 *
 * This test:
 * 1. Initializes the engine in headless mode
 * 2. Creates a simple test scene
 * 3. Renders one frame
 * 4. Captures the framebuffer using gl.readPixels
 * 5. Saves as output.png
 * 6. Compares against reference.png (if exists)
 */

import { GraphicsDevice, Shader, Texture, VertexBuffer, ProjectionConfig } from "./dist/node/index.js";
import { PNG } from "pngjs";
import fs from "fs";

// ============================================================================
// Test Configuration
// ============================================================================

const TEST_CONFIG = {
  width: 800,
  height: 600,
  outputDir: "./test-output",
  outputPath: "./test-output/output.png",
  referencePath: "./test-output/reference.png",
  diffPath: "./test-output/diff.png",
  tolerance: 5, // Allow 5 units of difference per channel (0-255)
  maxDifferentPixels: 100, // Allow up to 100 pixels to differ
};

// Test scene configuration
const PROJECTION_CONFIG = new ProjectionConfig(64, 32, 1.0);

// Simple test entities
const TEST_ENTITIES = [
  { gridPos: { xgrid: 5, ygrid: 5, zheight: 0 }, color: [0.2, 1.0, 0.2], size: 1.0 },   // Green
  { gridPos: { xgrid: 7, ygrid: 6, zheight: 0 }, color: [1.0, 0.2, 0.2], size: 0.9 },   // Red
  { gridPos: { xgrid: 6, ygrid: 4, zheight: 2 }, color: [1.0, 1.0, 0.2], size: 0.8 },   // Yellow
  { gridPos: { xgrid: 8, ygrid: 7, zheight: 1 }, color: [0.2, 0.5, 1.0], size: 0.7 },   // Blue
  { gridPos: { xgrid: 4, ygrid: 6, zheight: 3 }, color: [1.0, 0.5, 1.0], size: 0.6 },   // Magenta
];

// Simple quad geometry (2 triangles, 6 vertices)
// Position (x, y, z) + TexCoord (u, v)
const QUAD_VERTICES = new Float32Array([
  // Bottom-left
  -0.5, -0.5, 0.0, 0.0, 0.0,
  // Bottom-right
  0.5, -0.5, 0.0, 1.0, 0.0,
  // Top-right
  0.5, 0.5, 0.0, 1.0, 1.0,
  // Top-right
  0.5, 0.5, 0.0, 1.0, 1.0,
  // Top-left
  -0.5, 0.5, 0.0, 0.0, 1.0,
  // Bottom-left
  -0.5, -0.5, 0.0, 0.0, 0.0,
]);

const STRIDE = 5 * 4; // 5 floats per vertex × 4 bytes

// Shaders
const VERTEX_SHADER = `
attribute vec3 aPosition;
attribute vec2 aTexCoord;

varying vec2 vTexCoord;

uniform mat4 uMatrix;

void main() {
  gl_Position = uMatrix * vec4(aPosition, 1.0);
  vTexCoord = aTexCoord;
}
`;

const FRAGMENT_SHADER = `
precision mediump float;

varying vec2 vTexCoord;
uniform sampler2D uTexture;
uniform vec3 uColor;

void main() {
  vec4 texColor = texture2D(uTexture, vTexCoord);
  gl_FragColor = vec4(texColor.rgb * uColor, texColor.a);
}
`;

// ============================================================================
// Helper Functions
// ============================================================================

/**
 * Ensure the output directory exists
 */
function ensureOutputDir() {
  if (!fs.existsSync(TEST_CONFIG.outputDir)) {
    fs.mkdirSync(TEST_CONFIG.outputDir, { recursive: true });
    console.log(`✓ Created output directory: ${TEST_CONFIG.outputDir}`);
  }
}

/**
 * Grid to screen projection (isometric)
 */
function gridToScreen(gridPos) {
  const xscreen = (gridPos.xgrid - gridPos.ygrid) * PROJECTION_CONFIG.tileWidth / 2;
  const yscreen = (gridPos.xgrid + gridPos.ygrid) * PROJECTION_CONFIG.tileHeight / 2 - gridPos.zheight * PROJECTION_CONFIG.zScale;
  return { xscreen, yscreen };
}

/**
 * Save RGBA pixel data as PNG file
 */
function savePNG(pixelData, width, height, outputPath) {
  const png = new PNG({
    width,
    height,
    filterType: 4,
  });

  // Copy pixel data (flip Y for PNG format)
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
  console.log(`✓ Saved PNG: ${outputPath}`);
}

/**
 * Load PNG file and return pixel data
 */
function loadPNG(inputPath) {
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
function compareImages(actualData, referenceData, width, height) {
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
function createDiffImage(actualData, referenceData, width, height, outputPath) {
  const png = new PNG({ width, height });

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
      png.data[i] = 255;
      png.data[i + 1] = 0;
      png.data[i + 2] = 0;
      png.data[i + 3] = 255;
    } else {
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
function createEntityMatrix(screenX, screenY, size) {
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
async function runVisualRegressionTest() {
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
  const renderingContext = gdevice.getRenderingContext();
  console.log(`✓ Graphics device created (${TEST_CONFIG.width}x${TEST_CONFIG.height})`);
  console.log(`✓ Headless WebGL context initialized`);

  // ==========================================================================
  // Step 2: Create Resources
  // ==========================================================================
  console.log("\n📋 Step 2: Create Rendering Resources");

  const shader = gdevice.createShader(VERTEX_SHADER, FRAGMENT_SHADER);
  console.log("✓ Shader compiled");

  const texture = Texture.createGradient(gl, 256, 256);
  console.log("✓ Gradient texture created");

  const quadBuffer = new VertexBuffer(gl, QUAD_VERTICES, STRIDE);
  console.log(`✓ Quad buffer created (${quadBuffer.getVertexCount()} vertices)`);

  // Setup shader attributes
  shader.use();
  const posAttr = shader.getAttributeLocation("aPosition");
  const texCoordAttr = shader.getAttributeLocation("aTexCoord");
  const colorAttr = shader.getAttributeLocation("aColor");
  const textureUniform = shader.getUniformLocation("uTexture");
  const matrixUniform = shader.getUniformLocation("uMatrix");

  quadBuffer.bind();
  gl.enableVertexAttribArray(posAttr);
  gl.vertexAttribPointer(posAttr, 3, gl.FLOAT, false, STRIDE, 0);
  gl.enableVertexAttribArray(texCoordAttr);
  gl.vertexAttribPointer(texCoordAttr, 2, gl.FLOAT, false, STRIDE, 3 * 4);

  gl.disableVertexAttribArray(colorAttr);
  gl.vertexAttrib4f(colorAttr, 1.0, 1.0, 1.0, 1.0);

  texture.bind(0);
  if (textureUniform) gl.uniform1i(textureUniform, 0);

  console.log("✓ Shader attributes configured");

  // ==========================================================================
  // Step 3: Render Test Frame
  // ==========================================================================
  console.log("\n📋 Step 3: Render Test Frame");

  gdevice.clear({ r: 0.1, g: 0.1, b: 0.12, a: 1.0 });
  console.log("✓ Screen cleared");

  console.log(`✓ Rendering ${TEST_ENTITIES.length} entities...`);
  for (const entity of TEST_ENTITIES) {
    const screenPos = gridToScreen(entity.gridPos);
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
