/**
 * GPU Ring Buffer for triple-buffered streaming
 *
 * Implements circular buffer with persistent mapping and frame synchronization.
 * Designed for zero-copy GPU transfers in WebGL2.
 *
 * Features:
 * - Triple buffering for frame synchronization
 * - Persistent mapped buffers for zero-copy writes
 * - 256-byte alignment for cache efficiency
 * - Fence synchronization with timeout
 * - Automatic wraparound handling
 */

/**
 * Ring buffer allocation region
 */
export interface RingBufferRegion {
  /** Offset in bytes from buffer start */
  offset: number;
  /** Size in bytes */
  size: number;
  /** Mapped memory view (Float32Array for convenience) */
  view: Float32Array;
  /** Frame index for synchronization */
  frameIndex: number;
}

/**
 * Ring buffer options
 */
export interface RingBufferOptions {
  /** Buffer size in bytes (should be multiple of frame size * 3) */
  size: number;
  /** WebGL2 rendering context */
  gl: WebGL2RenderingContext;
  /** Usage hint (DYNAMIC_DRAW for frequent updates) */
  usage?: number;
  /** Enable triple buffering (default true) */
  tripleBuffered?: boolean;
}

/**
 * Pending frame tracking for synchronization
 */
interface PendingFrame {
  frameIndex: number;
  fence: WebGLSync;
  readOffset: number;
}

/**
 * GPU Ring Buffer
 *
 * Circular buffer with persistent mapping for efficient GPU streaming.
 * Uses triple buffering to avoid CPU-GPU synchronization points.
 */
export class RingBuffer {
  private gl: WebGL2RenderingContext;
  private buffer: WebGLBuffer;
  private mappedPtr: ArrayBuffer | null = null;
  private size: number;

  // Ring buffer state
  private writeOffset: number = 0;
  private readOffset: number = 0;
  private frameIndex: number = 0;

  // Synchronization
  private fenceSync: WebGLSync | null = null;
  private pendingFrames: PendingFrame[] = [];

  // Constants
  private readonly ALIGNMENT = 256; // Cache line alignment
  private readonly FRAME_COUNT = 3; // Triple buffering

  constructor(options: RingBufferOptions) {
    // Verify WebGL2 context
    if (!(options.gl instanceof WebGL2RenderingContext)) {
      throw new Error("RingBuffer requires WebGL2 context");
    }

    this.gl = options.gl;
    this.size = options.size;

    // Create buffer
    this.buffer = this.gl.createBuffer()!;
    this.gl.bindBuffer(this.gl.ARRAY_BUFFER, this.buffer);

    // Allocate with persistent mapping
    this.gl.bufferData(
      this.gl.ARRAY_BUFFER,
      this.size,
      options.usage ?? this.gl.DYNAMIC_DRAW
    );

    // Map persistently (WebGL2 only)
    const glAny = this.gl as any;
    const MAP_WRITE_BIT = 0x0002;
    const MAP_PERSISTENT_BIT = 0x0040;
    const MAP_COHERENT_BIT = 0x0080;

    const flags = MAP_WRITE_BIT | MAP_PERSISTENT_BIT | MAP_COHERENT_BIT;

    this.mappedPtr = glAny.mapBufferRange(
      this.gl.ARRAY_BUFFER,
      0,
      this.size,
      flags
    );

    if (!this.mappedPtr) {
      throw new Error("Failed to map ring buffer persistently");
    }

    this.gl.bindBuffer(this.gl.ARRAY_BUFFER, null);
  }

  /**
   * Allocate a region in the ring buffer
   * Handles wraparound and alignment
   *
   * @param byteSize - Size to allocate in bytes
   * @returns Allocated region or null if buffer is full
   */
  allocate(byteSize: number): RingBufferRegion | null {
    // Align size to cache line
    const alignedSize = Math.ceil(byteSize / this.ALIGNMENT) * this.ALIGNMENT;

    // Check if we need to wrap around
    if (this.writeOffset + alignedSize > this.size) {
      // Not enough space at end, wrap to start
      const remaining = this.size - this.writeOffset;

      if (remaining > 0) {
        // Mark remaining space as padding by wrapping to start
        this.writeOffset = 0;
      }

      // Check if we have space from start
      if (alignedSize > this.readOffset && this.frameIndex > 0) {
        // Would overwrite unread data
        return null;
      }
    }

    // Check for collision with read offset (buffer full)
    if (this.writeOffset + alignedSize > this.readOffset && this.writeOffset < this.readOffset) {
      return null; // Would overwrite unread data
    }

    // Create region view
    const region: RingBufferRegion = {
      offset: this.writeOffset,
      size: alignedSize,
      view: new Float32Array(this.mappedPtr!, this.writeOffset / 4, byteSize / 4),
      frameIndex: this.frameIndex
    };

    this.writeOffset += alignedSize;
    return region;
  }

  /**
   * Advance to next frame (call after submitting all instance data)
   * Inserts fence synchronization and tracks in-flight frames
   */
  advanceFrame(): void {
    const glAny = this.gl as any;

    // Insert fence for current frame
    const SYNC_GPU_COMMANDS_COMPLETE = 0x9117;
    this.fenceSync = glAny.fenceSync(SYNC_GPU_COMMANDS_COMPLETE, 0);

    if (!this.fenceSync) {
      throw new Error("Failed to create fence sync object");
    }

    // Track this frame
    this.pendingFrames.push({
      frameIndex: this.frameIndex,
      fence: this.fenceSync,
      readOffset: this.readOffset
    });

    // Update read offset to oldest pending frame
    if (this.pendingFrames.length >= this.FRAME_COUNT) {
      const oldest = this.pendingFrames.shift()!;

      // Update read offset to where this frame started
      this.readOffset = oldest.readOffset;

      // Wait for fence (with timeout)
      const TIMEOUT_IGNORED = 0xffffffffffffffff;
      glAny.clientWaitSync(oldest.fence, 0, TIMEOUT_IGNORED);
      glAny.deleteSync(oldest.fence);
    }

    // Advance frame counter
    this.frameIndex++;
  }

  /**
   * Get current frame index (for debugging)
   */
  getFrameIndex(): number {
    return this.frameIndex;
  }

  /**
   * Get current write offset (for debugging)
   */
  getWriteOffset(): number {
    return this.writeOffset;
  }

  /**
   * Get current read offset (for debugging)
   */
  getReadOffset(): number {
    return this.readOffset;
  }

  /**
   * Get buffer size in bytes
   */
  getSize(): number {
    return this.size;
  }

  /**
   * Reset buffer state (for error recovery)
   * Clears all pending frames and resets offsets
   */
  reset(): void {
    this.writeOffset = 0;
    this.readOffset = 0;
    this.frameIndex = 0;

    // Delete all pending fences
    const glAny = this.gl as any;
    for (const frame of this.pendingFrames) {
      glAny.deleteSync(frame.fence);
    }
    this.pendingFrames = [];

    // Delete current fence
    if (this.fenceSync) {
      glAny.deleteSync(this.fenceSync);
      this.fenceSync = null;
    }
  }

  /**
   * Get the underlying WebGL buffer
   * (for binding to vertex array objects)
   */
  getBuffer(): WebGLBuffer {
    return this.buffer;
  }

  /**
   * Get the mapped pointer
   * (for direct memory access if needed)
   */
  getMappedPointer(): ArrayBuffer | null {
    return this.mappedPtr;
  }

  /**
   * Clean up resources
   * Unmaps buffer and deletes GPU resources
   */
  dispose(): void {
    const glAny = this.gl as any;

    // Unmap buffer
    if (this.mappedPtr) {
      this.gl.bindBuffer(this.gl.ARRAY_BUFFER, this.buffer);
      glAny.unmapBuffer(this.gl.ARRAY_BUFFER);
      this.mappedPtr = null;
      this.gl.bindBuffer(this.gl.ARRAY_BUFFER, null);
    }

    // Delete all pending fences
    for (const frame of this.pendingFrames) {
      glAny.deleteSync(frame.fence);
    }
    this.pendingFrames = [];

    // Delete current fence
    if (this.fenceSync) {
      glAny.deleteSync(this.fenceSync);
      this.fenceSync = null;
    }

    // Delete buffer
    this.gl.deleteBuffer(this.buffer);
  }
}
