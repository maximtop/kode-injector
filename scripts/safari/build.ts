/**
 * @file Builds the locally installable Safari containing application.
 */

/* eslint-disable no-console */

import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import {
    GENERATED_HELPER_PATH,
    ROOT_PATH,
    SAFARI_APP_NAME,
    SAFARI_BUILD_PATH,
    SAFARI_EXTENSION_SOURCE_PATH,
    SAFARI_PATH,
    SAFARI_PROJECT_PATH,
    readPackageVersion,
} from './config';
import { prepareXcodeResources } from './prepare-xcode-resources';

const WEB_EXTENSION_PATH = path.join(ROOT_PATH, 'build/dev/safari');
const DERIVED_DATA_PATH = path.join(SAFARI_BUILD_PATH, 'xcode');
const OUTPUT_PATH = path.join(SAFARI_BUILD_PATH, 'dev');
const APP_PATH = path.join(OUTPUT_PATH, SAFARI_APP_NAME);
const EXTENSION_PATH = path.join(
    APP_PATH,
    'Contents/PlugIns/Kode Injector Extension.appex',
);
const EMBEDDED_HELPER_PATH = path.join(
    EXTENSION_PATH,
    'Contents/Helpers/kode-injector-native',
);

const PACKAGE_VERSION = readPackageVersion();

/**
 * Runs one fixed build tool without invoking a shell.
 *
 * @param command Executable name or absolute path.
 * @param args Closed argument list supplied by the build script.
 * @param cwd Working directory for the child process.
 */
const run = (command: string, args: string[], cwd = ROOT_PATH): void => {
    console.log(`$ ${command} ${args.join(' ')}`);
    execFileSync(command, args, { cwd, stdio: 'inherit' });
};

/**
 * Ad-hoc signs one nested Safari artifact with explicit entitlements.
 *
 * @param target Artifact path to sign.
 * @param entitlements Entitlements plist applied to the signature.
 */
const sign = (target: string, entitlements: string): void => {
    run('codesign', [
        '--force',
        '--sign',
        '-',
        '--timestamp=none',
        '--entitlements',
        entitlements,
        target,
    ]);
};

fs.rmSync(OUTPUT_PATH, { recursive: true, force: true });
fs.rmSync(DERIVED_DATA_PATH, { recursive: true, force: true });
fs.mkdirSync(path.dirname(GENERATED_HELPER_PATH), { recursive: true });

run('pnpm', ['dev', 'safari']);
prepareXcodeResources(WEB_EXTENSION_PATH);
run('swift', ['test', '--package-path', 'safari/native-bridge']);
run('go', [
    'build',
    '-trimpath',
    '-ldflags',
    `-s -w -X=main.hostVersion=${PACKAGE_VERSION}`,
    '-o',
    GENERATED_HELPER_PATH,
    './cmd/kode-injector-native',
], path.join(ROOT_PATH, 'native-host'));

try {
    run('xcodebuild', [
        '-project',
        SAFARI_PROJECT_PATH,
        '-scheme',
        'Kode Injector',
        '-configuration',
        'Debug',
        '-derivedDataPath',
        DERIVED_DATA_PATH,
        `MARKETING_VERSION=${PACKAGE_VERSION}`,
        'CODE_SIGNING_ALLOWED=NO',
        'build',
    ]);

    const xcodeAppPath = path.join(
        DERIVED_DATA_PATH,
        'Build/Products/Debug',
        SAFARI_APP_NAME,
    );
    fs.mkdirSync(OUTPUT_PATH, { recursive: true });
    fs.cpSync(xcodeAppPath, APP_PATH, { recursive: true });

    sign(
        EMBEDDED_HELPER_PATH,
        path.join(SAFARI_EXTENSION_SOURCE_PATH, 'Kode Injector Native.entitlements'),
    );
    sign(
        EXTENSION_PATH,
        path.join(SAFARI_EXTENSION_SOURCE_PATH, 'Kode Injector Extension.entitlements'),
    );
    sign(
        APP_PATH,
        path.join(SAFARI_PATH, 'macos/Kode Injector/Kode Injector/Kode Injector.entitlements'),
    );
    run('codesign', ['--verify', '--strict', APP_PATH]);
    console.log(`Safari app built: ${APP_PATH}`);
} finally {
    fs.rmSync(GENERATED_HELPER_PATH, { force: true });
}
