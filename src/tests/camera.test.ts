/**
 * Camera System Unit Tests
 *
 * Comprehensive tests for Camera and Matrix4 functionality:
 * - Matrix4 operations (identity, translation, scale, multiply, view matrix)
 * - Camera positioning (x, y, zoom)
 * - Camera transformations (move, zoomBy, setPosition, reset)
 * - View matrix caching and dirty tracking
 * - Screen-to-world coordinate transforms
 * - World-to-screen coordinate transforms
 * - Camera constraints (zoom clamping)
 * - Custom pool support
 *
 * Run with: npm run test -- camera
 */

/// <reference types="vitest/globals" />

import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { Camera, Matrix4 } from "../rendering/camera";
import { Matrix4Pool, resetGlobalPool } from "../core/matrix-pool";

describe("Matrix4", () => {
  describe("identity", () => {
    it("should create an identity matrix", () => {
      const identity = Matrix4.identity();

      expect(identity).toBeInstanceOf(Float32Array);
      expect(identity).toHaveLength(16);

      // Check diagonal elements are 1
      expect(identity[0]).toBe(1);
      expect(identity[5]).toBe(1);
      expect(identity[10]).toBe(1);
      expect(identity[15]).toBe(1);

      // Check off-diagonal elements are 0
      expect(identity[1]).toBe(0);
      expect(identity[2]).toBe(0);
      expect(identity[3]).toBe(0);
      expect(identity[4]).toBe(0);
      expect(identity[6]).toBe(0);
      expect(identity[7]).toBe(0);
      expect(identity[8]).toBe(0);
      expect(identity[9]).toBe(0);
      expect(identity[11]).toBe(0);
      expect(identity[12]).toBe(0);
      expect(identity[13]).toBe(0);
      expect(identity[14]).toBe(0);
    });

    it("should use custom pool when provided", () => {
      const customPool = new Matrix4Pool({ initialSize: 5 });
      const identity = Matrix4.identity(customPool);

      expect(identity).toBeInstanceOf(Float32Array);
      expect(customPool.size).toBeGreaterThan(0);

      // Clean up
      customPool.clear();
    });
  });

  describe("translation", () => {
    it("should create a translation matrix with x, y, z", () => {
      const matrix = Matrix4.translation(5, 10, 3);

      // Check translation components (column 3, indices 12, 13, 14)
      expect(matrix[12]).toBe(5);
      expect(matrix[13]).toBe(10);
      expect(matrix[14]).toBe(3);

      // Check identity for rotation/scale
      expect(matrix[0]).toBe(1);
      expect(matrix[5]).toBe(1);
      expect(matrix[10]).toBe(1);
      expect(matrix[15]).toBe(1);
    });

    it("should default z to 0", () => {
      const matrix = Matrix4.translation(5, 10);

      expect(matrix[12]).toBe(5);
      expect(matrix[13]).toBe(10);
      expect(matrix[14]).toBe(0);
    });

    it("should create translation with negative values", () => {
      const matrix = Matrix4.translation(-5, -10, -3);

      expect(matrix[12]).toBe(-5);
      expect(matrix[13]).toBe(-10);
      expect(matrix[14]).toBe(-3);
    });

    it("should use custom pool when provided", () => {
      const customPool = new Matrix4Pool({ initialSize: 5 });
      const matrix = Matrix4.translation(5, 10, 3, customPool);

      expect(matrix).toBeInstanceOf(Float32Array);
      expect(matrix[12]).toBe(5);

      customPool.clear();
    });
  });

  describe("scale", () => {
    it("should create a scale matrix with x, y, z", () => {
      const matrix = Matrix4.scale(2, 3, 4);

      // Check scale components (diagonal elements 0, 5, 10)
      expect(matrix[0]).toBe(2);
      expect(matrix[5]).toBe(3);
      expect(matrix[10]).toBe(4);

      // Check last element is 1
      expect(matrix[15]).toBe(1);
    });

    it("should default z to 1", () => {
      const matrix = Matrix4.scale(2, 3);

      expect(matrix[0]).toBe(2);
      expect(matrix[5]).toBe(3);
      expect(matrix[10]).toBe(1);
    });

    it("should handle fractional scale values", () => {
      const matrix = Matrix4.scale(0.5, 1.5, 2.5);

      expect(matrix[0]).toBe(0.5);
      expect(matrix[5]).toBe(1.5);
      expect(matrix[10]).toBe(2.5);
    });

    it("should use custom pool when provided", () => {
      const customPool = new Matrix4Pool({ initialSize: 5 });
      const matrix = Matrix4.scale(2, 3, 4, customPool);

      expect(matrix).toBeInstanceOf(Float32Array);
      expect(matrix[0]).toBe(2);

      customPool.clear();
    });
  });

  describe("multiply", () => {
    it("should multiply two matrices correctly", () => {
      // Create two simple matrices
      const a = Matrix4.translation(5, 0, 0);
      const b = Matrix4.scale(2, 1, 1);

      const result = Matrix4.multiply(a, b);

      // Translation * Scale should apply scale first, then translation
      // Result should have translation scaled
      expect(result[12]).toBe(5); // 5 * 1 + 0
      expect(result[0]).toBe(2);  // Scale factor
    });

    it("should multiply identity with matrix", () => {
      const identity = Matrix4.identity();
      const translation = Matrix4.translation(5, 10, 3);

      const result1 = Matrix4.multiply(identity, translation);
      const result2 = Matrix4.multiply(translation, identity);

      // Identity * A = A * Identity = A
      expect(result1[12]).toBe(5);
      expect(result1[13]).toBe(10);
      expect(result1[14]).toBe(3);

      expect(result2[12]).toBe(5);
      expect(result2[13]).toBe(10);
      expect(result2[14]).toBe(3);
    });

    it("should use custom pool when provided", () => {
      const customPool = new Matrix4Pool({ initialSize: 10 });
      const a = Matrix4.identity(customPool);
      const b = Matrix4.identity(customPool);

      const result = Matrix4.multiply(a, b, customPool);

      expect(result).toBeInstanceOf(Float32Array);

      customPool.clear();
    });
  });

  describe("createViewMatrix", () => {
    it("should create view matrix from camera position and zoom", () => {
      const viewMatrix = Matrix4.createViewMatrix(100, 200, 2.0);

      expect(viewMatrix).toBeInstanceOf(Float32Array);
      expect(viewMatrix).toHaveLength(16);

      // The view matrix combines translation and scale
      // We can verify it's not an identity matrix
      expect(viewMatrix[0]).not.toBe(1); // Should be scaled
    });

    it("should create identity for camera at origin with zoom 1", () => {
      const viewMatrix = Matrix4.createViewMatrix(0, 0, 1.0);

      // At origin with zoom 1, the view matrix should be close to identity
      // (translation is 0, scale is 1)
      expect(viewMatrix[0]).toBe(1); // Scale factor
      expect(viewMatrix[5]).toBe(1);
      expect(viewMatrix[10]).toBe(1);
      expect(viewMatrix[15]).toBe(1);
      expect(viewMatrix[12]).toBe(0); // No translation
      expect(viewMatrix[13]).toBe(0);
      expect(viewMatrix[14]).toBe(0);
    });

    it("should create view matrix with negative camera position", () => {
      const viewMatrix = Matrix4.createViewMatrix(-50, -100, 1.5);

      expect(viewMatrix).toBeInstanceOf(Float32Array);
      expect(viewMatrix[0]).toBe(1.5); // Zoom
      expect(viewMatrix[5]).toBe(1.5);
    });

    it("should use custom pool when provided", () => {
      const customPool = new Matrix4Pool({ initialSize: 10 });
      const viewMatrix = Matrix4.createViewMatrix(100, 200, 2.0, customPool);

      expect(viewMatrix).toBeInstanceOf(Float32Array);

      customPool.clear();
    });
  });
});

describe("Camera", () => {
  let camera: Camera;

  beforeEach(() => {
    camera = new Camera(0, 0, 1.0);
  });

  afterEach(() => {
    // Reset global pool after each test to prevent interference
    resetGlobalPool();
  });

  describe("Constructor and Basic Properties", () => {
    it("should create camera with default values", () => {
      const defaultCamera = new Camera();

      expect(defaultCamera.x).toBe(0);
      expect(defaultCamera.y).toBe(0);
      expect(defaultCamera.zoom).toBe(1.0);
    });

    it("should create camera with custom position and zoom", () => {
      const customCamera = new Camera(100, 200, 2.5);

      expect(customCamera.x).toBe(100);
      expect(customCamera.y).toBe(200);
      expect(customCamera.zoom).toBe(2.5);
    });

    it("should create camera with custom pool", () => {
      const customPool = new Matrix4Pool({ initialSize: 10 });
      const cameraWithPool = new Camera(50, 50, 1.5, customPool);

      expect(cameraWithPool.getPool()).toBe(customPool);
      expect(cameraWithPool.x).toBe(50);
      expect(cameraWithPool.y).toBe(50);
      expect(cameraWithPool.zoom).toBe(1.5);

      customPool.clear();
    });

    it("should use global pool when no custom pool provided", () => {
      expect(camera.getPool()).toBeUndefined();
    });
  });

  describe("Pool Management", () => {
    it("should set custom pool", () => {
      const customPool = new Matrix4Pool({ initialSize: 10 });

      camera.setPool(customPool);

      expect(camera.getPool()).toBe(customPool);

      customPool.clear();
    });

    it("should allow setting pool to undefined to use global pool", () => {
      const customPool = new Matrix4Pool({ initialSize: 10 });
      camera.setPool(customPool);

      expect(camera.getPool()).toBe(customPool);

      camera.setPool(undefined);

      expect(camera.getPool()).toBeUndefined();

      customPool.clear();
    });
  });

  describe("Position Properties (x, y)", () => {
    it("should get and set x position", () => {
      expect(camera.x).toBe(0);

      camera.x = 100;

      expect(camera.x).toBe(100);
    });

    it("should get and set y position", () => {
      expect(camera.y).toBe(0);

      camera.y = 200;

      expect(camera.y).toBe(200);
    });

    it("should mark view matrix as dirty when x changes", () => {
      const viewMatrix1 = camera.getViewMatrix();

      camera.x = 50;

      const viewMatrix2 = camera.getViewMatrix();

      // Matrices should have different values due to dirty flag
      expect(viewMatrix1).not.toBe(viewMatrix2);
    });

    it("should mark view matrix as dirty when y changes", () => {
      const viewMatrix1 = camera.getViewMatrix();

      camera.y = 50;

      const viewMatrix2 = camera.getViewMatrix();

      expect(viewMatrix1).not.toBe(viewMatrix2);
    });

    it("should handle negative positions", () => {
      camera.x = -100;
      camera.y = -200;

      expect(camera.x).toBe(-100);
      expect(camera.y).toBe(-200);
    });

    it("should handle fractional positions", () => {
      camera.x = 100.5;
      camera.y = 200.75;

      expect(camera.x).toBe(100.5);
      expect(camera.y).toBe(200.75);
    });
  });

  describe("Zoom Property", () => {
    it("should get and set zoom", () => {
      expect(camera.zoom).toBe(1.0);

      camera.zoom = 2.0;

      expect(camera.zoom).toBe(2.0);
    });

    it("should clamp zoom to minimum of 0.001", () => {
      camera.zoom = 0;
      expect(camera.zoom).toBe(0.001);

      camera.zoom = -1;
      expect(camera.zoom).toBe(0.001);

      camera.zoom = 0.0001;
      expect(camera.zoom).toBe(0.001);
    });

    it("should allow zoom values greater than 1", () => {
      camera.zoom = 5.0;
      expect(camera.zoom).toBe(5.0);

      camera.zoom = 100.0;
      expect(camera.zoom).toBe(100.0);
    });

    it("should allow fractional zoom values", () => {
      camera.zoom = 0.5;
      expect(camera.zoom).toBe(0.5);

      camera.zoom = 1.5;
      expect(camera.zoom).toBe(1.5);

      camera.zoom = 2.75;
      expect(camera.zoom).toBe(2.75);
    });

    it("should mark view matrix as dirty when zoom changes", () => {
      const viewMatrix1 = camera.getViewMatrix();

      camera.zoom = 2.0;

      const viewMatrix2 = camera.getViewMatrix();

      expect(viewMatrix1).not.toBe(viewMatrix2);
    });
  });

  describe("setPosition", () => {
    it("should set both x and y position", () => {
      camera.setPosition(150, 250);

      expect(camera.x).toBe(150);
      expect(camera.y).toBe(250);
    });

    it("should mark view matrix as dirty", () => {
      const viewMatrix1 = camera.getViewMatrix();

      camera.setPosition(100, 200);

      const viewMatrix2 = camera.getViewMatrix();

      expect(viewMatrix1).not.toBe(viewMatrix2);
    });

    it("should handle negative positions", () => {
      camera.setPosition(-100, -200);

      expect(camera.x).toBe(-100);
      expect(camera.y).toBe(-200);
    });

    it("should handle zero position", () => {
      camera.setPosition(100, 200);
      camera.setPosition(0, 0);

      expect(camera.x).toBe(0);
      expect(camera.y).toBe(0);
    });
  });

  describe("move", () => {
    it("should move camera by relative offset", () => {
      camera.setPosition(100, 200);

      camera.move(10, 20);

      expect(camera.x).toBe(110);
      expect(camera.y).toBe(220);
    });

    it("should handle positive offsets", () => {
      camera.move(50, 100);

      expect(camera.x).toBe(50);
      expect(camera.y).toBe(100);
    });

    it("should handle negative offsets", () => {
      camera.setPosition(100, 200);

      camera.move(-50, -100);

      expect(camera.x).toBe(50);
      expect(camera.y).toBe(100);
    });

    it("should mark view matrix as dirty", () => {
      const viewMatrix1 = camera.getViewMatrix();

      camera.move(10, 20);

      const viewMatrix2 = camera.getViewMatrix();

      expect(viewMatrix1).not.toBe(viewMatrix2);
    });

    it("should handle zero offset", () => {
      camera.setPosition(100, 200);

      camera.move(0, 0);

      expect(camera.x).toBe(100);
      expect(camera.y).toBe(200);
    });

    it("should handle fractional offsets", () => {
      camera.move(10.5, 20.75);

      expect(camera.x).toBe(10.5);
      expect(camera.y).toBe(20.75);
    });
  });

  describe("zoomBy", () => {
    it("should zoom by multiplier", () => {
      camera.zoom = 2.0;

      camera.zoomBy(1.5);

      expect(camera.zoom).toBe(3.0);
    });

    it("should zoom in with factor > 1", () => {
      camera.zoom = 1.0;

      camera.zoomBy(2.0);

      expect(camera.zoom).toBe(2.0);
    });

    it("should zoom out with factor < 1", () => {
      camera.zoom = 2.0;

      camera.zoomBy(0.5);

      expect(camera.zoom).toBe(1.0);
    });

    it("should clamp zoom to minimum of 0.001", () => {
      camera.zoom = 1.0;

      camera.zoomBy(0);

      expect(camera.zoom).toBe(0.001);

      camera.zoomBy(0.0001);

      expect(camera.zoom).toBe(0.001);
    });

    it("should handle fractional factors", () => {
      camera.zoom = 2.0;

      camera.zoomBy(1.25);

      expect(camera.zoom).toBe(2.5);
    });

    it("should mark view matrix as dirty", () => {
      const viewMatrix1 = camera.getViewMatrix();

      camera.zoomBy(1.5);

      const viewMatrix2 = camera.getViewMatrix();

      expect(viewMatrix1).not.toBe(viewMatrix2);
    });

    it("should work with fractional zoom values", () => {
      camera.zoom = 0.5;

      camera.zoomBy(2.0);

      expect(camera.zoom).toBe(1.0);
    });
  });

  describe("reset", () => {
    it("should reset camera to default position and zoom", () => {
      camera.setPosition(100, 200);
      camera.zoom = 2.5;

      camera.reset();

      expect(camera.x).toBe(0);
      expect(camera.y).toBe(0);
      expect(camera.zoom).toBe(1.0);
    });

    it("should mark view matrix as dirty", () => {
      camera.setPosition(100, 200);
      const viewMatrix1 = camera.getViewMatrix();

      camera.reset();

      const viewMatrix2 = camera.getViewMatrix();

      expect(viewMatrix1).not.toBe(viewMatrix2);
    });

    it("should release old matrix from pool", () => {
      const customPool = new Matrix4Pool({ initialSize: 10 });
      camera.setPool(customPool);

      camera.setPosition(100, 200);
      const viewMatrix1 = camera.getViewMatrix();

      camera.reset();

      // Pool should still work after reset
      const viewMatrix2 = camera.getViewMatrix();

      expect(viewMatrix1).not.toBe(viewMatrix2);

      customPool.clear();
    });

    it("should handle reset when no view matrix exists", () => {
      // Camera created, no view matrix yet
      expect(() => camera.reset()).not.toThrow();

      expect(camera.x).toBe(0);
      expect(camera.y).toBe(0);
      expect(camera.zoom).toBe(1.0);
    });
  });

  describe("getViewMatrix", () => {
    it("should return a view matrix", () => {
      const viewMatrix = camera.getViewMatrix();

      expect(viewMatrix).toBeInstanceOf(Float32Array);
      expect(viewMatrix).toHaveLength(16);
    });

    it("should cache view matrix until dirty", () => {
      const viewMatrix1 = camera.getViewMatrix();
      const viewMatrix2 = camera.getViewMatrix();

      // Should return the same matrix if not dirty
      expect(viewMatrix1).toBe(viewMatrix2);
    });

    it("should regenerate view matrix when position changes", () => {
      const viewMatrix1 = camera.getViewMatrix();

      camera.x = 100;

      const viewMatrix2 = camera.getViewMatrix();

      expect(viewMatrix1).not.toBe(viewMatrix2);
    });

    it("should regenerate view matrix when zoom changes", () => {
      const viewMatrix1 = camera.getViewMatrix();

      camera.zoom = 2.0;

      const viewMatrix2 = camera.getViewMatrix();

      expect(viewMatrix1).not.toBe(viewMatrix2);
    });

    it("should create correct view matrix for camera at origin", () => {
      camera.setPosition(0, 0);
      camera.zoom = 1.0;

      const viewMatrix = camera.getViewMatrix();

      // At origin with zoom 1, should be close to identity
      expect(viewMatrix[0]).toBe(1);
      expect(viewMatrix[5]).toBe(1);
      expect(viewMatrix[10]).toBe(1);
      expect(viewMatrix[15]).toBe(1);
    });

    it("should create view matrix with zoom applied", () => {
      camera.setPosition(0, 0);
      camera.zoom = 2.0;

      const viewMatrix = camera.getViewMatrix();

      // Scale should be applied
      expect(viewMatrix[0]).toBe(2.0);
      expect(viewMatrix[5]).toBe(2.0);
    });

    it("should create view matrix with translation applied", () => {
      camera.setPosition(100, 200);
      camera.zoom = 1.0;

      const viewMatrix = camera.getViewMatrix();

      // Translation should be negative (inverse of camera position)
      expect(viewMatrix[12]).toBe(-100);
      expect(viewMatrix[13]).toBe(-200);
    });

    it("should use custom pool when set", () => {
      const customPool = new Matrix4Pool({ initialSize: 10 });
      camera.setPool(customPool);

      const viewMatrix = camera.getViewMatrix();

      expect(viewMatrix).toBeInstanceOf(Float32Array);

      customPool.clear();
    });

    it("should use global pool when no custom pool set", () => {
      const viewMatrix = camera.getViewMatrix();

      expect(viewMatrix).toBeInstanceOf(Float32Array);
    });
  });

  describe("screenToWorld", () => {
    const viewportWidth = 800;
    const viewportHeight = 600;

    it("should convert screen coordinates to world coordinates", () => {
      camera.setPosition(0, 0);
      camera.zoom = 1.0;

      const world = camera.screenToWorld(400, 300, viewportWidth, viewportHeight);

      // Screen center should map to camera position
      expect(world.x).toBe(0);
      expect(world.y).toBe(0);
    });

    it("should apply camera position", () => {
      camera.setPosition(100, 200);
      camera.zoom = 1.0;

      const world = camera.screenToWorld(400, 300, viewportWidth, viewportHeight);

      expect(world.x).toBe(100);
      expect(world.y).toBe(200);
    });

    it("should apply zoom to coordinate transform", () => {
      camera.setPosition(0, 0);
      camera.zoom = 2.0;

      const world = camera.screenToWorld(500, 400, viewportWidth, viewportHeight);

      // (500 - 400) / 2.0 = 50
      // (400 - 300) / 2.0 = 50
      expect(world.x).toBe(50);
      expect(world.y).toBe(50);
    });

    it("should handle zoom out", () => {
      camera.setPosition(0, 0);
      camera.zoom = 0.5;

      const world = camera.screenToWorld(500, 400, viewportWidth, viewportHeight);

      // (500 - 400) / 0.5 = 200
      // (400 - 300) / 0.5 = 200
      expect(world.x).toBe(200);
      expect(world.y).toBe(200);
    });

    it("should handle screen coordinates at corners", () => {
      camera.setPosition(0, 0);
      camera.zoom = 1.0;

      // Top-left corner
      const topLeft = camera.screenToWorld(0, 0, viewportWidth, viewportHeight);
      expect(topLeft.x).toBe(-400);
      expect(topLeft.y).toBe(-300);

      // Bottom-right corner
      const bottomRight = camera.screenToWorld(800, 600, viewportWidth, viewportHeight);
      expect(bottomRight.x).toBe(400);
      expect(bottomRight.y).toBe(300);
    });

    it("should handle negative camera positions", () => {
      camera.setPosition(-100, -200);
      camera.zoom = 1.0;

      const world = camera.screenToWorld(400, 300, viewportWidth, viewportHeight);

      expect(world.x).toBe(-100);
      expect(world.y).toBe(-200);
    });

    it("should handle fractional zoom", () => {
      camera.setPosition(0, 0);
      camera.zoom = 1.5;

      const world = camera.screenToWorld(500, 400, viewportWidth, viewportHeight);

      // centeredX = 500 - 400 = 100, worldX = 100 / 1.5 = 66.67
      expect(world.x).toBeCloseTo(66.67, 1);
      expect(world.y).toBeCloseTo(66.67, 1);
    });

    it("should work with different viewport sizes", () => {
      camera.setPosition(0, 0);
      camera.zoom = 1.0;

      const world1 = camera.screenToWorld(400, 300, 800, 600);
      const world2 = camera.screenToWorld(200, 150, 400, 300);

      // Both should be at center, so both should map to origin
      expect(world1.x).toBe(0);
      expect(world1.y).toBe(0);
      expect(world2.x).toBe(0);
      expect(world2.y).toBe(0);
    });
  });

  describe("worldToScreen", () => {
    const viewportWidth = 800;
    const viewportHeight = 600;

    it("should convert world coordinates to screen coordinates", () => {
      camera.setPosition(0, 0);
      camera.zoom = 1.0;

      const screen = camera.worldToScreen(0, 0, viewportWidth, viewportHeight);

      // World origin should map to screen center
      expect(screen.x).toBe(400);
      expect(screen.y).toBe(300);
    });

    it("should apply camera position", () => {
      camera.setPosition(100, 200);
      camera.zoom = 1.0;

      const screen = camera.worldToScreen(100, 200, viewportWidth, viewportHeight);

      // World position matching camera position should map to screen center
      expect(screen.x).toBe(400);
      expect(screen.y).toBe(300);
    });

    it("should apply zoom to coordinate transform", () => {
      camera.setPosition(0, 0);
      camera.zoom = 2.0;

      const screen = camera.worldToScreen(50, 50, viewportWidth, viewportHeight);

      // centeredX = (50 - 0) * 2.0 = 100, screenX = 100 + 400 = 500
      // centeredY = (50 - 0) * 2.0 = 100, screenY = 100 + 300 = 400
      expect(screen.x).toBe(500);
      expect(screen.y).toBe(400);
    });

    it("should handle zoom out", () => {
      camera.setPosition(0, 0);
      camera.zoom = 0.5;

      const screen = camera.worldToScreen(200, 200, viewportWidth, viewportHeight);

      // 200 * 0.5 + 400 = 500
      expect(screen.x).toBe(500);
      expect(screen.y).toBe(400); // 200 * 0.5 + 300
    });

    it("should be inverse of screenToWorld", () => {
      camera.setPosition(100, 200);
      camera.zoom = 1.5;

      const originalScreen = { x: 500, y: 400 };
      const world = camera.screenToWorld(
        originalScreen.x,
        originalScreen.y,
        viewportWidth,
        viewportHeight,
      );
      const reconstructedScreen = camera.worldToScreen(
        world.x,
        world.y,
        viewportWidth,
        viewportHeight,
      );

      expect(reconstructedScreen.x).toBeCloseTo(originalScreen.x, 5);
      expect(reconstructedScreen.y).toBeCloseTo(originalScreen.y, 5);
    });

    it("should handle negative world coordinates", () => {
      camera.setPosition(0, 0);
      camera.zoom = 1.0;

      const screen = camera.worldToScreen(-100, -200, viewportWidth, viewportHeight);

      expect(screen.x).toBe(300); // -100 + 400
      expect(screen.y).toBe(100); // -200 + 300
    });

    it("should handle fractional zoom", () => {
      camera.setPosition(0, 0);
      camera.zoom = 1.5;

      const screen = camera.worldToScreen(100, 100, viewportWidth, viewportHeight);

      expect(screen.x).toBe(550); // 100 * 1.5 + 400
      expect(screen.y).toBe(450); // 100 * 1.5 + 300
    });

    it("should work with different viewport sizes", () => {
      camera.setPosition(0, 0);
      camera.zoom = 1.0;

      const screen1 = camera.worldToScreen(0, 0, 800, 600);
      const screen2 = camera.worldToScreen(0, 0, 400, 300);

      expect(screen1.x).toBe(400);
      expect(screen1.y).toBe(300);
      expect(screen2.x).toBe(200);
      expect(screen2.y).toBe(150);
    });

    it("should handle coordinates that result in off-screen positions", () => {
      camera.setPosition(0, 0);
      camera.zoom = 1.0;

      // World coordinates far from camera
      const screen = camera.worldToScreen(2000, 1500, viewportWidth, viewportHeight);

      expect(screen.x).toBe(2400); // 2000 + 400
      expect(screen.y).toBe(1800); // 1500 + 300
    });
  });

  describe("Round-trip Coordinate Transforms", () => {
    const viewportWidth = 800;
    const viewportHeight = 600;

    it("should preserve coordinates through screen->world->screen", () => {
      camera.setPosition(100, 200);
      camera.zoom = 1.5;

      const originalScreen = { x: 500, y: 400 };
      const world = camera.screenToWorld(
        originalScreen.x,
        originalScreen.y,
        viewportWidth,
        viewportHeight,
      );
      const reconstructedScreen = camera.worldToScreen(
        world.x,
        world.y,
        viewportWidth,
        viewportHeight,
      );

      expect(reconstructedScreen.x).toBeCloseTo(originalScreen.x, 5);
      expect(reconstructedScreen.y).toBeCloseTo(originalScreen.y, 5);
    });

    it("should preserve coordinates through world->screen->world", () => {
      camera.setPosition(100, 200);
      camera.zoom = 1.5;

      const originalWorld = { x: 300, y: 400 };
      const screen = camera.worldToScreen(
        originalWorld.x,
        originalWorld.y,
        viewportWidth,
        viewportHeight,
      );
      const reconstructedWorld = camera.screenToWorld(
        screen.x,
        screen.y,
        viewportWidth,
        viewportHeight,
      );

      expect(reconstructedWorld.x).toBeCloseTo(originalWorld.x, 5);
      expect(reconstructedWorld.y).toBeCloseTo(originalWorld.y, 5);
    });

    it("should handle multiple round-trips", () => {
      camera.setPosition(50, 100);
      camera.zoom = 2.0;

      let x = 500;
      let y = 400;

      // Perform multiple round-trips
      for (let i = 0; i < 5; i++) {
        const world = camera.screenToWorld(x, y, viewportWidth, viewportHeight);
        const screen = camera.worldToScreen(world.x, world.y, viewportWidth, viewportHeight);
        x = screen.x;
        y = screen.y;
      }

      // After multiple round-trips, should still be close to original
      expect(x).toBeCloseTo(500, 5);
      expect(y).toBeCloseTo(400, 5);
    });
  });

  describe("Edge Cases and Complex Scenarios", () => {
    it("should handle extreme zoom values", () => {
      camera.zoom = 100.0;

      const world = camera.screenToWorld(401, 301, 800, 600);

      expect(world.x).toBeCloseTo(0.01, 2);
      expect(world.y).toBeCloseTo(0.01, 2);
    });

    it("should handle minimum zoom value", () => {
      camera.zoom = 0.001;

      const screen = camera.worldToScreen(1000, 1000, 800, 600);

      expect(screen.x).toBeCloseTo(401, 1); // 1000 * 0.001 + 400
      expect(screen.y).toBeCloseTo(301, 1);
    });

    it("should handle very large camera positions", () => {
      camera.setPosition(100000, 200000);
      camera.zoom = 1.0;

      const screen = camera.worldToScreen(100000, 200000, 800, 600);

      expect(screen.x).toBe(400);
      expect(screen.y).toBe(300);
    });

    it("should handle rapid camera movements", () => {
      camera.setPosition(0, 0);

      for (let i = 0; i < 100; i++) {
        camera.move(10, 20);
      }

      expect(camera.x).toBe(1000);
      expect(camera.y).toBe(2000);

      const viewMatrix = camera.getViewMatrix();
      expect(viewMatrix).toBeInstanceOf(Float32Array);
    });

    it("should handle rapid zoom changes", () => {
      camera.zoom = 1.0;

      for (let i = 0; i < 10; i++) {
        camera.zoomBy(1.1);
      }

      expect(camera.zoom).toBeGreaterThan(2.0);

      const viewMatrix = camera.getViewMatrix();
      expect(viewMatrix).toBeInstanceOf(Float32Array);
    });

    it("should handle simultaneous position and zoom changes", () => {
      camera.setPosition(100, 200);
      camera.zoom = 2.0;

      const world = camera.screenToWorld(400, 300, 800, 600);
      expect(world.x).toBe(100);
      expect(world.y).toBe(200);

      const screen = camera.worldToScreen(100, 200, 800, 600);
      expect(screen.x).toBe(400);
      expect(screen.y).toBe(300);
    });

    it("should handle asymmetric viewport dimensions", () => {
      camera.setPosition(0, 0);
      camera.zoom = 1.0;

      const viewportWidth = 1920;
      const viewportHeight = 1080;

      const center = camera.screenToWorld(960, 540, viewportWidth, viewportHeight);

      expect(center.x).toBe(0);
      expect(center.y).toBe(0);
    });
  });

  describe("Integration with Matrix Pool", () => {
    it("should work correctly with custom pool", () => {
      const customPool = new Matrix4Pool({ initialSize: 5 });
      camera.setPool(customPool);

      camera.setPosition(100, 200);
      camera.zoom = 2.0;

      const viewMatrix = camera.getViewMatrix();
      expect(viewMatrix).toBeInstanceOf(Float32Array);

      const world = camera.screenToWorld(400, 300, 800, 600);
      expect(world.x).toBe(100);

      const screen = camera.worldToScreen(100, 200, 800, 600);
      expect(screen.x).toBe(400);

      customPool.clear();
    });

    it("should handle pool switching during camera lifetime", () => {
      const customPool1 = new Matrix4Pool({ initialSize: 5 });
      const customPool2 = new Matrix4Pool({ initialSize: 5 });

      camera.setPool(customPool1);
      const viewMatrix1 = camera.getViewMatrix();

      camera.setPool(customPool2);
      camera.x = 50;
      const viewMatrix2 = camera.getViewMatrix();

      expect(viewMatrix1).not.toBe(viewMatrix2);

      customPool1.clear();
      customPool2.clear();
    });

    it("should use global pool after setting pool to undefined", () => {
      const customPool = new Matrix4Pool({ initialSize: 5 });
      camera.setPool(customPool);

      const viewMatrix1 = camera.getViewMatrix();

      camera.setPool(undefined);
      camera.x = 50;

      const viewMatrix2 = camera.getViewMatrix();

      expect(viewMatrix1).not.toBe(viewMatrix2);

      customPool.clear();
    });
  });
});
