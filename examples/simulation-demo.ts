/**
 * Simulation Loop Demo
 *
 * Demonstrates the simulation system integrated with the Ticker system.
 * Shows:
 * - Command queue consumption
 * - Entity position updates
 * - Zero rendering code in simulation
 * - Deterministic replay capability
 */

import {
  Ticker,
  type TickerConfig,
  CommandQueue,
  SimulationLoop,
  CommandType,
} from "../src/public-api";
import type { MoveCommand } from "../src/input/command-types";

console.log("=== Bloody Engine - Simulation Loop Demo ===\n");

// ============================================================================
// Setup Simulation
// ============================================================================

// Create command queue
const commandQueue = new CommandQueue();

// Create simulation loop with debug mode enabled
const simulation = new SimulationLoop(commandQueue, {
  movementSpeed: 2.0, // 2 grid cells per second
  debug: true,
});

// Create a player entity at position (5, 5, 0)
const player = simulation.createPlayer(5, 5, 0);

// Create some enemy entities
const enemy1 = simulation.entities.createEntity("enemy", {
  gridPos: { xgrid: 10, ygrid: 8, zheight: 0 },
  speed: 1.0,
});

const enemy2 = simulation.entities.createEntity("enemy", {
  gridPos: { xgrid: 3, ygrid: 12, zheight: 0 },
  speed: 1.5,
});

console.log(`\n✓ Created ${simulation.entities.count} entities:`);
console.log(`  - Player at (${player.state.gridPos.xgrid}, ${player.state.gridPos.ygrid})`);
console.log(`  - Enemy 1 at (${enemy1.state.gridPos.xgrid}, ${enemy1.state.gridPos.ygrid})`);
console.log(`  - Enemy 2 at (${enemy2.state.gridPos.xgrid}, ${enemy2.state.gridPos.ygrid})`);

// ============================================================================
// Queue Some Commands
// ============================================================================

console.log("\n=== Queuing Movement Commands ===\n");

// Queue movement commands for the player
const movementCommands: MoveCommand[] = [
  { type: CommandType.MOVE_EAST, tick: 0 },
  { type: CommandType.MOVE_EAST, tick: 1 },
  { type: CommandType.MOVE_EAST, tick: 2 },
  { type: CommandType.MOVE_NORTH, tick: 3 },
  { type: CommandType.MOVE_NORTH, tick: 4 },
  { type: CommandType.MOVE_WEST, tick: 5 },
  { type: CommandType.MOVE_WEST, tick: 6 },
  { type: CommandType.MOVE_SOUTH, tick: 7 },
];

for (const cmd of movementCommands) {
  commandQueue.enqueue(cmd);
  const dirStr = cmd.type.replace("MOVE_", "");
  console.log(`  Queued: ${dirStr} at tick ${cmd.tick}`);
}

// ============================================================================
// Setup Ticker
// ============================================================================

console.log("\n=== Starting Ticker (20 ticks/sec) ===\n");

const config: TickerConfig = {
  tickRate: 20, // 20 ticks per second
  maxFPS: 60,
  interpolationEnabled: false, // Not needed for this demo
  adaptiveFrameSkip: true,
  maxAccumulatedTime: 1.0,

  onSimulationUpdate: (dt, tick) => {
    // Update simulation (this processes commands and updates entities)
    simulation.update(dt);

    // Log entity positions every 10 ticks
    if (tick % 10 === 0 || tick < 10) {
      console.log(`\n[Tick ${tick}] Entity Positions:`);
      for (const entity of simulation.entities.getAllEntities()) {
        const pos = entity.state.gridPos;
        console.log(`  ${entity.type} (${entity.id}): (${pos.xgrid}, ${pos.ygrid}, ${pos.zheight})`);
      }
    }
  },

  onRender: (alpha) => {
    // This demo has no rendering - it's pure simulation
    // In a real game, you would render entities here using their interpolated states
  },

  onError: (error) => {
    console.error("Ticker error:", error);
  },
};

// Create and start ticker
const ticker = new Ticker(config);
ticker.start();

// ============================================================================
// Monitoring
// ============================================================================

let printCount = 0;
const monitorInterval = setInterval(() => {
  const state = ticker.getState();
  const stats = simulation.getStats();

  console.log("\n=== Stats ===");
  console.log(`Ticks: ${state.tickCount} | Frames: ${state.frameCount}`);
  console.log(`Entities: ${stats.entityCount}`);
  console.log(`Queue: ${stats.queueStats.size} commands`);
  console.log(`Selected: ${stats.selectedEntityId || "none"}`);

  printCount++;

  // Stop after we've processed all commands
  if (state.tickCount > 15) {
    clearInterval(monitorInterval);
    console.log("\n=== Simulation Complete ===");

    // Final entity positions
    console.log("\nFinal Entity Positions:");
    for (const entity of simulation.entities.getAllEntities()) {
      const pos = entity.state.gridPos;
      console.log(`  ${entity.type} (${entity.id}): (${pos.xgrid}, ${pos.ygrid}, ${pos.zheight})`);
    }

    // Demonstrate deterministic replay
    console.log("\n=== Demonstrating Deterministic Replay ===");
    demonstrateDeterministicReplay();

    // Stop ticker
    ticker.stop();

    // Exit after a short delay
    setTimeout(() => {
      process.exit(0);
    }, 1000);
  }
}, 500);

// ============================================================================
// Deterministic Replay Demonstration
// ============================================================================

function demonstrateDeterministicReplay() {
  console.log("\nReplaying simulation with same commands...");

  // Create new simulation with same initial state
  const replayQueue = new CommandQueue();
  const replaySimulation = new SimulationLoop(replayQueue, { debug: false, movementSpeed: 2.0 });

  // Recreate entities at same positions
  const replayPlayer = replaySimulation.createPlayer(5, 5, 0);
  const replayEnemy1 = replaySimulation.entities.createEntity("enemy", {
    gridPos: { xgrid: 10, ygrid: 8, zheight: 0 },
    speed: 1.0,
  });
  const replayEnemy2 = replaySimulation.entities.createEntity("enemy", {
    gridPos: { xgrid: 3, ygrid: 12, zheight: 0 },
    speed: 1.5,
  });

  // Queue same commands
  for (const cmd of movementCommands) {
    replayQueue.enqueue(cmd);
  }

  // Run simulation to same tick
  const targetTick = 8;
  for (let i = 0; i <= targetTick; i++) {
    replaySimulation.update(1 / 20); // 20 ticks/sec = 0.05s per tick
  }

  // Compare final states
  console.log("\nComparing final states:");

  const originalEntities = simulation.entities.getAllEntities();
  const replayEntities = replaySimulation.entities.getAllEntities();

  let allMatch = true;
  for (let i = 0; i < originalEntities.length; i++) {
    const orig = originalEntities[i];
    const replay = replayEntities[i];

    const origPos = orig.state.gridPos;
    const replayPos = replay.state.gridPos;

    const match =
      origPos.xgrid === replayPos.xgrid &&
      origPos.ygrid === replayPos.ygrid &&
      origPos.zheight === replayPos.zheight;

    console.log(
      `  ${orig.type}: Original (${origPos.xgrid}, ${origPos.ygrid}, ${origPos.zheight}) vs ` +
        `Replay (${replayPos.xgrid}, ${replayPos.ygrid}, ${replayPos.zheight}) - ` +
        `${match ? "✓ MATCH" : "✗ MISMATCH"}`
    );

    if (!match) allMatch = false;
  }

  console.log(`\n${allMatch ? "✓ Determinism verified!" : "✗ Determinism failed!"}`);
}

// ============================================================================
// Graceful Shutdown
// ============================================================================

process.on("SIGINT", () => {
  console.log("\n\n>>> Received SIGINT, stopping simulation... <<<\n");
  ticker.stop();
  clearInterval(monitorInterval);
  process.exit(0);
});
