/**
 * Networking Module - State synchronization for multiplayer
 *
 * This module provides:
 * - Binary serialization for efficient network transmission
 * - Client-side prediction for responsive input
 * - Server reconciliation for authoritative state
 * - State snapshots for rollback and re-simulation
 *
 * Example usage:
 * ```typescript
 * import {
 *   BinarySerializer,
 *   EntitySerializer,
 *   SnapshotManager,
 *   ClientPredictor,
 *   ServerReconciler
 * } from "bloody-engine/networking";
 * ```
 */

// Binary serialization
export {
  BinarySerializer,
  BinaryReader,
  BinaryUtils,
} from "./binary-serializer";

// Entity serialization
export {
  EntitySerializer,
  SerializedEntity,
  SerializableEntityState,
  EntitySerializationFlags,
} from "./entity-serializer";

// State snapshots
export {
  StateSnapshot,
} from "./state-snapshot";

// Snapshot manager
export {
  SnapshotManager,
} from "./snapshot-manager";

// Predicted input buffer
export {
  PredictedInputBuffer,
  InputBufferEntry,
} from "./predicted-input-buffer";

// Client predictor
export {
  ClientPredictor,
  createClientPredictor,
} from "./client-predictor";

// Server reconciler
export {
  ServerReconciler,
  createServerReconciler,
  ReconciliationResult,
} from "./server-reconciler";

// Network types
export {
  NetworkMessageType,
  NetworkMessage,
  ClientInputMessage,
  ServerStateUpdateMessage,
  StateDeltaMessage,
  EntityDelta,
  WorldSnapshotMessage,
  TickSyncMessage,
  StateCorrectionMessage,
  ConnectionRequestMessage,
  ConnectionResponseMessage,
  PingMessage,
  PongMessage,
  EntityStateSnapshot,
  PredictionState,
  StateCorrection,
  NetworkStats,
  ClientNetworkConfig,
  ServerNetworkConfig,
  PredictionOptions,
  ReconciliationOptions,
  SnapshotConfig,
  ServerUpdate,
  AllNetworkMessages,
  isNetworkMessage,
  isServerStateUpdate,
  isClientInput,
  isStateCorrection,
  isTickSync,
} from "./network-types";

// Re-export commonly used types for convenience
export type {
  Command,
  CommandType,
  Direction,
} from "../input/command-types";

export type {
  Entity,
  EntityState,
} from "../simulation/entity";

export type {
  EntityManager,
} from "../simulation/entity-manager";
