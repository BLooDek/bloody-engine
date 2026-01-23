/**
 * 2.5D Sprite Vertex Structure
 *
 * Defines the vertex format for 2.5D sprites with support for:
 * - Position (x, y, z)
 * - Texture coordinates (u, v)
 * - Color tint (r, g, b, a)
 * - Texture index (for texture atlases)
 *
 * Vertex Layout (9 floats per vertex):
 * [0-2] Position:    x, y, z
 * [3-4] TexCoord:    u, v
 * [5-8] Color:       r, g, b, a
 * [9]   TexIndex:    texture index (integer passed as float)
 */

/**
 * Represents a single vertex with all 2.5D sprite attributes
 */
export interface SpriteVertex {
  /** Position in world space */
  x: number;
  y: number;
  z: number;
  /** Texture coordinates */
  u: number;
  v: number;
  /** Color tint (0-1 range) */
  r: number;
  g: number;
  b: number;
  a: number;
  /** Texture index for texture atlas selection */
  texIndex: number;
}

/**
 * Float layout per vertex in the vertex buffer
 * Total: 10 floats per vertex
 */
export const VERTEX_LAYOUT = {
  FLOATS_PER_VERTEX: 10,
  POSITION_OFFSET: 0,
  TEXCOORD_OFFSET: 3,
  COLOR_OFFSET: 5,
  TEXINDEX_OFFSET: 9,
  STRIDE: 10 * 4, // 10 floats × 4 bytes
} as const;

/**
 * Convert a SpriteVertex to a Float32Array segment
 * Useful for building vertex buffers
 */
export function spriteVertexToArray(vertex: SpriteVertex): Float32Array {
  return new Float32Array([
    vertex.x,
    vertex.y,
    vertex.z, // position
    vertex.u,
    vertex.v, // texCoord
    vertex.r,
    vertex.g,
    vertex.b,
    vertex.a, // color
    vertex.texIndex, // texture index
  ]);
}

/**
 * Create a default sprite vertex
 * Useful for initialization
 */
export function createDefaultSpriteVertex(): SpriteVertex {
  return {
    x: 0,
    y: 0,
    z: 0,
    u: 0,
    v: 0,
    r: 1,
    g: 1,
    b: 1,
    a: 1,
    texIndex: 0,
  };
}

/**
 * Sprite quad instance data for batch rendering
 * Extends the basic QuadInstance with 2.5D sprite features
 */
export interface SpriteQuadInstance {
  /** Position in 2.5D space */
  x: number;
  y: number;
  z: number;
  /** Width and height */
  width: number;
  height: number;
  /** Rotation in radians */
  rotation: number;
  /** Color tint (0-1 range, default white) */
  color?: {
    r: number;
    g: number;
    b: number;
    a: number;
  };
  /** Texture coordinates (UV region in texture atlas) */
  uvRect?: {
    uMin: number;
    vMin: number;
    uMax: number;
    vMax: number;
  };
  /** Texture index for atlas selection */
  texIndex?: number;
}

/**
 * Generate 6 vertices (2 triangles) for a quad with the specified properties
 *
 * @param instance The sprite quad instance data
 * @returns Array of 6 vertices forming the quad
 */
export function generateQuadVertices(
  instance: SpriteQuadInstance,
): SpriteVertex[] {
  const {
    x,
    y,
    z,
    width,
    height,
    rotation,
    color = { r: 1, g: 1, b: 1, a: 1 },
    uvRect = { uMin: 0, vMin: 0, uMax: 1, vMax: 1 },
    texIndex = 0,
  } = instance;

  const halfW = width / 2;
  const halfH = height / 2;

  // Calculate rotation
  const cos = Math.cos(rotation);
  const sin = Math.sin(rotation);

  // Helper to rotate point around origin
  const rotatePoint = (px: number, py: number): [number, number] => {
    return [px * cos - py * sin, px * sin + py * cos];
  };

  // Define quad corners in local space (2 triangles = 6 vertices)
  const corners = [
    [-halfW, -halfH], // bottom-left
    [halfW, -halfH], // bottom-right
    [halfW, halfH], // top-right
    [halfW, halfH], // top-right (duplicate for second triangle)
    [-halfW, halfH], // top-left
    [-halfW, -halfH], // bottom-left (duplicate)
  ];

  // Define texture coordinates for each corner
  const texCoords = [
    [uvRect.uMin, uvRect.vMin], // bottom-left
    [uvRect.uMax, uvRect.vMin], // bottom-right
    [uvRect.uMax, uvRect.vMax], // top-right
    [uvRect.uMax, uvRect.vMax], // top-right
    [uvRect.uMin, uvRect.vMax], // top-left
    [uvRect.uMin, uvRect.vMin], // bottom-left
  ];

  // Generate vertices
  const vertices: SpriteVertex[] = [];
  for (let i = 0; i < corners.length; i++) {
    const [localX, localY] = corners[i];
    const [rotX, rotY] = rotatePoint(localX, localY);
    const [u, v] = texCoords[i];

    vertices.push({
      x: x + rotX,
      y: y + rotY,
      z: z,
      u: u,
      v: v,
      r: color.r,
      g: color.g,
      b: color.b,
      a: color.a,
      texIndex: texIndex,
    });
  }

  return vertices;
}
