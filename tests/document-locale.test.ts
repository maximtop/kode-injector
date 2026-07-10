/**
 * @file
 */

import assert from 'node:assert/strict';
import test from 'node:test';

import { applyDocumentLocale } from '../src/js/common/document-locale';

test('applyDocumentLocale updates title, language, and direction', () => {
    const target = {
        title: '',
        documentElement: { lang: '', dir: '' },
    } as unknown as Document;

    applyDocumentLocale(target, 'pt-BR', 'ltr', 'Configurações do Kode Injector');

    assert.equal(target.title, 'Configurações do Kode Injector');
    assert.equal(target.documentElement.lang, 'pt-BR');
    assert.equal(target.documentElement.dir, 'ltr');
});
