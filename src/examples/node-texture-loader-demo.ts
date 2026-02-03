/**
 * Node.js Texture Loader Demo
 *
 * Demonstrates the Node.js texture loading system with:
 * - Loading PNG textures from the file system
 * - Manual Y-axis flipping for headless WebGL compatibility
 * - Using loaded textures with WebGL
 * - Batch loading multiple textures
 */

import { GraphicsDevice } from "../core/graphics-device";
import { Texture } from "../core/texture";
import { NodeTextureLoader, type TextureLoadResult } from "../platforms/node/node-texture-loader";
import { Shader } from "../core/shader";
import { VertexBuffer } from "../core/buffer";
import { NodeRenderingContext } from "../platforms/node/node-context";

/**
 * Demo configuration
 */
const DEMO_CONFIG = {
  // Add your PNG texture paths here
  textures: [
    "resources/textures/test.png", // Example path - replace with actual PNG files
  ],
  windowSize: {
    width: 800,
    height: 600,
  },
};

/**
 * Node.js Texture Loader Demo
 */
export async function runNodeTextureLoaderDemo(): Promise<void> {
  console.log("🩸 Bloody Engine - Node.js Texture Loader Demo");
  console.log("===============================================\n");

  // Create texture loader
  console.log("1. Creating Node.js Texture Loader...");
  const loader = new NodeTextureLoader(process.cwd());
  console.log("✓ Texture loader created");
  console.log(`  - Base directory: ${loader.getBaseDir()}`);

  // Demonstrate single texture loading
  console.log("\n2. Loading Single Texture...");
  const testPath = DEMO_CONFIG.textures[0];

  // Check if file exists first
  const exists = await loader.exists(testPath);
  console.log(`  - Checking ${testPath}...`);
  console.log(`  - File exists: ${exists}`);

  if (exists) {
    try {
      const textureResult = await loader.load(testPath);
      console.log("✓ Texture loaded successfully");
      console.log(`  - Dimensions: ${textureResult.width}x${textureResult.height}`);
      console.log(`  - Channels: ${textureResult.channels}`);
      console.log(`  - Data size: ${textureResult.data.length} bytes`);
      console.log(`  - Flipped Y-axis: true (default)`);

      // Demonstrate loading without flipping
      console.log("\n3. Loading Texture Without Flipping...");
      const textureResultNoFlip = await loader.load(testPath, { flipY: false });
      console.log("✓ Texture loaded (not flipped)");
      console.log(`  - Dimensions: ${textureResultNoFlip.width}x${textureResultNoFlip.height}`);
    } catch (error) {
      console.error(`❌ Failed to load texture: ${error}`);
    }
  } else {
    console.log(`⚠️  Texture file not found: ${testPath}`);
    console.log("   Please add a PNG file to test the loader.");
  }

  // Demonstrate batch loading
  console.log("\n4. Batch Loading Textures...");
  const results = await loader.loadMultiple(DEMO_CONFIG.textures);
  console.log(`✓ Batch loading complete`);
  console.log(`  - Total: ${results.length}`);

  let successCount = 0;
  let failureCount = 0;

  for (const result of results) {
    if ("error" in result) {
      failureCount++;
      console.log(`  - ❌ ${result.path}: ${result.error}`);
    } else {
      successCount++;
      console.log(`  - ✓ ${result.path}: ${result.result.width}x${result.result.height}`);
    }
  }

  console.log(`\n  - Succeeded: ${successCount}`);
  console.log(`  - Failed: ${failureCount}`);

  // Demonstrate creating a WebGL texture from loaded data
  if (exists && successCount > 0) {
    console.log("\n5. Creating WebGL Texture from Loaded Data...");

    // Initialize graphics device
    const gdevice = new GraphicsDevice(
      DEMO_CONFIG.windowSize.width,
      DEMO_CONFIG.windowSize.height,
    );
    const gl = gdevice.getGLContext();
    console.log("✓ Graphics device initialized");

    // Load the texture data
    const textureData = await loader.load(testPath);

    // Create a WebGL texture from the loaded data
    const webglTexture = new Texture(
      gl,
      textureData.width,
      textureData.height,
      textureData.data,
    );
    console.log("✓ WebGL texture created from loaded PNG data");
    console.log(`  - Texture handle: ${webglTexture.getHandle()}`);

    // Clean up
    webglTexture.dispose();
    console.log("✓ Texture disposed");
  }

  console.log("\n✓ Demo complete!");
}

/**
 * Create a simple gradient PNG for testing
 * This utility function demonstrates how to create test textures
 */
export function createTestGradientPNG(
  width: number,
  height: number,
): { data: Uint8Array; width: number; height: number } {
  const data = new Uint8Array(width * height * 4);

  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const offset = (y * width + x) * 4;

      // Red gradient horizontally, green gradient vertically
      data[offset] = Math.floor((x / width) * 255); // R
      data[offset + 1] = Math.floor((y / height) * 255); // G
      data[offset + 2] = 128; // B
      data[offset + 3] = 255; // A
    }
  }

  return { data, width, height };
}

/**
 * Example: Using the NodeTextureLoader with a GraphicsDevice
 */
export async function exampleTextureRendering(): Promise<void> {
  console.log("🩸 Example: Rendering with Loaded Textures\n");

  // Initialize graphics device
  const gdevice = new GraphicsDevice(800, 600);
  const gl = gdevice.getGLContext();

  // Create texture loader
  const loader = new NodeTextureLoader();

  // Example shader
  const vertexShader = `
    attribute vec3 aPosition;
    attribute vec2 aTexCoord;

    varying vec2 vTexCoord;

    void main() {
      gl_Position = vec4(aPosition, 1.0);
      vTexCoord = aTexCoord;
    }
  `;

  const fragmentShader = `
    precision mediump float;

    varying vec2 vTexCoord;
    uniform sampler2D uTexture;

    void main() {
      gl_FragColor = texture2D(uTexture, vTexCoord);
    }
  `;

  // Create shader (isBrowser = false for Node.js)
  const shader = new Shader(gl, vertexShader, fragmentShader, false);
  console.log("✓ Shader created");

  // Load texture from file (if exists)
  const texturePath = "resources/textures/test.png";

  if (await loader.exists(texturePath)) {
    const textureData = await loader.load(texturePath);
    const texture = new Texture(gl, textureData.width, textureData.height, textureData.data);
    console.log(`✓ Texture loaded: ${textureData.width}x${textureData.height}`);

    // Create a simple quad
    const quadVertices = new Float32Array([
      // Position (x, y, z)  TexCoord (u, v)
      -0.5, 0.5, 0.0, 0.0, 0.0,
      -0.5, -0.5, 0.0, 0.0, 1.0,
      0.5, 0.5, 0.0, 1.0, 0.0,
      0.5, -0.5, 0.0, 1.0, 1.0,
    ]);

    const vertexBuffer = new VertexBuffer(gl, quadVertices, 5 * 4);
    console.log("✓ Quad buffer created");

    // Setup rendering (simplified example)
    shader.use();
    texture.bind(0);

    const posAttr = shader.getAttributeLocation("aPosition");
    const texCoordAttr = shader.getAttributeLocation("aTexCoord");
    const textureUniform = shader.getUniformLocation("uTexture");

    vertexBuffer.bind();
    gl.enableVertexAttribArray(posAttr);
    gl.vertexAttribPointer(posAttr, 3, gl.FLOAT, false, 20, 0);
    gl.enableVertexAttribArray(texCoordAttr);
    gl.vertexAttribPointer(texCoordAttr, 2, gl.FLOAT, false, 20, 12);

    gl.uniform1i(textureUniform, 0);

    // Clear and draw
    gl.clearColor(0.1, 0.1, 0.1, 1.0);
    gl.clear(gl.COLOR_BUFFER_BIT);
    gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);

    // Present
    gdevice.present();

    console.log("✓ Rendered textured quad");
    console.log("\nNote: In a real application, you would typically");
    console.log("  use the SDLWindow to create a visible window.");
    console.log("  This example demonstrates the basic workflow.");
  } else {
    console.log(`⚠️  Texture file not found: ${texturePath}`);
    console.log("   Add a PNG file to see it rendered.");
  }
}

// Export for manual testing
export { NodeTextureLoader, type TextureLoadResult };

// To run this demo:
// 1. Create a PNG file at resources/textures/test.png
// 2. Run: node dist/examples/node-texture-loader-demo.js
// Or import and run the functions from your code
