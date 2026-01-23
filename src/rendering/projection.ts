/**
 * 2.5D Isometric Projection Mathematics
 *
 * Converts between grid coordinates (xgrid, ygrid, zheight) and screen coordinates (xscreen, yscreen).
 * This is the mathematical core for 2.5D rendering with isometric perspective.
 *
 * Coordinate Systems:
 * - Grid space: (xgrid, ygrid, zheight) - logical game world coordinates
 * - Screen space: (xscreen, yscreen) - pixel coordinates on display
 */

export interface GridCoord {
  xgrid: number;
  ygrid: number;
  zheight: number;
}

export interface ScreenCoord {
  xscreen: number;
  yscreen: number;
}

export interface FractionalGridCoord {
  xgrid: number;
  ygrid: number;
  zheight: number; // Can be fractional for picking
}

/**
 * Projection configuration for isometric view
 */
export class ProjectionConfig {
  readonly tileWidth: number;
  readonly tileHeight: number;
  readonly zScale: number; // Scale factor for height (vertical exaggeration)

  constructor(
    tileWidth: number = 64,
    tileHeight: number = 32,
    zScale: number = 1.0,
  ) {
    this.tileWidth = tileWidth;
    this.tileHeight = tileHeight;
    this.zScale = zScale;
  }
}

/**
 * Projects grid coordinates to screen coordinates using isometric projection.
 *
 * Formula:
 * xscreen = (xgrid - ygrid) × (tileWidth / 2)
 * yscreen = (xgrid + ygrid) × (tileHeight / 2) - (zheight × zScale)
 *
 * @param gridCoord Grid-space coordinate
 * @param config Projection configuration
 * @returns Screen-space coordinate in pixels
 */
export function gridToScreen(
  gridCoord: GridCoord,
  config: ProjectionConfig,
): ScreenCoord {
  const halfTileWidth = config.tileWidth / 2;
  const halfTileHeight = config.tileHeight / 2;

  const xscreen = (gridCoord.xgrid - gridCoord.ygrid) * halfTileWidth;
  const yscreen =
    (gridCoord.xgrid + gridCoord.ygrid) * halfTileHeight -
    gridCoord.zheight * config.zScale;

  return { xscreen, yscreen };
}

/**
 * Converts screen coordinates back to fractional grid coordinates.
 * This is the inverse transformation, used for mouse picking.
 *
 * The isometric projection matrix is:
 * [xscreen]   [tileWidth/2   -tileWidth/2 ] [xgrid]
 * [yscreen] = [tileHeight/2   tileHeight/2] [ygrid]  - [0, zheight * zScale]^T
 *
 * Inverting this 2x2 matrix:
 * A = [[tw/2, -tw/2], [th/2, th/2]]
 * det(A) = (tw/2)(th/2) - (-tw/2)(th/2) = tw*th/4 + tw*th/4 = tw*th/2
 *
 * A^-1 = (1 / det(A)) * [[th/2, tw/2], [-th/2, tw/2]]
 *      = (2 / (tw*th)) * [[th/2, tw/2], [-th/2, tw/2]]
 *      = [[1/tw, 1/th], [-1/tw, 1/th]]
 *
 * Therefore:
 * xgrid = (xscreen / (tileWidth/2) - yscreen / (tileHeight/2)) / 2
 * ygrid = (-xscreen / (tileWidth/2) + yscreen / (tileHeight/2)) / 2
 *
 * Simplified:
 * xgrid = xscreen / tileWidth + yscreen / tileHeight
 * ygrid = -xscreen / tileWidth + yscreen / tileHeight
 *
 * @param screenCoord Screen-space coordinate in pixels
 * @param config Projection configuration
 * @param zheight Optional height to add back to yscreen before inversion
 * @returns Fractional grid-space coordinate
 */
export function screenToGrid(
  screenCoord: ScreenCoord,
  config: ProjectionConfig,
  zheight: number = 0,
): FractionalGridCoord {
  // Adjust for height before inverting (add back the z-offset)
  const adjustedYscreen = screenCoord.yscreen + zheight * config.zScale;

  // Invert the projection matrix
  const xgrid =
    screenCoord.xscreen / (config.tileWidth / 2) +
    adjustedYscreen / (config.tileHeight / 2);
  const ygrid =
    -screenCoord.xscreen / (config.tileWidth / 2) +
    adjustedYscreen / (config.tileHeight / 2);

  return {
    xgrid: xgrid / 2,
    ygrid: ygrid / 2,
    zheight: zheight,
  };
}

/**
 * Converts screen coordinates to grid coordinates with automatic height detection.
 * Assumes zheight = 0 (picking at ground level).
 *
 * @param screenCoord Screen-space coordinate in pixels
 * @param config Projection configuration
 * @returns Grid-space coordinate at ground level (zheight = 0)
 */
export function screenToGridAtGroundLevel(
  screenCoord: ScreenCoord,
  config: ProjectionConfig,
): GridCoord {
  const fractional = screenToGrid(screenCoord, config, 0);
  return {
    xgrid: Math.round(fractional.xgrid),
    ygrid: Math.round(fractional.ygrid),
    zheight: 0,
  };
}

/**
 * Calculates the offset from a grid cell to the center of that cell in screen space.
 * Useful for positioning entities at cell centers.
 *
 * @param config Projection configuration
 * @returns Offset to cell center in screen coordinates
 */
export function getCellCenterOffset(config: ProjectionConfig): ScreenCoord {
  // A cell at (0, 0) projects to (0, 0)
  // A cell at (1, 0) projects to (tileWidth/2, tileHeight/2)
  // A cell at (0, 1) projects to (-tileWidth/2, tileHeight/2)
  // Center is at the average: (0, tileHeight/2)
  return {
    xscreen: 0,
    yscreen: config.tileHeight / 2,
  };
}

/**
 * Validates if a grid coordinate is within typical bounds.
 *
 * @param gridCoord Grid-space coordinate
 * @param maxGridSize Maximum size of grid (assumes square grid)
 * @returns True if coordinate is within bounds
 */
export function isGridCoordValid(
  gridCoord: GridCoord,
  maxGridSize: number = 1000,
): boolean {
  return (
    gridCoord.xgrid >= 0 &&
    gridCoord.xgrid < maxGridSize &&
    gridCoord.ygrid >= 0 &&
    gridCoord.ygrid < maxGridSize &&
    gridCoord.zheight >= 0
  );
}

/**
 * Creates a default projection configuration suitable for most 2.5D games.
 * Uses standard tile dimensions.
 *
 * @returns Default ProjectionConfig
 */
export function createDefaultProjection(): ProjectionConfig {
  return new ProjectionConfig(64, 32, 1.0);
}
