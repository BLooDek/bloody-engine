/**
 * Collision System Performance Benchmarks
 *
 * Run with: node dist/benchmarks/collision-benchmark.js
 *
 * This benchmark compares the performance of different collision detection
 * strategies across various scenarios.
 */

import {
  SpatialHashCollision,
  WorkerCollision,
  GPUComputeCollision,
  HybridCollision,
  createCollisionSystem,
  CollisionPresets,
  type EntityHandle,
} from "../src/simulation/collision/index.js";

interface BenchmarkResult {
  name: string;
  entityCount: number;
  updateTime: number;
  collisionTime: number;
  totalTime: number;
  collisionPairs: number;
  memoryUsage: number;
}

interface BenchmarkScenario {
  name: string;
  entityCount: number;
  distribution: 'random' | 'grid' | 'clustered';
  worldSize: number;
}

/**
 * Generate test entities
 */
function generateEntities(
  count: number,
  distribution: 'random' | 'grid' | 'clustered',
  worldSize: number
): { entities: Map<string, EntityHandle>; positions: Float32Array; radii: Float32Array } {
  const entities = new Map<string, EntityHandle>();
  const positions = new Float32Array(count * 3);
  const radii = new Float32Array(count);

  for (let i = 0; i < count; i++) {
    const handle: EntityHandle = { index: i, generation: 1 };
    entities.set(`entity_${i}`, handle);

    let x: number, y: number;

    switch (distribution) {
      case 'random':
        x = Math.random() * worldSize - worldSize / 2;
        y = Math.random() * worldSize - worldSize / 2;
        break;

      case 'grid':
        const gridSize = Math.ceil(Math.sqrt(count));
        const cellSize = worldSize / gridSize;
        x = (i % gridSize) * cellSize - worldSize / 2;
        y = Math.floor(i / gridSize) * cellSize - worldSize / 2;
        break;

      case 'clustered':
        // Create 3 clusters
        const cluster = i % 3;
        const clusterX = [0, worldSize / 4, -worldSize / 4][cluster];
        const clusterY = [0, worldSize / 4, -worldSize / 4][cluster];
        x = clusterX + (Math.random() - 0.5) * worldSize / 10;
        y = clusterY + (Math.random() - 0.5) * worldSize / 10;
        break;
    }

    positions[i * 3] = x;
    positions[i * 3 + 1] = y;
    positions[i * 3 + 2] = 0;

    radii[i] = 5 + Math.random() * 10;
  }

  return { entities, positions, radii };
}

/**
 * Benchmark a single collision system
 */
async function benchmarkCollision(
  name: string,
  collisionSystem: any,
  scenario: BenchmarkScenario
): Promise<BenchmarkResult> {
  const { entities, positions, radii } = generateEntities(
    scenario.entityCount,
    scenario.distribution,
    scenario.worldSize
  );

  // Warmup
  collisionSystem.update(entities, positions);
  await collisionSystem.findAllCollisions(entities, positions, radii);

  // Benchmark
  const iterations = 10;
  const updateTimes: number[] = [];
  const collisionTimes: number[] = [];

  for (let i = 0; i < iterations; i++) {
    // Update benchmark
    const updateStart = performance.now();
    collisionSystem.update(entities, positions);
    const updateTime = performance.now() - updateStart;
    updateTimes.push(updateTime);

    // Collision detection benchmark
    const collisionStart = performance.now();
    const result = await collisionSystem.findAllCollisions(entities, positions, radii);
    const collisionTime = performance.now() - collisionStart;
    collisionTimes.push(collisionTime);

    // Clear cache if supported
    if (collisionSystem.clear) {
      collisionSystem.clear();
    }
  }

  const avgUpdateTime = updateTimes.reduce((a, b) => a + b, 0) / iterations;
  const avgCollisionTime = collisionTimes.reduce((a, b) => a + b, 0) / iterations;

  // Get final result for pair count
  collisionSystem.update(entities, positions);
  const finalResult = await collisionSystem.findAllCollisions(entities, positions, radii);

  return {
    name,
    entityCount: scenario.entityCount,
    updateTime: avgUpdateTime,
    collisionTime: avgCollisionTime,
    totalTime: avgUpdateTime + avgCollisionTime,
    collisionPairs: finalResult.pairs.length,
    memoryUsage: process.memoryUsage().heapUsed / 1024 / 1024,
  };
}

/**
 * Run all benchmarks
 */
async function runBenchmarks() {
  console.log('╔════════════════════════════════════════════════════════════════╗');
  console.log('║         Collision Detection Performance Benchmarks             ║');
  console.log('╚════════════════════════════════════════════════════════════════╝');
  console.log();

  const scenarios: BenchmarkScenario[] = [
    {
      name: 'Sparse Random (100 entities)',
      entityCount: 100,
      distribution: 'random',
      worldSize: 1000,
    },
    {
      name: 'Medium Random (1000 entities)',
      entityCount: 1000,
      distribution: 'random',
      worldSize: 1000,
    },
    {
      name: 'Dense Random (5000 entities)',
      entityCount: 5000,
      distribution: 'random',
      worldSize: 1000,
    },
    {
      name: 'Grid Layout (1000 entities)',
      entityCount: 1000,
      distribution: 'grid',
      worldSize: 1000,
    },
    {
      name: 'Clustered (1000 entities)',
      entityCount: 1000,
      distribution: 'clustered',
      worldSize: 1000,
    },
  ];

  const results: BenchmarkResult[] = [];

  for (const scenario of scenarios) {
    console.log(`\n📊 Scenario: ${scenario.name}`);
    console.log('━'.repeat(70));

    try {
      // Spatial Hash
      const spatialHash = new SpatialHashCollision({
        type: 'spatial-hash',
        cellSize: 50,
      });
      const spatialResult = await benchmarkCollision('Spatial Hash', spatialHash, scenario);
      results.push(spatialResult);

      console.log(`  ✓ Spatial Hash: ${spatialResult.totalTime.toFixed(2)}ms (${spatialResult.collisionPairs} pairs)`);

      // Worker
      try {
        const worker = new WorkerCollision({
          type: 'worker',
          workerCount: 4,
          cellSize: 50,
        });
        const workerResult = await benchmarkCollision('Worker (4 threads)', worker, scenario);
        results.push(workerResult);

        console.log(`  ✓ Worker (4): ${workerResult.totalTime.toFixed(2)}ms (${workerResult.collisionPairs} pairs)`);
      } catch (error) {
        console.log(`  ✗ Worker: Not available (${(error as Error).message})`);
      }

      // GPU
      try {
        const gpu = new GPUComputeCollision({
          type: 'gpu',
        });
        const gpuResult = await benchmarkCollision('GPU Compute', gpu, scenario);
        results.push(gpuResult);

        console.log(`  ✓ GPU: ${gpuResult.totalTime.toFixed(2)}ms (${gpuResult.collisionPairs} pairs)`);
      } catch (error) {
        console.log(`  ✗ GPU: Not available (${(error as Error).message})`);
      }

    } catch (error) {
      console.error(`  ✗ Error: ${(error as Error).message}`);
    }
  }

  // Summary
  console.log('\n\n╔════════════════════════════════════════════════════════════════╗');
  console.log('║                          Summary                               ║');
  console.log('╚════════════════════════════════════════════════════════════════╝\n');

  // Group by scenario
  const scenarioGroups = new Map<string, BenchmarkResult[]>();
  for (const result of results) {
    const scenarioName = scenarios.find(s => s.entityCount === result.entityCount && s.distribution !== undefined)?.name || 'Unknown';
    if (!scenarioGroups.has(scenarioName)) {
      scenarioGroups.set(scenarioName, []);
    }
    scenarioGroups.get(scenarioName)!.push(result);
  }

  for (const [scenarioName, scenarioResults] of scenarioGroups) {
    console.log(`\n${scenarioName}:`);
    console.log('  Method              | Update  | Collision | Total   | Pairs   | Memory');
    console.log('  '.padEnd(70, '─'));

    for (const result of scenarioResults) {
      const name = result.name.padEnd(20);
      const update = result.updateTime.toFixed(2).padStart(7);
      const collision = result.collisionTime.toFixed(2).padStart(9);
      const total = result.totalTime.toFixed(2).padStart(7);
      const pairs = result.collisionPairs.toString().padStart(7);
      const memory = `${result.memoryUsage.toFixed(1)}MB`.padStart(7);

      console.log(`  ${name} | ${update} | ${collision} | ${total} | ${pairs} | ${memory}`);
    }

    // Find fastest
    const fastest = scenarioResults.reduce((min, r) =>
      r.totalTime < min.totalTime ? r : min
    );
    console.log(`  ⚡ Fastest: ${fastest.name} (${fastest.totalTime.toFixed(2)}ms)`);
  }

  // Recommendations
  console.log('\n\n📋 Recommendations:');
  console.log('━'.repeat(70));

  for (const [scenarioName, scenarioResults] of scenarioGroups) {
    if (scenarioResults.length === 0) continue;

    const fastest = scenarioResults.reduce((min, r) =>
      r.totalTime < min.totalTime ? r : min
    );

    let recommendation = '';
    if (fastest.name.includes('Spatial Hash')) {
      recommendation = 'Use Spatial Hash for this scenario (best performance)';
    } else if (fastest.name.includes('Worker')) {
      recommendation = 'Use Worker-based parallelism for this scenario';
    } else if (fastest.name.includes('GPU')) {
      recommendation = 'Use GPU Compute for this scenario (best for large counts)';
    }

    console.log(`  ${scenarioName}: ${recommendation}`);
  }

  console.log('\n');
}

// Run benchmarks
runBenchmarks().catch(console.error);
