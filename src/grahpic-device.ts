import type { RenderingContext } from "./rendering-context";
import { RenderingContextFactory } from "./rendering-context-factory";

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
}
