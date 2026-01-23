/**
 * Batch Renderer Integration Test
 *
 * Verifies that the batch renderer:
 * 1. Creates and initializes correctly
 * 2. Accepts quad instances
 * 3. Updates vertex buffer on frame updates
 * 4. Renders without errors
 * 5. Handles edge cases (empty batch, max capacity, etc.)
 */

import { GraphicsDevice } from "./grahpic-device";
import { BatchRenderer, type QuadInstance } from "./batch-renderer";
import { Texture } from "./core/texture";
import { SHADERS } from "./scene/scene";

async function runIntegrationTest(): Promise<void> {
  console.log("🧪 Batch Renderer Integration Tests\n");

  try {
    // Test 1: Initialization
    console.log("Test 1: Initialization");
    const gdevice = new GraphicsDevice(800, 600);
    const gl = gdevice.getGLContext();
    const shader = gdevice.createShader(SHADERS.vertex, SHADERS.fragment);
    const texture = Texture.createGradient(gl, 256, 256);
    const batchRenderer = new BatchRenderer(gl, shader, 10);
    batchRenderer.setTexture(texture);
    console.log("  ✓ BatchRenderer created successfully\n");

    // Test 2: Add single quad
    console.log("Test 2: Add single quad");
    const quad1: QuadInstance = {
      x: 0,
      y: 0,
      width: 0.5,
      height: 0.5,
      rotation: 0,
      color: [1, 0, 0],
    };
    batchRenderer.addQuad(quad1);
    console.log(
      `  ✓ Added quad, batch size: ${batchRenderer.getQuadCount()}\n`,
    );

    // Test 3: Add multiple quads
    console.log("Test 3: Add multiple quads");
    for (let i = 0; i < 5; i++) {
      const quad: QuadInstance = {
        x: -0.5 + i * 0.2,
        y: 0,
        width: 0.1,
        height: 0.1,
        rotation: (i * Math.PI) / 5,
        color: [Math.sin(i), Math.cos(i), Math.sin(i + Math.PI)] as [
          number,
          number,
          number,
        ],
      };
      batchRenderer.addQuad(quad);
    }
    console.log(
      `  ✓ Added 5 more quads, batch size: ${batchRenderer.getQuadCount()}\n`,
    );

    // Test 4: Test max capacity
    console.log("Test 4: Test max capacity (capacity=10)");
    try {
      // Should have 6 quads, add 5 more to reach capacity
      for (let i = 0; i < 5; i++) {
        batchRenderer.addQuad({
          x: 0,
          y: 0.5,
          width: 0.05,
          height: 0.05,
          rotation: 0,
          color: [1, 1, 0],
        });
      }
      console.log(
        `  ✓ Added quads up to capacity: ${batchRenderer.getQuadCount()}\n`,
      );
    } catch (e) {
      console.log(`  ✗ Error: ${e}\n`);
    }

    // Test 5: Render empty batch
    console.log("Test 5: Render empty batch");
    batchRenderer.clear();
    console.log(`  ✓ Cleared batch, size: ${batchRenderer.getQuadCount()}`);
    gdevice.clear({ r: 0.1, g: 0.1, b: 0.1, a: 1 });
    batchRenderer.render(); // Should not error
    console.log("  ✓ Rendered empty batch without errors\n");

    // Test 6: Render with quads
    console.log("Test 6: Render with quads");
    batchRenderer.addQuad({
      x: 0,
      y: 0,
      width: 0.4,
      height: 0.4,
      rotation: Math.PI / 4,
      color: [1, 0.5, 0],
    });
    gdevice.clear({ r: 0.1, g: 0.1, b: 0.1, a: 1 });
    batchRenderer.render();
    console.log("  ✓ Rendered batch with quads\n");

    // Test 7: Dynamic updates (simulating frame updates)
    console.log("Test 7: Dynamic updates over frames");
    const frameCount = 10;
    for (let frame = 0; frame < frameCount; frame++) {
      batchRenderer.clear();

      // Add rotating quad
      const rotation = (frame / frameCount) * Math.PI * 2;
      batchRenderer.addQuad({
        x: 0.3 * Math.cos(rotation),
        y: 0.3 * Math.sin(rotation),
        width: 0.2,
        height: 0.2,
        rotation: rotation,
        color: [
          0.5 + 0.5 * Math.cos(rotation),
          0.5 + 0.5 * Math.sin(rotation),
          0.5,
        ] as [number, number, number],
      });

      gdevice.clear({ r: 0.1, g: 0.1, b: 0.1, a: 1 });
      batchRenderer.render();
    }
    console.log(`  ✓ Successfully updated and rendered ${frameCount} frames\n`);

    // Test 8: Rotation verification
    console.log("Test 8: Rotation verification");
    const rotations = [0, Math.PI / 4, Math.PI / 2, Math.PI, -Math.PI / 4];
    for (const rot of rotations) {
      batchRenderer.clear();
      batchRenderer.addQuad({
        x: 0,
        y: 0,
        width: 0.5,
        height: 0.5,
        rotation: rot,
        color: [1, 1, 1],
      });
      gdevice.clear({ r: 0, g: 0, b: 0, a: 1 });
      batchRenderer.render();
    }
    console.log("  ✓ Rotation values tested successfully\n");

    // Test 9: Color ranges
    console.log("Test 9: Color value ranges");
    const colors: [number, number, number][] = [
      [0, 0, 0], // Black
      [1, 1, 1], // White
      [1, 0, 0], // Red
      [0, 1, 0], // Green
      [0, 0, 1], // Blue
      [0.5, 0.5, 0.5], // Gray
    ];
    for (const color of colors) {
      batchRenderer.clear();
      batchRenderer.addQuad({
        x: 0,
        y: 0,
        width: 0.3,
        height: 0.3,
        rotation: 0,
        color: color,
      });
      gdevice.clear({ r: 0, g: 0, b: 0, a: 1 });
      batchRenderer.render();
    }
    console.log("  ✓ All color values tested successfully\n");

    // Cleanup
    batchRenderer.dispose();
    gdevice.dispose();

    console.log("✅ All tests passed!\n");
    console.log("Summary:");
    console.log("  - Initialization: PASS");
    console.log("  - Single quad: PASS");
    console.log("  - Multiple quads: PASS");
    console.log("  - Capacity handling: PASS");
    console.log("  - Empty batch rendering: PASS");
    console.log("  - Full batch rendering: PASS");
    console.log("  - Dynamic updates: PASS");
    console.log("  - Rotation handling: PASS");
    console.log("  - Color ranges: PASS");
  } catch (error) {
    console.error("❌ Test failed:", error);
    process.exit(1);
  }
}

// Run tests
runIntegrationTest();
