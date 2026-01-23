/**
 * Batch Renderer V1 - Simple 2D Batch Rendering
 *
 * Implements dynamic vertex buffer batching for rendering multiple colored quads.
 * Uses DYNAMIC_DRAW strategy to allow per-frame vertex updates for moving sprites.
 */

import type { Shader } from "../core/shader";
import type { Texture } from "../core/texture";

/**
 * Quad instance data
 */
export interface QuadInstance {
  /** X position */
  x: number;
  /** Y position */
  y: number;
  /** Width */
  width: number;
  /** Height */
  height: number;
  /** Rotation in radians */
  rotation: number;
  /** Color as [r, g, b] (0-1 range) */
  color: [number, number, number];
}

/**
 * Batch Renderer for 2D colored quads
 *
 * Features:
 * - Dynamic vertex buffer for per-frame updates
 * - Batch rendering of multiple quads in single draw call
 * - Simple 2D positioning and coloring
 */
export class BatchRenderer {
  private gl: WebGLRenderingContext;
  private shader: Shader;
  private vertexBuffer: WebGLBuffer | null = null;
  private maxQuads: number;
  private vertexData: Float32Array;
  private quads: QuadInstance[] = [];
  private isDirty: boolean = false;
  private verticesPerQuad = 6; // 2 triangles
  private floatsPerVertex = 5; // x, y, z, u, v
  private texture: Texture | null = null;

  /**
   * Create a new batch renderer
   * @param gl WebGL rendering context
   * @param shader Shader program to use
   * @param maxQuads Maximum number of quads to batch (default 1000)
   */
  constructor(
    gl: WebGLRenderingContext,
    shader: Shader,
    maxQuads: number = 1000,
  ) {
    this.gl = gl;
    this.shader = shader;
    this.maxQuads = maxQuads;

    // Allocate vertex data buffer
    // Each quad has 6 vertices, each vertex has 5 floats (pos + texCoord)
    const totalFloats = maxQuads * this.verticesPerQuad * this.floatsPerVertex;
    this.vertexData = new Float32Array(totalFloats);

    // Create dynamic vertex buffer
    const buf = gl.createBuffer();
    if (!buf) {
      throw new Error("Failed to create vertex buffer");
    }
    this.vertexBuffer = buf;

    // Allocate buffer with dynamic draw usage
    gl.bindBuffer(gl.ARRAY_BUFFER, this.vertexBuffer);
    gl.bufferData(gl.ARRAY_BUFFER, this.vertexData.byteLength, gl.DYNAMIC_DRAW);
    gl.bindBuffer(gl.ARRAY_BUFFER, null);
  }

  /**
   * Set the texture for batch rendering
   * @param texture The texture to use when rendering
   */
  setTexture(texture: Texture | null): void {
    this.texture = texture;
  }

  /**
   * Add a quad to the batch
   * @param quad Quad instance to add
   */
  addQuad(quad: QuadInstance): void {
    if (this.quads.length >= this.maxQuads) {
      console.warn(`Batch renderer at max capacity (${this.maxQuads})`);
      return;
    }
    this.quads.push(quad);
    this.isDirty = true;
  }

  /**
   * Clear all quads from the batch
   */
  clear(): void {
    this.quads = [];
    this.isDirty = true;
  }

  /**
   * Get number of quads currently in batch
   */
  getQuadCount(): number {
    return this.quads.length;
  }

  /**
   * Update the batch - rebuilds vertex buffer if quads changed
   */
  update(): void {
    if (!this.isDirty || this.quads.length === 0) {
      return;
    }

    let vertexIndex = 0;

    for (const quad of this.quads) {
      // Calculate quad vertices based on position, size, and rotation
      const vertices = this.generateQuadVertices(quad);

      // Copy vertices to buffer
      for (const vertex of vertices) {
        this.vertexData[vertexIndex++] = vertex[0]; // x
        this.vertexData[vertexIndex++] = vertex[1]; // y
        this.vertexData[vertexIndex++] = vertex[2]; // z
        this.vertexData[vertexIndex++] = vertex[3]; // u
        this.vertexData[vertexIndex++] = vertex[4]; // v
      }
    }

    // Upload data to GPU
    if (this.vertexBuffer) {
      this.gl.bindBuffer(this.gl.ARRAY_BUFFER, this.vertexBuffer);
      this.gl.bufferSubData(
        this.gl.ARRAY_BUFFER,
        0,
        this.vertexData.subarray(0, vertexIndex),
      );
      this.gl.bindBuffer(this.gl.ARRAY_BUFFER, null);
    }

    this.isDirty = false;
  }

  /**
   * Render the batch
   */
  render(): void {
    if (this.quads.length === 0) {
      return;
    }

    // Update vertex buffer if needed
    this.update();

    // Use shader
    this.shader.use();

    // Bind vertex buffer
    if (this.vertexBuffer) {
      this.gl.bindBuffer(this.gl.ARRAY_BUFFER, this.vertexBuffer);

      // Get attribute locations
      const posAttr = this.shader.getAttributeLocation("aPosition");
      const texCoordAttr = this.shader.getAttributeLocation("aTexCoord");

      // Enable and configure position attribute
      if (posAttr !== -1) {
        this.gl.enableVertexAttribArray(posAttr);
        this.gl.vertexAttribPointer(
          posAttr,
          3, // 3 floats (x, y, z)
          this.gl.FLOAT,
          false,
          this.floatsPerVertex * 4, // stride
          0, // offset
        );
      }

      // Enable and configure texture coordinate attribute
      if (texCoordAttr !== -1) {
        this.gl.enableVertexAttribArray(texCoordAttr);
        this.gl.vertexAttribPointer(
          texCoordAttr,
          2, // 2 floats (u, v)
          this.gl.FLOAT,
          false,
          this.floatsPerVertex * 4, // stride
          3 * 4, // offset after position
        );
      }

      // Bind texture if available
      if (this.texture) {
        this.texture.bind(0);
        const textureUniform = this.shader.getUniformLocation("uTexture");
        if (textureUniform !== null) {
          this.gl.uniform1i(textureUniform, 0);
        }
      }

      // Set up identity matrix (no additional transform)
      const matrixUniform = this.shader.getUniformLocation("uMatrix");
      if (matrixUniform !== null) {
        const identityMatrix = new Float32Array([
          1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1,
        ]);
        this.gl.uniformMatrix4fv(matrixUniform, false, identityMatrix);
      }

      // Draw all quads
      const vertexCount = this.quads.length * this.verticesPerQuad;
      this.gl.drawArrays(this.gl.TRIANGLES, 0, vertexCount);

      // Cleanup
      this.gl.bindBuffer(this.gl.ARRAY_BUFFER, null);
    }
  }

  /**
   * Generate vertices for a quad with rotation applied
   * Returns 6 vertices (2 triangles)
   * @private
   */
  private generateQuadVertices(
    quad: QuadInstance,
  ): Array<[number, number, number, number, number]> {
    const { x, y, width, height, rotation } = quad;
    const halfW = width / 2;
    const halfH = height / 2;

    // Calculate rotation
    const cos = Math.cos(rotation);
    const sin = Math.sin(rotation);

    // Helper to rotate point around origin
    const rotatePoint = (px: number, py: number): [number, number] => {
      return [px * cos - py * sin, px * sin + py * cos];
    };

    // Define quad corners in local space
    const corners = [
      [-halfW, -halfH], // bottom-left
      [halfW, -halfH], // bottom-right
      [halfW, halfH], // top-right
      [halfW, halfH], // top-right (duplicate)
      [-halfW, halfH], // top-left
      [-halfW, -halfH], // bottom-left (duplicate)
    ];

    // Define texture coordinates
    const texCoords = [
      [0, 0], // bottom-left
      [1, 0], // bottom-right
      [1, 1], // top-right
      [1, 1], // top-right
      [0, 1], // top-left
      [0, 0], // bottom-left
    ];

    // Generate vertices
    const vertices: Array<[number, number, number, number, number]> = [];
    for (let i = 0; i < corners.length; i++) {
      const [localX, localY] = corners[i];
      const [rotX, rotY] = rotatePoint(localX, localY);
      const [u, v] = texCoords[i];

      vertices.push([x + rotX, y + rotY, 0, u, v]);
    }

    return vertices;
  }

  /**
   * Dispose resources
   */
  dispose(): void {
    if (this.vertexBuffer) {
      this.gl.deleteBuffer(this.vertexBuffer);
      this.vertexBuffer = null;
    }
  }
}
