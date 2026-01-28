/**
 * V5 and V6 Shader Compatibility Test
 *
 * This test verifies that the V5 (instanced) and V6 (batch) shaders
 * produce identical output for the same set of sprites.
 *
 * Test approach:
 * 1. Create a set of test sprites with various properties
 * 2. Render them using V5 (InstancedRenderer)
 * 3. Render them using V6 (BatchRenderer)
 * 4. Compare the framebuffer outputs pixel-by-pixel
 * 5. Save output images for visual inspection
 */

/// <reference types="vitest/globals" />

import { describe, it, expect, beforeAll } from "vitest";
import { GraphicsDevice } from "../core/grahpic-device";
import { Shader } from "../core/shader";
import { Texture } from "../core/texture";
import { Camera } from "../rendering/camera";
import { NodeRenderingContext } from "../platforms/node/node-context";
import { InstancedRenderer } from "../rendering/instanced-renderer";
import { HybridRenderer as BloodyHybridRenderer } from "../rendering/hybrid-renderer";
import { GPUBasedSpriteBatchRenderer } from "../rendering/batch-renderer";
import { SHADERS_V5, SHADERS_V6 } from "../scene/scene";
import type { SpriteQuadInstance } from "bloody-engine";
import fs from "fs";
import { PNG } from "pngjs";

// ============================================================================
// Configuration
// ============================================================================

const TEST_CONFIG = {
  width: 800,
  height: 600,
  outputDir: "./test-output/shader-compatibility",
  tolerance: 2, // Allow small floating point differences
  maxDifferentPixels: 0, // Require exact match (except for tolerance)
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
  }
}

/**
 * Save RGBA pixel data as PNG file
 */
function savePNG(
  pixelData: Uint8Array,
  width: number,
  height: number,
  outputPath: string,
): void {
  const png = new PNG({ width, height });

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
  diffDetails: { r: number; g: number; b: number; a: number };
}

function compareImages(
  data1: Uint8Array,
  data2: Uint8Array,
  width: number,
  height: number,
): CompareResult {
  let differentPixels = 0;
  let totalDiff = 0;
  let maxDiffPerChannel = 0;
  const diffDetails = { r: 0, g: 0, b: 0, a: 0 };

  for (let i = 0; i < data1.length; i += 4) {
    let pixelDiff = false;

    // Compare each channel
    for (let c = 0; c < 4; c++) {
      const diff = Math.abs(data1[i + c] - data2[i + c]);
      if (diff > maxDiffPerChannel) {
        maxDiffPerChannel = diff;
      }
      if (diff > TEST_CONFIG.tolerance) {
        pixelDiff = true;
        diffDetails[['r', 'g', 'b', 'a'][c]]++;
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
    passed: differentPixels === 0,
    totalPixels,
    differentPixels,
    maxDiffPerChannel,
    avgDiff,
    diffDetails,
  };
}

/**
 * Create test sprites with various properties
 */
function createTestSprites(): SpriteQuadInstance[] {
  const sprites: SpriteQuadInstance[] = [];

  // Test 1: Single sprite at origin
  sprites.push({
    x: 400,
    y: 300,
    z: 0,
    width: 64,
    height: 64,
    color: { r: 1.0, g: 0.2, b: 0.2, a: 1.0 }, // Red
    gridX: 400,
    gridY: 300,
  });

  // Test 2: Multiple sprites in a grid
  for (let i = 0; i < 3; i++) {
    for (let j = 0; j < 3; j++) {
      sprites.push({
        x: 200 + i * 150,
        y: 150 + j * 120,
        z: 0,
        width: 48,
        height: 48,
        color: { r: 0.2, g: 0.6 + i * 0.1, b: 0.8, a: 1.0 },
        gridX: 200 + i * 150,
        gridY: 150 + j * 120,
      });
    }
  }

  // Test 3: Different sizes
  sprites.push({
    x: 100,
    y: 100,
    z: 0,
    width: 32,
    height: 32,
    color: { r: 0.2, g: 1.0, b: 0.4, a: 1.0 }, // Green
    gridX: 100,
    gridY: 100,
  });

  sprites.push({
    x: 150,
    y: 100,
    z: 0,
    width: 96,
    height: 96,
    color: { r: 1.0, g: 1.0, b: 0.2, a: 1.0 }, // Yellow
    gridX: 150,
    gridY: 100,
  });

  // Test 4: Different Z-depths
  sprites.push({
    x: 650,
    y: 450,
    z: 10,
    width: 64,
    height: 64,
    color: { r: 0.6, g: 0.2, b: 0.8, a: 1.0 }, // Purple
    gridX: 650,
    gridY: 450,
  });

  sprites.push({
    x: 670,
    y: 470,
    z: 5,
    width: 64,
    height: 64,
    color: { r: 0.2, g: 0.8, b: 1.0, a: 0.8 }, // Cyan, semi-transparent
    gridX: 670,
    gridY: 470,
  });

  return sprites;
}

/**
 * Render sprites using V5 (InstancedRenderer)
 */
function renderWithV5(
  graphicsDevice: GraphicsDevice,
  camera: Camera,
  texture: Texture,
  sprites: SpriteQuadInstance[],
): Uint8Array {
  const gl = graphicsDevice.getGLContext();

  // Create V5 shader
  const v5Shader = graphicsDevice.createShader(
    SHADERS_V5.vertex,
    SHADERS_V5.fragment,
  );

  // Create InstancedRenderer
  const v5Renderer = new InstancedRenderer(gl, v5Shader, {
    maxInstances: 1000,
    zScale: 1.0,
  });

  // Set resolution and texture
  v5Renderer.setResolution(TEST_CONFIG.width, TEST_CONFIG.height);
  v5Renderer.setTexture(texture);
  v5Renderer.setDepthTestEnabled(false);

  // Add all sprites as instances
  for (const sprite of sprites) {
    v5Renderer.addInstance({
      gridX: sprite.gridX ?? sprite.x,
      gridY: sprite.gridY ?? sprite.y,
      z: sprite.z ?? 0,
      color: sprite.color ?? { r: 1, g: 1, b: 1, a: 1 },
      texIndex: sprite.texIndex ?? 0,
      uvOffset: { u: 0, v: 0 },
      size: { width: sprite.width, height: sprite.height },
    });
  }

  // Clear and render
  graphicsDevice.clear({ r: 0.1, g: 0.1, b: 0.15, a: 1.0 });
  v5Renderer.render(camera);
  graphicsDevice.present();

  // Capture framebuffer
  const renderingContext = graphicsDevice.getRenderingContext() as NodeRenderingContext;
  const pixelData = renderingContext.readPixels();

  // Cleanup
  v5Renderer.dispose();
  v5Shader.dispose();

  return pixelData;
}

/**
 * Render sprites using V6 (BatchRenderer)
 */
function renderWithV6(
  graphicsDevice: GraphicsDevice,
  camera: Camera,
  texture: Texture,
  sprites: SpriteQuadInstance[],
): Uint8Array {
  const gl = graphicsDevice.getGLContext();

  // Create V6 shader
  const v6Shader = graphicsDevice.createShader(
    SHADERS_V6.vertex,
    SHADERS_V6.fragment,
  );

  // Create BatchRenderer
  const v6Renderer = new GPUBasedSpriteBatchRenderer(
    gl,
    v6Shader,
    1000, // maxQuads
    { width: 64, height: 64 }, // tileSize
    1.0, // zScale
    64, // spatialCellSize
  );

  // Set resolution and texture
  v6Renderer.setResolution(TEST_CONFIG.width, TEST_CONFIG.height);
  v6Renderer.setTexture(texture);
  v6Renderer.setDepthTestEnabled(false);

  // Add all sprites
  for (const sprite of sprites) {
    v6Renderer.addQuad(sprite);
  }

  // Clear and render
  graphicsDevice.clear({ r: 0.1, g: 0.1, b: 0.15, a: 1.0 });
  v6Renderer.render(camera);
  graphicsDevice.present();

  // Capture framebuffer
  const renderingContext = graphicsDevice.getRenderingContext() as NodeRenderingContext;
  const pixelData = renderingContext.readPixels();

  // Cleanup
  v6Renderer.dispose();
  v6Shader.dispose();

  return pixelData;
}

// ============================================================================
// Tests
// ============================================================================

describe("V5 and V6 Shader Compatibility", () => {
  beforeAll(() => {
    ensureOutputDir();
  });

  it("should render identical output for V5 and V6 shaders", () => {
    // Initialize Graphics Device
    const graphicsDevice = new GraphicsDevice(TEST_CONFIG.width, TEST_CONFIG.height);

    // Create camera (centered)
    const camera = new Camera(TEST_CONFIG.width / 2, TEST_CONFIG.height / 2, 1.0);

    // Create white texture for color-only rendering
    const gl = graphicsDevice.getGLContext();
    const texture = Texture.createSolid(gl, 1, 1, 255, 255, 255);

    // Create test sprites
    const sprites = createTestSprites();

    // Render with both shaders
    const v5Pixels = renderWithV5(graphicsDevice, camera, texture, sprites);
    const v6Pixels = renderWithV6(graphicsDevice, camera, texture, sprites);

    // Save output images for visual inspection
    savePNG(
      v5Pixels,
      TEST_CONFIG.width,
      TEST_CONFIG.height,
      `${TEST_CONFIG.outputDir}/v5-output.png`,
    );
    savePNG(
      v6Pixels,
      TEST_CONFIG.width,
      TEST_CONFIG.height,
      `${TEST_CONFIG.outputDir}/v6-output.png`,
    );

    // Compare the outputs
    const comparison = compareImages(
      v5Pixels,
      v6Pixels,
      TEST_CONFIG.width,
      TEST_CONFIG.height,
    );

    // Log results
    console.log("\n📊 V5 vs V6 Shader Comparison Results:");
    console.log("========================================");
    console.log(`Total Pixels: ${comparison.totalPixels}`);
    console.log(`Different Pixels: ${comparison.differentPixels}`);
    console.log(`Max Diff Per Channel: ${comparison.maxDiffPerChannel}`);
    console.log(`Average Diff: ${comparison.avgDiff.toFixed(4)}`);
    if (comparison.differentPixels > 0) {
      console.log(`Diff Details: R=${comparison.diffDetails.r}, G=${comparison.diffDetails.g}, B=${comparison.diffDetails.b}, A=${comparison.diffDetails.a}`);
    }
    console.log(`Output Images:`);
    console.log(`  V5: ${TEST_CONFIG.outputDir}/v5-output.png`);
    console.log(`  V6: ${TEST_CONFIG.outputDir}/v6-output.png`);

    // Assert they match
    expect(comparison.passed).toBe(true);
    expect(comparison.differentPixels).toBe(0);

    // Cleanup
    texture.dispose();
    graphicsDevice.dispose();
  });

  it("should handle various sprite sizes correctly", () => {
    const graphicsDevice = new GraphicsDevice(TEST_CONFIG.width, TEST_CONFIG.height);
    const camera = new Camera(TEST_CONFIG.width / 2, TEST_CONFIG.height / 2, 1.0);
    const gl = graphicsDevice.getGLContext();
    const texture = Texture.createSolid(gl, 1, 1, 255, 255, 255);

    // Test various sizes
    const sizes = [16, 32, 48, 64, 96, 128];
    const sprites: SpriteQuadInstance[] = [];

    sizes.forEach((size, index) => {
      sprites.push({
        x: 100 + index * 110,
        y: 300,
        z: 0,
        width: size,
        height: size,
        color: { r: 0.5, g: 0.5, b: 0.5, a: 1.0 },
        gridX: 100 + index * 110,
        gridY: 300,
      });
    });

    const v5Pixels = renderWithV5(graphicsDevice, camera, texture, sprites);
    const v6Pixels = renderWithV6(graphicsDevice, camera, texture, sprites);

    const comparison = compareImages(
      v5Pixels,
      v6Pixels,
      TEST_CONFIG.width,
      TEST_CONFIG.height,
    );

    console.log("\n📏 Size Test Results:");
    console.log(`Different Pixels: ${comparison.differentPixels}`);
    console.log(`Max Diff: ${comparison.maxDiffPerChannel}`);

    expect(comparison.passed).toBe(true);

    texture.dispose();
    graphicsDevice.dispose();
  });

  it("should handle various positions correctly", () => {
    const graphicsDevice = new GraphicsDevice(TEST_CONFIG.width, TEST_CONFIG.height);
    const camera = new Camera(TEST_CONFIG.width / 2, TEST_CONFIG.height / 2, 1.0);
    const gl = graphicsDevice.getGLContext();
    const texture = Texture.createSolid(gl, 1, 1, 255, 255, 255);

    // Test various positions (corners and edges)
    const positions = [
      { x: 50, y: 50 },
      { x: 750, y: 50 },
      { x: 50, y: 550 },
      { x: 750, y: 550 },
      { x: 400, y: 300 }, // Center
    ];
    const sprites: SpriteQuadInstance[] = [];

    positions.forEach((pos) => {
      sprites.push({
        x: pos.x,
        y: pos.y,
        z: 0,
        width: 64,
        height: 64,
        color: { r: 0.5, g: 0.5, b: 0.5, a: 1.0 },
        gridX: pos.x,
        gridY: pos.y,
      });
    });

    const v5Pixels = renderWithV5(graphicsDevice, camera, texture, sprites);
    const v6Pixels = renderWithV6(graphicsDevice, camera, texture, sprites);

    const comparison = compareImages(
      v5Pixels,
      v6Pixels,
      TEST_CONFIG.width,
      TEST_CONFIG.height,
    );

    console.log("\n📍 Position Test Results:");
    console.log(`Different Pixels: ${comparison.differentPixels}`);
    console.log(`Max Diff: ${comparison.maxDiffPerChannel}`);

    expect(comparison.passed).toBe(true);

    texture.dispose();
    graphicsDevice.dispose();
  });

  it("should handle various colors and alpha correctly", () => {
    const graphicsDevice = new GraphicsDevice(TEST_CONFIG.width, TEST_CONFIG.height);
    const camera = new Camera(TEST_CONFIG.width / 2, TEST_CONFIG.height / 2, 1.0);
    const gl = graphicsDevice.getGLContext();
    const texture = Texture.createSolid(gl, 1, 1, 255, 255, 255);

    // Test various colors and alpha values
    const colors: Array<{ color: { r: number; g: number; b: number; a: number }; name: string }> = [
      { color: { r: 1.0, g: 0.0, b: 0.0, a: 1.0 }, name: "Red" },
      { color: { r: 0.0, g: 1.0, b: 0.0, a: 1.0 }, name: "Green" },
      { color: { r: 0.0, g: 0.0, b: 1.0, a: 1.0 }, name: "Blue" },
      { color: { r: 1.0, g: 1.0, b: 0.0, a: 1.0 }, name: "Yellow" },
      { color: { r: 1.0, g: 0.0, b: 1.0, a: 1.0 }, name: "Magenta" },
      { color: { r: 0.0, g: 1.0, b: 1.0, a: 1.0 }, name: "Cyan" },
      { color: { r: 1.0, g: 0.5, b: 0.0, a: 0.5 }, name: "Orange (50% alpha)" },
      { color: { r: 0.5, g: 0.5, b: 0.5, a: 0.8 }, name: "Gray (80% alpha)" },
    ];

    const sprites: SpriteQuadInstance[] = [];

    colors.forEach((colorData, index) => {
      sprites.push({
        x: 100 + (index % 4) * 150,
        y: 150 + Math.floor(index / 4) * 150,
        z: 0,
        width: 64,
        height: 64,
        color: colorData.color,
        gridX: 100 + (index % 4) * 150,
        gridY: 150 + Math.floor(index / 4) * 150,
      });
    });

    const v5Pixels = renderWithV5(graphicsDevice, camera, texture, sprites);
    const v6Pixels = renderWithV6(graphicsDevice, camera, texture, sprites);

    const comparison = compareImages(
      v5Pixels,
      v6Pixels,
      TEST_CONFIG.width,
      TEST_CONFIG.height,
    );

    console.log("\n🎨 Color Test Results:");
    console.log(`Different Pixels: ${comparison.differentPixels}`);
    console.log(`Max Diff: ${comparison.maxDiffPerChannel}`);

    expect(comparison.passed).toBe(true);

    texture.dispose();
    graphicsDevice.dispose();
  });

  it("should handle Z-depth ordering correctly", () => {
    const graphicsDevice = new GraphicsDevice(TEST_CONFIG.width, TEST_CONFIG.height);
    const camera = new Camera(TEST_CONFIG.width / 2, TEST_CONFIG.height / 2, 1.0);
    const gl = graphicsDevice.getGLContext();
    const texture = Texture.createSolid(gl, 1, 1, 255, 255, 255);

    // Test Z-depth with overlapping sprites
    const sprites: SpriteQuadInstance[] = [
      {
        x: 400,
        y: 300,
        z: 0,
        width: 100,
        height: 100,
        color: { r: 1.0, g: 0.0, b: 0.0, a: 1.0 }, // Red (back)
        gridX: 400,
        gridY: 300,
      },
      {
        x: 420,
        y: 320,
        z: 5,
        width: 100,
        height: 100,
        color: { r: 0.0, g: 1.0, b: 0.0, a: 0.8 }, // Green (middle, semi-transparent)
        gridX: 420,
        gridY: 320,
      },
      {
        x: 440,
        y: 340,
        z: 10,
        width: 100,
        height: 100,
        color: { r: 0.0, g: 0.0, b: 1.0, a: 0.8 }, // Blue (front, semi-transparent)
        gridX: 440,
        gridY: 340,
      },
    ];

    const v5Pixels = renderWithV5(graphicsDevice, camera, texture, sprites);
    const v6Pixels = renderWithV6(graphicsDevice, camera, texture, sprites);

    const comparison = compareImages(
      v5Pixels,
      v6Pixels,
      TEST_CONFIG.width,
      TEST_CONFIG.height,
    );

    console.log("\n🔺 Z-Depth Test Results:");
    console.log(`Different Pixels: ${comparison.differentPixels}`);
    console.log(`Max Diff: ${comparison.maxDiffPerChannel}`);

    expect(comparison.passed).toBe(true);

    texture.dispose();
    graphicsDevice.dispose();
  });
});
