/**
 * Sprite Atlas System Demo
 *
 * This example demonstrates how to use the TextureAtlas and Sprite classes
 * to manage UV coordinates for sprites within a texture atlas.
 */

import { TextureAtlas, AtlasLoader } from "../public-api";
import type { Texture } from "../public-api";

/**
 * Example 1: Creating an atlas from a regular grid sprite sheet
 */
export function example1_gridSpriteSheet(texture: Texture) {
  console.log("=== Example 1: Grid Sprite Sheet ===");

  // Create atlas from a 4x4 grid of 32x32 sprites
  const atlas = AtlasLoader.loadFromGrid(texture, {
    spriteWidth: 32,
    spriteHeight: 32,
    columns: 4,
    rows: 4,
    prefix: "tile_",
  });

  console.log(atlas.toString()); // TextureAtlas(128x128, 16 sprites)

  // Access individual sprites
  const tile = atlas.getSprite("tile_2_3");
  console.log(tile?.toString()); // Sprite("tile_2_3", 32x32)
}

/**
 * Example 2: Creating an atlas and defining sprites manually
 */
export function example2_manualDefinition(texture: Texture) {
  console.log("\n=== Example 2: Manual Sprite Definition ===");

  const atlas = new TextureAtlas({ texture });

  // Define individual sprites by pixel coordinates
  atlas.defineSprite("player_idle_1", { x: 0, y: 0, width: 32, height: 32 });
  atlas.defineSprite("player_idle_2", { x: 32, y: 0, width: 32, height: 32 });
  atlas.defineSprite("player_walk_1", { x: 64, y: 0, width: 32, height: 32 });
  atlas.defineSprite("player_walk_2", { x: 96, y: 0, width: 32, height: 32 });

  // Define sprites by UV coordinates (useful for irregular layouts)
  atlas.defineSpriteUV("background", { uMin: 0, vMin: 0, uMax: 1, vMax: 1 }, 512, 512);

  console.log(`Atlas has ${atlas.getSpriteCount()} sprites`);
  console.log("Sprite names:", atlas.getSpriteNames());
}

/**
 * Example 3: Using sprites with the batch renderer
 */
export function example3_renderingWithSprites(
  atlas: TextureAtlas,
  // In a real scenario, you'd pass your batch renderer here
  // batchRenderer: SpriteBatchRenderer
) {
  console.log("\n=== Example 3: Rendering with Sprites ===");

  // Get a sprite from the atlas
  const sprite = atlas.getSprite("player_idle_1");
  if (!sprite) {
    console.error("Sprite not found!");
    return;
  }

  // Use sprite properties for rendering
  const quadData = {
    x: 100,
    y: 100,
    z: 0,
    width: sprite.getWidth() * 2, // Scale up by 2x
    height: sprite.getHeight() * 2,
    rotation: 0,
    color: { r: 1, g: 1, b: 1, a: 1 },
    uvRect: sprite.toQuadUVRect(),
    texIndex: 0,
  };

  // In real code:
  // batchRenderer.addQuad(quadData);

  console.log("Quad data prepared for rendering:", quadData);
}

/**
 * Example 4: Loading atlas from JSON
 */
export function example4_loadFromJSON(texture: Texture) {
  console.log("\n=== Example 4: Load from JSON ===");

  // Simulated JSON data (in real use, load from file)
  const jsonData = {
    textureWidth: 256,
    textureHeight: 256,
    sprites: {
      player: { pixelRect: { x: 0, y: 0, width: 32, height: 32 } },
      enemy: { pixelRect: { x: 32, y: 0, width: 32, height: 32 } },
      tree: { pixelRect: { x: 64, y: 0, width: 64, height: 64 } },
      rock: { pixelRect: { x: 128, y: 0, width: 32, height: 24 } },
    },
  };

  const atlas = AtlasLoader.loadFromJSON(texture, jsonData);

  console.log(`Loaded ${atlas.getSpriteCount()} sprites from JSON`);
  console.log("Sprite names:", atlas.getSpriteNames());
}

/**
 * Example 5: Creating a tileset atlas
 */
export function example5_tilesetAtlas(texture: Texture) {
  console.log("\n=== Example 5: Tileset Atlas ===");

  const atlas = new TextureAtlas({ texture });

  // Define a tileset with 16x16 tiles
  const tileNames = atlas.defineGrid(
    "grass_", // prefix
    0, // startX
    0, // startY
    16, // tileWidth
    16, // tileHeight
    8, // columns
    8, // rows
    1, // columnSpacing (1px gap)
    1  // rowSpacing
  );

  console.log(`Created tileset with ${tileNames.length} tiles`);

  // Access specific tiles
  const topLeftTile = atlas.getSprite("grass_0_0");
  const bottomRightTile = atlas.getSprite("grass_7_7");

  console.log("Top-left tile:", topLeftTile?.toString());
  console.log("Bottom-right tile:", bottomRightTile?.toString());
}

/**
 * Example 6: Serializing atlas to JSON
 */
export function example6_serializeAtlas(texture: Texture) {
  console.log("\n=== Example 6: Serialize Atlas ===");

  const atlas = new TextureAtlas({ texture });

  // Define some sprites
  atlas.defineSprite("sprite1", { x: 0, y: 0, width: 32, height: 32 });
  atlas.defineSprite("sprite2", { x: 32, y: 0, width: 32, height: 32 });

  // Serialize to JSON
  const json = atlas.toJSON();
  console.log("Serialized atlas:", JSON.stringify(json, null, 2));

  // In real use, you'd save this to a file:
  // fs.writeFileSync("atlas.json", JSON.stringify(json, null, 2));
}

/**
 * Example 7: Error handling
 */
export function example7_errorHandling(texture: Texture) {
  console.log("\n=== Example 7: Error Handling ===");

  const atlas = new TextureAtlas({ texture });

  // This will throw an error - sprite extends beyond texture bounds
  try {
    atlas.defineSprite("invalid", { x: 1000, y: 1000, width: 32, height: 32 });
  } catch (error) {
    console.error("Caught error:", (error as Error).message);
  }

  // This will throw an error - invalid UV coordinates
  try {
    atlas.defineSpriteUV("invalid_uv", { uMin: 0.5, vMin: 0, uMax: 0.2, vMax: 1 });
  } catch (error) {
    console.error("Caught error:", (error as Error).message);
  }
}

/**
 * Example 8: Sprite properties and utilities
 */
export function example8_spriteProperties(texture: Texture) {
  console.log("\n=== Example 8: Sprite Properties ===");

  const atlas = new TextureAtlas({ texture });

  // Define some sprites with different sizes
  atlas.defineSprite("square", { x: 0, y: 0, width: 32, height: 32 });
  atlas.defineSprite("wide", { x: 32, y: 0, width: 64, height: 32 });
  atlas.defineSprite("tall", { x: 96, y: 0, width: 32, height: 64 });

  // Get sprite properties
  const square = atlas.getSprite("square");
  const wide = atlas.getSprite("wide");
  const tall = atlas.getSprite("tall");

  if (square && wide && tall) {
    console.log("Square sprite:");
    console.log("  Dimensions:", square.getWidth(), "x", square.getHeight());
    console.log("  Aspect ratio:", square.getAspectRatio());
    console.log("  UV rect:", square.getUVRect());
    console.log("  Pixel rect:", square.getPixelRect());

    console.log("\nWide sprite:");
    console.log("  Aspect ratio:", wide.getAspectRatio());

    console.log("\nTall sprite:");
    console.log("  Aspect ratio:", tall.getAspectRatio());
  }
}

/**
 * Example 9: Sprite lookup and validation
 */
export function example9_spriteLookup(texture: Texture) {
  console.log("\n=== Example 9: Sprite Lookup ===");

  const atlas = new TextureAtlas({ texture });

  atlas.defineSprite("player", { x: 0, y: 0, width: 32, height: 32 });

  // Check if sprite exists
  console.log("Has 'player' sprite?", atlas.hasSprite("player"));
  console.log("Has 'enemy' sprite?", atlas.hasSprite("enemy"));

  // Safe sprite retrieval
  const sprite = atlas.getSprite("player");
  if (sprite) {
    console.log("Found sprite:", sprite.getName());
  } else {
    console.log("Sprite not found");
  }

  // Get all sprite names
  atlas.defineSprite("enemy", { x: 32, y: 0, width: 32, height: 32 });
  console.log("All sprites:", atlas.getSpriteNames());
}

/**
 * Example 10: Clearing and managing sprites
 */
export function example10_managingSprites(texture: Texture) {
  console.log("\n=== Example 10: Managing Sprites ===");

  const atlas = new TextureAtlas({ texture });

  // Add some sprites
  atlas.defineSprite("temp1", { x: 0, y: 0, width: 32, height: 32 });
  atlas.defineSprite("temp2", { x: 32, y: 0, width: 32, height: 32 });
  atlas.defineSprite("permanent", { x: 64, y: 0, width: 32, height: 32 });

  console.log("Initial count:", atlas.getSpriteCount());

  // Remove individual sprite
  atlas.removeSprite("temp1");
  console.log("After removing 'temp1':", atlas.getSpriteCount());

  // Clear all sprites
  atlas.clear();
  console.log("After clear:", atlas.getSpriteCount());
}

/**
 * Run all examples
 */
export function runAllExamples(texture: Texture) {
  example1_gridSpriteSheet(texture);
  example2_manualDefinition(texture);
  example3_renderingWithSprites(new TextureAtlas({ texture }));
  example4_loadFromJSON(texture);
  example5_tilesetAtlas(texture);
  example6_serializeAtlas(texture);
  example7_errorHandling(texture);
  example8_spriteProperties(texture);
  example9_spriteLookup(texture);
  example10_managingSprites(texture);
}

// Export for use in other demos
export { example1_gridSpriteSheet as demo1, example2_manualDefinition as demo2 };
