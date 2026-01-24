import { InputSource } from "./input-source";
import { Command, CommandType, Direction } from "./command-types";
import { CommandQueue } from "./command-queue";

/**
 * Network command structure (serialized format)
 * This is the format expected from WebSocket messages
 */
export interface NetworkCommand {
  type: string;
  tick: number;
  direction?: string;
  targetId?: string;
}

/**
 * WebSocket-like interface for network connections
 */
export interface WebSocketLike {
  on(event: "message" | "open" | "close" | "error", callback: (...args: any[]) => void): void;
  off(event: "message" | "open" | "close" | "error", callback: (...args: any[]) => void): void;
  send(data: string | Buffer): void;
  close(): void;
  readyState?: number;
}

/**
 * Network input source options
 */
export interface NetworkInputSourceOptions {
  /**
   * WebSocket connection
   */
  socket: WebSocketLike;

  /**
   * Player/client ID for this input source
   */
  playerId?: string;

  /**
   * Maximum allowed tick difference for command validation
   * Commands too far in the past or future will be rejected
   */
  maxTickDifference?: number;

  /**
   * Validate incoming commands (optional)
   */
  validateCommand?: (command: Command, playerId?: string) => boolean;
}

/**
 * NetworkInputSource - Input source for network-based commands
 * Deserializes WebSocket messages into abstract commands
 */
export class NetworkInputSource extends InputSource {
  private socket: WebSocketLike;
  private playerId?: string;
  private maxTickDifference: number;
  private validateCommand?: (command: Command, playerId?: string) => boolean;
  private messageHandler?: (data: any) => void;
  private isListening: boolean = false;

  constructor(
    commandQueue: CommandQueue,
    options: NetworkInputSourceOptions
  ) {
    super(commandQueue);
    this.socket = options.socket;
    this.playerId = options.playerId;
    this.maxTickDifference = options.maxTickDifference ?? 100; // Default 100 ticks tolerance
    this.validateCommand = options.validateCommand;
  }

  /**
   * Start listening for network messages
   */
  start(): void {
    if (this.isListening) {
      return;
    }

    this.messageHandler = (data: any) => {
      try {
        const command = this.deserializeCommand(data);
        if (command) {
          this.enqueueCommand(command);
        }
      } catch (error) {
        console.error("Failed to deserialize network command:", error);
      }
    };

    this.socket.on("message", this.messageHandler);
    this.isListening = true;
    console.log(`Network Input Source started (player: ${this.playerId || "unknown"})`);
  }

  /**
   * Stop listening for network messages
   */
  stop(): void {
    if (!this.isListening || !this.messageHandler) {
      return;
    }

    this.socket.off("message", this.messageHandler);
    this.isListening = false;
    console.log(`Network Input Source stopped (player: ${this.playerId || "unknown"})`);
  }

  /**
   * Process a raw network message
   * @param event The raw message data
   * @returns A normalized command, or undefined if deserialization fails
   */
  processEvent(event: unknown): Command | undefined {
    return this.deserializeCommand(event);
  }

  /**
   * Deserialize a network command
   * @param data The raw network message data
   * @returns A normalized command, or undefined if invalid
   */
  private deserializeCommand(data: unknown): Command | undefined {
    if (!data || typeof data !== "object") {
      return undefined;
    }

    // Handle Buffer/Uint8Array
    let parsed: NetworkCommand;
    if (data instanceof Buffer || data instanceof Uint8Array) {
      try {
        parsed = JSON.parse(data.toString());
      } catch {
        return undefined;
      }
    } else if (typeof data === "string") {
      try {
        parsed = JSON.parse(data);
      } catch {
        return undefined;
      }
    } else {
      parsed = data as NetworkCommand;
    }

    // Validate required fields
    if (!parsed.type || typeof parsed.tick !== "number") {
      return undefined;
    }

    // Validate tick bounds
    const currentTick = this.commandQueue.getCurrentTick();
    const tickDifference = Math.abs(parsed.tick - currentTick);
    if (tickDifference > this.maxTickDifference) {
      console.warn(
        `Rejected command with tick ${parsed.tick} (current: ${currentTick}, difference: ${tickDifference})`
      );
      return undefined;
    }

    // Build command based on type
    const commandType = this.parseCommandType(parsed.type);
    if (!commandType) {
      return undefined;
    }

    const command: Command = {
      type: commandType,
      tick: parsed.tick,
    } as Command;

    // Add optional fields
    if (parsed.direction) {
      (command as any).direction = this.parseDirection(parsed.direction);
    }
    if (parsed.targetId) {
      (command as any).targetId = parsed.targetId;
    }

    // Run custom validation if provided
    if (this.validateCommand && !this.validateCommand(command, this.playerId)) {
      return undefined;
    }

    return command;
  }

  /**
   * Parse a string command type to CommandType enum
   */
  private parseCommandType(type: string): CommandType | undefined {
    const upperType = type.toUpperCase();
    if (Object.values(CommandType).includes(upperType as CommandType)) {
      return upperType as CommandType;
    }
    return undefined;
  }

  /**
   * Parse a string direction to Direction type
   */
  private parseDirection(dir: string): Direction | undefined {
    const upperDir = dir.toUpperCase();
    const validDirections: Direction[] = ["N", "S", "E", "W", "NE", "NW", "SE", "SW"];
    if (validDirections.includes(upperDir as Direction)) {
      return upperDir as Direction;
    }
    return undefined;
  }

  /**
   * Send a command through the network
   * @param command The command to send
   */
  sendCommand(command: Command): void {
    const networkCmd: NetworkCommand = {
      type: command.type,
      tick: command.tick,
    };

    if ("direction" in command && command.direction) {
      networkCmd.direction = command.direction;
    }
    if ("targetId" in command && command.targetId) {
      networkCmd.targetId = command.targetId;
    }

    const serialized = JSON.stringify(networkCmd);
    this.socket.send(serialized);
  }

  /**
   * Get the player/client ID
   */
  getPlayerId(): string | undefined {
    return this.playerId;
  }

  /**
   * Set the player/client ID
   */
  setPlayerId(playerId: string): void {
    this.playerId = playerId;
  }

  /**
   * Check if the network connection is active
   */
  isConnected(): boolean {
    // WebSocket readyState: CONNECTING=0, OPEN=1, CLOSING=2, CLOSED=3
    return this.socket.readyState === 1;
  }

  /**
   * Cleanup resources
   */
  cleanup(): void {
    this.stop();
    console.log(`Network Input Source cleaned up (player: ${this.playerId || "unknown"})`);
  }
}

/**
 * Helper function to create a NetworkInputSource
 */
export function createNetworkInputSource(
  commandQueue: CommandQueue,
  socket: WebSocketLike,
  options?: Omit<NetworkInputSourceOptions, "socket">
): NetworkInputSource {
  return new NetworkInputSource(commandQueue, {
    socket,
    ...options,
  });
}
