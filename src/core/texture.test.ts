import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { Texture, ITexture } from "./texture";

describe("Texture", () => {
  let mockGL: WebGLRenderingContext;
  let textureCounter = 0;

  beforeEach(() => {
    textureCounter = 0;

    // Mock WebGL context
    mockGL = {
      TEXTURE_2D: 0x0de1,
      TEXTURE0: 0x84c0,
      TEXTURE1: 0x84c1,
      TEXTURE2: 0x84c2,
      RGBA: 0x1908,
      UNSIGNED_BYTE: 0x1401,
      CLAMP_TO_EDGE: 0x812f,
      LINEAR: 0x2601,
      NEAREST: 0x2600,
      REPEAT: 0x2901,
      MIRRORED_REPEAT: 0x8370,
      LINEAR_MIPMAP_NEAREST: 0x2703,
      NEAREST_MIPMAP_LINEAR: 0x2702,

      createTexture: vi.fn(() => {
        const tex = { id: ++textureCounter } as unknown as WebGLTexture;
        return tex;
      }),
      deleteTexture: vi.fn(),
      bindTexture: vi.fn(),
      activeTexture: vi.fn(),
      texParameteri: vi.fn(),
      texImage2D: vi.fn(),
      generateMipmap: vi.fn(),
    } as unknown as WebGLRenderingContext;
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe("constructor", () => {
    it("should create a texture with pixel data", () => {
      const width = 64;
      const height = 64;
      const data = new Uint8Array(width * height * 4);

      const texture = new Texture(mockGL, width, height, data);

      expect(mockGL.createTexture).toHaveBeenCalled();
      expect(mockGL.texImage2D).toHaveBeenCalledWith(
        mockGL.TEXTURE_2D,
        0,
        mockGL.RGBA,
        width,
        height,
        0,
        mockGL.RGBA,
        mockGL.UNSIGNED_BYTE,
        data,
      );
      expect(mockGL.bindTexture).toHaveBeenCalledWith(
        mockGL.TEXTURE_2D,
        null,
      ); // Unbind after creation
    });

    it("should create an empty texture when no data is provided (line 92)", () => {
      const width = 32;
      const height = 32;

      const texture = new Texture(mockGL, width, height);

      expect(mockGL.createTexture).toHaveBeenCalled();
      expect(mockGL.texImage2D).toHaveBeenCalledWith(
        mockGL.TEXTURE_2D,
        0,
        mockGL.RGBA,
        width,
        height,
        0,
        mockGL.RGBA,
        mockGL.UNSIGNED_BYTE,
        null, // Empty texture
      );
    });

    it("should set default texture parameters", () => {
      const texture = new Texture(mockGL, 64, 64);

      expect(mockGL.texParameteri).toHaveBeenCalledWith(
        mockGL.TEXTURE_2D,
        mockGL.TEXTURE_WRAP_S,
        mockGL.CLAMP_TO_EDGE,
      );
      expect(mockGL.texParameteri).toHaveBeenCalledWith(
        mockGL.TEXTURE_2D,
        mockGL.TEXTURE_WRAP_T,
        mockGL.CLAMP_TO_EDGE,
      );
      expect(mockGL.texParameteri).toHaveBeenCalledWith(
        mockGL.TEXTURE_2D,
        mockGL.TEXTURE_MIN_FILTER,
        mockGL.LINEAR,
      );
      expect(mockGL.texParameteri).toHaveBeenCalledWith(
        mockGL.TEXTURE_2D,
        mockGL.TEXTURE_MAG_FILTER,
        mockGL.LINEAR,
      );
    });

    it("should throw error when texture creation fails (line 63)", () => {
      (mockGL.createTexture as any).mockReturnValue(null);

      expect(() => new Texture(mockGL, 64, 64)).toThrow(
        "Failed to create texture",
      );
    });
  });

  describe("createSolid", () => {
    it("should create a solid color texture", () => {
      const width = 16;
      const height = 16;

      const texture = Texture.createSolid(mockGL, width, height, 255, 0, 0, 128);

      expect(mockGL.createTexture).toHaveBeenCalled();

      // Verify the texture was created with data
      const texImageCalls = (mockGL.texImage2D as any).mock.calls;
      const uploadCall = texImageCalls.find(
        (call: any[]) => call[8] instanceof Uint8Array,
      );
      expect(uploadCall).toBeDefined();

      const data = uploadCall[8] as Uint8Array;
      expect(data.length).toBe(width * height * 4);

      // Check first pixel (red with alpha 128)
      expect(data[0]).toBe(255); // R
      expect(data[1]).toBe(0); // G
      expect(data[2]).toBe(0); // B
      expect(data[3]).toBe(128); // A

      // Check last pixel (should be same)
      expect(data[data.length - 4]).toBe(255); // R
      expect(data[data.length - 3]).toBe(0); // G
      expect(data[data.length - 2]).toBe(0); // B
      expect(data[data.length - 1]).toBe(128); // A
    });

    it("should use default alpha value of 255", () => {
      const texture = Texture.createSolid(mockGL, 8, 8, 100, 150, 200);

      const texImageCalls = (mockGL.texImage2D as any).mock.calls;
      const uploadCall = texImageCalls.find(
        (call: any[]) => call[8] instanceof Uint8Array,
      );
      const data = uploadCall[8] as Uint8Array;

      // Alpha should be 255 (default)
      expect(data[3]).toBe(255);
    });
  });

  describe("createCheckerboard", () => {
    it("should create a checkerboard pattern (lines 154-172)", () => {
      const width = 64;
      const height = 64;
      const squareSize = 16;

      const texture = Texture.createCheckerboard(
        mockGL,
        width,
        height,
        squareSize,
      );

      expect(mockGL.createTexture).toHaveBeenCalled();

      const texImageCalls = (mockGL.texImage2D as any).mock.calls;
      const uploadCall = texImageCalls.find(
        (call: any[]) => call[8] instanceof Uint8Array,
      );
      const data = uploadCall[8] as Uint8Array;

      // Verify checkerboard pattern
      // First square (0,0) should be white (255)
      const firstPixelOffset = 0;
      expect(data[firstPixelOffset]).toBe(255); // White
      expect(data[firstPixelOffset + 1]).toBe(255);
      expect(data[firstPixelOffset + 2]).toBe(255);
      expect(data[firstPixelOffset + 3]).toBe(255); // Alpha

      // Second square (1,0) should be black (0)
      const secondSquareOffset = squareSize * 4;
      expect(data[secondSquareOffset]).toBe(0); // Black
      expect(data[secondSquareOffset + 1]).toBe(0);
      expect(data[secondSquareOffset + 2]).toBe(0);
      expect(data[secondSquareOffset + 3]).toBe(255); // Alpha
    });

    it("should use default square size of 32", () => {
      const width = 64;
      const height = 64;

      const texture = Texture.createCheckerboard(mockGL, width, height);

      const texImageCalls = (mockGL.texImage2D as any).mock.calls;
      const uploadCall = texImageCalls.find(
        (call: any[]) => call[8] instanceof Uint8Array,
      );
      const data = uploadCall[8] as Uint8Array;

      // With default square size of 32, we should have 2x2 squares
      // Pixel at (16, 16) should be in white square
      const offset = 16 * width * 4 + 16 * 4;
      expect(data[offset]).toBe(255); // White

      // Pixel at (48, 16) should be in black square
      const offset2 = 16 * width * 4 + 48 * 4;
      expect(data[offset2]).toBe(0); // Black
    });

    it("should create alternating pattern correctly", () => {
      const width = 32;
      const height = 32;
      const squareSize = 8;

      const texture = Texture.createCheckerboard(
        mockGL,
        width,
        height,
        squareSize,
      );

      const texImageCalls = (mockGL.texImage2D as any).mock.calls;
      const uploadCall = texImageCalls.find(
        (call: any[]) => call[8] instanceof Uint8Array,
      );
      const data = uploadCall[8] as Uint8Array;

      // Square (0,0) - white
      const offset00 = 0 * width * 4 + 0 * 4;
      expect(data[offset00]).toBe(255);

      // Square (1,0) - black
      const offset10 = 0 * width * 4 + squareSize * 4;
      expect(data[offset10]).toBe(0);

      // Square (0,1) - black
      const offset01 = squareSize * width * 4 + 0 * 4;
      expect(data[offset01]).toBe(0);

      // Square (1,1) - white
      const offset11 = squareSize * width * 4 + squareSize * 4;
      expect(data[offset11]).toBe(255);
    });
  });

  describe("createGradient", () => {
    it("should create a gradient texture", () => {
      const width = 64;
      const height = 64;

      const texture = Texture.createGradient(mockGL, width, height);

      expect(mockGL.createTexture).toHaveBeenCalled();

      const texImageCalls = (mockGL.texImage2D as any).mock.calls;
      const uploadCall = texImageCalls.find(
        (call: any[]) => call[8] instanceof Uint8Array,
      );
      const data = uploadCall[8] as Uint8Array;

      // Left edge should have low red (0)
      const leftOffset = 0;
      expect(data[leftOffset]).toBeLessThan(10); // Near 0

      // Right edge should have high red (255)
      const rightOffset = (width - 1) * 4;
      expect(data[rightOffset]).toBeGreaterThan(245); // Near 255

      // Top edge should have low green (0)
      const topOffset = 0;
      expect(data[topOffset + 1]).toBeLessThan(10); // Near 0

      // Bottom edge should have high green (255)
      const bottomOffset = (height - 1) * width * 4;
      expect(data[bottomOffset + 1]).toBeGreaterThan(245); // Near 255

      // Blue should be constant 128
      expect(data[topOffset + 2]).toBe(128);
      expect(data[rightOffset + 2]).toBe(128);

      // Alpha should be 255
      expect(data[topOffset + 3]).toBe(255);
      expect(data[bottomOffset + 3]).toBe(255);
    });
  });

  describe("bind", () => {
    it("should bind texture to default unit 0", () => {
      const texture = new Texture(mockGL, 64, 64);
      const handle = texture.getHandle();

      texture.bind();

      expect(mockGL.activeTexture).toHaveBeenCalledWith(mockGL.TEXTURE0);
      expect(mockGL.bindTexture).toHaveBeenCalledWith(
        mockGL.TEXTURE_2D,
        handle,
      );
    });

    it("should bind texture to specified unit", () => {
      const texture = new Texture(mockGL, 64, 64);

      const handle = texture.getHandle();

      texture.bind(1);
      expect(mockGL.activeTexture).toHaveBeenCalledWith(mockGL.TEXTURE1);
      expect(mockGL.bindTexture).toHaveBeenCalledWith(
        mockGL.TEXTURE_2D,
        handle,
      );

      texture.bind(2);
      expect(mockGL.activeTexture).toHaveBeenCalledWith(mockGL.TEXTURE2);
      expect(mockGL.bindTexture).toHaveBeenCalledWith(
        mockGL.TEXTURE_2D,
        handle,
      );
    });
  });

  describe("unbind", () => {
    it("should unbind texture (line 216)", () => {
      const texture = new Texture(mockGL, 64, 64);

      texture.unbind();

      expect(mockGL.bindTexture).toHaveBeenCalledWith(
        mockGL.TEXTURE_2D,
        null,
      );
    });

    it("should unbind after binding", () => {
      const texture = new Texture(mockGL, 64, 64);

      texture.bind();
      texture.unbind();

      const bindCalls = (mockGL.bindTexture as any).mock.calls;
      expect(bindCalls[bindCalls.length - 1]).toEqual([
        mockGL.TEXTURE_2D,
        null,
      ]);
    });
  });

  describe("getHandle", () => {
    it("should return the WebGL texture handle (line 222)", () => {
      const texture = new Texture(mockGL, 64, 64);

      const handle = texture.getHandle();

      expect(handle).toBeDefined();
      expect(handle).toHaveProperty("id");
    });

    it("should return the same handle on multiple calls", () => {
      const texture = new Texture(mockGL, 64, 64);

      const handle1 = texture.getHandle();
      const handle2 = texture.getHandle();

      expect(handle1).toBe(handle2);
    });
  });

  describe("getDimensions", () => {
    it("should return texture dimensions (line 229)", () => {
      const width = 128;
      const height = 256;
      const texture = new Texture(mockGL, width, height);

      const dimensions = texture.getDimensions();

      expect(dimensions).toEqual({ width, height });
    });

    it("should return consistent dimensions", () => {
      const texture = new Texture(mockGL, 64, 32);

      const dims1 = texture.getDimensions();
      const dims2 = texture.getDimensions();

      expect(dims1).toEqual(dims2);
      expect(dims1.width).toBe(64);
      expect(dims1.height).toBe(32);
    });
  });

  describe("dispose", () => {
    it("should delete the texture (line 236)", () => {
      const texture = new Texture(mockGL, 64, 64);
      const handle = texture.getHandle();

      texture.dispose();

      expect(mockGL.deleteTexture).toHaveBeenCalledWith(handle);
    });

    it("should be safe to call dispose multiple times", () => {
      const texture = new Texture(mockGL, 64, 64);

      texture.dispose();
      texture.dispose();
      texture.dispose();

      expect(mockGL.deleteTexture).toHaveBeenCalledTimes(3);
    });
  });

  describe("ITexture interface", () => {
    it("should satisfy ITexture interface", () => {
      const texture: ITexture = new Texture(mockGL, 64, 64);

      expect(texture.bind).toBeDefined();
      expect(texture.unbind).toBeDefined();
      expect(texture.getHandle).toBeDefined();
      expect(texture.getDimensions).toBeDefined();
      expect(texture.dispose).toBeDefined();
    });

    it("should work with interface methods", () => {
      const texture: ITexture = new Texture(mockGL, 64, 64);

      texture.bind(0);
      texture.unbind();
      const handle = texture.getHandle();
      const dims = texture.getDimensions();
      texture.dispose();

      expect(handle).toBeDefined();
      expect(dims).toEqual({ width: 64, height: 64 });
    });
  });

  describe("integration tests", () => {
    it("should create, bind, use, and dispose a texture", () => {
      const texture = new Texture(mockGL, 64, 64, new Uint8Array(64 * 64 * 4));

      // Bind and use
      texture.bind(0);
      const handle = texture.getHandle();
      const dims = texture.getDimensions();

      expect(handle).toBeDefined();
      expect(dims.width).toBe(64);

      // Unbind
      texture.unbind();

      // Cleanup
      texture.dispose();
      expect(mockGL.deleteTexture).toHaveBeenCalled();
    });

    it("should create multiple textures with different patterns", () => {
      const solid = Texture.createSolid(mockGL, 32, 32, 255, 0, 0);
      const checkerboard = Texture.createCheckerboard(mockGL, 32, 32);
      const gradient = Texture.createGradient(mockGL, 32, 32);

      expect(solid.getHandle()).toBeDefined();
      expect(checkerboard.getHandle()).toBeDefined();
      expect(gradient.getHandle()).toBeDefined();

      // All should have different texture handles
      expect(solid.getHandle()).not.toBe(checkerboard.getHandle());
    });
  });

  describe("edge cases", () => {
    it("should handle 1x1 texture", () => {
      const data = new Uint8Array([255, 0, 0, 255]);
      const texture = new Texture(mockGL, 1, 1, data);

      expect(texture.getDimensions()).toEqual({ width: 1, height: 1 });
    });

    it("should handle large textures", () => {
      const width = 2048;
      const height = 2048;
      const texture = new Texture(mockGL, width, height);

      expect(texture.getDimensions()).toEqual({ width, height });
    });

    it("should handle zero alpha in solid texture", () => {
      const texture = Texture.createSolid(mockGL, 16, 16, 255, 255, 255, 0);

      const texImageCalls = (mockGL.texImage2D as any).mock.calls;
      const uploadCall = texImageCalls.find(
        (call: any[]) => call[8] instanceof Uint8Array,
      );
      const data = uploadCall[8] as Uint8Array;

      expect(data[3]).toBe(0); // Alpha should be 0
    });

    it("should handle full white and full black in checkerboard", () => {
      const texture = Texture.createCheckerboard(mockGL, 32, 32, 16);

      const texImageCalls = (mockGL.texImage2D as any).mock.calls;

      // texImage2D should have been called with actual data
      expect(texImageCalls.length).toBeGreaterThan(0);

      // The last call should have the data (from createCheckerboard's Texture constructor)
      const lastCall = texImageCalls[texImageCalls.length - 1];
      expect(lastCall).toBeDefined();

      // The 9th parameter (index 8) should be the pixel data
      const data = lastCall[8];
      expect(data).toBeInstanceOf(Uint8Array);

      // Find white pixel (RGB all 255)
      let foundWhite = false;
      let foundBlack = false;

      for (let i = 0; i < data.length; i += 4) {
        if (data[i] === 255 && data[i + 1] === 255 && data[i + 2] === 255) {
          foundWhite = true;
        }
        if (data[i] === 0 && data[i + 1] === 0 && data[i + 2] === 0) {
          foundBlack = true;
        }
      }

      expect(foundWhite).toBe(true);
      expect(foundBlack).toBe(true);
    });
  });
});
