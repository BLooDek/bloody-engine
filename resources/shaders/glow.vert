// Glow Vertex Shader
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
