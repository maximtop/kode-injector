import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

import { expect, test } from 'vitest';

import { validateLocales } from '../scripts/locales/validate';

const makeFixture = (options: {
    locales: Record<string, unknown>;
    manifest?: string;
    source?: string;
}): string => {
    const rootPath = fs.mkdtempSync(path.join(os.tmpdir(), 'kode-locale-validator-'));
    const localesPath = path.join(rootPath, 'src/_locales');
    fs.mkdirSync(localesPath, { recursive: true });
    for (const [locale, catalog] of Object.entries(options.locales)) {
        const localePath = path.join(localesPath, locale);
        fs.mkdirSync(localePath, { recursive: true });
        fs.writeFileSync(path.join(localePath, 'messages.json'), JSON.stringify(catalog));
    }
    fs.mkdirSync(path.join(rootPath, 'src/app/options/components'), { recursive: true });
    fs.writeFileSync(path.join(rootPath, 'src/manifest.json'), options.manifest ?? '');
    fs.writeFileSync(
        path.join(rootPath, 'src/app/options/components/Sample.tsx'),
        options.source ?? "translator.getMessage('options_title');",
    );
    return rootPath;
};

const catalog = (entries: Record<string, string>): Record<string, unknown> => {
    return Object.fromEntries(
        Object.entries(entries).map(([key, message]) => [key, { message, description: `Description for ${key}` }]),
    );
};

test('reports catalog, usage, and hardcoded UI defects', () => {
    const rootPath = makeFixture({
        locales: {
            en: catalog({
                name: 'Kode Injector',
                options_title: 'Settings',
                popup_title: 'Popup',
                unused_key: 'Unused',
            }),
            ru: {
                name: { message: 'Kode Injector' },
                popup_title: { message: '' },
                obsolete_key: { message: 'Old' },
            },
            zz: catalog({
                name: 'Kode Injector',
                options_title: 'Настройки',
                popup_title: 'Всплывающее окно',
                unused_key: 'Не используется',
            }),
        },
        manifest: '{"name":"__MSG_name__","options":"__MSG_options_title__"}',
        source: [
            "import { translator } from '../../../common/translator';",
            'export const Sample = () => (',
            '    <div>',
            '        <button title="Save">{translator.getMessage(\'popup_title\')}</button>',
            '    </div>',
            ');',
        ].join('\n'),
    });

    const errors = validateLocales({ rootPath, expectedLocales: ['en', 'ru', 'de'] });
    expect(errors).toContain('Missing locale directory: de');
    expect(errors).toContain('Unexpected locale directory: zz');
    expect(errors).toContain('ru: missing key options_title');
    expect(errors).toContain('ru: empty message popup_title');
    expect(errors).toContain('ru: unexpected key obsolete_key');
    expect(errors).toContain('Unused English message: unused_key');
    expect(errors.some((error) => {
        return error.includes('Hardcoded UI string: src/app/options/components/Sample.tsx:4 "Save"');
    })).toBe(true);
});

test('reports a malformed locale catalog as invalid JSON instead of throwing', () => {
    const rootPath = makeFixture({
        locales: {
            en: catalog({ name: 'Kode Injector', options_title: 'Settings' }),
            ru: catalog({ name: 'Kode Injector', options_title: 'Настройки' }),
        },
        manifest: '{"name":"__MSG_name__"}',
    });
    fs.writeFileSync(path.join(rootPath, 'src/_locales/ru/messages.json'), '{not valid json');

    const errors = validateLocales({ rootPath, expectedLocales: ['en', 'ru'] });

    expect(errors.some((error) => (
        error.includes('messages.json') && error.includes('invalid JSON')
    ))).toBe(true);
});

test('reports a translation whose tag placeholders do not match the base message', () => {
    const rootPath = makeFixture({
        locales: {
            en: catalog({ name: 'Kode Injector', options_title: 'Read <a>more</a>' }),
            ru: catalog({ name: 'Kode Injector', options_title: 'Подробнее' }),
        },
        manifest: '{"name":"__MSG_name__"}',
        source: "import { translator } from '../../../common/translator';\ntranslator.getMessage('options_title');",
    });

    const errors = validateLocales({ rootPath, expectedLocales: ['en', 'ru'] });

    expect(errors).toContain('ru: invalid formatter structure for options_title');
});

test('accepts a complete fixture with matching usage', () => {
    const rootPath = makeFixture({
        locales: {
            en: catalog({ name: 'Kode Injector', options_title: 'Settings' }),
            ru: catalog({ name: 'Kode Injector', options_title: 'Настройки' }),
        },
        manifest: '{"name":"__MSG_name__"}',
        source: "import { translator } from '../../../common/translator';\ntranslator.getMessage('options_title');",
    });

    expect(validateLocales({ rootPath, expectedLocales: ['en', 'ru'] })).toEqual([]);
});
