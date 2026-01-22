/**
 * Texture abstraction layer
 * Handles texture creation, loading, and binding across environments
 */
export class Texture {
  private texture: WebGLTexture;
  private gl: WebGLRenderingContext;
  private width: number;
  private height: number;

  /**
   * Create a texture from pixel data
   * @param gl WebGL context
   * @param width Texture width
   * @param height Texture height
   * @param data Pixel data (Uint8Array RGBA)
   */
  constructor(
    gl: WebGLRenderingContext,
    width: number,
    height: number,
    data?: Uint8Array,
  ) {
    this.gl = gl;
    this.width = width;
    this.height = height;

    const tex = gl.createTexture();
    if (!tex) {
      throw new Error("Failed to create texture");
    }

    this.texture = tex;

    // Bind and configure texture
    gl.bindTexture(gl.TEXTURE_2D, this.texture);

    // Set texture parameters
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);

    // Upload pixel data if provided
    if (data) {
      gl.texImage2D(
        gl.TEXTURE_2D,
        0,
        gl.RGBA,
        width,
        height,
        0,
        gl.RGBA,
        gl.UNSIGNED_BYTE,
        data,
      );
    } else {
      // Create empty texture
      gl.texImage2D(
        gl.TEXTURE_2D,
        0,
        gl.RGBA,
        width,
        height,
        0,
        gl.RGBA,
        gl.UNSIGNED_BYTE,
        null,
      );
    }

    gl.bindTexture(gl.TEXTURE_2D, null);
  }

  /**
   * Create a solid color texture
   * @param gl WebGL context
   * @param width Texture width
   * @param height Texture height
   * @param r Red (0-255)
   * @param g Green (0-255)
   * @param b Blue (0-255)
   * @param a Alpha (0-255)
   */
  static createSolid(
    gl: WebGLRenderingContext,
    width: number,
    height: number,
    r: number,
    g: number,
    b: number,
    a: number = 255,
  ): Texture {
    const pixelCount = width * height;
    const data = new Uint8Array(pixelCount * 4);

    for (let i = 0; i < pixelCount; i++) {
      const offset = i * 4;
      data[offset] = r;
      data[offset + 1] = g;
      data[offset + 2] = b;
      data[offset + 3] = a;
    }

    return new Texture(gl, width, height, data);
  }

  /**
   * Create a checkerboard texture
   * @param gl WebGL context
   * @param width Texture width
   * @param height Texture height
   * @param squareSize Size of each square
   */
  static createCheckerboard(
    gl: WebGLRenderingContext,
    width: number,
    height: number,
    squareSize: number = 32,
  ): Texture {
    const data = new Uint8Array(width * height * 4);

    for (let y = 0; y < height; y++) {
      for (let x = 0; x < width; x++) {
        const squareX = Math.floor(x / squareSize);
        const squareY = Math.floor(y / squareSize);
        const isWhite = (squareX + squareY) % 2 === 0;

        const offset = (y * width + x) * 4;
        const color = isWhite ? 255 : 0;

        data[offset] = color; // R
        data[offset + 1] = color; // G
        data[offset + 2] = color; // B
        data[offset + 3] = 255; // A
      }
    }

    return new Texture(gl, width, height, data);
  }

  /**
   * Create a gradient texture
   * @param gl WebGL context
   * @param width Texture width
   * @param height Texture height
   */
  static createGradient(
    gl: WebGLRenderingContext,
    width: number,
    height: number,
  ): Texture {
    const data = new Uint8Array(width * height * 4);

    for (let y = 0; y < height; y++) {
      for (let x = 0; x < width; x++) {
        const offset = (y * width + x) * 4;

        // Red gradient horizontally, Green gradient vertically
        data[offset] = Math.floor((x / width) * 255); // R
        data[offset + 1] = Math.floor((y / height) * 255); // G
        data[offset + 2] = 128; // B
        data[offset + 3] = 255; // A
      }
    }

    return new Texture(gl, width, height, data);
  }

  /**
   * Bind this texture to a texture unit
   * @param unit Texture unit (0-7 typically)
   */
  bind(unit: number = 0): void {
    this.gl.activeTexture(this.gl.TEXTURE0 + unit);
    this.gl.bindTexture(this.gl.TEXTURE_2D, this.texture);
  }

  /**
   * Unbind texture
   */
  unbind(): void {
    this.gl.bindTexture(this.gl.TEXTURE_2D, null);
  }

  /**
   * Get the underlying WebGL texture
   */
  getHandle(): WebGLTexture {
    return this.texture;
  }

  /**
   * Get texture dimensions
   */
  getDimensions(): { width: number; height: number } {
    return { width: this.width, height: this.height };
  }

  /**
   * Clean up texture resources
   */
  dispose(): void {
    this.gl.deleteTexture(this.texture);
  }
}
