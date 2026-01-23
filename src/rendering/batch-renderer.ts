/**
 * Batch Renderer V2 - 2.5D Sprite Batch Rendering
 *
 * Implements dynamic vertex buffer batching for rendering 2.5D sprites with:
 * - Position (x, y, z)
 * - Texture coordinates (u, v)
 * - Color tint (r, g, b, a)
 * - Texture index (for texture atlases)
 *
 * Uses DYNAMIC_DRAW strategy to allow per-frame vertex updates for moving sprites.
 */

import type { Shader } from "../core/shader";
import type { Texture } from "../core/texture";

/**
 * V1 Quad instance data (for backward compatibility)
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
 * V2 Sprite Quad instance data with full 2.5D support
 */
export interface SpriteQuadInstance {
  /** Position in 2.5D space */
  x: number;
  y: number;
  z: number;
  /** Width and height */
  width: number;
  height: number;
  /** Rotation in radians */
  rotation: number;
  /** Color tint (0-1 range, default white) */
  color?: {
    r: number;
    g: number;
    b: number;
    a: number;
  };
  /** Texture coordinates (UV region in texture atlas) */
  uvRect?: {
    uMin: number;
    vMin: number;
    uMax: number;
    vMax: number;
  };
  /** Texture index for atlas selection */
  texIndex?: number;
}

/**
 * V1 Batch Renderer for backward compatibility
 * Renders 2D colored quads with position and texture coordinates
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
   * Create a new batch renderer (V1)
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

/**
 * V2 Batch Renderer for 2.5D sprites
 * Supports position (x, y, z), texture coordinates (u, v),
 * color tint (r, g, b, a), and texture index for texture atlases
 */
export class SpriteBatchRenderer {
  private gl: WebGLRenderingContext;
  private shader: Shader;
  private vertexBuffer: WebGLBuffer | null = null;
  private maxQuads: number;
  private vertexData: Float32Array;
  private quads: SpriteQuadInstance[] = [];
  private isDirty: boolean = false;
  private verticesPerQuad = 6; // 2 triangles
  private floatsPerVertex = 10; // x, y, z, u, v, r, g, b, a, texIndex
  private texture: Texture | null = null;
  private depthTestEnabled: boolean = true;

  /**
   * Create a new sprite batch renderer (V2)
   * @param gl WebGL rendering context
   * @param shader Shader program to use (should be SHADERS_V2)
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
    // Each quad has 6 vertices, each vertex has 10 floats
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
   * Add a sprite quad to the batch
   * @param quad Sprite quad instance to add
   */
  addQuad(quad: SpriteQuadInstance): void {
    if (this.quads.length >= this.maxQuads) {
      console.warn(`Sprite batch renderer at max capacity (${this.maxQuads})`);
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
      // Extract properties with defaults
      const {
        x,
        y,
        z = 0,
        width,
        height,
        rotation,
        color = { r: 1, g: 1, b: 1, a: 1 },
        uvRect = { uMin: 0, vMin: 0, uMax: 1, vMax: 1 },
        texIndex = 0,
      } = quad;

      // Generate quad vertices
      const vertices = this.generateQuadVertices({
        x,
        y,
        z,
        width,
        height,
        rotation,
        color,
        uvRect,
        texIndex,
      });

      // Copy vertices to buffer
      for (const vertex of vertices) {
        this.vertexData[vertexIndex++] = vertex.x;
        this.vertexData[vertexIndex++] = vertex.y;
        this.vertexData[vertexIndex++] = vertex.z;
        this.vertexData[vertexIndex++] = vertex.u;
        this.vertexData[vertexIndex++] = vertex.v;
        this.vertexData[vertexIndex++] = vertex.r;
        this.vertexData[vertexIndex++] = vertex.g;
        this.vertexData[vertexIndex++] = vertex.b;
        this.vertexData[vertexIndex++] = vertex.a;
        this.vertexData[vertexIndex++] = vertex.texIndex;
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
   * Set whether depth testing is enabled
   * When enabled, sprites with lower Z values appear behind sprites with higher Z values
   * @param enabled Whether to enable depth testing (default true)
   */
  setDepthTestEnabled(enabled: boolean): void {
    this.depthTestEnabled = enabled;
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

    // Enable depth testing for proper 2.5D layering
    if (this.depthTestEnabled) {
      this.gl.enable(this.gl.DEPTH_TEST);
      this.gl.depthFunc(this.gl.LEQUAL);
    } else {
      this.gl.disable(this.gl.DEPTH_TEST);
    }

    // Bind vertex buffer
    if (this.vertexBuffer) {
      this.gl.bindBuffer(this.gl.ARRAY_BUFFER, this.vertexBuffer);

      // Get attribute locations
      const posAttr = this.shader.getAttributeLocation("aPosition");
      const texCoordAttr = this.shader.getAttributeLocation("aTexCoord");
      const colorAttr = this.shader.getAttributeLocation("aColor");
      const texIndexAttr = this.shader.getAttributeLocation("aTexIndex");

      const stride = this.floatsPerVertex * 4; // stride in bytes

      // Enable and configure position attribute
      if (posAttr !== -1) {
        this.gl.enableVertexAttribArray(posAttr);
        this.gl.vertexAttribPointer(
          posAttr,
          3, // 3 floats (x, y, z)
          this.gl.FLOAT,
          false,
          stride,
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
          stride,
          3 * 4, // offset after position
        );
      }

      // Enable and configure color attribute
      if (colorAttr !== -1) {
        this.gl.enableVertexAttribArray(colorAttr);
        this.gl.vertexAttribPointer(
          colorAttr,
          4, // 4 floats (r, g, b, a)
          this.gl.FLOAT,
          false,
          stride,
          5 * 4, // offset after texCoord
        );
      }

      // Enable and configure texture index attribute
      if (texIndexAttr !== -1) {
        this.gl.enableVertexAttribArray(texIndexAttr);
        this.gl.vertexAttribPointer(
          texIndexAttr,
          1, // 1 float (texIndex)
          this.gl.FLOAT,
          false,
          stride,
          9 * 4, // offset after color
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
    instance: SpriteQuadInstance & { z: number; color: { r: number; g: number; b: number; a: number }; uvRect: { uMin: number; vMin: number; uMax: number; vMax: number }; texIndex: number },
  ): Array<{ x: number; y: number; z: number; u: number; v: number; r: number; g: number; b: number; a: number; texIndex: number }> {
    const { x, y, z, width, height, rotation, color, uvRect, texIndex } =
      instance;
    const halfW = width / 2;
    const halfH = height / 2;

    // Calculate rotation
    const cos = Math.cos(rotation);
    const sin = Math.sin(rotation);

    // Helper to rotate point around origin
    const rotatePoint = (px: number, py: number): [number, number] => {
      return [px * cos - py * sin, px * sin + py * cos];
    };

    // Define quad corners in local space (2 triangles = 6 vertices)
    const corners = [
      [-halfW, -halfH], // bottom-left
      [halfW, -halfH], // bottom-right
      [halfW, halfH], // top-right
      [halfW, halfH], // top-right (duplicate)
      [-halfW, halfH], // top-left
      [-halfW, -halfH], // bottom-left (duplicate)
    ];

    // Define texture coordinates for each corner
    const texCoords = [
      [uvRect.uMin, uvRect.vMin], // bottom-left
      [uvRect.uMax, uvRect.vMin], // bottom-right
      [uvRect.uMax, uvRect.vMax], // top-right
      [uvRect.uMax, uvRect.vMax], // top-right
      [uvRect.uMin, uvRect.vMax], // top-left
      [uvRect.uMin, uvRect.vMin], // bottom-left
    ];

    // Generate vertices
    const vertices: Array<{
      x: number;
      y: number;
      z: number;
      u: number;
      v: number;
      r: number;
      g: number;
      b: number;
      a: number;
      texIndex: number;
    }> = [];
    for (let i = 0; i < corners.length; i++) {
      const [localX, localY] = corners[i];
      const [rotX, rotY] = rotatePoint(localX, localY);
      const [u, v] = texCoords[i];

      vertices.push({
        x: x + rotX,
        y: y + rotY,
        z: z,
        u: u,
        v: v,
        r: color.r,
        g: color.g,
        b: color.b,
        a: color.a,
        texIndex: texIndex,
      });
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
