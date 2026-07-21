/**
 * @file Flattens matching rules into one entry per source file.
 */

import type { InjectionFileField, InjectionRule } from '../../../common/contracts';
import { FILE_ENABLED_FLAGS, FILE_KINDS } from '../../../common/injection-files';

/**
 * One source file of a rule, ready for a popup row.
 */
export interface RuleFileEntry {
    /**
     * Identifier of the rule the file belongs to.
     */
    ruleId: string;

    /**
     * Path field of the file.
     */
    field: InjectionFileField;

    /**
     * Configured file path.
     */
    path: string;

    /**
     * Effective switch state: the file flag while the rule is enabled.
     */
    checked: boolean;

    /**
     * Whether the switch is disabled because the parent rule is off.
     */
    ruleDisabled: boolean;
}

/**
 * Flattens rules into per-file entries in display order.
 *
 * Files with an empty path are skipped; JS precedes CSS within each rule.
 *
 * @param rules Rules matching the current site.
 *
 * @returns One entry per configured file.
 */
export const getRuleFileEntries = (rules: InjectionRule[]): RuleFileEntry[] => {
    return rules.flatMap((rule) => FILE_KINDS.flatMap((field) => {
        const path = rule[field];
        if (!path) {
            return [];
        }

        return [{
            ruleId: rule.id,
            field,
            path,
            checked: rule.enabled && rule[FILE_ENABLED_FLAGS[field]],
            ruleDisabled: !rule.enabled,
        }];
    }));
};
