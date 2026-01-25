# Collision Detection System

A high-performance, flexible collision detection system for the bloody-engine with multiple backend implementations.

## Features

- **Multiple Backends**: Spatial Hash (CPU), Worker-based (CPU), GPU Compute, and Hybrid auto-selection
- **Scalable**: Handles 10 to 10,000+ entities efficiently
- **Zero-Copy**: Leverages the engine's SoA (Structure of Arrays) architecture
- **Easy to Use**: Simple API with sensible defaults
- **Pluggable**: Switch between backends with one line of code

## Quick Start

```typescript
import { createCollisionSystem } from './collision';

// Create collision system (auto-selects best method)
const collision = createCollisionSystem();

// Update every frame after entity positions change
collision.update(entities, positions);

// Find all collisions
const result = await collision.findAllCollisions(entities, positions, radii);
console.log(`Found ${result.pairs.length} collisions in ${result.executionTime}ms`);

// Query entities within a radius
const nearby = collision.queryRadius(x, y, radius, entities, positions);
```

## Backends

### 1. Spatial Hash (CPU)

**Best for**: Sparse worlds, < 2000 entities

Uses spatial hashing for O(n) collision detection. Perfect for most games.

```typescript
const collision = createCollisionSystem({
  type: 'spatial-hash',
  cellSize: 50  // Should be >= max entity radius
});
```

**Performance**:
- 100 entities: ~0.1ms
- 1000 entities: ~1-5ms
- 5000 entities: ~20-50ms

### 2. Worker-Based (CPU)

**Best for**: Dense worlds, 1000-10000 entities

Uses Web Workers to parallelize collision detection across CPU cores.

```typescript
const collision = createCollisionSystem({
  type: 'worker',
  workerCount: 4,  // Number of worker threads
  cellSize: 50
});
```

**Performance**:
- 1000 entities: ~2ms
- 5000 entities: ~15ms
- 10000 entities: ~50ms

### 3. GPU Compute

**Best for**: Massive scale, 5000+ entities

Uses GPU compute shaders for massive parallelism. Requires WebGL 2.

```typescript
const collision = createCollisionSystem({
  type: 'gpu',
  maxDistance: 1000  // Maximum collision distance
});
```

**Performance**:
- 5000 entities: ~8ms
- 10000 entities: ~15ms
- 50000 entities: ~80ms

### 4. Hybrid (Recommended)

**Best for**: Unknown or varying entity counts

Automatically selects the optimal backend based on entity count.

```typescript
const collision = createCollisionSystem({
  type: 'hybrid',
  thresholds: {
    spatialToWorker: 2000,  // Switch to workers at 2000 entities
    workerToGPU: 5000       // Switch to GPU at 5000 entities
  }
});
```

## Presets

Quick configurations for common scenarios:

```typescript
import { CollisionPresets } from './collision';

// Small game (puzzle, platformer) - < 100 entities
const collision = createCollisionSystem(CollisionPresets.small);

// Medium game (strategy, RPG) - 100-2000 entities
const collision = createCollisionSystem(CollisionPresets.medium);

// Large game (RTS, moba) - 2000-5000 entities
const collision = createCollisionSystem(CollisionPresets.large);

// Massive game (particle system) - 5000+ entities
const collision = createCollisionSystem(CollisionPresets.massive);

// Auto (recommended)
const collision = createCollisionSystem(CollisionPresets.auto);
```

## API Reference

### `createCollisionSystem(config)`

Create a collision system instance.

**Parameters**:
- `config.type`: `'spatial-hash'` | `'worker'` | `'gpu'` | `'hybrid'`
- `config.cellSize`: Grid cell size (default: 50)
- `config.workerCount`: Number of worker threads (default: CPU cores)
- `config.maxDistance`: Maximum collision distance (default: 1000)

**Returns**: `CollisionSystem` instance

### `update(entities, positions)`

Update spatial partitioning after entity positions change.

**Parameters**:
- `entities`: `Map<string, EntityHandle>` - Entity lookup map
- `positions`: `Float32Array` - Entity positions (x, y, radius)

### `findCollisions(entity, allEntities, positions, radii?)`

Find all collisions for a single entity.

**Parameters**:
- `entity`: `EntityHandle` - Entity to check
- `allEntities`: `Map<string, EntityHandle>` - All entities
- `positions`: `Float32Array` - Entity positions
- `radii`: `Float32Array` - Entity radii (optional)

**Returns**: `CollisionPair[]`

### `findAllCollisions(entities, positions, radii?)`

Find all collision pairs in the scene.

**Parameters**:
- `entities`: `Map<string, EntityHandle>` - All entities
- `positions`: `Float32Array` - Entity positions
- `radii`: `Float32Array` - Entity radii (optional)

**Returns**: `Promise<CollisionResult>`

```typescript
interface CollisionResult {
  pairs: CollisionPair[];      // All collision pairs
  checkedCount: number;        // Number of pair checks performed
  executionTime: number;       // Execution time in ms
  executionMethod?: string;    // Method used (hybrid only)
}
```

### `queryRadius(x, y, radius, entities, positions)`

Query all entities within a radius.

**Parameters**:
- `x`, `y`: `number` - Query center
- `radius`: `number` - Query radius
- `entities`: `Map<string, EntityHandle>` - All entities
- `positions`: `Float32Array` - Entity positions

**Returns**: `EntityHandle[]`

## Integration with Engine

### With EntityManager

```typescript
import { EntityManager } from './entity-manager';
import { createCollisionSystem } from './collision';

class Game {
  private entityManager = new EntityManager();
  private collision = createCollisionSystem({ type: 'hybrid' });

  update(dt: number) {
    // Update entity positions
    this.entityManager.update(dt);

    // Update collision system
    const entities = this.entityManager.getAllEntities();
    const positions = this.entityManager.getPositions();
    this.collision.update(entities, positions);

    // Check collisions
    const result = await this.collision.findAllCollisions(
      entities,
      positions,
      this.entityManager.getRadii()
    );

    // Handle collisions
    for (const pair of result.pairs) {
      this.handleCollision(pair.entityA, pair.entityB);
    }
  }
}
```

### Performance Tips

1. **Use the hybrid backend** for most games - it auto-selects the best method
2. **Adjust cell size** based on your entity sizes (should be >= max radius)
3. **Re-use collision systems** - creating new ones is expensive
4. **Update only when needed** - only call `update()` after positions change
5. **Profile first** - use the benchmark to find the best backend for your game

## Benchmarking

Run the included benchmark to compare performance:

```bash
npm run build
node dist/benchmarks/collision-benchmark.js
```

Example output:
```
Scenario: Medium Random (1000 entities)
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  ✓ Spatial Hash: 3.45ms (234 pairs)
  ✓ Worker (4): 2.12ms (234 pairs)
  ✗ GPU: Not available
```

## Testing

Run tests with:

```bash
npm test
```

## License

MIT
