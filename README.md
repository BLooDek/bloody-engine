# Bloody Engine

A WebGL-based 2.5D graphics engine for isometric rendering on Node.js, written in TypeScript. Designed for server-side rendering and headless graphics processing.

## Features

- **2.5D Rendering** - Optimized for isometric and dimetric projections
- **Server-Side Rendering** - Headless WebGL rendering on Node.js using `gl` and `@kmamal/sdl`
- **Batch Rendering** - Efficient sprite batching with GPU-accelerated transformations
- **Resource Management** - Unified asset loading pipeline for textures and resources
- **TypeScript** - Fully typed for excellent developer experience
- **Depth Sorting** - Proper 2.5D occlusion handling
- **Window Management** - SDL-based window creation for interactive applications

## Installation

```bash
npm install bloody-engine
```

## Quick Start

```typescript
import { GraphicsDevice, Shader, Texture } from 'bloody-engine';

// Create a graphics device with SDL window
const device = new GraphicsDevice(800, 600);

// Get the WebGL context
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

// Create a texture from PNG
const { PNG } = require('pngjs');
const fs = require('fs/promises');
const pngData = await fs.readFile('texture.png');
const png = PNG.sync.read(pngData);
const texture = Texture.createFromPNG(gl, png);

// Render
device.clear({ r: 0.1, g: 0.1, b: 0.1, a: 1.0 });
shader.use();
// ... rendering code ...
device.present();

// For headless rendering, capture the output
const context = device.getRenderingContext();
const pixels = context.readPixels();
```

## Examples

### Sprite Batch Rendering

```typescript
import { SpriteBatchRenderer, Camera, Texture } from 'bloody-engine';

const batchRenderer = new SpriteBatchRenderer(gl, shader, 1000);
const camera = new Camera(0, 0, 1.0);

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

### Resource Loading

```typescript
import { NodeResourceLoader } from 'bloody-engine';

const loader = new NodeResourceLoader('./assets');

// Load a shader
const vertexSource = await loader.load('shaders/basic.vert');
const fragmentSource = await loader.load('shaders/basic.frag');

// Batch load multiple resources
const { succeeded, failed } = await loader.loadMultiple([
  'textures/sprite1.png',
  'textures/sprite2.png',
  'shaders/shader.vert'
]);
```

## Dependencies

- **gl** - Headless WebGL for Node.js
- **@kmamal/sdl** - SDL2 bindings for window and input management
- **pngjs** - PNG image decoding

## Documentation

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
