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
  let diff = b - a;

  // Normalize to -PI to +PI range
  while (diff > Math.PI) {
    diff -= 2 * Math.PI;
  }
  while (diff < -Math.PI) {
    diff += 2 * Math.PI;
  }

  return a + diff * t;
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

/**
 * Interpolate between two entity states
 * Used for smoothing server corrections during reconciliation
 *
 * @param from - Starting state (predicted)
 * @param to - Target state (authoritative server state)
 * @param t - Interpolation factor (0-1)
 * @returns Interpolated entity state
 */
export function interpolateState(
  from: import("../simulation/entity").EntityState,
  to: import("../simulation/entity").EntityState,
  t: number
): import("../simulation/entity").EntityState {
  return {
    gridPos: {
      xgrid: lerp(from.gridPos.xgrid, to.gridPos.xgrid, t),
      ygrid: lerp(from.gridPos.ygrid, to.gridPos.ygrid, t),
      zheight: lerp(from.gridPos.zheight, to.gridPos.zheight, t),
    },
    velocity: {
      x: lerp(from.velocity.x, to.velocity.x, t),
      y: lerp(from.velocity.y, to.velocity.y, t),
      z: lerp(from.velocity.z, to.velocity.z, t),
    },
    rotation: lerpAngle(from.rotation, to.rotation, t),
    speed: lerp(from.speed, to.speed, t),
    isMoving: t < 0.5 ? from.isMoving : to.isMoving, // Boolean snaps at midpoint
  };
}

/**
 * Smooth state correction parameters
 */
export interface SmoothingConfig {
  duration: number;      // Duration in milliseconds
  startTime: number;     // When smoothing started
  fromState: import("../simulation/entity").EntityState;
  toState: import("../simulation/entity").EntityState;
}

/**
 * State smoother for gradual corrections
 * Used to smoothly interpolate from predicted to authoritative state
 */
export class StateSmoother {
  private activeSmoothings: Map<string, SmoothingConfig> = new Map();

  /**
   * Start smoothing a state correction
   * @param entityId - Entity to smooth
   * @param fromState - Starting state (predicted)
   * @param toState - Target state (authoritative)
   * @param duration - Duration in milliseconds
   */
  startSmoothing(
    entityId: string,
    fromState: import("../simulation/entity").EntityState,
    toState: import("../simulation/entity").EntityState,
    duration: number = 100
  ): void {
    this.activeSmoothings.set(entityId, {
      duration,
      startTime: Date.now(),
      fromState,
      toState,
    });
  }

  /**
   * Get smoothed state for an entity at current time
   * @param entityId - Entity ID
   * @returns Smoothed state, or undefined if no active smoothing
   */
  getSmoothedState(entityId: string): import("../simulation/entity").EntityState | undefined {
    const smoothing = this.activeSmoothings.get(entityId);
    if (!smoothing) {
      return undefined;
    }

    const elapsed = Date.now() - smoothing.startTime;
    const t = Math.min(elapsed / smoothing.duration, 1.0);

    if (t >= 1.0) {
      // Smoothing complete
      this.activeSmoothings.delete(entityId);
      return smoothing.toState;
    }

    return interpolateState(smoothing.fromState, smoothing.toState, t);
  }

  /**
   * Check if an entity has active smoothing
   */
  isSmoothing(entityId: string): boolean {
    return this.activeSmoothings.has(entityId);
  }

  /**
   * Cancel smoothing for an entity
   */
  cancelSmoothing(entityId: string): void {
    this.activeSmoothings.delete(entityId);
  }

  /**
   * Clear all active smoothings
   */
  clear(): void {
    this.activeSmoothings.clear();
  }

  /**
   * Update all smoothings (call this each frame)
   * Removes completed smoothings
   */
  update(): void {
    const now = Date.now();
    for (const [entityId, smoothing] of this.activeSmoothings.entries()) {
      const elapsed = now - smoothing.startTime;
      if (elapsed >= smoothing.duration) {
        this.activeSmoothings.delete(entityId);
      }
    }
  }

  /**
   * Get count of active smoothings
   */
  getActiveCount(): number {
    return this.activeSmoothings.size;
  }
}
