/**
 * Shader Examples and Presets
 * Collection of shader implementations for different effects
 */

// ============================================
// BASIC: Textured with Color Overlay (Current)
// ============================================
export const BASIC_SHADER = {
  vertex: `
attribute vec3 aPosition;
attribute vec2 aTexCoord;

varying vec2 vTexCoord;

uniform mat4 uMatrix;

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
  vec4 texColor = texture2D(uTexture, vTexCoord);
  gl_FragColor = vec4(texColor.rgb * uColor, texColor.a);
}
`,
  uniforms: ["uMatrix", "uTexture", "uColor"],
  attributes: ["aPosition", "aTexCoord"],
};

// ============================================
// GLOW: Additive bloom effect
// ============================================
export const GLOW_SHADER = {
  vertex: `
attribute vec3 aPosition;
attribute vec2 aTexCoord;

varying vec2 vTexCoord;
varying float vDistance;

uniform mat4 uMatrix;

void main() {
  gl_Position = uMatrix * vec4(aPosition, 1.0);
  vTexCoord = aTexCoord;
  // Distance from center for glow falloff
  vDistance = length(aTexCoord - vec2(0.5, 0.5));
}
`,
  fragment: `
varying vec2 vTexCoord;
varying float vDistance;
uniform sampler2D uTexture;
uniform vec3 uColor;
uniform float uGlowIntensity;

void main() {
  vec4 texColor = texture2D(uTexture, vTexCoord);
  float glow = 1.0 - vDistance * 2.0;
  glow = max(0.0, glow);
  vec3 glowColor = texColor.rgb * uColor * glow * uGlowIntensity;
  gl_FragColor = vec4(glowColor, texColor.a);
}
`,
  uniforms: ["uMatrix", "uTexture", "uColor", "uGlowIntensity"],
  attributes: ["aPosition", "aTexCoord"],
};

// ============================================
// WAVE: Vertex wave deformation
// ============================================
export const WAVE_SHADER = {
  vertex: `
attribute vec3 aPosition;
attribute vec2 aTexCoord;

varying vec2 vTexCoord;

uniform mat4 uMatrix;
uniform float uTime;
uniform float uWaveAmount;

void main() {
  vec3 pos = aPosition;
  // Apply wave deformation
  pos.y += sin(aPosition.x * 3.14159 + uTime) * uWaveAmount;
  pos.x += cos(aPosition.y * 3.14159 + uTime * 0.7) * uWaveAmount * 0.5;
  
  gl_Position = uMatrix * vec4(pos, 1.0);
  vTexCoord = aTexCoord;
}
`,
  fragment: `
varying vec2 vTexCoord;
uniform sampler2D uTexture;
uniform vec3 uColor;

void main() {
  vec4 texColor = texture2D(uTexture, vTexCoord);
  gl_FragColor = vec4(texColor.rgb * uColor, texColor.a);
}
`,
  uniforms: ["uMatrix", "uTexture", "uColor", "uTime", "uWaveAmount"],
  attributes: ["aPosition", "aTexCoord"],
};

// ============================================
// NEON: High contrast with edge highlighting
// ============================================
export const NEON_SHADER = {
  vertex: `
attribute vec3 aPosition;
attribute vec2 aTexCoord;

varying vec2 vTexCoord;
varying vec3 vNormal;

uniform mat4 uMatrix;

void main() {
  gl_Position = uMatrix * vec4(aPosition, 1.0);
  vTexCoord = aTexCoord;
  // Simple normal based on position
  vNormal = normalize(aPosition);
}
`,
  fragment: `
varying vec2 vTexCoord;
varying vec3 vNormal;
uniform sampler2D uTexture;
uniform vec3 uColor;

void main() {
  vec4 texColor = texture2D(uTexture, vTexCoord);
  
  // High contrast
  vec3 enhanced = pow(texColor.rgb * uColor, vec3(0.5));
  
  // Edge highlight
  float edge = abs(vNormal.x) + abs(vNormal.y);
  edge = smoothstep(0.3, 1.0, edge) * 0.5;
  
  vec3 neonColor = enhanced + edge * uColor;
  gl_FragColor = vec4(neonColor, texColor.a);
}
`,
  uniforms: ["uMatrix", "uTexture", "uColor"],
  attributes: ["aPosition", "aTexCoord"],
};

// ============================================
// HOLOGRAM: Scan lines + transparency flicker
// ============================================
export const HOLOGRAM_SHADER = {
  vertex: `
attribute vec3 aPosition;
attribute vec2 aTexCoord;

varying vec2 vTexCoord;

uniform mat4 uMatrix;

void main() {
  gl_Position = uMatrix * vec4(aPosition, 1.0);
  vTexCoord = aTexCoord;
}
`,
  fragment: `
varying vec2 vTexCoord;
uniform sampler2D uTexture;
uniform vec3 uColor;
uniform float uTime;

void main() {
  vec4 texColor = texture2D(uTexture, vTexCoord);
  
  // Scan lines
  float scanLine = sin(vTexCoord.y * 50.0) * 0.1 + 0.9;
  
  // Flicker transparency
  float flicker = 0.8 + 0.2 * sin(uTime * 5.0 + vTexCoord.x * 10.0);
  
  vec3 hologramColor = texColor.rgb * uColor * scanLine;
  gl_FragColor = vec4(hologramColor, texColor.a * flicker);
}
`,
  uniforms: ["uMatrix", "uTexture", "uColor", "uTime"],
  attributes: ["aPosition", "aTexCoord"],
};

// ============================================
// CHROMATIC: Chromatic aberration effect
// ============================================
export const CHROMATIC_SHADER = {
  vertex: `
attribute vec3 aPosition;
attribute vec2 aTexCoord;

varying vec2 vTexCoord;

uniform mat4 uMatrix;

void main() {
  gl_Position = uMatrix * vec4(aPosition, 1.0);
  vTexCoord = aTexCoord;
}
`,
  fragment: `
varying vec2 vTexCoord;
uniform sampler2D uTexture;
uniform vec3 uColor;
uniform float uAberration;

void main() {
  float offset = uAberration * 0.01;
  
  float r = texture2D(uTexture, vTexCoord + vec2(offset, 0.0)).r;
  float g = texture2D(uTexture, vTexCoord).g;
  float b = texture2D(uTexture, vTexCoord - vec2(offset, 0.0)).b;
  
  vec3 aberrated = vec3(r, g, b) * uColor;
  gl_FragColor = vec4(aberrated, 1.0);
}
`,
  uniforms: ["uMatrix", "uTexture", "uColor", "uAberration"],
  attributes: ["aPosition", "aTexCoord"],
};

// ============================================
// PSYCHEDELIC: Rainbow color shift
// ============================================
export const PSYCHEDELIC_SHADER = {
  vertex: `
attribute vec3 aPosition;
attribute vec2 aTexCoord;

varying vec2 vTexCoord;

uniform mat4 uMatrix;

void main() {
  gl_Position = uMatrix * vec4(aPosition, 1.0);
  vTexCoord = aTexCoord;
}
`,
  fragment: `
varying vec2 vTexCoord;
uniform sampler2D uTexture;
uniform float uTime;

void main() {
  vec4 texColor = texture2D(uTexture, vTexCoord);
  
  // Rainbow shift based on position and time
  float hue = atan(vTexCoord.y - 0.5, vTexCoord.x - 0.5) / 3.14159;
  hue += uTime;
  
  float r = sin(hue) * 0.5 + 0.5;
  float g = sin(hue + 2.094) * 0.5 + 0.5;
  float b = sin(hue + 4.188) * 0.5 + 0.5;
  
  vec3 rainbow = vec3(r, g, b);
  gl_FragColor = vec4(texColor.rgb * rainbow, texColor.a);
}
`,
  uniforms: ["uMatrix", "uTexture", "uTime"],
  attributes: ["aPosition", "aTexCoord"],
};

// ============================================
// SHADER LIBRARY - Easy access
// ============================================
export const SHADER_LIBRARY = {
  BASIC: BASIC_SHADER,
  GLOW: GLOW_SHADER,
  WAVE: WAVE_SHADER,
  NEON: NEON_SHADER,
  HOLOGRAM: HOLOGRAM_SHADER,
  CHROMATIC: CHROMATIC_SHADER,
  PSYCHEDELIC: PSYCHEDELIC_SHADER,
};

export type ShaderPreset = keyof typeof SHADER_LIBRARY;
