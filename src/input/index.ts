/**
 * Input System - Command Queue Pattern Implementation
 * Provides abstract input handling from multiple sources (SDL, Network, etc.)
 */

// Command types and interfaces
export {
  CommandType,
  type Direction,
  type BaseCommand,
  type MoveCommand,
  type AttackCommand,
  type SelectCommand,
  type InteractCommand,
  type Command,
  type RawInputEvent,
  type NormalizedCommand,
} from "./command-types";

// Command queue
export { CommandQueue } from "./command-queue";

// Abstract input source
export { InputSource, type InputSourceFactory } from "./input-source";

// SDL input source
export { SDLInputSource, createSDLInputSource, type KeyMapping, type SDLKeyboardEvent, type SDLMouseEvent } from "./sdl-input-source";

// Network input source
export {
  NetworkInputSource,
  createNetworkInputSource,
  type NetworkCommand,
  type WebSocketLike,
  type NetworkInputSourceOptions,
} from "./network-input-source";
