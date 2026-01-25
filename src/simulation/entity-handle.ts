/**
 * EntityHandle - Opaque handle to an entity in SoA storage
 *
 * Handles prevent dangling pointers by using index + generation.
 * When an entity is deallocated, its generation counter increments,
 * making old handles invalid.
 */

/**
 * Opaque handle to an entity stored in SoA arrays
 */
export interface EntityHandle {
  /** Index into SoA arrays */
  index: number;
  /** Generation counter for validation */
  generation: number;
}

/**
 * Create a new entity handle
 */
export function createEntityHandle(index: number, generation: number): EntityHandle {
  return { index, generation };
}

/**
 * Check if a handle is valid (non-null)
 */
export function isHandleValid(handle: EntityHandle | null | undefined): handle is EntityHandle {
  return handle !== null && handle !== undefined;
}

/**
 * Compare two handles for equality
 */
export function handlesEqual(a: EntityHandle, b: EntityHandle): boolean {
  return a.index === b.index && a.generation === b.generation;
}
