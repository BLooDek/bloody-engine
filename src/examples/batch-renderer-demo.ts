/**
 * Batch Renderer Demo - V1
 *
 * Demonstrates the simple 2D batch renderer with:
 * - Multiple colored quads
 * - Real-time updates using dynamic vertex buffer
 * - Smooth animation with moving sprites
 */

import { GraphicsDevice } from "../core/grahpic-device";
import { BatchRenderer, type QuadInstance } from "../rendering/batch-renderer";
import { Texture } from "../core/texture";
import { SCENE_CONFIG, SHADERS } from "../scene/scene";
import { SDLWindow } from "../platforms/node/sdl-window";
import { NodeRenderingContext } from "../platforms/node/node-context";
import fs from "fs";
import path from "path";
import { execSync } from "child_process";

const WIDTH = SCENE_CONFIG.width;
const HEIGHT = SCENE_CONFIG.height;
const FRAME_TIME = 1000 / SCENE_CONFIG.targetFPS;

console.log("🩸 Bloody Engine - Batch Renderer V1 Demo");

const gdevice = new GraphicsDevice(WIDTH, HEIGHT);
const gl = gdevice.getGLContext();
const renderingContext = gdevice.getRenderingContext() as NodeRenderingContext;

// Create SDL window for live rendering
let sdlWindow: SDLWindow | null = null;
try {
  sdlWindow = new SDLWindow(WIDTH, HEIGHT, "Bloody Engine - Batch Renderer");
} catch (error) {
  console.warn("⚠ SDL window creation failed, running in headless mode");
}

console.log(`✓ Graphics device initialized (${WIDTH}x${HEIGHT})`);

// Create shader
const shader = gdevice.createShader(SHADERS.vertex, SHADERS.fragment);
console.log("✓ Shader compiled");

// Create texture
const texture = Texture.createGradient(gl, 256, 256);
console.log("✓ Gradient texture created");

// Create batch renderer
const batchRenderer = new BatchRenderer(gl, shader, 1000);
batchRenderer.setTexture(texture);
console.log("✓ Batch renderer created");

// Animation state
let startTime = Date.now();
let frameCount = 0;
const maxFrames = 300; // Render 5 seconds at 60 FPS

/**
 * Create animated quad instances
 */
function getQuadsForFrame(elapsedSeconds: number): QuadInstance[] {
  const quads: QuadInstance[] = [];

  // Quad 1: Red, rotating in center
  const angle1 = elapsedSeconds * 2; // 2 rad/sec
  quads.push({
    x: 0,
    y: 0,
    width: 0.3,
    height: 0.3,
    rotation: angle1,
    color: [1, 0.2, 0.2], // Red
  });

  // Quad 2: Green, orbital motion
  const angle2 = elapsedSeconds * 1.5;
  const orbitRadius2 = 0.4;
  quads.push({
    x: Math.cos(angle2) * orbitRadius2,
    y: Math.sin(angle2) * orbitRadius2,
    width: 0.25,
    height: 0.25,
    rotation: -angle2,
    color: [0.2, 1, 0.2], // Green
  });

  // Quad 3: Blue, different orbital pattern
  const angle3 = elapsedSeconds * 0.8;
  const orbitRadius3 = 0.5;
  quads.push({
    x: Math.cos(angle3 * 2) * orbitRadius3,
    y: Math.sin(angle3) * orbitRadius3,
    width: 0.2,
    height: 0.2,
    rotation: angle3 * 3,
    color: [0.2, 0.5, 1], // Blue
  });

  // Quad 4: Yellow, bouncing motion
  const bounce = 0.3 * Math.sin(elapsedSeconds * 3);
  quads.push({
    x: -0.4,
    y: bounce,
    width: 0.2,
    height: 0.2,
    rotation: elapsedSeconds * 4,
    color: [1, 1, 0.2], // Yellow
  });

  // Quad 5: Cyan, pulsing size
  const pulse = 0.15 + 0.1 * Math.sin(elapsedSeconds * 2.5);
  quads.push({
    x: 0.4,
    y: 0,
    width: pulse,
    height: pulse,
    rotation: -elapsedSeconds,
    color: [0.2, 1, 1], // Cyan
  });

  // Quad 6: Magenta, complex motion
  const angle6 = elapsedSeconds * 1.2;
  const r6 = 0.35 + 0.15 * Math.sin(elapsedSeconds * 2);
  quads.push({
    x: Math.cos(angle6) * r6,
    y: Math.sin(angle6 * 2) * r6,
    width: 0.18,
    height: 0.18,
    rotation: elapsedSeconds * 2.5,
    color: [1, 0.2, 1], // Magenta
  });

  return quads;
}

/**
 * Render a single frame
 */
function renderFrame(): void {
  const now = Date.now();
  const elapsedSeconds = (now - startTime) / 1000;

  // Get quads for this frame
  const quads = getQuadsForFrame(elapsedSeconds);

  // Clear batch
  batchRenderer.clear();

  // Add all quads to batch
  for (const quad of quads) {
    batchRenderer.addQuad(quad);
  }

  // Clear screen with dark background
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
 * Main render loop
 */
async function runAnimation(): Promise<void> {
  console.log(
    `\nRendering ${maxFrames} frames (${(maxFrames / SCENE_CONFIG.targetFPS).toFixed(1)}s)...`,
  );

  const frames: Buffer[] = [];
  const renderStart = Date.now();

  // Render all frames
  while (frameCount < maxFrames && (!sdlWindow || sdlWindow.isOpen())) {
    renderFrame();

    // Capture frame for video
    if (frameCount < 60) {
      // Save first 60 frames for inspection
      const pixelData = renderingContext.readPixels();
      frames.push(Buffer.from(pixelData));
    }

    // Frame time control (optional, for consistent timing)
    await new Promise((resolve) => setTimeout(resolve, 0));
  }

  const renderEnd = Date.now();
  const renderTime = (renderEnd - renderStart) / 1000;
  const avgFPS = frameCount / renderTime;

  console.log(`✓ Rendered ${frameCount} frames in ${renderTime.toFixed(2)}s`);
  console.log(`✓ Average FPS: ${avgFPS.toFixed(1)}`);
  console.log(
    `✓ Batch renderer tested with ${batchRenderer.getQuadCount()} quads`,
  );

  // Save first frame as PPM for inspection
  if (frames.length > 0) {
    const pixelData = frames[0];
    const ppmHeader = `P6\n${WIDTH} ${HEIGHT}\n255\n`;
    const ppmData = Buffer.alloc(3 * WIDTH * HEIGHT);

    // Convert RGBA to RGB
    for (let i = 0; i < WIDTH * HEIGHT; i++) {
      const srcIdx = i * 4;
      const dstIdx = i * 3;
      ppmData[dstIdx] = pixelData[srcIdx]; // R
      ppmData[dstIdx + 1] = pixelData[srcIdx + 1]; // G
      ppmData[dstIdx + 2] = pixelData[srcIdx + 2]; // B
    }

    const ppmPath = "./batch-renderer-demo.ppm";
    fs.writeFileSync(ppmPath, ppmHeader);
    fs.appendFileSync(ppmPath, ppmData);
    console.log(`✓ First frame saved to ${ppmPath}`);

    // Auto-open in system viewer
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
        console.log("✓ Image opened in default viewer");
      } catch (error) {
        // Silently ignore if viewer not available
      }
    }
  }

  // Cleanup
  batchRenderer.dispose();
  gdevice.dispose();

  if (sdlWindow) {
    sdlWindow.cleanup();
  }

  console.log("✓ Demo complete!");
}

// Run animation
runAnimation().catch((error) => {
  console.error("Fatal error:", error);
  process.exit(1);
});
