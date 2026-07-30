/**
 * @file Builds the locally installable Safari containing application.
 */

/* eslint-disable no-console */

import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';

const ROOT_PATH = path.resolve(import.meta.dirname, '../..');
const PACKAGE_PATH = path.join(ROOT_PATH, 'package.json');
const SAFARI_PATH = path.join(ROOT_PATH, 'safari');
const PROJECT_PATH = path.join(
    SAFARI_PATH,
    'macos/Kode Injector/Kode Injector.xcodeproj',
);
const EXTENSION_SOURCE_PATH = path.join(
    SAFARI_PATH,
    'macos/Kode Injector/Kode Injector Extension',
);
const GENERATED_HELPER_PATH = path.join(
    EXTENSION_SOURCE_PATH,
    'Helpers/kode-injector-native',
);
const WEB_EXTENSION_PATH = path.join(ROOT_PATH, 'build/dev/safari');
const SAFARI_BUILD_PATH = path.join(ROOT_PATH, 'build/safari');
const DERIVED_DATA_PATH = path.join(SAFARI_BUILD_PATH, 'xcode');
const OUTPUT_PATH = path.join(SAFARI_BUILD_PATH, 'dev');
const APP_NAME = 'Kode Injector.app';
const APP_PATH = path.join(OUTPUT_PATH, APP_NAME);
const EXTENSION_PATH = path.join(
    APP_PATH,
    'Contents/PlugIns/Kode Injector Extension.appex',
);
const EMBEDDED_HELPER_PATH = path.join(
    EXTENSION_PATH,
    'Contents/Helpers/kode-injector-native',
);

/**
 * Package metadata needed by the Safari artifact builder.
 */
interface PackageMetadata {
    /**
     * Product version embedded into every nested executable and bundle.
     */
    version?: unknown;
}

const packageMetadata = JSON.parse(
    fs.readFileSync(PACKAGE_PATH, 'utf8'),
) as PackageMetadata;
if (typeof packageMetadata.version !== 'string'
    || !/^\d+\.\d+\.\d+$/u.test(packageMetadata.version)) {
    throw new Error('package.json must contain an Apple-compatible semantic version');
}
const PACKAGE_VERSION = packageMetadata.version;

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
        PROJECT_PATH,
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
        APP_NAME,
    );
    fs.mkdirSync(OUTPUT_PATH, { recursive: true });
    fs.cpSync(xcodeAppPath, APP_PATH, { recursive: true });

    const extensionResourcesPath = path.join(EXTENSION_PATH, 'Contents/Resources');
    fs.mkdirSync(extensionResourcesPath, { recursive: true });
    fs.cpSync(WEB_EXTENSION_PATH, extensionResourcesPath, { recursive: true });

    sign(
        EMBEDDED_HELPER_PATH,
        path.join(EXTENSION_SOURCE_PATH, 'Kode Injector Native.entitlements'),
    );
    sign(
        EXTENSION_PATH,
        path.join(EXTENSION_SOURCE_PATH, 'Kode Injector Extension.entitlements'),
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
