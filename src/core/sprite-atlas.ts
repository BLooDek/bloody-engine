/**
 * Sprite Atlas System
 *
 * Manages UV coordinates for individual sprites within a larger texture atlas.
 * Provides convenient methods to define sprite regions and retrieve UV coordinates.
 */

import type { Texture } from "./texture";

/**
 * UV rectangle defining a region in texture space (0-1 range)
 */
export interface UVRect {
  /** Minimum U coordinate (left edge) */
  uMin: number;
  /** Minimum V coordinate (bottom edge) */
  vMin: number;
  /** Maximum U coordinate (right edge) */
  uMax: number;
  /** Maximum V coordinate (top edge) */
  vMax: number;
}

/**
 * Pixel rectangle defining a region in pixel coordinates
 */
export interface PixelRect {
  /** Left edge in pixels */
  x: number;
  /** Bottom edge in pixels (Y-up coordinate system) */
  y: number;
  /** Width in pixels */
  width: number;
  /** Height in pixels */
  height: number;
}

/**
 * Sprite metadata stored in the atlas
 */
export interface SpriteInfo {
  /** Unique identifier for this sprite */
  name: string;
  /** UV rectangle in texture space */
  uvRect: UVRect;
  /** Pixel rectangle in the source texture */
  pixelRect: PixelRect;
  /** Width of the sprite in pixels */
  width: number;
  /** Height of the sprite in pixels */
  height: number;
}

/**
 * Represents a single sprite within a texture atlas.
 * Provides convenient access to UV coordinates and sprite dimensions.
 */
export class Sprite {
  private readonly info: SpriteInfo;

  /**
   * Create a new sprite instance
   * @param info Sprite information including UV coordinates and dimensions
   */
  constructor(info: SpriteInfo) {
    this.info = info;
  }

  /**
   * Get the sprite's unique name/identifier
   */
  getName(): string {
    return this.info.name;
  }

  /**
   * Get the UV rectangle for this sprite
   * @returns UV coordinates in 0-1 range
   */
  getUVRect(): UVRect {
    return { ...this.info.uvRect };
  }

  /**
   * Get the pixel rectangle for this sprite
   * @returns Pixel coordinates in the source texture
   */
  getPixelRect(): PixelRect {
    return { ...this.info.pixelRect };
  }

  /**
   * Get the sprite width in pixels
   */
  getWidth(): number {
    return this.info.width;
  }

  /**
   * Get the sprite height in pixels
   */
  getHeight(): number {
    return this.info.height;
  }

  /**
   * Get the aspect ratio (width / height)
   */
  getAspectRatio(): number {
    return this.info.width / this.info.height;
  }

  /**
   * Create a UV rect object suitable for SpriteQuadInstance
   * @returns UV rect as expected by batch renderer
   */
  toQuadUVRect(): { uMin: number; vMin: number; uMax: number; vMax: number } {
    return {
      uMin: this.info.uvRect.uMin,
      vMin: this.info.uvRect.vMin,
      uMax: this.info.uvRect.uMax,
      vMax: this.info.uvRect.vMax,
    };
  }

  /**
   * Get a string representation of this sprite
   */
  toString(): string {
    return `Sprite("${this.info.name}", ${this.info.width}x${this.info.height})`;
  }
}

/**
 * Options for creating a texture atlas
 */
export interface AtlasOptions {
  /** Texture containing the atlas image */
  texture: Texture;
  /** Width of the texture in pixels (auto-detected from texture if not provided) */
  textureWidth?: number;
  /** Height of the texture in pixels (auto-detected from texture if not provided) */
  textureHeight?: number;
}

/**
 * Texture Atlas Manager
 *
 * Manages a collection of sprites within a single texture.
 * Provides methods to define sprites by pixel or normalized coordinates,
 * and retrieve sprite information by name.
 *
 * @example
 * ```typescript
 * // Create an atlas from a loaded texture
 * const atlas = new TextureAtlas({ texture: myTexture });
 *
 * // Define sprites by pixel coordinates
 * atlas.defineSprite("player_idle_1", { x: 0, y: 0, width: 32, height: 32 });
 * atlas.defineSprite("player_idle_2", { x: 32, y: 0, width: 32, height: 32 });
 *
 * // Or define sprites by normalized UV coordinates
 * atlas.defineSpriteUV("background", { uMin: 0, vMin: 0, uMax: 1, vMax: 1 }, 512, 512);
 *
 * // Get a sprite for rendering
 * const sprite = atlas.getSprite("player_idle_1");
 * renderer.addQuad({
 *   x: 100, y: 100, z: 0,
 *   width: sprite.getWidth(),
 *   height: sprite.getHeight(),
 *   rotation: 0,
 *   uvRect: sprite.toQuadUVRect(),
 *   texIndex: 0
 * });
 * ```
 */
export class TextureAtlas {
  private readonly texture: Texture;
  private readonly textureWidth: number;
  private readonly textureHeight: number;
  private readonly sprites: Map<string, Sprite>;

  /**
   * Create a new texture atlas
   * @param options Atlas configuration options
   */
  constructor(options: AtlasOptions) {
    this.texture = options.texture;

    // Auto-detect texture dimensions if not provided
    const dims = options.texture.getDimensions();
    this.textureWidth = options.textureWidth ?? dims.width;
    this.textureHeight = options.textureHeight ?? dims.height;

    this.sprites = new Map();
  }

  /**
   * Get the underlying texture
   */
  getTexture(): Texture {
    return this.texture;
  }

  /**
   * Get the texture dimensions
   */
  getTextureDimensions(): { width: number; height: number } {
    return {
      width: this.textureWidth,
      height: this.textureHeight,
    };
  }

  /**
   * Define a sprite by pixel coordinates.
   * Pixels are in Y-up coordinate system (bottom-left origin).
   *
   * @param name Unique identifier for this sprite
   * @param rect Pixel rectangle defining the sprite region
   * @returns The created Sprite instance
   *
   * @example
   * ```typescript
   * // Define a 32x32 sprite at the bottom-left corner
   * atlas.defineSprite("player", { x: 0, y: 0, width: 32, height: 32 });
   *
   * // Define a sprite starting at column 2, row 1 (assuming 32px tiles)
   * atlas.defineSprite("enemy", { x: 64, y: 32, width: 32, height: 32 });
   * ```
   */
  defineSprite(name: string, rect: PixelRect): Sprite {
    if (this.sprites.has(name)) {
      console.warn(`Sprite "${name}" already exists in atlas, overwriting.`);
    }

    // Validate pixel coordinates
    if (rect.x < 0 || rect.y < 0 || rect.width <= 0 || rect.height <= 0) {
      throw new Error(
        `Invalid pixel rect for sprite "${name}": ` +
          `x=${rect.x}, y=${rect.y}, width=${rect.width}, height=${rect.height}`
      );
    }

    if (rect.x + rect.width > this.textureWidth || rect.y + rect.height > this.textureHeight) {
      throw new Error(
        `Sprite "${name}" extends beyond texture bounds: ` +
          `rect (${rect.x}+${rect.width}, ${rect.y}+${rect.height}) ` +
          `> texture (${this.textureWidth}x${this.textureHeight})`
      );
    }

    // Convert pixel coordinates to normalized UV coordinates
    const uvRect: UVRect = {
      uMin: rect.x / this.textureWidth,
      vMin: rect.y / this.textureHeight,
      uMax: (rect.x + rect.width) / this.textureWidth,
      vMax: (rect.y + rect.height) / this.textureHeight,
    };

    const spriteInfo: SpriteInfo = {
      name,
      uvRect,
      pixelRect: { ...rect },
      width: rect.width,
      height: rect.height,
    };

    const sprite = new Sprite(spriteInfo);
    this.sprites.set(name, sprite);
    return sprite;
  }

  /**
   * Define a sprite grid (regular grid of same-sized sprites).
   * Useful for sprite sheets and tilesets.
   *
   * @param prefix Name prefix for each sprite (e.g., "tile_")
   * @param startX Starting X position in pixels
   * @param startY Starting Y position in pixels
   * @param spriteWidth Width of each sprite in pixels
   * @param spriteHeight Height of each sprite in pixels
   * @param columns Number of columns in the grid
   * @param rows Number of rows in the grid
   * @param columnSpacing Optional horizontal gap between sprites (default 0)
   * @param rowSpacing Optional vertical gap between sprites (default 0)
   * @returns Array of created sprite names
   *
   * @example
   * ```typescript
   * // Define a 4x4 grid of 32x32 tiles
   * const tiles = atlas.defineGrid(
   *   "tile_", 0, 0, 32, 32, 4, 4
   * );
   * // tiles = ["tile_0_0", "tile_1_0", ..., "tile_3_3"]
   * ```
   */
  defineGrid(
    prefix: string,
    startX: number,
    startY: number,
    spriteWidth: number,
    spriteHeight: number,
    columns: number,
    rows: number,
    columnSpacing: number = 0,
    rowSpacing: number = 0
  ): string[] {
    const names: string[] = [];

    for (let row = 0; row < rows; row++) {
      for (let col = 0; col < columns; col++) {
        const name = `${prefix}${col}_${row}`;
        const x = startX + col * (spriteWidth + columnSpacing);
        const y = startY + row * (spriteHeight + rowSpacing);

        this.defineSprite(name, { x, y, width: spriteWidth, height: spriteHeight });
        names.push(name);
      }
    }

    return names;
  }

  /**
   * Define a sprite by normalized UV coordinates.
   * Useful when you have pre-computed UV values.
   *
   * @param name Unique identifier for this sprite
   * @param uvRect UV rectangle (0-1 range)
   * @param pixelWidth Width in pixels (for reference, optional)
   * @param pixelHeight Height in pixels (for reference, optional)
   * @returns The created Sprite instance
   *
   * @example
   * ```typescript
   * // Define a sprite covering the entire texture
   * atlas.defineSpriteUV("full", {
   *   uMin: 0, vMin: 0, uMax: 1, vMax: 1
   * }, 512, 512);
   * ```
   */
  defineSpriteUV(
    name: string,
    uvRect: UVRect,
    pixelWidth?: number,
    pixelHeight?: number
  ): Sprite {
    if (this.sprites.has(name)) {
      console.warn(`Sprite "${name}" already exists in atlas, overwriting.`);
    }

    // Validate UV coordinates
    const { uMin, vMin, uMax, vMax } = uvRect;
    if (uMin < 0 || uMin > 1 || vMin < 0 || vMin > 1 ||
        uMax < 0 || uMax > 1 || vMax < 0 || vMax > 1) {
      throw new Error(
        `Invalid UV rect for sprite "${name}": coordinates must be in 0-1 range`
      );
    }

    if (uMin >= uMax || vMin >= vMax) {
      throw new Error(
        `Invalid UV rect for sprite "${name}": min must be less than max`
      );
    }

    // Convert UV to pixel coordinates
    const pixelWidthComputed = pixelWidth ?? Math.round((uMax - uMin) * this.textureWidth);
    const pixelHeightComputed = pixelHeight ?? Math.round((vMax - vMin) * this.textureHeight);

    const pixelRect: PixelRect = {
      x: Math.round(uMin * this.textureWidth),
      y: Math.round(vMin * this.textureHeight),
      width: pixelWidthComputed,
      height: pixelHeightComputed,
    };

    const spriteInfo: SpriteInfo = {
      name,
      uvRect: { ...uvRect },
      pixelRect,
      width: pixelWidthComputed,
      height: pixelHeightComputed,
    };

    const sprite = new Sprite(spriteInfo);
    this.sprites.set(name, sprite);
    return sprite;
  }

  /**
   * Get a sprite by name
   * @param name Sprite identifier
   * @returns Sprite instance or undefined if not found
   */
  getSprite(name: string): Sprite | undefined {
    return this.sprites.get(name);
  }

  /**
   * Check if a sprite exists in the atlas
   * @param name Sprite identifier
   */
  hasSprite(name: string): boolean {
    return this.sprites.has(name);
  }

  /**
   * Get all sprite names in the atlas
   */
  getSpriteNames(): string[] {
    return Array.from(this.sprites.keys());
  }

  /**
   * Get the number of sprites defined in the atlas
   */
  getSpriteCount(): number {
    return this.sprites.size;
  }

  /**
   * Remove a sprite from the atlas
   * @param name Sprite identifier
   * @returns true if sprite was removed, false if it didn't exist
   */
  removeSprite(name: string): boolean {
    return this.sprites.delete(name);
  }

  /**
   * Clear all sprites from the atlas
   */
  clear(): void {
    this.sprites.clear();
  }

  /**
   * Create a sprite definition JSON from all sprites in the atlas.
   * Useful for serializing atlas data to disk.
   *
   * @returns JSON-serializable object containing all sprite data
   */
  toJSON(): object {
    const spriteData: Record<string, { pixelRect: PixelRect; width: number; height: number }> = {};

    for (const [name, sprite] of this.sprites) {
      spriteData[name] = {
        pixelRect: sprite.getPixelRect(),
        width: sprite.getWidth(),
        height: sprite.getHeight(),
      };
    }

    return {
      textureWidth: this.textureWidth,
      textureHeight: this.textureHeight,
      sprites: spriteData,
    };
  }

  /**
   * Load sprite definitions from a JSON object.
   * Useful for loading atlas data from disk.
   *
   * @param data JSON object containing sprite definitions
   * @example
   * ```typescript
   * // Load from a parsed JSON file
   * const data = JSON.parse(fs.readFileSync("atlas.json", "utf8"));
   * atlas.fromJSON(data);
   * ```
   */
  fromJSON(data: {
    textureWidth?: number;
    textureHeight?: number;
    sprites: Record<string, { pixelRect: PixelRect; width?: number; height?: number }>;
  }): void {
    // Validate texture dimensions match (if provided)
    if (data.textureWidth !== undefined && data.textureWidth !== this.textureWidth) {
      console.warn(
        `Texture width mismatch: JSON=${data.textureWidth}, ` +
        `actual=${this.textureWidth}. Using actual dimensions.`
      );
    }
    if (data.textureHeight !== undefined && data.textureHeight !== this.textureHeight) {
      console.warn(
        `Texture height mismatch: JSON=${data.textureHeight}, ` +
        `actual=${this.textureHeight}. Using actual dimensions.`
      );
    }

    // Load sprites
    for (const [name, spriteData] of Object.entries(data.sprites)) {
      this.defineSprite(name, spriteData.pixelRect);
    }
  }

  /**
   * Bind the atlas texture to a texture unit
   * @param unit Texture unit (0-7 typically, default 0)
   */
  bind(unit: number = 0): void {
    this.texture.bind(unit);
  }

  /**
   * Unbind the atlas texture
   */
  unbind(): void {
    this.texture.unbind();
  }

  /**
   * Get a string representation of the atlas
   */
  toString(): string {
    return `TextureAtlas(${this.textureWidth}x${this.textureHeight}, ${this.sprites.size} sprites)`;
  }
}

/**
 * Utility function to create a TextureAtlas from common sprite sheet formats.
 */
export class AtlasLoader {
  /**
   * Create an atlas from a regular grid sprite sheet.
   * All sprites must have the same dimensions and be arranged in rows and columns.
   *
   * @param texture The texture containing the sprite sheet
   * @param options Grid configuration options
   * @returns A configured TextureAtlas with all sprites defined
   *
   * @example
   * ```typescript
   * const atlas = AtlasLoader.loadFromGrid(myTexture, {
   *   spriteWidth: 32,
   *   spriteHeight: 32,
   *   columns: 4,
   *   rows: 4,
   *   prefix: "character_"
   * });
   * ```
   */
  static loadFromGrid(
    texture: Texture,
    options: {
      spriteWidth: number;
      spriteHeight: number;
      columns: number;
      rows: number;
      prefix?: string;
      columnSpacing?: number;
      rowSpacing?: number;
      startX?: number;
      startY?: number;
    }
  ): TextureAtlas {
    const atlas = new TextureAtlas({ texture });

    const {
      spriteWidth,
      spriteHeight,
      columns,
      rows,
      prefix = "",
      columnSpacing = 0,
      rowSpacing = 0,
      startX = 0,
      startY = 0,
    } = options;

    atlas.defineGrid(
      prefix,
      startX,
      startY,
      spriteWidth,
      spriteHeight,
      columns,
      rows,
      columnSpacing,
      rowSpacing
    );

    return atlas;
  }

  /**
   * Create an atlas from a JSON definition file.
   * The JSON should contain sprite names and their pixel rectangles.
   *
   * @param texture The texture containing the atlas
   * @param jsonData Parsed JSON object with sprite definitions
   * @returns A configured TextureAtlas
   *
   * @example
   * ```typescript
   * // JSON format:
   * // {
   * //   "textureWidth": 512,
   * //   "textureHeight": 512,
   * //   "sprites": {
   * //     "player": { "pixelRect": { "x": 0, "y": 0, "width": 32, "height": 32 } },
   * //     "enemy": { "pixelRect": { "x": 32, "y": 0, "width": 32, "height": 32 } }
   * //   }
   * // }
   *
   * const atlas = AtlasLoader.loadFromJSON(myTexture, jsonData);
   * ```
   */
  static loadFromJSON(
    texture: Texture,
    jsonData: {
      textureWidth?: number;
      textureHeight?: number;
      sprites: Record<string, { pixelRect: PixelRect }>;
    }
  ): TextureAtlas {
    const atlas = new TextureAtlas({ texture });
    atlas.fromJSON(jsonData);
    return atlas;
  }
}
