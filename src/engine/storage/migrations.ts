/**
 * Schema Migration System
 */

export interface Migration {
  from: number;
  to: number;
  migrate(doc: any): any;
}

/**
 * Registry of all migrations
 */
const migrations: Migration[] = [
  // Example migration from v1 to v2
  {
    from: 1,
    to: 2,
    migrate(doc: any): any {
      // Placeholder for future schema changes
      return {
        ...doc,
        schemaVersion: 2,
      };
    },
  },
];

/**
 * Apply migrations to bring document to current schema version
 */
export function migrateDocument(doc: any, targetVersion: number): any {
  let currentDoc = doc;
  let currentVersion = doc.schemaVersion || 1;

  while (currentVersion < targetVersion) {
    const migration = migrations.find((m) => m.from === currentVersion);

    if (!migration) {
      throw new Error(
        `No migration path found from version ${currentVersion} to ${targetVersion}`
      );
    }

    currentDoc = migration.migrate(currentDoc);
    currentVersion = migration.to;
  }

  return currentDoc;
}

/**
 * Get current schema version
 */
export function getCurrentSchemaVersion(): number {
  return 1; // Update this when adding new migrations
}
