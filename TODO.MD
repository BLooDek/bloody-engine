Phase 1: Environment & Context Abstraction

Goal: Get a running WebGL context in Node.js using headless-gl.

    [x] Project Scaffold: Initialize a TypeScript project with Vite configured to output Node.js bundles.

    [x] Dependency Installation:

        Install gl (headless-gl) for Node.js rendering.

        Install pngjs for Node.js image decoding.

        Install @kmamal/sdl for window and input management.

    [x] Context Factory Implementation:

        Create a GraphicsDevice class.

        Implement environment detection for Node.js.

        Node Branch: Import gl and create a context with specific flags: require('gl')(width, height, { preserveDrawingBuffer: true }) (crucial for frame capturing).

        SDL Window: Create managed windows using @kmamal/sdl for interactive applications.

    [x] Context Interface Standardization: Define a TypeScript interface that unifies the rendering context, ensuring the engine core never references platform-specific properties directly.

Phase 2: The Graphics Abstraction Layer (GAL)

Goal: Abstract low-level WebGL calls so the engine doesn't need to worry about implementation details.

    [X] Shader Program Wrapper:

        Create a Shader class that handles compilation and linking.

        Task: Add automatic precision header injection (#ifdef GL_ES precision highp float; #endif) to handle differences between desktop OpenGL and mobile WebGL.

    [x] Resource Loader Abstraction:

        [x] Create IResourceLoader interface for shader source code

        [x] Implement NodeResourceLoader using fs.readFile

        [x] Handle asynchronous loading pipeline with Promise-based API

    [X] Buffer Manager:

        Create VertexBuffer and IndexBuffer classes.

        Implement methods to bind/unbind and upload data (gl.bufferData) using strict Float32Array / Uint16Array types.

    [x] Batch Renderer (V1):

        Implement a simple 2D batch renderer that can draw a single colored quad.

        Use a dynamic vertex buffer strategy (uploading vertices every frame) to allow for moving sprites.

    [x] Vertex Structure Definition (V2):

        [x] Define 2.5D sprite vertex structure: position (x, y, z), texture coordinates (u, v), color tint, texture index

        [x] Implement quad generation (2 triangles, 6 vertices) for each sprite

        [x] Add support for texture atlases (texture index for sprite selection)

Phase 3: The 2.5D Mathematical Core

Goal: Implement the projection math for isometric 2.5D rendering.

    [x] Projection Logic:

        [x] Implement the Grid-to-Screen function: xscreen=(xgridygrid)×(tileWidth/2) yscreen=(xgrid+ygrid)×(tileHeight/2)(zheight×scale)

        [x] Implement the Screen-to-Grid function (Mouse Picking): Invert the matrix to convert pixel coordinates back to fractional grid coordinates.

        [x] Round-trip validation: GridScreenGrid accuracy verified with 16 test cases (16/16 passing)

        [x] Mathematical documentation with derivations and edge cases

        [x] Practical examples for entity positioning, mouse picking, pathfinding

    [x] Camera System:

        [x] Create a Camera class holding x, y, and zoom.

        [x] Implement a View Matrix uniform to offset the global rendering position.

    [x] Shader-Based Transformation (GPU):

        [x] Implement vertex shader for 2.5D transformation (offload math from CPU)

        [x] Add a_gridPosition attribute (x, y, z) and a_texCoord attribute

        [x] Add u_tileSize and u_cameraOffset uniforms to vertex shader

        [x] Update batch renderer to use GPU transformation instead of CPU-based

Phase 4: Asset Pipeline

Goal: Load textures from disk in Node.js.

    [x] Texture Interface: Define an ITexture interface wrapping the raw WebGL texture handle and metadata (width/height).

    [x] Node.js Loader:

        Implement load(path) using fs.readFile and pngjs.

        Task: Manually flip the pixel buffer Y-axis (since UNPACK_FLIP_Y_WEBGL is often buggy/unsupported in headless implementations).

        Pass the raw buffer to texImage2D.

    [x] Sprite/Atlas System: Create a class to manage UV coordinates for individual sprites within a larger texture atlas.

Phase 5: The Game Loop & Input

Goal: Decouple simulation speed from rendering framerate.

    [X] Unified Ticker:

        Node: Implement a while loop using process.hrtime() and setImmediate (or a micro-sleep function) to maintain a fixed tick rate (e.g., 20 ticks/sec).

    [X] Command Queue Pattern:

        [X] Create a CommandQueue class.

        [X] Create abstract InputSource classes (e.g., KeyboardSource, NetworkSource).

        [X] Define abstract action types: MOVE_NORTH, MOVE_SOUTH, MOVE_EAST, MOVE_WEST, ATTACK, SELECT, INTERACT

        [X] Normalize inputs into abstract commands ({ type: "MOVE", dir: "N", tick: 100 })

        [X] Implement SDLInputSource for SDL-based keyboard/mouse events

        [X] Implement NetworkInputSource for WebSocket message deserialization

    [X] Simulation Loop:

        [X] Implement update(dt) that consumes the command queue and updates entity positions.

        [X] Ensure this logic contains zero rendering code.

    [ ] State Synchronization:

        [ ] Implement efficient state serialization (binary format preferred over JSON)

        [ ] Add state deserialization for loading/saving game state

        [ ] Implement client-side prediction: client processes inputs immediately

        [ ] Implement server reconciliation: client compares predicted state with authoritative server state

        [ ] Add state snapshot system for re-simulating inputs after correction

Phase 6: Depth Sorting (The "2.5D" Special Sauce)

Goal: Solve occlusion so things draw in the correct order.

    [X] Simple Y-Based Sorting (Fallback):

        [X] Implement basic Painter's Algorithm: SortKey = X_grid + Y_grid + Z_grid

        [X] Use for simple scenes without complex overlapping geometry

        [X] Serves as fast path for static/flat terrain

    [X] Spatial Hashing for Depth Sorting: Implemented a Grid-based spatial hash to quickly query "which objects are near object A".

    [X] Topological Sort Implementation:

        [X] Dependency Graph: Created DepthSorter class to build a directed graph every frame.

        [X] Overlap Test: Implemented the geometric check: Is Object A "behind" Object B? (Check grid X, Y, and Z bounds).

        [X] Graph Traversal: Implemented Kahn's Algorithm to linearize the graph into a draw list.

        [X] Cycle Breaking: Added a safeguard to detect circular dependencies (A > B > C > A) and forcibly break the chain using fallback sort to prevent infinite loops.

Phase 7: Verification & Testing

Goal: Prove the engine works without seeing it.

    [X] Visual Regression Test (Node):

        Write a script that initializes the engine, loads a map, renders one frame.

        Use gl.readPixels to extract the frame buffer.

        Save the buffer as output.png.

        Compare output.png against a known reference.png to auto-detect rendering bugs.

        Implementation: `test-visual.js` - Run with `npm run test:visual`
        - Initializes GraphicsDevice in headless mode
        - Creates test entities with isometric projection
        - Renders frame and captures RGBA pixel data
        - Saves as PNG using pngjs
        - Compares against reference.png with configurable tolerance
        - Generates diff.png when tests fail

    [X] Determinism Test:

        Run two instances of the SimulationLoop with the same input seed.

        Compare the state of all entities after 1000 ticks. They must match perfectly.

        Implementation: `test-determinism.js` - Run with `npm run test:determinism`
        - Implements seeded RNG (Mulberry32) for reproducible command generation
        - Runs two simulation instances with identical command sequences
        - Compares all entity states (position, velocity, rotation, speed, moving flag)
        - Generates detailed diff report when states don't match

Phase 8: Performance Optimization

Goal: Optimize for V8 engine characteristics and reduce GC pressure.

    [ ] Object Pooling System:

        [ ] Create object pool for Vector2/Vector3 objects (avoid new in render/update loops)

        [ ] Create object pool for Matrix objects

        [ ] Implement pool reuse pattern with acquire/release methods

        [ ] Pre-allocate pools based on expected max entity count

    [ ] Structure of Arrays (SoA):

        [ ] Refactor entity data from Array of Objects (AoS) to Structure of Arrays (SoA)

        [ ] Store positions in Float32Array (posX, posY, posZ)

        [ ] Store other entity properties in typed arrays (health, textureId, etc.)

        [ ] Ensure zero-overhead passing to WebGL buffers

    [ ] Spatial Hashing for Collision Detection:

        [ ] Implement spatial hash/grid separate from depth sorting system

        [ ] Create buckets (e.g., 64x64 grids) for entity storage

        [ ] Implement query system for same/adjacent bucket checks

        [ ] Optimize collision detection from O(N²) to O(N) average case

Phase 9: Advanced Rendering Features (Optional/Later)

    [ ] Instanced Rendering: Upgrade the Batch Renderer to use ANGLE_instanced_arrays for drawing thousands of floor tiles with a single draw call.

    [ ] Texture Atlasing Tool: Create a build script to pack individual sprite images into a single .png + .json atlas.

    [ ] Ray Casting for Picking: Implement 3D ray casting for accurate mouse picking with elevation support.

    [ ] Dynamic Lighting: Add support for dynamic light sources in the isometric world.
