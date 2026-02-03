/**
 * Resource Loader Demo
 *
 * Demonstrates the resource loading system with:
 * - Loading shader source code from external files
 * - Using ResourcePipeline for async resource management
 * - Caching and batch loading
 * - Cross-platform resource loading (Browser/Node.js)
 */

import { GraphicsDevice } from "../core/graphics-device";
import { Texture } from "../core/texture";
import {
  ResourcePipeline,
  createResourcePipeline,
  type ShaderSource,
} from "../core/resource-pipeline";
import {
  ResourceLoaderFactory,
  Environment,
} from "../core/resource-loader-factory";
import { SCENE_CONFIG, GEOMETRY, TEXTURE_CONFIG } from "../scene/scene";
import type { VertexBuffer } from "../core/buffer";

/**
 * Demo configuration
 */
const DEMO_CONFIG = {
  shaders: [
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
  ],
  // Additional resources to demonstrate batch loading
  resources: [
    "resources/shaders/basic.vert",
    "resources/shaders/basic.frag",
    "resources/shaders/glow.vert",
    "resources/shaders/glow.frag",
  ],
};

/**
 * Browser-based Resource Loader Demo
 */
export async function runBrowserResourceLoaderDemo(): Promise<void> {
  console.log("🩸 Bloody Engine - Resource Loader Demo");
  console.log("==========================================\n");

  // Detect environment
  const env = ResourceLoaderFactory.detectEnvironment();
  console.log(`✓ Environment detected: ${env}`);

  // Create resource pipeline
  console.log("\n1. Creating Resource Pipeline...");
  const pipeline = await createResourcePipeline({
    concurrency: 5,
    cache: true,
    timeout: 10000,
    baseUrl: window.location.origin,
  });
  console.log("✓ Resource pipeline created");
  console.log(`  - Concurrency: 5`);
  console.log(`  - Caching: enabled`);

  // Demonstrate batch loading
  console.log("\n2. Batch Loading Resources...");
  console.log(`Loading ${DEMO_CONFIG.resources.length} resources...`);

  const batchResult = await pipeline.loadBatch(DEMO_CONFIG.resources);
  console.log(`✓ Batch loading complete`);
  console.log(`  - Succeeded: ${batchResult.successCount}`);
  console.log(`  - Failed: ${batchResult.failureCount}`);

  if (batchResult.failureCount > 0) {
    console.log("\n❌ Failed resources:");
    for (const [path, error] of batchResult.failed) {
      console.log(`  - ${path}: ${error}`);
    }
    console.log("\n⚠️ Falling back to inline shaders...");
    // Continue with inline shaders instead of returning
  }

  // Demonstrate shader loading
  console.log("\n3. Loading Shaders...");
  const shaders = await pipeline.loadShaders(DEMO_CONFIG.shaders);
  console.log(`✓ Loaded ${shaders.length} shaders:`);
  for (const shader of shaders) {
    console.log(`  - ${shader.name}:`);
    console.log(`    Vertex: ${shader.vertex.length} chars`);
    console.log(`    Fragment: ${shader.fragment.length} chars`);
  }

  // Demonstrate caching
  console.log("\n4. Testing Cache...");
  const cachedSize = pipeline.getCacheSize();
  console.log(`✓ Cache contains ${cachedSize} resources`);

  // Check if shaders are cached
  for (const shaderConfig of DEMO_CONFIG.shaders) {
    const vertexCached = pipeline.isCached(shaderConfig.vertex);
    const fragmentCached = pipeline.isCached(shaderConfig.fragment);
    console.log(`  - ${shaderConfig.name}:`);
    console.log(`    Vertex cached: ${vertexCached}`);
    console.log(`    Fragment cached: ${fragmentCached}`);
  }

  // Initialize graphics device
  console.log("\n5. Initializing Graphics Device...");
  const gdevice = new GraphicsDevice(SCENE_CONFIG.width, SCENE_CONFIG.height);
  const gl = gdevice.getGLContext();
  console.log("✓ Graphics device initialized");
  console.log(`  - Resolution: ${SCENE_CONFIG.width}x${SCENE_CONFIG.height}`);

  // Create shader from loaded source
  console.log("\n6. Creating Shader from Loaded Source...");
  let glowShader = shaders.find((s) => s.name === "glow");
  if (!glowShader || !glowShader.vertex || !glowShader.fragment) {
    console.warn("⚠️ Glow shader not loaded or empty, using inline fallback");
    // Use inline shaders as fallback
    glowShader = {
      name: "glow",
      vertex: `attribute vec3 aPosition;
attribute vec2 aTexCoord;

varying vec2 vTexCoord;
varying float vDistance;

uniform mat4 uMatrix;

void main() {
  gl_Position = uMatrix * vec4(aPosition, 1.0);
  vTexCoord = aTexCoord;
  vDistance = length(aTexCoord - vec2(0.5, 0.5));
}`,
      fragment: `precision mediump float;

varying vec2 vTexCoord;
varying float vDistance;
uniform sampler2D uTexture;
uniform vec3 uColor;
uniform float uGlowIntensity;

void main() {
  vec4 texColor = texture2D(uTexture, vTexCoord);
  // Better glow falloff - keeps minimum brightness
  float glow = 1.0 - (vDistance * 0.7);
  glow = max(0.5, glow);
  vec3 glowColor = texColor.rgb * uColor * glow * uGlowIntensity;
  gl_FragColor = vec4(glowColor, texColor.a);
}`,
    };
  }

  const shader = gdevice.createShader(glowShader.vertex, glowShader.fragment);
  console.log("✓ Shader compiled from loaded source code");
  console.log(`  - Vertex shader: compiled`);
  console.log(`  - Fragment shader: compiled`);
  console.log(`  - Program: linked`);

  // Create texture
  console.log("\n7. Creating Texture...");
  const texture = Texture.createGradient(
    gl,
    TEXTURE_CONFIG.size,
    TEXTURE_CONFIG.size,
  );
  console.log("✓ Gradient texture created");
  console.log(`  - Size: ${TEXTURE_CONFIG.size}x${TEXTURE_CONFIG.size}`);

  // Create geometry
  console.log("\n8. Creating Geometry Buffers...");
  // Dynamic import to avoid issues in non-browser environments
  const { VertexBuffer } = await import("../core/buffer");
  const quadBuffer = new VertexBuffer(
    gl,
    GEOMETRY.quad.vertices,
    GEOMETRY.quad.stride,
  );
  console.log("✓ Quad buffer created");
  console.log(`  - Vertices: ${quadBuffer.getVertexCount()}`);

  // Setup rendering
  console.log("\n9. Setting up Rendering...");
  shader.use();

  // Get attribute and uniform locations
  const posAttr = shader.getAttributeLocation("aPosition");
  const texCoordAttr = shader.getAttributeLocation("aTexCoord");
  const textureUniform = shader.getUniformLocation("uTexture");
  const matrixUniform = shader.getUniformLocation("uMatrix");
  const colorUniform = shader.getUniformLocation("uColor");
  const glowIntensityUniform = shader.getUniformLocation("uGlowIntensity");

  // Configure attributes
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
  console.log("✓ Vertex attributes configured");

  // Bind texture
  texture.bind(0);
  gl.uniform1i(textureUniform, 0);
  console.log("✓ Texture bound to unit 0");

  // Get the canvas that was already created by the graphics device
  const renderingContext = gdevice.getRenderingContext();
  const canvas = (renderingContext as any).canvas;

  if (canvas) {
    canvas.style.display = "block";
    canvas.style.margin = "0 auto";
    canvas.style.border = "2px solid #333";
    canvas.style.backgroundColor = "#1a1a1a";
  }

  document.body.style.margin = "0";
  document.body.style.padding = "20px";
  document.body.style.backgroundColor = "#0a0a0a";
  document.body.style.fontFamily = "monospace";
  document.body.style.color = "#aaa";

  // Add title before the canvas
  const title = document.createElement("h1");
  title.textContent = "🩸 Resource Loader Demo";
  title.style.textAlign = "center";
  title.style.color = "#fff";
  if (canvas && canvas.parentNode) {
    canvas.parentNode.insertBefore(title, canvas);
  } else {
    document.body.insertBefore(title, document.body.firstChild);
  }

  // Add info
  const info = document.createElement("div");
  info.style.textAlign = "center";
  info.style.marginTop = "10px";
  info.style.fontSize = "12px";
  info.innerHTML = `
    <div>Environment: <strong>${env}</strong></div>
    <div>Shaders loaded: <strong>${shaders.length}</strong></div>
    <div>Cached resources: <strong>${cachedSize}</strong></div>
  `;
  document.body.appendChild(info);

  // Performance tracking
  let frameCount = 0;
  const startTime = Date.now();
  let lastFrameTime = startTime;

  // Animation loop
  function render(): void {
    const now = Date.now();
    const elapsedSeconds = (now - startTime) / 1000;
    const deltaTime = (now - lastFrameTime) / 1000;
    lastFrameTime = now;

    // Clear with dark background
    gdevice.clear({ r: 0.1, g: 0.1, b: 0.1, a: 1.0 });

    // Render multiple quads with different colors and positions
    const quads = [
      { x: -0.3, y: 0.3, color: [1.0, 0.2, 0.2], glow: 1.5 },
      { x: 0.3, y: 0.3, color: [0.2, 1.0, 0.2], glow: 1.8 },
      { x: -0.3, y: -0.3, color: [0.2, 0.5, 1.0], glow: 2.0 },
      { x: 0.3, y: -0.3, color: [1.0, 1.0, 0.2], glow: 1.6 },
    ];

    for (const quad of quads) {
      // Create transform matrix
      const matrix = createIdentityMatrix();
      translateMatrix(matrix, quad.x, quad.y, 0.0);
      scaleMatrix(matrix, 0.4, 0.4, 1.0);

      // Set uniforms
      if (matrixUniform) {
        gl.uniformMatrix4fv(matrixUniform, false, matrix);
      }
      if (colorUniform) {
        gl.uniform3f(colorUniform, quad.color[0], quad.color[1], quad.color[2]);
      }
      if (glowIntensityUniform) {
        const pulse = quad.glow + Math.sin(elapsedSeconds * 2) * 0.3;
        gl.uniform1f(glowIntensityUniform, pulse);
      }

      // Draw quad
      gl.drawArrays(gl.TRIANGLES, 0, quadBuffer.getVertexCount());
    }

    gdevice.present();

    frameCount++;

    // Update info
    const totalTime = (now - startTime) / 1000;
    const fps = frameCount / totalTime;
    info.innerHTML = `
      <div>FPS: <strong>${fps.toFixed(1)}</strong> | Frame: <strong>${frameCount}</strong> | Elapsed: <strong>${totalTime.toFixed(2)}s</strong></div>
      <div>Environment: <strong>${env}</strong> | Shaders loaded: <strong>${shaders.length}</strong> | Cached: <strong>${cachedSize}</strong></div>
    `;

    requestAnimationFrame(render);
  }

  console.log("\n✓ Demo started! Rendering animation...");
  render();
}

/**
 * Simple matrix utilities (for demo purposes)
 */
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

// Auto-run disabled for npm package
// To run the demo locally, uncomment the following:
/*
if (typeof window !== "undefined") {
  runBrowserResourceLoaderDemo().catch((error) => {
    console.error("❌ Demo failed:", error);
  });
}
*/
