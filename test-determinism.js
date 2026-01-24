/**
 * Determinism Test for Bloody Engine
 *
 * This test verifies that the simulation is deterministic:
 * - Runs two instances of the SimulationLoop with the same input seed
 * - Compares the state of all entities after 1000 ticks
 * - They must match perfectly
 */

import { SimulationLoop, CommandQueue, CommandType } from "./dist/node/index.js";

// ============================================================================
// Test Configuration
// ============================================================================

const TEST_CONFIG = {
  tickCount: 1000,
  tickRate: 20, // 20 ticks per second (dt = 0.05)
  seed: 12345, // Random seed for command generation
  commandProbability: 0.1, // 10% chance per tick to generate a command
  movementSpeed: 2.0,
  entityCount: 10,
  debug: false,
};

// ============================================================================
// Seeded Random Number Generator
// ============================================================================

/**
 * A simple seeded random number generator (Mulberry32)
 * Provides reproducible random sequences for testing
 */
class SeededRNG {
  constructor(seed) {
    this.state = seed;
  }

  /**
   * Generate next random number in [0, 1)
   */
  next() {
    let t = this.state += 0x6D2B79F5;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  }

  /**
   * Generate random integer in [min, max]
   */
  nextInt(min, max) {
    return Math.floor(this.next() * (max - min + 1)) + min;
  }

  /**
   * Generate random element from array
   */
  pick(array) {
    return array[this.nextInt(0, array.length - 1)];
  }
}

// ============================================================================
// Command Generation
// ============================================================================

const DIRECTIONS = ["N", "S", "E", "W", "NE", "NW", "SE", "SW"];
const COMMAND_TYPES = [
  CommandType.MOVE_NORTH,
  CommandType.MOVE_SOUTH,
  CommandType.MOVE_EAST,
  CommandType.MOVE_WEST,
];

/**
 * Generate a sequence of commands based on a random seed
 * @param seed Random seed
 * @param tickCount Number of ticks to generate commands for
 * @param entityIds Entity IDs to target with commands
 * @returns Array of commands
 */
function generateCommands(seed, tickCount, entityIds) {
  const rng = new SeededRNG(seed);
  const commands = [];

  for (let tick = 0; tick < tickCount; tick++) {
    // Randomly decide whether to generate a command this tick
    if (rng.next() < TEST_CONFIG.commandProbability) {
      const commandType = rng.pick(COMMAND_TYPES);

      commands.push({
        type: commandType,
        tick: tick,
      });
    }
  }

  return commands;
}

// ============================================================================
// Entity State Comparison
// ============================================================================

/**
 * Compare two entity states for equality
 * @param state1 First entity state
 * @param state2 Second entity state
 * @returns Object with match result and details
 */
function compareEntityStates(state1, state2) {
  const errors = [];

  // Compare position
  if (state1.gridPos.xgrid !== state2.gridPos.xgrid) {
    errors.push(`xgrid mismatch: ${state1.gridPos.xgrid} vs ${state2.gridPos.xgrid}`);
  }
  if (state1.gridPos.ygrid !== state2.gridPos.ygrid) {
    errors.push(`ygrid mismatch: ${state1.gridPos.ygrid} vs ${state2.gridPos.ygrid}`);
  }
  if (state1.gridPos.zheight !== state2.gridPos.zheight) {
    errors.push(`zheight mismatch: ${state1.gridPos.zheight} vs ${state2.gridPos.zheight}`);
  }

  // Compare velocity
  if (state1.velocity.x !== state2.velocity.x) {
    errors.push(`velocity.x mismatch: ${state1.velocity.x} vs ${state2.velocity.x}`);
  }
  if (state1.velocity.y !== state2.velocity.y) {
    errors.push(`velocity.y mismatch: ${state1.velocity.y} vs ${state2.velocity.y}`);
  }
  if (state1.velocity.z !== state2.velocity.z) {
    errors.push(`velocity.z mismatch: ${state1.velocity.z} vs ${state2.velocity.z}`);
  }

  // Compare other properties
  if (state1.rotation !== state2.rotation) {
    errors.push(`rotation mismatch: ${state1.rotation} vs ${state2.rotation}`);
  }
  if (state1.speed !== state2.speed) {
    errors.push(`speed mismatch: ${state1.speed} vs ${state2.speed}`);
  }
  if (state1.isMoving !== state2.isMoving) {
    errors.push(`isMoving mismatch: ${state1.isMoving} vs ${state2.isMoving}`);
  }

  return {
    match: errors.length === 0,
    errors,
  };
}

/**
 * Compare two entity managers for exact state equality
 * @param manager1 First entity manager
 * @param manager2 Second entity manager
 * @returns Comparison result
 */
function compareEntityManagers(manager1, manager2) {
  const entities1 = manager1.getAllEntities();
  const entities2 = manager2.getAllEntities();

  const result = {
    match: true,
    entityCountMatch: true,
    entityCountDiff: 0,
    entityErrors: [],
    missingEntities: [],
    extraEntities: [],
  };

  // Check entity count
  if (entities1.length !== entities2.length) {
    result.entityCountMatch = false;
    result.entityCountDiff = entities2.length - entities1.length;
    result.match = false;
  }

  // Create ID maps for comparison
  const entityMap1 = new Map(entities1.map(e => [e.id, e]));
  const entityMap2 = new Map(entities2.map(e => [e.id, e]));

  // Check for missing/extra entities
  for (const id of entityMap1.keys()) {
    if (!entityMap2.has(id)) {
      result.missingEntities.push(id);
      result.match = false;
    }
  }

  for (const id of entityMap2.keys()) {
    if (!entityMap1.has(id)) {
      result.extraEntities.push(id);
      result.match = false;
    }
  }

  // Compare states of matching entities
  for (const [id, entity1] of entityMap1) {
    const entity2 = entityMap2.get(id);
    if (entity2) {
      const stateComparison = compareEntityStates(entity1.state, entity2.state);
      if (!stateComparison.match) {
        result.entityErrors.push({
          entityId: id,
          errors: stateComparison.errors,
        });
        result.match = false;
      }
    }
  }

  return result;
}

// ============================================================================
// Simulation Runner
// ============================================================================

/**
 * Run a simulation instance with the given commands
 * @param commands Array of commands to execute
 * @returns SimulationLoop instance after running
 */
function runSimulation(commands) {
  const commandQueue = new CommandQueue();
  const simulation = new SimulationLoop(commandQueue, {
    movementSpeed: TEST_CONFIG.movementSpeed,
    debug: TEST_CONFIG.debug,
  });

  // Create test entities
  const entityIds = [];
  for (let i = 0; i < TEST_CONFIG.entityCount; i++) {
    const x = (i % 5) * 2; // Spread across x axis
    const y = Math.floor(i / 5) * 2; // Spread across y axis
    const z = i % 3; // Vary z heights
    const entity = simulation.createPlayer(x, y, z);
    entityIds.push(entity.id);
  }

  // Seed the command queue with generated commands
  for (const command of commands) {
    commandQueue.enqueue(command);
  }

  // Run the simulation
  const dt = 1.0 / TEST_CONFIG.tickRate;
  for (let tick = 0; tick < TEST_CONFIG.tickCount; tick++) {
    simulation.update(dt);
  }

  return simulation;
}

/**
 * Format entity state for display
 */
function formatEntityState(entity) {
  const pos = entity.state.gridPos;
  const vel = entity.state.velocity;
  return `pos=(${pos.xgrid}, ${pos.ygrid}, ${pos.zheight}) ` +
         `vel=(${vel.x.toFixed(2)}, ${vel.y.toFixed(2)}, ${vel.z.toFixed(2)}) ` +
         `speed=${entity.state.speed} ` +
         `rot=${entity.state.rotation.toFixed(2)} ` +
         `moving=${entity.state.isMoving}`;
}

// ============================================================================
// Test Implementation
// ============================================================================

/**
 * Run the determinism test
 */
function runDeterminismTest() {
  console.log("\n" + "=".repeat(60));
  console.log("🔮 DETERMINISM TEST");
  console.log("=".repeat(60));
  console.log(`\n📋 Configuration:`);
  console.log(`  Ticks: ${TEST_CONFIG.tickCount}`);
  console.log(`  Tick rate: ${TEST_CONFIG.tickRate} Hz`);
  console.log(`  Seed: ${TEST_CONFIG.seed}`);
  console.log(`  Command probability: ${TEST_CONFIG.commandProbability * 100}%`);
  console.log(`  Entity count: ${TEST_CONFIG.entityCount}`);

  // ==========================================================================
  // Step 1: Generate Commands
  // ==========================================================================
  console.log("\n📋 Step 1: Generate Commands");
  const commands = generateCommands(
    TEST_CONFIG.seed,
    TEST_CONFIG.tickCount,
    []
  );
  console.log(`✓ Generated ${commands.length} commands`);

  // ==========================================================================
  // Step 2: Run First Simulation Instance
  // ==========================================================================
  console.log("\n📋 Step 2: Run First Simulation Instance");
  const sim1 = runSimulation(commands);
  console.log(`✓ Instance 1 completed: ${sim1.currentTick} ticks, ${sim1.entities.count} entities`);

  // ==========================================================================
  // Step 3: Run Second Simulation Instance
  // ==========================================================================
  console.log("\n📋 Step 3: Run Second Simulation Instance");
  const sim2 = runSimulation(commands);
  console.log(`✓ Instance 2 completed: ${sim2.currentTick} ticks, ${sim2.entities.count} entities`);

  // ==========================================================================
  // Step 4: Compare States
  // ==========================================================================
  console.log("\n📋 Step 4: Compare Entity States");

  const comparison = compareEntityManagers(sim1.entities, sim2.entities);

  console.log(`\n📊 Comparison Results:`);
  console.log(`  Entity count match: ${comparison.entityCountMatch ? "✓" : "✗"}`);
  console.log(`  Entity count difference: ${comparison.entityCountDiff}`);

  if (comparison.missingEntities.length > 0) {
    console.log(`  Missing entities (in sim1, not in sim2): ${comparison.missingEntities.join(", ")}`);
  }

  if (comparison.extraEntities.length > 0) {
    console.log(`  Extra entities (in sim2, not in sim1): ${comparison.extraEntities.join(", ")}`);
  }

  if (comparison.entityErrors.length > 0) {
    console.log(`  Entities with state mismatches: ${comparison.entityErrors.length}`);

    // Show first few mismatches in detail
    const maxErrorsToShow = 5;
    for (let i = 0; i < Math.min(comparison.entityErrors.length, maxErrorsToShow); i++) {
      const error = comparison.entityErrors[i];
      const entity1 = sim1.entities.getEntity(error.entityId);
      const entity2 = sim2.entities.getEntity(error.entityId);

      console.log(`\n  🔍 Entity ${error.entityId}:`);
      console.log(`    Sim1: ${formatEntityState(entity1)}`);
      console.log(`    Sim2: ${formatEntityState(entity2)}`);
      console.log(`    Errors:`);
      for (const err of error.errors) {
        console.log(`      - ${err}`);
      }
    }

    if (comparison.entityErrors.length > maxErrorsToShow) {
      console.log(`\n  ... and ${comparison.entityErrors.length - maxErrorsToShow} more entities`);
    }
  }

  // ==========================================================================
  // Step 5: Final Result
  // ==========================================================================
  console.log("\n" + "=".repeat(60));

  if (comparison.match) {
    console.log("✅ TEST PASSED");
    console.log("   Both simulation instances produced identical results!");
    console.log("   The simulation is deterministic.");
  } else {
    console.log("✗ TEST FAILED");
    console.log("   The simulation instances produced different results.");
    console.log("   This indicates a determinism issue.");
  }

  console.log("=".repeat(60) + "\n");

  return comparison.match;
}

// Run the test
try {
  const passed = runDeterminismTest();
  process.exit(passed ? 0 : 1);
} catch (error) {
  console.error("\n✗ Test failed with error:", error);
  console.error(error.stack);
  process.exit(1);
}
