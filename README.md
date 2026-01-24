# Bloody Engine

A WebGL-based 2.5D graphics engine for isometric rendering, written in TypeScript. Designed for both browser and Node.js environments with full isomorphic support.

## Features

- **2.5D Rendering** - Optimized for isometric and dimetric projections
- **Cross-Platform** - Works in browsers and Node.js (headless rendering)
- **Batch Rendering** - Efficient sprite batching with GPU-accelerated transformations
- **Resource Management** - Unified asset loading pipeline for textures and resources
- **TypeScript** - Fully typed for excellent developer experience
- **Depth Sorting** - Proper 2.5D occlusion handling

## Installation

```bash
npm install bloody-engine
```

## Quick Start

### Browser

```typescript
import { BloodyEngine } from 'bloody-engine';

// Initialize engine
const engine = new BloodyEngine({
  width: 800,
  height: 600
});

// Start rendering loop
engine.start();
```

### Node.js

```typescript
import { BloodyEngine } from 'bloody-engine';

// Initialize engine for headless rendering
const engine = new BloodyEngine({
  width: 800,
  height: 600,
  headless: true
});

// Render and capture output
engine.renderFrame();
const pixels = engine.getPixels();
```

## Documentation

For detailed documentation and architecture, see [docs/README.MD](docs/README.MD).

## Examples

```typescript
// Create a sprite batch renderer
import { SpriteBatchRenderer, Texture } from 'bloody-engine';

const batchRenderer = new SpriteBatchRenderer(gl, shader);

// Add sprites
batchRenderer.addQuad({
  x: 100,
  y: 100,
  z: 0,
  width: 64,
  height: 64,
  rotation: 0,
  color: { r: 1, g: 1, b: 1, a: 1 },
  uvRect: { uMin: 0, vMin: 0, uMax: 1, vMax: 1 }
});

// Render
batchRenderer.render(camera);
```

## License

MIT License - see [LICENSE](LICENSE) for details.

## Repository

[https://github.com/BLooDek/bloody-engine](https://github.com/BLooDek/bloody-engine)

## Issues

Report bugs and request features at: [https://github.com/BLooDek/bloody-engine/issues](https://github.com/BLooDek/bloody-engine/issues)
