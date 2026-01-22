/**
 * Scene configuration and constants
 * Shared between Node.js and Browser rendering
 */

export const SCENE_CONFIG = {
  width: 800,
  height: 600,
  targetFPS: 60,
};

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

// Shader sources
export const SHADERS = {
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
