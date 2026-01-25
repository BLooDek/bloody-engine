/**
 * Sub-Grid Position Tracking Demo
 *
 * Demonstrates the new float-based position tracking that enables:
 * - Smooth, continuous movement between grid cells
 * - Precise velocity-based movement
 * - Integer grid coordinates for discrete logic
 */

import { Entity } from "../src/simulation/entity";

console.log("\n" + "=".repeat(60));
console.log("🎮 SUB-GRID POSITION TRACKING DEMO");
console.log("=".repeat(60));

// Create an entity at origin
const entity = new Entity("hero", "player", {
  gridPos: { xgrid: 0, ygrid: 0, zheight: 0 },
  speed: 2.0,
});

console.log("\n📍 Initial State:");
console.log("  Float Position:", entity.getPosition());
console.log("  Grid Position (floor):", entity.getGridPos());
console.log("  Rounded Position:", entity.getRoundedGridPos());

// Example 1: Setting float position directly
console.log("\n" + "─".repeat(60));
console.log("📐 Example 1: Setting Float Position");
console.log("─".repeat(60));

entity.setGridPos(2.7, 3.4, 0.5);
console.log("  Set position to (2.7, 3.4, 0.5)");
console.log("  Float Position:", entity.getPosition());
console.log("  Grid Position (floor):", entity.getGridPos());
console.log("  Rounded Position:", entity.getRoundedGridPos());

// Example 2: Smooth movement with velocity
console.log("\n" + "─".repeat(60));
console.log("🚀 Example 2: Smooth Velocity-Based Movement");
console.log("─".repeat(60));

entity.setGridPos(0, 0, 0);
entity.setVelocity(1, 0.5, 0);
entity._state.isMoving = true;

console.log("  Set velocity to (1, 0.5, 0) with speed 2.0");
console.log("\n  Simulating 60 ticks at ~16ms (0.016s) per frame:");

const dt = 0.016; // 60 FPS
for (let i = 1; i <= 10; i++) {
  const changed = entity.updateVelocity(dt * i);
  const pos = entity.getPosition();
  const gridPos = entity.getGridPos();

  console.log(`    Frame ${i}: float=(${pos.x.toFixed(2)}, ${pos.y.toFixed(2)}, ${pos.z.toFixed(2)}) ` +
              `grid=(${gridPos.x}, ${gridPos.y}, ${gridPos.z})`);
}

// Example 3: Sub-grid movement for smooth animation
console.log("\n" + "─".repeat(60));
console.log("✨ Example 3: Smooth Movement Between Grid Cells");
console.log("─".repeat(60));

entity.setGridPos(0, 0, 0);
entity.setVelocity(3, 2, 0);
entity._state.isMoving = true;

console.log("  Moving from (0, 0) to (3, 2) with smooth interpolation:");
console.log("\n  Progress | Float Position           | Grid Cell");
console.log("  " + "─".repeat(55));

const steps = 10;
for (let i = 0; i <= steps; i++) {
  const t = i / steps; // Progress from 0 to 1
  const entity2 = new Entity("test", "player", {
    gridPos: { xgrid: 0 + 3 * t, ygrid: 0 + 2 * t, zheight: 0 },
  });

  const pos = entity2.getPosition();
  const gridPos = entity2.getGridPos();

  console.log(`  ${t.toFixed(1)}      | (${pos.x.toFixed(2)}, ${pos.y.toFixed(2)}, ${pos.z.toFixed(2)})     ` +
              `| (${gridPos.x}, ${gridPos.y}, ${gridPos.z})`);
}

// Example 4: Discrete vs continuous movement
console.log("\n" + "─".repeat(60));
console.log("🔄 Example 4: Discrete vs Continuous Movement");
console.log("─".repeat(60));

const entityDiscrete = new Entity("discrete", "player", {
  gridPos: { xgrid: 0, ygrid: 0, zheight: 0 },
});

const entityContinuous = new Entity("continuous", "player", {
  gridPos: { xgrid: 0, ygrid: 0, zheight: 0 },
});

console.log("  Both entities start at (0, 0, 0)");
console.log("  Both move by (1.7, 0.5, 0)");

entityDiscrete.moveGridCells(1.7, 0.5, 0); // Discrete movement
entityContinuous.move(1.7, 0.5, 0); // Continuous movement

console.log("\n  Discrete (moveGridCells):", entityDiscrete.getPosition());
console.log("  Continuous (move):", entityContinuous.getPosition());

console.log("\n  Discrete grid cell:", entityDiscrete.getGridPos());
console.log("  Continuous grid cell:", entityContinuous.getGridPos());

// Example 5: Serialization preserves floats
console.log("\n" + "─".repeat(60));
console.log("💾 Example 5: Serialization Preserves Floats");
console.log("─".repeat(60));

entity.setGridPos(5.7, 3.2, 1.8);
const serialized = entity.serialize();
console.log("  Position: (5.7, 3.2, 1.8)");
console.log("  Serialized:", serialized);

const restored = Entity.deserialize(serialized);
console.log("  Restored position:", restored.getPosition());

console.log("\n" + "=".repeat(60));
console.log("✅ Sub-grid position tracking demo complete!");
console.log("=".repeat(60));

console.log("\n📚 Key Takeaways:");
console.log("  • getPosition() - Returns float positions for smooth rendering");
console.log("  • getGridPos() - Returns floored integers for discrete logic");
console.log("  • getRoundedGridPos() - Returns rounded integers for picking");
console.log("  • setGridPos() - Accepts floats for precise positioning");
console.log("  • move() - Supports fractional movement");
console.log("  • moveGridCells() - Discrete integer movement when needed");
console.log("  • updateVelocity() - Now tracks smooth sub-grid movement");
