/**
 * IndexedDB Storage Adapter
 */

import { get, set } from "idb-keyval";
import type { DocumentModel, StorageAdapter } from "../core/types";
import { createRootNode } from "../core/node-utils";
import {
  DocumentModelSchema,
  serializeDocument,
  deserializeDocument,
} from "./schema";
import { migrateDocument, getCurrentSchemaVersion } from "./migrations";

const STORAGE_KEY = "canvas-document";

export class IndexedDBAdapter implements StorageAdapter {
  async load(): Promise<DocumentModel> {
    try {
      const stored = await get(STORAGE_KEY);

      if (!stored) {
        // Return empty document
        return this.createEmptyDocument();
      }

      // Deserialize
      const deserialized = deserializeDocument(stored);

      // Migrate if needed
      const currentVersion = getCurrentSchemaVersion();
      const migrated =
        deserialized.schemaVersion < currentVersion
          ? migrateDocument(deserialized, currentVersion)
          : deserialized;

      // Validate
      const validated = DocumentModelSchema.parse(migrated);

      return deserializeDocument(validated);
    } catch (error) {
      console.error("Failed to load document:", error);
      return this.createEmptyDocument();
    }
  }

  async save(doc: DocumentModel): Promise<void> {
    try {
      const serialized = serializeDocument(doc);
      await set(STORAGE_KEY, serialized);
    } catch (error) {
      console.error("Failed to save document:", error);
      throw error;
    }
  }

  async export(doc: DocumentModel): Promise<Blob> {
    try {
      const serialized = serializeDocument(doc);
      const json = JSON.stringify(serialized, null, 2);
      return new Blob([json], { type: "application/json" });
    } catch (error) {
      console.error("Failed to export document:", error);
      throw error;
    }
  }

  async import(blob: Blob): Promise<DocumentModel> {
    try {
      const text = await blob.text();
      const parsed = JSON.parse(text);

      // Deserialize
      const deserialized = deserializeDocument(parsed);

      // Migrate if needed
      const currentVersion = getCurrentSchemaVersion();
      const migrated =
        deserialized.schemaVersion < currentVersion
          ? migrateDocument(deserialized, currentVersion)
          : deserialized;

      // Validate
      const validated = DocumentModelSchema.parse(migrated);

      return deserializeDocument(validated);
    } catch (error) {
      console.error("Failed to import document:", error);
      throw new Error("Invalid document format");
    }
  }

  private createEmptyDocument(): DocumentModel {
    const root = createRootNode();
    return {
      schemaVersion: getCurrentSchemaVersion(),
      rootId: root.id,
      nodes: {
        [root.id]: root,
      },
      selection: [],
      metadata: {
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      },
    };
  }
}
