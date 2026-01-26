import { describe, it, expect, beforeEach, vi, afterEach } from "vitest";
import {
  lerp,
  lerpVec2,
  lerpVec3,
  lerpAngle,
  StateBuffer,
  interpolateState,
  StateSmoother,
  type SmoothingConfig,
} from "./interpolation";

// Mock entity state type for testing
interface MockEntityState {
  gridPos: { xgrid: number; ygrid: number; zheight: number };
  velocity: { x: number; y: number; z: number };
  rotation: number;
  speed: number;
  isMoving: boolean;
}

describe("interpolation", () => {
  describe("lerp", () => {
    it("should return start value when t=0", () => {
      expect(lerp(10, 20, 0)).toBe(10);
    });

    it("should return end value when t=1", () => {
      expect(lerp(10, 20, 1)).toBe(20);
    });

    it("should return midpoint when t=0.5", () => {
      expect(lerp(10, 20, 0.5)).toBe(15);
    });

    it("should handle negative t values (extrapolation)", () => {
      expect(lerp(10, 20, -0.5)).toBe(5);
    });

    it("should handle t values greater than 1 (extrapolation)", () => {
      expect(lerp(10, 20, 1.5)).toBe(25);
    });

    it("should handle negative values", () => {
      expect(lerp(-10, 10, 0.5)).toBe(0);
    });

    it("should handle zero start value", () => {
      expect(lerp(0, 100, 0.25)).toBe(25);
    });

    it("should handle decreasing values", () => {
      expect(lerp(20, 10, 0.5)).toBe(15);
    });

    it("should be precise for common values", () => {
      expect(lerp(0, 1, 0.1)).toBeCloseTo(0.1, 10);
      expect(lerp(0, 100, 0.01)).toBeCloseTo(1, 10);
    });
  });

  describe("lerpVec2", () => {
    it("should interpolate 2D vectors correctly", () => {
      const a = { x: 0, y: 0 };
      const b = { x: 10, y: 20 };
      const result = lerpVec2(a, b, 0.5);

      expect(result.x).toBe(5);
      expect(result.y).toBe(10);
    });

    it("should return start vector when t=0", () => {
      const a = { x: 5, y: 10 };
      const b = { x: 15, y: 20 };
      const result = lerpVec2(a, b, 0);

      expect(result.x).toBe(5);
      expect(result.y).toBe(10);
    });

    it("should return end vector when t=1", () => {
      const a = { x: 5, y: 10 };
      const b = { x: 15, y: 20 };
      const result = lerpVec2(a, b, 1);

      expect(result.x).toBe(15);
      expect(result.y).toBe(20);
    });

    it("should handle negative coordinates", () => {
      const a = { x: -10, y: -20 };
      const b = { x: 10, y: 20 };
      const result = lerpVec2(a, b, 0.5);

      expect(result.x).toBe(0);
      expect(result.y).toBe(0);
    });

    it("should handle extrapolation", () => {
      const a = { x: 0, y: 0 };
      const b = { x: 10, y: 10 };
      const result = lerpVec2(a, b, 2);

      expect(result.x).toBe(20);
      expect(result.y).toBe(20);
    });
  });

  describe("lerpVec3", () => {
    it("should interpolate 3D vectors correctly", () => {
      const a = { x: 0, y: 0, z: 0 };
      const b = { x: 10, y: 20, z: 30 };
      const result = lerpVec3(a, b, 0.5);

      expect(result.x).toBe(5);
      expect(result.y).toBe(10);
      expect(result.z).toBe(15);
    });

    it("should return start vector when t=0", () => {
      const a = { x: 1, y: 2, z: 3 };
      const b = { x: 4, y: 5, z: 6 };
      const result = lerpVec3(a, b, 0);

      expect(result.x).toBe(1);
      expect(result.y).toBe(2);
      expect(result.z).toBe(3);
    });

    it("should return end vector when t=1", () => {
      const a = { x: 1, y: 2, z: 3 };
      const b = { x: 4, y: 5, z: 6 };
      const result = lerpVec3(a, b, 1);

      expect(result.x).toBe(4);
      expect(result.y).toBe(5);
      expect(result.z).toBe(6);
    });

    it("should handle negative coordinates", () => {
      const a = { x: -10, y: -20, z: -30 };
      const b = { x: 10, y: 20, z: 30 };
      const result = lerpVec3(a, b, 0.5);

      expect(result.x).toBe(0);
      expect(result.y).toBe(0);
      expect(result.z).toBe(0);
    });

    it("should handle extrapolation", () => {
      const a = { x: 0, y: 0, z: 0 };
      const b = { x: 10, y: 20, z: 30 };
      const result = lerpVec3(a, b, -0.5);

      expect(result.x).toBe(-5);
      expect(result.y).toBe(-10);
      expect(result.z).toBe(-15);
    });
  });

  describe("lerpAngle", () => {
    it("should interpolate angles without wrapping", () => {
      const result = lerpAngle(0, Math.PI / 2, 0.5);
      expect(result).toBeCloseTo(Math.PI / 4, 10);
    });

    it("should handle angle wrapping across PI boundary (shortest path)", () => {
      const result = lerpAngle(Math.PI - 0.1, -Math.PI + 0.1, 0.5);
      // Should go backwards through PI
      expect(result).toBeCloseTo(Math.PI, 10);
    });

    it("should handle angle wrapping across -PI boundary (shortest path)", () => {
      const result = lerpAngle(-Math.PI + 0.1, Math.PI - 0.1, 0.5);
      // Should go forwards through -PI/PI
      expect(result).toBeCloseTo(-Math.PI, 10);
    });

    it("should return start angle when t=0", () => {
      const result = lerpAngle(Math.PI / 4, Math.PI / 2, 0);
      expect(result).toBeCloseTo(Math.PI / 4, 10);
    });

    it("should return end angle when t=1", () => {
      const result = lerpAngle(Math.PI / 4, Math.PI / 2, 1);
      expect(result).toBeCloseTo(Math.PI / 2, 10);
    });

    it("should handle clockwise rotation (shortest path)", () => {
      const result = lerpAngle(Math.PI / 2, 0, 0.5);
      expect(result).toBeCloseTo(Math.PI / 4, 10);
    });

    it("should handle counter-clockwise rotation (shortest path)", () => {
      const result = lerpAngle(0, Math.PI / 2, 0.5);
      expect(result).toBeCloseTo(Math.PI / 4, 10);
    });

    it("should take shortest path for 180 degree rotation", () => {
      // Both directions are equal length, implementation chooses positive path
      const result = lerpAngle(0, Math.PI, 0.5);
      expect(result).toBeCloseTo(Math.PI / 2, 10);
    });

    it("should handle negative angles", () => {
      const result = lerpAngle(-Math.PI / 4, Math.PI / 4, 0.5);
      expect(result).toBeCloseTo(0, 10);
    });

    it("should normalize angles correctly", () => {
      // Test with angles outside -PI to PI range
      // 3*PI is equivalent to PI (one full rotation + PI)
      const result = lerpAngle(0, 3 * Math.PI, 0.5);
      // Should normalize 3*PI to PI and interpolate
      expect(result).toBeCloseTo(Math.PI / 2, 10);
    });

    it("should handle very small angle differences", () => {
      const result = lerpAngle(0, 0.001, 0.5);
      expect(result).toBeCloseTo(0.0005, 10);
    });
  });

  describe("StateBuffer", () => {
    let buffer: StateBuffer<number>;

    beforeEach(() => {
      buffer = new StateBuffer(0);
    });

    it("should initialize with same previous and current state", () => {
      expect(buffer.getPrevious()).toBe(0);
      expect(buffer.getCurrent()).toBe(0);
    });

    it("should update current and shift current to previous", () => {
      buffer.update(5);
      expect(buffer.getPrevious()).toBe(0);
      expect(buffer.getCurrent()).toBe(5);

      buffer.update(10);
      expect(buffer.getPrevious()).toBe(5);
      expect(buffer.getCurrent()).toBe(10);
    });

    it("should interpolate states correctly", () => {
      buffer.update(0);
      buffer.update(10);

      const result = buffer.interpolate(0.5, (a, b, t) => a + (b - a) * t);
      expect(result).toBe(5);
    });

    it("should return previous when alpha=0", () => {
      buffer.update(0);
      buffer.update(10);

      const result = buffer.interpolate(0, (a, b, t) => a + (b - a) * t);
      expect(result).toBe(0);
    });

    it("should return current when alpha=1", () => {
      buffer.update(0);
      buffer.update(10);

      const result = buffer.interpolate(1, (a, b, t) => a + (b - a) * t);
      expect(result).toBe(10);
    });

    it("should work with object states", () => {
      const vecBuffer = new StateBuffer({ x: 0, y: 0 });

      vecBuffer.update({ x: 10, y: 20 });

      const result = vecBuffer.interpolate(
        0.5,
        (a: { x: number; y: number }, b: { x: number; y: number }, t: number) => ({
          x: a.x + (b.x - a.x) * t,
          y: a.y + (b.y - a.y) * t,
        })
      );

      expect(result.x).toBe(5);
      expect(result.y).toBe(10);
    });
  });

  describe("interpolateState", () => {
    const fromState: MockEntityState = {
      gridPos: { xgrid: 0, ygrid: 0, zheight: 0 },
      velocity: { x: 0, y: 0, z: 0 },
      rotation: 0,
      speed: 0,
      isMoving: false,
    };

    const toState: MockEntityState = {
      gridPos: { xgrid: 10, ygrid: 20, zheight: 30 },
      velocity: { x: 5, y: 10, z: 15 },
      rotation: Math.PI,
      speed: 100,
      isMoving: true,
    };

    it("should interpolate grid position", () => {
      const result = interpolateState(fromState, toState, 0.5);

      expect(result.gridPos.xgrid).toBe(5);
      expect(result.gridPos.ygrid).toBe(10);
      expect(result.gridPos.zheight).toBe(15);
    });

    it("should interpolate velocity", () => {
      const result = interpolateState(fromState, toState, 0.5);

      expect(result.velocity.x).toBe(2.5);
      expect(result.velocity.y).toBe(5);
      expect(result.velocity.z).toBe(7.5);
    });

    it("should interpolate rotation", () => {
      const result = interpolateState(fromState, toState, 0.5);
      expect(result.rotation).toBeCloseTo(Math.PI / 2, 10);
    });

    it("should interpolate speed", () => {
      const result = interpolateState(fromState, toState, 0.5);
      expect(result.speed).toBe(50);
    });

    it("should snap isMoving boolean at midpoint", () => {
      expect(interpolateState(fromState, toState, 0.4).isMoving).toBe(false);
      expect(interpolateState(fromState, toState, 0.5).isMoving).toBe(true);
      expect(interpolateState(fromState, toState, 0.6).isMoving).toBe(true);
    });

    it("should return from state when t=0", () => {
      const result = interpolateState(fromState, toState, 0);

      expect(result.gridPos.xgrid).toBe(0);
      expect(result.speed).toBe(0);
      expect(result.isMoving).toBe(false);
    });

    it("should return to state when t=1", () => {
      const result = interpolateState(fromState, toState, 1);

      expect(result.gridPos.xgrid).toBe(10);
      expect(result.speed).toBe(100);
      expect(result.isMoving).toBe(true);
    });

    it("should handle negative t values", () => {
      const result = interpolateState(fromState, toState, -0.5);

      expect(result.gridPos.xgrid).toBe(-5);
      expect(result.speed).toBe(-50);
    });
  });

  describe("StateSmoother", () => {
    let smoother: StateSmoother;
    let mockDateNow: ReturnType<typeof vi.fn>;

    beforeEach(() => {
      smoother = new StateSmoother();
      mockDateNow = vi.fn();
      const originalDateNow = Date.now;
      mockDateNow.mockReturnValue(1000);
      global.Date.now = mockDateNow;
    });

    afterEach(() => {
      vi.restoreAllMocks();
    });

    const createMockState = (value: number): MockEntityState => ({
      gridPos: { xgrid: value, ygrid: value, zheight: value },
      velocity: { x: value, y: value, z: value },
      rotation: value,
      speed: value,
      isMoving: value > 0,
    });

    it("should start smoothing for an entity", () => {
      const fromState = createMockState(0);
      const toState = createMockState(10);

      smoother.startSmoothing("entity1", fromState, toState, 100);

      expect(smoother.isSmoothing("entity1")).toBe(true);
      expect(smoother.getActiveCount()).toBe(1);
    });

    it("should return undefined for non-smoothing entity", () => {
      const result = smoother.getSmoothedState("entity1");
      expect(result).toBeUndefined();
    });

    it("should return interpolated state during smoothing", () => {
      const fromState = createMockState(0);
      const toState = createMockState(10);

      smoother.startSmoothing("entity1", fromState, toState, 100);
      mockDateNow.mockReturnValue(1050); // 50ms elapsed

      const result = smoother.getSmoothedState("entity1");

      expect(result).toBeDefined();
      expect(result!.gridPos.xgrid).toBe(5); // 50% of 0 to 10
      expect(smoother.isSmoothing("entity1")).toBe(true);
    });

    it("should complete smoothing and return final state", () => {
      const fromState = createMockState(0);
      const toState = createMockState(10);

      smoother.startSmoothing("entity1", fromState, toState, 100);
      mockDateNow.mockReturnValue(1100); // 100ms elapsed - complete

      const result = smoother.getSmoothedState("entity1");

      expect(result).toBeDefined();
      expect(result!.gridPos.xgrid).toBe(10); // Final state
      expect(smoother.isSmoothing("entity1")).toBe(false); // Removed
    });

    it("should handle multiple entities smoothing simultaneously", () => {
      smoother.startSmoothing("entity1", createMockState(0), createMockState(10), 100);
      smoother.startSmoothing("entity2", createMockState(20), createMockState(30), 100);
      smoother.startSmoothing("entity3", createMockState(40), createMockState(50), 100);

      expect(smoother.getActiveCount()).toBe(3);
      expect(smoother.isSmoothing("entity1")).toBe(true);
      expect(smoother.isSmoothing("entity2")).toBe(true);
      expect(smoother.isSmoothing("entity3")).toBe(true);
    });

    it("should cancel smoothing for specific entity", () => {
      smoother.startSmoothing("entity1", createMockState(0), createMockState(10), 100);
      smoother.startSmoothing("entity2", createMockState(20), createMockState(30), 100);

      smoother.cancelSmoothing("entity1");

      expect(smoother.isSmoothing("entity1")).toBe(false);
      expect(smoother.isSmoothing("entity2")).toBe(true);
      expect(smoother.getActiveCount()).toBe(1);
    });

    it("should clear all smoothings", () => {
      smoother.startSmoothing("entity1", createMockState(0), createMockState(10), 100);
      smoother.startSmoothing("entity2", createMockState(20), createMockState(30), 100);

      smoother.clear();

      expect(smoother.getActiveCount()).toBe(0);
      expect(smoother.isSmoothing("entity1")).toBe(false);
      expect(smoother.isSmoothing("entity2")).toBe(false);
    });

    it("should update and remove completed smoothings", () => {
      smoother.startSmoothing("entity1", createMockState(0), createMockState(10), 100);
      smoother.startSmoothing("entity2", createMockState(20), createMockState(30), 100);

      mockDateNow.mockReturnValue(1050); // 50ms elapsed
      smoother.update();

      expect(smoother.getActiveCount()).toBe(2); // Both still active

      mockDateNow.mockReturnValue(1100); // 100ms elapsed - complete
      smoother.update();

      expect(smoother.getActiveCount()).toBe(0); // All removed
    });

    it("should use default duration when not specified", () => {
      smoother.startSmoothing("entity1", createMockState(0), createMockState(10));

      mockDateNow.mockReturnValue(1050); // 50ms elapsed (default 100ms duration)

      const result = smoother.getSmoothedState("entity1");
      expect(result).toBeDefined();
    });

    it("should replace existing smoothing when starting new one for same entity", () => {
      smoother.startSmoothing("entity1", createMockState(0), createMockState(10), 100);

      mockDateNow.mockReturnValue(1050);
      const result1 = smoother.getSmoothedState("entity1");
      expect(result1!.gridPos.xgrid).toBe(5);

      // Start new smoothing for same entity
      smoother.startSmoothing("entity1", createMockState(100), createMockState(200), 100);

      const result2 = smoother.getSmoothedState("entity1");
      expect(result2!.gridPos.xgrid).toBe(100); // Start from new fromState
      expect(smoother.getActiveCount()).toBe(1); // Still only one
    });

    it("should cap interpolation at t=1", () => {
      const fromState = createMockState(0);
      const toState = createMockState(10);

      smoother.startSmoothing("entity1", fromState, toState, 100);

      mockDateNow.mockReturnValue(1200); // 200ms elapsed - more than duration

      const result = smoother.getSmoothedState("entity1");

      expect(result).toBeDefined();
      expect(result!.gridPos.xgrid).toBe(10); // Capped at final value
      expect(smoother.isSmoothing("entity1")).toBe(false); // Removed
    });
  });
});
