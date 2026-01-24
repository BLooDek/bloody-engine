/**
 * High-precision unified ticker system
 *
 * Decouples simulation speed from rendering framerate using:
 * - Fixed timestep simulation with accumulator pattern
 * - High-precision timing using performance.now()
 * - Spiral of death protection
 * - State interpolation for smooth rendering
 */

import type {
  TickerConfig,
  TickerState,
  TickerMetrics,
} from "./ticker-config.js";

export class Ticker {
  private config: TickerConfig;
  private state: TickerState;

  // Timing state
  private lastTime: number = 0;
  private fixedDeltaTime: number;
  private frameDeltaTime: number;

  // Performance tracking
  private metrics: TickerMetrics;
  private frameTimeHistory: number[] = [];
  private simTimeHistory: number[] = [];
  private renderTimeHistory: number[] = [];
  private readonly HISTORY_SIZE = 60;

  // Timing utilities
  private timingPrecision: "high" | "low";
  private now: () => number;

  constructor(config: TickerConfig) {
    this.config = config;
    this.fixedDeltaTime = 1.0 / config.tickRate;
    this.frameDeltaTime = config.maxFPS > 0 ? 1.0 / config.maxFPS : 0;

    // Initialize state
    this.state = {
      tickCount: 0,
      frameCount: 0,
      actualTickRate: config.tickRate,
      actualFPS: config.maxFPS || 0,
      accumulatedTime: 0,
      interpolationAlpha: 0,
      isRunning: false,
      elapsedTime: 0,
    };

    // Initialize metrics
    this.metrics = {
      avgFrameTime: 0,
      avgSimulationTime: 0,
      avgRenderTime: 0,
      simulationLoad: 0,
      renderLoad: 0,
      spiralOfDeathCount: 0,
    };

    // Detect and set timing precision
    this.timingPrecision = this.detectPrecision();
    this.now =
      this.timingPrecision === "high"
        ? () => performance.now() / 1000
        : () => Date.now() / 1000;
  }

  /**
   * Start the ticker loop
   */
  public start(): void {
    if (this.state.isRunning) {
      console.warn("Ticker is already running");
      return;
    }

    this.state.isRunning = true;
    this.lastTime = this.now();

    // Start the game loop
    if (typeof setImmediate !== "undefined") {
      setImmediate(() => this.tick());
    } else {
      setTimeout(() => this.tick(), 0);
    }
  }

  /**
   * Stop the ticker loop
   */
  public stop(): void {
    this.state.isRunning = false;
  }

  /**
   * Main ticker loop - implements accumulator pattern
   * @private
   */
  private tick(): void {
    if (!this.state.isRunning) {
      return;
    }

    const frameStartTime = this.now();

    try {
      // Calculate delta time
      const currentTime = this.now();
      let deltaTime = currentTime - this.lastTime;
      this.lastTime = currentTime;

      // Spiral of death protection
      if (deltaTime > this.config.maxAccumulatedTime) {
        deltaTime = this.config.maxAccumulatedTime;
        this.metrics.spiralOfDeathCount++;
      }

      // Accumulate time
      this.state.accumulatedTime += deltaTime;
      this.state.elapsedTime += deltaTime;

      // Process simulation updates (fixed timestep)
      const simStartTime = this.now();
      while (this.state.accumulatedTime >= this.fixedDeltaTime) {
        this.config.onSimulationUpdate(
          this.fixedDeltaTime,
          this.state.tickCount
        );
        this.state.accumulatedTime -= this.fixedDeltaTime;
        this.state.tickCount++;
      }
      const simEndTime = this.now();

      // Calculate interpolation alpha
      this.state.interpolationAlpha =
        this.state.accumulatedTime / this.fixedDeltaTime;

      // Render with interpolation
      const renderStartTime = this.now();
      this.config.onRender(
        this.config.interpolationEnabled ? this.state.interpolationAlpha : 0
      );
      const renderEndTime = this.now();

      this.state.frameCount++;

      // Update performance metrics
      this.updateMetrics(
        frameStartTime,
        simStartTime,
        simEndTime,
        renderStartTime,
        renderEndTime
      );
    } catch (error) {
      if (this.config.onError) {
        this.config.onError(error as Error);
      } else {
        console.error("Ticker error:", error);
        throw error;
      }
    }

    // Schedule next frame
    const frameEndTime = this.now();
    const frameTime = frameEndTime - frameStartTime;

    // Frame rate limiting for rendering
    if (this.frameDeltaTime > 0) {
      const sleepTime = this.frameDeltaTime - frameTime;
      if (sleepTime > 0) {
        setTimeout(() => this.tick(), sleepTime * 1000);
        return;
      }
    }

    // Use setImmediate for next frame (no delay)
    if (typeof setImmediate !== "undefined") {
      setImmediate(() => this.tick());
    } else {
      setTimeout(() => this.tick(), 0);
    }
  }

  /**
   * Update performance metrics
   * @private
   */
  private updateMetrics(
    frameStart: number,
    simStart: number,
    simEnd: number,
    renderStart: number,
    renderEnd: number
  ): void {
    const frameTime = (this.now() - frameStart) * 1000;
    const simTime = (simEnd - simStart) * 1000;
    const renderTime = (renderEnd - renderStart) * 1000;

    this.frameTimeHistory.push(frameTime);
    this.simTimeHistory.push(simTime);
    this.renderTimeHistory.push(renderTime);

    if (this.frameTimeHistory.length > this.HISTORY_SIZE) {
      this.frameTimeHistory.shift();
      this.simTimeHistory.shift();
      this.renderTimeHistory.shift();
    }

    // Calculate averages
    const avgFrame = this.average(this.frameTimeHistory);
    const avgSim = this.average(this.simTimeHistory);
    const avgRender = this.average(this.renderTimeHistory);

    this.metrics.avgFrameTime = avgFrame;
    this.metrics.avgSimulationTime = avgSim;
    this.metrics.avgRenderTime = avgRender;
    this.metrics.simulationLoad = avgFrame > 0 ? (avgSim / avgFrame) * 100 : 0;
    this.metrics.renderLoad = avgFrame > 0 ? (avgRender / avgFrame) * 100 : 0;

    // Update actual rates
    this.state.actualFPS = avgFrame > 0 ? 1000 / avgFrame : 0;
    this.state.actualTickRate = this.config.tickRate; // Fixed by design
  }

  /**
   * Get current ticker state
   */
  public getState(): Readonly<TickerState> {
    return this.state;
  }

  /**
   * Get performance metrics
   */
  public getMetrics(): Readonly<TickerMetrics> {
    return this.metrics;
  }

  /**
   * Update configuration at runtime
   * @param changes - Partial configuration changes to apply
   */
  public updateConfig(changes: Partial<TickerConfig>): void {
    Object.assign(this.config, changes);

    // Recalculate derived values
    this.fixedDeltaTime = 1.0 / this.config.tickRate;
    this.frameDeltaTime =
      this.config.maxFPS > 0 ? 1.0 / this.config.maxFPS : 0;
  }

  /**
   * Detect available timing precision
   * @private
   */
  private detectPrecision(): "high" | "low" {
    return typeof performance !== "undefined" &&
      typeof performance.now === "function"
      ? "high"
      : "low";
  }

  /**
   * Calculate average of array
   * @private
   */
  private average(arr: number[]): number {
    if (arr.length === 0) return 0;
    return arr.reduce((a, b) => a + b, 0) / arr.length;
  }
}
