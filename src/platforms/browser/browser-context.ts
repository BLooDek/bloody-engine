import type {
  RenderingContext,
  RenderingContextOptions,
} from "../../rendering/rendering-context";

/**
 * Browser-based WebGL rendering context implementation
 * Manages rendering to an HTML canvas element
 */
export class BrowserRenderingContext implements RenderingContext {
  glContext: WebGLRenderingContext;
  width: number;
  height: number;
  isBrowser: boolean = true;

  private canvas: HTMLCanvasElement;

  constructor(options: RenderingContextOptions) {
    if (!options.canvas) {
      this.canvas = document.createElement("canvas");
      document.body.appendChild(this.canvas);
    } else {
      this.canvas = options.canvas;
    }

    this.width = options.width;
    this.height = options.height;
    this.canvas.width = this.width;
    this.canvas.height = this.height;

    const contextAttributes: WebGLContextAttributes = {
      alpha: false,
      ...options.contextAttributes,
    };

    const glContext = this.canvas.getContext("webgl", contextAttributes);
    if (!glContext) {
      throw new Error("Failed to initialize WebGL context in browser");
    }

    this.glContext = glContext;
  }

  resize(width: number, height: number): void {
    this.width = width;
    this.height = height;
    this.canvas.width = width;
    this.canvas.height = height;
    this.glContext.viewport(0, 0, width, height);
  }

  getViewport(): { width: number; height: number } {
    return { width: this.width, height: this.height };
  }

  clear(color?: { r: number; g: number; b: number; a: number }): void {
    if (color) {
      this.glContext.clearColor(color.r, color.g, color.b, color.a);
    }
    this.glContext.clear(
      this.glContext.COLOR_BUFFER_BIT | this.glContext.DEPTH_BUFFER_BIT,
    );
  }

  present(): void {
    // Browser automatically presents after each frame
  }

  dispose(): void {
    // Let the browser handle canvas cleanup
    if (this.canvas.parentElement) {
      this.canvas.parentElement.removeChild(this.canvas);
    }
  }

  /**
   * Get the underlying canvas element (browser-specific)
   */
  getCanvas(): HTMLCanvasElement {
    return this.canvas;
  }
}
