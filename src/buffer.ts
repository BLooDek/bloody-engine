/**
 * Vertex Buffer abstraction
 * Manages vertex data for rendering
 */
export class VertexBuffer {
  private buffer: WebGLBuffer;
  private gl: WebGLRenderingContext;
  private vertexCount: number;
  private stride: number;

  constructor(
    gl: WebGLRenderingContext,
    data: Float32Array,
    stride: number = 0,
  ) {
    this.gl = gl;
    this.stride = stride;
    // stride is in bytes, convert to number of floats per vertex
    const floatsPerVertex = stride > 0 ? stride / 4 : 3;
    this.vertexCount = data.length / floatsPerVertex;

    const buf = gl.createBuffer();
    if (!buf) {
      throw new Error("Failed to create vertex buffer");
    }

    this.buffer = buf;

    gl.bindBuffer(gl.ARRAY_BUFFER, this.buffer);
    gl.bufferData(gl.ARRAY_BUFFER, data, gl.STATIC_DRAW);
    gl.bindBuffer(gl.ARRAY_BUFFER, null);
  }

  /**
   * Bind buffer for rendering
   */
  bind(): void {
    this.gl.bindBuffer(this.gl.ARRAY_BUFFER, this.buffer);
  }

  /**
   * Unbind buffer
   */
  unbind(): void {
    this.gl.bindBuffer(this.gl.ARRAY_BUFFER, null);
  }

  /**
   * Get vertex count
   */
  getVertexCount(): number {
    return this.vertexCount;
  }

  /**
   * Get stride
   */
  getStride(): number {
    return this.stride;
  }

  /**
   * Clean up resources
   */
  dispose(): void {
    this.gl.deleteBuffer(this.buffer);
  }
}

/**
 * Index Buffer abstraction
 * Manages index data for indexed rendering
 */
export class IndexBuffer {
  private buffer: WebGLBuffer;
  private gl: WebGLRenderingContext;
  private indexCount: number;

  constructor(gl: WebGLRenderingContext, data: Uint16Array) {
    this.gl = gl;
    this.indexCount = data.length;

    const buf = gl.createBuffer();
    if (!buf) {
      throw new Error("Failed to create index buffer");
    }

    this.buffer = buf;

    gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, this.buffer);
    gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, data, gl.STATIC_DRAW);
    gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, null);
  }

  /**
   * Bind buffer for rendering
   */
  bind(): void {
    this.gl.bindBuffer(this.gl.ELEMENT_ARRAY_BUFFER, this.buffer);
  }

  /**
   * Unbind buffer
   */
  unbind(): void {
    this.gl.bindBuffer(this.gl.ELEMENT_ARRAY_BUFFER, null);
  }

  /**
   * Get index count
   */
  getIndexCount(): number {
    return this.indexCount;
  }

  /**
   * Clean up resources
   */
  dispose(): void {
    this.gl.deleteBuffer(this.buffer);
  }
}
