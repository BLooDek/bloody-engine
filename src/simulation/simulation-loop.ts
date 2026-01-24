/**
 * SimulationLoop - Core game simulation logic
 *
 * Processes the command queue and updates entity positions.
 * Contains ZERO rendering code - pure simulation only.
 *
 * This class is designed to be deterministic:
 * - Given the same initial state and command sequence, it will produce the same result
 * - Uses fixed timestep updates for consistent behavior across different framerates
 */

import { CommandQueue } from "../input/command-queue";
import { CommandType, type Command, type MoveCommand } from "../input/command-types";
import { EntityManager } from "./entity-manager";
import { Entity } from "./entity";

/**
 * Configuration for the simulation loop
 */
export interface SimulationConfig {
  /**
   * Movement speed in grid cells per second
   */
  movementSpeed: number;

  /**
   * Enable debug logging
   */
  debug: boolean;
}

/**
 * Default simulation configuration
 */
const DEFAULT_CONFIG: SimulationConfig = {
  movementSpeed: 2.0, // 2 grid cells per second
  debug: false,
};

/**
 * Direction mapping for movement commands
 */
const DIRECTION_DELTAS: Record<string, { dx: number; dy: number }> = {
  "N": { dx: 0, dy: -1 },
  "S": { dx: 0, dy: 1 },
  "E": { dx: 1, dy: 0 },
  "W": { dx: -1, dy: 0 },
  "NE": { dx: 1, dy: -1 },
  "NW": { dx: -1, dy: -1 },
  "SE": { dx: 1, dy: 1 },
  "SW": { dx: -1, dy: 1 },
};

/**
 * SimulationLoop - Main simulation class
 *
 * Responsibilities:
 * - Maintain the entity manager
 * - Process commands from the command queue
 * - Update entity positions based on commands
 * - Handle collision detection (future)
 * - Handle game logic (future)
 *
 * NOT responsible for:
 * - Rendering
 * - Input capture (that's handled by InputSource classes)
 * - Frame rate management (that's handled by Ticker)
 */
export class SimulationLoop {
  private entityManager: EntityManager;
  private commandQueue: CommandQueue;
  private config: SimulationConfig;
  private _currentTick: number = 0;

  // Track selected entity for commands that target entities
  private selectedEntityId: string | null = null;

  /**
   * Create a new simulation loop
   * @param commandQueue - The command queue to consume from
   * @param config - Optional simulation configuration
   */
  constructor(commandQueue: CommandQueue, config: Partial<SimulationConfig> = {}) {
    this.commandQueue = commandQueue;
    this.config = { ...DEFAULT_CONFIG, ...config };
    this.entityManager = new EntityManager();

    if (this.config.debug) {
      console.log("[Simulation] Initialized with config:", this.config);
    }
  }

  /**
   * Get the entity manager
   */
  get entities(): EntityManager {
    return this.entityManager;
  }

  /**
   * Get the current tick number
   */
  get currentTick(): number {
    return this._currentTick;
  }

  /**
   * Update the simulation by one timestep
   *
   * This is the main simulation update method. It:
   * 1. Saves previous state for all entities (for interpolation)
   * 2. Consumes and processes all commands for this tick
   * 3. Updates entity positions based on velocity and time
   *
   * @param dt - Delta time in seconds (fixed timestep from Ticker)
   *
   * IMPORTANT: This method contains ZERO rendering code.
   * All visual representation is handled separately by the rendering system.
   */
  update(dt: number): void {
    // Step 1: Save previous state for all entities (for interpolation)
    this.entityManager.saveAllStates();

    // Step 2: Process all commands queued for this tick
    this.processCommandsForTick(this._currentTick);

    // Step 3: Update entity positions based on velocity
    this.updateEntityPositions(dt);

    // Step 4: Increment tick counter
    this._currentTick++;

    if (this.config.debug && this._currentTick % 60 === 0) {
      const stats = this.entityManager.getStats();
      console.log(`[Simulation] Tick ${this._currentTick}: ${stats.total} entities`, stats.byType);
    }
  }

  /**
   * Process all commands for a specific tick
   * @private
   */
  private processCommandsForTick(tick: number): void {
    const commands = this.commandQueue.getCommandsForTick(tick);

    for (const command of commands) {
      this.processCommand(command);
    }

    // Remove processed commands to prevent memory buildup
    this.commandQueue.removeUpToTick(tick);
  }

  /**
   * Process a single command
   * @private
   */
  private processCommand(command: Command): void {
    if (this.config.debug) {
      console.log(`[Simulation] Processing command: ${command.type} at tick ${command.tick}`);
    }

    switch (command.type) {
      case CommandType.MOVE:
      case CommandType.MOVE_NORTH:
      case CommandType.MOVE_SOUTH:
      case CommandType.MOVE_EAST:
      case CommandType.MOVE_WEST:
        this.handleMoveCommand(command);
        break;

      case CommandType.SELECT:
        this.handleSelectCommand(command);
        break;

      case CommandType.ATTACK:
        this.handleAttackCommand(command);
        break;

      case CommandType.INTERACT:
        this.handleInteractCommand(command);
        break;
    }
  }

  /**
   * Handle movement commands
   * @private
   */
  private handleMoveCommand(command: MoveCommand): void {
    // For now, we'll move the selected entity
    // In a full implementation, this would target a specific entity ID
    const targetId = this.selectedEntityId;

    if (!targetId) {
      if (this.config.debug) {
        console.warn("[Simulation] Move command ignored: no entity selected");
      }
      return;
    }

    const entity = this.entityManager.getEntity(targetId);
    if (!entity) {
      if (this.config.debug) {
        console.warn(`[Simulation] Move command ignored: entity ${targetId} not found`);
      }
      return;
    }

    // Determine direction
    let direction = command.direction;

    // If it's a directional command type, extract direction from type
    if (!direction) {
      switch (command.type) {
        case CommandType.MOVE_NORTH:
          direction = "N";
          break;
        case CommandType.MOVE_SOUTH:
          direction = "S";
          break;
        case CommandType.MOVE_EAST:
          direction = "E";
          break;
        case CommandType.MOVE_WEST:
          direction = "W";
          break;
      }
    }

    if (direction && DIRECTION_DELTAS[direction]) {
      const delta = DIRECTION_DELTAS[direction];
      entity.move(delta.dx, delta.dy, 0);

      if (this.config.debug) {
        const pos = entity.state.gridPos;
        console.log(`[Simulation] Moved ${entity.id} to (${pos.xgrid}, ${pos.ygrid}, ${pos.zheight})`);
      }
    } else {
      // For MOVE command without direction, we could implement continuous movement
      // For now, just log that we received it
      if (this.config.debug) {
        console.log(`[Simulation] MOVE command for ${entity.id} (continuous movement not yet implemented)`);
      }
    }
  }

  /**
   * Handle select command
   * @private
   */
  private handleSelectCommand(command: Command): void {
    if ("targetId" in command && command.targetId) {
      this.selectedEntityId = command.targetId;

      if (this.config.debug) {
        console.log(`[Simulation] Selected entity: ${command.targetId}`);
      }
    } else {
      // Select entity at current mouse position (requires screen-to-grid conversion)
      // This would be implemented with camera/projection system integration
      if (this.config.debug) {
        console.log("[Simulation] Select command (position-based selection not yet implemented)");
      }
    }
  }

  /**
   * Handle attack command
   * @private
   */
  private handleAttackCommand(command: Command): void {
    if (this.config.debug) {
      console.log("[Simulation] Attack command (combat system not yet implemented)");
    }
    // Combat logic would go here
  }

  /**
   * Handle interact command
   * @private
   */
  private handleInteractCommand(command: Command): void {
    if (this.config.debug) {
      console.log("[Simulation] Interact command (interaction system not yet implemented)");
    }
    // Interaction logic would go here
  }

  /**
   * Update entity positions based on velocity
   * @private
   */
  private updateEntityPositions(dt: number): void {
    const entities = this.entityManager.getAllEntities();

    for (const entity of entities) {
      // Update velocity-based movement
      const changed = entity.updateVelocity(dt);

      if (changed && this.config.debug) {
        const pos = entity.state.gridPos;
        console.log(`[Simulation] ${entity.id} moved to (${pos.xgrid}, ${pos.ygrid}, ${pos.zheight})`);
      }
    }
  }

  /**
   * Reset the simulation to initial state
   */
  reset(): void {
    this.entityManager.clear();
    this._currentTick = 0;
    this.selectedEntityId = null;

    if (this.config.debug) {
      console.log("[Simulation] Reset to initial state");
    }
  }

  /**
   * Get simulation statistics
   */
  getStats(): {
    currentTick: number;
    entityCount: number;
    selectedEntityId: string | null;
    queueStats: ReturnType<CommandQueue["getStats"]>;
  } {
    return {
      currentTick: this._currentTick,
      entityCount: this.entityManager.count,
      selectedEntityId: this.selectedEntityId,
      queueStats: this.commandQueue.getStats(),
    };
  }

  /**
   * Create a player entity (convenience method)
   * @param x - Initial X position
   * @param y - Initial Y position
   * @param z - Initial Z position
   * @returns The created player entity
   */
  createPlayer(x: number, y: number, z: number = 0): Entity {
    const player = this.entityManager.createEntity("player", {
      gridPos: { xgrid: x, ygrid: y, zheight: z },
      speed: this.config.movementSpeed,
    });

    // Auto-select the player
    this.selectedEntityId = player.id;

    if (this.config.debug) {
      console.log(`[Simulation] Created player entity: ${player.id} at (${x}, ${y}, ${z})`);
    }

    return player;
  }
}
