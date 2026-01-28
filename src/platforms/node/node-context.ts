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

  isWebGL2(): boolean {
    // headless-gl (gl package) provides WebGL2 features via extensions
    const glAny = this.glContext as any;

    // Check for WEBGL_draw_buffers extension (WebGL2 feature)
    const hasWebGL2Features = glAny.drawBuffers !== undefined &&
           glAny.getBufferSubData !== undefined;

    // If not available directly, check for extension
    if (!hasWebGL2Features && glAny.getSupportedExtensions) {
      const extensions = glAny.getSupportedExtensions();
      return extensions.includes('WEBGL_draw_buffers');
    }

    return hasWebGL2Features;
  }

  supportsInstancing(): boolean {
    // Check for instanced arrays (available via ANGLE_instanced_arrays extension)
    const glAny = this.glContext as any;

    // Check direct methods first
    const hasDirectMethods = glAny.drawArraysInstanced !== undefined &&
           glAny.vertexAttribDivisor !== undefined;

    if (hasDirectMethods) {
      return true;
    }

    // Check for ANGLE_instanced_arrays extension
    if (glAny.getSupportedExtensions) {
      const extensions = glAny.getSupportedExtensions();
      return extensions.includes('ANGLE_instanced_arrays');
    }

    return false;
  }

  getWebGL2Context(): any {
    // Return the context as 'any' to avoid WebGL2RenderingContext type issues in Node.js
    // headless-gl provides WebGL2-compatible context
    return this.glContext;
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
