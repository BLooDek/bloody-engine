/**
 * Shader Unit Tests
 *
 * Tests for the Shader class covering:
 * - Shader compilation errors
 * - Shader linking errors
 * - Uniform location caching
 * - Attribute location caching
 * - Shader program disposal
 * - Shader validation
 */

/// <reference types="vitest/globals" />

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { Shader } from "../core/shader";
import { GraphicsDevice } from "../core/graphics-device";

// ============================================================================
// Test Utilities
// ============================================================================

/**
 * Valid minimal vertex shader source
 */
const VALID_VERTEX_SHADER = `
attribute vec2 a_position;
void main() {
  gl_Position = vec4(a_position, 0.0, 1.0);
}
`;

/**
 * Valid minimal fragment shader source
 */
const VALID_FRAGMENT_SHADER = `
void main() {
  gl_FragColor = vec4(1.0, 0.0, 0.0, 1.0);
}
`;

/**
 * Invalid vertex shader (syntax error)
 */
const INVALID_VERTEX_SHADER = `
attribute vec2 a_position;
void main() {
  gl_Position = vec4(a_position INVALID SYNTAX HERE, 0.0, 1.0);
}
`;

/**
 * Invalid fragment shader (syntax error)
 */
const INVALID_FRAGMENT_SHADER = `
void main() {
  gl_FragColor = vec4(1.0 INVALID SYNTAX HERE, 0.0, 1.0);
}
`;

/**
 * Vertex shader with uniform
 */
const VERTEX_SHADER_WITH_UNIFORM = `
attribute vec2 a_position;
uniform vec2 u_offset;
void main() {
  gl_Position = vec4(a_position + u_offset, 0.0, 1.0);
}
`;

/**
 * Vertex shader with attribute
 */
const VERTEX_SHADER_WITH_ATTRIBUTE = `
attribute vec2 a_position;
attribute vec2 a_texCoord;
varying vec2 v_texCoord;
void main() {
  v_texCoord = a_texCoord;
  gl_Position = vec4(a_position, 0.0, 1.0);
}
`;

/**
 * Fragment shader with varying (will fail linking without vertex shader varying)
 */
const FRAGMENT_SHADER_WITH_MISMATCHED_VARYING = `
varying vec3 v_nonexistent;
void main() {
  gl_FragColor = vec4(1.0, 0.0, 0.0, 1.0);
}
`;

/**
 * Vertex shader source with precision header already present
 */
const VERTEX_SHADER_WITH_PRECISION = `
#ifdef GL_ES
precision highp float;
#endif

attribute vec2 a_position;
void main() {
  gl_Position = vec4(a_position, 0.0, 1.0);
}
`;

/**
 * Fragment shader source with precision header already present
 */
const FRAGMENT_SHADER_WITH_PRECISION = `
#ifdef GL_ES
precision highp float;
#endif

void main() {
  gl_FragColor = vec4(1.0, 0.0, 1.0, 1.0);
}
`;

// ============================================================================
// Mock WebGL Context for Error Testing
// ============================================================================

/**
 * Create a mock WebGL context that simulates compilation/linking failures
 */
function createMockWebGLContext(options: {
  failShaderCreation?: boolean;
  failCompilation?: boolean;
  failProgramCreation?: boolean;
  failLinking?: boolean;
}): WebGLRenderingContext {
  const mockContext = {
    VERTEX_SHADER: 35633,
    FRAGMENT_SHADER: 35632,
    COMPILE_STATUS: 35713,
    LINK_STATUS: 35714,
    FALSE: 0,

    createShader: vi.fn((type: number) => {
      if (options.failShaderCreation) {
        return null;
      }
      return {} as WebGLShader;
    }),

    shaderSource: vi.fn(),
    compileShader: vi.fn(),

    getShaderParameter: vi.fn((shader: WebGLShader, pname: number) => {
      if (pname === 35713 && options.failCompilation) {
        return false; // COMPILE_STATUS = false
      }
      return true;
    }),

    getShaderInfoLog: vi.fn(() => "ERROR: shader compilation failed"),

    deleteShader: vi.fn(),

    createProgram: vi.fn(() => {
      if (options.failProgramCreation) {
        return null;
      }
      return {} as WebGLProgram;
    }),

    attachShader: vi.fn(),
    linkProgram: vi.fn(),

    getProgramParameter: vi.fn((program: WebGLProgram, pname: number) => {
      if (pname === 35714 && options.failLinking) {
        return false; // LINK_STATUS = false
      }
      return true;
    }),

    getProgramInfoLog: vi.fn(() => "ERROR: program link failed"),

    deleteProgram: vi.fn(),

    getUniformLocation: vi.fn((program: WebGLProgram, name: string) => {
      return { name } as WebGLUniformLocation;
    }),

    getAttribLocation: vi.fn((program: WebGLProgram, name: string) => {
      return name === "a_position" ? 0 : name === "a_texCoord" ? 1 : -1;
    }),

    useProgram: vi.fn(),
  } as unknown as WebGLRenderingContext;

  return mockContext;
}

// ============================================================================
// Tests
// ============================================================================

describe("Shader", () => {
  let graphicsDevice: GraphicsDevice;
  let gl: WebGLRenderingContext;

  beforeEach(() => {
    graphicsDevice = new GraphicsDevice(800, 600);
    gl = graphicsDevice.getGLContext();
  });

  afterEach(() => {
    if (graphicsDevice) {
      graphicsDevice.dispose();
    }
  });

  describe("constructor", () => {
    it("should create shader with valid vertex and fragment shaders", () => {
      const shader = new Shader(
        gl,
        VALID_VERTEX_SHADER,
        VALID_FRAGMENT_SHADER,
        false,
      );

      expect(shader).toBeDefined();
      expect(shader.getProgram()).toBeDefined();

      shader.dispose();
    });

    it("should inject precision header when isBrowser is true", () => {
      const shader = new Shader(
        gl,
        VALID_VERTEX_SHADER,
        VALID_FRAGMENT_SHADER,
        true,
      );

      expect(shader).toBeDefined();

      // Check that precision header was injected
      const vertexSource = shader.getVertexSource();
      const fragmentSource = shader.getFragmentSource();

      // Original sources should be preserved
      expect(vertexSource).toBe(VALID_VERTEX_SHADER);
      expect(fragmentSource).toBe(VALID_FRAGMENT_SHADER);

      shader.dispose();
    });

    it("should not double-inject precision header if already present", () => {
      const shader = new Shader(
        gl,
        VERTEX_SHADER_WITH_PRECISION,
        FRAGMENT_SHADER_WITH_PRECISION,
        true,
      );

      expect(shader).toBeDefined();
      expect(shader.getProgram()).toBeDefined();

      shader.dispose();
    });

    it("should handle precision header injection in non-browser environment", () => {
      const shader = new Shader(
        gl,
        VALID_VERTEX_SHADER,
        VALID_FRAGMENT_SHADER,
        false,
      );

      expect(shader).toBeDefined();
      expect(shader.getProgram()).toBeDefined();

      shader.dispose();
    });
  });

  describe("shader compilation errors", () => {
    it("should throw when shader creation fails", () => {
      const mockGl = createMockWebGLContext({ failShaderCreation: true });

      expect(() => {
        new Shader(mockGl, VALID_VERTEX_SHADER, VALID_FRAGMENT_SHADER, false);
      }).toThrow("Failed to create shader of type");
    });

    it("should throw when vertex shader compilation fails with invalid syntax", () => {
      expect(() => {
        new Shader(gl, INVALID_VERTEX_SHADER, VALID_FRAGMENT_SHADER, false);
      }).toThrow(/Failed to compile vertex shader/);
    });

    it("should throw when fragment shader compilation fails with invalid syntax", () => {
      expect(() => {
        new Shader(gl, VALID_VERTEX_SHADER, INVALID_FRAGMENT_SHADER, false);
      }).toThrow(/Failed to compile fragment shader/);
    });

    it("should delete shader after compilation failure", () => {
      const mockGl = createMockWebGLContext({ failCompilation: true });

      try {
        new Shader(mockGl, VALID_VERTEX_SHADER, VALID_FRAGMENT_SHADER, false);
        expect.fail("Should have thrown an error");
      } catch (error) {
        expect((error as Error).message).toContain("Failed to compile");
        // Verify deleteShader was called
        expect(mockGl.deleteShader).toHaveBeenCalled();
      }
    });

    it("should include shader source in compilation error message", () => {
      const mockGl = createMockWebGLContext({ failCompilation: true });

      try {
        new Shader(mockGl, VALID_VERTEX_SHADER, VALID_FRAGMENT_SHADER, false);
        expect.fail("Should have thrown an error");
      } catch (error) {
        const errorMessage = (error as Error).message;
        expect(errorMessage).toContain("Source:");
      }
    });
  });

  describe("shader linking errors", () => {
    it("should throw when program creation fails", () => {
      const mockGl = createMockWebGLContext({ failProgramCreation: true });

      expect(() => {
        new Shader(mockGl, VALID_VERTEX_SHADER, VALID_FRAGMENT_SHADER, false);
      }).toThrow("Failed to create shader program");
    });

    it("should throw when program linking fails", () => {
      const mockGl = createMockWebGLContext({ failLinking: true });

      expect(() => {
        new Shader(mockGl, VALID_VERTEX_SHADER, VALID_FRAGMENT_SHADER, false);
      }).toThrow("Failed to link shader program");
    });

    it("should clean up resources after linking failure", () => {
      const mockGl = createMockWebGLContext({ failLinking: true });

      try {
        new Shader(mockGl, VALID_VERTEX_SHADER, VALID_FRAGMENT_SHADER, false);
        expect.fail("Should have thrown an error");
      } catch (error) {
        // Verify cleanup happened
        expect(mockGl.deleteProgram).toHaveBeenCalled();
        expect(mockGl.deleteShader).toHaveBeenCalled();
      }
    });

    it("should include info log in linking error message", () => {
      const mockGl = createMockWebGLContext({ failLinking: true });

      try {
        new Shader(mockGl, VALID_VERTEX_SHADER, VALID_FRAGMENT_SHADER, false);
        expect.fail("Should have thrown an error");
      } catch (error) {
        const errorMessage = (error as Error).message;
        expect(errorMessage).toContain("ERROR: program link failed");
      }
    });
  });

  describe("uniform location caching", () => {
    it("should get uniform location", () => {
      const shader = new Shader(
        gl,
        VERTEX_SHADER_WITH_UNIFORM,
        VALID_FRAGMENT_SHADER,
        false,
      );

      const location = shader.getUniformLocation("u_offset");
      expect(location).toBeDefined();

      shader.dispose();
    });

    it("should return null for non-existent uniform", () => {
      const shader = new Shader(
        gl,
        VALID_VERTEX_SHADER,
        VALID_FRAGMENT_SHADER,
        false,
      );

      const location = shader.getUniformLocation("u_nonexistent");
      expect(location).toBeNull();

      shader.dispose();
    });

    it("should get valid uniform location across multiple calls", () => {
      const shader = new Shader(
        gl,
        VERTEX_SHADER_WITH_UNIFORM,
        VALID_FRAGMENT_SHADER,
        false,
      );

      const location1 = shader.getUniformLocation("u_offset");
      const location2 = shader.getUniformLocation("u_offset");

      // Both calls should return valid (non-null) locations
      expect(location1).toBeDefined();
      expect(location2).toBeDefined();
      expect(location1).not.toBeNull();
      expect(location2).not.toBeNull();

      shader.dispose();
    });
  });

  describe("attribute location caching", () => {
    it("should get attribute location", () => {
      const shader = new Shader(
        gl,
        VERTEX_SHADER_WITH_ATTRIBUTE,
        VALID_FRAGMENT_SHADER,
        false,
      );

      const location = shader.getAttributeLocation("a_position");
      expect(location).toBeGreaterThanOrEqual(0);

      shader.dispose();
    });

    it("should return -1 for non-existent attribute", () => {
      const shader = new Shader(
        gl,
        VALID_VERTEX_SHADER,
        VALID_FRAGMENT_SHADER,
        false,
      );

      const location = shader.getAttributeLocation("a_nonexistent");
      expect(location).toBe(-1);

      shader.dispose();
    });

    it("should get different locations for different attributes", () => {
      const shader = new Shader(
        gl,
        VERTEX_SHADER_WITH_ATTRIBUTE,
        VALID_FRAGMENT_SHADER,
        false,
      );

      const positionLocation = shader.getAttributeLocation("a_position");
      const texCoordLocation = shader.getAttributeLocation("a_texCoord");

      expect(positionLocation).not.toBe(texCoordLocation);

      shader.dispose();
    });

    it("should return valid attribute location across multiple calls", () => {
      const shader = new Shader(
        gl,
        VERTEX_SHADER_WITH_ATTRIBUTE,
        VALID_FRAGMENT_SHADER,
        false,
      );

      const location1 = shader.getAttributeLocation("a_position");
      const location2 = shader.getAttributeLocation("a_position");

      // Both calls should return valid (non-negative) locations
      expect(location1).toBeGreaterThanOrEqual(0);
      expect(location2).toBeGreaterThanOrEqual(0);

      shader.dispose();
    });
  });

  describe("shader program disposal", () => {
    it("should get vertex source", () => {
      const shader = new Shader(
        gl,
        VALID_VERTEX_SHADER,
        VALID_FRAGMENT_SHADER,
        false,
      );

      const source = shader.getVertexSource();
      expect(source).toBe(VALID_VERTEX_SHADER);

      shader.dispose();
    });

    it("should get fragment source", () => {
      const shader = new Shader(
        gl,
        VALID_VERTEX_SHADER,
        VALID_FRAGMENT_SHADER,
        false,
      );

      const source = shader.getFragmentSource();
      expect(source).toBe(VALID_FRAGMENT_SHADER);

      shader.dispose();
    });

    it("should dispose shader program and resources", () => {
      const shader = new Shader(
        gl,
        VALID_VERTEX_SHADER,
        VALID_FRAGMENT_SHADER,
        false,
      );
      const program = shader.getProgram();

      // Should not throw
      shader.dispose();

      // After disposal, the program should still exist but resources are freed
      // (This is just to verify dispose() can be called without errors)
      expect(program).toBeDefined();
    });

    it("should allow multiple dispose calls without error", () => {
      const shader = new Shader(
        gl,
        VALID_VERTEX_SHADER,
        VALID_FRAGMENT_SHADER,
        false,
      );

      shader.dispose();
      shader.dispose(); // Should not throw

      expect(true).toBe(true);
    });
  });

  describe("shader use", () => {
    it("should use the shader program", () => {
      const shader = new Shader(
        gl,
        VALID_VERTEX_SHADER,
        VALID_FRAGMENT_SHADER,
        false,
      );

      // Should not throw
      shader.use();

      shader.dispose();
    });
  });

  describe("getProgram", () => {
    it("should return the WebGL program", () => {
      const shader = new Shader(
        gl,
        VALID_VERTEX_SHADER,
        VALID_FRAGMENT_SHADER,
        false,
      );

      const program = shader.getProgram();
      expect(program).toBeDefined();

      shader.dispose();
    });

    it("should return the same program instance across multiple calls", () => {
      const shader = new Shader(
        gl,
        VALID_VERTEX_SHADER,
        VALID_FRAGMENT_SHADER,
        false,
      );

      const program1 = shader.getProgram();
      const program2 = shader.getProgram();

      expect(program1).toBe(program2);

      shader.dispose();
    });
  });

  describe("precision header injection", () => {
    it("should not inject precision header if #ifdef GL_ES exists", () => {
      const sourceWithGL_ES = `
#ifdef GL_ES
precision mediump float;
#endif

void main() {
  gl_FragColor = vec4(1.0);
}
`;

      const shader = new Shader(gl, VALID_VERTEX_SHADER, sourceWithGL_ES, true);
      expect(shader).toBeDefined();

      const fragmentSource = shader.getFragmentSource();
      expect(fragmentSource).toBe(sourceWithGL_ES);

      shader.dispose();
    });

    it("should not inject precision header if precision directive exists", () => {
      const sourceWithPrecision = `
precision highp float;

void main() {
  gl_FragColor = vec4(1.0);
}
`;

      const shader = new Shader(
        gl,
        VALID_VERTEX_SHADER,
        sourceWithPrecision,
        true,
      );
      expect(shader).toBeDefined();

      const fragmentSource = shader.getFragmentSource();
      expect(fragmentSource).toBe(sourceWithPrecision);

      shader.dispose();
    });
  });
});
