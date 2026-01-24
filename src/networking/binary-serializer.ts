/**
 * BinarySerializer - Low-level binary serialization using DataView
 *
 * Provides efficient binary read/write operations with cross-platform compatibility.
 * Uses DataView for consistent endianness (little-endian) across platforms.
 *
 * Format Specification:
 * - Uint8: 1 byte
 * - Uint16: 2 bytes
 * - Uint32: 4 bytes
 * - Int32: 4 bytes
 * - Float32: 4 bytes (IEEE 754)
 * - String: 2-byte length prefix + UTF-8 bytes
 * - Boolean: 1 byte (0 = false, 1 = true)
 */

const INITIAL_BUFFER_SIZE = 1024; // 1 KB initial buffer
const BUFFER_GROWTH_FACTOR = 2;

/**
 * BinarySerializer - Write binary data to a growable buffer
 */
export class BinarySerializer {
  private buffer: ArrayBuffer;
  private view: DataView;
  private offset: number;

  constructor(initialSize: number = INITIAL_BUFFER_SIZE) {
    this.buffer = new ArrayBuffer(initialSize);
    this.view = new DataView(this.buffer);
    this.offset = 0;
  }

  /**
   * Ensure the buffer has enough capacity for the requested bytes
   */
  private ensureCapacity(requiredBytes: number): void {
    const currentCapacity = this.buffer.byteLength;
    const remainingCapacity = currentCapacity - this.offset;

    if (remainingCapacity >= requiredBytes) {
      return;
    }

    // Calculate new size (double until sufficient)
    let newSize = currentCapacity;
    while (newSize - this.offset < requiredBytes) {
      newSize *= BUFFER_GROWTH_FACTOR;
    }

    // Create new buffer and copy existing data
    const newBuffer = new ArrayBuffer(newSize);
    const newView = new DataView(newBuffer);
    const sourceBytes = new Uint8Array(this.buffer);
    const destBytes = new Uint8Array(newBuffer);
    destBytes.set(sourceBytes);

    this.buffer = newBuffer;
    this.view = newView;
  }

  /**
   * Write an 8-bit unsigned integer
   */
  writeUint8(value: number): void {
    this.ensureCapacity(1);
    this.view.setUint8(this.offset, value);
    this.offset += 1;
  }

  /**
   * Write a 16-bit unsigned integer (little-endian)
   */
  writeUint16(value: number): void {
    this.ensureCapacity(2);
    this.view.setUint16(this.offset, value, true); // little-endian
    this.offset += 2;
  }

  /**
   * Write a 32-bit unsigned integer (little-endian)
   */
  writeUint32(value: number): void {
    this.ensureCapacity(4);
    this.view.setUint32(this.offset, value, true); // little-endian
    this.offset += 4;
  }

  /**
   * Write a 32-bit signed integer (little-endian)
   */
  writeInt32(value: number): void {
    this.ensureCapacity(4);
    this.view.setInt32(this.offset, value, true); // little-endian
    this.offset += 4;
  }

  /**
   * Write a 32-bit floating point number (little-endian, IEEE 754)
   */
  writeFloat32(value: number): void {
    this.ensureCapacity(4);
    this.view.setFloat32(this.offset, value, true); // little-endian
    this.offset += 4;
  }

  /**
   * Write a 64-bit floating point number (little-endian, IEEE 754)
   */
  writeFloat64(value: number): void {
    this.ensureCapacity(8);
    this.view.setFloat64(this.offset, value, true); // little-endian
    this.offset += 8;
  }

  /**
   * Write a boolean as a single byte (0 or 1)
   */
  writeBoolean(value: boolean): void {
    this.writeUint8(value ? 1 : 0);
  }

  /**
   * Write a string as length-prefixed UTF-8
   * Format: [length:2][utf8bytes:n]
   */
  writeString(str: string): void {
    // Convert string to UTF-8 bytes
    const utf8Bytes = new TextEncoder().encode(str);
    const length = utf8Bytes.byteLength;

    // Write length prefix (max 65535 bytes for string length)
    if (length > 65535) {
      throw new Error(`String too long for serialization: ${length} bytes (max 65535)`);
    }

    this.writeUint16(length);

    // Write UTF-8 bytes
    this.ensureCapacity(length);
    const destBytes = new Uint8Array(this.buffer);
    destBytes.set(utf8Bytes, this.offset);
    this.offset += length;
  }

  /**
   * Write raw bytes from a Uint8Array
   */
  writeBytes(bytes: Uint8Array): void {
    this.ensureCapacity(bytes.length);
    const destBytes = new Uint8Array(this.buffer);
    destBytes.set(bytes, this.offset);
    this.offset += bytes.length;
  }

  /**
   * Get the current write position
   */
  getOffset(): number {
    return this.offset;
  }

  /**
   * Set the write position (for overwriting or seeking)
   */
  setOffset(offset: number): void {
    if (offset < 0 || offset > this.buffer.byteLength) {
      throw new Error(`Invalid offset: ${offset} (buffer size: ${this.buffer.byteLength})`);
    }
    this.offset = offset;
  }

  /**
   * Get the number of bytes written
   */
  getLength(): number {
    return this.offset;
  }

  /**
   * Convert to a Uint8Array containing the written data
   */
  toBuffer(): Uint8Array {
    return new Uint8Array(this.buffer, 0, this.offset);
  }

  /**
   * Reset the serializer to initial state (retains buffer allocation)
   */
  reset(): void {
    this.offset = 0;
  }

  /**
   * Create a BinarySerializer from an existing buffer for reading
   */
  static fromBuffer(buffer: Uint8Array): BinaryReader {
    return new BinaryReader(buffer);
  }
}

/**
 * BinaryReader - Read binary data from a buffer
 */
export class BinaryReader {
  private buffer: Uint8Array;
  private view: DataView;
  private offset: number;
  private length: number;

  constructor(buffer: Uint8Array) {
    this.buffer = buffer;
    this.offset = 0;
    this.length = buffer.length;

    // Create a new ArrayBuffer from the Uint8Array data
    // This avoids issues with detached or complex buffer views
    const arrayBuffer = new ArrayBuffer(buffer.length);
    const uint8View = new Uint8Array(arrayBuffer);
    uint8View.set(buffer);
    this.view = new DataView(arrayBuffer);
  }

  /**
   * Check if there's enough data to read
   */
  private ensureAvailable(bytes: number): void {
    if (this.offset + bytes > this.length) {
      throw new Error(
        `Unexpected end of buffer: tried to read ${bytes} bytes at offset ${this.offset}, but buffer length is ${this.length}`
      );
    }
  }

  /**
   * Read an 8-bit unsigned integer
   */
  readUint8(): number {
    this.ensureAvailable(1);
    const value = this.view.getUint8(this.offset);
    this.offset += 1;
    return value;
  }

  /**
   * Read a 16-bit unsigned integer (little-endian)
   */
  readUint16(): number {
    this.ensureAvailable(2);
    const value = this.view.getUint16(this.offset, true); // little-endian
    this.offset += 2;
    return value;
  }

  /**
   * Read a 32-bit unsigned integer (little-endian)
   */
  readUint32(): number {
    this.ensureAvailable(4);
    const value = this.view.getUint32(this.offset, true); // little-endian
    this.offset += 4;
    return value;
  }

  /**
   * Read a 32-bit signed integer (little-endian)
   */
  readInt32(): number {
    this.ensureAvailable(4);
    const value = this.view.getInt32(this.offset, true); // little-endian
    this.offset += 4;
    return value;
  }

  /**
   * Read a 32-bit floating point number (little-endian, IEEE 754)
   */
  readFloat32(): number {
    this.ensureAvailable(4);
    const value = this.view.getFloat32(this.offset, true); // little-endian
    this.offset += 4;
    return value;
  }

  /**
   * Read a 64-bit floating point number (little-endian, IEEE 754)
   */
  readFloat64(): number {
    this.ensureAvailable(8);
    const value = this.view.getFloat64(this.offset, true); // little-endian
    this.offset += 8;
    return value;
  }

  /**
   * Read a boolean from a single byte
   */
  readBoolean(): boolean {
    return this.readUint8() !== 0;
  }

  /**
   * Read a length-prefixed UTF-8 string
   * Format: [length:2][utf8bytes:n]
   */
  readString(): string {
    const length = this.readUint16();
    this.ensureAvailable(length);

    const bytes = this.buffer.subarray(this.offset, this.offset + length);
    const str = new TextDecoder().decode(bytes);
    this.offset += length;
    return str;
  }

  /**
   * Read raw bytes into a Uint8Array
   */
  readBytes(count: number): Uint8Array {
    this.ensureAvailable(count);
    const bytes = this.buffer.subarray(this.offset, this.offset + count);
    this.offset += count;
    return bytes;
  }

  /**
   * Get the current read position
   */
  getOffset(): number {
    return this.offset;
  }

  /**
   * Set the read position (for seeking)
   */
  setOffset(offset: number): void {
    if (offset < 0 || offset > this.length) {
      throw new Error(`Invalid offset: ${offset} (buffer size: ${this.length})`);
    }
    this.offset = offset;
  }

  /**
   * Check if we've reached the end of the buffer
   */
  isAtEnd(): boolean {
    return this.offset >= this.length;
  }

  /**
   * Get the remaining bytes available to read
   */
  getRemaining(): number {
    return this.length - this.offset;
  }

  /**
   * Peek at the next byte without advancing the offset
   */
  peekUint8(): number {
    this.ensureAvailable(1);
    return this.view.getUint8(this.offset);
  }

  /**
   * Create a copy of the remaining buffer from current position
   */
  slice(): Uint8Array {
    return this.buffer.subarray(this.offset);
  }
}

/**
 * Utility functions for binary serialization
 */
export class BinaryUtils {
  /**
   * Calculate the size in bytes needed to serialize a string
   */
  static calculateStringSize(str: string): number {
    const utf8Bytes = new TextEncoder().encode(str);
    return 2 + utf8Bytes.byteLength; // 2 bytes for length + UTF-8 bytes
  }

  /**
   * Create a buffer from a hex string (for testing)
   */
  static fromHex(hex: string): Uint8Array {
    const bytes = new Uint8Array(hex.length / 2);
    for (let i = 0; i < bytes.length; i++) {
      bytes[i] = parseInt(hex.substr(i * 2, 2), 16);
    }
    return bytes;
  }

  /**
   * Convert buffer to hex string (for testing/debugging)
   */
  static toHex(buffer: Uint8Array): string {
    return Array.from(buffer)
      .map(b => b.toString(16).padStart(2, '0'))
      .join(' ');
  }
}
