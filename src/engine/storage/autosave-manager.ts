/**
 * Autosave Manager - Debounced saving
 */

import type { EngineStore, StorageAdapter } from "../core/types";

export class AutosaveManager {
  private store: EngineStore;
  private adapter: StorageAdapter;
  private saveTimeout: ReturnType<typeof setTimeout> | null = null;
  private unsubscribe: (() => void) | null = null;
  private saveDelay: number;

  constructor(store: EngineStore, adapter: StorageAdapter, saveDelay = 2000) {
    this.store = store;
    this.adapter = adapter;
    this.saveDelay = saveDelay;
  }

  /**
   * Start autosave
   */
  start(): void {
    // Subscribe to document changes
    this.unsubscribe = this.store.subscribe(
      (doc) => doc.metadata.updatedAt,
      () => {
        this.scheduleSave();
      }
    );
  }

  /**
   * Stop autosave
   */
  stop(): void {
    if (this.unsubscribe) {
      this.unsubscribe();
      this.unsubscribe = null;
    }

    if (this.saveTimeout) {
      clearTimeout(this.saveTimeout);
      this.saveTimeout = null;
    }
  }

  /**
   * Schedule a save (debounced)
   */
  private scheduleSave(): void {
    if (this.saveTimeout) {
      clearTimeout(this.saveTimeout);
    }

    this.saveTimeout = setTimeout(() => {
      this.saveNow();
    }, this.saveDelay);
  }

  /**
   * Save immediately
   */
  async saveNow(): Promise<void> {
    try {
      const doc = this.store.get();
      await this.adapter.save(doc);
      console.log("Document saved");
    } catch (error) {
      console.error("Autosave failed:", error);
    }
  }

  /**
   * Force save and wait for completion
   */
  async flush(): Promise<void> {
    if (this.saveTimeout) {
      clearTimeout(this.saveTimeout);
      this.saveTimeout = null;
    }
    await this.saveNow();
  }
}
