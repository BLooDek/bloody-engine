import createGL from "gl";
import type {
  RenderingContext,
  RenderingContextOptions,
} from "../../rendering/rendering-context";

/**
 * Node.js-based WebGL rendering context implementation
 * Uses headless-gl (node-gl) for server-side rendering
 */
export class NodeRenderingContext implements RenderingContext {
  glContext: WebGLRenderingContext;
  width: number;
  height: number;
  isBrowser: boolean = false;

  constructor(options: RenderingContextOptions) {
    this.width = options.width;
    this.height = options.height;

    // headless-gl requires explicit dimensions
    const glContext = createGL(this.width, this.height, {
      preserveDrawingBuffer: options.preserveDrawingBuffer ?? true,
      ...options.contextAttributes,
    });

    if (!glContext) {
      throw new Error("Failed to initialize WebGL context in Node.js");
    }

    this.glContext = glContext as WebGLRenderingContext;
  }

  resize(width: number, height: number): void {
    this.width = width;
    this.height = height;
    // Note: headless-gl doesn't support resize directly
    // Applications should recreate context if dimensions change
    console.warn(
      "NodeRenderingContext: Resize requested but not supported. Consider recreating context.",
    );
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
    // Flush pending commands to ensure they're processed
    this.glContext.flush();
  }

  dispose(): void {
    // Clean up WebGL resources
    // Note: headless-gl handles cleanup automatically when GC'd
    // but we can explicitly signal we're done
    this.glContext.flush();
  }

  /**
   * Read the current framebuffer contents as RGBA pixel data
   * Used for capturing frames for display or saving
   */
  readPixels(): Uint8Array {
    const pixelData = new Uint8Array(this.width * this.height * 4);
    this.glContext.readPixels(
      0,
      0,
      this.width,
      this.height,
      this.glContext.RGBA,
      this.glContext.UNSIGNED_BYTE,
      pixelData,
    );
    return pixelData;
  }
}
