import { GraphicsDevice } from "./grahpic-device";
import { Shader } from "./shader";
import { Texture } from "./texture";
import { VertexBuffer, IndexBuffer } from "./buffer";
import { SDLWindow } from "./sdl-window";
import { NodeRenderingContext } from "./node-context";
import {
  SCENE_CONFIG,
  GEOMETRY,
  SHADERS,
  TEXTURE_CONFIG,
  ANIMATION_CONFIG,
  getBackgroundColor,
  getQuadTransforms,
  getTriangleTransforms,
} from "./scene";
import { SHADER_LIBRARY, type ShaderPreset } from "./shader-examples";
import fs from "fs";
import { execSync } from "child_process";
import path from "path";

console.log("🩸 Bloody Engine - Texture & Shader Demo");
const WIDTH = SCENE_CONFIG.width;
const HEIGHT = SCENE_CONFIG.height;

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

// Configuration
const ACTIVE_SHADER: ShaderPreset = "PSYCHEDELIC";

// ============================================
// Shader with Texture Support
// ============================================

const shaderPreset = SHADER_LIBRARY[ACTIVE_SHADER];
const vertexShaderSource = shaderPreset.vertex;
const fragmentShaderSource = shaderPreset.fragment;

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
