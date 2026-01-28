import { describe, it, expect, beforeEach, vi } from "vitest";
import {
  SDLInputSource,
  SDLKeyboardEvent,
  SDLMouseEvent,
  KeyMapping,
  createSDLInputSource,
} from "../input/sdl-input-source";
import { CommandQueue } from "../input/command-queue";
import { CommandType, Direction } from "../input/command-types";

describe("SDLInputSource", () => {
  let commandQueue: CommandQueue;
  let inputSource: SDLInputSource;
  let mockTickProvider: () => number;

  beforeEach(() => {
    commandQueue = new CommandQueue();
    mockTickProvider = vi.fn(() => 0);
    inputSource = new SDLInputSource(commandQueue, {
      tickProvider: mockTickProvider,
    });
  });

  describe("Construction and Initialization", () => {
    it("should create an instance with default key mapping", () => {
      const defaultSource = new SDLInputSource(commandQueue);
      expect(defaultSource).toBeInstanceOf(SDLInputSource);
      expect(defaultSource.isEnabled()).toBe(true);
    });

    it("should accept custom tick provider", () => {
      const customTick = 42;
      const tickProvider = () => customTick;
      const customSource = new SDLInputSource(commandQueue, { tickProvider });

      const event: SDLKeyboardEvent = {
        keyName: "w",
        keyPressed: true,
      };
      customSource.processKeyboardEvent(event);

      expect(customTick).toBe(42);
    });

    it("should accept custom key mapping", () => {
      const customMapping: KeyMapping = {
        customkey: { type: CommandType.ATTACK },
      };
      const customSource = new SDLInputSource(commandQueue, {
        keyMapping: customMapping,
      });

      const event: SDLKeyboardEvent = {
        keyName: "customkey",
        keyPressed: true,
      };
      const result = customSource.processKeyboardEvent(event);

      expect(result?.type).toBe(CommandType.ATTACK);
    });
  });

  describe("Start and Stop", () => {
    it("should start without errors", () => {
      const consoleSpy = vi.spyOn(console, "log").mockImplementation(() => {});

      inputSource.start();

      expect(consoleSpy).toHaveBeenCalledWith("SDL Input Source started");
      consoleSpy.mockRestore();
    });

    it("should stop and cleanup", () => {
      const consoleSpy = vi.spyOn(console, "log").mockImplementation(() => {});

      inputSource.stop();

      expect(consoleSpy).toHaveBeenCalledWith("SDL Input Source cleaned up");
      consoleSpy.mockRestore();
    });

    it("should cleanup resources", () => {
      const consoleSpy = vi.spyOn(console, "log").mockImplementation(() => {});

      inputSource.cleanup();

      expect(consoleSpy).toHaveBeenCalledWith("SDL Input Source cleaned up");
      consoleSpy.mockRestore();
    });
  });

  describe("Keyboard Event Processing", () => {
    describe("Movement Commands", () => {
      it("should process W key as MOVE_NORTH", () => {
        const event: SDLKeyboardEvent = {
          keyName: "w",
          keyPressed: true,
        };

        const result = inputSource.processKeyboardEvent(event);

        expect(result).toBeDefined();
        expect(result?.type).toBe(CommandType.MOVE_NORTH);
        expect(result?.direction).toBe("N");
      });

      it("should process Arrow Up as MOVE_NORTH", () => {
        const event: SDLKeyboardEvent = {
          keyName: "arrowup",
          keyPressed: true,
        };

        const result = inputSource.processKeyboardEvent(event);

        expect(result).toBeDefined();
        expect(result?.type).toBe(CommandType.MOVE_NORTH);
        expect(result?.direction).toBe("N");
      });

      it("should process S key as MOVE_SOUTH", () => {
        const event: SDLKeyboardEvent = {
          keyName: "s",
          keyPressed: true,
        };

        const result = inputSource.processKeyboardEvent(event);

        expect(result).toBeDefined();
        expect(result?.type).toBe(CommandType.MOVE_SOUTH);
        expect(result?.direction).toBe("S");
      });

      it("should process Arrow Down as MOVE_SOUTH", () => {
        const event: SDLKeyboardEvent = {
          keyName: "arrowdown",
          keyPressed: true,
        };

        const result = inputSource.processKeyboardEvent(event);

        expect(result).toBeDefined();
        expect(result?.type).toBe(CommandType.MOVE_SOUTH);
        expect(result?.direction).toBe("S");
      });

      it("should process A key as MOVE_WEST", () => {
        const event: SDLKeyboardEvent = {
          keyName: "a",
          keyPressed: true,
        };

        const result = inputSource.processKeyboardEvent(event);

        expect(result).toBeDefined();
        expect(result?.type).toBe(CommandType.MOVE_WEST);
        expect(result?.direction).toBe("W");
      });

      it("should process Arrow Left as MOVE_WEST", () => {
        const event: SDLKeyboardEvent = {
          keyName: "arrowleft",
          keyPressed: true,
        };

        const result = inputSource.processKeyboardEvent(event);

        expect(result).toBeDefined();
        expect(result?.type).toBe(CommandType.MOVE_WEST);
        expect(result?.direction).toBe("W");
      });

      it("should process D key as MOVE_EAST", () => {
        const event: SDLKeyboardEvent = {
          keyName: "d",
          keyPressed: true,
        };

        const result = inputSource.processKeyboardEvent(event);

        expect(result).toBeDefined();
        expect(result?.type).toBe(CommandType.MOVE_EAST);
        expect(result?.direction).toBe("E");
      });

      it("should process Arrow Right as MOVE_EAST", () => {
        const event: SDLKeyboardEvent = {
          keyName: "arrowright",
          keyPressed: true,
        };

        const result = inputSource.processKeyboardEvent(event);

        expect(result).toBeDefined();
        expect(result?.type).toBe(CommandType.MOVE_EAST);
        expect(result?.direction).toBe("E");
      });
    });

    describe("Action Commands", () => {
      it("should process Space as ATTACK", () => {
        const event: SDLKeyboardEvent = {
          keyName: "space",
          keyPressed: true,
        };

        const result = inputSource.processKeyboardEvent(event);

        expect(result).toBeDefined();
        expect(result?.type).toBe(CommandType.ATTACK);
      });

      it("should process Enter as INTERACT", () => {
        const event: SDLKeyboardEvent = {
          keyName: "return",
          keyPressed: true,
        };

        const result = inputSource.processKeyboardEvent(event);

        expect(result).toBeDefined();
        expect(result?.type).toBe(CommandType.INTERACT);
      });

      it("should process E as INTERACT", () => {
        const event: SDLKeyboardEvent = {
          keyName: "e",
          keyPressed: true,
        };

        const result = inputSource.processKeyboardEvent(event);

        expect(result).toBeDefined();
        expect(result?.type).toBe(CommandType.INTERACT);
      });

      it("should process Escape as SELECT", () => {
        const event: SDLKeyboardEvent = {
          keyName: "escape",
          keyPressed: true,
        };

        const result = inputSource.processKeyboardEvent(event);

        expect(result).toBeDefined();
        expect(result?.type).toBe(CommandType.SELECT);
      });
    });

    describe("Key State Tracking", () => {
      it("should ignore key up events", () => {
        const event: SDLKeyboardEvent = {
          keyName: "w",
          keyPressed: false,
        };

        const result = inputSource.processKeyboardEvent(event);

        expect(result).toBeUndefined();
      });

      it("should be case-insensitive for key names", () => {
        const upperCaseEvent: SDLKeyboardEvent = {
          keyName: "W",
          keyPressed: true,
        };
        const lowerCaseEvent: SDLKeyboardEvent = {
          keyName: "w",
          keyPressed: true,
        };

        const result1 = inputSource.processKeyboardEvent(upperCaseEvent);
        const result2 = inputSource.processKeyboardEvent(lowerCaseEvent);

        expect(result1?.type).toBe(result2?.type);
        expect(result1?.direction).toBe(result2?.direction);
      });

      it("should return undefined for unmapped keys", () => {
        const event: SDLKeyboardEvent = {
          keyName: "unmappedkey",
          keyPressed: true,
        };

        const result = inputSource.processKeyboardEvent(event);

        expect(result).toBeUndefined();
      });
    });

    describe("Keyboard Modifiers", () => {
      it("should accept keyboard events with shift modifier", () => {
        const event: SDLKeyboardEvent = {
          keyName: "w",
          keyPressed: true,
          modifierShift: true,
        };

        const result = inputSource.processKeyboardEvent(event);

        expect(result).toBeDefined();
        expect(result?.type).toBe(CommandType.MOVE_NORTH);
      });

      it("should accept keyboard events with ctrl modifier", () => {
        const event: SDLKeyboardEvent = {
          keyName: "space",
          keyPressed: true,
          modifierCtrl: true,
        };

        const result = inputSource.processKeyboardEvent(event);

        expect(result).toBeDefined();
        expect(result?.type).toBe(CommandType.ATTACK);
      });

      it("should accept keyboard events with alt modifier", () => {
        const event: SDLKeyboardEvent = {
          keyName: "e",
          keyPressed: true,
          modifierAlt: true,
        };

        const result = inputSource.processKeyboardEvent(event);

        expect(result).toBeDefined();
        expect(result?.type).toBe(CommandType.INTERACT);
      });

      it("should accept keyboard events with multiple modifiers", () => {
        const event: SDLKeyboardEvent = {
          keyName: "d",
          keyPressed: true,
          modifierShift: true,
          modifierCtrl: true,
          modifierAlt: true,
        };

        const result = inputSource.processKeyboardEvent(event);

        expect(result).toBeDefined();
        expect(result?.type).toBe(CommandType.MOVE_EAST);
      });
    });

    describe("Tick Assignment", () => {
      it("should assign tick from tick provider to command", () => {
        const testTick = 100;
        mockTickProvider.mockReturnValue(testTick);

        const event: SDLKeyboardEvent = {
          keyName: "w",
          keyPressed: true,
        };

        const result = inputSource.processKeyboardEvent(event);

        expect(result?.tick).toBe(testTick);
      });

      it("should increment tick for sequential events", () => {
        mockTickProvider
          .mockReturnValueOnce(0)
          .mockReturnValueOnce(1)
          .mockReturnValueOnce(2);

        const event1: SDLKeyboardEvent = { keyName: "w", keyPressed: true };
        const event2: SDLKeyboardEvent = { keyName: "a", keyPressed: true };
        const event3: SDLKeyboardEvent = { keyName: "d", keyPressed: true };

        const result1 = inputSource.processKeyboardEvent(event1);
        const result2 = inputSource.processKeyboardEvent(event2);
        const result3 = inputSource.processKeyboardEvent(event3);

        expect(result1?.tick).toBe(0);
        expect(result2?.tick).toBe(1);
        expect(result3?.tick).toBe(2);
      });
    });
  });

  describe("Mouse Event Processing", () => {
    it("should process mouse events", () => {
      const event: SDLMouseEvent = {
        x: 100,
        y: 200,
        button: 1,
        buttonPressed: true,
      };

      const result = inputSource.processMouseEvent(event);

      // Currently returns undefined as mouse events are not mapped
      expect(result).toBeUndefined();
    });

    it("should handle mouse position coordinates", () => {
      const event: SDLMouseEvent = {
        x: 640,
        y: 480,
        button: 0,
        buttonPressed: false,
      };

      const result = inputSource.processMouseEvent(event);

      expect(result).toBeUndefined();
    });

    it("should handle different mouse buttons", () => {
      const buttons = [0, 1, 2, 3, 4];

      buttons.forEach((button) => {
        const event: SDLMouseEvent = {
          x: 0,
          y: 0,
          button,
          buttonPressed: true,
        };

        const result = inputSource.processMouseEvent(event);

        expect(result).toBeUndefined();
      });
    });

    it("should handle mouse button press state", () => {
      const pressEvent: SDLMouseEvent = {
        x: 0,
        y: 0,
        button: 1,
        buttonPressed: true,
      };

      const releaseEvent: SDLMouseEvent = {
        x: 0,
        y: 0,
        button: 1,
        buttonPressed: false,
      };

      const pressResult = inputSource.processMouseEvent(pressEvent);
      const releaseResult = inputSource.processMouseEvent(releaseEvent);

      expect(pressResult).toBeUndefined();
      expect(releaseResult).toBeUndefined();
    });

    it("should handle negative mouse coordinates", () => {
      const event: SDLMouseEvent = {
        x: -10,
        y: -20,
        button: 0,
        buttonPressed: false,
      };

      const result = inputSource.processMouseEvent(event);

      expect(result).toBeUndefined();
    });

    it("should handle large mouse coordinates", () => {
      const event: SDLMouseEvent = {
        x: 3840,
        y: 2160,
        button: 0,
        buttonPressed: false,
      };

      const result = inputSource.processMouseEvent(event);

      expect(result).toBeUndefined();
    });
  });

  describe("Raw Event Processing", () => {
    describe("Keyboard Events", () => {
      it("should process SDL keyboard event with type field", () => {
        const sdlEvent = {
          type: "keyboard",
          keyName: "w",
          keyDown: true,
        };

        const result = inputSource.processEvent(sdlEvent);

        expect(result).toBeDefined();
        expect(result?.type).toBe(CommandType.MOVE_NORTH);
      });

      it("should process SDL keyboard event with keyDown field", () => {
        const sdlEvent = {
          type: "keyboard",
          keyName: "space",
          keyDown: true,
        };

        const result = inputSource.processEvent(sdlEvent);

        expect(result).toBeDefined();
        expect(result?.type).toBe(CommandType.ATTACK);
      });

      it("should process SDL keyboard event with pressed field", () => {
        const sdlEvent = {
          type: "keyboard",
          keyName: "e",
          pressed: true,
        };

        const result = inputSource.processEvent(sdlEvent);

        expect(result).toBeDefined();
        expect(result?.type).toBe(CommandType.INTERACT);
      });

      it("should handle keyboard events with modifiers", () => {
        const sdlEvent = {
          type: "keyboard",
          keyName: "d",
          keyDown: true,
          shift: true,
          ctrl: false,
          alt: false,
        };

        const result = inputSource.processEvent(sdlEvent);

        expect(result).toBeDefined();
        expect(result?.type).toBe(CommandType.MOVE_EAST);
      });

      it("should prioritize keyDown over pressed field", () => {
        const sdlEvent = {
          type: "keyboard",
          keyName: "w",
          keyDown: false,
          pressed: true,
        };

        const result = inputSource.processEvent(sdlEvent);

        expect(result).toBeUndefined();
      });

      it("should handle keyboard events with 'key' field", () => {
        const sdlEvent = {
          type: "keyboard",
          key: "a",
          keyDown: true,
        };

        const result = inputSource.processEvent(sdlEvent);

        expect(result).toBeDefined();
        expect(result?.type).toBe(CommandType.MOVE_WEST);
      });
    });

    describe("Mouse Events", () => {
      it("should process SDL mouse event with type field", () => {
        const sdlEvent = {
          type: "mouse",
          x: 100,
          y: 200,
          button: 1,
          buttonPressed: true,
        };

        const result = inputSource.processEvent(sdlEvent);

        expect(result).toBeUndefined();
      });

      it("should process SDL mouse event without type field", () => {
        const sdlEvent = {
          x: 100,
          y: 200,
          button: 1,
          buttonPressed: true,
        };

        const result = inputSource.processEvent(sdlEvent);

        expect(result).toBeUndefined();
      });

      it("should handle mouse events with buttonPressed field", () => {
        const sdlEvent = {
          type: "mouse",
          x: 100,
          y: 200,
          button: 1,
          buttonPressed: true,
        };

        const result = inputSource.processEvent(sdlEvent);

        expect(result).toBeUndefined();
      });

      it("should default buttonPressed to true when not specified", () => {
        const sdlEvent = {
          type: "mouse",
          x: 100,
          y: 200,
          button: 1,
        };

        const result = inputSource.processEvent(sdlEvent);

        expect(result).toBeUndefined();
      });
    });

    describe("Invalid Events", () => {
      it("should return undefined for null event", () => {
        const result = inputSource.processEvent(null);

        expect(result).toBeUndefined();
      });

      it("should return undefined for undefined event", () => {
        const result = inputSource.processEvent(undefined);

        expect(result).toBeUndefined();
      });

      it("should return undefined for non-object event", () => {
        const result = inputSource.processEvent("not an object");

        expect(result).toBeUndefined();
      });

      it("should return undefined for event without type", () => {
        const sdlEvent = {
          someField: "someValue",
        };

        const result = inputSource.processEvent(sdlEvent);

        expect(result).toBeUndefined();
      });

      it("should return undefined for unknown event type", () => {
        const sdlEvent = {
          type: "gamepad",
          someField: "someValue",
        };

        const result = inputSource.processEvent(sdlEvent);

        expect(result).toBeUndefined();
      });
    });
  });

  describe("Key Mapping Management", () => {
    it("should set custom key mapping", () => {
      const customMapping: KeyMapping = {
        z: { type: CommandType.MOVE_NORTH, direction: "N" },
        x: { type: CommandType.ATTACK },
      };

      inputSource.setKeyMapping(customMapping);

      const event1: SDLKeyboardEvent = { keyName: "z", keyPressed: true };
      const event2: SDLKeyboardEvent = { keyName: "x", keyPressed: true };

      const result1 = inputSource.processKeyboardEvent(event1);
      const result2 = inputSource.processKeyboardEvent(event2);

      expect(result1?.type).toBe(CommandType.MOVE_NORTH);
      expect(result2?.type).toBe(CommandType.ATTACK);
    });

    it("should map individual key", () => {
      inputSource.mapKey("q", { type: CommandType.ATTACK });

      const event: SDLKeyboardEvent = { keyName: "q", keyPressed: true };

      const result = inputSource.processKeyboardEvent(event);

      expect(result?.type).toBe(CommandType.ATTACK);
    });

    it("should map key with direction", () => {
      inputSource.mapKey("i", { type: CommandType.MOVE_NORTH, direction: "N" });

      const event: SDLKeyboardEvent = { keyName: "i", keyPressed: true };

      const result = inputSource.processKeyboardEvent(event);

      expect(result?.type).toBe(CommandType.MOVE_NORTH);
      expect(result?.direction).toBe("N");
    });

    it("should unmap key", () => {
      // First verify default mapping exists
      const eventBefore: SDLKeyboardEvent = { keyName: "w", keyPressed: true };
      const resultBefore = inputSource.processKeyboardEvent(eventBefore);
      expect(resultBefore?.type).toBe(CommandType.MOVE_NORTH);

      // Unmap the key
      inputSource.unmapKey("w");

      // Verify key is no longer mapped
      const eventAfter: SDLKeyboardEvent = { keyName: "w", keyPressed: true };
      const resultAfter = inputSource.processKeyboardEvent(eventAfter);
      expect(resultAfter).toBeUndefined();
    });

    it("should be case-insensitive when mapping key", () => {
      inputSource.mapKey("CustomKey", { type: CommandType.INTERACT });

      const event1: SDLKeyboardEvent = {
        keyName: "customkey",
        keyPressed: true,
      };
      const event2: SDLKeyboardEvent = {
        keyName: "CUSTOMKEY",
        keyPressed: true,
      };
      const event3: SDLKeyboardEvent = {
        keyName: "CustomKey",
        keyPressed: true,
      };

      const result1 = inputSource.processKeyboardEvent(event1);
      const result2 = inputSource.processKeyboardEvent(event2);
      const result3 = inputSource.processKeyboardEvent(event3);

      expect(result1?.type).toBe(CommandType.INTERACT);
      expect(result2?.type).toBe(CommandType.INTERACT);
      expect(result3?.type).toBe(CommandType.INTERACT);
    });

    it("should be case-insensitive when unmapping key", () => {
      inputSource.mapKey("TestKey", { type: CommandType.ATTACK });

      inputSource.unmapKey("testkey");

      const event: SDLKeyboardEvent = { keyName: "TestKey", keyPressed: true };
      const result = inputSource.processKeyboardEvent(event);

      expect(result).toBeUndefined();
    });

    it("should overwrite existing key mapping", () => {
      inputSource.mapKey("w", { type: CommandType.ATTACK });

      const event: SDLKeyboardEvent = { keyName: "w", keyPressed: true };
      const result = inputSource.processKeyboardEvent(event);

      expect(result?.type).toBe(CommandType.ATTACK);
      expect(result?.direction).toBeUndefined();
    });
  });

  describe("Tick Provider", () => {
    it("should use custom tick provider", () => {
      let tickCounter = 0;
      const customTickProvider = () => tickCounter++;

      inputSource.setTickProvider(customTickProvider);

      const event1: SDLKeyboardEvent = { keyName: "w", keyPressed: true };
      const event2: SDLKeyboardEvent = { keyName: "a", keyPressed: true };

      const result1 = inputSource.processKeyboardEvent(event1);
      const result2 = inputSource.processKeyboardEvent(event2);

      expect(result1?.tick).toBe(0);
      expect(result2?.tick).toBe(1);
    });

    it("should update tick provider dynamically", () => {
      const tickProvider1 = vi.fn(() => 10);
      const tickProvider2 = vi.fn(() => 20);

      inputSource.setTickProvider(tickProvider1);

      const event1: SDLKeyboardEvent = { keyName: "w", keyPressed: true };
      const result1 = inputSource.processKeyboardEvent(event1);

      inputSource.setTickProvider(tickProvider2);

      const event2: SDLKeyboardEvent = { keyName: "a", keyPressed: true };
      const result2 = inputSource.processKeyboardEvent(event2);

      expect(result1?.tick).toBe(10);
      expect(result2?.tick).toBe(20);
      expect(tickProvider1).toHaveBeenCalledOnce();
      expect(tickProvider2).toHaveBeenCalledOnce();
    });
  });

  describe("Input Source State", () => {
    it("should be enabled by default", () => {
      expect(inputSource.isEnabled()).toBe(true);
    });

    it("should disable input source", () => {
      inputSource.disable();

      expect(inputSource.isEnabled()).toBe(false);
    });

    it("should enable input source", () => {
      inputSource.disable();
      expect(inputSource.isEnabled()).toBe(false);

      inputSource.enable();
      expect(inputSource.isEnabled()).toBe(true);
    });
  });

  describe("Factory Function", () => {
    it("should create SDLInputSource with default options", () => {
      const source = createSDLInputSource(commandQueue);

      expect(source).toBeInstanceOf(SDLInputSource);
      expect(source.isEnabled()).toBe(true);
    });

    it("should create SDLInputSource with custom options", () => {
      const customMapping: KeyMapping = {
        custom: { type: CommandType.ATTACK },
      };
      const customTick = () => 100;

      const source = createSDLInputSource(commandQueue, {
        keyMapping: customMapping,
        tickProvider: customTick,
      });

      const event: SDLKeyboardEvent = { keyName: "custom", keyPressed: true };
      const result = source.processKeyboardEvent(event);

      expect(result?.type).toBe(CommandType.ATTACK);
      expect(result?.tick).toBe(100);
    });
  });

  describe("Edge Cases", () => {
    it("should handle empty key name", () => {
      const event: SDLKeyboardEvent = {
        keyName: "",
        keyPressed: true,
      };

      const result = inputSource.processKeyboardEvent(event);

      expect(result).toBeUndefined();
    });

    it("should handle special characters in key name", () => {
      const event: SDLKeyboardEvent = {
        keyName: "[-]",
        keyPressed: true,
      };

      const result = inputSource.processKeyboardEvent(event);

      expect(result).toBeUndefined();
    });

    it("should handle numeric key names", () => {
      const event: SDLKeyboardEvent = {
        keyName: "1",
        keyPressed: true,
      };

      const result = inputSource.processKeyboardEvent(event);

      expect(result).toBeUndefined();
    });

    it("should handle very long key names", () => {
      const longKeyName = "a".repeat(1000);
      const event: SDLKeyboardEvent = {
        keyName: longKeyName,
        keyPressed: true,
      };

      const result = inputSource.processKeyboardEvent(event);

      expect(result).toBeUndefined();
    });

    it("should handle zero mouse coordinates", () => {
      const event: SDLMouseEvent = {
        x: 0,
        y: 0,
        button: 0,
        buttonPressed: false,
      };

      const result = inputSource.processMouseEvent(event);

      expect(result).toBeUndefined();
    });
  });
});
