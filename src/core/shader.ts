/**
 * Shader abstraction layer
 * Handles shader compilation and linking with automatic precision header injection
 */
export class Shader {
  private program: WebGLProgram;
  private gl: WebGLRenderingContext;
  private vertexShader: WebGLShader;
  private fragmentShader: WebGLShader;
  private vertexSource: string;
  private fragmentSource: string;

  /**
   * Create a new shader program
   * @param gl WebGL rendering context
   * @param vertexSource Raw vertex shader source code
   * @param fragmentSource Raw fragment shader source code
   * @param isBrowser Whether running in browser environment (affects precision header)
   */
  constructor(
    gl: WebGLRenderingContext,
    vertexSource: string,
    fragmentSource: string,
    isBrowser: boolean,
  ) {
    this.gl = gl;
    this.vertexSource = vertexSource;
    this.fragmentSource = fragmentSource;

    // Inject precision headers based on environment
    const processedVertexSource = this.injectPrecisionHeader(
      vertexSource,
      isBrowser,
    );
    const processedFragmentSource = this.injectPrecisionHeader(
      fragmentSource,
      isBrowser,
    );

    // Compile individual shaders
    this.vertexShader = this.compileShader(
      processedVertexSource,
      gl.VERTEX_SHADER,
    );
    this.fragmentShader = this.compileShader(
      processedFragmentSource,
      gl.FRAGMENT_SHADER,
    );

    // Link shaders into program
    this.program = this.linkProgram(this.vertexShader, this.fragmentShader);
  }

  /**
   * Inject precision header for ES and desktop OpenGL differences
   * @param source Original shader source
   * @param isBrowser Whether in browser (WebGL ES) or Node (desktop OpenGL)
   * @returns Processed shader source with precision header
   */
  private injectPrecisionHeader(source: string, isBrowser: boolean): string {
    // Check if precision header already exists
    if (source.includes("#ifdef GL_ES") || source.includes("precision")) {
      return source;
    }

    if (isBrowser) {
      // WebGL ES requires explicit precision declaration
      const precisionHeader = `#ifdef GL_ES
precision highp float;
#endif
`;
      return precisionHeader + source;
    } else {
      // Desktop OpenGL doesn't require precision header but it's safe to include
      // and makes shaders more portable
      const precisionHeader = `#ifdef GL_ES
precision highp float;
#endif
`;
      return precisionHeader + source;
    }
  }

  /**
   * Compile a single shader (vertex or fragment)
   * @param source Shader source code
   * @param type gl.VERTEX_SHADER or gl.FRAGMENT_SHADER
   * @returns Compiled shader
   */
  private compileShader(source: string, type: number): WebGLShader {
    const shader = this.gl.createShader(type);
    if (!shader) {
      throw new Error(`Failed to create shader of type ${type}`);
    }

    this.gl.shaderSource(shader, source);
    this.gl.compileShader(shader);

    // Check for compilation errors
    const compiled = this.gl.getShaderParameter(shader, this.gl.COMPILE_STATUS);
    if (!compiled) {
      const infoLog = this.gl.getShaderInfoLog(shader);
      const shaderType = type === this.gl.VERTEX_SHADER ? "vertex" : "fragment";
      this.gl.deleteShader(shader);
      throw new Error(
        `Failed to compile ${shaderType} shader:\n${infoLog}\n\nSource:\n${source}`,
      );
    }

    return shader;
  }

  /**
   * Link vertex and fragment shaders into a program
   * @param vertexShader Compiled vertex shader
   * @param fragmentShader Compiled fragment shader
   * @returns Linked shader program
   */
  private linkProgram(
    vertexShader: WebGLShader,
    fragmentShader: WebGLShader,
  ): WebGLProgram {
    const program = this.gl.createProgram();
    if (!program) {
      throw new Error("Failed to create shader program");
    }

    this.gl.attachShader(program, vertexShader);
    this.gl.attachShader(program, fragmentShader);
    this.gl.linkProgram(program);

    // Check for linking errors
    const linked = this.gl.getProgramParameter(program, this.gl.LINK_STATUS);
    if (!linked) {
      const infoLog = this.gl.getProgramInfoLog(program);
      this.gl.deleteProgram(program);
      this.gl.deleteShader(vertexShader);
      this.gl.deleteShader(fragmentShader);
      throw new Error(`Failed to link shader program:\n${infoLog}`);
    }

    return program;
  }

  /**
   * Get the compiled shader program
   */
  getProgram(): WebGLProgram {
    return this.program;
  }

  /**
   * Get uniform location by name
   * @param name Uniform variable name
   */
  getUniformLocation(name: string): WebGLUniformLocation | null {
    return this.gl.getUniformLocation(this.program, name);
  }

  /**
   * Get attribute location by name
   * @param name Attribute variable name
   */
  getAttributeLocation(name: string): number {
    return this.gl.getAttribLocation(this.program, name);
  }

  /**
   * Use this shader program
   */
  use(): void {
    this.gl.useProgram(this.program);
  }

  /**
   * Get the original vertex shader source code
   * Useful for shader analysis and type detection
   */
  getVertexSource(): string {
    return this.vertexSource;
  }

  /**
   * Get the original fragment shader source code
   */
  getFragmentSource(): string {
    return this.fragmentSource;
  }

  /**
   * Clean up shader resources
   */
  dispose(): void {
    this.gl.deleteProgram(this.program);
    this.gl.deleteShader(this.vertexShader);
    this.gl.deleteShader(this.fragmentShader);
  }
}
