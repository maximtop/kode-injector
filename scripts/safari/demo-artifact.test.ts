/**
 * @file Tests the built-in demo validator against synthetic resource trees.
 */

/* eslint-disable jsdoc/require-jsdoc, no-param-reassign, func-call-spacing, no-spaced-func */

import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { afterEach, expect, test } from 'vitest';

import { DEMO_RESOURCE_PATHS, DEMO_RUN_TEST_ID } from '../../src/app/common/demo-contracts';
import { validateBuiltInDemoResources } from './demo-artifact';

const VALID_JS = 'const id = "kode-injector-demo";\ndocument.getElementById(id);\n';
const VALID_CSS = ':root { --kode-injector-demo-css: applied; }\nbody { background: #e6f6f1; }\n';
const VALID_BACKGROUND = `fetch("${DEMO_RESOURCE_PATHS.javascript}");fetch("${DEMO_RESOURCE_PATHS.css}");`;
const VALID_OPTIONS = `e.createElement("button",{"data-testid":"${DEMO_RUN_TEST_ID}"})`;
const createdRoots: string[] = [];

type ResourceFiles = Record<string, string>;

const completeResources = (): ResourceFiles => ({
    [DEMO_RESOURCE_PATHS.javascript]: VALID_JS,
    [DEMO_RESOURCE_PATHS.css]: VALID_CSS,
    'background.js': VALID_BACKGROUND,
    'options.js': VALID_OPTIONS,
});

const writeResources = (files: ResourceFiles): string => {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), 'kode-injector-demo-artifact-'));
    createdRoots.push(root);
    for (const [relativePath, content] of Object.entries(files)) {
        const target = path.join(root, relativePath);
        fs.mkdirSync(path.dirname(target), { recursive: true });
        fs.writeFileSync(target, content);
    }
    return root;
};

afterEach(() => {
    createdRoots.splice(0).forEach((root) => fs.rmSync(root, { recursive: true, force: true }));
});

test('accepts a complete built resource tree', () => {
    expect(() => validateBuiltInDemoResources(writeResources(completeResources()))).not.toThrow();
});

test.each<[string, (files: ResourceFiles) => void, RegExp]>([
    ['a missing CSS file', (files) => { delete files[DEMO_RESOURCE_PATHS.css]; }, /Missing Safari built-in demo artifact: demo CSS/u],
    ['JavaScript without the marker', (files) => { files[DEMO_RESOURCE_PATHS.javascript] = 'document.title = "x";'; }, /lacks its Kode Injector marker/u],
    ['JavaScript with a syntax error', (files) => { files[DEMO_RESOURCE_PATHS.javascript] = 'const id = "kode-injector-demo"; if ('; }, /JavaScript does not parse/u],
    ['CSS with a syntax error', (files) => { files[DEMO_RESOURCE_PATHS.css] = ':root { --kode-injector-demo-css: applied; '; }, /CSS does not parse/u],
    ['a background bundle without the demo', (files) => { files['background.js'] = 'noop();'; }, /does not load the built-in demo sources/u],
])('rejects %s', (_name, mutate, message) => {
    const files = completeResources();
    mutate(files);

    expect(() => validateBuiltInDemoResources(writeResources(files))).toThrow(message);
});
