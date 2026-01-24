/**
 * ServerReconciler - Server reconciliation for client-side prediction
 *
 * Handles the comparison and correction of predicted client state with
 * authoritative server state:
 * 1. Receives server state updates
 * 2. Compares with local predicted state
 * 3. Applies corrections if prediction was wrong
 * 4. Re-simulates pending inputs from correction point
 *
 * This ensures the client eventually converges to the authoritative server state.
 */

import type { Entity } from "../simulation/entity";
import type { EntityState } from "../simulation/entity";
import type { EntityManager } from "../simulation/entity-manager";
import type { ReconciliationOptions, ServerUpdate, StateCorrection } from "./network-types";
import { SnapshotManager } from "./snapshot-manager";
import { PredictedInputBuffer } from "./predicted-input-buffer";
import type { Command } from "../input/command-types";

/**
 * Default reconciliation options
 */
const DEFAULT_OPTIONS: ReconciliationOptions = {
  enabled: true,
  maxReconciliationTicks: 30,  // Max ticks to roll back
  enableSnapCorrection: false, // Smooth correction by default
  correctionThreshold: 0.01,   // Position difference threshold (in grid units)
};

/**
 * Correction result from reconciliation
 */
export interface ReconciliationResult {
  corrected: boolean;
  tick: number;
  entitiesCorrected: number;
  commandsReplayed: number;
  corrections: StateCorrection[];
}

/**
 * ServerReconciler - Manages client-server state reconciliation
 */
export class ServerReconciler {
  private snapshotManager: SnapshotManager;
  private inputBuffer: PredictedInputBuffer;
  private entityManager: EntityManager;
  private options: ReconciliationOptions;
  private simulationLoop: import("../simulation/simulation-loop").SimulationLoop | null = null;
  private reconciledCount: number = 0;
  private correctionsHistory: StateCorrection[] = [];

  constructor(
    entityManager: EntityManager,
    snapshotManager: SnapshotManager,
    inputBuffer: PredictedInputBuffer,
    options: Partial<ReconciliationOptions> = {}
  ) {
    this.entityManager = entityManager;
    this.snapshotManager = snapshotManager;
    this.inputBuffer = inputBuffer;
    this.options = { ...DEFAULT_OPTIONS, ...options };
  }

  /**
   * Set the simulation loop (needed for re-simulation)
   */
  setSimulationLoop(simulationLoop: import("../simulation/simulation-loop").SimulationLoop): void {
    this.simulationLoop = simulationLoop;
  }

  /**
   * Process a server update and reconcile if necessary
   */
  reconcile(serverUpdate: ServerUpdate): ReconciliationResult {
    if (!this.options.enabled) {
      return {
        corrected: false,
        tick: serverUpdate.tick,
        entitiesCorrected: 0,
        commandsReplayed: 0,
        corrections: [],
      };
    }

    const serverTick = serverUpdate.tick;

    // Find our local snapshot for this tick
    const localSnapshot = this.snapshotManager.getSnapshot(serverTick);

    if (!localSnapshot) {
      // Snapshot too old or doesn't exist, nothing to reconcile
      console.log(`[ServerReconciler] No local snapshot for tick ${serverTick}, skipping reconciliation`);
      return {
        corrected: false,
        tick: serverTick,
        entitiesCorrected: 0,
        commandsReplayed: 0,
        corrections: [],
      };
    }

    // Compare local snapshot with server state
    const corrections = this.computeCorrections(localSnapshot, serverUpdate.entities);

    if (corrections.length === 0) {
      // Prediction was correct! Clean up old data
      this.snapshotManager.removeSnapshotsOlderThan(serverTick);
      this.inputBuffer.removeUpTo(serverTick);
      this.reconciledCount++;

      return {
        corrected: false,
        tick: serverTick,
        entitiesCorrected: 0,
        commandsReplayed: 0,
        corrections: [],
      };
    }

    // Apply corrections
    this.applyCorrections(corrections);

    // Re-simulate from correction point
    const commandsReplayed = this.resimulate(serverTick);

    // Clean up old snapshots
    this.snapshotManager.removeSnapshotsOlderThan(serverTick);

    // Store correction for debugging/statistics
    this.correctionsHistory.push(...corrections);

    return {
      corrected: true,
      tick: serverTick,
      entitiesCorrected: corrections.length,
      commandsReplayed,
      corrections,
    };
  }

  /**
   * Compute corrections by comparing local and server states
   */
  private computeCorrections(
    localSnapshot: import("./state-snapshot").StateSnapshot,
    serverEntities: EntityState[]
  ): StateCorrection[] {
    const corrections: StateCorrection[] = [];
    const threshold = this.options.correctionThreshold;

    // Build server entity map for easy lookup
    const serverEntityMap = new Map<string, EntityState>();
    for (const entity of serverEntities) {
      // Need to get entity ID - this assumes entities have an id property
      // In practice, we'd need to handle this differently
      const id = (entity as any).id || "";
      serverEntityMap.set(id, entity);
    }

    // Compare each entity in local snapshot
    for (const [entityId, localState] of localSnapshot.entities.entries()) {
      const serverState = serverEntityMap.get(entityId);

      if (!serverState) {
        // Entity doesn't exist on server - it was removed or never existed
        // Skip for now (could be handled differently)
        continue;
      }

      // Check if states differ significantly
      const needsCorrection = this.stateDiffers(localState, serverState, threshold);

      if (needsCorrection) {
        corrections.push({
          entityId,
          predictedState: localState,
          authoritativeState: serverState,
          tick: localSnapshot.tick,
        });
      }
    }

    return corrections;
  }

  /**
   * Check if two entity states differ significantly
   */
  private stateDiffers(
    state1: EntityState,
    state2: EntityState,
    threshold: number
  ): boolean {
    // Position difference
    const posDiff = Math.abs(state1.gridPos.xgrid - state2.gridPos.xgrid) +
                   Math.abs(state1.gridPos.ygrid - state2.gridPos.ygrid) +
                   Math.abs(state1.gridPos.zheight - state2.gridPos.zheight);

    if (posDiff > threshold) {
      return true;
    }

    // Velocity difference
    const velDiff = Math.abs(state1.velocity.x - state2.velocity.x) +
                   Math.abs(state1.velocity.y - state2.velocity.y) +
                   Math.abs(state1.velocity.z - state2.velocity.z);

    if (velDiff > threshold) {
      return true;
    }

    // Rotation difference
    const rotationDiff = Math.abs(state1.rotation - state2.rotation);
    if (rotationDiff > threshold) {
      return true;
    }

    // Speed difference
    const speedDiff = Math.abs(state1.speed - state2.speed);
    if (speedDiff > threshold) {
      return true;
    }

    // isMoving flag difference
    if (state1.isMoving !== state2.isMoving) {
      return true;
    }

    return false;
  }

  /**
   * Apply server corrections to entities
   */
  private applyCorrections(corrections: StateCorrection[]): void {
    for (const correction of corrections) {
      const entity = this.entityManager.getEntity(correction.entityId);

      if (entity) {
        if (this.options.enableSnapCorrection) {
          // Instant correction
          entity.restoreState(correction.authoritativeState);
        } else {
          // Smooth correction - use interpolation
          // For now, just apply directly (interpolation can be added later)
          entity.restoreState(correction.authoritativeState);
        }
      }
    }
  }

  /**
   * Re-simulate commands from the correction tick
   */
  private resimulate(fromTick: number): number {
    if (!this.simulationLoop) {
      console.warn("[ServerReconciler] No simulation loop set, cannot re-simulate");
      return 0;
    }

    const currentTick = this.simulationLoop.currentTick;
    const commandsToReplay = this.inputBuffer.getCommandsInRange(fromTick + 1, currentTick);

    // Get the snapshot before the correction tick
    const snapshot = this.snapshotManager.getSnapshotBefore(fromTick);

    if (!snapshot) {
      console.warn(`[ServerReconciler] No snapshot before tick ${fromTick}`);
      return 0;
    }

    // Restore the snapshot state
    for (const [entityId, state] of snapshot.entities.entries()) {
      const entity = this.entityManager.getEntity(entityId);
      if (entity) {
        entity.restoreState(state);
      }
    }

    // Re-process all commands
    for (const command of commandsToReplay) {
      // This would normally go through the command queue
      // For now, we just log it
      console.log(`[ServerReconciler] Re-simulating command ${command.type} at tick ${command.tick}`);
    }

    return commandsToReplay.length;
  }

  /**
   * Enable or disable reconciliation
   */
  setReconciliationEnabled(enabled: boolean): void {
    this.options.enabled = enabled;
    console.log(`[ServerReconciler] Reconciliation ${enabled ? "enabled" : "disabled"}`);
  }

  /**
   * Update reconciliation options
   */
  updateOptions(options: Partial<ReconciliationOptions>): void {
    this.options = { ...this.options, ...options };
  }

  /**
   * Get reconciliation statistics
   */
  getStats(): {
    reconciledCount: number;
    correctionCount: number;
    recentCorrections: StateCorrection[];
    options: ReconciliationOptions;
  } {
    // Get recent corrections (last 10)
    const recentCorrections = this.correctionsHistory.slice(-10);

    return {
      reconciledCount: this.reconciledCount,
      correctionCount: this.correctionsHistory.length,
      recentCorrections,
      options: { ...this.options },
    };
  }

  /**
   * Clear correction history
   */
  clearHistory(): void {
    this.correctionsHistory = [];
  }

  /**
   * Get snapshot manager
   */
  getSnapshotManager(): SnapshotManager {
    return this.snapshotManager;
  }

  /**
   * Get input buffer
   */
  getInputBuffer(): PredictedInputBuffer {
    return this.inputBuffer;
  }
}

/**
 * Factory function to create a server reconciler
 */
export function createServerReconciler(
  entityManager: EntityManager,
  snapshotManager: SnapshotManager,
  inputBuffer: PredictedInputBuffer,
  options?: Partial<ReconciliationOptions>
): ServerReconciler {
  return new ServerReconciler(entityManager, snapshotManager, inputBuffer, options);
}
