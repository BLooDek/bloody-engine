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

// Resource loading
export type {
  IResourceLoader,
  ResourceLoadResult,
  ResourceLoadOptions,
  BatchLoadResult,
} from "./core/resource-loader";
export {
  BrowserResourceLoader,
} from "./platforms/browser/browser-resource-loader";
export { NodeResourceLoader } from "./platforms/node/node-resource-loader";
export {
  ResourceLoaderFactory,
  Environment,
  createResourceLoader,
} from "./core/resource-loader-factory";
export type { ResourceLoaderFactoryOptions } from "./core/resource-loader-factory";
export {
  ResourcePipeline,
  createResourcePipeline,
} from "./core/resource-pipeline";
export type {
  ShaderSource,
  NamedShaderSource,
  ResourcePipelineOptions,
} from "./core/resource-pipeline";

// Examples
export { runBrowserResourceLoaderDemo } from "./examples/resource-loader-demo";
