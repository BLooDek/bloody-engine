/**
 * EntityTypeRegistry - Maps entity type strings to numeric IDs
 *
 * Uses numeric IDs in storage for efficiency (Uint16Array vs string references).
 * Provides bidirectional mapping between names and IDs.
 */

export class EntityTypeRegistry {
  private typeToId: Map<string, number> = new Map();
  private idToType: string[] = [];

  /**
   * Register a type and get its numeric ID
   * If type already exists, returns the existing ID
   */
  registerType(typeName: string): number {
    const existingId = this.typeToId.get(typeName);
    if (existingId !== undefined) {
      return existingId;
    }

    const id = this.idToType.length;
    this.typeToId.set(typeName, id);
    this.idToType.push(typeName);
    return id;
  }

  /**
   * Get type name by numeric ID
   */
  getTypeName(id: number): string {
    return this.idToType[id] ?? "unknown";
  }

  /**
   * Get numeric ID by type name
   */
  getTypeId(name: string): number | undefined {
    return this.typeToId.get(name);
  }

  /**
   * Check if a type is registered
   */
  hasType(name: string): boolean {
    return this.typeToId.has(name);
  }

  /**
   * Get total number of registered types
   */
  get typeCount(): number {
    return this.idToType.length;
  }

  /**
   * Get all registered type names
   */
  getAllTypes(): string[] {
    return [...this.idToType];
  }

  /**
   * Clear all registered types
   */
  clear(): void {
    this.typeToId.clear();
    this.idToType = [];
  }
}
