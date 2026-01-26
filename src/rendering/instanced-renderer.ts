/**
 * Instanced Renderer for 2.5D Isometric Engine
 *
 * Uses GPU instancing for efficient rendering of identical meshes.
 * Renders thousands of instances in a single draw call.
 *
 * Features:
 * - Automatic batching by texture and size
 * - Ring-buffered GPU streaming for dynamic updates
 * - Configurable threshold for auto-batching
 * - Depth testing support
 * - Performance metrics
 */

import type { Shader } from "../core/shader";
import type { Camera } from "./camera";
import type { Texture } from "../core/texture";
import { RingBuffer } from "./ring-buffer";

/**
 * Instance data per sprite (matches shader layout)
 */
export interface InstanceData {
  /** Grid position (x, y) */
  gridX: number;
  gridY: number;
  /** Z height */
  z: number;
  /** Color tint (r, g, b, a) */
  color: { r: number; g: number; b: number; a: number };
  /** Texture atlas index */
  texIndex: number;
  /** UV offset for sprite sheets */
  uvOffset: { u: number; v: number };
  /** Sprite size */
  size: { width: number; height: number };
}

/**
 * Instanced render batch (group of identical meshes)
 */
interface InstancedBatch {
  /** Texture index to group by */
  texIndex: number;
  /** Size to group by (for batching same-sized sprites) */
  size: { width: number; height: number };
  /** Instance data */
  instances: InstanceData[];
}

/**
 * Instanced Renderer Options
 */
export interface InstancedRendererOptions {
  /** Maximum instances to render */
  maxInstances?: number;
  /** Ring buffer size in bytes */
  ringBufferSize?: number;
  /** Tile size for isometric projection */
  tileSize?: { width: number; height: number };
  /** Z scale factor */
  zScale?: number;
  /** Auto-batching threshold (default 100) */
  autoBatchThreshold?: number;
}

/**
 * Instanced Renderer
 *
 * Renders many instances of identical geometry efficiently.
 * Uses ring buffers for zero-copy GPU transfers.
 */
export class InstancedRenderer {
  private gl: WebGL2RenderingContext;
  private shader: Shader;
  private texture: Texture | null = null;

  // Geometry buffers (shared quad)
  private positionBuffer!: WebGLBuffer;
  private uvBuffer!: WebGLBuffer;

  // Instance buffers (ring buffered)
  private instanceBuffer: RingBuffer;
  private maxInstances: number;
  private instanceBufferWebGL: WebGLBuffer; // For binding

  // Batching
  private batches: Map<string, InstancedBatch> = new Map();
  private instanceStride: number; // Floats per instance

  // Settings
  private depthTestEnabled: boolean = true;
  private autoBatchThreshold: number;

  // Projection settings
  private tileSize: { width: number; height: number };
  private zScale: number;

  // Metrics
  private lastFrameDrawCalls: number = 0;
  private lastFrameInstanceCount: number = 0;

  constructor(
    gl: WebGL2RenderingContext,
    shader: Shader,
    options: InstancedRendererOptions = {}
  ) {
    // Verify WebGL2
    if (!(gl instanceof WebGL2RenderingContext)) {
      throw new Error("InstancedRenderer requires WebGL2 context");
    }

    this.gl = gl;
    this.shader = shader;
    this.maxInstances = options.maxInstances ?? 10000;
    this.tileSize = options.tileSize ?? { width: 64, height: 32 };
    this.zScale = options.zScale ?? 1.0;
    this.autoBatchThreshold = options.autoBatchThreshold ?? 100;

    // Calculate instance stride (matches shader layout)
    // gridX, gridY, z, r, g, b, a, texIndex, uvU, uvV, width, height
    this.instanceStride = 12;

    // Create ring buffer for instance data
    const ringBufferSize = options.ringBufferSize ??
      this.maxInstances * this.instanceStride * 4 * 3; // *3 for triple buffering

    this.instanceBuffer = new RingBuffer({
      size: ringBufferSize,
      gl: gl,
      usage: gl.DYNAMIC_DRAW
    });

    // Get the underlying WebGL buffer for binding
    this.instanceBufferWebGL = this.instanceBuffer.getBuffer();

    // Create static geometry (quad)
    this.createQuadGeometry();
  }

  /**
   * Create static quad geometry (shared across all instances)
   */
  private createQuadGeometry(): void {
    // Position buffer (unit quad centered at origin)
    const positions = new Float32Array([
      -0.5, -0.5,  // Bottom-left
       0.5, -0.5,  // Bottom-right
       0.5,  0.5,  // Top-right
       0.5,  0.5,  // Top-right (duplicate)
      -0.5,  0.5,  // Top-left
      -0.5, -0.5,  // Bottom-left (duplicate)
    ]);

    this.positionBuffer = this.gl.createBuffer()!;
    this.gl.bindBuffer(this.gl.ARRAY_BUFFER, this.positionBuffer);
    this.gl.bufferData(this.gl.ARRAY_BUFFER, positions, this.gl.STATIC_DRAW);

    // UV buffer (full texture quad)
    const uvs = new Float32Array([
      0.0, 0.0,  // Bottom-left
      1.0, 0.0,  // Bottom-right
      1.0, 1.0,  // Top-right
      1.0, 1.0,  // Top-right
      0.0, 1.0,  // Top-left
      0.0, 0.0,  // Bottom-left
    ]);

    this.uvBuffer = this.gl.createBuffer()!;
    this.gl.bindBuffer(this.gl.ARRAY_BUFFER, this.uvBuffer);
    this.gl.bufferData(this.gl.ARRAY_BUFFER, uvs, this.gl.STATIC_DRAW);

    this.gl.bindBuffer(this.gl.ARRAY_BUFFER, null);
  }

  /**
   * Set texture for rendering
   */
  setTexture(texture: Texture | null): void {
    this.texture = texture;
  }

  /**
   * Add an instance to render
   * Automatically batches by texture and size
   */
  addInstance(data: InstanceData): void {
    // Create batch key
    const key = this.getBatchKey(data);

    if (!this.batches.has(key)) {
      this.batches.set(key, {
        texIndex: data.texIndex,
        size: data.size,
        instances: []
      });
    }

    this.batches.get(key)!.instances.push(data);
  }

  /**
   * Generate batch key for grouping
   */
  private getBatchKey(data: InstanceData): string {
    return `${data.texIndex}_${data.size.width}_${data.size.height}`;
  }

  /**
   * Clear all batches
   */
  clear(): void {
    this.batches.clear();
    this.lastFrameDrawCalls = 0;
    this.lastFrameInstanceCount = 0;
  }

  /**
   * Get total instance count across all batches
   */
  getInstanceCount(): number {
    let count = 0;
    for (const batch of this.batches.values()) {
      count += batch.instances.length;
    }
    return count;
  }

  /**
   * Render all batches
   * Returns number of draw calls made
   */
  render(camera: Camera): number {
    if (this.batches.size === 0) {
      return 0;
    }

    this.shader.use();

    // Enable depth testing
    if (this.depthTestEnabled) {
      this.gl.enable(this.gl.DEPTH_TEST);
      this.gl.depthFunc(this.gl.LEQUAL);
    } else {
      this.gl.disable(this.gl.DEPTH_TEST);
    }

    // Bind static geometry
    this.bindGeometry();

    // Bind texture
    if (this.texture) {
      this.texture.bind(0);
      const texUniform = this.shader.getUniformLocation("uTexture");
      if (texUniform !== null) {
        this.gl.uniform1i(texUniform, 0);
      }
    }

    // Set uniforms
    this.setUniforms(camera);

    // Render each batch
    let drawCalls = 0;
    let totalInstances = 0;

    for (const batch of this.batches.values()) {
      // Skip if under threshold (use regular batch renderer instead)
      if (batch.instances.length < this.autoBatchThreshold) {
        continue;
      }

      this.renderBatch(batch);
      drawCalls++;
      totalInstances += batch.instances.length;
    }

    // Advance frame (triple buffering sync)
    this.instanceBuffer.advanceFrame();

    // Update metrics
    this.lastFrameDrawCalls = drawCalls;
    this.lastFrameInstanceCount = totalInstances;

    // Cleanup
    this.gl.bindBuffer(this.gl.ARRAY_BUFFER, null);

    return drawCalls;
  }

  /**
   * Bind static geometry buffers
   */
  private bindGeometry(): void {
    // Position attribute
    this.gl.bindBuffer(this.gl.ARRAY_BUFFER, this.positionBuffer);
    const posAttr = this.shader.getAttributeLocation("aPosition");
    if (posAttr !== -1) {
      this.gl.enableVertexAttribArray(posAttr);
      this.gl.vertexAttribPointer(posAttr, 2, this.gl.FLOAT, false, 0, 0);
    }

    // UV attribute
    this.gl.bindBuffer(this.gl.ARRAY_BUFFER, this.uvBuffer);
    const uvAttr = this.shader.getAttributeLocation("aTexCoord");
    if (uvAttr !== -1) {
      this.gl.enableVertexAttribArray(uvAttr);
      this.gl.vertexAttribPointer(uvAttr, 2, this.gl.FLOAT, false, 0, 0);
    }
  }

  /**
   * Render a single batch
   */
  private renderBatch(batch: InstancedBatch): void {
    const instanceCount = batch.instances.length;

    // Allocate region in ring buffer
    const byteSize = instanceCount * this.instanceStride * 4;
    const region = this.instanceBuffer.allocate(byteSize);

    if (!region) {
      console.warn("Ring buffer full, skipping batch");
      return;
    }

    // Write instance data
    let offset = 0;
    for (const instance of batch.instances) {
      region.view[offset++] = instance.gridX;
      region.view[offset++] = instance.gridY;
      region.view[offset++] = instance.z;
      region.view[offset++] = instance.color.r;
      region.view[offset++] = instance.color.g;
      region.view[offset++] = instance.color.b;
      region.view[offset++] = instance.color.a;
      region.view[offset++] = instance.texIndex;
      region.view[offset++] = instance.uvOffset.u;
      region.view[offset++] = instance.uvOffset.v;
      region.view[offset++] = instance.size.width;
      region.view[offset++] = instance.size.height;
    }

    // Bind instance buffer (use ring buffer directly)
    this.gl.bindBuffer(this.gl.ARRAY_BUFFER, this.instanceBufferWebGL);

    // Configure instance attributes with divisor
    this.setupInstanceAttributes(region.offset);

    // Draw instanced
    this.gl.drawArraysInstanced(
      this.gl.TRIANGLES,
      0,
      6, // 6 vertices per quad
      instanceCount
    );
  }

  /**
   * Setup instanced attributes
   * Uses vertexAttribDivisor to advance per-instance instead of per-vertex
   */
  private setupInstanceAttributes(offset: number): void {
    const stride = this.instanceStride * 4;
    const baseOffset = offset;

    const glAny = this.gl as any;

    // Grid position (vec2)
    const gridAttr = this.shader.getAttributeLocation("aGridPosition");
    if (gridAttr !== -1) {
      this.gl.enableVertexAttribArray(gridAttr);
      this.gl.vertexAttribPointer(gridAttr, 2, this.gl.FLOAT, false, stride, baseOffset);
      glAny.vertexAttribDivisor(gridAttr, 1); // Advance per instance
    }

    // Z position (float)
    const zAttr = this.shader.getAttributeLocation("aZPosition");
    if (zAttr !== -1) {
      this.gl.enableVertexAttribArray(zAttr);
      this.gl.vertexAttribPointer(zAttr, 1, this.gl.FLOAT, false, stride, baseOffset + 2 * 4);
      glAny.vertexAttribDivisor(zAttr, 1);
    }

    // Color (vec4)
    const colorAttr = this.shader.getAttributeLocation("aColor");
    if (colorAttr !== -1) {
      this.gl.enableVertexAttribArray(colorAttr);
      this.gl.vertexAttribPointer(colorAttr, 4, this.gl.FLOAT, false, stride, baseOffset + 3 * 4);
      glAny.vertexAttribDivisor(colorAttr, 1);
    }

    // Texture index (float)
    const texAttr = this.shader.getAttributeLocation("aTexIndex");
    if (texAttr !== -1) {
      this.gl.enableVertexAttribArray(texAttr);
      this.gl.vertexAttribPointer(texAttr, 1, this.gl.FLOAT, false, stride, baseOffset + 7 * 4);
      glAny.vertexAttribDivisor(texAttr, 1);
    }

    // UV offset (vec2)
    const uvOffsetAttr = this.shader.getAttributeLocation("aUVOffset");
    if (uvOffsetAttr !== -1) {
      this.gl.enableVertexAttribArray(uvOffsetAttr);
      this.gl.vertexAttribPointer(uvOffsetAttr, 2, this.gl.FLOAT, false, stride, baseOffset + 8 * 4);
      glAny.vertexAttribDivisor(uvOffsetAttr, 1);
    }

    // Size (vec2)
    const sizeAttr = this.shader.getAttributeLocation("aSize");
    if (sizeAttr !== -1) {
      this.gl.enableVertexAttribArray(sizeAttr);
      this.gl.vertexAttribPointer(sizeAttr, 2, this.gl.FLOAT, false, stride, baseOffset + 10 * 4);
      glAny.vertexAttribDivisor(sizeAttr, 1);
    }
  }

  /**
   * Set shader uniforms
   */
  private setUniforms(camera: Camera): void {
    const matrixUniform = this.shader.getUniformLocation("uMatrix");
    if (matrixUniform !== null) {
      const matrix = camera.getViewMatrix();
      this.gl.uniformMatrix4fv(matrixUniform, false, matrix);
    }

    const tileSizeUniform = this.shader.getUniformLocation("uTileSize");
    if (tileSizeUniform !== null) {
      this.gl.uniform2f(tileSizeUniform, this.tileSize.width, this.tileSize.height);
    }

    const zScaleUniform = this.shader.getUniformLocation("uZScale");
    if (zScaleUniform !== null) {
      this.gl.uniform1f(zScaleUniform, this.zScale);
    }
  }

  /**
   * Set depth testing enabled
   */
  setDepthTestEnabled(enabled: boolean): void {
    this.depthTestEnabled = enabled;
  }

  /**
   * Set auto-batching threshold
   * Batches with fewer instances will use regular renderer
   */
  setAutoBatchThreshold(threshold: number): void {
    this.autoBatchThreshold = threshold;
  }

  /**
   * Get rendering metrics from last frame
   */
  getMetrics(): { drawCalls: number; instanceCount: number } {
    return {
      drawCalls: this.lastFrameDrawCalls,
      instanceCount: this.lastFrameInstanceCount
    };
  }

  /**
   * Clean up resources
   */
  dispose(): void {
    this.gl.deleteBuffer(this.positionBuffer);
    this.gl.deleteBuffer(this.uvBuffer);
    this.instanceBuffer.dispose();
  }
}
