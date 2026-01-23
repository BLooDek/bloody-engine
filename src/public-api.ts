// Core graphics device
export { GraphicsDevice } from "./core/grahpic-device";

// Rendering context interface and implementations
export type {
  RenderingContext,
  RenderingContextOptions,
} from "./rendering/rendering-context";
export { BrowserRenderingContext } from "./platforms/browser/browser-context";
export { NodeRenderingContext } from "./platforms/node/node-context";
export { RenderingContextFactory } from "./rendering/rendering-context-factory";

// Shader abstraction
export { Shader } from "./core/shader";

// Texture management
export { Texture } from "./core/texture";

// Buffer management
export { VertexBuffer, IndexBuffer } from "./core/buffer";
// Batch rendering
export { BatchRenderer } from "./rendering/batch-renderer";
export type { QuadInstance } from "./rendering/batch-renderer";
