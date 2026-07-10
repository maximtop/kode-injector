/**
 * @file
 */

import { expect, test } from 'vitest';

import { applyDocumentLocale } from '../src/app/common/document-locale';

test('applyDocumentLocale updates title, language, and direction', () => {
    const target = {
        title: '',
        documentElement: { lang: '', dir: '' },
    } as unknown as Document;

    applyDocumentLocale(target, 'pt-BR', 'ltr', 'Configurações do Kode Injector');

    expect(target.title).toBe('Configurações do Kode Injector');
    expect(target.documentElement.lang).toBe('pt-BR');
    expect(target.documentElement.dir).toBe('ltr');
});
