import { Command, NormalizedCommand } from "./command-types";

/**
 * CommandQueue - Thread-safe queue for storing and processing game commands
 * Commands are stored with tick numbers for deterministic replay and synchronization
 */
export class CommandQueue {
  private queue: NormalizedCommand[] = [];
  private currentTick: number = 0;

  /**
   * Add a command to the queue
   * @param command The command to add
   */
  enqueue(command: Command): void {
    const normalized: NormalizedCommand = {
      command,
      timestamp: Date.now(),
    };

    // Insert in sorted order by tick for deterministic processing
    let insertIndex = this.queue.length;
    for (let i = this.queue.length - 1; i >= 0; i--) {
      if (this.queue[i].command.tick <= command.tick) {
        insertIndex = i + 1;
        break;
      }
    }

    this.queue.splice(insertIndex, 0, normalized);
  }

  /**
   * Remove and return the next command from the queue
   * @returns The next command, or undefined if queue is empty
   */
  dequeue(): Command | undefined {
    if (this.queue.length === 0) {
      return undefined;
    }

    const normalized = this.queue.shift()!;
    return normalized.command;
  }

  /**
   * Peek at the next command without removing it
   * @returns The next command, or undefined if queue is empty
   */
  peek(): Command | undefined {
    if (this.queue.length === 0) {
      return undefined;
    }

    return this.queue[0].command;
  }

  /**
   * Get all commands for a specific tick
   * @param tick The tick number to get commands for
   * @returns Array of commands for the specified tick
   */
  getCommandsForTick(tick: number): Command[] {
    return this.queue
      .filter((normalized) => normalized.command.tick === tick)
      .map((normalized) => normalized.command);
  }

  /**
   * Get all commands up to (and including) a specific tick
   * Useful for catching up or replaying
   * @param tick The tick number
   * @returns Array of commands up to the specified tick
   */
  getCommandsUpToTick(tick: number): Command[] {
    const result: Command[] = [];
    const remaining: NormalizedCommand[] = [];

    for (const normalized of this.queue) {
      if (normalized.command.tick <= tick) {
        result.push(normalized.command);
      } else {
        remaining.push(normalized);
      }
    }

    // Update queue to only contain remaining commands
    this.queue = remaining;

    return result;
  }

  /**
   * Remove all commands up to (and including) a specific tick
   * @param tick The tick number
   * @returns Number of commands removed
   */
  removeUpToTick(tick: number): number {
    const originalLength = this.queue.length;
    this.queue = this.queue.filter((normalized) => normalized.command.tick > tick);
    return originalLength - this.queue.length;
  }

  /**
   * Check if the queue is empty
   */
  isEmpty(): boolean {
    return this.queue.length === 0;
  }

  /**
   * Get the number of commands in the queue
   */
  size(): number {
    return this.queue.length;
  }

  /**
   * Clear all commands from the queue
   */
  clear(): void {
    this.queue = [];
  }

  /**
   * Get the current tick number
   */
  getCurrentTick(): number {
    return this.currentTick;
  }

  /**
   * Set the current tick number
   * @param tick The new tick number
   */
  setCurrentTick(tick: number): void {
    this.currentTick = tick;
  }

  /**
   * Increment the current tick number
   */
  incrementTick(): void {
    this.currentTick++;
  }

  /**
   * Get all commands in the queue (for debugging/serialization)
   * @returns Copy of the internal command array
   */
  getAllCommands(): Command[] {
    return this.queue.map((normalized) => normalized.command);
  }

  /**
   * Get statistics about the queue
   */
  getStats(): {
    size: number;
    currentTick: number;
    oldestTick: number | undefined;
    newestTick: number | undefined;
  } {
    if (this.queue.length === 0) {
      return {
        size: 0,
        currentTick: this.currentTick,
        oldestTick: undefined,
        newestTick: undefined,
      };
    }

    const oldestTick = this.queue[0].command.tick;
    const newestTick = this.queue[this.queue.length - 1].command.tick;

    return {
      size: this.queue.length,
      currentTick: this.currentTick,
      oldestTick,
      newestTick,
    };
  }
}
