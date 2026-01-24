/**
 * PredictedInputBuffer - Command history for client-side prediction and reconciliation
 *
 * Stores client input commands that have been predicted but not yet confirmed
 * by the server. Used for:
 * - Storing pending commands for reconciliation
 * - Re-simulating commands after server correction
 * - Tracking command history for debugging
 *
 * Commands are stored in tick-ordered sequences for efficient range queries.
 */

import type { Command } from "../input/command-types";

/**
 * Configuration for the predicted input buffer
 */
export interface PredictedBufferConfig {
  maxHistoryTicks: number;  // Maximum ticks of history to keep
  maxCommandsPerTick: number; // Max commands to store per tick
}

/**
 * Default configuration
 */
const DEFAULT_CONFIG: PredictedBufferConfig = {
  maxHistoryTicks: 60,      // ~3 seconds at 20 ticks/sec
  maxCommandsPerTick: 100,
};

/**
 * Entry for a single command in the buffer
 */
export interface InputBufferEntry {
  tick: number;
  command: Command;
  timestamp: number;
  processed: boolean;
}

/**
 * PredictedInputBuffer - Stores and manages predicted input commands
 */
export class PredictedInputBuffer {
  private buffer: Map<number, InputBufferEntry[]>; // tick -> commands
  private config: PredictedBufferConfig;
  private oldestTick: number = -1;
  private newestTick: number = -1;
  private totalCommands: number = 0;

  constructor(config: Partial<PredictedBufferConfig> = {}) {
    this.config = { ...DEFAULT_CONFIG, ...config };
    this.buffer = new Map();
  }

  /**
   * Add a command to the buffer
   */
  addCommand(tick: number, command: Command): void {
    let commands = this.buffer.get(tick);
    if (!commands) {
      commands = [];
      this.buffer.set(tick, commands);
    }

    // Check command limit per tick
    if (commands.length >= this.config.maxCommandsPerTick) {
      console.warn(`Max commands per tick reached for tick ${tick}, ignoring command`);
      return;
    }

    const entry: InputBufferEntry = {
      tick,
      command,
      timestamp: Date.now(),
      processed: false,
    };

    commands.push(entry);
    this.totalCommands++;

    // Update tick tracking
    if (this.oldestTick === -1 || tick < this.oldestTick) {
      this.oldestTick = tick;
    }
    if (this.newestTick === -1 || tick > this.newestTick) {
      this.newestTick = tick;
    }
  }

  /**
   * Add multiple commands for a tick
   */
  addCommands(tick: number, commands: Command[]): void {
    for (const command of commands) {
      this.addCommand(tick, command);
    }
  }

  /**
   * Get all commands for a specific tick
   */
  getCommands(tick: number): InputBufferEntry[] {
    return this.buffer.get(tick) || [];
  }

  /**
   * Get all commands within a tick range [startTick, endTick] (inclusive)
   */
  getCommandsInRange(startTick: number, endTick: number): Command[] {
    const result: Command[] = [];

    for (let tick = startTick; tick <= endTick; tick++) {
      const entries = this.buffer.get(tick);
      if (entries) {
        for (const entry of entries) {
          result.push(entry.command);
        }
      }
    }

    return result;
  }

  /**
   * Get all unprocessed commands within a tick range
   */
  getUnprocessedCommands(startTick: number, endTick: number): Command[] {
    const result: Command[] = [];

    for (let tick = startTick; tick <= endTick; tick++) {
      const entries = this.buffer.get(tick);
      if (entries) {
        for (const entry of entries) {
          if (!entry.processed) {
            result.push(entry.command);
          }
        }
      }
    }

    return result;
  }

  /**
   * Mark all commands for a tick as processed
   */
  markProcessed(tick: number): void {
    const entries = this.buffer.get(tick);
    if (entries) {
      for (const entry of entries) {
        entry.processed = true;
      }
    }
  }

  /**
   * Mark commands in a range as processed
   */
  markRangeProcessed(startTick: number, endTick: number): void {
    for (let tick = startTick; tick <= endTick; tick++) {
      this.markProcessed(tick);
    }
  }

  /**
   * Remove all commands up to (and including) a tick
   */
  removeUpTo(tick: number): number {
    let removed = 0;

    for (let t = this.oldestTick; t <= tick; t++) {
      const entries = this.buffer.get(t);
      if (entries) {
        removed += entries.length;
        this.buffer.delete(t);
      }
    }

    // Update total command count
    this.totalCommands -= removed;

    // Update oldest tick
    this.recalculateOldestTick();

    return removed;
  }

  /**
   * Remove all commands after (and including) a tick
   */
  removeFrom(tick: number): number {
    let removed = 0;

    for (let t = tick; t <= this.newestTick; t++) {
      const entries = this.buffer.get(t);
      if (entries) {
        removed += entries.length;
        this.buffer.delete(t);
      }
    }

    // Update total command count
    this.totalCommands -= removed;

    // Update newest tick
    this.recalculateNewestTick();

    return removed;
  }

  /**
   * Remove all commands for a specific tick
   */
  removeTick(tick: number): number {
    const entries = this.buffer.get(tick);
    if (!entries) {
      return 0;
    }

    const count = entries.length;
    this.buffer.delete(tick);

    // Update total command count
    this.totalCommands -= count;

    // Recalculate bounds
    this.recalculateOldestTick();
    this.recalculateNewestTick();

    return count;
  }

  /**
   * Clear all commands
   */
  clear(): void {
    this.buffer.clear();
    this.oldestTick = -1;
    this.newestTick = -1;
    this.totalCommands = 0;
  }

  /**
   * Check if buffer has commands for a tick
   */
  hasTick(tick: number): boolean {
    return this.buffer.has(tick);
  }

  /**
   * Get the oldest tick with commands
   */
  getOldestTick(): number {
    return this.oldestTick;
  }

  /**
   * Get the newest tick with commands
   */
  getNewestTick(): number {
    return this.newestTick;
  }

  /**
   * Get the total number of commands in the buffer
   */
  getTotalCommands(): number {
    return this.totalCommands;
  }

  /**
   * Get the number of ticks with commands
   */
  getTickCount(): number {
    return this.buffer.size;
  }

  /**
   * Get all ticks that have commands
   */
  getTicks(): number[] {
    return Array.from(this.buffer.keys()).sort((a, b) => a - b);
  }

  /**
   * Get buffer statistics
   */
  getStats(): {
    oldestTick: number;
    newestTick: number;
    tickCount: number;
    totalCommands: number;
    unprocessedCommands: number;
  } {
    let unprocessed = 0;

    for (const entries of this.buffer.values()) {
      for (const entry of entries) {
        if (!entry.processed) {
          unprocessed++;
        }
      }
    }

    return {
      oldestTick: this.oldestTick,
      newestTick: this.newestTick,
      tickCount: this.buffer.size,
      totalCommands: this.totalCommands,
      unprocessedCommands: unprocessed,
    };
  }

  /**
   * Clean up old commands beyond max history
   */
  cleanup(currentTick: number): number {
    const cutoffTick = currentTick - this.config.maxHistoryTicks;
    return this.removeUpTo(cutoffTick);
  }

  /**
   * Recalculate oldest tick from buffer contents
   */
  private recalculateOldestTick(): void {
    const ticks = this.getTicks();
    this.oldestTick = ticks.length > 0 ? ticks[0] : -1;
  }

  /**
   * Recalculate newest tick from buffer contents
   */
  private recalculateNewestTick(): void {
    const ticks = this.getTicks();
    this.newestTick = ticks.length > 0 ? ticks[ticks.length - 1] : -1;
  }

  /**
   * For debugging: get all commands as a flat array
   */
  debugGetAllCommands(): InputBufferEntry[] {
    const result: InputBufferEntry[] = [];

    for (const entries of this.buffer.values()) {
      result.push(...entries);
    }

    return result.sort((a, b) => a.tick - b.tick);
  }

  /**
   * For debugging: validate internal state
   */
  debugValidate(): boolean {
    // Check that oldest and newest ticks are consistent
    const ticks = this.getTicks();
    if (ticks.length === 0) {
      return this.oldestTick === -1 && this.newestTick === -1;
    }

    if (this.oldestTick !== ticks[0] || this.newestTick !== ticks[ticks.length - 1]) {
      return false;
    }

    // Check total command count
    let actualTotal = 0;
    for (const entries of this.buffer.values()) {
      actualTotal += entries.length;
    }

    if (actualTotal !== this.totalCommands) {
      return false;
    }

    return true;
  }

  /**
   * Export buffer state for debugging/recording
   */
  export(): { buffer: Map<number, Command[]>, oldestTick: number, newestTick: number } {
    const exportedBuffer = new Map<number, Command[]>();

    for (const [tick, entries] of this.buffer.entries()) {
      exportedBuffer.set(tick, entries.map(e => e.command));
    }

    return {
      buffer: exportedBuffer,
      oldestTick: this.oldestTick,
      newestTick: this.newestTick,
    };
  }

  /**
   * Import buffer state for debugging/replay
   */
  import(data: { buffer: Map<number, Command[]>, oldestTick: number, newestTick: number }): void {
    this.clear();

    for (const [tick, commands] of data.buffer.entries()) {
      for (const command of commands) {
        this.addCommand(tick, command);
      }
    }

    // Override tick tracking
    this.oldestTick = data.oldestTick;
    this.newestTick = data.newestTick;
  }
}
