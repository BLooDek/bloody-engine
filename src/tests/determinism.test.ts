/**
 * Determinism Test for Bloody Engine
 *
 * This test verifies that the simulation is deterministic:
 * - Runs two instances of the SimulationLoop with the same input seed
 * - Compares the state of all entities after 1000 ticks
 * - They must match perfectly
 */

/// <reference types="vitest/globals" />

import { SimulationLoop } from "../simulation";
import { CommandQueue } from "../input/command-queue";
import { CommandType, type Command } from "../input/command-types";
import { describe, it, expect } from "vitest";

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
};

// ============================================================================
// Seeded Random Number Generator
// ============================================================================

/**
 * A simple seeded random number generator (Mulberry32)
 * Provides reproducible random sequences for testing
 */
class SeededRNG {
  private state: number;

  constructor(seed: number) {
    this.state = seed;
  }

  /**
   * Generate next random number in [0, 1)
   */
  next(): number {
    let t = this.state += 0x6D2B79F5;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  }

  /**
   * Generate random integer in [min, max]
   */
  nextInt(min: number, max: number): number {
    return Math.floor(this.next() * (max - min + 1)) + min;
  }

  /**
   * Generate random element from array
   */
  pick<T>(array: T[]): T {
    return array[this.nextInt(0, array.length - 1)];
  }
}

// ============================================================================
// Command Generation
// ============================================================================

const COMMAND_TYPES = [
  CommandType.MOVE_NORTH,
  CommandType.MOVE_SOUTH,
  CommandType.MOVE_EAST,
  CommandType.MOVE_WEST,
];

/**
 * Generate a sequence of commands based on a random seed
 */
function generateCommands(seed: number, tickCount: number): Command[] {
  const rng = new SeededRNG(seed);
  const commands: Command[] = [];

  for (let tick = 0; tick < tickCount; tick++) {
    // Randomly decide whether to generate a command this tick
    if (rng.next() < TEST_CONFIG.commandProbability) {
      const commandType = rng.pick(COMMAND_TYPES);

      commands.push({
        type: commandType,
        tick: tick,
      } as Command);
    }
  }

  return commands;
}

// ============================================================================
// Entity State Comparison
// ============================================================================

/**
 * Compare two entity states for equality
 */
function compareEntityStates(state1: any, state2: any): { match: boolean; errors: string[] } {
  const errors: string[] = [];

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
 */
function compareEntityManagers(manager1: any, manager2: any): {
  match: boolean;
  entityCountMatch: boolean;
  entityCountDiff: number;
  entityErrors: Array<{ entityId: string; errors: string[] }>;
  missingEntities: string[];
  extraEntities: string[];
} {
  const entities1 = manager1.getAllEntities();
  const entities2 = manager2.getAllEntities();

  const result = {
    match: true,
    entityCountMatch: true,
    entityCountDiff: 0,
    entityErrors: [] as Array<{ entityId: string; errors: string[] }>,
    missingEntities: [] as string[],
    extraEntities: [] as string[],
  };

  // Check entity count
  if (entities1.length !== entities2.length) {
    result.entityCountMatch = false;
    result.entityCountDiff = entities2.length - entities1.length;
    result.match = false;
  }

  // Create ID maps for comparison
  const entityMap1 = new Map<string, any>(entities1.map((e: any) => [e.id, e]));
  const entityMap2 = new Map<string, any>(entities2.map((e: any) => [e.id, e]));

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
 */
function runSimulation(commands: Command[]): SimulationLoop {
  const commandQueue = new CommandQueue();
  const simulation = new SimulationLoop(commandQueue, {
    movementSpeed: TEST_CONFIG.movementSpeed,
    debug: false,
  });

  // Create test entities
  for (let i = 0; i < TEST_CONFIG.entityCount; i++) {
    const x = (i % 5) * 2; // Spread across x axis
    const y = Math.floor(i / 5) * 2; // Spread across y axis
    const z = i % 3; // Vary z heights
    simulation.createPlayer(x, y, z);
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

// ============================================================================
// Tests
// ============================================================================

describe("Determinism", () => {
  it("should produce identical results when running the same simulation twice", () => {
    // Generate commands
    const commands = generateCommands(
      TEST_CONFIG.seed,
      TEST_CONFIG.tickCount
    );

    // Run two simulation instances
    const sim1 = runSimulation(commands);
    const sim2 = runSimulation(commands);

    // Compare the results
    const comparison = compareEntityManagers(sim1.entities, sim2.entities);

    // Assertions
    expect(comparison.entityCountMatch).toBe(true);
    expect(comparison.missingEntities).toHaveLength(0);
    expect(comparison.extraEntities).toHaveLength(0);
    expect(comparison.entityErrors).toHaveLength(0);
    expect(comparison.match).toBe(true);
  });

  it("should have the same entity count after simulation", () => {
    const commands = generateCommands(TEST_CONFIG.seed, TEST_CONFIG.tickCount);
    const sim1 = runSimulation(commands);
    const sim2 = runSimulation(commands);

    expect(sim1.entities.count).toBe(sim2.entities.count);
    expect(sim1.entities.count).toBe(TEST_CONFIG.entityCount);
  });

  it("should produce deterministic entity states", () => {
    const commands = generateCommands(TEST_CONFIG.seed, TEST_CONFIG.tickCount);
    const sim1 = runSimulation(commands);
    const sim2 = runSimulation(commands);

    const entities1 = sim1.entities.getAllEntities();
    const entities2 = sim2.entities.getAllEntities();

    expect(entities1).toHaveLength(entities2.length);

    for (const entity1 of entities1) {
      const entity2 = entities2.find((e: any) => e.id === entity1.id);
      expect(entity2).toBeDefined();

      const stateComparison = compareEntityStates(entity1.state, (entity2 as any).state);
      expect(stateComparison.match).toBe(true);
    }
  });

  it("should handle empty command sequences deterministically", () => {
    const emptyCommands: Command[] = [];
    const sim1 = runSimulation(emptyCommands);
    const sim2 = runSimulation(emptyCommands);

    const comparison = compareEntityManagers(sim1.entities, sim2.entities);
    expect(comparison.match).toBe(true);
  });

  it("should handle full command sequences deterministically", () => {
    // Generate a command for every tick
    const rng = new SeededRNG(TEST_CONFIG.seed);
    const commands: Command[] = [];
    for (let tick = 0; tick < TEST_CONFIG.tickCount; tick++) {
      commands.push({
        type: rng.pick(COMMAND_TYPES),
        tick,
      } as Command);
    }

    const sim1 = runSimulation(commands);
    const sim2 = runSimulation(commands);

    const comparison = compareEntityManagers(sim1.entities, sim2.entities);
    expect(comparison.match).toBe(true);
  });
});
