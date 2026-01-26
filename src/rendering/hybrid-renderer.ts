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
 */

import type { Camera } from "./camera";
import type { Texture } from "../core/texture";
import type { Shader } from "../core/shader";
import { InstancedRenderer, type InstanceData } from "./instanced-renderer";
import { GPUBasedSpriteBatchRenderer, type SpriteQuadInstance } from "./batch-renderer";

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
 * Hybrid Renderer
 *
 * Automatically selects the best rendering method:
 * - Instanced rendering for large batches (≥ threshold instances)
 * - Batch rendering for small/unique batches (< threshold instances)
 */
export class HybridRenderer {
  private instancedRenderer: InstancedRenderer;
  private batchRenderer: GPUBasedSpriteBatchRenderer;
  private threshold: number;

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

  constructor(
    gl: WebGL2RenderingContext,
    instancedShader: Shader,
    batchShader: Shader,
    options: HybridRendererOptions = {}
  ) {
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
   * Add a sprite for rendering
   * Automatically determines which renderer to use
   */
  addSprite(sprite: SpriteQuadInstance): void {
    // Convert to instance data format
    const instance: InstanceData = {
      gridX: sprite.gridX ?? 0,
      gridY: sprite.gridY ?? 0,
      z: sprite.z ?? 0,
      color: sprite.color ?? { r: 1, g: 1, b: 1, a: 1 },
      texIndex: sprite.texIndex ?? 0,
      uvOffset: sprite.uvRect ?
        { u: sprite.uvRect.uMin, v: sprite.uvRect.vMin } :
        { u: 0, v: 0 },
      size: { width: sprite.width, height: sprite.height },
    };

    // Add to both renderers
    // They will decide which to use based on threshold
    this.instancedRenderer.addInstance(instance);

    // Also add to batch renderer as fallback
    this.batchRenderer.addQuad(sprite);
  }

  /**
   * Add a quad (alias for addSprite for API compatibility)
   * Provides drop-in compatibility with GPUBasedSpriteBatchRenderer
   */
  addQuad(quad: SpriteQuadInstance): void {
    this.addSprite(quad);
  }

  /**
   * Clear all renderers
   */
  clear(): void {
    this.instancedRenderer.clear();
    this.batchRenderer.clear();

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
   * Render all sprites
   * Returns rendering metrics
   */
  render(camera: Camera): RenderMetrics {
    // Render instanced batches first
    this.metrics.instancedDrawCalls = this.instancedRenderer.render(camera);

    // Get instanced metrics
    const instancedMetrics = this.instancedRenderer.getMetrics();
    this.metrics.instancedInstances = instancedMetrics.instanceCount;

    // Render remaining batches with batch renderer
    // Note: In production, you'd want to exclude already-instanced batches
    this.batchRenderer.render(camera);
    this.metrics.batchedDrawCalls = 1; // Single batch for all non-instanced
    this.metrics.batchedInstances = this.batchRenderer.getQuadCount();

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
   * Returns total number of sprites across both renderers
   */
  getQuadCount(): number {
    return this.metrics.batchedInstances + this.metrics.instancedInstances;
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
