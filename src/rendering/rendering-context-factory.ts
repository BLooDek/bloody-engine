import type {
  RenderingContext,
  RenderingContextOptions,
} from "../rendering/rendering-context";
import { NodeRenderingContext } from "../platforms/node/node-context";

/**
 * Factory for creating rendering contexts (Node.js only)
 */
export class RenderingContextFactory {
  /**
   * Detect if running in a browser environment
   * Always returns false for Node.js-only builds
   */
  static isBrowserEnvironment(): boolean {
    return false;
  }

  /**
   * Create a Node.js rendering context
   */
  static createContext(options: RenderingContextOptions): RenderingContext {
    return new NodeRenderingContext(options);
  }

  /**
   * Create a Node.js-specific rendering context
   */
  static createNodeContext(options: RenderingContextOptions): RenderingContext {
    return new NodeRenderingContext(options);
  }
}
