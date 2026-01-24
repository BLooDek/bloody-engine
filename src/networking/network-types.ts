/**
 * Network Types - Shared networking types and interfaces
 *
 * Contains all common types used for client-server communication,
 * state synchronization, prediction, and reconciliation.
 */

import type { EntityState } from "../simulation/entity";
import type { Command } from "../input/command-types";

/**
 * Message types for network communication
 */
export const enum NetworkMessageType {
  // Client -> Server
  INPUT = "INPUT",                    // Client input command
  CONNECTION_REQUEST = "CONNECTION_REQUEST",
  DISCONNECT = "DISCONNECT",

  // Server -> Client
  STATE_UPDATE = "STATE_UPDATE",      // Authoritative state from server
  STATE_DELTA = "STATE_DELTA",        // Delta update (only changes)
  SNAPSHOT = "SNAPSHOT",              // Full world snapshot
  TICK_SYNC = "TICK_SYNC",            // Server tick synchronization
  CORRECTION = "CORRECTION",          // State correction for reconciliation
  ERROR = "ERROR",                    // Error message

  // Bidirectional
  PING = "PING",
  PONG = "PONG",
}

/**
 * Network message envelope
 * All messages are wrapped in this envelope for routing
 */
export interface NetworkMessage {
  type: NetworkMessageType;
  timestamp: number;     // When message was sent
}

/**
 * Client input message (Client -> Server)
 * Contains a player's input command for a specific tick
 */
export interface ClientInputMessage extends NetworkMessage {
  type: NetworkMessageType.INPUT;
  playerId: string;
  tick: number;          // Client tick this input is for
  command: Command;      // The input command
  sequenceNumber?: number; // For ordering and reliability
}

/**
 * Server state update message (Server -> Client)
 * Contains authoritative state for entities
 */
export interface ServerStateUpdateMessage extends NetworkMessage {
  type: NetworkMessageType.STATE_UPDATE;
  serverTick: number;    // Server tick this state represents
  lastProcessedTick: number; // Last input tick processed by server
  entities: Uint8Array;  // Binary serialized entities
}

/**
 * State delta update (Server -> Client)
 * Contains only changes from previous state (more efficient)
 */
export interface StateDeltaMessage extends NetworkMessage {
  type: NetworkMessageType.STATE_DELTA;
  serverTick: number;
  fromTick: number;      // Base tick for delta
  entityDeltas: EntityDelta[];
}

/**
 * Individual entity delta for state updates
 */
export interface EntityDelta {
  entityId: string;
  changes: EntityState;
  removed: boolean;      // True if entity was removed
}

/**
 * World snapshot message (Server -> Client)
 * Complete world state at a specific tick
 */
export interface WorldSnapshotMessage extends NetworkMessage {
  type: NetworkMessageType.SNAPSHOT;
  tick: number;
  entities: Uint8Array;  // Binary serialized entities
  entityCount: number;
}

/**
 * Tick synchronization message (Server -> Client)
 * Used to synchronize client and server tick counters
 */
export interface TickSyncMessage extends NetworkMessage {
  type: NetworkMessageType.TICK_SYNC;
  serverTick: number;
  clientTick?: number;   // Echoed from client for RTT calculation
}

/**
 * State correction message (Server -> Client)
 * Sent when server detects prediction error
 */
export interface StateCorrectionMessage extends NetworkMessage {
  type: NetworkMessageType.CORRECTION;
  serverTick: number;    // The tick to correct from
  correctedState: Map<string, EntityState>; // Entity ID -> corrected state
}

/**
 * Connection request (Client -> Server)
 */
export interface ConnectionRequestMessage extends NetworkMessage {
  type: NetworkMessageType.CONNECTION_REQUEST;
  protocolVersion: number;
  clientTick: number;
  requestedPlayerId?: string;
}

/**
 * Connection response (Server -> Client)
 */
export interface ConnectionResponseMessage extends NetworkMessage {
  type: NetworkMessageType.CONNECTION_REQUEST; // Reuse type for response
  accepted: boolean;
  assignedPlayerId: string;
  serverTick: number;
  initialEntities?: Uint8Array;
  rejectReason?: string;
}

/**
 * Ping/Pong for latency measurement
 */
export interface PingMessage extends NetworkMessage {
  type: NetworkMessageType.PING;
  clientTick: number;
  serverTick?: number;
}

export interface PongMessage extends NetworkMessage {
  type: NetworkMessageType.PONG;
  originalPingTick: number;
  serverTick: number;
}

/**
 * Entity state snapshot for a specific tick
 * Used for rollback and re-simulation
 */
export interface EntityStateSnapshot {
  tick: number;
  entities: Map<string, EntityState>; // Entity ID -> state
  timestamp: number;     // When snapshot was created
}

/**
 * Client prediction state
 */
export interface PredictionState {
  enabled: boolean;
  pendingCommands: Map<number, Command[]>; // tick -> commands
  lastPredictedTick: number;
  lastServerTick: number;
}

/**
 * Reconciliation correction
 */
export interface StateCorrection {
  entityId: string;
  predictedState: EntityState;
  authoritativeState: EntityState;
  tick: number;
}

/**
 * Network statistics
 */
export interface NetworkStats {
  rtt: number;           // Round-trip time in ms
  jitter: number;        // RTT variance
  packetLoss: number;    // Packet loss percentage
  bandwidth: number;     // Bytes per second
  messagesSent: number;
  messagesReceived: number;
  bytesSent: number;
  bytesReceived: number;
}

/**
 * Client network configuration
 */
export interface ClientNetworkConfig {
  serverUrl: string;
  protocolVersion: number;
  reconnectDelay: number;
  maxReconnectAttempts: number;
  timeoutMs: number;
  enablePrediction: boolean;
  enableReconciliation: boolean;
  maxPredictionTicks: number;
  snapshotHistorySize: number;
}

/**
 * Server network configuration
 */
export interface ServerNetworkConfig {
  port: number;
  protocolVersion: number;
  maxClients: number;
  tickRate: number;      // Server ticks per second
  stateUpdateRate: number; // State updates per second
  enableSnapshotCompression: boolean;
  maxStateDeltas: number;
}

/**
 * Union type of all network messages
 */
export type AllNetworkMessages =
  | ClientInputMessage
  | ServerStateUpdateMessage
  | StateDeltaMessage
  | WorldSnapshotMessage
  | TickSyncMessage
  | StateCorrectionMessage
  | ConnectionRequestMessage
  | ConnectionResponseMessage
  | PingMessage
  | PongMessage;

/**
 * Client-side prediction options
 */
export interface PredictionOptions {
  localPlayerId: string;
  maxPredictionTicks: number;  // How many ticks ahead to predict
  enableSmoothing: boolean;     // Smooth visual corrections
}

/**
 * Server reconciliation options
 */
export interface ReconciliationOptions {
  enabled: boolean;
  maxReconciliationTicks: number; // Max ticks to roll back
  enableSnapCorrection: boolean;   // True = instant, False = smooth
  correctionThreshold: number;     // Position difference before correction
}

/**
 * Snapshot manager configuration
 */
export interface SnapshotConfig {
  maxSnapshots: number;           // Max snapshots to keep (default: 60)
  snapshotInterval: number;       // Ticks between snapshots (default: 1)
  compressionEnabled: boolean;    // Use delta compression
}

/**
 * Server state for reconciliation
 */
export interface ServerUpdate {
  tick: number;
  entities: EntityState[];
  lastProcessedInputTick: number;
}

/**
 * Circular queue configuration
 */
export interface CircularQueueConfig<T> {
  capacity: number;
  growthFactor?: number;
}

/**
 * Type guard for network messages
 */
export function isNetworkMessage(msg: unknown): msg is NetworkMessage {
  if (typeof msg !== "object" || msg === null) {
    return false;
  }
  const message = msg as Record<string, unknown>;
  return (
    typeof message.type === "string" &&
    typeof message.timestamp === "number"
  );
}

/**
 * Type guard for specific message types
 */
export function isServerStateUpdate(msg: NetworkMessage): msg is ServerStateUpdateMessage {
  return msg.type === NetworkMessageType.STATE_UPDATE;
}

export function isClientInput(msg: NetworkMessage): msg is ClientInputMessage {
  return msg.type === NetworkMessageType.INPUT;
}

export function isStateCorrection(msg: NetworkMessage): msg is StateCorrectionMessage {
  return msg.type === NetworkMessageType.CORRECTION;
}

export function isTickSync(msg: NetworkMessage): msg is TickSyncMessage {
  return msg.type === NetworkMessageType.TICK_SYNC;
}
