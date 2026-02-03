/**
 * Sprite Batch Renderer Demo - V2
 *
 * Demonstrates the 2.5D sprite batch renderer with:
 * - Full vertex structure (position, texture coords, color tint, texture index)
 * - Z-depth layering for 2.5D positioning
 * - Per-sprite color tinting
 * - Texture atlas support via texture index
 * - UV rect selection for sprite sheets
 */

import { GraphicsDevice } from "../core/graphics-device";
import {
  SpriteBatchRenderer,
  type SpriteQuadInstance,
} from "../rendering/batch-renderer";
import { Texture } from "../core/texture";
import { SHADERS_V2, SCENE_CONFIG } from "../scene/scene";
import { SDLWindow } from "../platforms/node/sdl-window";
import { NodeRenderingContext } from "../platforms/node/node-context";
import fs from "fs";
import path from "path";
import { execSync } from "child_process";

const WIDTH = SCENE_CONFIG.width;
const HEIGHT = SCENE_CONFIG.height;
const FRAME_TIME = 1000 / SCENE_CONFIG.targetFPS;

console.log("🩸 Bloody Engine - Sprite Batch Renderer V2 Demo");

const gdevice = new GraphicsDevice(WIDTH, HEIGHT);
const gl = gdevice.getGLContext();
const renderingContext = gdevice.getRenderingContext() as NodeRenderingContext;

// Create SDL window for live rendering
let sdlWindow: SDLWindow | null = null;
try {
  sdlWindow = new SDLWindow(WIDTH, HEIGHT, "Bloody Engine - V2 Sprites");
} catch (error) {
  console.warn("⚠ SDL window creation failed, running in headless mode");
}

console.log(`✓ Graphics device initialized (${WIDTH}x${HEIGHT})`);

// Create V2 shader with full attribute support
const shader = gdevice.createShader(SHADERS_V2.vertex, SHADERS_V2.fragment);
console.log("✓ V2 Shader compiled (supports color tint and texture index)");

// Create texture
const texture = Texture.createGradient(gl, 256, 256);
console.log("✓ Gradient texture created");

// Create sprite batch renderer (V2)
const spriteBatchRenderer = new SpriteBatchRenderer(gl, shader, 1000);
spriteBatchRenderer.setTexture(texture);
console.log("✓ Sprite batch renderer created (V2)");

// Animation state
let startTime = Date.now();
let frameCount = 0;
const maxFrames = 300; // Render 5 seconds at 60 FPS

/**
 * Create animated sprite quad instances with full V2 features
 */
function getSpriteQuadsForFrame(elapsedSeconds: number): SpriteQuadInstance[] {
  const quads: SpriteQuadInstance[] = [];

  // Sprite 1: Red, with alpha transparency, at z=-0.5 (background layer)
  const angle1 = elapsedSeconds * 2;
  quads.push({
    x: 0,
    y: 0,
    z: -0.5, // Background layer
    width: 0.3,
    height: 0.3,
    rotation: angle1,
    color: { r: 1, g: 0.2, b: 0.2, a: 0.7 }, // Red with 70% opacity
    texIndex: 0,
  });

  // Sprite 2: Green, orbital motion at z=0 (middle layer)
  const angle2 = elapsedSeconds * 1.5;
  const orbitRadius2 = 0.4;
  quads.push({
    x: Math.cos(angle2) * orbitRadius2,
    y: Math.sin(angle2) * orbitRadius2,
    z: 0,
    width: 0.25,
    height: 0.25,
    rotation: -angle2,
    color: { r: 0.2, g: 1, b: 0.2, a: 1 }, // Full opacity
    texIndex: 0,
  });

  // Sprite 3: Blue, different orbital pattern at z=0.5 (foreground layer)
  const angle3 = elapsedSeconds * 0.8;
  const orbitRadius3 = 0.5;
  quads.push({
    x: Math.cos(angle3 * 2) * orbitRadius3,
    y: Math.sin(angle3) * orbitRadius3,
    z: 0.5,
    width: 0.2,
    height: 0.2,
    rotation: angle3 * 3,
    color: { r: 0.2, g: 0.5, b: 1, a: 0.9 },
    texIndex: 0,
  });

  // Sprite 4: Yellow, with UV rect selection (texture atlas demo)
  const bounce = 0.3 * Math.sin(elapsedSeconds * 3);
  quads.push({
    x: -0.4,
    y: bounce,
    z: 0.2,
    width: 0.2,
    height: 0.2,
    rotation: elapsedSeconds * 4,
    color: { r: 1, g: 1, b: 0.2, a: 1 },
    uvRect: { uMin: 0, vMin: 0, uMax: 0.5, vMax: 0.5 }, // Use top-left quadrant
    texIndex: 0,
  });

  // Sprite 5: Cyan, pulsing size with color animation
  const pulse = 0.15 + 0.1 * Math.sin(elapsedSeconds * 2.5);
  const pulseColor = 0.5 + 0.5 * Math.sin(elapsedSeconds * 3);
  quads.push({
    x: 0.4,
    y: 0,
    z: -0.2,
    width: pulse,
    height: pulse,
    rotation: -elapsedSeconds,
    color: { r: 0.2, g: pulseColor, b: pulseColor, a: 1 }, // Animated cyan
    texIndex: 0,
  });

  // Sprite 6: Magenta, complex motion with different texIndex
  const angle6 = elapsedSeconds * 1.2;
  const r6 = 0.35 + 0.15 * Math.sin(elapsedSeconds * 2);
  quads.push({
    x: Math.cos(angle6) * r6,
    y: Math.sin(angle6 * 2) * r6,
    z: 0.3,
    width: 0.18,
    height: 0.18,
    rotation: elapsedSeconds * 2.5,
    color: { r: 1, g: 0.2, b: 1, a: 0.8 },
    uvRect: { uMin: 0.5, vMin: 0.5, uMax: 1, vMax: 1 }, // Use bottom-right quadrant
    texIndex: 1, // Different texture index (for texture atlas)
  });

  return quads;
}

/**
 * Render a single frame
 */
function renderFrame(): void {
  const now = Date.now();
  const elapsedSeconds = (now - startTime) / 1000;

  // Get sprite quads for this frame
  const quads = getSpriteQuadsForFrame(elapsedSeconds);

  // Clear batch
  spriteBatchRenderer.clear();

  // Add all quads to batch
  for (const quad of quads) {
    spriteBatchRenderer.addQuad(quad);
  }

  // Clear screen with dark background
  gdevice.clear({ r: 0.1, g: 0.1, b: 0.12, a: 1.0 });

  // Render batch
  spriteBatchRenderer.render();

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
    `✓ Sprite batch renderer tested with ${spriteBatchRenderer.getQuadCount()} sprites`,
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

    const ppmPath = "./sprite-batch-renderer-demo.ppm";
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
  spriteBatchRenderer.dispose();
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
