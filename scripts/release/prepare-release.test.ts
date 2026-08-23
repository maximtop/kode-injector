/**
 * @file Tests the release version bump through its command-line boundary.
 */

/* eslint-disable import/no-extraneous-dependencies, jsdoc/require-jsdoc */

import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {
    afterEach,
    beforeEach,
    expect,
    test,
} from 'vitest';

const SCRIPT_PATH = path.resolve('scripts/release/prepare-release.sh');
const PACKAGE_JSON = `{
    "name": "kode-injector",
    "version": "0.9.1",
    "scripts": {
        "test": "vitest run"
    }
}
`;

let temporaryPath: string;
let packagePath: string;
let outputPath: string;

const runPrepare = (environment: NodeJS.ProcessEnv) => {
    return spawnSync('bash', [SCRIPT_PATH], {
        encoding: 'utf8',
        env: {
            ...process.env,
            VERSION: '0.9.2',
            PACKAGE_JSON_PATH: packagePath,
            EXISTING_TAGS: 'v0.9.0\nv0.9.1',
            GITHUB_OUTPUT: outputPath,
            ...environment,
        },
    });
};

const readOutputs = (): Record<string, string> => Object.fromEntries(
    fs.readFileSync(outputPath, 'utf8')
        .split('\n')
        .filter(Boolean)
        .map((line) => line.split('=') as [string, string]),
);

beforeEach(() => {
    temporaryPath = fs.mkdtempSync(path.join(os.tmpdir(), 'kode-prepare-release-'));
    packagePath = path.join(temporaryPath, 'package.json');
    outputPath = path.join(temporaryPath, 'output.txt');
    fs.writeFileSync(packagePath, PACKAGE_JSON);
    fs.writeFileSync(outputPath, '');
});

afterEach(() => {
    fs.rmSync(temporaryPath, { recursive: true, force: true });
});

test('bumps the version in place, keeps the formatting, and emits outputs', () => {
    const result = runPrepare({});

    expect(result.status).toBe(0);
    expect(fs.readFileSync(packagePath, 'utf8')).toBe(PACKAGE_JSON.replace('0.9.1', '0.9.2'));
    expect(readOutputs()).toEqual({
        version: '0.9.2',
        tag: 'v0.9.2',
    });
});

test.each([
    ['a non-semantic version', { VERSION: '0.9' }, /must match X.Y.Z/u],
    ['the current version', { VERSION: '0.9.1' }, /must be higher than the current 0.9.1/u],
    ['a lower version', { VERSION: '0.8.9' }, /must be higher than the current 0.9.1/u],
    ['an existing tag', { VERSION: '0.9.2', EXISTING_TAGS: 'v0.9.1\nv0.9.2' }, /Tag v0.9.2 already exists/u],
])('rejects %s without touching the manifest', (_name, environment, message) => {
    const result = runPrepare(environment);

    expect(result.status).toBe(1);
    expect(result.stderr).toMatch(message);
    expect(fs.readFileSync(packagePath, 'utf8')).toBe(PACKAGE_JSON);
    expect(fs.readFileSync(outputPath, 'utf8')).toBe('');
});

test('accepts a higher version when no tags exist yet', () => {
    const result = runPrepare({ VERSION: '1.0.0', EXISTING_TAGS: '' });

    expect(result.status).toBe(0);
    expect(readOutputs().tag).toBe('v1.0.0');
});
