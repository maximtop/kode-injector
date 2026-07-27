/**
 * @file Tests store-release resolution through its command-line boundary.
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

const SCRIPT_PATH = path.resolve('scripts/release/resolve-store-release.sh');

let temporaryPath: string;
let binaryPath: string;
let outputPath: string;
let commandLogPath: string;

const runResolver = (environment: NodeJS.ProcessEnv) => {
    return spawnSync('bash', [SCRIPT_PATH], {
        encoding: 'utf8',
        env: {
            ...process.env,
            PATH: `${binaryPath}:${process.env.PATH}`,
            EVENT_NAME: 'workflow_dispatch',
            EVENT_TAG: '',
            INPUT_TAG: 'v1.2.3',
            GITHUB_REPOSITORY: 'example/kode-injector',
            GITHUB_OUTPUT: outputPath,
            COMMAND_LOG_PATH: commandLogPath,
            MOCK_RELEASE_JSON: '{"isDraft":false,"isPrerelease":false}',
            MOCK_GH_EXIT_CODE: '0',
            ...environment,
        },
    });
};

const readOutputs = (): string[] => {
    if (!fs.existsSync(outputPath)) {
        return [];
    }
    return fs.readFileSync(outputPath, 'utf8').trim().split('\n');
};

beforeEach(() => {
    temporaryPath = fs.mkdtempSync(path.join(os.tmpdir(), 'store-release-test-'));
    binaryPath = path.join(temporaryPath, 'bin');
    outputPath = path.join(temporaryPath, 'github-output');
    commandLogPath = path.join(temporaryPath, 'commands.log');
    fs.mkdirSync(binaryPath);
    fs.writeFileSync(path.join(binaryPath, 'gh'), `#!/usr/bin/env bash
printf '%s\\n' "$*" >> "$COMMAND_LOG_PATH"
if [[ "$MOCK_GH_EXIT_CODE" != 0 ]]; then
    exit "$MOCK_GH_EXIT_CODE"
fi
printf '%s\\n' "$MOCK_RELEASE_JSON"
`, { mode: 0o700 });
});

afterEach(() => {
    fs.rmSync(temporaryPath, { force: true, recursive: true });
});

test('resolves a published release selected by a manual deployment', () => {
    const result = runResolver({});

    expect(result.status).toBe(0);
    expect(readOutputs()).toEqual([
        'deploy=true',
        'tag=v1.2.3',
        'version=1.2.3',
    ]);
    expect(fs.readFileSync(commandLogPath, 'utf8')).toContain(
        'release view v1.2.3 --repo example/kode-injector',
    );
});

test('skips an unsupported tag received from a release event', () => {
    const result = runResolver({
        EVENT_NAME: 'release',
        EVENT_TAG: 'nightly',
        INPUT_TAG: '',
    });

    expect(result.status).toBe(0);
    expect(result.stdout).toContain('skipping store deployment');
    expect(readOutputs()).toEqual(['deploy=false']);
    expect(fs.existsSync(commandLogPath)).toBe(false);
});

test('resolves the tag supplied by a release event', () => {
    const result = runResolver({
        EVENT_NAME: 'release',
        EVENT_TAG: 'v4.5.6',
        INPUT_TAG: 'v1.2.3',
    });

    expect(result.status).toBe(0);
    expect(readOutputs()).toEqual([
        'deploy=true',
        'tag=v4.5.6',
        'version=4.5.6',
    ]);
});

test('rejects an invalid manually selected tag', () => {
    const result = runResolver({ INPUT_TAG: '1.2.3' });

    expect(result.status).not.toBe(0);
    expect(result.stderr).toContain('Release tag must match vX.Y.Z');
    expect(readOutputs()).toEqual([]);
});

test.each([
    ['draft', '{"isDraft":true,"isPrerelease":false}'],
    ['pre-release', '{"isDraft":false,"isPrerelease":true}'],
])('rejects a %s GitHub release', (kind, releaseJson) => {
    const result = runResolver({ MOCK_RELEASE_JSON: releaseJson });

    expect(result.status).not.toBe(0);
    expect(result.stderr).toContain(`Release v1.2.3 is a ${kind}`);
    expect(readOutputs()).toEqual([]);
});

test('rejects an unexpected workflow event', () => {
    const result = runResolver({ EVENT_NAME: 'push' });

    expect(result.status).not.toBe(0);
    expect(result.stderr).toContain('Unsupported store deployment event: push');
    expect(fs.existsSync(commandLogPath)).toBe(false);
});

test('fails closed when GitHub release lookup fails', () => {
    const result = runResolver({ MOCK_GH_EXIT_CODE: '23' });

    expect(result.status).toBe(23);
    expect(readOutputs()).toEqual([]);
});
