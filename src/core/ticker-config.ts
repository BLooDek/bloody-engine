/**
 * Configuration options for the Ticker system
 */
export interface TickerConfig {
  /** Fixed simulation tick rate in Hz (ticks per second). Default: 20 */
  tickRate: number;

  /** Maximum frames per second for rendering (0 = uncapped). Default: 0 */
  maxFPS: number;

  /** Enable adaptive frame skipping for slow systems. Default: true */
  adaptiveFrameSkip: boolean;

  /** Maximum accumulated time before spiral of death protection kicks in. Default: 1.0 second */
  maxAccumulatedTime: number;

  /** Enable interpolation between simulation states. Default: true */
  interpolationEnabled: boolean;

  /** Callback for simulation updates (fixed timestep) */
  onSimulationUpdate: (dt: number, tick: number) => void;

  /** Callback for rendering (variable timestep) */
  onRender: (interpolationAlpha: number) => void;

  /** Callback for ticker errors */
  onError?: (error: Error) => void;
}

/**
 * Ticker state and statistics
 */
export interface TickerState {
  /** Current tick count (total simulation updates performed) */
  tickCount: number;

  /** Current frame count (total renders performed) */
  frameCount: number;

  /** Actual simulation tick rate (measured) */
  actualTickRate: number;

  /** Actual frame rate (measured) */
  actualFPS: number;

  /** Current accumulated time in seconds */
  accumulatedTime: number;

  /** Interpolation alpha (0-1) for current render frame */
  interpolationAlpha: number;

  /** Whether ticker is currently running */
  isRunning: boolean;

  /** Total time elapsed since ticker start (seconds) */
  elapsedTime: number;
}

/**
 * Ticker metrics for performance monitoring
 */
export interface TickerMetrics {
  /** Average frame time in milliseconds */
  avgFrameTime: number;

  /** Average simulation time in milliseconds */
  avgSimulationTime: number;

  /** Average render time in milliseconds */
  avgRenderTime: number;

  /** Percentage of time spent in simulation */
  simulationLoad: number;

  /** Percentage of time spent in rendering */
  renderLoad: number;

  /** Number of spiral of death protection triggers */
  spiralOfDeathCount: number;
}
