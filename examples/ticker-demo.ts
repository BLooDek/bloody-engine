/**
 * Ticker Demo - Demonstrates the unified ticker system
 *
 * This example shows how to:
 * - Set up a ticker with fixed timestep simulation
 * - Use state interpolation for smooth rendering
 * - Change tick rate at runtime
 * - Monitor performance metrics
 */

import {
  Ticker,
  type TickerConfig,
  StateBuffer,
  lerpVec2,
  lerpAngle,
  lerp,
} from "../src/public-api.js";

// ============================================================================
// Entity State Interface
// ============================================================================

interface EntityState {
  position: { x: number; y: number };
  rotation: number;
  scale: number;
}

// ============================================================================
// Simulation Logic
// ============================================================================

/**
 * Calculate entity state for a given tick
 * This represents the game logic that runs at fixed timestep
 */
function calculateEntityState(tick: number, tickRate: number): EntityState {
  const t = tick / tickRate; // Time in seconds

  return {
    // Circular motion
    position: {
      x: Math.cos(t * 0.5) * 100,
      y: Math.sin(t * 0.5) * 100,
    },
    // Slow rotation
    rotation: t * 0.2,
    // Pulsing scale
    scale: 1.0 + Math.sin(t * 2) * 0.3,
  };
}

/**
 * Interpolate between two entity states
 */
function lerpEntityState(a: EntityState, b: EntityState, t: number): EntityState {
  return {
    position: lerpVec2(a.position, b.position, t),
    rotation: lerpAngle(a.rotation, b.rotation, t),
    scale: lerp(a.scale, b.scale, t),
  };
}

// ============================================================================
// Ticker Setup
// ============================================================================

console.log("=== Bloody Engine - Ticker Demo ===\n");

// Create state buffers for entities
const playerState = new StateBuffer<EntityState>({
  position: { x: 0, y: 0 },
  rotation: 0,
  scale: 1.0,
});

const enemyState = new StateBuffer<EntityState>({
  position: { x: 50, y: 50 },
  rotation: 0,
  scale: 0.8,
});

// Ticker configuration
const config: TickerConfig = {
  tickRate: 20, // 20 simulation ticks per second (50ms)
  maxFPS: 60, // Cap rendering at 60 FPS
  adaptiveFrameSkip: true,
  maxAccumulatedTime: 1.0, // Spiral of death protection
  interpolationEnabled: true,

  onSimulationUpdate: (dt, tick) => {
    // Fixed timestep: Update game logic
    const playerNewState = calculateEntityState(tick, config.tickRate);
    playerState.update(playerNewState);

    // Enemy moves at different speed (offset by 180 ticks)
    const enemyNewState = calculateEntityState(
      tick + 180,
      config.tickRate
    );
    enemyState.update(enemyNewState);
  },

  onRender: (alpha) => {
    // Variable timestep: Render with interpolated states
    const player = playerState.interpolate(alpha, lerpEntityState);
    const enemy = enemyState.interpolate(alpha, lerpEntityState);

    // In a real engine, you would render these states here
    // For this demo, we just log occasionally
    if (Math.random() < 0.01) {
      // Log 1% of frames to avoid spam
      console.log(
        `[Render] Player: pos(${player.position.x.toFixed(1)}, ${player.position.y.toFixed(1)}) ` +
          `rot(${player.rotation.toFixed(2)}) scale(${player.scale.toFixed(2)}) ` +
          `alpha: ${alpha.toFixed(3)}`
      );
    }
  },

  onError: (error) => {
    console.error("Ticker error:", error);
  },
};

// Create and start ticker
const ticker = new Ticker(config);
console.log("Starting ticker with 20 ticks/sec and 60 FPS cap...\n");
ticker.start();

// ============================================================================
// Performance Monitoring
// ============================================================================

let lastPrintTime = Date.now();

setInterval(() => {
  const state = ticker.getState();
  const metrics = ticker.getMetrics();

  console.log("\n=== Ticker Stats ===");
  console.log(`Simulation: ${state.tickCount} ticks @ ${state.actualTickRate.toFixed(1)} Hz`);
  console.log(`Rendering: ${state.frameCount} frames @ ${state.actualFPS.toFixed(1)} FPS`);
  console.log(`Frame Time: ${metrics.avgFrameTime.toFixed(2)}ms`);
  console.log(`Sim Time: ${metrics.avgSimulationTime.toFixed(2)}ms (${metrics.simulationLoad.toFixed(1)}% load)`);
  console.log(`Render Time: ${metrics.avgRenderTime.toFixed(2)}ms (${metrics.renderLoad.toFixed(1)}% load)`);
  console.log(`Interpolation Alpha: ${state.interpolationAlpha.toFixed(3)}`);
  console.log(`Spiral of Death Triggers: ${metrics.spiralOfDeathCount}`);
  console.log(`Elapsed Time: ${state.elapsedTime.toFixed(1)}s\n`);
}, 2000); // Print every 2 seconds

// ============================================================================
// Runtime Configuration Changes
// ============================================================================

// Change tick rate after 10 seconds
setTimeout(() => {
  console.log("\n>>> Changing tick rate to 30 ticks/sec <<<\n");
  ticker.updateConfig({ tickRate: 30 });
}, 10000);

// Change FPS cap after 20 seconds
setTimeout(() => {
  console.log("\n>>> Changing FPS cap to 144 FPS <<<\n");
  ticker.updateConfig({ maxFPS: 144 });
}, 20000);

// Disable interpolation after 30 seconds
setTimeout(() => {
  console.log("\n>>> Disabling interpolation <<<\n");
  ticker.updateConfig({ interpolationEnabled: false });
}, 30000);

// Stop after 40 seconds
setTimeout(() => {
  console.log("\n>>> Stopping ticker <<<\n");
  ticker.stop();

  // Print final stats
  const state = ticker.getState();
  const metrics = ticker.getMetrics();

  console.log("\n=== Final Stats ===");
  console.log(`Total Ticks: ${state.tickCount}`);
  console.log(`Total Frames: ${state.frameCount}`);
  console.log(`Total Time: ${state.elapsedTime.toFixed(1)}s`);
  console.log(`Avg FPS: ${state.actualFPS.toFixed(1)}`);
  console.log(`Spiral of Death Triggers: ${metrics.spiralOfDeathCount}`);

  process.exit(0);
}, 40000);

// ============================================================================
// Graceful Shutdown
// ============================================================================

process.on("SIGINT", () => {
  console.log("\n\n>>> Received SIGINT, stopping ticker... <<<\n");
  ticker.stop();
  process.exit(0);
});
