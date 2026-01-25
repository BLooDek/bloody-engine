/**
 * EntitySerializer - Binary serialization for entities
 *
 * Provides efficient binary serialization for Entity and EntityState.
 * Uses delta encoding to only serialize changed properties.
 *
 * Binary Format:
 * Per Entity:
 *   [entityTypeLen:2][entityType:n][idLen:2][id:n]
 *   [flags:1][posX:4][posY:4][posZ:4][velX:4][velY:4][velZ:4][rotation:4][speed:4][isMoving:1]
 *
 * Entity List:
 *   [count:2][entity1:n][entity2:n]...[entityN:n]
 *
 * Flags byte (bit positions):
 *   0: hasPosition
 *   1: hasVelocity
 *   2: hasRotation
 *   3: hasSpeed
 *   4: hasIsMoving
 *   5-7: reserved for future use
 */

import type { Entity } from "../simulation/entity";
import type { EntityState } from "../simulation/entity";
import type { GridCoord } from "../rendering/projection";
import { BinarySerializer, BinaryReader } from "./binary-serializer";

/**
 * Entity serialization flags for delta encoding
 */
export const enum EntitySerializationFlags {
  HAS_POSITION = 1 << 0,    // 0x01
  HAS_VELOCITY = 1 << 1,    // 0x02
  HAS_ROTATION = 1 << 2,    // 0x04
  HAS_SPEED = 1 << 3,       // 0x08
  HAS_IS_MOVING = 1 << 4,   // 0x10
}

/**
 * Entity state subset for network transmission
 * Contains only the serializable properties
 */
export interface SerializableEntityState {
  gridPos: GridCoord;
  velocity: { x: number; y: number; z: number };
  rotation: number;
  speed: number;
  isMoving: boolean;
}

/**
 * Serialized entity data
 */
export interface SerializedEntity {
  id: string;
  type: string;
  state: SerializableEntityState;
}

/**
 * EntitySerializer - Serialize and deserialize entities to/from binary format
 */
export class EntitySerializer {
  /**
   * Serialize a single entity to binary format
   */
  static serializeEntity(entity: Entity): Uint8Array {
    const serializer = new BinarySerializer();
    this.writeEntity(serializer, entity);
    return serializer.toBuffer();
  }

  /**
   * Write an entity to a serializer
   */
  static writeEntity(serializer: BinarySerializer, entity: Entity): void {
    const state = entity.state;

    // Write entity type (length-prefixed string)
    serializer.writeString(entity.type);

    // Write entity ID (length-prefixed string)
    serializer.writeString(entity.id);

    // Calculate flags for delta encoding
    const flags = this.calculateFlags(state);

    // Write flags
    serializer.writeUint8(flags);

    // Write position (xgrid, ygrid, zheight)
    if (flags & EntitySerializationFlags.HAS_POSITION) {
      serializer.writeFloat32(state.gridPos.xgrid);
      serializer.writeFloat32(state.gridPos.ygrid);
      serializer.writeFloat32(state.gridPos.zheight);
    }

    // Write velocity
    if (flags & EntitySerializationFlags.HAS_VELOCITY) {
      serializer.writeFloat32(state.velocity.x);
      serializer.writeFloat32(state.velocity.y);
      serializer.writeFloat32(state.velocity.z);
    }

    // Write rotation
    if (flags & EntitySerializationFlags.HAS_ROTATION) {
      serializer.writeFloat32(state.rotation);
    }

    // Write speed
    if (flags & EntitySerializationFlags.HAS_SPEED) {
      serializer.writeFloat32(state.speed);
    }

    // Write isMoving flag
    if (flags & EntitySerializationFlags.HAS_IS_MOVING) {
      serializer.writeBoolean(state.isMoving);
    }
  }

  /**
   * Serialize multiple entities to binary format
   * Format: [count:2][entity1:n][entity2:n]...[entityN:n]
   */
  static serializeEntities(entities: Entity[]): Uint8Array {
    const serializer = new BinarySerializer();

    // Write entity count (max 65535 entities)
    const count = entities.length;
    if (count > 65535) {
      throw new Error(`Too many entities to serialize: ${count} (max 65535)`);
    }
    serializer.writeUint16(count);

    // Write each entity
    for (const entity of entities) {
      this.writeEntity(serializer, entity);
    }

    return serializer.toBuffer();
  }

  /**
   * Deserialize a single entity from binary format
   * @deprecated Use EntityManager.deserializeAllBinary() instead
   */
  static async deserializeEntity(data: Uint8Array): Promise<never> {
    throw new Error(
      "EntitySerializer.deserializeEntity() is not supported with SoA storage. " +
      "Use EntityManager methods instead."
    );
  }

  /**
   * Read an entity from a binary reader
   * Returns entity data that can be used with EntityManager
   */
  static async readEntity(reader: BinaryReader): Promise<{
    id: string;
    type: string;
    state: EntityState;
  }> {
    // Read entity type
    const type = reader.readString();

    // Read entity ID
    const id = reader.readString();

    // Read flags
    const flags = reader.readUint8();

    // Build entity state
    const state: EntityState = {
      gridPos: { xgrid: 0, ygrid: 0, zheight: 0 },
      velocity: { x: 0, y: 0, z: 0 },
      rotation: 0,
      speed: 1.0,
      isMoving: false,
    };

    // Read position
    if (flags & EntitySerializationFlags.HAS_POSITION) {
      state.gridPos = {
        xgrid: reader.readFloat32(),
        ygrid: reader.readFloat32(),
        zheight: reader.readFloat32(),
      };
    }

    // Read velocity
    if (flags & EntitySerializationFlags.HAS_VELOCITY) {
      state.velocity = {
        x: reader.readFloat32(),
        y: reader.readFloat32(),
        z: reader.readFloat32(),
      };
    }

    // Read rotation
    if (flags & EntitySerializationFlags.HAS_ROTATION) {
      state.rotation = reader.readFloat32();
    }

    // Read speed
    if (flags & EntitySerializationFlags.HAS_SPEED) {
      state.speed = reader.readFloat32();
    }

    // Read isMoving flag
    if (flags & EntitySerializationFlags.HAS_IS_MOVING) {
      state.isMoving = reader.readBoolean();
    }

    // Return entity data (not Entity instance)
    return { id, type, state };
  }

  /**
   * Deserialize multiple entities from binary format
   * @deprecated Use EntityManager.deserializeAllBinary() instead
   */
  static async deserializeEntities(
    data: Uint8Array
  ): Promise<never[]> {
    throw new Error(
      "EntitySerializer.deserializeEntities() is not supported with SoA storage. " +
      "Use EntityManager.deserializeAllBinary() instead."
    );
  }

  /**
   * Deserialize entity data from binary format (internal use)
   * Returns array of entity data objects for EntityManager
   * @internal
   */
  static async deserializeEntityData(data: Uint8Array): Promise<
    Array<{ id: string; type: string; state: EntityState }>
  > {
    const reader = new BinaryReader(data);

    // Read entity count
    const count = reader.readUint16();
    const entities: Array<{ id: string; type: string; state: EntityState }> = [];

    // Read each entity
    for (let i = 0; i < count; i++) {
      entities.push(await this.readEntity(reader));
    }

    return entities;
  }

  /**
   * Calculate serialization flags based on state values
   * Uses delta encoding to skip default/unchanged values
   */
  private static calculateFlags(state: EntityState): number {
    let flags = 0;

    // Always include position (it's the most important data)
    flags |= EntitySerializationFlags.HAS_POSITION;

    // Include velocity if non-zero
    if (state.velocity.x !== 0 || state.velocity.y !== 0 || state.velocity.z !== 0) {
      flags |= EntitySerializationFlags.HAS_VELOCITY;
    }

    // Include rotation if non-zero
    if (state.rotation !== 0) {
      flags |= EntitySerializationFlags.HAS_ROTATION;
    }

    // Include speed if not default (1.0)
    if (state.speed !== 1.0) {
      flags |= EntitySerializationFlags.HAS_SPEED;
    }

    // Include isMoving if true
    if (state.isMoving) {
      flags |= EntitySerializationFlags.HAS_IS_MOVING;
    }

    return flags;
  }

  /**
   * Serialize an entity state without the entity metadata (id, type)
   * Useful for delta updates
   */
  static serializeEntityState(state: EntityState): Uint8Array {
    const serializer = new BinarySerializer();

    const flags = this.calculateFlags(state);
    serializer.writeUint8(flags);

    if (flags & EntitySerializationFlags.HAS_POSITION) {
      serializer.writeFloat32(state.gridPos.xgrid);
      serializer.writeFloat32(state.gridPos.ygrid);
      serializer.writeFloat32(state.gridPos.zheight);
    }

    if (flags & EntitySerializationFlags.HAS_VELOCITY) {
      serializer.writeFloat32(state.velocity.x);
      serializer.writeFloat32(state.velocity.y);
      serializer.writeFloat32(state.velocity.z);
    }

    if (flags & EntitySerializationFlags.HAS_ROTATION) {
      serializer.writeFloat32(state.rotation);
    }

    if (flags & EntitySerializationFlags.HAS_SPEED) {
      serializer.writeFloat32(state.speed);
    }

    if (flags & EntitySerializationFlags.HAS_IS_MOVING) {
      serializer.writeBoolean(state.isMoving);
    }

    return serializer.toBuffer();
  }

  /**
   * Deserialize an entity state
   */
  static deserializeEntityState(data: Uint8Array, defaultState?: EntityState): EntityState {
    const reader = new BinaryReader(data);
    const flags = reader.readUint8();

    const state: EntityState = defaultState ? { ...defaultState, gridPos: { ...defaultState.gridPos }, velocity: { ...defaultState.velocity } } : {
      gridPos: { xgrid: 0, ygrid: 0, zheight: 0 },
      velocity: { x: 0, y: 0, z: 0 },
      rotation: 0,
      speed: 1.0,
      isMoving: false,
    };

    if (flags & EntitySerializationFlags.HAS_POSITION) {
      state.gridPos = {
        xgrid: reader.readFloat32(),
        ygrid: reader.readFloat32(),
        zheight: reader.readFloat32(),
      };
    }

    if (flags & EntitySerializationFlags.HAS_VELOCITY) {
      state.velocity = {
        x: reader.readFloat32(),
        y: reader.readFloat32(),
        z: reader.readFloat32(),
      };
    }

    if (flags & EntitySerializationFlags.HAS_ROTATION) {
      state.rotation = reader.readFloat32();
    }

    if (flags & EntitySerializationFlags.HAS_SPEED) {
      state.speed = reader.readFloat32();
    }

    if (flags & EntitySerializationFlags.HAS_IS_MOVING) {
      state.isMoving = reader.readBoolean();
    }

    return state;
  }

  /**
   * Calculate the size in bytes of a serialized entity
   * Useful for buffer allocation and optimization
   */
  static calculateEntitySize(entity: Entity): number {
    let size = 0;

    // Type string (2 bytes length + string bytes)
    size += 2 + new TextEncoder().encode(entity.type).length;

    // ID string (2 bytes length + string bytes)
    size += 2 + new TextEncoder().encode(entity.id).length;

    // Flags (1 byte)
    size += 1;

    const state = entity.state;
    const flags = this.calculateFlags(state);

    // Position (3 floats = 12 bytes)
    if (flags & EntitySerializationFlags.HAS_POSITION) {
      size += 12;
    }

    // Velocity (3 floats = 12 bytes)
    if (flags & EntitySerializationFlags.HAS_VELOCITY) {
      size += 12;
    }

    // Rotation (1 float = 4 bytes)
    if (flags & EntitySerializationFlags.HAS_ROTATION) {
      size += 4;
    }

    // Speed (1 float = 4 bytes)
    if (flags & EntitySerializationFlags.HAS_SPEED) {
      size += 4;
    }

    // IsMoving (1 byte)
    if (flags & EntitySerializationFlags.HAS_IS_MOVING) {
      size += 1;
    }

    return size;
  }
}
