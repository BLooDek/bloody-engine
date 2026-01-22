/**
 * Batch Renderer Version of index-node.ts
 *
 * Comparison version using BatchRenderer instead of traditional VertexBuffer
 * Demonstrates the difference between:
 * - Traditional: Create static buffers, render with fixed transforms
 * - Batch: Dynamic buffer, update vertices each frame, batch render
 */

import { GraphicsDevice } from "./grahpic-device";
import { BatchRenderer, type QuadInstance } from "./batch-renderer";
import { Texture } from "./texture";
import { SDLWindow } from "./sdl-window";
import { NodeRenderingContext } from "./node-context";
import { SCENE_CONFIG, SHADERS, TEXTURE_CONFIG } from "./scene";
import fs from "fs";
import { execSync } from "child_process";
import path from "path";

const WIDTH = SCENE_CONFIG.width;
const HEIGHT = SCENE_CONFIG.height;
const FRAME_TIME = 1000 / SCENE_CONFIG.targetFPS;
const RENDER_DURATION = 10000; // 10 seconds

console.log("🩸 Bloody Engine - Batch Renderer Version (Comparison)");
const gdevice = new GraphicsDevice(WIDTH, HEIGHT);
const gl = gdevice.getGLContext();
const renderingContext = gdevice.getRenderingContext() as NodeRenderingContext;

// Create SDL window for live rendering
let sdlWindow: SDLWindow | null = null;
try {
  sdlWindow = new SDLWindow(WIDTH, HEIGHT, "Bloody Engine - Batch Renderer");
} catch (error) {
  console.warn("⚠ SDL window creation failed:", error);
  console.log("Running in headless mode");
}

console.log(`✓ Graphics device initialized (${WIDTH}x${HEIGHT})`);
console.log(
  `✓ Environment: ${gdevice.isBrowser() ? "Browser (WebGL)" : "Node.js (headless-gl)"}`,
);

(async () => {
  try {
    console.log("\n--- Setting up Batch Renderer ---");

    // Create shader
    const shader = gdevice.createShader(SHADERS.vertex, SHADERS.fragment);
    console.log("✓ Shader compiled");

    // Create texture
    const texture = Texture.createGradient(
      gl,
      TEXTURE_CONFIG.size,
      TEXTURE_CONFIG.size,
    );
    console.log("✓ Gradient texture created (256x256)");

    // Create batch renderer
    const batchRenderer = new BatchRenderer(gl, shader, 100);
    batchRenderer.setTexture(texture);
    console.log("✓ Batch renderer created (max 100 quads)");

    // Animation state
    let startTime = Date.now();
    let frameCount = 0;
    let lastFrameTime = startTime;
    let totalFrameTime = 0;
    let frameTimeSamples: number[] = [];
    const maxSamples = 100;

    /**
     * Get quads for current frame
     */
    function getQuadsForFrame(elapsedSeconds: number): QuadInstance[] {
      const quads: QuadInstance[] = [];

      // Quad 1: Red rotating
      const angle1 = elapsedSeconds * 2;
      quads.push({
        x: 0,
        y: 0,
        width: 0.3,
        height: 0.3,
        rotation: angle1,
        color: [1, 0.2, 0.2],
      });

      // Quad 2: Green orbital
      const angle2 = elapsedSeconds * 1.5;
      const radius2 = 0.4;
      quads.push({
        x: Math.cos(angle2) * radius2,
        y: Math.sin(angle2) * radius2,
        width: 0.25,
        height: 0.25,
        rotation: -angle2,
        color: [0.2, 1, 0.2],
      });

      // Quad 3: Blue complex orbit
      const angle3 = elapsedSeconds * 0.8;
      const radius3 = 0.5;
      quads.push({
        x: Math.cos(angle3 * 2) * radius3,
        y: Math.sin(angle3) * radius3,
        width: 0.2,
        height: 0.2,
        rotation: angle3 * 3,
        color: [0.2, 0.5, 1],
      });

      return quads;
    }

    /**
     * Render one frame
     */
    function renderFrame(): void {
      const now = Date.now();
      const elapsedSeconds = (now - startTime) / 1000;
      const frameTime = now - lastFrameTime;
      lastFrameTime = now;

      // Track frame times
      if (frameTimeSamples.length < maxSamples) {
        frameTimeSamples.push(frameTime);
      }

      // Get quads for this frame
      const quads = getQuadsForFrame(elapsedSeconds);

      // Clear batch
      batchRenderer.clear();

      // Add quads to batch
      for (const quad of quads) {
        batchRenderer.addQuad(quad);
      }

      // Clear screen
      gdevice.clear({ r: 0.15, g: 0.15, b: 0.15, a: 1.0 });

      // Render batch
      batchRenderer.render();

      // Present frame
      gdevice.present();

      // Update SDL window
      if (sdlWindow && sdlWindow.isOpen()) {
        const pixelData = renderingContext.readPixels();
        sdlWindow.updatePixels(pixelData);
      }

      frameCount++;
    }

    /**
     * Main animation loop
     */
    console.log(`\nStarting animation (${RENDER_DURATION}ms)...`);

    const loopStart = Date.now();
    while (
      Date.now() - loopStart < RENDER_DURATION &&
      (!sdlWindow || sdlWindow.isOpen())
    ) {
      renderFrame();
      await new Promise((resolve) => setImmediate(resolve));
    }

    const loopEnd = Date.now();
    const totalTime = (loopEnd - loopStart) / 1000;
    const avgFPS = frameCount / totalTime;
    const avgFrameTime = totalFrameTime / frameCount;
    const minFrameTime = Math.min(...frameTimeSamples);
    const maxFrameTime = Math.max(...frameTimeSamples);
    const medianFrameTime =
      frameTimeSamples.length > 0
        ? frameTimeSamples.sort((a, b) => a - b)[
            Math.floor(frameTimeSamples.length / 2)
          ]
        : 0;

    console.log("\n--- Performance Results ---");
    console.log(`Total Frames: ${frameCount}`);
    console.log(`Total Time: ${totalTime.toFixed(2)}s`);
    console.log(`Average FPS: ${avgFPS.toFixed(1)}`);
    console.log(`Frame Time Samples: ${frameTimeSamples.length}`);
    if (frameTimeSamples.length > 0) {
      console.log(`  Min Frame Time: ${minFrameTime.toFixed(2)}ms`);
      console.log(`  Max Frame Time: ${maxFrameTime.toFixed(2)}ms`);
      console.log(`  Median Frame Time: ${medianFrameTime.toFixed(2)}ms`);
    }

    console.log(`\nBatch Renderer Quads: ${batchRenderer.getQuadCount()}`);
    console.log(`Dynamic Buffer Updates: ${frameCount}`);

    // Capture a frame
    const pixelData = renderingContext.readPixels();
    const ppmHeader = `P6\n${WIDTH} ${HEIGHT}\n255\n`;
    const ppmData = Buffer.alloc(3 * WIDTH * HEIGHT);

    for (let i = 0; i < WIDTH * HEIGHT; i++) {
      const srcIdx = i * 4;
      const dstIdx = i * 3;
      ppmData[dstIdx] = pixelData[srcIdx];
      ppmData[dstIdx + 1] = pixelData[srcIdx + 1];
      ppmData[dstIdx + 2] = pixelData[srcIdx + 2];
    }

    const ppmPath = "./batch-renderer-comparison.ppm";
    fs.writeFileSync(ppmPath, ppmHeader);
    fs.appendFileSync(ppmPath, ppmData);
    console.log(`\n✓ Frame saved to ${ppmPath}`);

    // Auto-open in viewer
    if (!sdlWindow) {
      try {
        const ppmAbsPath = path.resolve(ppmPath);
        if (process.platform === "win32") {
          execSync(`start "" "${ppmAbsPath}"`);
        } else if (process.platform === "darwin") {
          execSync(`open "${ppmAbsPath}"`);
        } else {
          execSync(`xdg-open "${ppmAbsPath}"`);
        }
      } catch (error) {
        // Silently ignore if viewer not available
      }
    }

    // Cleanup
    batchRenderer.dispose();
    gdevice.dispose();
    if (sdlWindow) {
      sdlWindow.cleanup();
    }

    console.log("\n✓ Comparison test complete!");
  } catch (error) {
    console.error("Error:", error);
    process.exit(1);
  }
})();
