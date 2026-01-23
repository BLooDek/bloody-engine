/**
 * 2.5D Projection System - Practical Examples
 *
 * This file demonstrates how to use the grid-to-screen and screen-to-grid
 * transformations in a real game scenario.
 */

import {
  gridToScreen,
  screenToGrid,
  screenToGridAtGroundLevel,
  getCellCenterOffset,
  ProjectionConfig,
  createDefaultProjection,
  type GridCoord,
  type ScreenCoord,
} from "../rendering/projection";

// ============================================================================
// Example 1: Setting up a Game World
// ============================================================================

/**
 * Initialize the projection system with game-specific settings
 */
export function initializeGameProjection(): ProjectionConfig {
  // Create a standard isometric view
  // Each tile is 64 pixels wide, 32 pixels tall
  // Elevation is emphasized at 1:1 scale
  const projection = createDefaultProjection();

  console.log("✓ Game projection initialized:");
  console.log(
    `  Tile dimensions: ${projection.tileWidth}x${projection.tileHeight}`,
  );
  console.log(`  Height scale: ${projection.zScale}`);

  return projection;
}

// ============================================================================
// Example 2: Rendering a Game Entity
// ============================================================================

/**
 * Entity in the game world with position and height
 */
interface GameEntity {
  id: string;
  name: string;
  gridPos: GridCoord;
  screenPos?: ScreenCoord;
}

/**
 * Update an entity's screen position based on its grid position
 */
export function updateEntityScreenPosition(
  entity: GameEntity,
  projection: ProjectionConfig,
): void {
  // Project grid coordinates to screen coordinates
  const screenPos = gridToScreen(entity.gridPos, projection);

  // Optionally center the sprite on the tile
  const cellCenter = getCellCenterOffset(projection);
  entity.screenPos = {
    xscreen: screenPos.xscreen + cellCenter.xscreen,
    yscreen: screenPos.yscreen + cellCenter.yscreen,
  };

  console.log(
    `✓ ${entity.name} at grid (${entity.gridPos.xgrid}, ${entity.gridPos.ygrid}, ${entity.gridPos.zheight}) → screen (${entity.screenPos.xscreen}, ${entity.screenPos.yscreen})`,
  );
}

/**
 * Create a game entity at a grid position
 */
export function createEntity(
  id: string,
  name: string,
  gridPos: GridCoord,
  projection: ProjectionConfig,
): GameEntity {
  const entity: GameEntity = { id, name, gridPos };
  updateEntityScreenPosition(entity, projection);
  return entity;
}

// ============================================================================
// Example 3: Mouse Picking - Select Unit
// ============================================================================

/**
 * Handle mouse click event to select a game entity
 * Returns the grid cell that was clicked
 */
export function handleMouseClick(
  event: MouseEvent,
  canvas: HTMLCanvasElement,
  projection: ProjectionConfig,
): GridCoord {
  // Get canvas position relative to viewport
  const canvasRect = canvas.getBoundingClientRect();

  // Convert mouse coordinates to canvas coordinates
  const screenCoord: ScreenCoord = {
    xscreen: event.clientX - canvasRect.left,
    yscreen: event.clientY - canvasRect.top,
  };

  // Convert screen coordinates to grid coordinates (at ground level)
  const gridCoord = screenToGridAtGroundLevel(screenCoord, projection);

  console.log(
    `✓ Mouse click at screen (${screenCoord.xscreen}, ${screenCoord.yscreen}) → grid (${gridCoord.xgrid}, ${gridCoord.ygrid})`,
  );

  return gridCoord;
}

// ============================================================================
// Example 4: Path Finding - Calculate Distance
// ============================================================================

/**
 * Calculate Manhattan distance between two grid positions
 * Ignores height differences (for ground-level pathfinding)
 */
export function calculateGridDistance(from: GridCoord, to: GridCoord): number {
  return Math.abs(to.xgrid - from.xgrid) + Math.abs(to.ygrid - from.ygrid);
}

/**
 * Calculate 3D Euclidean distance considering height
 * Useful for flying units or elevation-aware costs
 */
export function calculate3DDistance(from: GridCoord, to: GridCoord): number {
  const dx = to.xgrid - from.xgrid;
  const dy = to.ygrid - from.ygrid;
  const dz = to.zheight - from.zheight;

  return Math.sqrt(dx * dx + dy * dy + dz * dz);
}

/**
 * Move an entity towards a target position
 */
export function moveEntityTowards(
  entity: GameEntity,
  target: GridCoord,
  projection: ProjectionConfig,
): void {
  const dx = Math.sign(target.xgrid - entity.gridPos.xgrid);
  const dy = Math.sign(target.ygrid - entity.gridPos.ygrid);

  // Move one step closer
  if (dx !== 0) entity.gridPos.xgrid += dx;
  if (dy !== 0) entity.gridPos.ygrid += dy;

  // Update screen position
  updateEntityScreenPosition(entity, projection);

  const distance = calculateGridDistance(entity.gridPos, target);
  console.log(`✓ ${entity.name} moved, distance to target: ${distance} cells`);
}

// ============================================================================
// Example 5: Depth Sorting - Render Order
// ============================================================================

/**
 * Calculate render priority based on grid position
 * In isometric view, objects further "back" should render first
 *
 * The render priority is based on the sum of grid coordinates
 * This ensures proper depth sorting for non-overlapping isometric tiles
 */
export function calculateRenderPriority(gridCoord: GridCoord): number {
  // Higher values render later (on top)
  // Negative x pushes back, positive y pushes back
  return gridCoord.xgrid + gridCoord.ygrid;
}

/**
 * Sort entities by render priority
 */
export function sortEntitiesByDepth(entities: GameEntity[]): GameEntity[] {
  return [...entities].sort(
    (a, b) =>
      calculateRenderPriority(a.gridPos) - calculateRenderPriority(b.gridPos),
  );
}

// ============================================================================
// Example 6: Terrain Height Map Integration
// ============================================================================

/**
 * Simple height map - returns terrain height at a grid position
 */
type TerrainHeightMap = (x: number, y: number) => number;

/**
 * Create a simple height map function
 */
export function createTerrainHeightMap(): TerrainHeightMap {
  return (x: number, y: number): number => {
    // Example: Create a hill in the center
    const centerX = 10;
    const centerY = 10;
    const radius = 5;
    const distance = Math.sqrt((x - centerX) ** 2 + (y - centerY) ** 2);

    if (distance < radius) {
      return Math.max(0, 5 * (1 - distance / radius));
    }
    return 0;
  };
}

/**
 * Position an entity on terrain (automatically set height)
 */
export function placeEntityOnTerrain(
  entity: GameEntity,
  heightMap: TerrainHeightMap,
  projection: ProjectionConfig,
): void {
  // Get terrain height at this position
  entity.gridPos.zheight = heightMap(
    entity.gridPos.xgrid,
    entity.gridPos.ygrid,
  );

  // Update screen position to account for new height
  updateEntityScreenPosition(entity, projection);

  console.log(
    `✓ ${entity.name} placed on terrain at height ${entity.gridPos.zheight}`,
  );
}

// ============================================================================
// Example 7: Camera and View Management
// ============================================================================

/**
 * Game camera with grid-based positioning
 */
export interface Camera {
  center: GridCoord;
  viewWidth: number;
  viewHeight: number;
}

/**
 * Create a camera centered on a grid position
 */
export function createCamera(
  centerGrid: GridCoord,
  viewWidthPixels: number,
  viewHeightPixels: number,
  projection: ProjectionConfig,
): Camera {
  return {
    center: centerGrid,
    viewWidth: viewWidthPixels,
    viewHeight: viewHeightPixels,
  };
}

/**
 * Check if an entity is within camera view
 */
export function isEntityInView(
  entity: GameEntity,
  camera: Camera,
  projection: ProjectionConfig,
  margin: number = 50,
): boolean {
  if (!entity.screenPos) return false;

  const cameraScreen = gridToScreen(camera.center, projection);

  const halfWidth = camera.viewWidth / 2 + margin;
  const halfHeight = camera.viewHeight / 2 + margin;

  return (
    Math.abs(entity.screenPos.xscreen - cameraScreen.xscreen) < halfWidth &&
    Math.abs(entity.screenPos.yscreen - cameraScreen.yscreen) < halfHeight
  );
}

// ============================================================================
// Example 8: Demonstration/Test Scenario
// ============================================================================

/**
 * Run a complete example scenario
 */
export function runExampleScenario(): void {
  console.log("\n" + "=".repeat(60));
  console.log("🎮 2.5D Projection System - Example Scenario");
  console.log("=".repeat(60));

  // Initialize
  const projection = initializeGameProjection();

  // Create some entities
  console.log("\n📍 Creating game entities:");
  const player = createEntity(
    "player",
    "Player",
    { xgrid: 5, ygrid: 5, zheight: 0 },
    projection,
  );
  const enemy = createEntity(
    "enemy1",
    "Enemy",
    { xgrid: 10, ygrid: 8, zheight: 0 },
    projection,
  );
  const chest = createEntity(
    "chest1",
    "Treasure Chest",
    { xgrid: 8, ygrid: 6, zheight: 0 },
    projection,
  );

  // Move player towards chest
  console.log("\n🚶 Movement example:");
  for (let i = 0; i < 3; i++) {
    moveEntityTowards(player, chest.gridPos, projection);
  }

  // Distance calculations
  console.log("\n📏 Distance calculations:");
  const dist = calculateGridDistance(player.gridPos, enemy.gridPos);
  const dist3d = calculate3DDistance(player.gridPos, enemy.gridPos);
  console.log(`  Manhattan distance: ${dist} cells`);
  console.log(`  3D distance: ${dist3d.toFixed(2)} units`);

  // Render priority
  console.log("\n🎨 Render order (depth sorting):");
  const entities = [player, enemy, chest];
  const sorted = sortEntitiesByDepth(entities);
  sorted.forEach((e, i) => {
    console.log(
      `  ${i + 1}. ${e.name} (priority: ${calculateRenderPriority(e.gridPos)})`,
    );
  });

  // Terrain height
  console.log("\n🏔️  Terrain integration:");
  const heightMap = createTerrainHeightMap();
  placeEntityOnTerrain(enemy, heightMap, projection);

  // Camera
  console.log("\n📷 Camera example:");
  const camera = createCamera(player.gridPos, 800, 600, projection);
  console.log(
    `  Camera centered at grid (${camera.center.xgrid}, ${camera.center.ygrid})`,
  );
  console.log(`  View size: ${camera.viewWidth}x${camera.viewHeight} pixels`);
  console.log(
    `  Player in view: ${isEntityInView(player, camera, projection)}`,
  );
  console.log(`  Enemy in view: ${isEntityInView(enemy, camera, projection)}`);

  console.log("\n" + "=".repeat(60));
}
