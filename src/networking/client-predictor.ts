/**
 * ClientPredictor - Client-side prediction for immediate input response
 *
 * Implements client-side prediction to mask network latency:
 * 1. Client processes input immediately (prediction)
 * 2. Input is sent to server
 * 3. Server processes input and sends back authoritative state
 * 4. Client reconciles predicted state with server state
 *
 * This creates a responsive experience despite network latency.
 */

import { InputSource } from "../input/input-source";
import { CommandQueue } from "../input/command-queue";
import type { Command } from "../input/command-types";
import type { PredictionOptions } from "./network-types";
import { PredictedInputBuffer } from "./predicted-input-buffer";
import type { WebSocketLike } from "../input/network-input-source";
import type { NetworkMessage, ClientInputMessage } from "./network-types";
import { NetworkMessageType } from "./network-types";

/**
 * Default prediction options
 */
const DEFAULT_OPTIONS: PredictionOptions = {
  localPlayerId: "player",
  maxPredictionTicks: 30,  // ~1.5 seconds at 20 ticks/sec
  enableSmoothing: true,
};

/**
 * ClientPredictor - Input source that predicts local entity state
 */
export class ClientPredictor extends InputSource {
  private localPlayerId: string;
  private maxPredictionTicks: number;
  private enableSmoothing: boolean;
  private socket: WebSocketLike;
  private predictionEnabled: boolean;
  private pendingBuffer: PredictedInputBuffer;
  private lastServerTick: number = -1;
  private clientTick: number = 0;

  // Optional: Snapshot manager for rollback (used with reconciliation)
  private snapshotManager?: import("./snapshot-manager").SnapshotManager;

  constructor(
    commandQueue: CommandQueue,
    socket: WebSocketLike,
    options: Partial<PredictionOptions> = {}
  ) {
    super(commandQueue);

    this.socket = socket;
    this.localPlayerId = options.localPlayerId ?? DEFAULT_OPTIONS.localPlayerId;
    this.maxPredictionTicks = options.maxPredictionTicks ?? DEFAULT_OPTIONS.maxPredictionTicks;
    this.enableSmoothing = options.enableSmoothing ?? DEFAULT_OPTIONS.enableSmoothing;
    this.predictionEnabled = true;

    this.pendingBuffer = new PredictedInputBuffer({
      maxHistoryTicks: this.maxPredictionTicks * 2,
      maxCommandsPerTick: 100,
    });
  }

  /**
   * Start the predictor (listens for network messages)
   */
  start(): void {
    this.socket.on("message", this.handleNetworkMessage.bind(this));
    console.log(`[ClientPredictor] Started (player: ${this.localPlayerId})`);
  }

  /**
   * Stop the predictor
   */
  stop(): void {
    this.socket.off("message", this.handleNetworkMessage.bind(this));
    console.log(`[ClientPredictor] Stopped (player: ${this.localPlayerId})`);
  }

  /**
   * Process a local input event (from keyboard, mouse, etc.)
   * This is the main entry point for prediction
   */
  processEvent(event: unknown): Command | undefined {
    if (!this.predictionEnabled) {
      return undefined;
    }

    // Convert event to command
    const command = this.eventToCommand(event);
    if (!command) {
      return undefined;
    }

    // Set the tick for this command
    command.tick = this.clientTick;

    // Process the input with prediction
    this.processInput(command);

    return command;
  }

  /**
   * Process an input command with prediction
   * 1. Send to server
   * 2. Execute locally (predict)
   * 3. Store in pending buffer for reconciliation
   */
  processInput(command: Command): void {
    if (!this.predictionEnabled) {
      return;
    }

    // 1. Send command to server immediately
    this.sendToServer(command);

    // 2. Execute locally (prediction)
    this.enqueueCommand(command);

    // 3. Store in pending buffer for reconciliation
    this.pendingBuffer.addCommand(command.tick, command);

    // 4. Advance client tick
    this.clientTick++;
  }

  /**
   * Send a command to the server
   */
  private sendToServer(command: Command): void {
    const message: ClientInputMessage = {
      type: NetworkMessageType.INPUT,
      timestamp: Date.now(),
      playerId: this.localPlayerId,
      tick: command.tick,
      command,
    };

    try {
      const serialized = JSON.stringify(message);
      this.socket.send(serialized);
    } catch (error) {
      console.error("[ClientPredictor] Failed to send command to server:", error);
    }
  }

  /**
   * Handle a network message from the server
   */
  private handleNetworkMessage(data: unknown): void {
    try {
      let message: NetworkMessage;

      // Parse message
      if (data instanceof Buffer || data instanceof Uint8Array) {
        message = JSON.parse(data.toString());
      } else if (typeof data === "string") {
        message = JSON.parse(data);
      } else {
        message = data as NetworkMessage;
      }

      // Handle different message types
      switch (message.type) {
        case NetworkMessageType.STATE_UPDATE:
          this.handleStateUpdate(message as any);
          break;

        case NetworkMessageType.STATE_DELTA:
          this.handleStateDelta(message as any);
          break;

        case NetworkMessageType.CORRECTION:
          this.handleCorrection(message as any);
          break;

        case NetworkMessageType.TICK_SYNC:
          this.handleTickSync(message as any);
          break;

        default:
          // Ignore other message types
          break;
      }
    } catch (error) {
      console.error("[ClientPredictor] Failed to handle network message:", error);
    }
  }

  /**
   * Handle a full state update from server
   */
  private handleStateUpdate(update: any): void {
    this.lastServerTick = update.serverTick;

    // The state update will be handled by the server reconciler
    // For now, just acknowledge it
    if (this.lastServerTick > this.clientTick - this.maxPredictionTicks) {
      // Server is ahead, we might need to catch up
      this.clientTick = Math.max(this.clientTick, update.lastProcessedTick + 1);
    }

    // Clean up old pending commands
    this.pendingBuffer.cleanup(this.clientTick);
  }

  /**
   * Handle a delta state update from server
   */
  private handleStateDelta(delta: any): void {
    // Delta updates are more efficient than full updates
    this.lastServerTick = delta.serverTick;
  }

  /**
   * Handle a state correction from server
   * This means our prediction was wrong
   */
  private handleCorrection(correction: any): void {
    console.log(`[ClientPredictor] Received correction for tick ${correction.tick}`);

    // The actual reconciliation will be handled by ServerReconciler
    // Clean up acknowledged commands
    this.pendingBuffer.removeUpTo(correction.tick);
  }

  /**
   * Handle tick synchronization from server
   */
  private handleTickSync(sync: any): void {
    this.lastServerTick = sync.serverTick;

    // Calculate round-trip time if client tick was echoed
    if (sync.clientTick !== undefined) {
      // RTT can be calculated by comparing timestamps
    }
  }

  /**
   * Convert an input event to a command
   * This should be overridden or extended based on input types
   */
  private eventToCommand(event: unknown): Command | undefined {
    // Default implementation - subclasses can override
    if (typeof event === "object" && event !== null) {
      const e = event as Record<string, unknown>;
      if (e.type && e.tick !== undefined) {
        return e as unknown as Command;
      }
    }
    return undefined;
  }

  /**
   * Get the predicted input buffer
   */
  getPendingBuffer(): PredictedInputBuffer {
    return this.pendingBuffer;
  }

  /**
   * Enable or disable prediction
   */
  setPredictionEnabled(enabled: boolean): void {
    this.predictionEnabled = enabled;
    console.log(`[ClientPredictor] Prediction ${enabled ? "enabled" : "disabled"}`);
  }

  /**
   * Check if prediction is enabled
   */
  isPredictionEnabled(): boolean {
    return this.predictionEnabled;
  }

  /**
   * Get the current client tick
   */
  getClientTick(): number {
    return this.clientTick;
  }

  /**
   * Set the current client tick (for synchronization)
   */
  setClientTick(tick: number): void {
    this.clientTick = tick;
  }

  /**
   * Get the last server tick received
   */
  getLastServerTick(): number {
    return this.lastServerTick;
  }

  /**
   * Get the local player ID
   */
  getLocalPlayerId(): string {
    return this.localPlayerId;
  }

  /**
   * Set the snapshot manager (for reconciliation)
   */
  setSnapshotManager(snapshotManager: import("./snapshot-manager").SnapshotManager): void {
    this.snapshotManager = snapshotManager;
  }

  /**
   * Get prediction statistics
   */
  getStats(): {
    clientTick: number;
    lastServerTick: number;
    tickDifference: number;
    pendingCommands: number;
    predictionEnabled: boolean;
  } {
    const bufferStats = this.pendingBuffer.getStats();

    return {
      clientTick: this.clientTick,
      lastServerTick: this.lastServerTick,
      tickDifference: this.clientTick - this.lastServerTick,
      pendingCommands: bufferStats.totalCommands,
      predictionEnabled: this.predictionEnabled,
    };
  }

  /**
   * Cleanup resources
   */
  cleanup(): void {
    this.stop();
    this.pendingBuffer.clear();
    console.log(`[ClientPredictor] Cleaned up (player: ${this.localPlayerId})`);
  }
}

/**
 * Factory function to create a client predictor
 */
export function createClientPredictor(
  commandQueue: CommandQueue,
  socket: WebSocketLike,
  options?: Partial<PredictionOptions>
): ClientPredictor {
  return new ClientPredictor(commandQueue, socket, options);
}
