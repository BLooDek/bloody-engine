/**
 * Command Types - Abstract action types for the input system
 * These represent normalized, platform-independent actions
 */

/**
 * Direction type for movement commands
 */
export type Direction = "N" | "S" | "E" | "W" | "NE" | "NW" | "SE" | "SW";

/**
 * All available command types
 */
export enum CommandType {
  MOVE_NORTH = "MOVE_NORTH",
  MOVE_SOUTH = "MOVE_SOUTH",
  MOVE_EAST = "MOVE_EAST",
  MOVE_WEST = "MOVE_WEST",
  MOVE = "MOVE",
  ATTACK = "ATTACK",
  SELECT = "SELECT",
  INTERACT = "INTERACT",
}

/**
 * Base command interface
 * All commands include a tick number for synchronization
 */
export interface BaseCommand {
  tick: number;
}

/**
 * Movement command with direction
 */
export interface MoveCommand extends BaseCommand {
  type: CommandType.MOVE | CommandType.MOVE_NORTH | CommandType.MOVE_SOUTH | CommandType.MOVE_EAST | CommandType.MOVE_WEST;
  direction?: Direction;
}

/**
 * Attack command
 */
export interface AttackCommand extends BaseCommand {
  type: CommandType.ATTACK;
  targetId?: string;
}

/**
 * Select command
 */
export interface SelectCommand extends BaseCommand {
  type: CommandType.SELECT;
  targetId?: string;
}

/**
 * Interact command
 */
export interface InteractCommand extends BaseCommand {
  type: CommandType.INTERACT;
  targetId?: string;
}

/**
 * Union type of all possible commands
 */
export type Command = MoveCommand | AttackCommand | SelectCommand | InteractCommand;

/**
 * Input event from any source before normalization
 */
export interface RawInputEvent {
  source: "keyboard" | "mouse" | "network" | "gamepad";
  data: unknown;
}

/**
 * Normalized command ready for the command queue
 */
export interface NormalizedCommand {
  command: Command;
  timestamp: number;
}
