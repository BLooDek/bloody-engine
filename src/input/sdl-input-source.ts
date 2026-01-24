import sdl from "@kmamal/sdl";
import { InputSource } from "./input-source";
import { Command, CommandType, Direction } from "./command-types";
import { CommandQueue } from "./command-queue";

/**
 * SDL keyboard event structure
 */
export interface SDLKeyboardEvent {
  keyName: string;
  keyPressed: boolean;
  modifierShift?: boolean;
  modifierCtrl?: boolean;
  modifierAlt?: boolean;
}

/**
 * SDL mouse event structure
 */
export interface SDLMouseEvent {
  x: number;
  y: number;
  button: number;
  buttonPressed: boolean;
}

/**
 * Key mapping configuration
 * Maps keyboard keys to abstract commands
 */
export interface KeyMapping {
  [key: string]: {
    type: CommandType;
    direction?: Direction;
  };
}

/**
 * Default key mapping for WASD + action keys
 */
const DEFAULT_KEY_MAPPING: KeyMapping = {
  w: { type: CommandType.MOVE_NORTH, direction: "N" },
  arrowup: { type: CommandType.MOVE_NORTH, direction: "N" },
  s: { type: CommandType.MOVE_SOUTH, direction: "S" },
  arrowdown: { type: CommandType.MOVE_SOUTH, direction: "S" },
  a: { type: CommandType.MOVE_WEST, direction: "W" },
  arrowleft: { type: CommandType.MOVE_WEST, direction: "W" },
  d: { type: CommandType.MOVE_EAST, direction: "E" },
  arrowright: { type: CommandType.MOVE_EAST, direction: "E" },
  space: { type: CommandType.ATTACK },
  return: { type: CommandType.INTERACT },
  e: { type: CommandType.INTERACT },
  escape: { type: CommandType.SELECT },
};

/**
 * SDLInputSource - Input source for SDL-based keyboard/mouse events
 * Normalizes SDL events into abstract commands
 */
export class SDLInputSource extends InputSource {
  private keyMapping: KeyMapping;
  private eventHandlers: Array<() => void> = [];
  private currentTickProvider: () => number;

  constructor(
    commandQueue: CommandQueue,
    options: {
      keyMapping?: KeyMapping;
      tickProvider?: () => number;
    } = {}
  ) {
    super(commandQueue);
    this.keyMapping = options.keyMapping || DEFAULT_KEY_MAPPING;
    this.currentTickProvider = options.tickProvider || (() => commandQueue.getCurrentTick());
  }

  /**
   * Start listening for SDL input events
   */
  start(): void {
    // Note: SDL event polling typically happens in the main game loop
    // This method sets up the key mapping and prepares the input source
    console.log("SDL Input Source started");
  }

  /**
   * Stop listening for SDL input events
   */
  stop(): void {
    this.cleanup();
  }

  /**
   * Process an SDL keyboard event
   * @param event The SDL keyboard event
   * @returns A normalized command, or undefined if the key is not mapped
   */
  processKeyboardEvent(event: SDLKeyboardEvent): Command | undefined {
    if (!event.keyPressed) {
      return undefined; // Only process key down events
    }

    const key = event.keyName.toLowerCase();
    const mapping = this.keyMapping[key];

    if (!mapping) {
      return undefined;
    }

    const tick = this.currentTickProvider();

    return {
      type: mapping.type,
      direction: mapping.direction,
      tick,
    };
  }

  /**
   * Process an SDL mouse event
   * @param event The SDL mouse event
   * @returns A normalized command, or undefined if the mouse action is not mapped
   */
  processMouseEvent(event: SDLMouseEvent): Command | undefined {
    // For now, we don't map mouse events to commands
    // This can be extended to support mouse-based selection, etc.
    return undefined;
  }

  /**
   * Process a raw SDL event
   * @param event The raw SDL event
   * @returns A normalized command, or undefined if the event should be ignored
   */
  processEvent(event: unknown): Command | undefined {
    if (!event || typeof event !== "object") {
      return undefined;
    }

    const sdlEvent = event as any;

    // Check if it's a keyboard event
    if (sdlEvent.type === "keyboard") {
      const keyboardEvent: SDLKeyboardEvent = {
        keyName: sdlEvent.keyName || sdlEvent.key || "",
        keyPressed: sdlEvent.keyDown !== undefined ? sdlEvent.keyDown : sdlEvent.pressed,
        modifierShift: sdlEvent.shift,
        modifierCtrl: sdlEvent.ctrl,
        modifierAlt: sdlEvent.alt,
      };
      return this.processKeyboardEvent(keyboardEvent);
    }

    // Check if it's a mouse event
    if (sdlEvent.type === "mouse" || sdlEvent.button !== undefined) {
      const mouseEvent: SDLMouseEvent = {
        x: sdlEvent.x || 0,
        y: sdlEvent.y || 0,
        button: sdlEvent.button || 0,
        buttonPressed: sdlEvent.buttonPressed !== undefined ? sdlEvent.buttonPressed : true,
      };
      return this.processMouseEvent(mouseEvent);
    }

    return undefined;
  }

  /**
   * Set a custom key mapping
   * @param keyMapping The new key mapping
   */
  setKeyMapping(keyMapping: KeyMapping): void {
    this.keyMapping = keyMapping;
  }

  /**
   * Update the key mapping for a specific key
   * @param key The keyboard key
   * @param mapping The command mapping
   */
  mapKey(key: string, mapping: { type: CommandType; direction?: Direction }): void {
    this.keyMapping[key.toLowerCase()] = mapping;
  }

  /**
   * Remove a key mapping
   * @param key The keyboard key to unmap
   */
  unmapKey(key: string): void {
    delete this.keyMapping[key.toLowerCase()];
  }

  /**
   * Set the tick provider function
   * @param tickProvider Function that returns the current tick number
   */
  setTickProvider(tickProvider: () => number): void {
    this.currentTickProvider = tickProvider;
  }

  /**
   * Cleanup resources
   */
  cleanup(): void {
    this.eventHandlers.forEach((unregister) => unregister());
    this.eventHandlers = [];
    console.log("SDL Input Source cleaned up");
  }
}

/**
 * Helper function to create an SDLInputSource with default configuration
 */
export function createSDLInputSource(
  commandQueue: CommandQueue,
  options?: {
    keyMapping?: KeyMapping;
    tickProvider?: () => number;
  }
): SDLInputSource {
  return new SDLInputSource(commandQueue, options);
}
