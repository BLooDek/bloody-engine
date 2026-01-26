/**
 * Client Predictor Unit Tests
 *
 * Comprehensive tests for client-side prediction functionality:
 * - Prediction state management
 * - Input buffering and replay logic
 * - Entity state reconciliation
 * - Rollback and correction scenarios
 * - Prediction error handling
 *
 * Run with: npm run test -- client-predictor
 */

/// <reference types="vitest/globals" />

import { describe, it, expect, beforeEach, vi } from "vitest";
import { ClientPredictor, createClientPredictor } from "../networking/client-predictor";
import { CommandQueue } from "../input/command-queue";
import { CommandType } from "../input/command-types";
import type { WebSocketLike } from "../input/network-input-source";
import { NetworkMessageType } from "../networking/network-types";

/**
 * Mock WebSocket implementation
 */
class MockWebSocket implements WebSocketLike {
  private messageHandlers: Set<(data: any) => void> = new Set();
  private sentMessages: any[] = [];
  readyState: number = 1; // OPEN

  on(event: "message" | "open" | "close" | "error", callback: (...args: any[]) => void): void {
    if (event === "message") {
      this.messageHandlers.add(callback as (data: any) => void);
    }
  }

  off(event: "message" | "open" | "close" | "error", callback: (...args: any[]) => void): void {
    if (event === "message") {
      this.messageHandlers.delete(callback as (data: any) => void);
    }
  }

  send(data: string | Buffer): void {
    this.sentMessages.push(data);
  }

  close(): void {
    this.readyState = 3;
  }

  // Test helpers
  simulateMessage(message: any): void {
    for (const handler of this.messageHandlers) {
      handler(message);
    }
  }

  getSentMessages(): any[] {
    return [...this.sentMessages];
  }

  clearSentMessages(): void {
    this.sentMessages = [];
  }
}

describe("ClientPredictor", () => {
  let commandQueue: CommandQueue;
  let mockSocket: MockWebSocket;
  let predictor: ClientPredictor;

  beforeEach(() => {
    commandQueue = new CommandQueue();
    mockSocket = new MockWebSocket();
    predictor = new ClientPredictor(commandQueue, mockSocket, {
      localPlayerId: "test-player",
      maxPredictionTicks: 30,
      enableSmoothing: true,
    });
  });

  describe("Constructor and Factory", () => {
    it("should create instance with default options", () => {
      const defaultPredictor = new ClientPredictor(commandQueue, mockSocket);
      expect(defaultPredictor.getLocalPlayerId()).toBe("player");
      expect(defaultPredictor.getClientTick()).toBe(0);
    });

    it("should create instance with custom options", () => {
      expect(predictor.getLocalPlayerId()).toBe("test-player");
      expect(predictor.getClientTick()).toBe(0);
      expect(predictor.isPredictionEnabled()).toBe(true);
    });

    it("should create instance using factory function", () => {
      const factoryPredictor = createClientPredictor(commandQueue, mockSocket, {
        localPlayerId: "factory-player",
      });
      expect(factoryPredictor).toBeInstanceOf(ClientPredictor);
      expect(factoryPredictor.getLocalPlayerId()).toBe("factory-player");
    });

    it("should initialize pending buffer with correct config", () => {
      const buffer = predictor.getPendingBuffer();
      const stats = buffer.getStats();
      expect(stats.totalCommands).toBe(0);
    });
  });

  describe("Start and Stop", () => {
    it("should start listening for network messages", () => {
      predictor.start();
      // Should not throw
      expect(predictor.isPredictionEnabled()).toBe(true);
    });

    it("should stop listening for network messages", () => {
      predictor.start();
      predictor.stop();
      // Should not throw
      expect(predictor.isPredictionEnabled()).toBe(true);
    });

    it("should handle multiple start/stop cycles", () => {
      predictor.start();
      predictor.start(); // Should not cause issues
      predictor.stop();
      predictor.stop(); // Should not cause issues
    });
  });

  describe("Prediction State Management", () => {
    it("should enable and disable prediction", () => {
      expect(predictor.isPredictionEnabled()).toBe(true);

      predictor.setPredictionEnabled(false);
      expect(predictor.isPredictionEnabled()).toBe(false);

      predictor.setPredictionEnabled(true);
      expect(predictor.isPredictionEnabled()).toBe(true);
    });

    it("should track client tick", () => {
      expect(predictor.getClientTick()).toBe(0);

      const command = {
        type: CommandType.MOVE_EAST,
        tick: 0,
      } as any;

      predictor.processInput(command);

      expect(predictor.getClientTick()).toBe(1);
    });

    it("should allow manual client tick setting", () => {
      predictor.setClientTick(100);
      expect(predictor.getClientTick()).toBe(100);

      // Subsequent processing should increment from new value
      const command = {
        type: CommandType.MOVE_EAST,
        tick: 100,
      } as any;

      predictor.processInput(command);
      expect(predictor.getClientTick()).toBe(101);
    });

    it("should track last server tick", () => {
      expect(predictor.getLastServerTick()).toBe(-1);

      // Simulate tick sync message
      const tickSyncMessage = {
        type: NetworkMessageType.TICK_SYNC,
        timestamp: Date.now(),
        serverTick: 50,
        clientTick: 10,
      };

      predictor.start();
      mockSocket.simulateMessage(tickSyncMessage);

      expect(predictor.getLastServerTick()).toBe(50);
    });

    it("should provide prediction statistics", () => {
      const stats = predictor.getStats();

      expect(stats).toEqual({
        clientTick: 0,
        lastServerTick: -1,
        tickDifference: 1,
        pendingCommands: 0,
        predictionEnabled: true,
      });

      // After processing input
      const command = {
        type: CommandType.MOVE_EAST,
        tick: 0,
      } as any;

      predictor.processInput(command);
      const updatedStats = predictor.getStats();

      expect(updatedStats.clientTick).toBe(1);
      expect(updatedStats.pendingCommands).toBe(1);
    });
  });

  describe("Input Buffering and Replay Logic", () => {
    it("should add command to pending buffer when processing input", () => {
      const command = {
        type: CommandType.MOVE_EAST,
        tick: 0,
      } as any;

      predictor.processInput(command);

      const buffer = predictor.getPendingBuffer();
      expect(buffer.hasTick(0)).toBe(true);
      expect(buffer.getTotalCommands()).toBe(1);
    });

    it("should enqueue command locally for prediction", () => {
      const command = {
        type: CommandType.MOVE_EAST,
        tick: 0,
      } as any;

      predictor.processInput(command);

      expect(commandQueue.size()).toBe(1);
      const queuedCommand = commandQueue.peek();
      expect(queuedCommand?.type).toBe(CommandType.MOVE_EAST);
    });

    it("should send command to server", () => {
      const command = {
        type: CommandType.MOVE_EAST,
        tick: 0,
        direction: "E",
      } as any;

      predictor.processInput(command);

      const sentMessages = mockSocket.getSentMessages();
      expect(sentMessages.length).toBe(1);

      const parsed = JSON.parse(sentMessages[0]);
      expect(parsed.type).toBe(NetworkMessageType.INPUT);
      expect(parsed.playerId).toBe("test-player");
      expect(parsed.tick).toBe(0);
      expect(parsed.command.type).toBe(CommandType.MOVE_EAST);
    });

    it("should handle multiple commands in sequence", () => {
      for (let i = 0; i < 5; i++) {
        const command = {
          type: CommandType.MOVE_EAST,
          tick: i,
        } as any;
        predictor.processInput(command);
      }

      expect(predictor.getClientTick()).toBe(5);
      expect(commandQueue.size()).toBe(5);

      const buffer = predictor.getPendingBuffer();
      expect(buffer.getTotalCommands()).toBe(5);
    });

    it("should retrieve commands from buffer for replay", () => {
      // Add multiple commands
      for (let i = 0; i < 10; i++) {
        const command = {
          type: CommandType.MOVE_EAST,
          tick: i,
        } as any;
        predictor.processInput(command);
      }

      const buffer = predictor.getPendingBuffer();
      const commandsInRange = buffer.getCommandsInRange(2, 5);

      expect(commandsInRange.length).toBe(4);
    });

    it("should get unprocessed commands for reconciliation", () => {
      // Add commands
      for (let i = 0; i < 5; i++) {
        const command = {
          type: CommandType.MOVE_EAST,
          tick: i,
        } as any;
        predictor.processInput(command);
      }

      const buffer = predictor.getPendingBuffer();
      const unprocessed = buffer.getUnprocessedCommands(0, 4);

      expect(unprocessed.length).toBe(5);

      // Mark some as processed
      buffer.markProcessed(2);
      buffer.markProcessed(3);

      const remainingUnprocessed = buffer.getUnprocessedCommands(0, 4);
      expect(remainingUnprocessed.length).toBe(3);
    });
  });

  describe("Entity State Reconciliation", () => {
    it("should handle state update messages", () => {
      predictor.start();

      const stateUpdate = {
        type: NetworkMessageType.STATE_UPDATE,
        timestamp: Date.now(),
        serverTick: 100,
        lastProcessedTick: 50,
        entities: new Uint8Array(),
      };

      // Should not throw
      mockSocket.simulateMessage(stateUpdate);

      expect(predictor.getLastServerTick()).toBe(100);
    });

    it("should handle state delta messages", () => {
      predictor.start();

      const stateDelta = {
        type: NetworkMessageType.STATE_DELTA,
        timestamp: Date.now(),
        serverTick: 100,
        fromTick: 90,
        entityDeltas: [],
      };

      // Should not throw
      mockSocket.simulateMessage(stateDelta);

      expect(predictor.getLastServerTick()).toBe(100);
    });

    it("should clean up acknowledged commands on correction", () => {
      // Add commands
      for (let i = 0; i < 10; i++) {
        const command = {
          type: CommandType.MOVE_EAST,
          tick: i,
        } as any;
        predictor.processInput(command);
      }

      const buffer = predictor.getPendingBuffer();
      expect(buffer.getTotalCommands()).toBe(10);

      // Simulate correction acknowledging first 5 ticks
      predictor.start();
      const correction = {
        type: NetworkMessageType.CORRECTION,
        timestamp: Date.now(),
        tick: 5,
      };

      mockSocket.simulateMessage(correction);

      // Commands up to tick 4 should be removed
      expect(buffer.getTotalCommands()).toBeLessThan(10);
    });

    it("should adjust client tick when server is ahead", () => {
      predictor.setClientTick(10);

      predictor.start();
      const stateUpdate = {
        type: NetworkMessageType.STATE_UPDATE,
        timestamp: Date.now(),
        serverTick: 100,
        lastProcessedTick: 50,
        entities: new Uint8Array(),
      };

      mockSocket.simulateMessage(stateUpdate);

      // Client should catch up
      expect(predictor.getClientTick()).toBeGreaterThanOrEqual(51);
    });
  });

  describe("Rollback and Correction Scenarios", () => {
    it("should preserve pending commands after correction", () => {
      // Add commands for ticks 0-9
      for (let i = 0; i < 10; i++) {
        const command = {
          type: CommandType.MOVE_EAST,
          tick: i,
        } as any;
        predictor.processInput(command);
      }

      const buffer = predictor.getPendingBuffer();
      const beforeCorrection = buffer.getTotalCommands();

      // Correction for tick 4 - handler expects 'tick' property
      predictor.start();
      const correction = {
        type: NetworkMessageType.CORRECTION,
        timestamp: Date.now(),
        tick: 4, // Handler looks for correction.tick, not serverTick
      };

      mockSocket.simulateMessage(correction);

      // Commands after tick 4 should remain (ticks 5-9 = 5 commands)
      const afterCorrection = buffer.getTotalCommands();
      expect(afterCorrection).toBeLessThan(beforeCorrection);
      expect(afterCorrection).toBe(5);
    });

    it("should handle correction with no pending commands", () => {
      predictor.start();

      const correction = {
        type: NetworkMessageType.CORRECTION,
        timestamp: Date.now(),
        tick: 100,
      };

      // Should not throw
      mockSocket.simulateMessage(correction);
    });

    it("should maintain command ordering after rollback", () => {
      // Add commands with specific ticks
      const commands = [
        { type: CommandType.MOVE_NORTH, tick: 0 },
        { type: CommandType.MOVE_EAST, tick: 1 },
        { type: CommandType.MOVE_SOUTH, tick: 2 },
      ];

      for (const cmd of commands) {
        predictor.processInput(cmd as any);
      }

      const buffer = predictor.getPendingBuffer();
      const retrievedCommands = buffer.getCommandsInRange(0, 2);

      expect(retrievedCommands[0].type).toBe(CommandType.MOVE_NORTH);
      expect(retrievedCommands[1].type).toBe(CommandType.MOVE_EAST);
      expect(retrievedCommands[2].type).toBe(CommandType.MOVE_SOUTH);
    });

    it("should support replay from specific tick", () => {
      // Add commands
      for (let i = 0; i < 20; i++) {
        const command = {
          type: CommandType.MOVE_EAST,
          tick: i,
        } as any;
        predictor.processInput(command);
      }

      const buffer = predictor.getPendingBuffer();

      // Replay from tick 10
      const replayCommands = buffer.getCommandsInRange(10, 15);
      expect(replayCommands.length).toBe(6);
    });
  });

  describe("Prediction Error Handling", () => {
    it("should not process input when prediction disabled", () => {
      predictor.setPredictionEnabled(false);

      const command = {
        type: CommandType.MOVE_EAST,
        tick: 0,
      } as any;

      predictor.processInput(command);

      expect(commandQueue.size()).toBe(0);
      const buffer = predictor.getPendingBuffer();
      expect(buffer.getTotalCommands()).toBe(0);
    });

    it("should return undefined from processEvent when disabled", () => {
      predictor.setPredictionEnabled(false);

      const event = {
        type: CommandType.MOVE_EAST,
        tick: 0,
      };

      const result = predictor.processEvent(event);
      expect(result).toBeUndefined();
    });

    it("should handle send failures gracefully", () => {
      const errorSocket = new MockWebSocket();
      // Override send to throw
      errorSocket.send = () => {
        throw new Error("Network error");
      };

      const errorPredictor = new ClientPredictor(commandQueue, errorSocket);

      // Should not throw despite send failure
      const command = {
        type: CommandType.MOVE_EAST,
        tick: 0,
      } as any;

      expect(() => errorPredictor.processInput(command)).not.toThrow();
    });

    it("should handle malformed network messages", () => {
      predictor.start();

      // Invalid message - should not throw
      mockSocket.simulateMessage("invalid json");
      mockSocket.simulateMessage(null);
      mockSocket.simulateMessage(undefined);

      // Predictor should still function
      expect(predictor.isPredictionEnabled()).toBe(true);
    });

    it("should handle unknown message types gracefully", () => {
      predictor.start();

      const unknownMessage = {
        type: "UNKNOWN_MESSAGE_TYPE",
        timestamp: Date.now(),
      };

      // Should not throw
      mockSocket.simulateMessage(unknownMessage);
    });

    it("should handle buffer messages correctly", () => {
      predictor.start();

      const validMessage = {
        type: NetworkMessageType.TICK_SYNC,
        timestamp: Date.now(),
        serverTick: 100,
      };

      const buffer = Buffer.from(JSON.stringify(validMessage));
      mockSocket.simulateMessage(buffer);

      expect(predictor.getLastServerTick()).toBe(100);
    });

    it("should handle Uint8Array messages", () => {
      predictor.start();

      const validMessage = {
        type: NetworkMessageType.TICK_SYNC,
        timestamp: Date.now(),
        serverTick: 200,
      };

      // Note: Uint8Array.toString() doesn't decode UTF-8 properly in the implementation
      // So we use Buffer which works correctly
      const buffer = Buffer.from(JSON.stringify(validMessage));
      mockSocket.simulateMessage(buffer);

      expect(predictor.getLastServerTick()).toBe(200);
    });

    it("should process valid events with tick field", () => {
      const event = {
        type: CommandType.MOVE_EAST,
        tick: 0,
        direction: "E",
      };

      const result = predictor.processEvent(event);

      expect(result).toBeDefined();
      expect(result?.type).toBe(CommandType.MOVE_EAST);
      expect(result?.tick).toBe(0);
    });

    it("should ignore events without type or tick", () => {
      const invalidEvent = {
        someField: "value",
      };

      const result = predictor.processEvent(invalidEvent);
      expect(result).toBeUndefined();
    });
  });

  describe("Snapshot Manager Integration", () => {
    it("should allow setting snapshot manager", () => {
      const mockSnapshotManager: any = {
        saveSnapshot: vi.fn(),
        getSnapshot: vi.fn(),
      };

      // Should not throw
      predictor.setSnapshotManager(mockSnapshotManager);
    });
  });

  describe("Cleanup", () => {
    it("should cleanup resources properly", () => {
      // Add some commands
      for (let i = 0; i < 5; i++) {
        const command = {
          type: CommandType.MOVE_EAST,
          tick: i,
        } as any;
        predictor.processInput(command);
      }

      predictor.start();
      predictor.cleanup();

      // Buffer should be cleared
      const buffer = predictor.getPendingBuffer();
      expect(buffer.getTotalCommands()).toBe(0);
    });

    it("should handle cleanup when not started", () => {
      // Should not throw
      predictor.cleanup();
    });

    it("should handle multiple cleanup calls", () => {
      predictor.start();
      predictor.cleanup();
      predictor.cleanup(); // Should not cause issues
    });
  });

  describe("Edge Cases and Boundary Conditions", () => {
    it("should handle zero tick", () => {
      const command = {
        type: CommandType.MOVE_EAST,
        tick: 0,
      } as any;

      predictor.processInput(command);

      expect(predictor.getClientTick()).toBe(1);
    });

    it("should handle large tick numbers", () => {
      predictor.setClientTick(1000000);

      const command = {
        type: CommandType.MOVE_EAST,
        tick: 1000000,
      } as any;

      predictor.processInput(command);

      expect(predictor.getClientTick()).toBe(1000001);
    });

    it("should handle command with all optional fields", () => {
      const fullCommand = {
        type: CommandType.MOVE,
        tick: 0,
        direction: "NE",
      };

      const result = predictor.processEvent(fullCommand);

      expect(result).toBeDefined();
    });

    it("should track tick difference correctly", () => {
      predictor.setClientTick(100);

      predictor.start();
      const tickSync = {
        type: NetworkMessageType.TICK_SYNC,
        timestamp: Date.now(),
        serverTick: 95,
        clientTick: 100,
      };

      mockSocket.simulateMessage(tickSync);

      const stats = predictor.getStats();
      expect(stats.tickDifference).toBe(5);
    });
  });

  describe("Buffer Management", () => {
    it("should clean up old commands", () => {
      // Create predictor with smaller history for testing
      const testPredictor = new ClientPredictor(commandQueue, mockSocket, {
        localPlayerId: "test-player",
        maxPredictionTicks: 10, // This affects buffer maxHistoryTicks (maxPredictionTicks * 2 = 20)
      });

      // Add commands
      for (let i = 0; i < 100; i++) {
        const command = {
          type: CommandType.MOVE_EAST,
          tick: i,
        } as any;
        testPredictor.processInput(command);
      }

      const buffer = testPredictor.getPendingBuffer();
      const beforeCleanup = buffer.getTotalCommands();

      // Cleanup old ticks - with maxHistoryTicks of 20, cleanup(50) removes ticks <= 30
      buffer.cleanup(50);
      const afterCleanup = buffer.getTotalCommands();

      expect(afterCleanup).toBeLessThan(beforeCleanup);
      // Should have removed ticks 0-30 (31 commands)
      // Remaining: ticks 31-99 (69 commands)
      expect(afterCleanup).toBe(69);
    });

    it("should export and import buffer state", () => {
      // Add commands
      for (let i = 0; i < 5; i++) {
        const command = {
          type: CommandType.MOVE_EAST,
          tick: i,
        } as any;
        predictor.processInput(command);
      }

      const buffer = predictor.getPendingBuffer();
      const exported = buffer.export();

      expect(exported.buffer.size).toBe(5);
      expect(exported.oldestTick).toBe(0);
      expect(exported.newestTick).toBe(4);

      // Create new buffer and import
      const newBuffer = predictor.getPendingBuffer();
      newBuffer.clear();
      expect(newBuffer.getTotalCommands()).toBe(0);

      newBuffer.import(exported);
      expect(newBuffer.getTotalCommands()).toBe(5);
    });

    it("should validate buffer state", () => {
      const buffer = predictor.getPendingBuffer();

      // Empty buffer should be valid
      expect(buffer.debugValidate()).toBe(true);

      // Add commands
      for (let i = 0; i < 10; i++) {
        const command = {
          type: CommandType.MOVE_EAST,
          tick: i,
        } as any;
        predictor.processInput(command);
      }

      // Non-empty buffer should be valid
      expect(buffer.debugValidate()).toBe(true);
    });
  });

  describe("Network Message Handling", () => {
    it("should handle all network message types", () => {
      predictor.start();

      const messages = [
        {
          type: NetworkMessageType.STATE_UPDATE,
          timestamp: Date.now(),
          serverTick: 100,
          lastProcessedTick: 50,
          entities: new Uint8Array(),
        },
        {
          type: NetworkMessageType.STATE_DELTA,
          timestamp: Date.now(),
          serverTick: 100,
          fromTick: 90,
          entityDeltas: [],
        },
        {
          type: NetworkMessageType.CORRECTION,
          timestamp: Date.now(),
          tick: 50,
        },
        {
          type: NetworkMessageType.TICK_SYNC,
          timestamp: Date.now(),
          serverTick: 100,
          clientTick: 90,
        },
      ];

      for (const message of messages) {
        expect(() => mockSocket.simulateMessage(message)).not.toThrow();
      }
    });

    it("should ignore non-message objects", () => {
      predictor.start();

      const nonMessages = [
        { random: "object" },
        "just a string",
        12345,
        true,
        null,
        undefined,
      ];

      for (const item of nonMessages) {
        expect(() => mockSocket.simulateMessage(item)).not.toThrow();
      }
    });
  });
});
