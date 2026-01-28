import {
  GraphicsDevice,
  Camera,
  Shader,
  Texture,
  HybridRenderer as BloodyHybridRenderer,
  SHADERS_V5, // Instanced top-down
  SHADERS_V6, // Batch top-down
  HybridRendererOptions,
  RenderMetrics,
  SpriteQuadInstance,
} from "bloody-engine";
import { CONFIG } from "../utils/Constants.js";

/**
 * Hybrid Renderer Options
 * Extends bloody-engine's HybridRendererOptions with game-specific settings
 */
export interface GameHybridRendererOptions extends HybridRendererOptions {
  /** Enable debug rendering (shows bounding boxes, stats) */
  debug?: boolean;
  /** Enable depth testing for proper z-ordering */
  depthTestEnabled?: boolean;
}

/**
 * Hybrid Renderer
 *
 * Modern renderer that automatically selects the best rendering method:
 * - Uses V5 (Instanced Top-Down) for large batches (≥100 instances)
 * - Uses V6 (Batch Top-Down) for small/unique batches (<100 instances)
 *
 * Performance benefits:
 * - 100x fewer draw calls for large batches
 * - Automatic fallback for dynamic content
 * - Zero-copy GPU transfers via ring buffers
 *
 * Coordinate System (IMPORTANT):
 * V5/V6 are TOP-DOWN shaders - use pixel coordinates, not grid indices!
 *

 *
 * // Render
 * renderer.render();
 * ```
 */
export class HybridRenderer {
  private gl: WebGLRenderingContext;
  private instancedShader: Shader;
  private batchShader: Shader;
  private renderer: BloodyHybridRenderer;
  private graphicsDevice: GraphicsDevice;
  private camera: Camera;
  private texture: Texture | null = null;
  private debug: boolean;
  private depthTestEnabled: boolean;

  // Performance tracking
  private frameCount: number = 0;
  private fpsUpdateTime: number = 0;
  private frameCountThisSecond: number = 0;
  private currentFPS: number = 0;
  private lastMetrics: RenderMetrics | null = null;

  constructor(
    graphicsDevice: GraphicsDevice,
    camera: Camera,
    options: GameHybridRendererOptions = {},
  ) {
    this.graphicsDevice = graphicsDevice;
    this.camera = camera;
    this.gl = graphicsDevice.getGLContext();
    this.debug = options.debug ?? false;
    this.depthTestEnabled = options.depthTestEnabled ?? false;

    // Create shaders from bloody-engine presets using GraphicsDevice
    // This handles environment detection (browser vs Node.js) automatically
    this.instancedShader = this.graphicsDevice.createShader(
      SHADERS_V5.vertex,
      SHADERS_V5.fragment,
    );
    this.batchShader = this.graphicsDevice.createShader(
      SHADERS_V6.vertex,
      SHADERS_V6.fragment,
    );

    const threshold = options.instancingThreshold ?? 100;
    const maxInstances = options.maxInstances ?? 10000;

    // Create the bloody-engine HybridRenderer
    this.renderer = new BloodyHybridRenderer(
      this.gl,
      this.instancedShader,
      this.batchShader,
      {
        instancingThreshold: threshold,
        maxInstances: maxInstances,
        // V5/V6 are top-down - use square tiles (not isometric 2:1 ratio)
        tileSize: options.tileSize ?? { width: 64, height: 64 },
        zScale: options.zScale ?? 1.0,
      },
    );

    this.renderer.setDepthTestEnabled(this.depthTestEnabled);

    // Create a white texture for color-only rendering
    // V5/V6 shaders are texture-based and multiply texture color by tint
    // A white texture allows the tint color to pass through unchanged
    this.createWhiteTexture();

    // ✅ CRITICAL: Set correct resolution for V6 batch renderer
    this.updateResolution();

    // Debug: Log initialization
    if (this.debug) {
      console.log(
        "%c[HybridRenderer] Initialized",
        "color: #00ff00; font-weight: bold",
      );
      console.log("  Mode: V5 (Instanced Top-Down) + V6 (Batch Top-Down)");
      console.log(`  Instancing Threshold: ${threshold} sprites`);
      console.log(`  Max Instances: ${maxInstances}`);
      console.log(
        `  Depth Test: ${this.depthTestEnabled ? "Enabled" : "Disabled"}`,
      );
      console.log("  White Texture: Created for color-only rendering");
      console.log(
        "  Will automatically switch between instancing and batch rendering based on sprite count",
      );
    }
  }

  /**
   * Update resolution from GraphicsDevice
   * CRITICAL for V6 batch renderer - V6 shader uses resolution for NDC conversion
   * Call this after window resize or during initialization
   */
  updateResolution(): void {
    const width = this.graphicsDevice.getWidth();
    const height = this.graphicsDevice.getHeight();

    // CRITICAL: Actually set resolution on both renderers
    // Both V5 (instanced) and V6 (batch) need resolution for NDC conversion
    this.renderer.setResolution(width, height);

    if (this.debug) {
      console.log(`[HybridRenderer] Resolution set: ${width}x${height}`);
    }
  }

  /**
   * Create a 1x1 white texture for color-only rendering
   * V5/V6 shaders sample from texture and multiply by color tint
   * White texture allows tint colors to display correctly
   */
  private createWhiteTexture(): void {
    const gl = this.gl;

    // Use bloody-engine's built-in solid color texture creator
    this.texture = Texture.createSolid(gl, 1, 1, 255, 255, 255);

    // Bind to renderer
    this.renderer.setTexture(this.texture);

    if (this.debug) {
      console.log("  ✅ White texture created:", this.texture);
      console.log("  ✅ Texture bound to renderer");
    }
  }

  /**
   * Clear the screen
   */
  clear(): void {
    this.graphicsDevice.clear({ r: 0.1, g: 0.1, b: 0.15, a: 1.0 });
  }

  /**
   * Add a sprite for rendering
   * Stores the sprite and routes to appropriate renderer during render()
   */
  addSprite(sprite: SpriteQuadInstance): void {
    // Set defaults for optional fields
    const normalizedSprite: SpriteQuadInstance = {
      x: sprite.x,
      y: sprite.y,
      z: sprite.z ?? 0,
      width: sprite.width,
      height: sprite.height,
      rotation: sprite.rotation ?? 0,
      color: sprite.color ?? { r: 1, g: 1, b: 1, a: 1 },
      texIndex: sprite.texIndex ?? 0,
      gridX: sprite.gridX ?? sprite.x,
      gridY: sprite.gridY ?? sprite.y,
    };

    this.renderer.addSprite(normalizedSprite);

    if (this.debug && this.frameCount < 10) {
      console.log(`  [Frame ${this.frameCount}] Added sprite:`, {
        x: normalizedSprite.x.toFixed(1),
        y: normalizedSprite.y.toFixed(1),
        color: normalizedSprite.color,
        texIndex: normalizedSprite.texIndex,
      });
    }
  }

  /**
   * Add a quad (alias for addSprite for API compatibility)
   */
  addQuad(quad: SpriteQuadInstance): void {
    this.addSprite(quad);
  }

  /**
   * Set the texture for rendering
   */
  setTexture(texture: Texture | null): void {
    this.texture = texture;
    this.renderer.setTexture(texture);
  }

  /**
   * Set depth testing enabled
   */
  setDepthTestEnabled(enabled: boolean): void {
    this.depthTestEnabled = enabled;
    this.renderer.setDepthTestEnabled(enabled);
  }

  /**
   * Clear all renderers and stored quads
   */
  clearSprites(): void {
    this.renderer.clear();

    if (this.debug && this.frameCount < 10) {
      console.log(`  [Frame ${this.frameCount}] 🧹 Cleared sprites`);
    }
  }

  /**
   * Render all sprites
   * Returns rendering metrics
   */
  render(): RenderMetrics {
    // Store previous mode for comparison
    const prevMode = this.getRenderingModeInternal();

    // Debug: Check resolution every 60 frames
    if (this.debug && this.frameCount % 60 === 0) {
      const width = this.graphicsDevice.getWidth();
      const height = this.graphicsDevice.getHeight();

      console.log(
        `%c[Frame ${this.frameCount}] GraphicsDevice Resolution: ${width}x${height}`,
        "color: #ffaa00",
      );

      // Check drawing buffer size (actual WebGL framebuffer)
      const gl = this.graphicsDevice.getGLContext() as any;
      const bufferWidth = gl.drawingBufferWidth;
      const bufferHeight = gl.drawingBufferHeight;

      if (bufferWidth !== width || bufferHeight !== height) {
        console.error(`❌ RESOLUTION MISMATCH!`);
        console.error(`   GraphicsDevice: ${width}x${height}`);
        console.error(`   DrawingBuffer: ${bufferWidth}x${bufferHeight}`);
        console.error(
          `   This causes NDC conversion errors in V6 batch shader!`,
        );
      }
    }

    // Ensure texture is bound before rendering (may get unbound between frames)
    if (this.texture) {
      this.renderer.setTexture(this.texture);

      if (this.debug && this.frameCount < 10) {
        console.log(
          `  [Frame ${this.frameCount}] 🎨 Texture re-bound to renderer`,
        );
      }
    } else {
      if (this.debug) {
        console.error(`  [Frame ${this.frameCount}] ❌ ERROR: No texture!`);
      }
    }

    const metrics = this.renderer.render(this.camera);
    this.lastMetrics = metrics;

    // Debug: Log mode switches (this might be causing flashing!)
    if (this.debug && this.frameCount < 100) {
      const currentMode = this.getRenderingModeInternal();
      if (prevMode && currentMode && prevMode.mode !== currentMode.mode) {
        console.warn(
          `⚠️  [Frame ${this.frameCount}] MODE SWITCH: ${prevMode.mode} → ${currentMode.mode}`,
        );
        console.warn(
          `   Previous: instanced=${prevMode.mode === "instanced"}, batched=${prevMode.mode === "batched"}`,
        );
        console.warn(
          `   Current: instanced=${currentMode.mode === "instanced"}, batched=${currentMode.mode === "batched"}`,
        );
        console.warn(`   This might cause visual flashing!`);
        console.warn(
          `   Sprite count: ${metrics.instancedInstances + metrics.batchedInstances}`,
        );
      }
    }

    if (this.debug && this.frameCount < 100) {
      const totalSprites =
        metrics.instancedInstances + metrics.batchedInstances;
      const totalDrawCalls =
        metrics.instancedDrawCalls + metrics.batchedDrawCalls;
      const mode = this.getRenderingModeInternal();

      console.log(`  [Frame ${this.frameCount}] ✅ Render:`, {
        mode: mode?.mode,
        sprites: totalSprites,
        instanced: metrics.instancedInstances,
        batched: metrics.batchedInstances,
        drawCalls: totalDrawCalls,
      });
    }

    // Debug output
    if (this.debug) {
      this.updateFPS();
      this.renderDebugOverlay(metrics);
    }

    this.frameCount++;
    return metrics;
  }

  /**
   * Internal helper to get rendering mode without creating a new object
   */
  private getRenderingModeInternal(): {
    mode: "instanced" | "batched" | "hybrid" | "idle";
  } | null {
    if (!this.lastMetrics) {
      return null;
    }

    const usingInstancing = this.lastMetrics.instancedInstances > 0;
    const usingBatching = this.lastMetrics.batchedInstances > 0;

    if (usingInstancing && usingBatching) {
      return { mode: "hybrid" };
    } else if (usingInstancing) {
      return { mode: "instanced" };
    } else if (usingBatching) {
      return { mode: "batched" };
    } else {
      return { mode: "idle" };
    }
  }

  /**
   * Present the rendered frame
   */
  present(): void {
    this.graphicsDevice.present();
  }

  /**
   * Get rendering metrics from last frame
   */
  getMetrics(): RenderMetrics {
    return this.renderer.getMetrics();
  }

  /**
   * Get total sprite count (after render)
   */
  getSpriteCount(): number {
    return this.renderer.getQuadCount();
  }

  /**
   * Get pending sprite count (before render)
   * Useful for debugging to see how many sprites are queued for rendering
   */
  getPendingSpriteCount(): number {
    return this.renderer.getQuadCount();
  }

  /**
   * Set instancing threshold manually
   */
  setInstancingThreshold(threshold: number): void {
    this.renderer.setInstancingThreshold(threshold);
  }

  /**
   * Get current instancing threshold
   */
  getInstancingThreshold(): number {
    return this.renderer.getInstancingThreshold();
  }

  /**
   * Check if HybridRenderer is being used (vs legacy renderer)
   */
  isHybridMode(): boolean {
    return true;
  }

  /**
   * Get current rendering mode based on last frame
   */
  getCurrentRenderingMode(): {
    mode: "instanced" | "batched" | "hybrid" | "idle";
    usingInstancing: boolean;
    usingBatching: boolean;
    threshold: number;
  } {
    if (!this.lastMetrics) {
      return {
        mode: "idle",
        usingInstancing: false,
        usingBatching: false,
        threshold: this.getInstancingThreshold(),
      };
    }

    const usingInstancing = this.lastMetrics.instancedInstances > 0;
    const usingBatching = this.lastMetrics.batchedInstances > 0;

    let mode: "instanced" | "batched" | "hybrid" | "idle";
    if (usingInstancing && usingBatching) {
      mode = "hybrid";
    } else if (usingInstancing) {
      mode = "instanced";
    } else if (usingBatching) {
      mode = "batched";
    } else {
      mode = "idle";
    }

    return {
      mode,
      usingInstancing,
      usingBatching,
      threshold: this.getInstancingThreshold(),
    };
  }

  /**
   * Get debug info as a formatted string
   */
  getDebugInfo(): string {
    const modeInfo = this.getCurrentRenderingMode();
    const metrics = this.lastMetrics || {
      instancedInstances: 0,
      batchedInstances: 0,
      instancedDrawCalls: 0,
      batchedDrawCalls: 0,
    };

    const totalInstances =
      metrics.instancedInstances + metrics.batchedInstances;
    const totalDrawCalls =
      metrics.instancedDrawCalls + metrics.batchedDrawCalls;

    return `
HybridRenderer Debug Info:
- Mode: ${modeInfo.mode.toUpperCase()}
- Using Instancing (V5): ${modeInfo.usingInstancing}
- Using Batching (V6): ${modeInfo.usingBatching}
- Instancing Threshold: ${modeInfo.threshold}
- Total Sprites: ${totalInstances}
- Total Draw Calls: ${totalDrawCalls}
- FPS: ${this.currentFPS}
`.trim();
  }

  /**
   * Update FPS counter
   */
  private updateFPS(): void {
    this.frameCount++;
    this.frameCountThisSecond++;

    const now = performance.now();
    if (now - this.fpsUpdateTime >= 1000) {
      this.currentFPS = this.frameCountThisSecond;
      this.frameCountThisSecond = 0;
      this.fpsUpdateTime = now;
    }
  }

  /**
   * Render debug overlay with performance metrics
   */
  private renderDebugOverlay(metrics: RenderMetrics): void {
    const gl = this.gl;
    const totalInstances =
      metrics.instancedInstances + metrics.batchedInstances;
    const totalDrawCalls =
      metrics.instancedDrawCalls + metrics.batchedDrawCalls;

    // Determine which mode is active
    const usingInstancing = metrics.instancedInstances > 0;
    const usingBatching = metrics.batchedInstances > 0;
    const threshold = this.getInstancingThreshold();

    // Console output every 60 frames (once per second at 60fps)
    if (this.frameCount % 60 === 0) {
      const modeColor = usingInstancing ? "#00ff00" : "#ffff00";
      console.log(
        `%c[HybridRenderer] Frame ${this.frameCount} | FPS: ${this.currentFPS}`,
        "color: #00aaff; font-weight: bold",
      );

      // Show which mode is active
      if (usingInstancing && usingBatching) {
        console.log(
          `%c  Mode: HYBRID (both instancing and batching)`,
          `color: ${modeColor}`,
        );
      } else if (usingInstancing) {
        console.log(
          `%c  Mode: INSTANCING (V5 shader) - ${totalInstances} >= threshold (${threshold})`,
          "color: #00ff00",
        );
      } else if (usingBatching) {
        console.log(
          `%c  Mode: BATCHING (V6 shader) - ${totalInstances} < threshold (${threshold})`,
          "color: #ffff00",
        );
      } else {
        console.log("%c  Mode: IDLE (no sprites to render)", "color: #888888");
      }

      // Detailed metrics
      console.log(
        `  Instanced (V5): ${metrics.instancedInstances} instances → ${metrics.instancedDrawCalls} draw calls`,
      );
      console.log(
        `  Batched (V6):   ${metrics.batchedInstances} instances → ${metrics.batchedDrawCalls} draw calls`,
      );
      console.log(
        `  Total:          ${totalInstances} sprites → ${totalDrawCalls} draw calls`,
      );

      // Performance analysis
      if (totalInstances > 0) {
        const avgDrawCallsPerSprite = totalDrawCalls / totalInstances;
        const efficiency = usingInstancing
          ? `${(totalInstances / totalDrawCalls).toFixed(1)}x draw call reduction`
          : "N/A (batching mode)";

        console.log(`  Efficiency:     ${efficiency}`);
        console.log(
          `  Avg/Draw Call:  ${avgDrawCallsPerSprite.toFixed(2)} sprites per draw call`,
        );
      }

      console.log("─".repeat(60));
    }
  }

  /**
   * Clean up resources
   */
  dispose(): void {
    this.renderer.dispose();
    this.instancedShader.dispose();
    this.batchShader.dispose();
  }

  /**
   * Check if renderer is ready
   */
  ready(): boolean {
    return true;
  }
}
