// Basic Fragment Shader - Textured with Color Overlay
precision mediump float;

varying vec2 vTexCoord;
uniform sampler2D uTexture;
uniform vec3 uColor;

void main() {
  vec4 texColor = texture2D(uTexture, vTexCoord);
  gl_FragColor = vec4(texColor.rgb * uColor, texColor.a);
}
