/**
 * @file Per-file helpers shared by the background, options, and popup.
 */

import { InjectionField } from './constants';
import type { InjectionFileField, InjectionRule } from './contracts';

export type { InjectionFileField };

/**
 * Source file fields in display order (JS before CSS).
 */
export const FILE_KINDS: readonly InjectionFileField[] = [
    InjectionField.JsPath,
    InjectionField.CssPath,
];

/**
 * Short chip labels per file field.
 */
export const FILE_KIND_LABELS: Record<InjectionFileField, string> = {
    [InjectionField.JsPath]: 'JS',
    [InjectionField.CssPath]: 'CSS',
};

/**
 * Per-file enabled flag corresponding to each path field.
 */
export const FILE_ENABLED_FLAGS: Record<
    InjectionFileField,
    InjectionField.JsEnabled | InjectionField.CssEnabled
> = {
    [InjectionField.JsPath]: InjectionField.JsEnabled,
    [InjectionField.CssPath]: InjectionField.CssEnabled,
};

/**
 * Checks whether one file of a rule would run right now.
 *
 * @param rule Rule to inspect.
 * @param field Path field to check.
 *
 * @returns Whether the rule is enabled, the path is set, and its flag is on.
 */
export const isFileActive = (rule: InjectionRule, field: InjectionFileField): boolean => {
    return rule.enabled && Boolean(rule[field]) && rule[FILE_ENABLED_FLAGS[field]];
};

/**
 * Checks whether a rule has at least one file that would run right now.
 *
 * @param rule Rule to inspect.
 *
 * @returns Whether any of the rule's files is active.
 */
export const isRuleActive = (rule: InjectionRule): boolean => {
    return FILE_KINDS.some((field) => isFileActive(rule, field));
};
