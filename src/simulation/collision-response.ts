/**
 * Collision Response Handlers
 *
 * Handles different collision response types:
 * - BLOCK: Prevent movement (stop on collision)
 * - BOUNCE: Reflect velocity off collision normal
 * - SLIDE: Continue movement along collision surface
 * - TRIGGER: Fire callback but don't affect movement
 * - IGNORE: Detect but take no action
 */

import type { EntityHandle } from "./entity-handle";
import type { EntityStorage } from "./entity-storage";
import type { CollisionPair, CollisionResponse } from "./collision/base";

/**
 * Collision response context
 */
interface CollisionContext {
  storage: EntityStorage;
  positions: Float32Array;
  velocities: Float32Array;
  radii: Float32Array;
}

/**
 * Response handler function
 */
type ResponseHandler = (
  pair: CollisionPair,
  context: CollisionContext
) => void;

/**
 * BLOCK Response - Prevent movement by separating entities
 *
 * Moves entities apart so they no longer overlap.
 * Stops all velocity in the collision normal direction.
 */
const handleBlock: ResponseHandler = (pair, context) => {
  const { entityA, entityB, normal, penetration = 0 } = pair;

  // Get positions and velocities
  const posA = getEntityPosition(entityA, context);
  const posB = getEntityPosition(entityB, context);
  const velA = getEntityVelocity(entityA, context);
  const velB = getEntityVelocity(entityB, context);

  // Calculate separation vector
  const nx = normal?.x ?? posB.x - posA.x;
  const ny = normal?.y ?? posB.y - posA.y;
  const len = Math.sqrt(nx * nx + ny * ny);

  if (len === 0) return; // Entities at same position, can't resolve

  // Normalize
  const dirX = nx / len;
  const dirY = ny / len;

  // Separate entities (move each half the penetration distance)
  const separation = Math.max(penetration, 0.001) / 2;
  context.storage.move(entityA.index, -dirX * separation, -dirY * separation, 0);
  context.storage.move(entityB.index, dirX * separation, dirY * separation, 0);

  // Stop velocity in collision direction (simple block)
  // Project velocity onto normal and remove that component
  const dotA = velA.x * dirX + velA.y * dirY;
  const dotB = velB.x * dirX + velB.y * dirY;

  if (dotA > 0) {
    // Entity A moving toward B, stop it
    context.storage.setVelocity(
      entityA.index,
      velA.x - dotA * dirX,
      velA.y - dotA * dirY,
      0
    );
  }

  if (dotB < 0) {
    // Entity B moving toward A, stop it
    context.storage.setVelocity(
      entityB.index,
      velB.x - dotB * dirX,
      velB.y - dotB * dirY,
      0
    );
  }
};

/**
 * BOUNCE Response - Reflect velocity off collision normal
 *
 * Entities bounce off each other like billiard balls.
 * Uses coefficient of restitution (bounciness).
 */
const handleBounce: ResponseHandler = (pair, context) => {
  const { entityA, entityB, normal } = pair;
  const restitution = 0.8; // Bounciness (0 = no bounce, 1 = perfect elastic)

  const posA = getEntityPosition(entityA, context);
  const posB = getEntityPosition(entityB, context);
  const velA = getEntityVelocity(entityA, context);
  const velB = getEntityVelocity(entityB, context);

  // Calculate normal
  const nx = normal?.x ?? posB.x - posA.x;
  const ny = normal?.y ?? posB.y - posA.y;
  const len = Math.sqrt(nx * nx + ny * ny);

  if (len === 0) return;

  const dirX = nx / len;
  const dirY = ny / len;

  // Separate entities first (same as BLOCK)
  const separation = (pair.penetration ?? 0.001) / 2;
  context.storage.move(entityA.index, -dirX * separation, -dirY * separation, 0);
  context.storage.move(entityB.index, dirX * separation, dirY * separation, 0);

  // Calculate relative velocity
  const relVelX = velA.x - velB.x;
  const relVelY = velA.y - velB.y;

  // Calculate relative velocity along collision normal
  const velAlongNormal = relVelX * dirX + relVelY * dirY;

  // Don't resolve if velocities are separating
  if (velAlongNormal > 0) return;

  // Calculate impulse scalar
  let j = -(1 + restitution) * velAlongNormal;

  // Assuming equal mass for now
  // For different masses: j /= (1/massA + 1/massB)
  j /= 2;

  // Apply impulse
  const impulseX = j * dirX;
  const impulseY = j * dirY;

  context.storage.setVelocity(
    entityA.index,
    velA.x + impulseX,
    velA.y + impulseY,
    0
  );
  context.storage.setVelocity(
    entityB.index,
    velB.x - impulseX,
    velB.y - impulseY,
    0
  );
};

/**
 * SLIDE Response - Continue movement along collision surface
 *
 * Entities slide along each other's surfaces.
 * Velocity component parallel to normal is removed,
 * but tangential component is preserved.
 */
const handleSlide: ResponseHandler = (pair, context) => {
  const { entityA, entityB, normal } = pair;

  const posA = getEntityPosition(entityA, context);
  const posB = getEntityPosition(entityB, context);
  const velA = getEntityVelocity(entityA, context);
  const velB = getEntityVelocity(entityB, context);

  // Calculate normal
  const nx = normal?.x ?? posB.x - posA.x;
  const ny = normal?.y ?? posB.y - posA.y;
  const len = Math.sqrt(nx * nx + ny * ny);

  if (len === 0) return;

  const dirX = nx / len;
  const dirY = ny / len;

  // Separate entities
  const separation = (pair.penetration ?? 0.001) / 2;
  context.storage.move(entityA.index, -dirX * separation, -dirY * separation, 0);
  context.storage.move(entityB.index, dirX * separation, dirY * separation, 0);

  // Remove velocity component in collision direction (block)
  // But preserve tangential component (slide)
  const dotA = velA.x * dirX + velA.y * dirY;
  const dotB = velB.x * dirX + velB.y * dirY;

  context.storage.setVelocity(
    entityA.index,
    velA.x - dotA * dirX,
    velA.y - dotA * dirY,
    0
  );
  context.storage.setVelocity(
    entityB.index,
    velB.x - dotB * dirX,
    velB.y - dotB * dirY,
    0
  );
};

/**
 * TRIGGER Response - Fire callback without affecting physics
 *
 * Does not modify positions or velocities.
 * Used for trigger zones, pickups, etc.
 */
const handleTrigger: ResponseHandler = (pair, context) => {
  // Callback is handled by the simulation loop
  // This handler is a no-op for physics
};

/**
 * IGNORE Response - No action
 *
 * Collision is detected but no response is applied.
 */
const handleIgnore: ResponseHandler = (_pair, _context) => {
  // Do nothing
};

/**
 * Helper: Get entity position
 */
function getEntityPosition(
  entity: EntityHandle,
  context: CollisionContext
): { x: number; y: number; z: number } {
  return context.storage.getPosition(entity.index);
}

/**
 * Helper: Get entity velocity
 */
function getEntityVelocity(
  entity: EntityHandle,
  context: CollisionContext
): { x: number; y: number; z: number } {
  return context.storage.getVelocity(entity.index);
}

/**
 * Collision Response Handler
 *
 * Applies collision responses based on response type.
 */
export class CollisionResponseHandler {
  private handlers: Record<CollisionResponse, ResponseHandler>;
  private onTriggerCallback?: (pair: CollisionPair) => void;

  constructor(onTrigger?: (pair: CollisionPair) => void) {
    this.handlers = {
      BLOCK: handleBlock,
      BOUNCE: handleBounce,
      SLIDE: handleSlide,
      TRIGGER: handleTrigger,
      IGNORE: handleIgnore,
    };
    this.onTriggerCallback = onTrigger;
  }

  /**
   * Apply collision response to a collision pair
   */
  applyResponse(
    pair: CollisionPair,
    response: CollisionResponse,
    storage: EntityStorage
  ): void {
    // Get the handler for this response type
    const handler = this.handlers[response];

    if (!handler) {
      console.warn(`Unknown collision response type: ${response}`);
      return;
    }

    // Create context
    const context: CollisionContext = {
      storage,
      positions: storage.getPositions(),
      velocities: new Float32Array(0), // Placeholder, accessed via storage
      radii: new Float32Array(0), // Placeholder, accessed via storage
    };

    // For TRIGGER, call the callback
    if (response === 'TRIGGER' && this.onTriggerCallback) {
      this.onTriggerCallback(pair);
    }

    // Apply the response handler
    handler(pair, context);
  }

  /**
   * Apply collision responses to multiple pairs
   */
  applyResponses(
    pairs: CollisionPair[],
    getResponse: (pair: CollisionPair) => CollisionResponse,
    storage: EntityStorage
  ): void {
    for (const pair of pairs) {
      const response = getResponse(pair);
      this.applyResponse(pair, response, storage);
    }
  }

  /**
   * Set the trigger callback
   */
  setTriggerCallback(callback: (pair: CollisionPair) => void): void {
    this.onTriggerCallback = callback;
  }
}
