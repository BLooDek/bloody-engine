/**
 * WebGL Extension Helper for Node.js
 *
 * headless-gl provides WebGL2 features through extensions rather than
 * direct context methods. This helper provides unified access to both.
 */

/**
 * Get instancing extension methods
 * Returns either direct methods or ANGLE_instanced_arrays extension
 * Handles both standard names and headless-gl's underscored names
 */
export function getInstancingMethods(gl: any): {
  drawArraysInstanced: Function;
  drawElementsInstanced: Function;
  vertexAttribDivisor: Function;
} | null {
  // Check for direct methods first (standard WebGL2)
  if (gl.drawArraysInstanced && gl.vertexAttribDivisor) {
    return {
      drawArraysInstanced: gl.drawArraysInstanced.bind(gl),
      drawElementsInstanced: gl.drawElementsInstanced?.bind(gl) || gl.drawArraysInstanced.bind(gl),
      vertexAttribDivisor: gl.vertexAttribDivisor.bind(gl),
    };
  }

  // Check for ANGLE_instanced_arrays extension
  const ext = gl.getExtension('ANGLE_instanced_arrays');
  if (ext) {
    // headless-gl uses underscored method names
    // These are already bound to the extension context, so we use them directly
    const drawArrays = ext.drawArraysInstanced || ext._drawArraysInstanced;
    const drawElements = ext.drawElementsInstanced || ext._drawElementsInstanced;
    const divisor = ext.vertexAttribDivisor || ext._vertexAttribDivisor;

    if (drawArrays && divisor) {
      // Check if these are native functions (already bound) or need to be bound
      // In headless-gl, the underscored versions are already bound native functions
      if (ext._drawArraysInstanced && typeof ext._drawArraysInstanced === 'function') {
        // Use underscored versions directly (already bound in headless-gl)
        return {
          drawArraysInstanced: ext._drawArraysInstanced,
          drawElementsInstanced: ext._drawElementsInstanced,
          vertexAttribDivisor: ext._vertexAttribDivisor,
        };
      } else {
        // Try to bind the methods (for standard WebGL2 or other implementations)
        return {
          drawArraysInstanced: drawArrays.bind(ext),
          drawElementsInstanced: drawElements?.bind(ext) || drawArrays.bind(ext),
          vertexAttribDivisor: divisor.bind(ext),
        };
      }
    }
  }

  return null;
}

/**
 * Check if instancing is available
 */
export function hasInstancingSupport(gl: any): boolean {
  return getInstancingMethods(gl) !== null;
}

/**
 * Get WebGL2 buffer mapping methods
 * Returns either direct methods or checks for extension support
 */
export function getBufferMappingMethods(gl: any): {
  mapBufferRange: Function;
  unmapBuffer: Function;
  fenceSync: Function;
  clientWaitSync: Function;
  deleteSync: Function;
} | null {
  // Check for direct methods
  if (gl.mapBufferRange && gl.fenceSync) {
    return {
      mapBufferRange: gl.mapBufferRange.bind(gl),
      unmapBuffer: gl.unmapBuffer.bind(gl),
      fenceSync: gl.fenceSync.bind(gl),
      clientWaitSync: gl.clientWaitSync.bind(gl),
      deleteSync: gl.deleteSync.bind(gl),
    };
  }

  // headless-gl doesn't provide these through extensions
  // They may not be available at all
  return null;
}
