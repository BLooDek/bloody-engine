import type { RenderingContext } from "../rendering/rendering-context";
import { RenderingContextFactory } from "../rendering/rendering-context-factory";
import { Shader } from "./shader";

/**
 * Graphics device that manages rendering context and WebGL operations
 * Uses standardized RenderingContext interface, never directly references DOM
 */
export class GraphicsDevice {
  private context: RenderingContext;

  constructor(width: number, height: number) {
    // Use factory to create appropriate context for environment
    this.context = RenderingContextFactory.createContext({
      width,
      height,
      preserveDrawingBuffer: true,
    });
  }

  /**
   * Get the underlying WebGL rendering context
   */
  getGLContext(): WebGLRenderingContext {
    return this.context.glContext;
  }

  /**
   * Get the rendering context
   */
  getRenderingContext(): RenderingContext {
    return this.context;
  }

  /**
   * Get current width
   */
  getWidth(): number {
    return this.context.width;
  }

  /**
   * Get current height
   */
  getHeight(): number {
    return this.context.height;
  }

  /**
   * Get viewport dimensions
   */
  getViewport(): { width: number; height: number } {
    return this.context.getViewport();
  }

  /**
   * Check if running in browser
   */
  isBrowser(): boolean {
    return this.context.isBrowser;
  }

  /**
   * Resize the graphics device
   */
  resize(width: number, height: number): void {
    this.context.resize(width, height);
  }

  /**
   * Clear the rendering surface
   */
  clear(color?: { r: number; g: number; b: number; a: number }): void {
    this.context.clear(color);
  }

  /**
   * Present the rendered frame
   */
  present(): void {
    this.context.present();
  }

  /**
   * Cleanup and release resources
   */
  dispose(): void {
    this.context.dispose();
  }

  /**
   * Create a shader program
   * @param vertexSource Vertex shader source code
   * @param fragmentSource Fragment shader source code
   * @returns Compiled and linked shader program
   */
  createShader(vertexSource: string, fragmentSource: string): Shader {
    return new Shader(
      this.context.glContext,
      vertexSource,
      fragmentSource,
      this.context.isBrowser,
    );
  }

  /**
   * Check if WebGL2 is available
   */
  isWebGL2(): boolean {
    return this.context.isWebGL2();
  }

  /**
   * Check if instancing is supported
   */
  supportsInstancing(): boolean {
    return this.context.supportsInstancing();
  }

  /**
   * Get WebGL2 context (for advanced features)
   * Throws if WebGL2 is not available
   */
  getWebGL2Context(): WebGL2RenderingContext {
    return this.context.getWebGL2Context();
  }
}
