import { describe, it, expect } from "vitest";
import {
  createEntityHandle,
  isHandleValid,
  handlesEqual,
  EntityHandle,
} from "./entity-handle";

describe("createEntityHandle", () => {
  it("should create handle with correct index and generation", () => {
    const handle = createEntityHandle(5, 10);

    expect(handle.index).toBe(5);
    expect(handle.generation).toBe(10);
  });

  it("should handle zero values", () => {
    const handle = createEntityHandle(0, 0);

    expect(handle.index).toBe(0);
    expect(handle.generation).toBe(0);
  });

  it("should handle negative values", () => {
    const handle = createEntityHandle(-1, -5);

    expect(handle.index).toBe(-1);
    expect(handle.generation).toBe(-5);
  });

  it("should handle large values", () => {
    const handle = createEntityHandle(999999, 888888);

    expect(handle.index).toBe(999999);
    expect(handle.generation).toBe(888888);
  });
});

describe("isHandleValid", () => {
  it("should return true for valid handles", () => {
    const handle = createEntityHandle(5, 10);

    expect(isHandleValid(handle)).toBe(true);
  });

  it("should return false for null", () => {
    expect(isHandleValid(null)).toBe(false);
  });

  it("should return false for undefined", () => {
    expect(isHandleValid(undefined)).toBe(false);
  });

  it("should type narrow correctly when true", () => {
    const handle: EntityHandle | null = createEntityHandle(1, 2);

    if (isHandleValid(handle)) {
      // TypeScript should know handle is EntityHandle here
      expect(handle.index).toBeDefined();
      expect(handle.generation).toBeDefined();
    }
  });

  it("should handle handle with zero values as valid", () => {
    const handle = createEntityHandle(0, 0);

    expect(isHandleValid(handle)).toBe(true);
  });

  it("should handle handle with negative values as valid", () => {
    const handle = createEntityHandle(-1, -5);

    expect(isHandleValid(handle)).toBe(true);
  });
});

describe("handlesEqual", () => {
  it("should return true for identical handles", () => {
    const handle1 = createEntityHandle(5, 10);
    const handle2 = createEntityHandle(5, 10);

    expect(handlesEqual(handle1, handle2)).toBe(true);
  });

  it("should return true for same handle object", () => {
    const handle = createEntityHandle(5, 10);

    expect(handlesEqual(handle, handle)).toBe(true);
  });

  it("should return false when index differs", () => {
    const handle1 = createEntityHandle(5, 10);
    const handle2 = createEntityHandle(6, 10);

    expect(handlesEqual(handle1, handle2)).toBe(false);
  });

  it("should return false when generation differs", () => {
    const handle1 = createEntityHandle(5, 10);
    const handle2 = createEntityHandle(5, 11);

    expect(handlesEqual(handle1, handle2)).toBe(false);
  });

  it("should return false when both index and generation differ", () => {
    const handle1 = createEntityHandle(5, 10);
    const handle2 = createEntityHandle(6, 11);

    expect(handlesEqual(handle1, handle2)).toBe(false);
  });

  it("should handle zero values correctly", () => {
    const handle1 = createEntityHandle(0, 0);
    const handle2 = createEntityHandle(0, 0);

    expect(handlesEqual(handle1, handle2)).toBe(true);
  });

  it("should handle negative values correctly", () => {
    const handle1 = createEntityHandle(-1, -5);
    const handle2 = createEntityHandle(-1, -5);

    expect(handlesEqual(handle1, handle2)).toBe(true);
  });

  it("should distinguish handles with swapped values", () => {
    const handle1 = createEntityHandle(5, 10);
    const handle2 = createEntityHandle(10, 5);

    expect(handlesEqual(handle1, handle2)).toBe(false);
  });
});
