/**
 * @file Tests notarization authentication selection without invoking Apple tools.
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

const SCRIPT_PATH = path.resolve('scripts/native-host/notarize.sh');
const APPLE_ENVIRONMENT_KEYS = [
    'APPLE_DEVELOPER_ID',
    'APPLE_NOTARY_PROFILE',
    'APPLE_NOTARY_KEY_PATH',
    'APPLE_NOTARY_KEY_ID',
    'APPLE_NOTARY_ISSUER_ID',
];

let temporaryPath: string;
let binaryPath: string;
let dmgPath: string;
let commandLogPath: string;

const createExecutable = (name: string, source: string): void => {
    const executablePath = path.join(binaryPath, name);
    fs.writeFileSync(executablePath, source, { mode: 0o700 });
};

const runNotarize = (environment: NodeJS.ProcessEnv) => {
    const childEnvironment = { ...process.env };
    APPLE_ENVIRONMENT_KEYS.forEach((key) => {
        delete childEnvironment[key];
    });
    return spawnSync('sh', [SCRIPT_PATH, dmgPath], {
        encoding: 'utf8',
        env: {
            ...childEnvironment,
            PATH: `${binaryPath}:${childEnvironment.PATH}`,
            COMMAND_LOG_PATH: commandLogPath,
            APPLE_DEVELOPER_ID: 'Developer ID Application: Example',
            ...environment,
        },
    });
};

beforeEach(() => {
    temporaryPath = fs.mkdtempSync(path.join(os.tmpdir(), 'notarize-test-'));
    binaryPath = path.join(temporaryPath, 'bin');
    dmgPath = path.join(temporaryPath, 'package.dmg');
    commandLogPath = path.join(temporaryPath, 'commands.log');
    fs.mkdirSync(binaryPath);
    fs.writeFileSync(dmgPath, 'dmg');
    createExecutable('hdiutil', `#!/bin/sh
case "$1" in
    attach)
        while [ "$#" -gt 0 ]; do
            if [ "$1" = "-mountpoint" ]; then
                shift
                mkdir -p "$1"
                : > "$1/kode-injector-native"
                : > "$1/kode-injector-installer"
            fi
            shift
        done
        ;;
    create)
        for argument do output=$argument; done
        : > "$output"
        ;;
esac
`);
    createExecutable('codesign', '#!/bin/sh\nexit 0\n');
    createExecutable('spctl', '#!/bin/sh\nexit 0\n');
    createExecutable('xcrun', `#!/bin/sh
printf '%s\\n' "$*" >> "$COMMAND_LOG_PATH"
`);
});

afterEach(() => {
    fs.rmSync(temporaryPath, { recursive: true, force: true });
});

test('uses a keychain profile as the only configured auth mode', () => {
    const result = runNotarize({ APPLE_NOTARY_PROFILE: 'kode-injector' });

    expect(result.status).toBe(0);
    expect(fs.readFileSync(commandLogPath, 'utf8')).toContain(
        'notarytool submit',
    );
    expect(fs.readFileSync(commandLogPath, 'utf8')).toContain(
        '--keychain-profile kode-injector --wait',
    );
});

test('uses complete direct API key credentials as the only configured auth mode', () => {
    const keyPath = path.join(temporaryPath, 'AuthKey.p8');
    fs.writeFileSync(keyPath, 'private key');

    const result = runNotarize({
        APPLE_NOTARY_KEY_PATH: keyPath,
        APPLE_NOTARY_KEY_ID: 'KEYID',
        APPLE_NOTARY_ISSUER_ID: 'ISSUER',
    });

    expect(result.status).toBe(0);
    expect(fs.readFileSync(commandLogPath, 'utf8')).toContain(
        `--key ${keyPath} --key-id KEYID --issuer ISSUER --wait`,
    );
});

test('rejects mixed profile and direct authentication before signing', () => {
    const result = runNotarize({
        APPLE_NOTARY_PROFILE: 'kode-injector',
        APPLE_NOTARY_KEY_PATH: '/tmp/AuthKey.p8',
    });

    expect(result.status).not.toBe(0);
    expect(result.stderr).toContain('configure exactly one notarization auth mode');
    expect(fs.existsSync(commandLogPath)).toBe(false);
});

test('rejects partial direct authentication before signing', () => {
    const result = runNotarize({
        APPLE_NOTARY_KEY_ID: 'KEYID',
        APPLE_NOTARY_ISSUER_ID: 'ISSUER',
    });

    expect(result.status).not.toBe(0);
    expect(result.stderr).toContain(
        'direct notarization auth requires APPLE_NOTARY_KEY_PATH, APPLE_NOTARY_KEY_ID, and APPLE_NOTARY_ISSUER_ID',
    );
    expect(fs.existsSync(commandLogPath)).toBe(false);
});

test('rejects a missing notarization auth mode before signing', () => {
    const result = runNotarize({});

    expect(result.status).not.toBe(0);
    expect(result.stderr).toContain('configure exactly one notarization auth mode');
    expect(fs.existsSync(commandLogPath)).toBe(false);
});
