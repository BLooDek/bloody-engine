/**
 * Linear interpolation between two values
 * @param a - Start value
 * @param b - End value
 * @param t - Interpolation factor (0-1)
 * @returns Interpolated value
 */
export function lerp(a: number, b: number, t: number): number {
  return a + (b - a) * t;
}

/**
 * Interpolate between two 2D vectors
 * @param a - Start vector
 * @param b - End vector
 * @param t - Interpolation factor (0-1)
 * @returns Interpolated vector
 */
export function lerpVec2(
  a: { x: number; y: number },
  b: { x: number; y: number },
  t: number
): { x: number; y: number } {
  return {
    x: lerp(a.x, b.x, t),
    y: lerp(a.y, b.y, t),
  };
}

/**
 * Interpolate between two 3D vectors
 * @param a - Start vector
 * @param b - End vector
 * @param t - Interpolation factor (0-1)
 * @returns Interpolated vector
 */
export function lerpVec3(
  a: { x: number; y: number; z: number },
  b: { x: number; y: number; z: number },
  t: number
): { x: number; y: number; z: number } {
  return {
    x: lerp(a.x, b.x, t),
    y: lerp(a.y, b.y, t),
    z: lerp(a.z, b.z, t),
  };
}

/**
 * Interpolate rotation (handles angle wrapping)
 * @param a - Start angle in radians
 * @param b - End angle in radians
 * @param t - Interpolation factor (0-1)
 * @returns Interpolated angle
 */
export function lerpAngle(a: number, b: number, t: number): number {
  const diff = b - a;
  const adjustedDiff = ((diff + Math.PI) % (2 * Math.PI)) - Math.PI;
  return a + adjustedDiff * t;
}

/**
 * State buffer for interpolation
 * Stores previous and current states for smooth interpolation
 */
export class StateBuffer<T> {
  private previous: T;
  private current: T;

  constructor(initialState: T) {
    this.previous = initialState;
    this.current = initialState;
  }

  /**
   * Update to new state (shifts current to previous)
   * @param newState - The new state to set as current
   */
  public update(newState: T): void {
    this.previous = this.current;
    this.current = newState;
  }

  /**
   * Get interpolated state
   * @param alpha - Interpolation factor (0-1)
   * @param lerpFn - Interpolation function for the state type
   * @returns Interpolated state
   */
  public interpolate(
    alpha: number,
    lerpFn: (a: T, b: T, t: number) => T
  ): T {
    return lerpFn(this.previous, this.current, alpha);
  }

  /**
   * Get current state without interpolation
   * @returns Current state
   */
  public getCurrent(): T {
    return this.current;
  }

  /**
   * Get previous state
   * @returns Previous state
   */
  public getPrevious(): T {
    return this.previous;
  }
}
