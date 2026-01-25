/**
 * Coordinate Systems Demo
 *
 * Demonstrates the difference between correct and incorrect control implementations
 * to help developers avoid inverted controls.
 *
 * This demo shows:
 * - Grid space vs screen space coordinates
 * - Correct WASD controls using direction deltas
 * - Incorrect controls that demonstrate the bug
 * - Real-time coordinate display in both systems
 *
 * Controls:
 * - WASD / Arrow Keys: Move the entity
 * - TAB: Toggle between "Correct Mode" and "Bug Mode"
 * - R: Reset position
 * - Q: Quit
 *
 * Run with: npm run build && node dist/node/examples/coordinate-systems-demo.js
 */

import { CommandQueue } from "../src/input/command-queue";
import {
  SimulationLoop,
  DIRECTION_DELTAS,
} from "../src/simulation/simulation-loop";
import { Entity } from "../src/simulation/entity";
import {
  gridToScreen,
  type GridCoord,
  type ScreenCoord,
} from "../src/rendering/projection";

// ANSI color codes for terminal output
const colors = {
  reset: "\x1b[0m",
  bright: "\x1b[1m",
  red: "\x1b[31m",
  green: "\x1b[32m",
  yellow: "\x1b[33m",
  blue: "\x1b[34m",
  cyan: "\x1b[36m",
  white: "\x1b[37m",
};

/**
 * Demo state
 */
interface DemoState {
  entity: Entity;
  correctMode: boolean;
  gridPos: { x: number; y: number; z: number };
  screenPos: { xscreen: number; yscreen: number };
}

/**
 * Simulates screen coordinates for demonstration
 * In a real application, use the actual projection from the rendering system
 */
function mockGridToScreen(gridPos: GridCoord): ScreenCoord {
  // Simplified isometric projection for demo
  const tileWidth = 64;
  const tileHeight = 32;

  return {
    xscreen: (gridPos.xgrid - gridPos.ygrid) * (tileWidth / 2),
    yscreen:
      (gridPos.xgrid + gridPos.ygrid) * (tileHeight / 2) - gridPos.zheight * 10,
  };
}

/**
 * Clear terminal and render the demo UI
 */
function renderUI(state: DemoState) {
  console.clear();

  console.log(colors.cyan + colors.bright);
  console.log(
    "╔══════════════════════════════════════════════════════════════════╗",
  );
  console.log(
    "║     Bloody Engine - Coordinate Systems Interactive Demo         ║",
  );
  console.log(
    "╚══════════════════════════════════════════════════════════════════╝",
  );
  console.log(colors.reset);

  // Mode indicator
  if (state.correctMode) {
    console.log(
      colors.green +
        colors.bright +
        "✓ MODE: CORRECT (Using Direction Deltas)" +
        colors.reset,
    );
  } else {
    console.log(
      colors.red +
        colors.bright +
        "✗ MODE: BUG DEMO (Inverted Controls)" +
        colors.reset,
    );
  }

  console.log("");
  console.log(colors.yellow + "Controls:" + colors.reset);
  console.log("  WASD / Arrows  - Move entity");
  console.log("  TAB            - Toggle Correct/Bug mode");
  console.log("  R              - Reset position");
  console.log("  Q              - Quit");
  console.log("");

  // Entity position display
  console.log(colors.cyan + "Entity Position:" + colors.reset);
  console.log(
    `  Grid Space:  (${state.gridPos.x}, ${state.gridPos.y}, ${state.gridPos.z})`,
  );
  console.log(
    `  Screen Space: (${state.screenPos.xscreen.toFixed(1)}, ${state.screenPos.yscreen.toFixed(1)})`,
  );
  console.log("");

  // Direction deltas reference
  console.log(colors.yellow + "Direction Deltas (Grid Space):" + colors.reset);
  console.log("  N  = {dx:  0, dy: -1}  →  Up on screen");
  console.log("  S  = {dx:  0, dy:  1}  →  Down on screen");
  console.log("  E  = {dx:  1, dy:  0}  →  Right on screen");
  console.log("  W  = {dx: -1, dy:  0}  →  Left on screen");
  console.log("");

  // Coordinate system explanation
  console.log(colors.cyan + "Key Insight:" + colors.reset);
  console.log(
    "  Grid Space uses Y-UP:    decreasing ygrid = North (up on screen)",
  );
  console.log("Screen Space uses Y-DOWN: decreasing yscreen = Up on screen");
  console.log("");

  // Visual representation
  renderGridVisualization(state);

  console.log("");
  console.log(
    colors.bright + "Press WASD to move, TAB to toggle mode" + colors.reset,
  );
}

/**
 * Render a simple ASCII grid visualization
 */
function renderGridVisualization(state: DemoState) {
  const gridSize = 9;
  const center = Math.floor(gridSize / 2);
  const px = Math.round(state.gridPos.x);
  const py = Math.round(state.gridPos.y);

  console.log(
    colors.yellow + "Grid Visualization (Top-down view):" + colors.reset,
  );
  console.log("    y- (North/Up)");
  console.log("");

  for (let y = center - 4; y <= center + 4; y++) {
    let line = "    ";
    if (y === center - 4) line += "y+  ";
    else if (y === center + 4) line += "    ";
    else line += "    ";

    for (let x = center - 4; x <= center + 4; x++) {
      if (x === px && y === py) {
        // Entity position
        line += state.correctMode
          ? colors.green + "@" + colors.reset
          : colors.red + "@" + colors.reset;
      } else if (x === center && y === center) {
        // Origin
        line += colors.bright + "+" + colors.reset;
      } else {
        // Empty grid cell
        line += "·";
      }
      line += " ";
    }

    console.log(line);
  }

  console.log("");
  console.log("         x- (West)         +         x+ (East)");
}

/**
 * CORRECT: Move entity using direction deltas from grid space
 */
function moveCorrect(state: DemoState, direction: string): void {
  const delta = DIRECTION_DELTAS[direction];
  if (!delta) return;

  state.gridPos.x += delta.dx;
  state.gridPos.y += delta.dy;

  // Update screen position using projection
  state.screenPos = mockGridToScreen(state.gridPos);

  console.log(
    colors.green +
      `✓ CORRECT: Moved ${direction} using delta {dx: ${delta.dx}, dy: ${delta.dy}}` +
      colors.reset,
  );
}

/**
 * WRONG: Move entity using screen coordinates directly
 * This demonstrates the bug that causes inverted controls
 */
function moveIncorrect(state: DemoState, key: string): void {
  let dx = 0;
  let dy = 0;

  // BUG: Mapping keys to coordinate changes without considering grid space
  switch (key.toLowerCase()) {
    case "w":
    case "arrowup":
      // BUG: Decreasing screen Y moves up, but in grid space this decreases ygrid (North)
      // So the entity moves up, which is what we want, but the mental model is wrong!
      dy = -1;
      break;
    case "s":
    case "arrowdown":
      // BUG: Increasing screen Y moves down, but in grid space this increases ygrid (South)
      dy = 1;
      break;
    case "a":
    case "arrowleft":
      dx = -1;
      break;
    case "d":
    case "arrowright":
      dx = 1;
      break;
  }

  state.gridPos.x += dx;
  state.gridPos.y += dy;
  state.screenPos = mockGridToScreen(state.gridPos);

  console.log(
    colors.red +
      `✗ BUG DEMO: Direct coordinate change {dx: ${dx}, dy: ${dy}}` +
      colors.reset,
  );
  console.log(
    colors.red +
      `  (Avoid this - use direction deltas instead!)` +
      colors.reset,
  );
}

/**
 * Handle keyboard input
 */
function handleInput(key: string, state: DemoState): boolean {
  const keyLower = key.toLowerCase();

  // Toggle mode
  if (keyLower === "tab") {
    state.correctMode = !state.correctMode;
    return true;
  }

  // Reset position
  if (keyLower === "r") {
    state.gridPos = { x: 0, y: 0, z: 0 };
    state.screenPos = mockGridToScreen(state.gridPos);
    console.log(colors.yellow + "Position reset to origin" + colors.reset);
    return true;
  }

  // Quit
  if (keyLower === "q") {
    console.log(
      colors.yellow +
        "\nThanks for using the Coordinate Systems Demo!" +
        colors.reset,
    );
    return false;
  }

  // Movement keys
  const movementKeys = [
    "w",
    "a",
    "s",
    "d",
    "arrowup",
    "arrowdown",
    "arrowleft",
    "arrowright",
  ];
  if (movementKeys.includes(keyLower)) {
    // Map key to direction
    let direction: string | null = null;
    switch (keyLower) {
      case "w":
      case "arrowup":
        direction = "N";
        break;
      case "s":
      case "arrowdown":
        direction = "S";
        break;
      case "a":
      case "arrowleft":
        direction = "W";
        break;
      case "d":
      case "arrowright":
        direction = "E";
        break;
    }

    if (direction) {
      if (state.correctMode) {
        moveCorrect(state, direction);
      } else {
        moveIncorrect(state, keyLower);
      }
    }
    return true;
  }

  return true;
}

/**
 * Main demo loop
 */
async function runDemo() {
  console.log(
    colors.yellow + "Initializing Coordinate Systems Demo..." + colors.reset,
  );

  // Create entity at origin
  const entity = new Entity("demo-entity", {
    gridPos: { xgrid: 0, ygrid: 0, zheight: 0 },
    velocity: { x: 0, y: 0, z: 0 },
    rotation: 0,
    speed: 1.0,
    isMoving: false,
  });

  // Initialize demo state
  const state: DemoState = {
    entity,
    correctMode: true, // Start in correct mode
    gridPos: { x: 0, y: 0, z: 0 },
    screenPos: mockGridToScreen({ xgrid: 0, ygrid: 0, zheight: 0 }),
  };

  // Initial render
  renderUI(state);

  // Simple input loop
  console.log(
    colors.cyan + "\nDemo ready! Press a key to start..." + colors.reset,
  );

  // For Node.js demo, we'll use a simple readline interface
  // In a real SDL application, you'd use SDL event handling
  const readline = require("readline");
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
  });

  // Set raw mode to capture individual keypresses
  process.stdin.setRawMode(true);
  process.stdin.resume();
  process.stdin.setEncoding("utf8");

  let running = true;

  process.stdin.on("data", (key: string) => {
    // Handle Ctrl+C
    if (key === "\u0003") {
      running = false;
      rl.close();
      process.exit(0);
      return;
    }

    // Handle input
    running = handleInput(key, state);
    renderUI(state);

    if (!running) {
      rl.close();
      process.exit(0);
    }
  });

  // Keep the process alive
  await new Promise<void>((resolve) => {
    rl.on("close", () => resolve());
  });
}

// Run the demo
runDemo().catch((error) => {
  console.error(colors.red + "Error running demo:" + colors.reset, error);
  process.exit(1);
});
