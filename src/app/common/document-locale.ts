/**
 * @file
 */

import type { TextDirection } from './locale/locale-types';

/**
 * Applies translated document metadata.
 *
 * @param target Document to update.
 * @param htmlLanguage Active language tag.
 * @param direction Active text direction.
 * @param title Translated document title.
 */
export const applyDocumentLocale = (
    target: Document,
    htmlLanguage: string,
    direction: TextDirection,
    title: string,
): void => {
    const documentRef = target;
    documentRef.title = title;
    documentRef.documentElement.lang = htmlLanguage;
    documentRef.documentElement.dir = direction;
};
