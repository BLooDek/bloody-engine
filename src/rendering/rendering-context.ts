/**
 * Standardized rendering context interface
 * Abstracts away environment-specific (DOM vs Node.js) details
 * Ensures the engine core never directly references DOM APIs
 */
export interface RenderingContext {
  /**
   * The underlying WebGL rendering context
   */
  glContext: WebGLRenderingContext;

  /**
   * Canvas/drawable surface width in pixels
   */
  width: number;

  /**
   * Canvas/drawable surface height in pixels
   */
  height: number;

  /**
   * Whether this context is in a browser environment
   */
  isBrowser: boolean;

  /**
   * Resize the rendering context
   */
  resize(width: number, height: number): void;

  /**
   * Get the current viewport dimensions
   */
  getViewport(): { width: number; height: number };

  /**
   * Clear the rendering context (prepare for new frame)
   */
  clear(color?: { r: number; g: number; b: number; a: number }): void;

  /**
   * Present/swap the rendering buffers (if applicable)
   */
  present(): void;

  /**
   * Cleanup and release resources
   */
  dispose(): void;

  /**
   * Check if WebGL2 context is available
   */
  isWebGL2(): boolean;

  /**
   * Check if instancing is supported
   */
  supportsInstancing(): boolean;

  /**
   * Get WebGL2 context (throws if not WebGL2)
   */
  getWebGL2Context(): WebGL2RenderingContext;
}

/**
 * Context creation options
 */
export interface RenderingContextOptions {
  /**
   * Canvas element (browser only)
   */
  canvas?: HTMLCanvasElement;

  /**
   * WebGL context creation options
   */
  contextAttributes?: WebGLContextAttributes;

  /**
   * Whether to preserve drawing buffer between frames
   */
  preserveDrawingBuffer?: boolean;

  /**
   * Canvas width in pixels
   */
  width: number;

  /**
   * Canvas height in pixels
   */
  height: number;
}
