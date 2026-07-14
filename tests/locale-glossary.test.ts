/**
 * @file
 */

import fs from 'node:fs';
import path from 'node:path';
import { expect, test } from 'vitest';

import { AVAILABLE_LOCALES } from '../src/app/common/locale';

const LOCALES_ROOT = path.join(process.cwd(), 'src/_locales');
const BIDI_CONTROL_PATTERN = /[\u202A-\u202E\u2066-\u2069]/u;

test('catalog glossary keeps protected product, platform, and technical tokens', () => {
    AVAILABLE_LOCALES.forEach((locale) => {
        const filePath = path.join(LOCALES_ROOT, locale, 'messages.json');
        const catalog = JSON.parse(fs.readFileSync(filePath, 'utf8')) as Record<string, { message: string }>;

        expect(catalog.name.message, locale).toBe('Kode Injector');
        expect(catalog.popup_report_issue_title.message, locale).toMatch(/GitHub/u);
        expect(catalog.description.message, locale).toMatch(/JavaScript/u);
        expect(catalog.description.message, locale).toMatch(/CSS/u);
        expect(catalog.form_js_path_required.message, locale).toMatch(/JavaScript/u);
        expect(catalog.form_css_path_required.message, locale).toMatch(/CSS/u);

        Object.entries(catalog).forEach(([key, entry]) => {
            expect(entry.message, `${locale}/${key}`).not.toMatch(BIDI_CONTROL_PATTERN);
        });
    });
});
