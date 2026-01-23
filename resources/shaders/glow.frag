// Glow Fragment Shader - Additive bloom effect
precision mediump float;

varying vec2 vTexCoord;
varying float vDistance;
uniform sampler2D uTexture;
uniform vec3 uColor;
uniform float uGlowIntensity;

void main() {
  vec4 texColor = texture2D(uTexture, vTexCoord);
  // Better glow falloff - keeps minimum brightness
  float glow = 1.0 - (vDistance * 0.7); // Reduced falloff
  glow = max(0.5, glow); // Minimum 50% brightness
  vec3 glowColor = texColor.rgb * uColor * glow * uGlowIntensity;
  gl_FragColor = vec4(glowColor, texColor.a);
}
