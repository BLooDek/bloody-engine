/**
 * Tests for 2.5D Isometric Projection Mathematics
 */

import {
  gridToScreen,
  screenToGrid,
  screenToGridAtGroundLevel,
  getCellCenterOffset,
  isGridCoordValid,
  createDefaultProjection,
  ProjectionConfig,
  type GridCoord,
  type ScreenCoord,
} from "./rendering/projection";

// Test configuration
const testConfig = new ProjectionConfig(64, 32, 1.0);

/**
 * Helper to compare floating point numbers with tolerance
 */
function almostEqual(
  a: number,
  b: number,
  tolerance: number = 0.0001,
): boolean {
  return Math.abs(a - b) < tolerance;
}

/**
 * Helper to print test results
 */
function testResult(name: string, passed: boolean, details?: string): void {
  const status = passed ? "✓" : "✗";
  console.log(`${status} ${name}${details ? ` - ${details}` : ""}`);
}

// ============================================================================
// Test Suite: Basic Grid-to-Screen Projections
// ============================================================================

console.log("\n📐 Grid-to-Screen Projection Tests:");
console.log("=====================================");

// Test 1: Origin projection
const origin: GridCoord = { xgrid: 0, ygrid: 0, zheight: 0 };
const originScreen = gridToScreen(origin, testConfig);
testResult(
  "Origin (0,0,0) projects to (0,0)",
  almostEqual(originScreen.xscreen, 0) && almostEqual(originScreen.yscreen, 0),
  `Got (${originScreen.xscreen}, ${originScreen.yscreen})`,
);

// Test 2: East direction (positive xgrid)
const east: GridCoord = { xgrid: 1, ygrid: 0, zheight: 0 };
const eastScreen = gridToScreen(east, testConfig);
const expectedEastX = (1 - 0) * (testConfig.tileWidth / 2);
const expectedEastY = (1 + 0) * (testConfig.tileHeight / 2);
testResult(
  "East (1,0,0) projects correctly",
  almostEqual(eastScreen.xscreen, expectedEastX) &&
    almostEqual(eastScreen.yscreen, expectedEastY),
  `Expected (${expectedEastX}, ${expectedEastY}), got (${eastScreen.xscreen}, ${eastScreen.yscreen})`,
);

// Test 3: South direction (positive ygrid)
const south: GridCoord = { xgrid: 0, ygrid: 1, zheight: 0 };
const southScreen = gridToScreen(south, testConfig);
const expectedSouthX = (0 - 1) * (testConfig.tileWidth / 2);
const expectedSouthY = (0 + 1) * (testConfig.tileHeight / 2);
testResult(
  "South (0,1,0) projects correctly",
  almostEqual(southScreen.xscreen, expectedSouthX) &&
    almostEqual(southScreen.yscreen, expectedSouthY),
  `Expected (${expectedSouthX}, ${expectedSouthY}), got (${southScreen.xscreen}, ${southScreen.yscreen})`,
);

// Test 4: Height projection
const elevated: GridCoord = { xgrid: 0, ygrid: 0, zheight: 10 };
const elevatedScreen = gridToScreen(elevated, testConfig);
testResult(
  "Height (0,0,10) reduces yscreen",
  almostEqual(elevatedScreen.xscreen, 0) &&
    almostEqual(elevatedScreen.yscreen, -10 * testConfig.zScale),
  `Expected (0, ${-10 * testConfig.zScale}), got (${elevatedScreen.xscreen}, ${elevatedScreen.yscreen})`,
);

// Test 5: Combined transformation
const combined: GridCoord = { xgrid: 2, ygrid: 1, zheight: 5 };
const combinedScreen = gridToScreen(combined, testConfig);
const expectedCombinedX = (2 - 1) * (testConfig.tileWidth / 2);
const expectedCombinedY =
  (2 + 1) * (testConfig.tileHeight / 2) - 5 * testConfig.zScale;
testResult(
  "Combined (2,1,5) projects correctly",
  almostEqual(combinedScreen.xscreen, expectedCombinedX) &&
    almostEqual(combinedScreen.yscreen, expectedCombinedY),
  `Expected (${expectedCombinedX}, ${expectedCombinedY}), got (${combinedScreen.xscreen}, ${combinedScreen.yscreen})`,
);

// ============================================================================
// Test Suite: Screen-to-Grid Inverse Projections
// ============================================================================

console.log("\n🔄 Screen-to-Grid Inverse Projection Tests:");
console.log("=============================================");

// Test 6: Inverse of origin
const screenOrigin: ScreenCoord = { xscreen: 0, yscreen: 0 };
const gridFromScreenOrigin = screenToGrid(screenOrigin, testConfig, 0);
testResult(
  "Screen (0,0) inverts to (0,0) grid",
  almostEqual(gridFromScreenOrigin.xgrid, 0) &&
    almostEqual(gridFromScreenOrigin.ygrid, 0),
  `Got (${gridFromScreenOrigin.xgrid}, ${gridFromScreenOrigin.ygrid})`,
);

// Test 7: Round-trip: grid -> screen -> grid
const original: GridCoord = { xgrid: 3, ygrid: 2, zheight: 0 };
const screen = gridToScreen(original, testConfig);
const reconstructed = screenToGrid(screen, testConfig, 0);
testResult(
  "Round-trip grid->screen->grid preserves coordinates",
  almostEqual(reconstructed.xgrid, original.xgrid) &&
    almostEqual(reconstructed.ygrid, original.ygrid),
  `Original (${original.xgrid}, ${original.ygrid}), reconstructed (${reconstructed.xgrid}, ${reconstructed.ygrid})`,
);

// Test 8: Ground level picking
const screenCoord: ScreenCoord = { xscreen: 32, yscreen: 48 };
const gridCoord = screenToGridAtGroundLevel(screenCoord, testConfig);
testResult(
  "Ground level picking returns integer grid coordinates",
  Number.isInteger(gridCoord.xgrid) && Number.isInteger(gridCoord.ygrid),
  `Got (${gridCoord.xgrid}, ${gridCoord.ygrid})`,
);

// Test 9: Multiple round-trips
let testPassed = true;
for (let i = 1; i <= 5; i++) {
  const testGrid: GridCoord = { xgrid: i, ygrid: i * 2, zheight: 0 };
  const testScreen = gridToScreen(testGrid, testConfig);
  const testReconstructed = screenToGrid(testScreen, testConfig, 0);
  if (
    !almostEqual(testReconstructed.xgrid, testGrid.xgrid) ||
    !almostEqual(testReconstructed.ygrid, testGrid.ygrid)
  ) {
    testPassed = false;
  }
}
testResult("Multiple round-trips preserve accuracy", testPassed);

// ============================================================================
// Test Suite: Utility Functions
// ============================================================================

console.log("\n🔧 Utility Function Tests:");
console.log("===========================");

// Test 10: Cell center offset
const centerOffset = getCellCenterOffset(testConfig);
testResult(
  "Cell center offset is correct",
  almostEqual(centerOffset.xscreen, 0) &&
    almostEqual(centerOffset.yscreen, testConfig.tileHeight / 2),
  `Got (${centerOffset.xscreen}, ${centerOffset.yscreen})`,
);

// Test 11: Grid coordinate validation - valid
const validCoord: GridCoord = { xgrid: 50, ygrid: 50, zheight: 5 };
testResult(
  "Valid grid coordinate passes validation",
  isGridCoordValid(validCoord, 100),
);

// Test 12: Grid coordinate validation - invalid (negative)
const invalidNegative: GridCoord = { xgrid: -1, ygrid: 50, zheight: 5 };
testResult(
  "Negative grid coordinate fails validation",
  !isGridCoordValid(invalidNegative, 100),
);

// Test 13: Grid coordinate validation - invalid (out of bounds)
const invalidOutOfBounds: GridCoord = { xgrid: 100, ygrid: 50, zheight: 5 };
testResult(
  "Out-of-bounds grid coordinate fails validation",
  !isGridCoordValid(invalidOutOfBounds, 100),
);

// Test 14: Default projection configuration
const defaultConfig = createDefaultProjection();
testResult(
  "Default projection has expected dimensions",
  defaultConfig.tileWidth === 64 &&
    defaultConfig.tileHeight === 32 &&
    defaultConfig.zScale === 1.0,
  `Got (${defaultConfig.tileWidth}, ${defaultConfig.tileHeight}, ${defaultConfig.zScale})`,
);

// ============================================================================
// Test Suite: Different Projection Configurations
// ============================================================================

console.log("\n⚙️  Different Configuration Tests:");
console.log("===================================");

// Test 15: Different tile dimensions
const customConfig = new ProjectionConfig(128, 64, 1.5);
const customGrid: GridCoord = { xgrid: 1, ygrid: 0, zheight: 0 };
const customScreen = gridToScreen(customGrid, customConfig);
const expectedCustomX = (1 - 0) * (customConfig.tileWidth / 2);
const expectedCustomY = (1 + 0) * (customConfig.tileHeight / 2);
testResult(
  "Custom projection config works correctly",
  almostEqual(customScreen.xscreen, expectedCustomX) &&
    almostEqual(customScreen.yscreen, expectedCustomY),
  `Expected (${expectedCustomX}, ${expectedCustomY}), got (${customScreen.xscreen}, ${customScreen.yscreen})`,
);

// Test 16: Height scaling with different zScale
const zScaleConfig = new ProjectionConfig(64, 32, 2.0);
const heightGrid: GridCoord = { xgrid: 0, ygrid: 0, zheight: 5 };
const heightScreen = gridToScreen(heightGrid, zScaleConfig);
testResult(
  "Z-scale factor is applied correctly",
  almostEqual(heightScreen.yscreen, -5 * zScaleConfig.zScale),
  `Expected y=${-5 * zScaleConfig.zScale}, got ${heightScreen.yscreen}`,
);

// ============================================================================
// Summary
// ============================================================================

console.log("\n" + "=".repeat(50));
console.log("✅ 2.5D Projection Math Test Suite Complete");
console.log("=".repeat(50));
