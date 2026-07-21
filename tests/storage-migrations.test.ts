/**
 * @file
 */

import { expect, test, vi } from 'vitest';

import { runMigrations, SCHEMA_VERSION_KEY } from '../src/app/common/storage-migrations';

test('runs each migration once in version order', () => {
    const calls: string[] = [];
    const migrations = {
        1: (state: Record<string, unknown>) => {
            calls.push('v1');
            return { ...state, one: true };
        },
        2: (state: Record<string, unknown>) => {
            calls.push('v2');
            return { ...state, two: true };
        },
    };

    const { state, migrated } = runMigrations({ value: 0 }, 3, migrations);

    expect(calls).toEqual(['v1', 'v2']);
    expect(migrated).toBe(true);
    expect(state).toMatchObject({ value: 0, one: true, two: true, [SCHEMA_VERSION_KEY]: 3 });
});

test('starts from the stored schema version', () => {
    const migrate = vi.fn((state: Record<string, unknown>) => state);

    runMigrations({ [SCHEMA_VERSION_KEY]: 2 }, 3, { 1: migrate, 2: migrate });

    expect(migrate).toHaveBeenCalledOnce();
});

test('does not migrate when already at the current version', () => {
    const migrate = vi.fn((state: Record<string, unknown>) => state);

    const { migrated } = runMigrations({ [SCHEMA_VERSION_KEY]: 3 }, 3, { 1: migrate });

    expect(migrated).toBe(false);
    expect(migrate).not.toHaveBeenCalled();
});

test('leaves state from a newer schema untouched (downgrade)', () => {
    const migrate = vi.fn((state: Record<string, unknown>) => state);

    const raw = { [SCHEMA_VERSION_KEY]: 5, keep: 1 };
    const { state, migrated } = runMigrations(raw, 3, { 1: migrate });

    expect(migrated).toBe(false);
    expect(migrate).not.toHaveBeenCalled();
    expect(state).toMatchObject({ keep: 1 });
});

test('treats unversioned state as version 1', () => {
    const migrate = vi.fn((state: Record<string, unknown>) => state);

    runMigrations({ legacy: true }, 2, { 1: migrate });

    expect(migrate).toHaveBeenCalledOnce();
});

test('passes non-object state through unchanged', () => {
    expect(runMigrations(null, 2, {})).toEqual({ state: null, migrated: false });
    expect(runMigrations([1, 2], 2, {})).toEqual({ state: [1, 2], migrated: false });
});
