/**
 * @file
 */

import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import test from 'node:test';

import { AVAILABLE_LOCALES } from '../src/js/common/locale';

const LOCALES_ROOT = path.join(process.cwd(), 'src/_locales');
const BIDI_CONTROL_PATTERN = /[\u202A-\u202E\u2066-\u2069]/u;

test('catalog glossary keeps protected product, platform, and technical tokens', () => {
    AVAILABLE_LOCALES.forEach((locale) => {
        const filePath = path.join(LOCALES_ROOT, locale, 'messages.json');
        const catalog = JSON.parse(fs.readFileSync(filePath, 'utf8')) as Record<string, { message: string }>;

        assert.equal(catalog.name.message, 'Kode Injector', locale);
        assert.match(catalog.popup_report_issue_title.message, /GitLab/u, locale);
        assert.match(catalog.description.message, /JavaScript/u, locale);
        assert.match(catalog.description.message, /CSS/u, locale);
        assert.match(catalog.form_js_path_required.message, /JavaScript/u, locale);
        assert.match(catalog.form_css_path_required.message, /CSS/u, locale);

        Object.entries(catalog).forEach(([key, entry]) => {
            assert.doesNotMatch(entry.message, BIDI_CONTROL_PATTERN, `${locale}/${key}`);
        });
    });
});
