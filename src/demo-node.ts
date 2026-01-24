import { Shader } from "./core/shader";
import { Texture } from "./core/texture";
import { VertexBuffer, IndexBuffer } from "./core/buffer";
import { SDLWindow } from "./platforms/node/sdl-window";

import {
  SCENE_CONFIG,
  GEOMETRY,
  SHADERS,
  TEXTURE_CONFIG,
  ANIMATION_CONFIG,
  getBackgroundColor,
  getQuadTransforms,
  getTriangleTransforms,
  PROJECTION_CONFIG,
  PROJECTION_ENTITIES,
} from "./scene/scene";
import {
  gridToScreen,
  type GridCoord,
  type ScreenCoord,
} from "./rendering/projection";
import {
  initializeGameProjection,
  createEntity,
  updateEntityScreenPosition,
  sortEntitiesByDepth,
  runExampleScenario,
} from "./examples/projection-examples";
import { SHADER_LIBRARY, type ShaderPreset } from "./examples/shader-examples";
import fs from "fs";
import { execSync } from "child_process";
import path from "path";
import { NodeRenderingContext } from "./platforms/node/node-context";
import { GraphicsDevice } from "./core/grahpic-device";

console.log(
  "🩸 Bloody Engine - Texture & Shader Demo + Projection Visualization + Resource Loader",
);
const WIDTH = SCENE_CONFIG.width;
const HEIGHT = SCENE_CONFIG.height;

// ============================================
// Resource Loader Demo (Node.js)
// ============================================
async function runResourceLoaderDemo() {
  console.log("\n" + "=".repeat(60));
  console.log("📦 RESOURCE LOADER DEMO (Node.js)");
  console.log("=".repeat(60));

  const { ResourceLoaderFactory, Environment } =
    await import("./core/resource-loader-factory");
  const { createResourcePipeline } = await import("./core/resource-pipeline");
  const { GraphicsDevice } = await import("./core/grahpic-device");
  const { Shader } = await import("./core/shader");
  const { Texture } = await import("./core/texture");
  const { VertexBuffer } = await import("./core/buffer");

  console.log(
    `✓ Environment detected: ${ResourceLoaderFactory.detectEnvironment()}`,
  );

  // Create resource pipeline for Node.js
  const pipeline = await createResourcePipeline({
    concurrency: 5,
    cache: true,
    baseDir: process.cwd(),
  });
  console.log("✓ Resource pipeline created for Node.js");

  // Load shader files
  const shaders = [
    {
      name: "basic",
      vertex: "resources/shaders/basic.vert",
      fragment: "resources/shaders/basic.frag",
    },
    {
      name: "glow",
      vertex: "resources/shaders/glow.vert",
      fragment: "resources/shaders/glow.frag",
    },
  ];

  console.log(`\n📝 Loading ${shaders.length} shaders from disk...`);
  const loadedShaders = await pipeline.loadShaders(shaders);

  for (const shader of loadedShaders) {
    console.log(`  ✓ ${shader.name}:`);
    console.log(`    Vertex: ${shader.vertex.length} chars`);
    console.log(`    Fragment: ${shader.fragment.length} chars`);
  }

  console.log(`\n💾 Cache size: ${pipeline.getCacheSize()} resources`);

  // Create graphics device
  const gdevice = new GraphicsDevice(800, 600);
  const gl = gdevice.getGLContext();
  console.log(`✓ Graphics device initialized (800x600)`);

  // Create shader from loaded source
  const glowShader = loadedShaders.find((s) => s.name === "glow")!;
  const shader = gdevice.createShader(glowShader.vertex, glowShader.fragment);
  console.log("✓ Shader compiled from loaded files");

  // Create texture
  const texture = Texture.createGradient(gl, 256, 256);
  console.log("✓ Gradient texture created");

  // Create geometry
  const quadBuffer = new VertexBuffer(
    gl,
    GEOMETRY.quad.vertices,
    GEOMETRY.quad.stride,
  );
  console.log(
    `✓ Quad buffer created (${quadBuffer.getVertexCount()} vertices)`,
  );

  // Setup rendering
  shader.use();
  const posAttr = shader.getAttributeLocation("aPosition");
  const texCoordAttr = shader.getAttributeLocation("aTexCoord");
  const textureUniform = shader.getUniformLocation("uTexture");
  const matrixUniform = shader.getUniformLocation("uMatrix");
  const colorUniform = shader.getUniformLocation("uColor");
  const glowIntensityUniform = shader.getUniformLocation("uGlowIntensity");

  quadBuffer.bind();
  gl.enableVertexAttribArray(posAttr);
  gl.vertexAttribPointer(posAttr, 3, gl.FLOAT, false, GEOMETRY.quad.stride, 0);
  gl.enableVertexAttribArray(texCoordAttr);
  gl.vertexAttribPointer(
    texCoordAttr,
    2,
    gl.FLOAT,
    false,
    GEOMETRY.quad.stride,
    3 * 4,
  );

  texture.bind(0);
  gl.uniform1i(textureUniform, 0);

  // Clear and render a test frame
  gdevice.clear({ r: 0.1, g: 0.1, b: 0.1, a: 1.0 });

  const testQuads = [
    { x: -0.3, y: 0.3, color: [1.0, 0.2, 0.2], glow: 1.5 },
    { x: 0.3, y: 0.3, color: [0.2, 1.0, 0.2], glow: 1.8 },
    { x: -0.3, y: -0.3, color: [0.2, 0.5, 1.0], glow: 2.0 },
    { x: 0.3, y: -0.3, color: [1.0, 1.0, 0.2], glow: 1.6 },
  ];

  for (const quad of testQuads) {
    const matrix = createIdentityMatrix();
    translateMatrix(matrix, quad.x, quad.y, 0.0);
    scaleMatrix(matrix, 0.4, 0.4, 1.0);

    if (matrixUniform) gl.uniformMatrix4fv(matrixUniform, false, matrix);
    if (colorUniform)
      gl.uniform3f(colorUniform, quad.color[0], quad.color[1], quad.color[2]);
    if (glowIntensityUniform) gl.uniform1f(glowIntensityUniform, quad.glow);

    gl.drawArrays(gl.TRIANGLES, 0, quadBuffer.getVertexCount());
  }

  // Capture and save frame
  const renderingContext =
    gdevice.getRenderingContext() as NodeRenderingContext;
  const pixelData = renderingContext.readPixels();
  const ppmPath = "./resource-loader-demo-output.ppm";
  savePPM(pixelData, 800, 600, ppmPath);

  console.log(`✓ Test frame rendered and saved to ${ppmPath}`);
  console.log("✓ Resource loader demo complete!\n");

  // Cleanup
  quadBuffer.dispose();
  texture.dispose();
  shader.dispose();
  gdevice.dispose();
}

// Helper to save PPM file
function savePPM(
  pixelData: Uint8Array,
  width: number,
  height: number,
  outputPath: string,
) {
  const ppmHeader = `P6\n${width} ${height}\n255\n`;
  const ppmData = Buffer.alloc(3 * width * height);

  for (let i = 0; i < width * height; i++) {
    const srcIdx = i * 4;
    const dstIdx = i * 3;
    ppmData[dstIdx] = pixelData[srcIdx];
    ppmData[dstIdx + 1] = pixelData[srcIdx + 1];
    ppmData[dstIdx + 2] = pixelData[srcIdx + 2];
  }

  fs.writeFileSync(outputPath, ppmHeader);
  fs.appendFileSync(outputPath, ppmData);
}

function createIdentityMatrix(): Float32Array {
  return new Float32Array([1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1]);
}

function translateMatrix(
  mat: Float32Array,
  x: number,
  y: number,
  z: number,
): void {
  mat[12] += x;
  mat[13] += y;
  mat[14] += z;
}

function scaleMatrix(mat: Float32Array, x: number, y: number, z: number): void {
  mat[0] *= x;
  mat[5] *= y;
  mat[10] *= z;
}

// Run resource loader demo first
runResourceLoaderDemo().catch((error) => {
  console.error("❌ Resource loader demo failed:", error);
});

const gdevice = new GraphicsDevice(WIDTH, HEIGHT);
const gl = gdevice.getGLContext();
const renderingContext = gdevice.getRenderingContext() as NodeRenderingContext;

// Create SDL window for live rendering
let sdlWindow: SDLWindow | null = null;
try {
  sdlWindow = new SDLWindow(WIDTH, HEIGHT, "Bloody Engine - Live Rendering");
} catch (error) {
  console.warn("⚠ SDL window creation failed:", error);
  console.log("Running in headless mode - output will be saved to file only");
}

console.log(`✓ Graphics device initialized (${WIDTH}x${HEIGHT})`);
console.log(
  `✓ Environment: ${gdevice.isBrowser() ? "Browser (WebGL)" : "Node.js (headless-gl)"}`,
);

// ============================================
// Projection Visualization Setup
// ============================================

console.log("\n✨ Setting up Projection Visualization System...");

// Initialize projection and run example scenario
console.log("\n📊 Running projection example scenario:");
runExampleScenario();

// Setup projection entities for rendering
interface RenderableEntity {
  gridPos: GridCoord;
  screenPos: ScreenCoord;
  color: [number, number, number];
  size: number;
  name: string;
}

const projectionEntities: RenderableEntity[] = PROJECTION_ENTITIES.map(
  (entity) => {
    const screenPos = gridToScreen(entity.gridPos, PROJECTION_CONFIG);
    return {
      gridPos: entity.gridPos,
      screenPos,
      color: entity.color,
      size: entity.size,
      name: entity.name,
    };
  },
);

console.log(
  `✓ ${projectionEntities.length} projection entities prepared for visualization`,
);

// Display entity information
console.log("\n📍 Projection Entities:");
projectionEntities.forEach((entity) => {
  console.log(
    `  • ${entity.name} at grid (${entity.gridPos.xgrid}, ${entity.gridPos.ygrid}, ${entity.gridPos.zheight}) → screen (${entity.screenPos.xscreen.toFixed(0)}, ${entity.screenPos.yscreen.toFixed(0)})`,
  );
});

// Configuration
const ACTIVE_SHADER: ShaderPreset = "PSYCHEDELIC";

// ============================================
// Shader with Texture Support
// ============================================

const shaderPreset = SHADER_LIBRARY[ACTIVE_SHADER];
const vertexShaderSource = shaderPreset.vertex;
const fragmentShaderSource = shaderPreset.fragment;

// ============================================
// Sprite Batch Renderer V2 Demo Function
// ============================================
async function runSpriteBatchRendererV2Demo() {
  console.log("\n" + "=".repeat(60));
  console.log("🎨 SPRITE BATCH RENDERER V2 DEMO (2.5D Sprites)");
  console.log("=".repeat(60));

  // Import necessary classes
  const { SpriteBatchRenderer } = await import("./rendering/batch-renderer");
  const { Camera } = await import("./rendering/camera");

  const gdevice = new GraphicsDevice(WIDTH, HEIGHT);
  const gl = gdevice.getGLContext();
  const renderingContext =
    gdevice.getRenderingContext() as NodeRenderingContext;

  // Create SDL window for live rendering
  let sdlWindow: SDLWindow | null = null;
  try {
    sdlWindow = new SDLWindow(WIDTH, HEIGHT, "Bloody Engine - V2 Sprites + Camera");
  } catch (error) {
    console.warn("⚠ SDL window creation failed, running in headless mode");
  }

  console.log(`✓ Graphics device initialized (${WIDTH}x${HEIGHT})`);

  // Import SHADERS_V2
  const { SHADERS_V2 } = await import("./scene/scene");

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

  // ============================================
  // Camera System Setup
  // ============================================
  const camera = new Camera(0, 0, 1.0);
  console.log("✓ Camera created");
  console.log("\n🎮 Camera Controls:");
  console.log("  • WASD / Arrow Keys - Move camera");
  console.log("  • Q / E - Zoom out / in");
  console.log("  • R - Reset camera");
  console.log("  • ESC - Exit demo");

  // Keyboard state for smooth camera movement
  const keys = new Set<string>();

  // Camera movement speed (world units per second)
  const moveSpeed = 0.5;
  const zoomSpeed = 2.0; // zoom factor per second

  // Animation state
  let startTime = Date.now();
  let frameCount = 0;
  let lastTime = startTime;

  // ============================================
  // Keyboard Event Handlers
  // ============================================
  if (sdlWindow) {
    sdlWindow.on("keyDown", (event: any) => {
      keys.add(event.key.toLowerCase());

      // Handle reset camera
      if (event.key.toLowerCase() === "r") {
        camera.reset();
        console.log("📷 Camera reset to default position");
      }
    });

    sdlWindow.on("keyUp", (event: any) => {
      keys.delete(event.key.toLowerCase());
    });
  }

  /**
   * Create animated sprite quad instances with full V2 features
   */
  function getSpriteQuadsForFrame(elapsedSeconds: number) {
    const quads = [];

    // Sprite 1: Red, with alpha transparency, at z=-0.5 (background layer)
    const angle1 = elapsedSeconds * 2;
    quads.push({
      x: 0,
      y: 0,
      z: -0.5,
      width: 0.3,
      height: 0.3,
      rotation: angle1,
      color: { r: 1, g: 0.2, b: 0.2, a: 0.7 },
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
      color: { r: 0.2, g: 1, b: 0.2, a: 1 },
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
      uvRect: { uMin: 0, vMin: 0, uMax: 0.5, vMax: 0.5 },
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
      color: { r: 0.2, g: pulseColor, b: pulseColor, a: 1 },
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
      uvRect: { uMin: 0.5, vMin: 0.5, uMax: 1, vMax: 1 },
      texIndex: 1,
    });

    return quads;
  }

  /**
   * Render a single frame
   */
  function renderFrame() {
    const now = Date.now();
    const deltaTime = (now - lastTime) / 1000; // Delta time in seconds
    const elapsedSeconds = (now - startTime) / 1000;
    lastTime = now;

    // ============================================
    // Handle Camera Input
    // ============================================
    let cameraMoved = false;
    const moveAmount = moveSpeed * deltaTime;

    // Movement: WASD or Arrow keys
    if (keys.has("w") || keys.has("arrowup")) {
      camera.y += moveAmount;
      cameraMoved = true;
    }
    if (keys.has("s") || keys.has("arrowdown")) {
      camera.y -= moveAmount;
      cameraMoved = true;
    }
    if (keys.has("a") || keys.has("arrowleft")) {
      camera.x -= moveAmount;
      cameraMoved = true;
    }
    if (keys.has("d") || keys.has("arrowright")) {
      camera.x += moveAmount;
      cameraMoved = true;
    }

    // Zoom: Q/E keys
    const zoomFactor = 1 + (zoomSpeed - 1) * deltaTime;
    if (keys.has("q")) {
      camera.zoomBy(1 / zoomFactor); // Zoom out
      cameraMoved = true;
    }
    if (keys.has("e")) {
      camera.zoomBy(zoomFactor); // Zoom in
      cameraMoved = true;
    }

    // Print camera status when changed
    if (cameraMoved && frameCount % 30 === 0) {
      console.log(
        `📷 Camera: x=${camera.x.toFixed(2)}, y=${camera.y.toFixed(2)}, zoom=${camera.zoom.toFixed(2)}x`,
      );
    }

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

    // Render batch with camera
    spriteBatchRenderer.render(camera);

    // Present frame
    gdevice.present();

    // Update SDL window
    if (sdlWindow && sdlWindow.isOpen()) {
      const pixelData = renderingContext.readPixels();
      sdlWindow.updatePixels(pixelData);
    }

    frameCount++;
  }

  console.log("\n🎬 Starting render loop (press ESC to exit)...");

  const frames = [];
  const renderStart = Date.now();

  // Handle ESC key and window close
  let running = true;
  if (sdlWindow) {
    sdlWindow.on("close", () => {
      running = false;
    });

    sdlWindow.on("keyDown", (event: any) => {
      if (event.key === "escape") {
        running = false;
        console.log("\n✓ Exiting demo...");
      }
    });
  }

  // Render all frames
  while (running && (!sdlWindow || sdlWindow.isOpen())) {
    renderFrame();

    // Capture first frame for inspection
    if (frameCount === 1) {
      const pixelData = renderingContext.readPixels();
      frames.push(Buffer.from(pixelData));
    }

    // Frame time control (~60 FPS)
    await new Promise((resolve) => setTimeout(resolve, 16));
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

    const ppmPath = "./sprite-batch-renderer-v2-demo.ppm";
    fs.writeFileSync(ppmPath, ppmHeader);
    fs.appendFileSync(ppmPath, ppmData);
    console.log(`✓ First frame saved to ${ppmPath}`);
  }

  // Cleanup
  spriteBatchRenderer.dispose();
  gdevice.dispose();

  if (sdlWindow) {
    sdlWindow.cleanup();
  }

  console.log("✓ Sprite batch renderer demo complete!\n");
}

(async () => {
  try {
    console.log("\n--- Setting up Textured Quad ---");

    // Create shader
    const shader = gdevice.createShader(
      vertexShaderSource,
      fragmentShaderSource,
    );
    console.log(`✓ Shader compiled and linked (${ACTIVE_SHADER})`);

    // Create textured quad geometry
    // Quad: 2 triangles (6 vertices)
    // Position (x, y, z) + TexCoord (u, v)
    const quadVertices = GEOMETRY.quad.vertices;

    // Create vertex buffer (5 floats per vertex: 3 for position, 2 for texcoord)
    const vertexBuffer = new VertexBuffer(
      gl,
      quadVertices,
      GEOMETRY.quad.stride,
    );
    console.log(
      `✓ Vertex buffer created (${vertexBuffer.getVertexCount()} vertices)`,
    );

    // Create triangle geometry
    // Triangle: 3 vertices
    // Position (x, y, z) + TexCoord (u, v)
    const triangleVertices = GEOMETRY.triangle.vertices;

    // Create triangle buffer
    const triangleBuffer = new VertexBuffer(
      gl,
      triangleVertices,
      GEOMETRY.triangle.stride,
    );
    console.log(
      `✓ Triangle buffer created (${triangleBuffer.getVertexCount()} vertices)`,
    );

    // Create a colorful gradient texture
    const texture = Texture.createGradient(
      gl,
      TEXTURE_CONFIG.size,
      TEXTURE_CONFIG.size,
    );
    console.log("✓ Gradient texture created (256x256)");

    // Get attribute locations
    const posAttr = shader.getAttributeLocation("aPosition");
    const texCoordAttr = shader.getAttributeLocation("aTexCoord");
    const textureUniform = shader.getUniformLocation("uTexture");
    const matrixUniform = shader.getUniformLocation("uMatrix");
    const colorUniform = shader.getUniformLocation("uColor");
    const glowIntensityUniform = shader.getUniformLocation("uGlowIntensity");
    const timeUniform = shader.getUniformLocation("uTime");

    console.log(
      `✓ Attributes located (position=${posAttr}, texCoord=${texCoordAttr})`,
    );

    // Setup rendering
    shader.use();

    // Bind vertex buffer and configure attributes
    vertexBuffer.bind();

    // Position attribute (3 floats, offset 0)
    gl.enableVertexAttribArray(posAttr);
    gl.vertexAttribPointer(posAttr, 3, gl.FLOAT, false, 5 * 4, 0);

    // TexCoord attribute (2 floats, offset 12 bytes)
    gl.enableVertexAttribArray(texCoordAttr);
    gl.vertexAttribPointer(texCoordAttr, 2, gl.FLOAT, false, 5 * 4, 3 * 4);

    console.log("✓ Vertex attributes configured");

    // Setup texture
    texture.bind(0);
    gl.uniform1i(textureUniform, 0);
    console.log("✓ Texture bound to unit 0");

    // Setup identity matrix (no transformation)
    const identityMatrix = new Float32Array([
      1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1,
    ]);

    if (matrixUniform) {
      gl.uniformMatrix4fv(matrixUniform, false, identityMatrix);
    }

    // Clear and render
    gdevice.clear({ r: 0.2, g: 0.2, b: 0.2, a: 1.0 });
    console.log("✓ Screen cleared");

    gl.drawArrays(gl.TRIANGLES, 0, vertexBuffer.getVertexCount());
    console.log(`✓ Rendered ${vertexBuffer.getVertexCount()} vertices`);

    // Present frame
    gdevice.present();
    console.log("✓ Frame presented");

    // Capture frame
    const pixelData = renderingContext.readPixels();
    console.log(
      `✓ Captured frame (${WIDTH}x${HEIGHT}, ${pixelData.length} bytes)`,
    );

    // Display in SDL window if available
    if (sdlWindow && sdlWindow.isOpen()) {
      sdlWindow.updatePixels(pixelData);
    }

    // Save as PPM for quick inspection
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

    // Write PPM file
    const ppmPath = "./rendered-textured-quad.ppm";
    fs.writeFileSync(ppmPath, ppmHeader);
    fs.appendFileSync(ppmPath, ppmData);
    console.log(`✓ Frame saved to ${ppmPath}`);

    // Auto-open in system image viewer (only if not running with SDL window)
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
        console.warn(
          "⚠ Could not auto-open image in viewer (no default handler)",
        );
      }
    }

    // Sample pixels
    console.log(`\n✓ Sample pixels (RGBA):`);
    for (let i = 0; i < 4; i++) {
      const offset = i * 4;
      console.log(
        `  Pixel ${i}: R=${pixelData[offset]}, G=${pixelData[offset + 1]}, B=${pixelData[offset + 2]}, A=${pixelData[offset + 3]}`,
      );
    }

    // Keep window open for interactive viewing
    if (sdlWindow && sdlWindow.isOpen()) {
      console.log("\n✓ SDL Window open - press ESC or close window to exit");
      console.log("💡 Window is interactive and rendering at 60 FPS");

      // Event loop for SDL window
      let frameCount = 0;
      const startTime = Date.now();
      const targetFPS = SCENE_CONFIG.targetFPS;
      const frameTimeMs = 1000 / targetFPS;
      let running = true;

      // Handle close event
      sdlWindow.on("close", () => {
        running = false;
      });

      // Handle ESC key to close window
      sdlWindow.on("keyDown", (event: any) => {
        if (event.key === "escape") {
          running = false;
          sdlWindow.destroy();
        }
      });

      // Render loop
      const renderLoop = () => {
        if (!running || !sdlWindow.isOpen()) {
          return;
        }

        const frameStartTime = Date.now();
        const elapsedSeconds = (frameCount * frameTimeMs) / 1000;

        // Clear with animated background color
        const bgColor = getBackgroundColor(elapsedSeconds);
        gdevice.clear(bgColor);

        // Get quad transformations
        const quadTransforms = getQuadTransforms(elapsedSeconds);
        for (const transform of quadTransforms) {
          const matrixUniform = shader.getUniformLocation("uMatrix");
          if (matrixUniform) {
            gl.uniformMatrix4fv(matrixUniform, false, transform.matrix);
          }

          // Set color uniform
          const colorUniform = shader.getUniformLocation("uColor");
          if (colorUniform) {
            gl.uniform3f(
              colorUniform,
              transform.color[0],
              transform.color[1],
              transform.color[2],
            );
          }

          // Set glow-specific uniforms
          if (glowIntensityUniform) {
            gl.uniform1f(
              glowIntensityUniform,
              1.5 + Math.sin(elapsedSeconds) * 0.5,
            );
          }
          if (timeUniform) {
            gl.uniform1f(timeUniform, elapsedSeconds);
          }

          // Draw quad
          gl.drawArrays(gl.TRIANGLES, 0, vertexBuffer.getVertexCount());
        }

        // Get triangle transformations
        const triangleTransforms = getTriangleTransforms(elapsedSeconds);
        for (const transform of triangleTransforms) {
          const matrixUniform = shader.getUniformLocation("uMatrix");
          if (matrixUniform) {
            gl.uniformMatrix4fv(matrixUniform, false, transform.matrix);
          }

          // Set color uniform
          const colorUniform = shader.getUniformLocation("uColor");
          if (colorUniform) {
            gl.uniform3f(
              colorUniform,
              transform.color[0],
              transform.color[1],
              transform.color[2],
            );
          }

          // Set glow-specific uniforms
          if (glowIntensityUniform) {
            gl.uniform1f(
              glowIntensityUniform,
              2.0 + Math.cos(elapsedSeconds * 0.7) * 0.8,
            );
          }
          if (timeUniform) {
            gl.uniform1f(timeUniform, elapsedSeconds);
          }

          // Draw triangle
          gl.drawArrays(gl.TRIANGLES, 0, triangleBuffer.getVertexCount());
        }

        // ============================================
        // Render Projection Entities
        // ============================================
        // Render each projection entity as a small quad
        for (const entity of projectionEntities) {
          // Create a transform matrix for the entity
          // Position on screen at isometric coordinates
          const screenX = (entity.screenPos.xscreen / WIDTH) * 2 - 1;
          const screenY = 1 - (entity.screenPos.yscreen / HEIGHT) * 2;

          // Create scale based on entity size
          const scale = entity.size * 0.1;

          const entityMatrix = new Float32Array([
            scale,
            0,
            0,
            0,
            0,
            scale,
            0,
            0,
            0,
            0,
            1,
            0,
            screenX,
            screenY,
            0,
            1,
          ]);

          const matrixUniform = shader.getUniformLocation("uMatrix");
          if (matrixUniform) {
            gl.uniformMatrix4fv(matrixUniform, false, entityMatrix);
          }

          // Set entity color
          const colorUniform = shader.getUniformLocation("uColor");
          if (colorUniform) {
            gl.uniform3f(
              colorUniform,
              entity.color[0],
              entity.color[1],
              entity.color[2],
            );
          }

          // Draw entity as quad
          gl.drawArrays(gl.TRIANGLES, 0, vertexBuffer.getVertexCount());
        }

        gdevice.present();

        // Get and display pixels
        const framePixels = renderingContext.readPixels();
        sdlWindow.updatePixels(framePixels);

        frameCount++;

        // Print FPS every 60 frames
        if (frameCount % 60 === 0) {
          const totalElapsed = Date.now() - startTime;
          const fps = (frameCount / totalElapsed) * 1000;
          console.log(`FPS: ${fps.toFixed(1)} | Frames: ${frameCount}`);
        }

        // Frame rate limiting
        const elapsed = Date.now() - frameStartTime;
        const sleepTime = frameTimeMs - elapsed;
        if (sleepTime > 0) {
          setTimeout(renderLoop, sleepTime);
        } else {
          setImmediate(renderLoop);
        }
      };

      // Start render loop
      renderLoop();

      // Wait for window to close
      await new Promise((resolve) => {
        const checkInterval = setInterval(() => {
          if (!sdlWindow.isOpen() || !running) {
            clearInterval(checkInterval);
            resolve(null);
          }
        }, 100);
      });

      const totalTime = (Date.now() - startTime) / 1000;
      console.log(
        `✓ Rendered ${frameCount} frames in ${totalTime.toFixed(2)}s`,
      );
    }

    // Cleanup
    vertexBuffer.dispose();
    texture.dispose();
    shader.dispose();
    console.log("\n✓ Resources cleaned up");

    // Cleanup SDL window
    if (sdlWindow) {
      sdlWindow.cleanup();
    }

    gdevice.dispose();
    console.log("✓ Graphics device disposed");
    console.log("\n=== Rendering Complete ===\n");

    // ============================================
    // Run Sprite Batch Renderer V2 Demo
    // ============================================
    await runSpriteBatchRendererV2Demo();
  } catch (error) {
    console.error("✗ Rendering failed:", error);

    // Cleanup on error
    if (sdlWindow) {
      try {
        sdlWindow.cleanup();
      } catch (e) {
        console.error("Error cleaning up SDL window:", e);
      }
    }

    gdevice.dispose();
    process.exit(1);
  }
})();
