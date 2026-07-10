/**
 * @file
 */

import type { AvailableLocale } from './locale-constants';
import type { CheckLocaleResult } from './locale-types';

const TRADITIONAL_CHINESE_PARTS = new Set(['hant', 'tw', 'hk', 'mo']);
const SIMPLIFIED_CHINESE_PARTS = new Set(['hans', 'cn', 'sg']);

/**
 * Matches a browser locale to one supported locale.
 *
 * @param availableLocales Supported locale directory names.
 * @param locale Browser UI locale.
 *
 * @returns A suitable supported locale or an unsuitable normalized value.
 */
export const checkLocale = (
    availableLocales: readonly AvailableLocale[],
    locale: string | null,
): CheckLocaleResult => {
    if (!locale) {
        return { suitable: false, locale: '' };
    }

    const normalized = locale.toLowerCase().replace(/-/g, '_');
    const lookup = new Map<string, AvailableLocale>(
        availableLocales.map((available) => [available.toLowerCase(), available]),
    );
    const exact = lookup.get(normalized);

    if (exact) {
        return { suitable: true, locale: exact };
    }

    const parts = normalized.split('_');
    if (parts[0] === 'zh') {
        if (parts.some((part) => TRADITIONAL_CHINESE_PARTS.has(part))) {
            return { suitable: false, locale: normalized };
        }

        if (parts.length === 1 || parts.some((part) => SIMPLIFIED_CHINESE_PARTS.has(part))) {
            const simplified = lookup.get('zh_cn');
            if (simplified) {
                return { suitable: true, locale: simplified };
            }
        }

        return { suitable: false, locale: normalized };
    }

    const baseMatch = lookup.get(parts[0]);
    if (baseMatch) {
        return { suitable: true, locale: baseMatch };
    }

    const prefix = `${parts[0]}_`;
    const prefixMatch = availableLocales.find(
        (available) => available.toLowerCase().startsWith(prefix),
    );

    if (prefixMatch) {
        return { suitable: true, locale: prefixMatch };
    }

    return { suitable: false, locale: normalized };
};
