/**
 * Bloody Engine - Browser WebGL Renderer
 * Uses shared scene configuration with Node.js version
 */

import { GraphicsDevice } from "./grahpic-device";
import { Shader } from "./shader";
import { Texture } from "./texture";
import { VertexBuffer } from "./buffer";
import {
  SCENE_CONFIG,
  GEOMETRY,
  SHADERS,
  TEXTURE_CONFIG,
  getBackgroundColor,
  getQuadTransforms,
  getTriangleTransforms,
} from "../scene/scene";
import { SHADER_LIBRARY, type ShaderPreset } from "../examples/shader-examples";

// Configuration
const ACTIVE_SHADER: ShaderPreset = "PSYCHEDELIC";

// Create canvas
const canvas = document.createElement("canvas");
canvas.width = SCENE_CONFIG.width;
canvas.height = SCENE_CONFIG.height;
canvas.style.display = "block";
canvas.style.margin = "0 auto";
canvas.style.border = "2px solid #333";
canvas.style.backgroundColor = "#1a1a1a";
document.body.style.margin = "0";
document.body.style.padding = "20px";
document.body.style.backgroundColor = "#0a0a0a";
document.body.style.fontFamily = "monospace";
document.body.style.color = "#aaa";
document.body.appendChild(canvas);

// Add title
const title = document.createElement("h1");
title.textContent = "🩸 Bloody Engine - Browser Renderer";
title.style.textAlign = "center";
title.style.color = "#fff";
document.body.insertBefore(title, canvas);

// Add info text
const info = document.createElement("div");
info.style.textAlign = "center";
info.style.marginTop = "10px";
info.style.fontSize = "12px";
info.textContent = "Loading...";
document.body.appendChild(info);

// Initialize graphics
const gdevice = new GraphicsDevice(SCENE_CONFIG.width, SCENE_CONFIG.height);
const gl = gdevice.getGLContext();

console.log("✓ Graphics device initialized (Browser WebGL)");

// Create shader (using GLOW shader from examples)
const shaderPreset = SHADER_LIBRARY[ACTIVE_SHADER];
const shader = gdevice.createShader(shaderPreset.vertex, shaderPreset.fragment);
console.log(`✓ Shader compiled and linked (${ACTIVE_SHADER})`);

// Create geometry buffers
const quadBuffer = new VertexBuffer(
  gl,
  GEOMETRY.quad.vertices,
  GEOMETRY.quad.stride,
);
console.log(`✓ Quad buffer created (${quadBuffer.getVertexCount()} vertices)`);

const triangleBuffer = new VertexBuffer(
  gl,
  GEOMETRY.triangle.vertices,
  GEOMETRY.triangle.stride,
);
console.log(
  `✓ Triangle buffer created (${triangleBuffer.getVertexCount()} vertices)`,
);

// Create texture
const texture = Texture.createGradient(
  gl,
  TEXTURE_CONFIG.size,
  TEXTURE_CONFIG.size,
);
console.log(
  `✓ Gradient texture created (${TEXTURE_CONFIG.size}x${TEXTURE_CONFIG.size})`,
);

// Get attribute and uniform locations
const posAttr = shader.getAttributeLocation("aPosition");
const texCoordAttr = shader.getAttributeLocation("aTexCoord");
const textureUniform = shader.getUniformLocation("uTexture");
const matrixUniform = shader.getUniformLocation("uMatrix");
const colorUniform = shader.getUniformLocation("uColor");
const glowIntensityUniform = shader.getUniformLocation("uGlowIntensity");
const timeUniform = shader.getUniformLocation("uTime");

// Setup shader and bindings
shader.use();

// Bind quad buffer and configure attributes
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

// Setup texture
texture.bind(0);
gl.uniform1i(textureUniform, 0);
console.log("✓ Texture bound to unit 0");

// Performance tracking
let frameCount = 0;
const startTime = Date.now();
let lastFrameTime = startTime;

// Animation loop
function render() {
  const now = Date.now();
  const elapsedSeconds = (now - startTime) / 1000;
  const deltaTime = (now - lastFrameTime) / 1000;
  lastFrameTime = now;

  // Clear with animated background
  const bgColor = getBackgroundColor(elapsedSeconds);
  gdevice.clear(bgColor);

  // Render quads
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

  const quadTransforms = getQuadTransforms(elapsedSeconds);
  for (const transform of quadTransforms) {
    if (matrixUniform) {
      gl.uniformMatrix4fv(matrixUniform, false, transform.matrix);
    }
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
      gl.uniform1f(glowIntensityUniform, 1.5 + Math.sin(elapsedSeconds) * 0.5);
    }
    if (timeUniform) {
      gl.uniform1f(timeUniform, elapsedSeconds);
    }
    gl.drawArrays(gl.TRIANGLES, 0, quadBuffer.getVertexCount());
  }

  // Render triangles
  triangleBuffer.bind();
  gl.enableVertexAttribArray(posAttr);
  gl.vertexAttribPointer(
    posAttr,
    3,
    gl.FLOAT,
    false,
    GEOMETRY.triangle.stride,
    0,
  );
  gl.enableVertexAttribArray(texCoordAttr);
  gl.vertexAttribPointer(
    texCoordAttr,
    2,
    gl.FLOAT,
    false,
    GEOMETRY.triangle.stride,
    3 * 4,
  );

  const triangleTransforms = getTriangleTransforms(elapsedSeconds);
  for (const transform of triangleTransforms) {
    if (matrixUniform) {
      gl.uniformMatrix4fv(matrixUniform, false, transform.matrix);
    }
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
    gl.drawArrays(gl.TRIANGLES, 0, triangleBuffer.getVertexCount());
  }

  gdevice.present();

  frameCount++;

  // Update info every frame
  const totalTime = (now - startTime) / 1000;
  const fps = frameCount / totalTime;
  info.textContent = `FPS: ${fps.toFixed(1)} | Frame: ${frameCount} | Elapsed: ${totalTime.toFixed(2)}s`;

  requestAnimationFrame(render);
}

// Start rendering
render();

console.log("✓ Browser renderer initialized and running");
