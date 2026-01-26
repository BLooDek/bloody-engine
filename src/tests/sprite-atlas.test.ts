/**
 * Sprite Atlas System Unit Tests
 *
 * Comprehensive tests for Sprite, TextureAtlas, and AtlasLoader:
 * - Sprite class (properties, UV rects, pixel rects, aspect ratio)
 * - TextureAtlas class (sprite definition, retrieval, management)
 * - UV coordinate calculation from pixel coordinates
 * - Pixel coordinate calculation from UV coordinates
 * - Grid-based sprite definitions
 * - JSON serialization/deserialization
 * - AtlasLoader utility methods
 * - Error handling for invalid coordinates
 * - Edge cases (boundary conditions, empty atlases, etc.)
 *
 * Run with: npm run test -- sprite-atlas
 */

import { describe, it, expect, beforeEach, vi } from "vitest";
import {
  Sprite,
  TextureAtlas,
  AtlasLoader,
  type UVRect,
  type PixelRect,
  type SpriteInfo,
  type AtlasOptions,
} from "../core/sprite-atlas";
import type { Texture } from "../core/texture";

// Mock Texture implementation
class MockTexture implements Texture {
  private width: number;
  private height: number;

  constructor(width: number, height: number) {
    this.width = width;
    this.height = height;
  }

  bind(unit?: number): void {
    // Mock implementation
  }

  unbind(): void {
    // Mock implementation
  }

  getHandle(): WebGLTexture {
    return {} as WebGLTexture;
  }

  getDimensions(): { width: number; height: number } {
    return { width: this.width, height: this.height };
  }
}

describe("Sprite", () => {
  describe("Constructor and Initialization", () => {
    it("should create a sprite with valid SpriteInfo", () => {
      const spriteInfo: SpriteInfo = {
        name: "test_sprite",
        uvRect: { uMin: 0, vMin: 0, uMax: 0.5, vMax: 0.5 },
        pixelRect: { x: 0, y: 0, width: 64, height: 64 },
        width: 64,
        height: 64,
      };

      const sprite = new Sprite(spriteInfo);

      expect(sprite.getName()).toBe("test_sprite");
      expect(sprite.getWidth()).toBe(64);
      expect(sprite.getHeight()).toBe(64);
    });

    it("should create sprites with different dimensions", () => {
      const sizes = [
        { w: 16, h: 16 },
        { w: 32, h: 32 },
        { w: 64, h: 64 },
        { w: 128, h: 128 },
        { w: 256, h: 256 },
      ];

      sizes.forEach(({ w, h }) => {
        const spriteInfo: SpriteInfo = {
          name: `sprite_${w}x${h}`,
          uvRect: { uMin: 0, vMin: 0, uMax: 1, vMax: 1 },
          pixelRect: { x: 0, y: 0, width: w, height: h },
          width: w,
          height: h,
        };

        const sprite = new Sprite(spriteInfo);
        expect(sprite.getWidth()).toBe(w);
        expect(sprite.getHeight()).toBe(h);
      });
    });

    it("should create sprites with fractional dimensions", () => {
      const spriteInfo: SpriteInfo = {
        name: "fractional_sprite",
        uvRect: { uMin: 0, vMin: 0, uMax: 0.333, vMax: 0.666 },
        pixelRect: { x: 0, y: 0, width: 32, height: 64 },
        width: 32,
        height: 64,
      };

      const sprite = new Sprite(spriteInfo);
      expect(sprite.getWidth()).toBe(32);
      expect(sprite.getHeight()).toBe(64);
    });
  });

  describe("getName", () => {
    it("should return the sprite name", () => {
      const spriteInfo: SpriteInfo = {
        name: "player_idle_1",
        uvRect: { uMin: 0, vMin: 0, uMax: 0.25, vMax: 0.25 },
        pixelRect: { x: 0, y: 0, width: 32, height: 32 },
        width: 32,
        height: 32,
      };

      const sprite = new Sprite(spriteInfo);
      expect(sprite.getName()).toBe("player_idle_1");
    });

    it("should return unique names for different sprites", () => {
      const names = ["sprite_a", "sprite_b", "sprite_c"];

      const sprites = names.map((name) => {
        const info: SpriteInfo = {
          name,
          uvRect: { uMin: 0, vMin: 0, uMax: 1, vMax: 1 },
          pixelRect: { x: 0, y: 0, width: 32, height: 32 },
          width: 32,
          height: 32,
        };
        return new Sprite(info);
      });

      expect(sprites[0].getName()).toBe("sprite_a");
      expect(sprites[1].getName()).toBe("sprite_b");
      expect(sprites[2].getName()).toBe("sprite_c");
    });
  });

  describe("getUVRect", () => {
    it("should return UV coordinates", () => {
      const uvRect: UVRect = { uMin: 0.1, vMin: 0.2, uMax: 0.3, vMax: 0.4 };
      const spriteInfo: SpriteInfo = {
        name: "test",
        uvRect,
        pixelRect: { x: 0, y: 0, width: 32, height: 32 },
        width: 32,
        height: 32,
      };

      const sprite = new Sprite(spriteInfo);
      const result = sprite.getUVRect();

      expect(result.uMin).toBe(0.1);
      expect(result.vMin).toBe(0.2);
      expect(result.uMax).toBe(0.3);
      expect(result.vMax).toBe(0.4);
    });

    it("should return a copy of UV rect (not the same object)", () => {
      const uvRect: UVRect = { uMin: 0, vMin: 0, uMax: 0.5, vMax: 0.5 };
      const spriteInfo: SpriteInfo = {
        name: "test",
        uvRect,
        pixelRect: { x: 0, y: 0, width: 32, height: 32 },
        width: 32,
        height: 32,
      };

      const sprite = new Sprite(spriteInfo);
      const result1 = sprite.getUVRect();
      const result2 = sprite.getUVRect();

      expect(result1).not.toBe(result2);
      expect(result1).toEqual(result2);
    });

    it("should handle full texture UV coordinates", () => {
      const spriteInfo: SpriteInfo = {
        name: "full_texture",
        uvRect: { uMin: 0, vMin: 0, uMax: 1, vMax: 1 },
        pixelRect: { x: 0, y: 0, width: 256, height: 256 },
        width: 256,
        height: 256,
      };

      const sprite = new Sprite(spriteInfo);
      const uv = sprite.getUVRect();

      expect(uv.uMin).toBe(0);
      expect(uv.vMin).toBe(0);
      expect(uv.uMax).toBe(1);
      expect(uv.vMax).toBe(1);
    });

    it("should handle small UV coordinates", () => {
      const spriteInfo: SpriteInfo = {
        name: "small_uv",
        uvRect: { uMin: 0.001, vMin: 0.001, uMax: 0.01, vMax: 0.01 },
        pixelRect: { x: 0, y: 0, width: 8, height: 8 },
        width: 8,
        height: 8,
      };

      const sprite = new Sprite(spriteInfo);
      const uv = sprite.getUVRect();

      expect(uv.uMin).toBe(0.001);
      expect(uv.vMin).toBe(0.001);
      expect(uv.uMax).toBe(0.01);
      expect(uv.vMax).toBe(0.01);
    });
  });

  describe("getPixelRect", () => {
    it("should return pixel coordinates", () => {
      const pixelRect: PixelRect = { x: 10, y: 20, width: 32, height: 64 };
      const spriteInfo: SpriteInfo = {
        name: "test",
        uvRect: { uMin: 0, vMin: 0, uMax: 1, vMax: 1 },
        pixelRect,
        width: 32,
        height: 64,
      };

      const sprite = new Sprite(spriteInfo);
      const result = sprite.getPixelRect();

      expect(result.x).toBe(10);
      expect(result.y).toBe(20);
      expect(result.width).toBe(32);
      expect(result.height).toBe(64);
    });

    it("should return a copy of pixel rect (not the same object)", () => {
      const pixelRect: PixelRect = { x: 0, y: 0, width: 32, height: 32 };
      const spriteInfo: SpriteInfo = {
        name: "test",
        uvRect: { uMin: 0, vMin: 0, uMax: 1, vMax: 1 },
        pixelRect,
        width: 32,
        height: 32,
      };

      const sprite = new Sprite(spriteInfo);
      const result1 = sprite.getPixelRect();
      const result2 = sprite.getPixelRect();

      expect(result1).not.toBe(result2);
      expect(result1).toEqual(result2);
    });

    it("should handle Y-up coordinate system", () => {
      const pixelRect: PixelRect = { x: 0, y: 100, width: 32, height: 32 };
      const spriteInfo: SpriteInfo = {
        name: "test",
        uvRect: { uMin: 0, vMin: 0, uMax: 1, vMax: 1 },
        pixelRect,
        width: 32,
        height: 32,
      };

      const sprite = new Sprite(spriteInfo);
      const result = sprite.getPixelRect();

      expect(result.y).toBe(100);
    });
  });

  describe("getWidth and getHeight", () => {
    it("should return correct width and height", () => {
      const spriteInfo: SpriteInfo = {
        name: "test",
        uvRect: { uMin: 0, vMin: 0, uMax: 1, vMax: 1 },
        pixelRect: { x: 0, y: 0, width: 128, height: 256 },
        width: 128,
        height: 256,
      };

      const sprite = new Sprite(spriteInfo);
      expect(sprite.getWidth()).toBe(128);
      expect(sprite.getHeight()).toBe(256);
    });

    it("should handle square sprites", () => {
      const spriteInfo: SpriteInfo = {
        name: "square",
        uvRect: { uMin: 0, vMin: 0, uMax: 0.5, vMax: 0.5 },
        pixelRect: { x: 0, y: 0, width: 64, height: 64 },
        width: 64,
        height: 64,
      };

      const sprite = new Sprite(spriteInfo);
      expect(sprite.getWidth()).toBe(sprite.getHeight());
    });

    it("should handle wide sprites", () => {
      const spriteInfo: SpriteInfo = {
        name: "wide",
        uvRect: { uMin: 0, vMin: 0, uMax: 0.8, vMax: 0.2 },
        pixelRect: { x: 0, y: 0, width: 128, height: 32 },
        width: 128,
        height: 32,
      };

      const sprite = new Sprite(spriteInfo);
      expect(sprite.getWidth()).toBeGreaterThan(sprite.getHeight());
    });

    it("should handle tall sprites", () => {
      const spriteInfo: SpriteInfo = {
        name: "tall",
        uvRect: { uMin: 0, vMin: 0, uMax: 0.2, vMax: 0.8 },
        pixelRect: { x: 0, y: 0, width: 32, height: 128 },
        width: 32,
        height: 128,
      };

      const sprite = new Sprite(spriteInfo);
      expect(sprite.getHeight()).toBeGreaterThan(sprite.getWidth());
    });
  });

  describe("getAspectRatio", () => {
    it("should calculate aspect ratio for square sprite", () => {
      const spriteInfo: SpriteInfo = {
        name: "square",
        uvRect: { uMin: 0, vMin: 0, uMax: 1, vMax: 1 },
        pixelRect: { x: 0, y: 0, width: 64, height: 64 },
        width: 64,
        height: 64,
      };

      const sprite = new Sprite(spriteInfo);
      expect(sprite.getAspectRatio()).toBe(1);
    });

    it("should calculate aspect ratio for wide sprite", () => {
      const spriteInfo: SpriteInfo = {
        name: "wide",
        uvRect: { uMin: 0, vMin: 0, uMax: 1, vMax: 1 },
        pixelRect: { x: 0, y: 0, width: 128, height: 32 },
        width: 128,
        height: 32,
      };

      const sprite = new Sprite(spriteInfo);
      expect(sprite.getAspectRatio()).toBe(4);
    });

    it("should calculate aspect ratio for tall sprite", () => {
      const spriteInfo: SpriteInfo = {
        name: "tall",
        uvRect: { uMin: 0, vMin: 0, uMax: 1, vMax: 1 },
        pixelRect: { x: 0, y: 0, width: 32, height: 128 },
        width: 32,
        height: 128,
      };

      const sprite = new Sprite(spriteInfo);
      expect(sprite.getAspectRatio()).toBe(0.25);
    });

    it("should handle fractional aspect ratios", () => {
      const spriteInfo: SpriteInfo = {
        name: "fractional",
        uvRect: { uMin: 0, vMin: 0, uMax: 1, vMax: 1 },
        pixelRect: { x: 0, y: 0, width: 100, height: 75 },
        width: 100,
        height: 75,
      };

      const sprite = new Sprite(spriteInfo);
      expect(sprite.getAspectRatio()).toBeCloseTo(1.333, 3);
    });
  });

  describe("toQuadUVRect", () => {
    it("should return UV rect in correct format for SpriteQuadInstance", () => {
      const spriteInfo: SpriteInfo = {
        name: "test",
        uvRect: { uMin: 0.1, vMin: 0.2, uMax: 0.3, vMax: 0.4 },
        pixelRect: { x: 0, y: 0, width: 32, height: 32 },
        width: 32,
        height: 32,
      };

      const sprite = new Sprite(spriteInfo);
      const quadUV = sprite.toQuadUVRect();

      expect(quadUV.uMin).toBe(0.1);
      expect(quadUV.vMin).toBe(0.2);
      expect(quadUV.uMax).toBe(0.3);
      expect(quadUV.vMax).toBe(0.4);
    });

    it("should handle full texture UV coordinates", () => {
      const spriteInfo: SpriteInfo = {
        name: "full",
        uvRect: { uMin: 0, vMin: 0, uMax: 1, vMax: 1 },
        pixelRect: { x: 0, y: 0, width: 256, height: 256 },
        width: 256,
        height: 256,
      };

      const sprite = new Sprite(spriteInfo);
      const quadUV = sprite.toQuadUVRect();

      expect(quadUV.uMin).toBe(0);
      expect(quadUV.vMin).toBe(0);
      expect(quadUV.uMax).toBe(1);
      expect(quadUV.vMax).toBe(1);
    });
  });

  describe("toString", () => {
    it("should return string representation with name and dimensions", () => {
      const spriteInfo: SpriteInfo = {
        name: "player",
        uvRect: { uMin: 0, vMin: 0, uMax: 0.5, vMax: 0.5 },
        pixelRect: { x: 0, y: 0, width: 32, height: 32 },
        width: 32,
        height: 32,
      };

      const sprite = new Sprite(spriteInfo);
      expect(sprite.toString()).toBe('Sprite("player", 32x32)');
    });

    it("should handle different sprite names", () => {
      const spriteInfo: SpriteInfo = {
        name: "enemy_type_1",
        uvRect: { uMin: 0, vMin: 0, uMax: 1, vMax: 1 },
        pixelRect: { x: 0, y: 0, width: 64, height: 64 },
        width: 64,
        height: 64,
      };

      const sprite = new Sprite(spriteInfo);
      expect(sprite.toString()).toBe('Sprite("enemy_type_1", 64x64)');
    });
  });
});

describe("TextureAtlas", () => {
  let mockTexture: MockTexture;

  beforeEach(() => {
    mockTexture = new MockTexture(512, 512);
  });

  describe("Constructor and Initialization", () => {
    it("should create atlas with auto-detected dimensions", () => {
      const atlas = new TextureAtlas({ texture: mockTexture });

      const dims = atlas.getTextureDimensions();
      expect(dims.width).toBe(512);
      expect(dims.height).toBe(512);
    });

    it("should create atlas with explicit dimensions", () => {
      const atlas = new TextureAtlas({
        texture: mockTexture,
        textureWidth: 256,
        textureHeight: 256,
      });

      const dims = atlas.getTextureDimensions();
      expect(dims.width).toBe(256);
      expect(dims.height).toBe(256);
    });

    it("should start with empty sprite collection", () => {
      const atlas = new TextureAtlas({ texture: mockTexture });

      expect(atlas.getSpriteCount()).toBe(0);
      expect(atlas.getSpriteNames()).toEqual([]);
    });

    it("should use auto-detected dimensions when explicit dimensions are undefined", () => {
      const atlas = new TextureAtlas({
        texture: mockTexture,
        textureWidth: undefined,
        textureHeight: undefined,
      });

      const dims = atlas.getTextureDimensions();
      expect(dims.width).toBe(512);
      expect(dims.height).toBe(512);
    });

    it("should create atlases with different texture sizes", () => {
      const sizes = [
        { w: 256, h: 256 },
        { w: 512, h: 512 },
        { w: 1024, h: 1024 },
        { w: 2048, h: 2048 },
      ];

      sizes.forEach(({ w, h }) => {
        const texture = new MockTexture(w, h);
        const atlas = new TextureAtlas({ texture });
        const dims = atlas.getTextureDimensions();

        expect(dims.width).toBe(w);
        expect(dims.height).toBe(h);
      });
    });
  });

  describe("getTexture and getTextureDimensions", () => {
    it("should return the underlying texture", () => {
      const atlas = new TextureAtlas({ texture: mockTexture });

      expect(atlas.getTexture()).toBe(mockTexture);
    });

    it("should return correct texture dimensions", () => {
      const atlas = new TextureAtlas({ texture: mockTexture });

      const dims = atlas.getTextureDimensions();
      expect(dims).toEqual({ width: 512, height: 512 });
    });

    it("should return dimensions matching explicit constructor parameters", () => {
      const atlas = new TextureAtlas({
        texture: mockTexture,
        textureWidth: 1024,
        textureHeight: 768,
      });

      const dims = atlas.getTextureDimensions();
      expect(dims.width).toBe(1024);
      expect(dims.height).toBe(768);
    });
  });

  describe("defineSprite (Pixel Coordinates)", () => {
    it("should define a sprite with pixel coordinates", () => {
      const atlas = new TextureAtlas({ texture: mockTexture });

      const sprite = atlas.defineSprite("test", {
        x: 0,
        y: 0,
        width: 32,
        height: 32,
      });

      expect(sprite.getName()).toBe("test");
      expect(sprite.getWidth()).toBe(32);
      expect(sprite.getHeight()).toBe(32);
    });

    it("should calculate UV coordinates from pixel coordinates", () => {
      const atlas = new TextureAtlas({ texture: mockTexture });

      const sprite = atlas.defineSprite("test", {
        x: 0,
        y: 0,
        width: 256,
        height: 256,
      });
      const uv = sprite.getUVRect();

      // 256/512 = 0.5
      expect(uv.uMin).toBe(0);
      expect(uv.vMin).toBe(0);
      expect(uv.uMax).toBe(0.5);
      expect(uv.vMax).toBe(0.5);
    });

    it("should handle sprites at different positions", () => {
      const atlas = new TextureAtlas({ texture: mockTexture });

      atlas.defineSprite("sprite1", { x: 0, y: 0, width: 32, height: 32 });
      atlas.defineSprite("sprite2", { x: 32, y: 0, width: 32, height: 32 });
      atlas.defineSprite("sprite3", { x: 0, y: 32, width: 32, height: 32 });

      expect(atlas.getSpriteCount()).toBe(3);
      expect(atlas.hasSprite("sprite1")).toBe(true);
      expect(atlas.hasSprite("sprite2")).toBe(true);
      expect(atlas.hasSprite("sprite3")).toBe(true);
    });

    it("should warn when overwriting existing sprite", () => {
      const atlas = new TextureAtlas({ texture: mockTexture });
      const consoleWarnSpy = vi.spyOn(console, "warn");

      atlas.defineSprite("test", { x: 0, y: 0, width: 32, height: 32 });
      atlas.defineSprite("test", { x: 32, y: 32, width: 32, height: 32 });

      expect(consoleWarnSpy).toHaveBeenCalledWith(
        'Sprite "test" already exists in atlas, overwriting.',
      );
      expect(atlas.getSpriteCount()).toBe(1);

      consoleWarnSpy.mockRestore();
    });

    it("should throw error for negative pixel coordinates", () => {
      const atlas = new TextureAtlas({ texture: mockTexture });

      expect(() => {
        atlas.defineSprite("invalid", { x: -10, y: 0, width: 32, height: 32 });
      }).toThrow('Invalid pixel rect for sprite "invalid"');
    });

    it("should throw error for zero or negative dimensions", () => {
      const atlas = new TextureAtlas({ texture: mockTexture });

      expect(() => {
        atlas.defineSprite("invalid", { x: 0, y: 0, width: 0, height: 32 });
      }).toThrow("Invalid pixel rect");

      expect(() => {
        atlas.defineSprite("invalid", { x: 0, y: 0, width: 32, height: 0 });
      }).toThrow("Invalid pixel rect");

      expect(() => {
        atlas.defineSprite("invalid", { x: 0, y: 0, width: -32, height: 32 });
      }).toThrow("Invalid pixel rect");
    });

    it("should throw error when sprite extends beyond texture bounds", () => {
      const atlas = new TextureAtlas({ texture: mockTexture });

      expect(() => {
        atlas.defineSprite("overflow", { x: 500, y: 0, width: 32, height: 32 });
      }).toThrow('Sprite "overflow" extends beyond texture bounds');

      expect(() => {
        atlas.defineSprite("overflow", { x: 0, y: 500, width: 32, height: 32 });
      }).toThrow('Sprite "overflow" extends beyond texture bounds');

      expect(() => {
        atlas.defineSprite("overflow", { x: 0, y: 0, width: 600, height: 32 });
      }).toThrow('Sprite "overflow" extends beyond texture bounds');
    });

    it("should allow sprites at texture edge", () => {
      const atlas = new TextureAtlas({ texture: mockTexture });

      const sprite = atlas.defineSprite("edge", {
        x: 480,
        y: 480,
        width: 32,
        height: 32,
      });

      expect(sprite.getWidth()).toBe(32);
      expect(sprite.getHeight()).toBe(32);
    });

    it("should handle sprites with fractional pixel positions", () => {
      const atlas = new TextureAtlas({
        texture: mockTexture,
        textureWidth: 512,
        textureHeight: 512,
      });

      const sprite = atlas.defineSprite("fractional", {
        x: 10.5,
        y: 20.5,
        width: 32,
        height: 32,
      });

      const pixel = sprite.getPixelRect();
      expect(pixel.x).toBe(10.5);
      expect(pixel.y).toBe(20.5);
    });
  });

  describe("defineGrid", () => {
    it("should define a grid of sprites", () => {
      const atlas = new TextureAtlas({ texture: mockTexture });

      const names = atlas.defineGrid("tile_", 0, 0, 32, 32, 4, 4);

      expect(names.length).toBe(16);
      expect(atlas.getSpriteCount()).toBe(16);
      expect(names).toContain("tile_0_0");
      expect(names).toContain("tile_3_3");
    });

    it("should name sprites correctly with column and row indices", () => {
      const atlas = new TextureAtlas({ texture: mockTexture });

      const names = atlas.defineGrid("sprite_", 0, 0, 32, 32, 3, 2);

      expect(names).toEqual([
        "sprite_0_0",
        "sprite_1_0",
        "sprite_2_0",
        "sprite_0_1",
        "sprite_1_1",
        "sprite_2_1",
      ]);
    });

    it("should position sprites correctly in grid", () => {
      const atlas = new TextureAtlas({ texture: mockTexture });

      atlas.defineGrid("tile_", 0, 0, 32, 32, 3, 3);

      const tile00 = atlas.getSprite("tile_0_0");
      const tile10 = atlas.getSprite("tile_1_0");
      const tile01 = atlas.getSprite("tile_0_1");

      expect(tile00?.getPixelRect()).toEqual({
        x: 0,
        y: 0,
        width: 32,
        height: 32,
      });
      expect(tile10?.getPixelRect()).toEqual({
        x: 32,
        y: 0,
        width: 32,
        height: 32,
      });
      expect(tile01?.getPixelRect()).toEqual({
        x: 0,
        y: 32,
        width: 32,
        height: 32,
      });
    });

    it("should handle column spacing", () => {
      const atlas = new TextureAtlas({ texture: mockTexture });

      atlas.defineGrid("tile_", 0, 0, 32, 32, 3, 2, 4, 0);

      const tile0 = atlas.getSprite("tile_0_0");
      const tile1 = atlas.getSprite("tile_1_0");
      const tile2 = atlas.getSprite("tile_2_0");

      expect(tile0?.getPixelRect().x).toBe(0);
      expect(tile1?.getPixelRect().x).toBe(36); // 32 + 4
      expect(tile2?.getPixelRect().x).toBe(72); // 32 + 4 + 32 + 4
    });

    it("should handle row spacing", () => {
      const atlas = new TextureAtlas({ texture: mockTexture });

      atlas.defineGrid("tile_", 0, 0, 32, 32, 2, 3, 0, 8);

      const tile0 = atlas.getSprite("tile_0_0");
      const tile1 = atlas.getSprite("tile_0_1");
      const tile2 = atlas.getSprite("tile_0_2");

      expect(tile0?.getPixelRect().y).toBe(0);
      expect(tile1?.getPixelRect().y).toBe(40); // 32 + 8
      expect(tile2?.getPixelRect().y).toBe(80); // 32 + 8 + 32 + 8
    });

    it("should handle both column and row spacing", () => {
      const atlas = new TextureAtlas({ texture: mockTexture });

      atlas.defineGrid("tile_", 10, 20, 32, 32, 2, 2, 5, 10);

      const tile00 = atlas.getSprite("tile_0_0");
      const tile10 = atlas.getSprite("tile_1_0");
      const tile01 = atlas.getSprite("tile_0_1");

      expect(tile00?.getPixelRect()).toEqual({
        x: 10,
        y: 20,
        width: 32,
        height: 32,
      });
      expect(tile10?.getPixelRect()).toEqual({
        x: 47,
        y: 20,
        width: 32,
        height: 32,
      }); // 10 + 32 + 5
      expect(tile01?.getPixelRect()).toEqual({
        x: 10,
        y: 62,
        width: 32,
        height: 32,
      }); // 20 + 32 + 10
    });

    it("should handle grids with different sprite sizes", () => {
      const atlas = new TextureAtlas({ texture: mockTexture });

      const sizes = [
        { w: 16, h: 16 },
        { w: 32, h: 32 },
        { w: 64, h: 64 },
      ];

      sizes.forEach(({ w, h }) => {
        const prefix = `sprite_${w}x${h}_`;
        const names = atlas.defineGrid(prefix, 0, 0, w, h, 2, 2);

        expect(names.length).toBe(4);
        const sprite = atlas.getSprite(names[0]);
        expect(sprite?.getWidth()).toBe(w);
        expect(sprite?.getHeight()).toBe(h);
      });
    });

    it("should handle grids starting at non-zero positions", () => {
      const atlas = new TextureAtlas({ texture: mockTexture });

      const names = atlas.defineGrid("tile_", 100, 200, 32, 32, 2, 2);

      const tile00 = atlas.getSprite("tile_0_0");
      const tile11 = atlas.getSprite("tile_1_1");

      expect(tile00?.getPixelRect()).toEqual({
        x: 100,
        y: 200,
        width: 32,
        height: 32,
      });
      expect(tile11?.getPixelRect()).toEqual({
        x: 132,
        y: 232,
        width: 32,
        height: 32,
      });
    });
  });

  describe("defineSpriteUV (UV Coordinates)", () => {
    it("should define a sprite with UV coordinates", () => {
      const atlas = new TextureAtlas({ texture: mockTexture });

      const sprite = atlas.defineSpriteUV("test", {
        uMin: 0,
        vMin: 0,
        uMax: 0.5,
        vMax: 0.5,
      });

      expect(sprite.getName()).toBe("test");
      const uv = sprite.getUVRect();
      expect(uv.uMin).toBe(0);
      expect(uv.vMin).toBe(0);
      expect(uv.uMax).toBe(0.5);
      expect(uv.vMax).toBe(0.5);
    });

    it("should calculate pixel coordinates from UV coordinates", () => {
      const atlas = new TextureAtlas({ texture: mockTexture });

      const sprite = atlas.defineSpriteUV(
        "test",
        { uMin: 0, vMin: 0, uMax: 0.5, vMax: 0.5 },
        256,
        256,
      );

      const pixel = sprite.getPixelRect();
      expect(pixel.x).toBe(0);
      expect(pixel.y).toBe(0);
      expect(pixel.width).toBe(256);
      expect(pixel.height).toBe(256);
    });

    it("should auto-calculate pixel dimensions when not provided", () => {
      const atlas = new TextureAtlas({ texture: mockTexture });

      const sprite = atlas.defineSpriteUV("test", {
        uMin: 0,
        vMin: 0,
        uMax: 0.25,
        vMax: 0.25,
      });

      // 0.25 * 512 = 128
      expect(sprite.getWidth()).toBe(128);
      expect(sprite.getHeight()).toBe(128);
    });

    it("should warn when overwriting existing sprite", () => {
      const atlas = new TextureAtlas({ texture: mockTexture });
      const consoleWarnSpy = vi.spyOn(console, "warn");

      atlas.defineSpriteUV("test", { uMin: 0, vMin: 0, uMax: 0.5, vMax: 0.5 });
      atlas.defineSpriteUV("test", { uMin: 0.5, vMin: 0, uMax: 1, vMax: 0.5 });

      expect(consoleWarnSpy).toHaveBeenCalledWith(
        'Sprite "test" already exists in atlas, overwriting.',
      );

      consoleWarnSpy.mockRestore();
    });

    it("should throw error for UV coordinates outside 0-1 range", () => {
      const atlas = new TextureAtlas({ texture: mockTexture });

      expect(() => {
        atlas.defineSpriteUV("invalid", {
          uMin: -0.1,
          vMin: 0,
          uMax: 0.5,
          vMax: 0.5,
        });
      }).toThrow("Invalid UV rect");

      expect(() => {
        atlas.defineSpriteUV("invalid", {
          uMin: 0,
          vMin: 0,
          uMax: 1.5,
          vMax: 0.5,
        });
      }).toThrow("Invalid UV rect");
    });

    it("should throw error when uMin >= uMax", () => {
      const atlas = new TextureAtlas({ texture: mockTexture });

      expect(() => {
        atlas.defineSpriteUV("invalid", {
          uMin: 0.5,
          vMin: 0,
          uMax: 0.5,
          vMax: 0.5,
        });
      }).toThrow("min must be less than max");

      expect(() => {
        atlas.defineSpriteUV("invalid", {
          uMin: 0.6,
          vMin: 0,
          uMax: 0.5,
          vMax: 0.5,
        });
      }).toThrow("min must be less than max");
    });

    it("should throw error when vMin >= vMax", () => {
      const atlas = new TextureAtlas({ texture: mockTexture });

      expect(() => {
        atlas.defineSpriteUV("invalid", {
          uMin: 0,
          vMin: 0.5,
          uMax: 0.5,
          vMax: 0.5,
        });
      }).toThrow("min must be less than max");

      expect(() => {
        atlas.defineSpriteUV("invalid", {
          uMin: 0,
          vMin: 0.6,
          uMax: 0.5,
          vMax: 0.5,
        });
      }).toThrow("min must be less than max");
    });

    it("should handle UV coordinates at texture boundaries", () => {
      const atlas = new TextureAtlas({ texture: mockTexture });

      const sprite = atlas.defineSpriteUV("full", {
        uMin: 0,
        vMin: 0,
        uMax: 1,
        vMax: 1,
      });

      const uv = sprite.getUVRect();
      expect(uv.uMin).toBe(0);
      expect(uv.vMin).toBe(0);
      expect(uv.uMax).toBe(1);
      expect(uv.vMax).toBe(1);
    });

    it("should handle small UV coordinates", () => {
      const atlas = new TextureAtlas({ texture: mockTexture });

      const sprite = atlas.defineSpriteUV("small", {
        uMin: 0.01,
        vMin: 0.01,
        uMax: 0.02,
        vMax: 0.02,
      });

      const uv = sprite.getUVRect();
      expect(uv.uMin).toBe(0.01);
      expect(uv.vMin).toBe(0.01);
      expect(uv.uMax).toBe(0.02);
      expect(uv.vMax).toBe(0.02);
    });
  });

  describe("getSprite", () => {
    it("should return defined sprite", () => {
      const atlas = new TextureAtlas({ texture: mockTexture });

      atlas.defineSprite("test", { x: 0, y: 0, width: 32, height: 32 });

      const sprite = atlas.getSprite("test");
      expect(sprite).toBeDefined();
      expect(sprite?.getName()).toBe("test");
    });

    it("should return undefined for non-existent sprite", () => {
      const atlas = new TextureAtlas({ texture: mockTexture });

      const sprite = atlas.getSprite("nonexistent");
      expect(sprite).toBeUndefined();
    });

    it("should return correct sprite when multiple exist", () => {
      const atlas = new TextureAtlas({ texture: mockTexture });

      atlas.defineSprite("sprite1", { x: 0, y: 0, width: 32, height: 32 });
      atlas.defineSprite("sprite2", { x: 32, y: 0, width: 32, height: 32 });
      atlas.defineSprite("sprite3", { x: 0, y: 32, width: 32, height: 32 });

      expect(atlas.getSprite("sprite1")?.getName()).toBe("sprite1");
      expect(atlas.getSprite("sprite2")?.getName()).toBe("sprite2");
      expect(atlas.getSprite("sprite3")?.getName()).toBe("sprite3");
    });
  });

  describe("hasSprite", () => {
    it("should return true for existing sprite", () => {
      const atlas = new TextureAtlas({ texture: mockTexture });

      atlas.defineSprite("test", { x: 0, y: 0, width: 32, height: 32 });

      expect(atlas.hasSprite("test")).toBe(true);
    });

    it("should return false for non-existent sprite", () => {
      const atlas = new TextureAtlas({ texture: mockTexture });

      expect(atlas.hasSprite("nonexistent")).toBe(false);
    });

    it("should return false after removing sprite", () => {
      const atlas = new TextureAtlas({ texture: mockTexture });

      atlas.defineSprite("test", { x: 0, y: 0, width: 32, height: 32 });
      expect(atlas.hasSprite("test")).toBe(true);

      atlas.removeSprite("test");
      expect(atlas.hasSprite("test")).toBe(false);
    });
  });

  describe("getSpriteNames", () => {
    it("should return empty array for empty atlas", () => {
      const atlas = new TextureAtlas({ texture: mockTexture });

      expect(atlas.getSpriteNames()).toEqual([]);
    });

    it("should return all sprite names", () => {
      const atlas = new TextureAtlas({ texture: mockTexture });

      atlas.defineSprite("sprite1", { x: 0, y: 0, width: 32, height: 32 });
      atlas.defineSprite("sprite2", { x: 32, y: 0, width: 32, height: 32 });
      atlas.defineSprite("sprite3", { x: 0, y: 32, width: 32, height: 32 });

      const names = atlas.getSpriteNames();
      expect(names).toContain("sprite1");
      expect(names).toContain("sprite2");
      expect(names).toContain("sprite3");
      expect(names.length).toBe(3);
    });

    it("should return names in insertion order", () => {
      const atlas = new TextureAtlas({ texture: mockTexture });

      atlas.defineSprite("first", { x: 0, y: 0, width: 32, height: 32 });
      atlas.defineSprite("second", { x: 32, y: 0, width: 32, height: 32 });
      atlas.defineSprite("third", { x: 0, y: 32, width: 32, height: 32 });

      expect(atlas.getSpriteNames()).toEqual(["first", "second", "third"]);
    });
  });

  describe("getSpriteCount", () => {
    it("should return 0 for empty atlas", () => {
      const atlas = new TextureAtlas({ texture: mockTexture });

      expect(atlas.getSpriteCount()).toBe(0);
    });

    it("should return correct count after adding sprites", () => {
      const atlas = new TextureAtlas({ texture: mockTexture });

      expect(atlas.getSpriteCount()).toBe(0);

      atlas.defineSprite("sprite1", { x: 0, y: 0, width: 32, height: 32 });
      expect(atlas.getSpriteCount()).toBe(1);

      atlas.defineSprite("sprite2", { x: 32, y: 0, width: 32, height: 32 });
      expect(atlas.getSpriteCount()).toBe(2);

      atlas.defineSprite("sprite3", { x: 0, y: 32, width: 32, height: 32 });
      expect(atlas.getSpriteCount()).toBe(3);
    });

    it("should not increase count when overwriting sprite", () => {
      const atlas = new TextureAtlas({ texture: mockTexture });

      atlas.defineSprite("test", { x: 0, y: 0, width: 32, height: 32 });
      expect(atlas.getSpriteCount()).toBe(1);

      atlas.defineSprite("test", { x: 32, y: 32, width: 32, height: 32 });
      expect(atlas.getSpriteCount()).toBe(1);
    });

    it("should decrease count after removing sprite", () => {
      const atlas = new TextureAtlas({ texture: mockTexture });

      atlas.defineSprite("sprite1", { x: 0, y: 0, width: 32, height: 32 });
      atlas.defineSprite("sprite2", { x: 32, y: 0, width: 32, height: 32 });

      expect(atlas.getSpriteCount()).toBe(2);

      atlas.removeSprite("sprite1");
      expect(atlas.getSpriteCount()).toBe(1);
    });
  });

  describe("removeSprite", () => {
    it("should remove existing sprite", () => {
      const atlas = new TextureAtlas({ texture: mockTexture });

      atlas.defineSprite("test", { x: 0, y: 0, width: 32, height: 32 });

      expect(atlas.hasSprite("test")).toBe(true);
      expect(atlas.removeSprite("test")).toBe(true);
      expect(atlas.hasSprite("test")).toBe(false);
    });

    it("should return false for non-existent sprite", () => {
      const atlas = new TextureAtlas({ texture: mockTexture });

      expect(atlas.removeSprite("nonexistent")).toBe(false);
    });

    it("should decrease sprite count", () => {
      const atlas = new TextureAtlas({ texture: mockTexture });

      atlas.defineSprite("sprite1", { x: 0, y: 0, width: 32, height: 32 });
      atlas.defineSprite("sprite2", { x: 32, y: 0, width: 32, height: 32 });

      expect(atlas.getSpriteCount()).toBe(2);

      atlas.removeSprite("sprite1");
      expect(atlas.getSpriteCount()).toBe(1);
    });
  });

  describe("clear", () => {
    it("should remove all sprites", () => {
      const atlas = new TextureAtlas({ texture: mockTexture });

      atlas.defineSprite("sprite1", { x: 0, y: 0, width: 32, height: 32 });
      atlas.defineSprite("sprite2", { x: 32, y: 0, width: 32, height: 32 });
      atlas.defineSprite("sprite3", { x: 0, y: 32, width: 32, height: 32 });

      expect(atlas.getSpriteCount()).toBe(3);

      atlas.clear();

      expect(atlas.getSpriteCount()).toBe(0);
      expect(atlas.getSpriteNames()).toEqual([]);
    });

    it("should allow adding sprites after clearing", () => {
      const atlas = new TextureAtlas({ texture: mockTexture });

      atlas.defineSprite("sprite1", { x: 0, y: 0, width: 32, height: 32 });
      atlas.clear();

      atlas.defineSprite("sprite2", { x: 32, y: 0, width: 32, height: 32 });

      expect(atlas.getSpriteCount()).toBe(1);
      expect(atlas.hasSprite("sprite2")).toBe(true);
    });

    it("should not affect texture reference", () => {
      const atlas = new TextureAtlas({ texture: mockTexture });

      atlas.defineSprite("sprite1", { x: 0, y: 0, width: 32, height: 32 });

      const textureBefore = atlas.getTexture();
      atlas.clear();

      const textureAfter = atlas.getTexture();
      expect(textureAfter).toBe(textureBefore);
    });
  });

  describe("toJSON", () => {
    it("should serialize empty atlas", () => {
      const atlas = new TextureAtlas({
        texture: mockTexture,
        textureWidth: 512,
        textureHeight: 512,
      });

      const json = atlas.toJSON();

      expect(json).toEqual({
        textureWidth: 512,
        textureHeight: 512,
        sprites: {},
      });
    });

    it("should serialize all sprites", () => {
      const atlas = new TextureAtlas({
        texture: mockTexture,
        textureWidth: 256,
        textureHeight: 256,
      });

      atlas.defineSprite("sprite1", { x: 0, y: 0, width: 32, height: 32 });
      atlas.defineSprite("sprite2", { x: 32, y: 0, width: 64, height: 64 });

      const json = atlas.toJSON();

      expect(json.textureWidth).toBe(256);
      expect(json.textureHeight).toBe(256);
      expect(json.sprites.sprite1).toEqual({
        pixelRect: { x: 0, y: 0, width: 32, height: 32 },
        width: 32,
        height: 32,
      });
      expect(json.sprites.sprite2).toEqual({
        pixelRect: { x: 32, y: 0, width: 64, height: 64 },
        width: 64,
        height: 64,
      });
    });

    it("should serialize grids correctly", () => {
      const atlas = new TextureAtlas({
        texture: mockTexture,
        textureWidth: 128,
        textureHeight: 128,
      });

      atlas.defineGrid("tile_", 0, 0, 32, 32, 2, 2);

      const json = atlas.toJSON();

      expect(json.sprites.tile_0_0).toBeDefined();
      expect(json.sprites.tile_1_0).toBeDefined();
      expect(json.sprites.tile_0_1).toBeDefined();
      expect(json.sprites.tile_1_1).toBeDefined();
    });
  });

  describe("fromJSON", () => {
    it("should load sprites from JSON", () => {
      const atlas = new TextureAtlas({
        texture: mockTexture,
        textureWidth: 256,
        textureHeight: 256,
      });

      const jsonData = {
        textureWidth: 256,
        textureHeight: 256,
        sprites: {
          sprite1: { pixelRect: { x: 0, y: 0, width: 32, height: 32 } },
          sprite2: { pixelRect: { x: 32, y: 0, width: 64, height: 64 } },
        },
      };

      atlas.fromJSON(jsonData);

      expect(atlas.getSpriteCount()).toBe(2);
      expect(atlas.hasSprite("sprite1")).toBe(true);
      expect(atlas.hasSprite("sprite2")).toBe(true);

      const sprite1 = atlas.getSprite("sprite1");
      expect(sprite1?.getPixelRect()).toEqual({
        x: 0,
        y: 0,
        width: 32,
        height: 32,
      });
    });

    it("should warn when texture dimensions mismatch", () => {
      const atlas = new TextureAtlas({
        texture: mockTexture,
        textureWidth: 512,
        textureHeight: 512,
      });

      const consoleWarnSpy = vi.spyOn(console, "warn");

      const jsonData = {
        textureWidth: 256,
        textureHeight: 256,
        sprites: {
          sprite1: { pixelRect: { x: 0, y: 0, width: 32, height: 32 } },
        },
      };

      atlas.fromJSON(jsonData);

      expect(consoleWarnSpy).toHaveBeenCalledWith(
        expect.stringContaining("Texture width mismatch"),
      );

      consoleWarnSpy.mockRestore();
    });

    it("should handle JSON without texture dimensions", () => {
      const atlas = new TextureAtlas({ texture: mockTexture });

      const jsonData = {
        sprites: {
          sprite1: { pixelRect: { x: 0, y: 0, width: 32, height: 32 } },
        },
      };

      expect(() => atlas.fromJSON(jsonData)).not.toThrow();
      expect(atlas.getSpriteCount()).toBe(1);
    });

    it("should handle JSON with explicit width/height in sprite data", () => {
      const atlas = new TextureAtlas({ texture: mockTexture });

      const jsonData = {
        sprites: {
          sprite1: {
            pixelRect: { x: 0, y: 0, width: 32, height: 32 },
            width: 32,
            height: 32,
          },
        },
      };

      expect(() => atlas.fromJSON(jsonData)).not.toThrow();
      expect(atlas.hasSprite("sprite1")).toBe(true);
    });

    it("should round-trip: toJSON -> fromJSON", () => {
      const atlas1 = new TextureAtlas({
        texture: mockTexture,
        textureWidth: 512,
        textureHeight: 512,
      });

      atlas1.defineSprite("sprite1", { x: 0, y: 0, width: 32, height: 32 });
      atlas1.defineSprite("sprite2", { x: 32, y: 0, width: 64, height: 64 });

      const json = atlas1.toJSON();

      const atlas2 = new TextureAtlas({ texture: mockTexture });
      atlas2.fromJSON(json);

      expect(atlas2.getSpriteCount()).toBe(2);

      const sprite1 = atlas2.getSprite("sprite1");
      expect(sprite1?.getPixelRect()).toEqual({
        x: 0,
        y: 0,
        width: 32,
        height: 32,
      });

      const sprite2 = atlas2.getSprite("sprite2");
      expect(sprite2?.getPixelRect()).toEqual({
        x: 32,
        y: 0,
        width: 64,
        height: 64,
      });
    });
  });

  describe("bind and unbind", () => {
    it("should bind texture to default unit", () => {
      const atlas = new TextureAtlas({ texture: mockTexture });

      const bindSpy = vi.spyOn(mockTexture, "bind");

      atlas.bind();

      expect(bindSpy).toHaveBeenCalledWith(0);

      bindSpy.mockRestore();
    });

    it("should bind texture to specified unit", () => {
      const atlas = new TextureAtlas({ texture: mockTexture });

      const bindSpy = vi.spyOn(mockTexture, "bind");

      atlas.bind(3);

      expect(bindSpy).toHaveBeenCalledWith(3);

      bindSpy.mockRestore();
    });

    it("should unbind texture", () => {
      const atlas = new TextureAtlas({ texture: mockTexture });

      const unbindSpy = vi.spyOn(mockTexture, "unbind");

      atlas.unbind();

      expect(unbindSpy).toHaveBeenCalled();

      unbindSpy.mockRestore();
    });
  });

  describe("toString", () => {
    it("should return string representation with dimensions and count", () => {
      const atlas = new TextureAtlas({
        texture: mockTexture,
        textureWidth: 512,
        textureHeight: 512,
      });

      expect(atlas.toString()).toBe("TextureAtlas(512x512, 0 sprites)");
    });

    it("should update string when sprites are added", () => {
      const atlas = new TextureAtlas({
        texture: mockTexture,
        textureWidth: 256,
        textureHeight: 256,
      });

      atlas.defineSprite("sprite1", { x: 0, y: 0, width: 32, height: 32 });
      expect(atlas.toString()).toBe("TextureAtlas(256x256, 1 sprites)");

      atlas.defineSprite("sprite2", { x: 32, y: 0, width: 32, height: 32 });
      expect(atlas.toString()).toBe("TextureAtlas(256x256, 2 sprites)");
    });
  });
});

describe("AtlasLoader", () => {
  let mockTexture: MockTexture;

  beforeEach(() => {
    mockTexture = new MockTexture(512, 512);
  });

  describe("loadFromGrid", () => {
    it("should load atlas from grid configuration", () => {
      const atlas = AtlasLoader.loadFromGrid(mockTexture, {
        spriteWidth: 32,
        spriteHeight: 32,
        columns: 4,
        rows: 4,
      });

      expect(atlas.getSpriteCount()).toBe(16);
      expect(atlas.hasSprite("0_0")).toBe(true);
      expect(atlas.hasSprite("3_3")).toBe(true);
    });

    it("should use custom prefix", () => {
      const atlas = AtlasLoader.loadFromGrid(mockTexture, {
        spriteWidth: 32,
        spriteHeight: 32,
        columns: 2,
        rows: 2,
        prefix: "character_",
      });

      expect(atlas.hasSprite("character_0_0")).toBe(true);
      expect(atlas.hasSprite("character_1_1")).toBe(true);
    });

    it("should use no prefix by default", () => {
      const atlas = AtlasLoader.loadFromGrid(mockTexture, {
        spriteWidth: 32,
        spriteHeight: 32,
        columns: 2,
        rows: 2,
      });

      expect(atlas.hasSprite("0_0")).toBe(true);
    });

    it("should use empty string prefix when prefix is undefined", () => {
      const atlas = AtlasLoader.loadFromGrid(mockTexture, {
        spriteWidth: 32,
        spriteHeight: 32,
        columns: 2,
        rows: 2,
        prefix: undefined,
      });

      expect(atlas.hasSprite("0_0")).toBe(true);
    });

    it("should apply column spacing", () => {
      const atlas = AtlasLoader.loadFromGrid(mockTexture, {
        spriteWidth: 32,
        spriteHeight: 32,
        columns: 3,
        rows: 1,
        columnSpacing: 4,
      });

      const sprite0 = atlas.getSprite("0_0");
      const sprite1 = atlas.getSprite("1_0");
      const sprite2 = atlas.getSprite("2_0");

      expect(sprite0?.getPixelRect().x).toBe(0);
      expect(sprite1?.getPixelRect().x).toBe(36); // 32 + 4
      expect(sprite2?.getPixelRect().x).toBe(72); // 32 + 4 + 32 + 4
    });

    it("should apply row spacing", () => {
      const atlas = AtlasLoader.loadFromGrid(mockTexture, {
        spriteWidth: 32,
        spriteHeight: 32,
        columns: 1,
        rows: 3,
        rowSpacing: 8,
      });

      const sprite0 = atlas.getSprite("0_0");
      const sprite1 = atlas.getSprite("0_1");
      const sprite2 = atlas.getSprite("0_2");

      expect(sprite0?.getPixelRect().y).toBe(0);
      expect(sprite1?.getPixelRect().y).toBe(40); // 32 + 8
      expect(sprite2?.getPixelRect().y).toBe(80); // 32 + 8 + 32 + 8
    });

    it("should apply both column and row spacing", () => {
      const atlas = AtlasLoader.loadFromGrid(mockTexture, {
        spriteWidth: 32,
        spriteHeight: 32,
        columns: 2,
        rows: 2,
        columnSpacing: 5,
        rowSpacing: 10,
      });

      const sprite00 = atlas.getSprite("0_0");
      const sprite10 = atlas.getSprite("1_0");
      const sprite01 = atlas.getSprite("0_1");

      expect(sprite00?.getPixelRect()).toEqual({
        x: 0,
        y: 0,
        width: 32,
        height: 32,
      });
      expect(sprite10?.getPixelRect()).toEqual({
        x: 37,
        y: 0,
        width: 32,
        height: 32,
      }); // 0 + 32 + 5
      expect(sprite01?.getPixelRect()).toEqual({
        x: 0,
        y: 42,
        width: 32,
        height: 32,
      }); // 0 + 32 + 10
    });

    it("should start from custom position", () => {
      const atlas = AtlasLoader.loadFromGrid(mockTexture, {
        spriteWidth: 32,
        spriteHeight: 32,
        columns: 2,
        rows: 2,
        startX: 100,
        startY: 200,
      });

      const sprite00 = atlas.getSprite("0_0");
      const sprite11 = atlas.getSprite("1_1");

      expect(sprite00?.getPixelRect()).toEqual({
        x: 100,
        y: 200,
        width: 32,
        height: 32,
      });
      expect(sprite11?.getPixelRect()).toEqual({
        x: 132,
        y: 232,
        width: 32,
        height: 32,
      });
    });

    it("should handle different sprite sizes", () => {
      const sizes = [
        { w: 16, h: 16 },
        { w: 32, h: 32 },
        { w: 64, h: 64 },
      ];

      sizes.forEach(({ w, h }) => {
        const atlas = AtlasLoader.loadFromGrid(mockTexture, {
          spriteWidth: w,
          spriteHeight: h,
          columns: 2,
          rows: 2,
        });

        const sprite = atlas.getSprite("0_0");
        expect(sprite?.getWidth()).toBe(w);
        expect(sprite?.getHeight()).toBe(h);
      });
    });

    it("should use default spacing values when not provided", () => {
      const atlas = AtlasLoader.loadFromGrid(mockTexture, {
        spriteWidth: 32,
        spriteHeight: 32,
        columns: 2,
        rows: 2,
      });

      const sprite00 = atlas.getSprite("0_0");
      const sprite10 = atlas.getSprite("1_0");
      const sprite01 = atlas.getSprite("0_1");

      expect(sprite00?.getPixelRect()).toEqual({
        x: 0,
        y: 0,
        width: 32,
        height: 32,
      });
      expect(sprite10?.getPixelRect()).toEqual({
        x: 32,
        y: 0,
        width: 32,
        height: 32,
      });
      expect(sprite01?.getPixelRect()).toEqual({
        x: 0,
        y: 32,
        width: 32,
        height: 32,
      });
    });
  });

  describe("loadFromJSON", () => {
    it("should load atlas from JSON data", () => {
      const jsonData = {
        textureWidth: 512,
        textureHeight: 512,
        sprites: {
          sprite1: { pixelRect: { x: 0, y: 0, width: 32, height: 32 } },
          sprite2: { pixelRect: { x: 32, y: 0, width: 64, height: 64 } },
        },
      };

      const atlas = AtlasLoader.loadFromJSON(mockTexture, jsonData);

      expect(atlas.getSpriteCount()).toBe(2);
      expect(atlas.hasSprite("sprite1")).toBe(true);
      expect(atlas.hasSprite("sprite2")).toBe(true);
    });

    it("should handle JSON without texture dimensions", () => {
      const jsonData = {
        sprites: {
          sprite1: { pixelRect: { x: 0, y: 0, width: 32, height: 32 } },
        },
      };

      const atlas = AtlasLoader.loadFromJSON(mockTexture, jsonData);

      expect(atlas.getSpriteCount()).toBe(1);
      expect(atlas.hasSprite("sprite1")).toBe(true);
    });

    it("should create atlas with auto-detected dimensions", () => {
      const jsonData = {
        sprites: {
          sprite1: { pixelRect: { x: 0, y: 0, width: 32, height: 32 } },
        },
      };

      const atlas = AtlasLoader.loadFromJSON(mockTexture, jsonData);

      const dims = atlas.getTextureDimensions();
      expect(dims.width).toBe(512);
      expect(dims.height).toBe(512);
    });

    it("should handle round-trip: toJSON -> loadFromJSON", () => {
      const atlas1 = new TextureAtlas({ texture: mockTexture });

      atlas1.defineSprite("sprite1", { x: 0, y: 0, width: 32, height: 32 });
      atlas1.defineSprite("sprite2", { x: 32, y: 0, width: 64, height: 64 });

      const json = atlas1.toJSON();
      const atlas2 = AtlasLoader.loadFromJSON(mockTexture, json);

      expect(atlas2.getSpriteCount()).toBe(2);

      const sprite1 = atlas2.getSprite("sprite1");
      expect(sprite1?.getPixelRect()).toEqual({
        x: 0,
        y: 0,
        width: 32,
        height: 32,
      });

      const sprite2 = atlas2.getSprite("sprite2");
      expect(sprite2?.getPixelRect()).toEqual({
        x: 32,
        y: 0,
        width: 64,
        height: 64,
      });
    });
  });
});

describe("UV Coordinate Calculation", () => {
  let mockTexture: MockTexture;

  beforeEach(() => {
    mockTexture = new MockTexture(512, 512);
  });

  describe("Pixel to UV Conversion", () => {
    it("should convert bottom-left corner correctly", () => {
      const atlas = new TextureAtlas({ texture: mockTexture });

      const sprite = atlas.defineSprite("test", {
        x: 0,
        y: 0,
        width: 256,
        height: 256,
      });
      const uv = sprite.getUVRect();

      expect(uv.uMin).toBe(0);
      expect(uv.vMin).toBe(0);
      expect(uv.uMax).toBe(0.5);
      expect(uv.vMax).toBe(0.5);
    });

    it("should convert top-right corner correctly", () => {
      const atlas = new TextureAtlas({ texture: mockTexture });

      const sprite = atlas.defineSprite("test", {
        x: 256,
        y: 256,
        width: 256,
        height: 256,
      });
      const uv = sprite.getUVRect();

      expect(uv.uMin).toBe(0.5);
      expect(uv.vMin).toBe(0.5);
      expect(uv.uMax).toBe(1);
      expect(uv.vMax).toBe(1);
    });

    it("should convert center correctly", () => {
      const atlas = new TextureAtlas({ texture: mockTexture });

      const sprite = atlas.defineSprite("test", {
        x: 128,
        y: 128,
        width: 256,
        height: 256,
      });
      const uv = sprite.getUVRect();

      expect(uv.uMin).toBe(0.25);
      expect(uv.vMin).toBe(0.25);
      expect(uv.uMax).toBe(0.75);
      expect(uv.vMax).toBe(0.75);
    });

    it("should handle small sprites", () => {
      const atlas = new TextureAtlas({ texture: mockTexture });

      const sprite = atlas.defineSprite("small", {
        x: 0,
        y: 0,
        width: 16,
        height: 16,
      });
      const uv = sprite.getUVRect();

      expect(uv.uMin).toBe(0);
      expect(uv.vMin).toBe(0);
      expect(uv.uMax).toBeCloseTo(0.03125, 5); // 16/512
      expect(uv.vMax).toBeCloseTo(0.03125, 5);
    });

    it("should handle large sprites", () => {
      const atlas = new TextureAtlas({ texture: mockTexture });

      const sprite = atlas.defineSprite("large", {
        x: 0,
        y: 0,
        width: 512,
        height: 512,
      });
      const uv = sprite.getUVRect();

      expect(uv.uMin).toBe(0);
      expect(uv.vMin).toBe(0);
      expect(uv.uMax).toBe(1);
      expect(uv.vMax).toBe(1);
    });
  });

  describe("UV to Pixel Conversion", () => {
    it("should convert UV (0, 0, 1, 1) to full texture", () => {
      const atlas = new TextureAtlas({ texture: mockTexture });

      const sprite = atlas.defineSpriteUV("full", {
        uMin: 0,
        vMin: 0,
        uMax: 1,
        vMax: 1,
      });
      const pixel = sprite.getPixelRect();

      expect(pixel.x).toBe(0);
      expect(pixel.y).toBe(0);
      expect(pixel.width).toBe(512);
      expect(pixel.height).toBe(512);
    });

    it("should convert UV (0, 0, 0.5, 0.5) to quarter texture", () => {
      const atlas = new TextureAtlas({ texture: mockTexture });

      const sprite = atlas.defineSpriteUV("quarter", {
        uMin: 0,
        vMin: 0,
        uMax: 0.5,
        vMax: 0.5,
      });
      const pixel = sprite.getPixelRect();

      expect(pixel.x).toBe(0);
      expect(pixel.y).toBe(0);
      expect(pixel.width).toBe(256);
      expect(pixel.height).toBe(256);
    });

    it("should convert fractional UV coordinates", () => {
      const atlas = new TextureAtlas({ texture: mockTexture });

      const sprite = atlas.defineSpriteUV("fractional", {
        uMin: 0.25,
        vMin: 0.25,
        uMax: 0.75,
        vMax: 0.75,
      });
      const pixel = sprite.getPixelRect();

      expect(pixel.x).toBe(128); // 0.25 * 512
      expect(pixel.y).toBe(128);
      expect(pixel.width).toBe(256); // (0.75 - 0.25) * 512
      expect(pixel.height).toBe(256);
    });
  });
});

describe("Edge Cases and Error Handling", () => {
  let mockTexture: MockTexture;

  beforeEach(() => {
    mockTexture = new MockTexture(512, 512);
  });

  describe("Boundary Conditions", () => {
    it("should handle sprite at exact texture edge", () => {
      const atlas = new TextureAtlas({ texture: mockTexture });

      const sprite = atlas.defineSprite("edge", {
        x: 480,
        y: 480,
        width: 32,
        height: 32,
      });

      expect(sprite.getWidth()).toBe(32);
      expect(sprite.getHeight()).toBe(32);
    });

    it("should reject sprite extending beyond texture by 1 pixel", () => {
      const atlas = new TextureAtlas({ texture: mockTexture });

      expect(() => {
        atlas.defineSprite("overflow", { x: 481, y: 0, width: 32, height: 32 });
      }).toThrow("extends beyond texture bounds");
    });

    it("should handle 1x1 sprites", () => {
      const atlas = new TextureAtlas({ texture: mockTexture });

      const sprite = atlas.defineSprite("tiny", {
        x: 0,
        y: 0,
        width: 1,
        height: 1,
      });

      expect(sprite.getWidth()).toBe(1);
      expect(sprite.getHeight()).toBe(1);
    });
  });

  describe("Empty Atlas Operations", () => {
    it("should handle operations on empty atlas", () => {
      const atlas = new TextureAtlas({ texture: mockTexture });

      expect(atlas.getSprite("nonexistent")).toBeUndefined();
      expect(atlas.hasSprite("nonexistent")).toBe(false);
      expect(atlas.removeSprite("nonexistent")).toBe(false);
      expect(atlas.getSpriteNames()).toEqual([]);
      expect(atlas.getSpriteCount()).toBe(0);
    });

    it("should clear empty atlas without error", () => {
      const atlas = new TextureAtlas({ texture: mockTexture });

      expect(() => atlas.clear()).not.toThrow();
      expect(atlas.getSpriteCount()).toBe(0);
    });
  });

  describe("Special Characters in Names", () => {
    it("should handle sprites with underscores", () => {
      const atlas = new TextureAtlas({ texture: mockTexture });

      const sprite = atlas.defineSprite("sprite_with_underscores", {
        x: 0,
        y: 0,
        width: 32,
        height: 32,
      });

      expect(sprite.getName()).toBe("sprite_with_underscores");
    });

    it("should handle sprites with hyphens", () => {
      const atlas = new TextureAtlas({ texture: mockTexture });

      const sprite = atlas.defineSprite("sprite-with-hyphens", {
        x: 0,
        y: 0,
        width: 32,
        height: 32,
      });

      expect(sprite.getName()).toBe("sprite-with-hyphens");
    });

    it("should handle sprites with numbers", () => {
      const atlas = new TextureAtlas({ texture: mockTexture });

      const sprite = atlas.defineSprite("sprite123", {
        x: 0,
        y: 0,
        width: 32,
        height: 32,
      });

      expect(sprite.getName()).toBe("sprite123");
    });
  });

  describe("Large Numbers of Sprites", () => {
    it("should handle many sprites", () => {
      const atlas = new TextureAtlas({ texture: mockTexture });

      for (let i = 0; i < 100; i++) {
        atlas.defineSprite(`sprite_${i}`, {
          x: 0,
          y: 0,
          width: 32,
          height: 32,
        });
      }

      expect(atlas.getSpriteCount()).toBe(100);
      expect(atlas.hasSprite("sprite_0")).toBe(true);
      expect(atlas.hasSprite("sprite_99")).toBe(true);
    });

    it("should handle large grid", () => {
      const atlas = new TextureAtlas({ texture: mockTexture });

      const names = atlas.defineGrid("tile_", 0, 0, 16, 16, 16, 16);

      expect(names.length).toBe(256);
      expect(atlas.getSpriteCount()).toBe(256);
    });
  });

  describe("Dimension Mismatch Warnings", () => {
    it("should warn when width dimension mismatches", () => {
      const atlas = new TextureAtlas({
        texture: mockTexture,
        textureWidth: 512,
        textureHeight: 512,
      });

      const consoleWarnSpy = vi.spyOn(console, "warn");

      const jsonData = {
        textureWidth: 256,
        textureHeight: 512,
        sprites: {
          sprite1: { pixelRect: { x: 0, y: 0, width: 32, height: 32 } },
        },
      };

      atlas.fromJSON(jsonData);

      expect(consoleWarnSpy).toHaveBeenCalledWith(
        expect.stringContaining("Texture width mismatch"),
      );

      consoleWarnSpy.mockRestore();
    });

    it("should warn when height dimension mismatches", () => {
      const atlas = new TextureAtlas({
        texture: mockTexture,
        textureWidth: 512,
        textureHeight: 512,
      });

      const consoleWarnSpy = vi.spyOn(console, "warn");

      const jsonData = {
        textureWidth: 512,
        textureHeight: 256,
        sprites: {
          sprite1: { pixelRect: { x: 0, y: 0, width: 32, height: 32 } },
        },
      };

      atlas.fromJSON(jsonData);

      expect(consoleWarnSpy).toHaveBeenCalledWith(
        expect.stringContaining("Texture height mismatch"),
      );

      consoleWarnSpy.mockRestore();
    });

    it("should not warn when dimensions match", () => {
      const atlas = new TextureAtlas({
        texture: mockTexture,
        textureWidth: 512,
        textureHeight: 512,
      });

      const consoleWarnSpy = vi.spyOn(console, "warn");

      const jsonData = {
        textureWidth: 512,
        textureHeight: 512,
        sprites: {
          sprite1: { pixelRect: { x: 0, y: 0, width: 32, height: 32 } },
        },
      };

      atlas.fromJSON(jsonData);

      expect(consoleWarnSpy).not.toHaveBeenCalled();

      consoleWarnSpy.mockRestore();
    });
  });
});

describe("Integration Scenarios", () => {
  let mockTexture: MockTexture;

  beforeEach(() => {
    mockTexture = new MockTexture(1024, 1024);
  });

  describe("Character Animation Sheet", () => {
    it("should handle typical character sprite sheet", () => {
      const atlas = new TextureAtlas({ texture: mockTexture });

      // 4x4 grid of 64x64 character animation frames
      const frames = atlas.defineGrid("player_idle_", 0, 0, 64, 64, 4, 4);

      expect(frames.length).toBe(16);
      expect(frames[0]).toBe("player_idle_0_0");
      expect(frames[15]).toBe("player_idle_3_3");

      // Verify each frame has correct dimensions
      frames.forEach((name) => {
        const sprite = atlas.getSprite(name);
        expect(sprite?.getWidth()).toBe(64);
        expect(sprite?.getHeight()).toBe(64);
      });
    });

    it("should handle multiple animation states", () => {
      const atlas = new TextureAtlas({ texture: mockTexture });

      // Idle animation: 4 frames at top-left
      atlas.defineGrid("idle_", 0, 0, 32, 32, 4, 1);

      // Run animation: 6 frames below idle
      atlas.defineGrid("run_", 0, 32, 32, 32, 6, 1);

      // Jump animation: 2 frames below run
      atlas.defineGrid("jump_", 0, 64, 32, 32, 2, 1);

      expect(atlas.getSpriteCount()).toBe(12);
      expect(atlas.hasSprite("idle_0_0")).toBe(true);
      expect(atlas.hasSprite("run_5_0")).toBe(true);
      expect(atlas.hasSprite("jump_1_0")).toBe(true);
    });
  });

  describe("Tileset Atlas", () => {
    it("should handle tileset with spacing", () => {
      const atlas = new TextureAtlas({ texture: mockTexture });

      // 32x32 tiles with 2px spacing
      const tiles = atlas.defineGrid("grass_", 0, 0, 32, 32, 16, 16, 2, 2);

      expect(tiles.length).toBe(256);

      // Verify spacing is applied
      const tile00 = atlas.getSprite("grass_0_0");
      const tile01 = atlas.getSprite("grass_1_0");

      expect(tile00?.getPixelRect().x).toBe(0);
      expect(tile01?.getPixelRect().x).toBe(34); // 32 + 2
    });

    it("should handle multiple tile types", () => {
      const atlas = new TextureAtlas({ texture: mockTexture });

      // Grass tiles: 8x8 grid
      atlas.defineGrid("grass_", 0, 0, 32, 32, 8, 8);

      // Water tiles: 8x8 grid to the right
      atlas.defineGrid("water_", 256, 0, 32, 32, 8, 8);

      // Stone tiles: 8x8 grid below grass
      atlas.defineGrid("stone_", 0, 256, 32, 32, 8, 8);

      expect(atlas.getSpriteCount()).toBe(192); // 64 * 3
    });
  });

  describe("UI Elements Atlas", () => {
    it("should handle UI elements of varying sizes", () => {
      const atlas = new TextureAtlas({ texture: mockTexture });

      // Buttons
      atlas.defineSprite("button_normal", {
        x: 0,
        y: 0,
        width: 128,
        height: 32,
      });
      atlas.defineSprite("button_hover", {
        x: 128,
        y: 0,
        width: 128,
        height: 32,
      });
      atlas.defineSprite("button_pressed", {
        x: 256,
        y: 0,
        width: 128,
        height: 32,
      });

      // Icons
      atlas.defineSprite("icon_save", { x: 0, y: 32, width: 16, height: 16 });
      atlas.defineSprite("icon_load", { x: 16, y: 32, width: 16, height: 16 });
      atlas.defineSprite("icon_settings", {
        x: 32,
        y: 32,
        width: 16,
        height: 16,
      });

      // Panel background
      atlas.defineSprite("panel_bg", { x: 0, y: 48, width: 256, height: 256 });

      expect(atlas.getSpriteCount()).toBe(7);
      expect(atlas.hasSprite("button_normal")).toBe(true);
      expect(atlas.hasSprite("icon_save")).toBe(true);
      expect(atlas.hasSprite("panel_bg")).toBe(true);
    });
  });

  describe("Sprite Packing (Manual)", () => {
    it("should pack sprites efficiently", () => {
      const atlas = new TextureAtlas({ texture: mockTexture });

      // Large sprite at top-left
      atlas.defineSprite("large", { x: 0, y: 0, width: 256, height: 256 });

      // Medium sprites to the right
      atlas.defineSprite("medium1", { x: 256, y: 0, width: 128, height: 128 });
      atlas.defineSprite("medium2", { x: 384, y: 0, width: 128, height: 128 });
      atlas.defineSprite("medium3", {
        x: 256,
        y: 128,
        width: 128,
        height: 128,
      });
      atlas.defineSprite("medium4", {
        x: 384,
        y: 128,
        width: 128,
        height: 128,
      });

      // Small sprites at bottom
      atlas.defineSprite("small1", { x: 0, y: 256, width: 64, height: 64 });
      atlas.defineSprite("small2", { x: 64, y: 256, width: 64, height: 64 });
      atlas.defineSprite("small3", { x: 0, y: 320, width: 64, height: 64 });
      atlas.defineSprite("small4", { x: 64, y: 320, width: 64, height: 64 });

      expect(atlas.getSpriteCount()).toBe(9);
    });
  });

  describe("JSON Round-trip with Complex Atlas", () => {
    it("should serialize and deserialize complex atlas", () => {
      const atlas1 = new TextureAtlas({ texture: mockTexture });

      // Add various sprites
      atlas1.defineSprite("sprite1", { x: 0, y: 0, width: 64, height: 64 });
      atlas1.defineSprite("sprite2", { x: 64, y: 0, width: 128, height: 128 });
      atlas1.defineGrid("tile_", 0, 128, 32, 32, 4, 4);

      // Serialize
      const json = atlas1.toJSON();

      // Create new atlas and deserialize
      const atlas2 = new TextureAtlas({ texture: mockTexture });
      atlas2.fromJSON(json);

      // Verify all sprites are present
      expect(atlas2.getSpriteCount()).toBe(atlas1.getSpriteCount());

      // Verify specific sprites
      const sprite1 = atlas2.getSprite("sprite1");
      expect(sprite1?.getPixelRect()).toEqual({
        x: 0,
        y: 0,
        width: 64,
        height: 64,
      });

      const tile00 = atlas2.getSprite("tile_0_0");
      expect(tile00?.getPixelRect()).toEqual({
        x: 0,
        y: 128,
        width: 32,
        height: 32,
      });
    });
  });
});
