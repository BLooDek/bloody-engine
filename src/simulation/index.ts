/**
 * Simulation System - Pure game logic with zero rendering code
 *
 * This module provides:
 * - Entity: Simulation state for game objects
 * - EntityManager: CRUD operations and queries for entities
 * - SimulationLoop: Main game simulation that processes commands and updates entities
 *
 * The simulation system is designed to be:
 * - Deterministic: Same inputs produce same outputs
 * - Decoupled: No rendering code, pure simulation logic
 * - Testable: Can run without graphics context
 */

// Entity system
export { Entity } from "./entity";
export type { EntityState } from "./entity";

// Entity manager
export { EntityManager } from "./entity-manager";
export type { EntityQuery } from "./entity-manager";

// Simulation loop
export { SimulationLoop } from "./simulation-loop";
export type { SimulationConfig } from "./simulation-loop";
