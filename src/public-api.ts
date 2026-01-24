// Core graphics device
export { GraphicsDevice } from "./core/grahpic-device";

// Ticker system (unified game loop with fixed timestep)
export { Ticker } from "./core/ticker";
export type {
  TickerConfig,
  TickerState,
  TickerMetrics,
} from "./core/ticker-config";

// Interpolation utilities
export {
  lerp,
  lerpVec2,
  lerpVec3,
  lerpAngle,
  StateBuffer,
} from "./core/interpolation";

// Rendering context interface and Node.js implementation
export type {
  RenderingContext,
  RenderingContextOptions,
} from "./rendering/rendering-context";
export { NodeRenderingContext } from "./platforms/node/node-context";
export { RenderingContextFactory } from "./rendering/rendering-context-factory";

// SDL Window for Node.js platform
export { SDLWindow } from "./platforms/node/sdl-window";

// Shader abstraction
export { Shader } from "./core/shader";

// Texture management
export { Texture } from "./core/texture";
export type { ITexture } from "./core/texture";

// Sprite and atlas system
export {
  Sprite,
  TextureAtlas,
  AtlasLoader,
} from "./core/sprite-atlas";
export type {
  UVRect,
  PixelRect,
  SpriteInfo,
  AtlasOptions,
} from "./core/sprite-atlas";

// Texture loading (Node.js only)
export type {
  TextureLoadResult,
  TextureLoadOptions,
} from "./platforms/node/node-texture-loader";
export { NodeTextureLoader } from "./platforms/node/node-texture-loader";

// Buffer management
export { VertexBuffer, IndexBuffer } from "./core/buffer";

// Batch rendering
export { BatchRenderer, SpriteBatchRenderer, GPUBasedSpriteBatchRenderer } from "./rendering/batch-renderer";
export type { QuadInstance, SpriteQuadInstance } from "./rendering/batch-renderer";

// Vertex structures
export type { SpriteVertex } from "./rendering/vertex";

// Camera system
export { Camera, Matrix4 } from "./rendering/camera";

// Object pooling for performance optimization
export { ObjectPool } from "./core/object-pool";
export type { ObjectPoolConfig, PoolStats } from "./core/object-pool";

export { Matrix4Pool, getGlobalPool, setGlobalPool, resetGlobalPool } from "./core/matrix-pool";
export type { Matrix4PoolConfig } from "./core/matrix-pool";

// Projection system
export { ProjectionConfig } from "./rendering/projection";
export type { GridCoord, ScreenCoord, FractionalGridCoord } from "./rendering/projection";

// Resource loading (Node.js only)
export type {
  IResourceLoader,
  ResourceLoadResult,
  ResourceLoadOptions,
  BatchLoadResult,
} from "./core/resource-loader";
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

// Scene system
export type { VisualizationEntity } from "./scene/scene";

// Input system (Command Queue Pattern)
export {
  CommandQueue,
  InputSource,
  SDLInputSource,
  NetworkInputSource,
  createSDLInputSource,
  createNetworkInputSource,
  CommandType,
} from "./input";
export type {
  Direction,
  BaseCommand,
  MoveCommand,
  AttackCommand,
  SelectCommand,
  InteractCommand,
  Command,
  RawInputEvent,
  NormalizedCommand,
  InputSourceFactory,
  KeyMapping,
  SDLKeyboardEvent,
  SDLMouseEvent,
  NetworkCommand,
  WebSocketLike,
  NetworkInputSourceOptions,
} from "./input";

// Simulation system (pure game logic, zero rendering code)
export {
  Entity,
  EntityManager,
  SimulationLoop,
} from "./simulation";
export type {
  EntityState,
  EntityQuery,
  SimulationConfig,
} from "./simulation";
