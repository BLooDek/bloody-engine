/**
 * Check if alignment is the issue
 */

import { GraphicsDevice } from "./dist/node/index.js";
import { SHADERS_V5 } from "./dist/node/index.js";

console.log("Testing alignment hypothesis");
console.log("=====================================\n");

const gdevice = new GraphicsDevice(800, 600);
const gl = gdevice.getGLContext();

// Test direct bufferSubData with different sizes
const testBuffer = gl.createBuffer();
gl.bindBuffer(gl.ARRAY_BUFFER, testBuffer);

// Test with 144 bytes (maxInstances=1)
console.log("Testing 144 bytes (maxInstances=1):");
gl.bufferData(gl.ARRAY_BUFFER, 144, gl.DYNAMIC_DRAW);
const data1 = new Float32Array(12); // 48 bytes
gl.bufferSubData(gl.ARRAY_BUFFER, 0, data1);
let error = gl.getError();
console.log(`  bufferSubData error: ${error === gl.NO_ERROR ? 'NO_ERROR' : error + ' (0x' + error.toString(16) + ')'}`);

// Test with 288 bytes (maxInstances=2)
console.log("\nTesting 288 bytes (maxInstances=2):");
gl.bufferData(gl.ARRAY_BUFFER, 288, gl.DYNAMIC_DRAW);
const data2 = new Float32Array(24); // 96 bytes
gl.bufferSubData(gl.ARRAY_BUFFER, 0, data2);
error = gl.getError();
console.log(`  bufferSubData error: ${error === gl.NO_ERROR ? 'NO_ERROR' : error + ' (0x' + error.toString(16) + ')'}`);

// Test with 256 bytes (alignment boundary)
console.log("\nTesting 256 bytes (alignment boundary):");
gl.bufferData(gl.ARRAY_BUFFER, 256, gl.DYNAMIC_DRAW);
const data3 = new Float32Array(20); // 80 bytes
gl.bufferSubData(gl.ARRAY_BUFFER, 0, data3);
error = gl.getError();
console.log(`  bufferSubData error: ${error === gl.NO_ERROR ? 'NO_ERROR' : error + ' (0x' + error.toString(16) + ')'}`);

// Test with 300 bytes (just above alignment)
console.log("\nTesting 300 bytes (just above alignment):");
gl.bufferData(gl.ARRAY_BUFFER, 300, gl.DYNAMIC_DRAW);
const data4 = new Float32Array(30); // 120 bytes
gl.bufferSubData(gl.ARRAY_BUFFER, 0, data4);
error = gl.getError();
console.log(`  bufferSubData error: ${error === gl.NO_ERROR ? 'NO_ERROR' : error + ' (0x' + error.toString(16) + ')'}`);

gl.deleteBuffer(testBuffer);

console.log("\n✅ Direct bufferSubData test complete!");
