/**
 * @file Generic version-chained migrations for persisted storage state.
 */

/**
 * Transforms stored state from one schema version to the next.
 */
export type StorageMigration = (state: Record<string, unknown>) => Record<string, unknown>;

/**
 * Result of running a migration chain.
 */
export interface MigrationResult {
    /**
     * State after all applicable migrations.
     */
    state: unknown;

    /**
     * Whether any migration ran and the state should be re-persisted.
     */
    migrated: boolean;
}

/**
 * Key carrying the schema version inside persisted state objects.
 */
export const SCHEMA_VERSION_KEY = 'schemaVersion';

/**
 * Version assumed for state persisted before versioning existed.
 */
const LEGACY_SCHEMA_VERSION = 1;

/**
 * Runs migrations version-by-version up to the current schema.
 *
 * The migration for version N transforms state from version N to N + 1:
 * upgrading from v1 to v3 runs migrations[1] and then migrations[2].
 * State persisted by a NEWER extension (downgrade) is returned unchanged
 * and left for normalization to interpret best-effort.
 *
 * @param raw Raw persisted state.
 * @param currentVersion Schema version this build reads and writes.
 * @param migrations Migration steps keyed by their source version.
 *
 * @returns Migrated state and whether persistence should be refreshed.
 */
export const runMigrations = (
    raw: unknown,
    currentVersion: number,
    migrations: Record<number, StorageMigration>,
): MigrationResult => {
    if (typeof raw !== 'object' || raw === null || Array.isArray(raw)) {
        return { state: raw, migrated: false };
    }

    let state = raw as Record<string, unknown>;
    const storedVersion = state[SCHEMA_VERSION_KEY];
    let version = typeof storedVersion === 'number' ? storedVersion : LEGACY_SCHEMA_VERSION;

    if (version >= currentVersion) {
        return { state, migrated: false };
    }

    while (version < currentVersion) {
        const migrate = migrations[version];
        if (migrate) {
            state = migrate(state);
        }
        version += 1;
    }

    return {
        state: { ...state, [SCHEMA_VERSION_KEY]: currentVersion },
        migrated: true,
    };
};
