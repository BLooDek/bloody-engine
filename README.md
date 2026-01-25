# Bloody Engine

A WebGL-based 2.5D graphics engine for isometric rendering on Node.js, written in TypeScript. Designed for server-side rendering, headless graphics processing, and networked multiplayer games.

## Features

- **2.5D Rendering** - Optimized for isometric and dimetric projections with depth sorting
- **Server-Side Rendering** - Headless WebGL rendering on Node.js using `gl` and `@kmamal/sdl`
- **Batch Rendering** - Efficient sprite batching with GPU-accelerated transformations
- **Resource Management** - Unified asset loading pipeline for textures and shaders
- **Input System** - Command queue pattern supporting SDL and network input sources
- **Networking** - Client-side prediction, server reconciliation, and state synchronization
- **Simulation** - Pure game logic simulation system with entity management
- **Game Loop** - Fixed timestep ticker for deterministic game logic
- **TypeScript** - Fully typed for excellent developer experience
- **Object Pooling** - Memory-efficient object reuse patterns
- **Window Management** - SDL-based window creation for interactive applications

## Installation

```bash
npm install bloody-engine
```

## Understanding Coordinate Systems

**⚠️ IMPORTANT**: Before building your game, understand the coordinate systems to avoid inverted controls!

Bloody Engine uses different coordinate systems for different purposes. Mixing these up is the #1 cause of inverted controls.

### Quick Summary

| System | Used For | Y-Axis | Example |
|--------|----------|--------|---------|
| **Grid Space** | Game logic, entity positions | Y-UP (↓ Y = North/Up) | `entity.move(0, -1, 0)` moves up on screen |
| **Screen Space** | Rendering, camera, mouse | Y-DOWN (↓ Y = Down) | `camera.y += 10` moves camera down |

**Golden Rule**: Use grid space for game logic, transform to screen space only for rendering.

### Common Mistake

❌ **Wrong**: `camera.y += 1` for "up" movement (moves down on screen!)
✅ **Right**: Use direction deltas: `entity.move(0, -1, 0)` for North

### WASD Controls

| Key | Direction | Delta | Screen Effect |
|-----|-----------|-------|---------------|
| **W** / ↑ | North | `{dx: 0, dy: -1}` | ✅ Up |
| **S** / ↓ | South | `{dx: 0, dy: 1}` | ✅ Down |
| **A** / ← | West | `{dx: -1, dy: 0}` | ✅ Left |
| **D** / → | East | `{dx: 1, dy: 0}` | ✅ Right |

📖 **Full Guide**: [docs/COORDINATE_SYSTEMS.md](docs/COORDINATE_SYSTEMS.md)
🚀 **Interactive Demo**: Run `npm run demo:coordinates` after building

## API Overview

### Core Graphics

| Class | Description |
|-------|-------------|
| [GraphicsDevice](src/core/grahpic-device.ts) | Main graphics device with WebGL context management |
| [Shader](src/core/shader.ts) | Shader program compilation and uniform/attribute management |
| [Texture](src/core/texture.ts) | Texture creation, binding, and management |
| [VertexBuffer](src/core/buffer.ts) / [IndexBuffer](src/core/buffer.ts) | GPU buffer management for geometry |
| [Camera](src/rendering/camera.ts) | 2D camera with position, zoom, and view matrix |

### Rendering

| Class | Description |
|-------|-------------|
| [BatchRenderer](src/rendering/batch-renderer.ts) | Generic quad batch rendering |
| [SpriteBatchRenderer](src/rendering/batch-renderer.ts) | Sprite-specific batch renderer with depth sorting |
| [ProjectionConfig](src/rendering/projection.ts) | Isometric/dimetric projection utilities |
| [SpatialHash](src/rendering/spatial-hash.ts) | Spatial partitioning for efficient queries |

### Resource Loading

| Class | Description |
|-------|-------------|
| [NodeResourceLoader](src/platforms/node/node-resource-loader.ts) | File system resource loader for Node.js |
| [NodeTextureLoader](src/platforms/node/node-texture-loader.ts) | PNG texture loading for Node.js |
| [ResourcePipeline](src/core/resource-pipeline.ts) | Batch resource loading with caching |
| [TextureAtlas](src/core/sprite-atlas.ts) | Sprite atlas packing and UV coordinate management |

### Input System

| Class | Description |
|-------|-------------|
| [CommandQueue](src/input/command-queue.ts) | Thread-safe command queue for input |
| [SDLInputSource](src/input/sdl-input-source.ts) | SDL keyboard/mouse input |
| [NetworkInputSource](src/input/networking-input-source.ts) | Network-based input for multiplayer |

### Simulation & Networking

| Class | Description |
|-------|-------------|
| [Ticker](src/core/ticker.ts) | Fixed timestep game loop |
| [Entity](src/simulation/entity.ts) / [EntityManager](src/simulation/entity-manager.ts) | Entity component system |
| [SimulationLoop](src/simulation/simulation-loop.ts) | Deterministic game logic simulation |
| [ClientPredictor](src/networking/client-predictor.ts) | Client-side prediction for lag compensation |
| [ServerReconciler](src/networking/server-reconciler.ts) | Server-side reconciliation |
| [StateSnapshot](src/networking/state-snapshot.ts) | World state serialization |
| [BinarySerializer](src/networking/binary-serializer.ts) | Efficient binary serialization |

### Utilities

| Class | Description |
|-------|-------------|
| [ObjectPool](src/core/object-pool.ts) | Generic object pooling for GC optimization |
| [Matrix4Pool](src/core/matrix-pool.ts) | Matrix4 specific pooling |
| [lerp](src/core/interpolation.ts), [lerpVec2](src/core/interpolation.ts), [lerpVec3](src/core/interpolation.ts) | Interpolation utilities |

## Quick Start

### Basic Rendering Setup

```typescript
import { GraphicsDevice, Shader, Texture, VertexBuffer } from 'bloody-engine';

// Create graphics device (800x600)
const device = new GraphicsDevice(800, 600);
const gl = device.getGLContext();

// Create a shader
const shader = device.createShader(`
  attribute vec3 aPosition;
  uniform mat4 uMatrix;

  void main() {
    gl_Position = uMatrix * vec4(aPosition, 1.0);
  }
`, `
  precision mediump float;
  uniform vec3 uColor;

  void main() {
    gl_FragColor = vec4(uColor, 1.0);
  }
`);

// Create a gradient texture
const texture = Texture.createGradient(gl, 256, 256);

// Create geometry
const vertices = new Float32Array([
  // x, y, z, u, v
  -0.5, -0.5, 0, 0, 1,
   0.5, -0.5, 0, 1, 1,
   0.5,  0.5, 0, 1, 0,
  -0.5, -0.5, 0, 0, 1,
   0.5,  0.5, 0, 1, 0,
  -0.5,  0.5, 0, 0, 0
]);
const buffer = new VertexBuffer(gl, vertices, 20); // 5 floats * 4 bytes

// Setup and render
device.clear({ r: 0.1, g: 0.1, b: 0.1, a: 1.0 });
shader.use();
buffer.bind();
// ... configure attributes ...
gl.drawArrays(gl.TRIANGLES, 0, buffer.getVertexCount());
device.present();
```

### Sprite Batch Rendering with Camera

```typescript
import { SpriteBatchRenderer, Camera, Texture, GraphicsDevice } from 'bloody-engine';

const device = new GraphicsDevice(800, 600);
const gl = device.getGLContext();

// Create shader (use built-in V2 shader for sprites)
const shader = device.createShader(vertexSource, fragmentSource);

// Create sprite batch renderer (capacity: 1000 sprites)
const batchRenderer = new SpriteBatchRenderer(gl, shader, 1000);
batchRenderer.setTexture(Texture.createGradient(gl, 256, 256));

// Create camera
const camera = new Camera(0, 0, 1.0); // x=0, y=0, zoom=1x

// Add sprites to batch
batchRenderer.addQuad({
  x: 100, y: 100, z: 0,
  width: 64, height: 64,
  rotation: 0,
  color: { r: 1, g: 1, b: 1, a: 1 },
  texIndex: 0
});

// Render with camera
device.clear({ r: 0.1, g: 0.1, b: 0.1, a: 1.0 });
batchRenderer.render(camera);
device.present();
```

### Resource Loading

```typescript
import {
  ResourceLoaderFactory,
  createResourcePipeline,
  NodeTextureLoader
} from 'bloody-engine';

// Create resource pipeline
const pipeline = await createResourcePipeline({
  concurrency: 5,
  cache: true,
  baseDir: process.cwd()
});

// Load shaders
const shaders = await pipeline.loadShaders([
  { name: 'basic', vertex: 'shaders/basic.vert', fragment: 'shaders/basic.frag' }
]);

// Batch load resources
const { succeeded, failed } = await pipeline.loadMultiple([
  'textures/sprite1.png',
  'textures/sprite2.png'
]);

// Load texture from PNG
const textureLoader = new NodeTextureLoader();
const texture = await textureLoader.loadTexture(gl, 'textures/sprite.png');
```

### Game Loop with Fixed Timestep

```typescript
import { Ticker, type TickerConfig } from 'bloody-engine';

const config: TickerConfig = {
  targetFPS: 60,
  fixedDeltaTime: 1 / 60, // 60 physics updates per second
  maxFrameTime: 0.25 // Prevent spiral of death
};

const ticker = new Ticker(config);

ticker.start({
  update: (deltaTime) => {
    // Game logic update (fixed timestep)
    console.log(`Update: ${deltaTime.toFixed(3)}s`);
  },
  render: (interpolation) => {
    // Render with interpolation factor
    console.log(`Render: interpolation=${interpolation.toFixed(3)}`);
  }
});

// Get performance metrics
const metrics = ticker.getMetrics();
console.log(`FPS: ${metrics.fps}, Delta Time: ${metrics.deltaTime}s`);
```

### Entity System

```typescript
import { Entity, EntityManager, type EntityState } from 'bloody-engine';

// Create entity
const entity = new Entity({
  id: 'player-1',
  x: 0, y: 0, z: 0,
  rotation: 0,
  type: 'player',
  health: 100
});

// Create entity manager
const manager = new EntityManager();
manager.add(entity);

// Query entities
const players = manager.query({ type: 'player' });
const nearby = manager.queryInRegion(0, 0, 100);

// Update entity
entity.x += 10;
entity.updatedAt = Date.now();
manager.update(entity);
```

### Input System with Command Queue

```typescript
import {
  CommandQueue,
  SDLInputSource,
  createSDLInputSource,
  CommandType
} from 'bloody-engine';

// Create command queue
const queue = new CommandQueue();

// Create SDL input source (requires SDL window)
const sdlWindow = new SDLWindow(800, 600, 'Game');
const inputSource = createSDLInputSource(sdlWindow, {
  keyMapping: {
    moveUp: ['w', 'arrowup'],
    moveDown: ['s', 'arrowdown'],
    moveLeft: ['a', 'arrowleft'],
    moveRight: ['d', 'arrowright']
  }
});

// Process input in game loop
while (running) {
  // Collect input commands
  inputSource.update(queue);

  // Process commands
  while (queue.hasCommands()) {
    const command = queue.dequeue();
    switch (command.type) {
      case CommandType.Move:
        handleMove(command);
        break;
      case CommandType.Attack:
        handleAttack(command);
        break;
    }
  }
}
```

### Networking - Client-Side Prediction

```typescript
import {
  createClientPredictor,
  ClientPredictor,
  type ClientInputMessage
} from 'bloody-engine';

// Create predictor with config
const predictor = createClientPredictor({
  maxPredictedTicks: 100,
  reconciliationDelay: 100 // ms
});

// Client loop: send input
const onInput = (input: MoveCommand) => {
  const tick = currentTick;
  predictor.addLocalInput(tick, input);

  // Send to server
  socket.send(JSON.stringify({
    type: 'client_input',
    tick,
    input
  } as ClientInputMessage));
};

// Receive server update
const onServerUpdate = (message: ServerStateUpdateMessage) => {
  const result = predictor.reconcile(message);

  if (result.corrected) {
    console.log(`Reconciled: corrected=${result.corrected}, error=${result.error}`);
  }
};
```

### Object Pooling for Performance

```typescript
import { ObjectPool, type ObjectPoolConfig } from 'bloody-engine';

// Create pool for Vector3 objects
const pool = new ObjectPool<Vector3>({
  initialSize: 100,
  growthFactor: 2,
  factory: () => ({ x: 0, y: 0, z: 0 }),
  reset: (obj) => { obj.x = 0; obj.y = 0; obj.z = 0; }
});

// Acquire from pool
const vec = pool.acquire();
vec.x = 10; vec.y = 20; vec.z = 30;

// Return to pool when done
pool.release(vec);

// Get pool statistics
const stats = pool.getStats();
console.log(`Size: ${stats.size}, Active: ${stats.active}, Hits: ${stats.hits}`);
```

### Isometric Projection

```typescript
import { ProjectionConfig, gridToScreen, screenToGrid } from 'bloody-engine';

// Configure isometric projection
const config = new ProjectionConfig({
  tileWidth: 64,
  tileHeight: 32,
  angle: Math.PI / 6, // 30 degrees
  screenWidth: 800,
  screenHeight: 600
});

// Convert grid to screen coordinates
const gridPos = { xgrid: 5, ygrid: 3, zheight: 0 };
const screenPos = gridToScreen(gridPos, config);
console.log(`Screen: x=${screenPos.xscreen}, y=${screenPos.yscreen}`);

// Convert screen to grid coordinates
const gridPos2 = screenToGrid(screenPos, config);
```

### Texture Atlas for Sprite Sheets

```typescript
import { TextureAtlas, AtlasLoader } from 'bloody-engine';

// Load sprite atlas
const atlas = await AtlasLoader.loadFromJSON(gl, 'atlas.json');

// Get sprite info
const sprite = atlas.getSprite('player_idle_01');

// Use UV rect for rendering
batchRenderer.addQuad({
  x: 100, y: 100, z: 0,
  width: sprite.pixelRect.width,
  height: sprite.pixelRect.height,
  uvRect: sprite.uvRect
});
```

## Advanced Examples

### Networked Game Architecture

```typescript
import {
  SimulationLoop,
  Entity,
  ClientPredictor,
  ServerReconciler,
  StateSnapshot,
  Ticker
} from 'bloody-engine';

// Server-side simulation
const serverSim = new SimulationLoop({
  fixedDeltaTime: 1 / 60
});

// Client-side prediction
const clientPredictor = createClientPredictor({
  maxPredictedTicks: 100
});

// Server reconciliation
const serverReconciler = createServerReconciler({
  maxRewindTicks: 50
});

// Game loop on client
const ticker = new Ticker({ targetFPS: 60 });
ticker.start({
  update: (deltaTime) => {
    // 1. Collect input and send to server
    const input = collectInput();
    socket.send({ type: 'input', input, tick: currentTick });

    // 2. Predict locally
    clientPredictor.addLocalInput(currentTick, input);
    const predictedState = predictState();

    // 3. Handle server updates
    onServerUpdate = (update) => {
      clientPredictor.reconcile(update);
    };
  },
  render: (interpolation) => {
    renderGame(clientPredictor.getLatestState(), interpolation);
  }
});
```

### Deterministic Simulation Testing

```typescript
import { SimulationLoop, Entity } from 'bloody-engine';

// Create two simulations for testing determinism
const sim1 = new SimulationLoop({ fixedDeltaTime: 1 / 60, seed: 12345 });
const sim2 = new SimulationLoop({ fixedDeltaTime: 1 / 60, seed: 12345 });

// Add identical entities
sim1.addEntity(new Entity({ id: '1', x: 0, y: 0 }));
sim2.addEntity(new Entity({ id: '1', x: 0, y: 0 }));

// Run simulations
for (let i = 0; i < 1000; i++) {
  sim1.update(1 / 60);
  sim2.update(1 / 60);
}

// Verify determinism
const state1 = sim1.getStateSnapshot();
const state2 = sim2.getStateSnapshot();
console.log('Deterministic:', JSON.stringify(state1) === JSON.stringify(state2));
```

## Testing

The engine includes comprehensive tests for determinism and visual regression:

```bash
# Run all tests
npm test

# Run specific test suites
npm run test:determinism    # Test simulation determinism
npm run test:visual         # Visual regression tests
npm run test:state-sync     # State synchronization tests
npm run test:coverage       # Generate coverage report
```

## Dependencies

- **gl** - Headless WebGL for Node.js
- **@kmamal/sdl** - SDL2 bindings for window and input management
- **pngjs** - PNG image decoding

## Platform Support

| Platform | Status | Notes |
|----------|--------|-------|
| Node.js (Linux) | ✅ Full | Headless rendering + SDL window |
| Node.js (macOS) | ✅ Full | Headless rendering + SDL window |
| Node.js (Windows) | ✅ Full | Headless rendering + SDL window |
| Browser | ⚠️ Planned | WebGL rendering planned |

## Documentation

### Source Code Organization

```
src/
├── core/              # Core graphics and utilities
│   ├── grahpic-device.ts
│   ├── shader.ts
│   ├── texture.ts
│   ├── buffer.ts
│   ├── object-pool.ts
│   └── ticker.ts
├── rendering/         # Rendering systems
│   ├── batch-renderer.ts
│   ├── camera.ts
│   ├── projection.ts
│   └── spatial-hash.ts
├── input/             # Input system (command queue)
│   ├── command-queue.ts
│   ├── sdl-input-source.ts
│   └── network-input-source.ts
├── simulation/        # Game logic simulation
│   ├── entity.ts
│   ├── entity-manager.ts
│   └── simulation-loop.ts
├── networking/        # Networking for multiplayer
│   ├── client-predictor.ts
│   ├── server-reconciler.ts
│   ├── state-snapshot.ts
│   └── binary-serializer.ts
└── platforms/
    └── node/          # Node.js-specific implementations
        ├── node-context.ts
        ├── node-resource-loader.ts
        └── sdl-window.ts
```

### Key Concepts

- **Separation of Concerns**: Rendering, input, simulation, and networking are completely separate systems
- **Deterministic Simulation**: Game logic runs in fixed timestep for consistency across clients
- **Command Pattern**: All input goes through a command queue for easy recording/replay
- **Client-Side Prediction**: Reduces perceived lag in networked games
- **Object Pooling**: Minimizes garbage collection for smooth performance

For detailed documentation and architecture, see [docs/README.MD](docs/README.MD).

## Building

```bash
npm run build
```

This will generate the distribution files in `dist/node/`.

## License

MIT License - see [LICENSE](LICENSE) for details.

## Repository

[https://github.com/BLooDek/bloody-engine](https://github.com/BLooDek/bloody-engine)

## Issues

Report bugs and request features at: [https://github.com/BLooDek/bloody-engine/issues](https://github.com/BLooDek/bloody-engine/issues)
