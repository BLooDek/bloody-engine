import type {
  RenderingContext,
  RenderingContextOptions,
} from "../rendering/rendering-context";
import { BrowserRenderingContext } from "../platforms/browser/browser-context";
import { NodeRenderingContext } from "../platforms/node/node-context";

/**
 * Factory for creating environment-appropriate rendering contexts
 * Abstracts environment detection from the application code
 */
export class RenderingContextFactory {
  /**
   * Detect if running in a browser environment
   */
  static isBrowserEnvironment(): boolean {
    return typeof window !== "undefined" && typeof document !== "undefined";
  }

  /**
   * Create a rendering context appropriate for the current environment
   */
  static createContext(options: RenderingContextOptions): RenderingContext {
    if (this.isBrowserEnvironment()) {
      return new BrowserRenderingContext(options);
    } else {
      return new NodeRenderingContext(options);
    }
  }

  /**
   * Create a browser-specific rendering context
   */
  static createBrowserContext(
    options: RenderingContextOptions,
  ): RenderingContext {
    return new BrowserRenderingContext(options);
  }

  /**
   * Create a Node.js-specific rendering context
   */
  static createNodeContext(options: RenderingContextOptions): RenderingContext {
    return new NodeRenderingContext(options);
  }
}
