/**
 * @file Schema migrations for persisted injection state.
 */

import { InjectionField } from '../common/constants';
import type { StorageMigration } from '../common/storage-migrations';

/**
 * Schema version this build reads and writes.
 *
 * v1: rules without per-file flags. v2: rules carry jsEnabled/cssEnabled.
 */
export const CURRENT_INJECTIONS_SCHEMA_VERSION = 2;

/**
 * v1 → v2: enable every existing rule's JS and CSS by default, matching
 * the whole-rule behavior those rules had before per-file toggles existed.
 *
 * @param state Persisted v1 injection state.
 *
 * @returns State with per-file flags populated.
 */
const migrateV1ToV2: StorageMigration = (state) => {
    const injections = Array.isArray(state.injections) ? state.injections : [];
    return {
        ...state,
        injections: injections.map((injection) => {
            if (typeof injection !== 'object' || injection === null) {
                return injection;
            }
            const rule = injection as Record<string, unknown>;
            return {
                ...rule,
                [InjectionField.JsEnabled]: rule[InjectionField.JsEnabled] ?? true,
                [InjectionField.CssEnabled]: rule[InjectionField.CssEnabled] ?? true,
            };
        }),
    };
};

/**
 * Injection-state migrations keyed by their source schema version.
 */
export const INJECTIONS_MIGRATIONS: Record<number, StorageMigration> = {
    1: migrateV1ToV2,
};
