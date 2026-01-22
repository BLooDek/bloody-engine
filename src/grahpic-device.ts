import createGL from "gl";

export class GraphicsDevice {
  width: number;
  height: number;
  gl: WebGLRenderingContext | null;

  constructor(width: number, height: number) {
    this.gl = null;
    this.width = width;
    this.height = height;
    this.init();
  }

  init() {
    if (typeof window !== "undefined" && typeof document !== "undefined") {
      // Browser Strategy
      const canvas = document.createElement("canvas");
      canvas.width = this.width;
      canvas.height = this.height;
      document.body.appendChild(canvas);
      this.gl = canvas.getContext("webgl", { alpha: false });
    } else {
      // Server Strategy
      // [5] headless-gl requires explicit dimensions
      this.gl = createGL(this.width, this.height, {
        preserveDrawingBuffer: true,
      });
    }

    if (!this.gl) {
      throw new Error("Failed to initialize WebGL context.");
    }
  }
}
