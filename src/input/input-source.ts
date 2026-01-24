import { Command, NormalizedCommand } from "./command-types";
import { CommandQueue } from "./command-queue";

/**
 * Abstract base class for all input sources
 * Input sources normalize raw events into abstract commands
 */
export abstract class InputSource {
  protected commandQueue: CommandQueue;
  protected enabled: boolean = true;

  constructor(commandQueue: CommandQueue) {
    this.commandQueue = commandQueue;
  }

  /**
   * Start listening for input events
   */
  abstract start(): void;

  /**
   * Stop listening for input events
   */
  abstract stop(): void;

  /**
   * Process a raw input event and normalize it into a command
   * @param event The raw input event
   * @returns A normalized command, or undefined if the event should be ignored
   */
  abstract processEvent(event: unknown): Command | undefined;

  /**
   * Add a command to the queue
   * @param command The command to add
   */
  protected enqueueCommand(command: Command): void {
    if (this.enabled) {
      this.commandQueue.enqueue(command);
    }
  }

  /**
   * Enable this input source
   */
  enable(): void {
    this.enabled = true;
  }

  /**
   * Disable this input source (commands will not be enqueued)
   */
  disable(): void {
    this.enabled = false;
  }

  /**
   * Check if this input source is enabled
   */
  isEnabled(): boolean {
    return this.enabled;
  }

  /**
   * Cleanup resources
   */
  abstract cleanup(): void;
}

/**
 * Factory function for creating input sources
 */
export interface InputSourceFactory {
  create(commandQueue: CommandQueue): InputSource;
}
