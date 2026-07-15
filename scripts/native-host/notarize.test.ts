/**
 * @file Tests the complete macOS signing and notarization sequence without
 * invoking Apple tools.
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
const MOCK_ENVIRONMENT_KEYS = [
    'MOCK_APP_NOTARY_STATUS',
    'MOCK_APP_NOTARY_LOG_STATUS',
    'MOCK_DMG_NOTARY_STATUS',
    'MOCK_DMG_NOTARY_LOG_STATUS',
    'MOCK_MAIN_ARCHITECTURE',
    'MOCK_HOST_ARCHITECTURE',
    'MOCK_INSTALLER_ARCHITECTURE',
    'MOCK_FINAL_MAIN_ARCHITECTURE',
    'MOCK_FINAL_HOST_ARCHITECTURE',
    'MOCK_FINAL_INSTALLER_ARCHITECTURE',
];
const APP_NAME = 'Kode Injector Helper.app';

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
    [...APPLE_ENVIRONMENT_KEYS, ...MOCK_ENVIRONMENT_KEYS].forEach((key) => {
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

const readCommands = (): string[] => {
    if (!fs.existsSync(commandLogPath)) {
        return [];
    }
    return fs.readFileSync(commandLogPath, 'utf8').trim().split('\n');
};

const expectCommandsInOrder = (commands: string[], expected: string[]): void => {
    let commandIndex = -1;
    expected.forEach((fragment) => {
        commandIndex = commands.findIndex((command, index) => {
            return index > commandIndex && command.includes(fragment);
        });
        expect(commandIndex, `missing command after previous match: ${fragment}`)
            .toBeGreaterThanOrEqual(0);
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
printf '%s\\n' "hdiutil $*" >> "$COMMAND_LOG_PATH"
case "$1" in
    attach)
        mount_path=
        while [ "$#" -gt 0 ]; do
            if [ "$1" = "-mountpoint" ]; then
                shift
                mount_path=$1
            fi
            shift
        done
        app_path="$mount_path/${APP_NAME}"
        mkdir -p "$app_path/Contents/MacOS" "$app_path/Contents/Helpers"
        : > "$app_path/Contents/MacOS/Kode Injector Helper"
        : > "$app_path/Contents/Helpers/kode-injector-native"
        : > "$app_path/Contents/Helpers/kode-injector-installer"
        chmod 700 "$app_path/Contents/MacOS/Kode Injector Helper" \\
            "$app_path/Contents/Helpers/kode-injector-native" \\
            "$app_path/Contents/Helpers/kode-injector-installer"
        ln -s /Applications "$mount_path/Applications"
        ;;
    create)
        for argument do output=$argument; done
        : > "$output"
        ;;
esac
`);
    createExecutable('codesign', `#!/bin/sh
printf '%s\\n' "codesign $*" >> "$COMMAND_LOG_PATH"
`);
    createExecutable('ditto', `#!/bin/sh
printf '%s\\n' "ditto $*" >> "$COMMAND_LOG_PATH"
for argument do output=$argument; done
: > "$output"
`);
    createExecutable('lipo', `#!/bin/sh
printf '%s\\n' "lipo $*" >> "$COMMAND_LOG_PATH"
for argument do executable_path=$argument; done
case "$executable_path" in
    *final-mount*/Contents/MacOS/*)
        printf '%s\\n' "\${MOCK_FINAL_MAIN_ARCHITECTURE:-\${MOCK_MAIN_ARCHITECTURE:-x86_64}}"
        ;;
    *final-mount*/Contents/Helpers/kode-injector-native)
        printf '%s\\n' "\${MOCK_FINAL_HOST_ARCHITECTURE:-\${MOCK_HOST_ARCHITECTURE:-x86_64}}"
        ;;
    *final-mount*/Contents/Helpers/kode-injector-installer)
        printf '%s\\n' "\${MOCK_FINAL_INSTALLER_ARCHITECTURE:-\${MOCK_INSTALLER_ARCHITECTURE:-x86_64}}"
        ;;
    */Contents/MacOS/*)
        printf '%s\\n' "\${MOCK_MAIN_ARCHITECTURE:-x86_64}"
        ;;
    */Contents/Helpers/kode-injector-native)
        printf '%s\\n' "\${MOCK_HOST_ARCHITECTURE:-x86_64}"
        ;;
    */Contents/Helpers/kode-injector-installer)
        printf '%s\\n' "\${MOCK_INSTALLER_ARCHITECTURE:-x86_64}"
        ;;
esac
`);
    createExecutable('plutil', `#!/bin/sh
for argument do result_path=$argument; done
case "$2" in
    id)
        /usr/bin/sed -E 's/.*"id":"([^"]+)".*/\\1/' "$result_path"
        ;;
    status)
        /usr/bin/sed -E 's/.*"status":"([^"]+)".*/\\1/' "$result_path"
        ;;
esac
`);
    createExecutable('spctl', `#!/bin/sh
printf '%s\\n' "spctl $*" >> "$COMMAND_LOG_PATH"
`);
    createExecutable('syspolicy_check', `#!/bin/sh
printf '%s\\n' "syspolicy_check $*" >> "$COMMAND_LOG_PATH"
`);
    createExecutable('xcrun', `#!/bin/sh
printf '%s\\n' "xcrun $*" >> "$COMMAND_LOG_PATH"
if [ "$1" = "notarytool" ] && [ "$2" = "submit" ]; then
    case "$3" in
        *.zip)
            printf '{"id":"app-submission","status":"%s"}\\n' \\
                "\${MOCK_APP_NOTARY_STATUS:-Accepted}"
            ;;
        *.dmg)
            printf '{"id":"dmg-submission","status":"%s"}\\n' \\
                "\${MOCK_DMG_NOTARY_STATUS:-Accepted}"
            ;;
    esac
elif [ "$1" = "notarytool" ] && [ "$2" = "log" ]; then
    case "$3" in
        app-submission)
            printf '{"status":"%s","issues":[]}\\n' \\
                "\${MOCK_APP_NOTARY_LOG_STATUS:-\${MOCK_APP_NOTARY_STATUS:-Accepted}}"
            ;;
        dmg-submission)
            printf '{"status":"%s","issues":[]}\\n' \\
                "\${MOCK_DMG_NOTARY_LOG_STATUS:-\${MOCK_DMG_NOTARY_STATUS:-Accepted}}"
            ;;
    esac
fi
`);
});

afterEach(() => {
    fs.rmSync(temporaryPath, { recursive: true, force: true });
});

test('signs nested code inside-out and notarizes the app before the disk image', () => {
    const result = runNotarize({ APPLE_NOTARY_PROFILE: 'kode-injector' });

    expect(result.status, result.stderr).toBe(0);
    const commands = readCommands();
    expectCommandsInOrder(commands, [
        'codesign --verify --deep --strict',
        'ditto -c -k --keepParent',
        'app.zip --keychain-profile kode-injector',
        'xcrun notarytool log app-submission',
        'xcrun stapler staple',
        'xcrun stapler validate',
        'syspolicy_check distribution',
        'spctl --assess --type execute',
        'hdiutil create',
        'codesign --force --timestamp --sign Developer ID Application: Example',
        `xcrun notarytool submit ${dmgPath}`,
        'xcrun notarytool log dmg-submission',
        `xcrun stapler staple ${dmgPath}`,
        `xcrun stapler validate ${dmgPath}`,
        `spctl --assess --type open --context context:primary-signature ${dmgPath}`,
        'hdiutil attach -quiet -nobrowse -readonly',
        'codesign --verify --deep --strict',
        'spctl --assess --type execute',
    ]);

    const signingCommands = commands.filter((command) => {
        return command.startsWith('codesign --force');
    });
    expect(signingCommands).toHaveLength(4);
    expect(signingCommands[0]).toMatch(
        /Contents\/Helpers\/kode-injector-native$/u,
    );
    expect(signingCommands[1]).toMatch(
        /Contents\/Helpers\/kode-injector-installer$/u,
    );
    expect(signingCommands[2]).toMatch(/Kode Injector Helper\.app$/u);
    expect(signingCommands[3]).toBe(
        `codesign --force --timestamp --sign Developer ID Application: Example ${dmgPath}`,
    );
    signingCommands.forEach((command) => {
        expect(command).not.toContain('--deep');
    });

    const finalAttachIndex = commands.findIndex((command) => {
        return command.startsWith('hdiutil attach')
            && command.includes('final-mount');
    });
    const finalCommands = commands.slice(finalAttachIndex);
    expect(finalAttachIndex).toBeGreaterThanOrEqual(0);
    expect(finalCommands.some((command) => command.startsWith(
        'codesign --verify --strict',
    ) && command.endsWith('Contents/Helpers/kode-injector-native'))).toBe(true);
    expect(finalCommands.some((command) => command.startsWith(
        'codesign --verify --strict',
    ) && command.endsWith('Contents/Helpers/kode-injector-installer'))).toBe(true);
    expect(finalCommands.some((command) => command.startsWith(
        'xcrun stapler validate',
    ) && command.endsWith(APP_NAME))).toBe(true);
    expect(finalCommands.filter((command) => {
        return command.startsWith('lipo -archs');
    })).toHaveLength(3);
});

test('uses a keychain profile for both notarization submissions', () => {
    const result = runNotarize({ APPLE_NOTARY_PROFILE: 'kode-injector' });

    expect(result.status, result.stderr).toBe(0);
    const submissions = readCommands().filter((command) => {
        return command.startsWith('xcrun notarytool submit');
    });
    expect(submissions).toHaveLength(2);
    submissions.forEach((submission) => {
        expect(submission).toContain('--keychain-profile kode-injector');
        expect(submission).toContain('--wait --output-format json');
    });
});

test('uses direct API credentials for both notarization submissions', () => {
    const keyPath = path.join(temporaryPath, 'AuthKey.p8');
    fs.writeFileSync(keyPath, 'private key');

    const result = runNotarize({
        APPLE_NOTARY_KEY_PATH: keyPath,
        APPLE_NOTARY_KEY_ID: 'KEYID',
        APPLE_NOTARY_ISSUER_ID: 'ISSUER',
    });

    expect(result.status, result.stderr).toBe(0);
    const submissions = readCommands().filter((command) => {
        return command.startsWith('xcrun notarytool submit');
    });
    expect(submissions).toHaveLength(2);
    submissions.forEach((submission) => {
        expect(submission).toContain(
            `--key ${keyPath} --key-id KEYID --issuer ISSUER`,
        );
        expect(submission).toContain('--wait --output-format json');
    });
});

test('rejects a notarization log whose status disagrees with the result', () => {
    const result = runNotarize({
        APPLE_NOTARY_PROFILE: 'kode-injector',
        MOCK_APP_NOTARY_LOG_STATUS: 'Rejected',
    });

    expect(result.status).not.toBe(0);
    expect(result.stderr).toContain(
        'app notarization result and log statuses do not match',
    );
});

test('stops before rebuilding the disk image when app notarization is rejected', () => {
    const result = runNotarize({
        APPLE_NOTARY_PROFILE: 'kode-injector',
        MOCK_APP_NOTARY_STATUS: 'Rejected',
    });

    expect(result.status).not.toBe(0);
    expect(result.stderr).toContain('app notarization status is Rejected');
    const commands = readCommands();
    expect(commands.some((command) => command.includes(
        'xcrun notarytool log app-submission',
    ))).toBe(true);
    expect(commands.some((command) => command.startsWith('hdiutil create')))
        .toBe(false);
    expect(commands.filter((command) => command.startsWith(
        'xcrun notarytool submit',
    ))).toHaveLength(1);
});

test('requires an accepted disk-image notarization before stapling', () => {
    const result = runNotarize({
        APPLE_NOTARY_PROFILE: 'kode-injector',
        MOCK_DMG_NOTARY_STATUS: 'Rejected',
    });

    expect(result.status).not.toBe(0);
    expect(result.stderr).toContain('disk-image notarization status is Rejected');
    const commands = readCommands();
    expect(commands.filter((command) => command.startsWith(
        'xcrun notarytool submit',
    ))).toHaveLength(2);
    expect(commands.some((command) => command.includes(
        'xcrun notarytool log dmg-submission',
    ))).toBe(true);
    expect(commands.some((command) => command === `xcrun stapler staple ${dmgPath}`))
        .toBe(false);
    expect(commands.filter((command) => command.startsWith('hdiutil attach')))
        .toHaveLength(1);
});

test('rejects inconsistent nested architectures before signing', () => {
    const result = runNotarize({
        APPLE_NOTARY_PROFILE: 'kode-injector',
        MOCK_HOST_ARCHITECTURE: 'arm64',
    });

    expect(result.status).not.toBe(0);
    expect(result.stderr).toContain('must contain only x86_64');
    expect(readCommands().some((command) => command.startsWith('codesign')))
        .toBe(false);
});

test('rejects a multiple-architecture executable before signing', () => {
    const result = runNotarize({
        APPLE_NOTARY_PROFILE: 'kode-injector',
        MOCK_MAIN_ARCHITECTURE: 'x86_64 arm64',
    });

    expect(result.status).not.toBe(0);
    expect(result.stderr).toContain('must contain exactly one architecture');
    expect(readCommands().some((command) => command.startsWith('codesign')))
        .toBe(false);
});

test('rechecks architecture from the final mounted disk image', () => {
    const result = runNotarize({
        APPLE_NOTARY_PROFILE: 'kode-injector',
        MOCK_FINAL_INSTALLER_ARCHITECTURE: 'arm64',
    });

    expect(result.status).not.toBe(0);
    expect(result.stderr).toContain('must contain only x86_64');
    expect(readCommands().some((command) => {
        return command.includes('lipo -archs')
            && command.includes('final-mount');
    })).toBe(true);
});

test('rejects mixed profile and direct authentication before signing', () => {
    const result = runNotarize({
        APPLE_NOTARY_PROFILE: 'kode-injector',
        APPLE_NOTARY_KEY_PATH: '/tmp/AuthKey.p8',
    });

    expect(result.status).not.toBe(0);
    expect(result.stderr).toContain('configure exactly one notarization auth mode');
    expect(readCommands()).toEqual([]);
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
    expect(readCommands()).toEqual([]);
});

test('rejects a missing notarization auth mode before signing', () => {
    const result = runNotarize({});

    expect(result.status).not.toBe(0);
    expect(result.stderr).toContain('configure exactly one notarization auth mode');
    expect(readCommands()).toEqual([]);
});
