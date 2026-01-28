/**
 * Test if drawArraysInstanced causes the error
 */

import { GraphicsDevice } from "./dist/node/index.js";
import { SHADERS_V5 } from "./dist/node/index.js";

console.log("Testing drawArraysInstanced directly");
console.log("=====================================\n");

const gdevice = new GraphicsDevice(800, 600);
const gl = gdevice.getGLContext();

function checkError(label) {
  const error = gl.getError();
  const status = error === gl.NO_ERROR ? 'NO_ERROR' : error + ' (0x' + error.toString(16) + ')';
  console.log(`  ${label}: ${status}`);
  return error === gl.NO_ERROR;
}

// Get instancing extension
const ext = gl.getExtension('ANGLE_instanced_arrays');
if (!ext || !ext._drawArraysInstanced) {
  console.log("❌ drawArraysInstanced not available!");
  gdevice.dispose();
  process.exit(1);
}

console.log("Extension: drawArraysInstanced available ✅");

// Create a minimal shader (just to have a valid program)
const vs = `
  attribute vec2 aPosition;
  void main() {
    gl_Position = vec4(aPosition, 0.0, 1.0);
  }
`;

const fs = `
  precision mediump float;
  void main() {
    gl_FragColor = vec4(1.0, 0.0, 0.0, 1.0);
  }
`;

const program = gl.createProgram();
const vsShader = gl.createShader(gl.VERTEX_SHADER);
gl.shaderSource(vsShader, vs);
gl.compileShader(vsShader);
gl.attachShader(program, vsShader);

const fsShader = gl.createShader(gl.FRAGMENT_SHADER);
gl.shaderSource(fsShader, fs);
gl.compileShader(fsShader);
gl.attachShader(program, fsShader);

gl.linkProgram(program);
gl.useProgram(program);

checkError("after shader setup");

// Test with different buffer sizes
for (const [maxInstances, label] of [[1, "maxInstances=1"], [2, "maxInstances=2"], [1000, "maxInstances=1000"]]) {
  console.log(`\n${label}:`);

  // Create instance buffer
  const instanceBuffer = gl.createBuffer();
  gl.bindBuffer(gl.ARRAY_BUFFER, instanceBuffer);
  const bufferSize = maxInstances * 12 * 4;
  gl.bufferData(gl.ARRAY_BUFFER, bufferSize, gl.DYNAMIC_DRAW);

  checkError("after bufferData");

  // Create position buffer
  const posBuffer = gl.createBuffer();
  gl.bindBuffer(gl.ARRAY_BUFFER, posBuffer);
  gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-0.5, -0.5, 0.5, -0.5, 0.5, 0.5, -0.5, -0.5, 0.5, 0.5, -0.5, 0.5]), gl.STATIC_DRAW);

  const posAttr = gl.getAttribLocation(program, "aPosition");
  gl.enableVertexAttribArray(posAttr);
  gl.vertexAttribPointer(posAttr, 2, gl.FLOAT, false, 0, 0);

  checkError("after position attribute");

  // Draw
  gl.clearColor(0.1, 0.1, 0.15, 1.0);
  gl.clear(gl.COLOR_BUFFER_BIT);

  console.log("  Calling drawArraysInstanced...");
  ext._drawArraysInstanced(gl.TRIANGLES, 0, 6, 1);

  checkError("after drawArraysInstanced");

  // Cleanup
  gl.deleteBuffer(instanceBuffer);
  gl.deleteBuffer(posBuffer);
}

gdevice.dispose();
console.log("\n✅ Test complete!");
