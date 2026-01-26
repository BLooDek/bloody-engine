import { ProjectionConfig, type GridCoord } from "../rendering/projection";

/**
 * Scene configuration and constants
 * Shared between Node.js and Browser rendering
 */

export const SCENE_CONFIG = {
  width: 800,
  height: 600,
  targetFPS: 60,
};

// ============================================================================
// Projection Configuration
// ============================================================================

export const PROJECTION_CONFIG = new ProjectionConfig(
  64, // tileWidth: 64 pixels
  32, // tileHeight: 32 pixels
  1.0, // zScale: 1:1 height scale
);

/**
 * Entity for visualization (used in projection demo)
 */
export interface VisualizationEntity {
  id: string;
  name: string;
  gridPos: GridCoord;
  color: [number, number, number]; // RGB [0, 1]
  size: number; // Relative size for rendering
}

/**
 * Projection visualization entities to render
 */
export const PROJECTION_ENTITIES: VisualizationEntity[] = [
  {
    id: "player",
    name: "Player",
    gridPos: { xgrid: 5, ygrid: 5, zheight: 0 },
    color: [0.2, 1.0, 0.2], // Green
    size: 1.0,
  },
  {
    id: "enemy1",
    name: "Enemy",
    gridPos: { xgrid: 10, ygrid: 8, zheight: 0 },
    color: [1.0, 0.2, 0.2], // Red
    size: 0.9,
  },
  {
    id: "chest",
    name: "Treasure",
    gridPos: { xgrid: 8, ygrid: 6, zheight: 0 },
    color: [1.0, 1.0, 0.2], // Yellow
    size: 0.7,
  },
  {
    id: "tower",
    name: "Tower",
    gridPos: { xgrid: 12, ygrid: 12, zheight: 3 },
    color: [0.5, 0.5, 1.0], // Light Blue
    size: 0.8,
  },
  {
    id: "floating",
    name: "Floating Object",
    gridPos: { xgrid: 3, ygrid: 10, zheight: 5 },
    color: [1.0, 0.5, 1.0], // Magenta
    size: 0.6,
  },
];

// Geometry definitions
export const GEOMETRY = {
  quad: {
    name: "quad",
    vertices: new Float32Array([
      // Position               TexCoord
      -0.5,
      -0.5,
      0.0,
      0.0,
      0.0, // Bottom-left
      0.5,
      -0.5,
      0.0,
      1.0,
      0.0, // Bottom-right
      0.5,
      0.5,
      0.0,
      1.0,
      1.0, // Top-right
      0.5,
      0.5,
      0.0,
      1.0,
      1.0, // Top-right
      -0.5,
      0.5,
      0.0,
      0.0,
      1.0, // Top-left
      -0.5,
      -0.5,
      0.0,
      0.0,
      0.0, // Bottom-left
    ]),
    stride: 5 * 4, // 5 floats per vertex × 4 bytes
  },

  triangle: {
    name: "triangle",
    vertices: new Float32Array([
      // Position               TexCoord
      0.0,
      0.5,
      0.0,
      0.5,
      1.0, // Top
      -0.5,
      -0.5,
      0.0,
      0.0,
      0.0, // Bottom-left
      0.5,
      -0.5,
      0.0,
      1.0,
      0.0, // Bottom-right
    ]),
    stride: 5 * 4, // 5 floats per vertex × 4 bytes
  },
};

// ============================================================================
// V1 Shaders (Basic - for backward compatibility)
// ============================================================================
export const SHADERS_V1 = {
  vertex: `
attribute vec3 aPosition;
attribute vec2 aTexCoord;

varying vec2 vTexCoord;

uniform mat4 uMatrix;
uniform vec3 uColor;

void main() {
  gl_Position = uMatrix * vec4(aPosition, 1.0);
  vTexCoord = aTexCoord;
}
`,

  fragment: `
varying vec2 vTexCoord;
uniform sampler2D uTexture;
uniform vec3 uColor;

void main() {
  // Use texture * color overlay for better visibility
  vec4 texColor = texture2D(uTexture, vTexCoord);
  gl_FragColor = vec4(texColor.rgb * uColor, texColor.a);
}
`,
};

// ============================================================================
// V2 Shaders (2.5D Sprite with color tint and texture atlas support)
// ============================================================================
export const SHADERS_V2 = {
  vertex: `
attribute vec3 aPosition;
attribute vec2 aTexCoord;
attribute vec4 aColor;
attribute float aTexIndex;

varying vec2 vTexCoord;
varying vec4 vColor;
varying float vTexIndex;

uniform mat4 uMatrix;

void main() {
  gl_Position = uMatrix * vec4(aPosition, 1.0);
  vTexCoord = aTexCoord;
  vColor = aColor;
  vTexIndex = aTexIndex;
}
`,

  fragment: `
precision mediump float;

varying vec2 vTexCoord;
varying vec4 vColor;
varying float vTexIndex;

uniform sampler2D uTexture;

void main() {
  // Sample texture
  vec4 texColor = texture2D(uTexture, vTexCoord);

  // Apply vertex color tint
  gl_FragColor = texColor * vColor;
}
`,
};

// Alias for backward compatibility
export const SHADERS = SHADERS_V1;

/**
 * SHADERS_V3 - GPU-Based 2.5D Transformation
 *
 * This version moves the isometric projection from CPU to GPU.
 * The vertex shader receives grid coordinates and transforms them to screen space.
 *
 * Attributes:
 * - aGridPosition: Grid position (x, y) in world space
 * - aZPosition: Z position for depth layering
 * - aLocalOffset: Local offset from quad center (for rotation)
 * - aTexCoord: Texture coordinates
 * - aColor: Color tint
 * - aTexIndex: Texture atlas index
 *
 * Uniforms:
 * - uTileSize: Size of tiles (width, height) for isometric projection
 * - uCamera: Camera position (x, y) and zoom
 * - uRotation: Rotation angle in radians
 * - uQuadSize: Size of the quad (width, height)
 * - uZScale: Scale factor for Z height (vertical exaggeration)
 * - uResolution: Screen resolution for NDC conversion
 */
export const SHADERS_V3 = {
  vertex: `
attribute vec2 aGridPosition;
attribute float aZPosition;
attribute vec2 aLocalOffset;
attribute vec2 aTexCoord;
attribute vec4 aColor;
attribute float aTexIndex;

varying vec2 vTexCoord;
varying vec4 vColor;
varying float vTexIndex;

uniform vec2 uTileSize;
uniform vec3 uCamera;
uniform float uRotation;
uniform vec2 uQuadSize;
uniform float uZScale;
uniform vec2 uResolution;

void main() {
  // Isometric projection: grid (x, y) -> screen (x, y)
  // xscreen = (xgrid - ygrid) * tileWidth / 2
  // yscreen = (xgrid + ygrid) * tileHeight / 2
  vec2 isoScreen = vec2(
    (aGridPosition.x - aGridPosition.y) * uTileSize.x * 0.5,
    (aGridPosition.x + aGridPosition.y) * uTileSize.y * 0.5
  );

  // Apply rotation to local offset
  float cosR = cos(uRotation);
  float sinR = sin(uRotation);
  vec2 rotatedOffset = vec2(
    aLocalOffset.x * cosR - aLocalOffset.y * sinR,
    aLocalOffset.x * sinR + aLocalOffset.y * cosR
  ) * uQuadSize;

  // Combine isometric screen position with rotated offset
  vec2 worldPos = isoScreen + rotatedOffset;

  // Subtract z-height from y position (height goes up in screen space, which is negative y)
  worldPos.y -= aZPosition * uZScale;

  // Apply camera transform
  // Translation: subtract camera position
  vec2 cameraPos = worldPos - uCamera.xy;

  // Scale by zoom (zoom around camera center)
  vec2 finalPos = cameraPos * uCamera.z;

  // Convert to NDC (Normalized Device Coordinates)
  // Center is (0, 0), range is [-1, 1]
  vec2 ndc = finalPos / (uResolution * 0.5);

  gl_Position = vec4(ndc, aZPosition * 0.001, 1.0);

  // Pass through to fragment shader
  vTexCoord = aTexCoord;
  vColor = aColor;
  vTexIndex = aTexIndex;
}
`,

  fragment: `
precision mediump float;

varying vec2 vTexCoord;
varying vec4 vColor;
varying float vTexIndex;

uniform sampler2D uTexture;

void main() {
  // Sample texture
  vec4 texColor = texture2D(uTexture, vTexCoord);

  // Apply vertex color tint
  gl_FragColor = texColor * vColor;
}
`,
};

/**
 * SHADERS_V4 - Instanced Rendering with GPU Streaming
 *
 * This version adds instanced rendering support for efficient rendering
 * of many identical meshes with different per-instance attributes.
 *
 * Static Attributes (per-vertex, shared across all instances):
 * - aPosition: Local quad position (x, y) in [-0.5, 0.5]
 * - aTexCoord: Texture coordinates (u, v)
 *
 * Instanced Attributes (per-instance, advance once per instance):
 * - aGridPosition: Grid position (x, y)
 * - aZPosition: Z height
 * - aColor: Color tint (r, g, b, a)
 * - aTexIndex: Texture atlas index
 * - aUVOffset: UV offset for sprite sheets
 * - aSize: Sprite size (width, height)
 *
 * Uniforms:
 * - uMatrix: View matrix (camera transform)
 * - uTileSize: Size for isometric projection
 * - uZScale: Z height scale factor
 */
export const SHADERS_V4 = {
  vertex: `
// Static attributes (shared across all instances)
attribute vec2 aPosition;
attribute vec2 aTexCoord;

// Instanced attributes (one per instance)
attribute vec2 aGridPosition;
attribute float aZPosition;
attribute vec4 aColor;
attribute float aTexIndex;
attribute vec2 aUVOffset;
attribute vec2 aSize;

// Varyings to fragment shader
varying vec2 vTexCoord;
varying vec4 vColor;
varying float vTexIndex;

// Uniforms
uniform mat4 uMatrix;
uniform vec2 uTileSize;
uniform float uZScale;

void main() {
  // Calculate local quad position with size
  vec2 localPos = aPosition * aSize;

  // Isometric projection: grid (x, y) -> screen (x, y)
  vec2 isoScreen = vec2(
    (aGridPosition.x - aGridPosition.y) * uTileSize.x * 0.5,
    (aGridPosition.x + aGridPosition.y) * uTileSize.y * 0.5
  );

  // Combine isometric screen position with local offset
  vec2 worldPos = isoScreen + localPos;

  // Subtract z-height from y position
  worldPos.y -= aZPosition * uZScale;

  // Apply camera transform
  vec4 clipPos = uMatrix * vec4(worldPos, aZPosition * 0.001, 1.0);

  gl_Position = clipPos;

  // Pass texture coordinates with offset
  vTexCoord = aTexCoord + aUVOffset;
  vColor = aColor;
  vTexIndex = aTexIndex;
}
`,

  fragment: `
precision mediump float;

varying vec2 vTexCoord;
varying vec4 vColor;
varying float vTexIndex;

uniform sampler2D uTexture;

void main() {
  // Sample texture
  vec4 texColor = texture2D(uTexture, vTexCoord);

  // Apply vertex color tint
  gl_FragColor = texColor * vColor;
}
`,
};

/**
 * SHADERS_V6 - GPU-Based Top-Down 2D Transformation
 *
 * This is a non-isometric variant of V3 for standard top-down 2D rendering.
 * The vertex shader receives world/grid coordinates and applies camera transform.
 *
 * Attributes:
 * - aGridPosition: World/Grid position (x, y) - NOT transformed isometrically
 * - aZPosition: Z depth (for depth sorting/layering)
 * - aLocalOffset: Local quad offset (corner positions)
 * - aTexCoord: Texture coordinates (u, v)
 * - aColor: Color tint (r, g, b, a)
 * - aTexIndex: Texture atlas index
 *
 * Uniforms:
 * - uTileSize: NOT USED in top-down (kept for compatibility)
 * - uCamera: Camera position (x, y) and zoom
 * - uRotation: Rotation angle in radians
 * - uQuadSize: Size of the quad (width, height)
 * - uZScale: Z depth scale factor
 * - uResolution: Screen resolution for NDC conversion
 */
export const SHADERS_V6 = {
  vertex: `
attribute vec2 aGridPosition;
attribute float aZPosition;
attribute vec2 aLocalOffset;
attribute vec2 aTexCoord;
attribute vec4 aColor;
attribute float aTexIndex;

varying vec2 vTexCoord;
varying vec4 vColor;
varying float vTexIndex;

uniform vec2 uTileSize;      // Kept for API compatibility, not used in top-down
uniform vec3 uCamera;        // x, y, zoom
uniform float uRotation;
uniform vec2 uQuadSize;
uniform float uZScale;
uniform vec2 uResolution;

void main() {
  // Apply rotation to local offset
  float cosR = cos(uRotation);
  float sinR = sin(uRotation);
  vec2 rotatedOffset = vec2(
    aLocalOffset.x * cosR - aLocalOffset.y * sinR,
    aLocalOffset.x * sinR + aLocalOffset.y * cosR
  ) * uQuadSize;

  // TOP-DOWN: Use grid position directly as world position
  // NO isometric projection - simple 2D top-down view
  vec2 worldPos = aGridPosition + rotatedOffset;

  // Z is used for depth sorting only, not visual height
  float depth = aZPosition * uZScale;

  // Apply camera transform
  // Translation: subtract camera position
  vec2 cameraPos = worldPos - uCamera.xy;

  // Scale by zoom (zoom around camera center)
  vec2 finalPos = cameraPos * uCamera.z;

  // Convert to NDC (Normalized Device Coordinates)
  // Center is (0, 0), range is [-1, 1]
  vec2 ndc = finalPos / (uResolution * 0.5);

  gl_Position = vec4(ndc, depth * 0.001, 1.0);

  // Pass through to fragment shader
  vTexCoord = aTexCoord;
  vColor = aColor;
  vTexIndex = aTexIndex;
}
`,

  fragment: `
precision mediump float;

varying vec2 vTexCoord;
varying vec4 vColor;
varying float vTexIndex;

uniform sampler2D uTexture;

void main() {
  // Sample texture
  vec4 texColor = texture2D(uTexture, vTexCoord);

  // Apply vertex color tint
  gl_FragColor = texColor * vColor;
}
`,
};

/**
 * SHADERS_V5 - Instanced Rendering (Top-Down Orthographic)
 *
 * This is a non-isometric variant of V4 for standard top-down 2D rendering.
 * Removes the isometric projection and uses direct grid/world coordinates.
 *
 * Static Attributes (per-vertex, shared across all instances):
 * - aPosition: Local quad position (x, y) in [-0.5, 0.5]
 * - aTexCoord: Texture coordinates (u, v)
 *
 * Instanced Attributes (per-instance, advances once per instance):
 * - aGridPosition: World/Grid position (x, y) - NOT transformed isometrically
 * - aZPosition: Z depth (for depth sorting/layering, not visual height)
 * - aColor: Color tint (r, g, b, a)
 * - aTexIndex: Texture atlas index
 * - aUVOffset: UV offset for sprite sheets
 * - aSize: Sprite size (width, height)
 *
 * Uniforms:
 * - uCamera: Camera position (x, y, zoom)
 * - uResolution: Framebuffer size (width, height) for NDC conversion
 * - uZScale: Z depth scale factor
 */
export const SHADERS_V5 = {
  vertex: `
// Static attributes (shared across all instances)
attribute vec2 aPosition;
attribute vec2 aTexCoord;

// Instanced attributes (one per instance)
attribute vec2 aGridPosition;
attribute float aZPosition;
attribute vec4 aColor;
attribute float aTexIndex;
attribute vec2 aUVOffset;
attribute vec2 aSize;

// Varyings to fragment shader
varying vec2 vTexCoord;
varying vec4 vColor;
varying float vTexIndex;

// Uniforms
uniform vec3 uCamera;      // x, y, zoom
uniform vec2 uResolution;  // width, height
uniform float uZScale;

void main() {
  // Calculate local quad position with size
  vec2 localPos = aPosition * aSize;

  // TOP-DOWN: Use grid position directly as world position
  // NO isometric projection - simple 2D top-down view
  vec2 worldPos = aGridPosition + localPos;

  // Z is used for depth sorting (lower values = background, higher = foreground)
  // Not subtracted from Y since this is top-down, not isometric
  float depth = aZPosition * uZScale;

  // Apply camera transform (same as V6 batch shader)
  // Translation: subtract camera position
  vec2 cameraPos = worldPos - uCamera.xy;

  // Scale by zoom (zoom around camera center)
  vec2 finalPos = cameraPos * uCamera.z;

  // Convert to NDC (Normalized Device Coordinates)
  // Center is (0, 0), range is [-1, 1]
  vec2 ndc = finalPos / (uResolution * 0.5);

  gl_Position = vec4(ndc, depth * 0.001, 1.0);

  // Pass texture coordinates with offset
  vTexCoord = aTexCoord + aUVOffset;
  vColor = aColor;
  vTexIndex = aTexIndex;
}
`,

  fragment: `
precision mediump float;

varying vec2 vTexCoord;
varying vec4 vColor;
varying float vTexIndex;

uniform sampler2D uTexture;

void main() {
  // Sample texture
  vec4 texColor = texture2D(uTexture, vTexCoord);

  // Apply vertex color tint
  gl_FragColor = texColor * vColor;
}
`,
};

// Texture config
export const TEXTURE_CONFIG = {
  size: 256,
  type: "gradient", // gradient, solid, etc.
};

// Animation configuration
export const ANIMATION_CONFIG = {
  background: {
    offsetR: 0.1,
    amplitudeR: 0.1,
    speedR: 1.0,

    offsetG: 0.1,
    amplitudeG: 0.1,
    speedG: 0.7,

    offsetB: 0.15,
    amplitudeB: 0.1,
    speedB: 0.5,
  },

  quads: {
    count: 3,
    scale: 0.4,
    baseRadius: 0.5,
    radiusVariation: 0.2,
    radiusSpeed: 0.3,
    orbitalSpeed: 0.5,
    rotationSpeed: 1.0,
    colors: [
      [1.0, 0.2, 0.2], // Red
      [0.2, 1.0, 0.2], // Green
      [0.2, 0.2, 1.0], // Blue
    ],
  },

  triangles: {
    count: 2,
    scale: 0.3,
    baseRadius: 0.3,
    radiusVariation: 0.15,
    radiusSpeed: 0.4,
    orbitalSpeed: 0.7,
    rotationSpeed: 1.5,
    rotationDirection: -1, // -1 for reverse
    colors: [
      [1.0, 1.0, 0.2], // Yellow
      [0.2, 1.0, 1.0], // Cyan
    ],
  },
};

/**
 * Calculate background color for a given elapsed time
 */
export function getBackgroundColor(elapsedSeconds: number) {
  const cfg = ANIMATION_CONFIG.background;
  return {
    r: cfg.offsetR + cfg.amplitudeR * Math.sin(elapsedSeconds * cfg.speedR),
    g: cfg.offsetG + cfg.amplitudeG * Math.cos(elapsedSeconds * cfg.speedG),
    b: cfg.offsetB + cfg.amplitudeB * Math.sin(elapsedSeconds * cfg.speedB),
    a: 1.0,
  };
}

/**
 * Calculate quad transformations for animation
 */
export function getQuadTransforms(elapsedSeconds: number) {
  const cfg = ANIMATION_CONFIG.quads;
  const transforms = [];

  for (let i = 0; i < cfg.count; i++) {
    const angle =
      (i / cfg.count) * Math.PI * 2 + elapsedSeconds * cfg.orbitalSpeed;
    const radius =
      cfg.baseRadius +
      cfg.radiusVariation * Math.sin(elapsedSeconds * cfg.radiusSpeed + i);
    const posX = radius * Math.cos(angle);
    const posY = radius * Math.sin(angle);
    const rotation =
      elapsedSeconds * cfg.rotationSpeed + (i * Math.PI * 2) / cfg.count;

    const cos = Math.cos(rotation);
    const sin = Math.sin(rotation);

    const matrix = new Float32Array([
      cos * cfg.scale,
      sin * cfg.scale,
      0,
      0,
      -sin * cfg.scale,
      cos * cfg.scale,
      0,
      0,
      0,
      0,
      1,
      0,
      posX,
      posY,
      0,
      1,
    ]);

    transforms.push({
      matrix,
      color: cfg.colors[i],
      index: i,
    });
  }

  return transforms;
}

/**
 * Calculate triangle transformations for animation
 */
export function getTriangleTransforms(elapsedSeconds: number) {
  const cfg = ANIMATION_CONFIG.triangles;
  const transforms = [];

  for (let i = 0; i < cfg.count; i++) {
    const angle =
      (i / cfg.count) * Math.PI * 2 + elapsedSeconds * cfg.orbitalSpeed;
    const radius =
      cfg.baseRadius +
      cfg.radiusVariation * Math.cos(elapsedSeconds * cfg.radiusSpeed + i);
    const posX = radius * Math.cos(angle);
    const posY = radius * Math.sin(angle);
    const rotation =
      cfg.rotationDirection * elapsedSeconds * cfg.rotationSpeed +
      (i * Math.PI * 2) / cfg.count;

    const cos = Math.cos(rotation);
    const sin = Math.sin(rotation);

    const matrix = new Float32Array([
      cos * cfg.scale,
      sin * cfg.scale,
      0,
      0,
      -sin * cfg.scale,
      cos * cfg.scale,
      0,
      0,
      0,
      0,
      1,
      0,
      posX,
      posY,
      0,
      1,
    ]);

    transforms.push({
      matrix,
      color: cfg.colors[i],
      index: i,
    });
  }

  return transforms;
}
