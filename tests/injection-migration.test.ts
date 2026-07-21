/**
 * @file Injection storage migration and legacy-rule normalization.
 */

import { expect, test } from 'vitest';

import { normalizeStoredInjectionsState } from '../src/app/common/contracts';
import {
    CURRENT_INJECTIONS_SCHEMA_VERSION,
    INJECTIONS_MIGRATIONS,
} from '../src/app/background/injections-migrations';
import { runMigrations } from '../src/app/common/storage-migrations';

const legacyRule = {
    id: 'rule-1',
    site: 'example.com',
    jsPath: 'file:///a.js',
    cssPath: 'file:///a.css',
    enabled: true,
};

test('v1 rules gain per-file flags defaulting to enabled', () => {
    const { state, migrated } = runMigrations(
        { injections: [legacyRule], blocklist: [] },
        CURRENT_INJECTIONS_SCHEMA_VERSION,
        INJECTIONS_MIGRATIONS,
    );

    expect(migrated).toBe(true);
    const { injections } = normalizeStoredInjectionsState(state);
    expect(injections[0]).toMatchObject({ jsEnabled: true, cssEnabled: true });
});

test('normalization defaults flags for a legacy rule without migration', () => {
    const { injections } = normalizeStoredInjectionsState({
        injections: [legacyRule],
        blocklist: [],
    });

    expect(injections).toHaveLength(1);
    expect(injections[0]).toMatchObject({ jsEnabled: true, cssEnabled: true });
});

test('an explicit disabled flag is preserved', () => {
    const { injections } = normalizeStoredInjectionsState({
        injections: [{ ...legacyRule, jsEnabled: false, cssEnabled: true }],
        blocklist: [],
    });

    expect(injections[0]).toMatchObject({ jsEnabled: false, cssEnabled: true });
});

test('a rule with a corrupt flag is dropped, core rules survive', () => {
    const { injections } = normalizeStoredInjectionsState({
        injections: [
            { ...legacyRule, id: 'bad', jsEnabled: 'yes' },
            legacyRule,
        ],
        blocklist: [],
    });

    expect(injections).toHaveLength(1);
    expect(injections[0].id).toBe('rule-1');
});

test('a rule missing core fields is still dropped', () => {
    const { injections } = normalizeStoredInjectionsState({
        injections: [{ id: 'x', site: 'example.com' }],
        blocklist: [],
    });

    expect(injections).toHaveLength(0);
});
