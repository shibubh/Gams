/**
 * ID Registry - Maps string node IDs to u32 handles for WASM
 * 
 * WASM uses u32 handles for performance, but JS uses string IDs.
 * This registry maintains a bidirectional mapping.
 */

export class IdRegistry {
  private idToHandle: Map<string, number> = new Map();
  private handleToId: Map<number, string> = new Map();
  private nextHandle: number = 1;

  /**
   * Get or create a handle for a string ID
   */
  getHandle(id: string): number {
    let handle = this.idToHandle.get(id);
    if (handle === undefined) {
      handle = this.nextHandle++;
      this.idToHandle.set(id, handle);
      this.handleToId.set(handle, id);
    }
    return handle;
  }

  /**
   * Get string ID from handle
   */
  getId(handle: number): string | undefined {
    return this.handleToId.get(handle);
  }

  /**
   * Check if ID exists
   */
  has(id: string): boolean {
    return this.idToHandle.has(id);
  }

  /**
   * Remove an ID/handle pair
   */
  remove(id: string): void {
    const handle = this.idToHandle.get(id);
    if (handle !== undefined) {
      this.idToHandle.delete(id);
      this.handleToId.delete(handle);
    }
  }

  /**
   * Clear all mappings
   */
  clear(): void {
    this.idToHandle.clear();
    this.handleToId.clear();
    this.nextHandle = 1;
  }

  /**
   * Get total count
   */
  size(): number {
    return this.idToHandle.size;
  }
}
