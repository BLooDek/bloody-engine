/**
 * Hybrid Renderer - Automatic Instancing Detection
 *
 * Automatically chooses between instanced and batch rendering
 * based on instance count and performance characteristics.
 *
 * Features:
 * - Automatic detection of when to use instancing
 * - Fallback to batch rendering for small/unique batches
 * - Performance metrics collection
 * - Dynamic threshold adjustment
 *
 * Usage:
 * ```typescript
 * // Single shader (auto-detect, BatchRenderer compatible)
 * const renderer = HybridRenderer.fromBatchShader(gl, graphicsDevice, batchShader, { instancingThreshold: 100 });
 *
 * // Two shaders (explicit control)
 * const renderer = new HybridRenderer(gl, instancedShader, batchShader, { instancingThreshold: 100 });
 * ```
 */

import type { Camera } from "./camera";
import type { Texture } from "../core/texture";
import { Shader } from "../core/shader";
import { InstancedRenderer, type InstanceData } from "./instanced-renderer";
import { GPUBasedSpriteBatchRenderer, type SpriteQuadInstance } from "./batch-renderer";
import { SHADERS_V4, SHADERS_V5 } from "../scene/scene";
import type { GraphicsDevice } from "../core/graphics-device";

/**
 * Hybrid Renderer Options
 */
export interface HybridRendererOptions {
  /** Minimum instances to trigger instancing (default 100) */
  instancingThreshold?: number;
  /** Maximum instances per batch (default 10000) */
  maxInstances?: number;
  /** Tile size for isometric projection (default {width: 64, height: 32}) */
  tileSize?: { width: number; height: number };
  /** Z scale factor (default 1.0) */
  zScale?: number;
  /** Shader type for auto-detection (optional, will detect from shader if not provided) */
  shaderType?: 'isometric' | 'top-down';
}

/**
 * Rendering metrics
 */
export interface RenderMetrics {
  /** Number of instanced draw calls */
  instancedDrawCalls: number;
  /** Number of batched draw calls */
  batchedDrawCalls: number;
  /** Number of instanced instances */
  instancedInstances: number;
  /** Number of batched instances */
  batchedInstances: number;
}

/**
 * Quad group for batching
 */
interface QuadGroup {
  texIndex: number;
  width: number;
  height: number;
  quads: SpriteQuadInstance[];
}

/**
 * Detect shader type from shader source code
 * Checks for isometric projection patterns
 * @internal Exported for testing purposes only
 */
export function detectShaderTypeFromSource(shader: Shader): 'isometric' | 'top-down' {
  const vertexSource = shader.getVertexSource();

  // Check for isometric projection pattern using regex
  // Matches: x - y, aGridPosition.x - aGridPosition.y, with or without parentheses
  const isometricPattern = /aGridPosition\.x\s*-\s*aGridPosition\.y|\bx\s*-\s*\by/;
  if (isometricPattern.test(vertexSource)) {
    return 'isometric';
  }

  // Default to top-down if no isometric pattern found
  return 'top-down';
}

/**
 * Hybrid Renderer
 *
 * Automatically selects the best rendering method:
 * - Instanced rendering for large batches (≥ threshold instances)
 * - Batch rendering for small/unique batches (< threshold instances)
 */
export class HybridRenderer {
  private instancedRenderer!: InstancedRenderer;
  private batchRenderer!: GPUBasedSpriteBatchRenderer;
  private threshold: number;
  private quads: SpriteQuadInstance[] = [];

  // Metrics
  private metrics: RenderMetrics = {
    instancedDrawCalls: 0,
    batchedDrawCalls: 0,
    instancedInstances: 0,
    batchedInstances: 0,
  };

  // Dynamic threshold adjustment
  private frameCount: number = 0;
  private lastFpsCheck: number = 0;
  private performanceHistory: number[] = [];

  /**
   * Constructor overload support
   * Detects which signature was used based on parameter types and count
   *
   * Signature 1 (BatchRenderer compatible - requires factory method):
   *   HybridRenderer.fromBatchShader(gl, graphicsDevice, batchShader, options?)
   *
   * Signature 2 (Explicit control):
   *   new HybridRenderer(gl, instancedShader, batchShader, options?)
   */
  constructor(
    gl: any,
    shaderOrInstancedShader: Shader | HybridRendererOptions,
    batchShaderOrOptions?: Shader | HybridRendererOptions,
    options?: HybridRendererOptions
  ) {
    // Detect which constructor signature was used
    // Use duck typing to check if batchShaderOrOptions is shader-like (has 'use' method)
    const isShaderLike = batchShaderOrOptions === undefined ||
      (typeof batchShaderOrOptions === 'object' && batchShaderOrOptions !== null &&
       'use' in batchShaderOrOptions && typeof batchShaderOrOptions.use === 'function');

    if (isShaderLike) {
      // Signature 2: Two explicit shaders (original API)
      const instancedShader = shaderOrInstancedShader as Shader;
      const batchShader = batchShaderOrOptions as Shader;
      const config = options ?? {};

      this.threshold = config.instancingThreshold ?? 100;
      this.initRenderers(gl, instancedShader, batchShader, config);
    } else {
      // Signature 1: Single shader - NOT SUPPORTED directly
      // Use HybridRenderer.fromBatchShader() factory method instead
      throw new Error(
        'Single-shader constructor not supported directly. Use HybridRenderer.fromBatchShader(gl, graphicsDevice, batchShader, options) factory method instead.'
      );
    }
  }

  /**
   * Initialize both renderers with provided shaders
   */
  private initRenderers(
    gl: any,
    instancedShader: Shader,
    batchShader: Shader,
    options: HybridRendererOptions
  ): void {
    this.threshold = options.instancingThreshold ?? 100;

    // Create instanced renderer
    this.instancedRenderer = new InstancedRenderer(gl, instancedShader, {
      maxInstances: options.maxInstances,
      tileSize: options.tileSize,
      zScale: options.zScale,
      autoBatchThreshold: this.threshold,
    });

    // Create batch renderer (V3 - GPU-based)
    this.batchRenderer = new GPUBasedSpriteBatchRenderer(
      gl,
      batchShader,
      10000, // maxQuads
      options.tileSize ?? { width: 64, height: 32 },
      options.zScale ?? 1.0,
      64 // spatialCellSize
    );
  }

  /**
   * Static factory method: Create HybridRenderer from a single batch shader
   * Automatically creates the corresponding instanced shader variant
   *
   * This provides BatchRenderer-compatible API:
   * ```typescript
   * const renderer = HybridRenderer.fromBatchShader(gl, graphicsDevice, batchShader, {
   *   instancingThreshold: 100,
   *   shaderType: 'isometric' // optional, auto-detected if not provided
   * });
   * ```
   *
   * @param gl WebGL context
   * @param graphicsDevice Graphics device for shader creation
   * @param batchShader Batch shader (V3 for isometric, V6 for top-down)
   * @param options Configuration options
   * @returns Configured HybridRenderer
   */
  static fromBatchShader(
    gl: any,
    graphicsDevice: GraphicsDevice,
    batchShader: Shader,
    options: HybridRendererOptions = {}
  ): HybridRenderer {
    const shaderType = options.shaderType ?? detectShaderTypeFromSource(batchShader);
    const shaderSource = shaderType === 'isometric' ? SHADERS_V4 : SHADERS_V5;

    // Create instanced shader variant
    const instancedShader = graphicsDevice.createShader(
      shaderSource.vertex,
      shaderSource.fragment
    );

    // Create HybridRenderer with both shaders
    return new HybridRenderer(gl, instancedShader, batchShader, options);
  }

  /**
   * Add a sprite for rendering
   * Stores the sprite and routes to appropriate renderer during render()
   */
  addSprite(sprite: SpriteQuadInstance): void {
    this.quads.push(sprite);
  }

  /**
   * Add a quad (alias for addSprite for API compatibility)
   * Provides drop-in compatibility with GPUBasedSpriteBatchRenderer
   */
  addQuad(quad: SpriteQuadInstance): void {
    this.addSprite(quad);
  }

  /**
   * Clear all renderers and stored quads
   */
  clear(): void {
    this.instancedRenderer.clear();
    this.batchRenderer.clear();
    this.quads = [];

    // Reset metrics
    this.metrics = {
      instancedDrawCalls: 0,
      batchedDrawCalls: 0,
      instancedInstances: 0,
      batchedInstances: 0,
    };
  }

  /**
   * Set texture (both renderers share)
   */
  setTexture(texture: Texture | null): void {
    this.instancedRenderer.setTexture(texture);
    this.batchRenderer.setTexture(texture);
  }

  /**
   * Set depth testing
   */
  setDepthTestEnabled(enabled: boolean): void {
    this.instancedRenderer.setDepthTestEnabled(enabled);
    this.batchRenderer.setDepthTestEnabled(enabled);
  }

  /**
   * Group quads by texture and size for efficient batching
   */
  private groupQuads(): Map<string, QuadGroup> {
    const groups = new Map<string, QuadGroup>();

    for (const quad of this.quads) {
      const key = `${quad.texIndex ?? 0}_${quad.width}_${quad.height}`;

      if (!groups.has(key)) {
        groups.set(key, {
          texIndex: quad.texIndex ?? 0,
          width: quad.width,
          height: quad.height,
          quads: []
        });
      }

      groups.get(key)!.quads.push(quad);
    }

    return groups;
  }

  /**
   * Render all sprites
   * Returns rendering metrics
   */
  render(camera: Camera): RenderMetrics {
    // Reset metrics for this frame
    this.metrics = {
      instancedDrawCalls: 0,
      batchedDrawCalls: 0,
      instancedInstances: 0,
      batchedInstances: 0,
    };

    // Group quads by texture/size
    const groups = this.groupQuads();

    // Route each group to appropriate renderer
    for (const group of groups.values()) {
      if (group.quads.length >= this.threshold) {
        // Large batch: use instanced renderer
        for (const quad of group.quads) {
          const instance: InstanceData = {
            gridX: quad.gridX ?? 0,
            gridY: quad.gridY ?? 0,
            z: quad.z ?? 0,
            color: quad.color ?? { r: 1, g: 1, b: 1, a: 1 },
            texIndex: quad.texIndex ?? 0,
            uvOffset: quad.uvRect ?
              { u: quad.uvRect.uMin, v: quad.uvRect.vMin } :
              { u: 0, v: 0 },
            size: { width: quad.width, height: quad.height },
          };
          this.instancedRenderer.addInstance(instance);
        }
        this.metrics.instancedInstances += group.quads.length;
      } else {
        // Small batch: use batch renderer
        for (const quad of group.quads) {
          this.batchRenderer.addQuad(quad);
        }
        this.metrics.batchedInstances += group.quads.length;
      }
    }

    // Render instanced batches
    if (this.metrics.instancedInstances > 0) {
      this.metrics.instancedDrawCalls = this.instancedRenderer.render(camera);
    }

    // Render batched quads
    if (this.metrics.batchedInstances > 0) {
      this.batchRenderer.render(camera);
      this.metrics.batchedDrawCalls = 1;
    }

    // Clear stored quads after rendering
    this.quads = [];

    // Clear internal renderer buffers
    this.instancedRenderer.clear();
    this.batchRenderer.clear();

    // Dynamic threshold adjustment (every 60 frames)
    this.frameCount++;
    if (this.frameCount % 60 === 0) {
      this.adjustThreshold();
    }

    return { ...this.metrics };
  }

  /**
   * Get rendering metrics from last frame
   */
  getMetrics(): RenderMetrics {
    return { ...this.metrics };
  }

  /**
   * Get total quad count (API compatibility with GPUBasedSpriteBatchRenderer)
   * Returns actual number of quads waiting to be rendered
   */
  getQuadCount(): number {
    return this.quads.length;
  }

  /**
   * Set instancing threshold manually
   */
  setInstancingThreshold(threshold: number): void {
    this.threshold = Math.max(50, Math.min(500, threshold));
    this.instancedRenderer.setAutoBatchThreshold(this.threshold);
  }

  /**
   * Get current instancing threshold
   */
  getInstancingThreshold(): number {
    return this.threshold;
  }

  /**
   * Update the resolution for NDC conversion
   * Call this when the framebuffer size changes
   * Both renderers need resolution updates for the V5/V6 coordinate system
   * @param width New framebuffer width
   * @param height New framebuffer height
   */
  setResolution(width: number, height: number): void {
    // Both V5 (instanced) and V6 (batch) need resolution for NDC conversion
    this.instancedRenderer.setResolution(width, height);
    this.batchRenderer.setResolution(width, height);
  }

  /**
   * Automatically adjust threshold based on performance
   * Called every 60 frames
   */
  private adjustThreshold(): void {
    // Simple heuristic: if instancing is being used effectively, keep threshold
    // If not being used much, lower threshold to try more instancing

    const totalInstances = this.metrics.instancedInstances + this.metrics.batchedInstances;
    const instancingRatio = totalInstances > 0 ?
      this.metrics.instancedInstances / totalInstances :
      0;

    // If less than 20% of instances are using instancing, lower threshold
    if (instancingRatio < 0.2 && this.threshold > 50) {
      this.threshold = Math.max(50, this.threshold - 10);
      this.instancedRenderer.setAutoBatchThreshold(this.threshold);
    }
    // If more than 80% are using instancing effectively, raise threshold
    else if (instancingRatio > 0.8 && this.threshold < 500) {
      this.threshold = Math.min(500, this.threshold + 10);
      this.instancedRenderer.setAutoBatchThreshold(this.threshold);
    }
  }

  /**
   * Clean up resources
   */
  dispose(): void {
    this.instancedRenderer.dispose();
    this.batchRenderer.dispose();
  }
}
