/**
 * @file Builds a universal Xcode archive for Mac App Store distribution.
 */

/* eslint-disable no-console */

import fs from 'node:fs';
import path from 'node:path';
import {
    GENERATED_HELPER_PATH,
    ROOT_PATH,
    SAFARI_ARCHIVE_PATH,
    SAFARI_PROJECT_PATH,
    SAFARI_STORE_PATH,
    readAppleTeamIdentifier,
    readPackageVersion,
    run,
    validateBuildNumber,
} from './config';
import { prepareXcodeResources } from './prepare-xcode-resources';

const UNSIGNED_OPTION = '--unsigned';
const args = process.argv.slice(2);
const unsigned = args.includes(UNSIGNED_OPTION);
const unknownArgs = args.filter((arg) => arg !== UNSIGNED_OPTION);
if (unknownArgs.length > 0) {
    throw new Error(`Unknown Safari archive options: ${unknownArgs.join(', ')}`);
}

const packageVersion = readPackageVersion();
const buildNumber = validateBuildNumber(
    process.env.SAFARI_BUILD_NUMBER ?? (unsigned ? '1' : ''),
);
const teamIdentifier = readAppleTeamIdentifier();
const webExtensionPath = path.join(ROOT_PATH, 'build/release/safari');
const helperBuildPath = path.join(SAFARI_STORE_PATH, 'native-helper');
const nativeHostPath = path.join(ROOT_PATH, 'native-host');

/**
 * Builds one architecture of the embedded Go helper.
 *
 * @param architecture Go architecture to build.
 *
 * @returns Path to the generated thin executable.
 */
const buildHelperArchitecture = (architecture: 'amd64' | 'arm64'): string => {
    const outputPath = path.join(helperBuildPath, `kode-injector-native-${architecture}`);
    run('go', [
        'build',
        '-trimpath',
        '-ldflags',
        `-s -w -X=main.hostVersion=${packageVersion}`,
        '-o',
        outputPath,
        './cmd/kode-injector-native',
    ], nativeHostPath, {
        ...process.env,
        CGO_ENABLED: '0',
        GOARCH: architecture,
        GOOS: 'darwin',
    });
    return outputPath;
};

fs.rmSync(SAFARI_ARCHIVE_PATH, { recursive: true, force: true });
fs.rmSync(helperBuildPath, { recursive: true, force: true });
fs.mkdirSync(helperBuildPath, { recursive: true });
fs.mkdirSync(path.dirname(GENERATED_HELPER_PATH), { recursive: true });

run('pnpm', ['release', 'safari']);
prepareXcodeResources(webExtensionPath);
run('swift', ['test', '--package-path', 'safari/native-bridge']);
run('go', ['test', '-race', './...'], nativeHostPath);

const amd64HelperPath = buildHelperArchitecture('amd64');
const arm64HelperPath = buildHelperArchitecture('arm64');
run('lipo', [
    '-create',
    amd64HelperPath,
    arm64HelperPath,
    '-output',
    GENERATED_HELPER_PATH,
]);
fs.chmodSync(GENERATED_HELPER_PATH, 0o755);

try {
    const signingArgs = unsigned
        ? [
            'CODE_SIGNING_ALLOWED=NO',
            'CODE_SIGNING_REQUIRED=NO',
        ]
        : [
            'CODE_SIGN_STYLE=Manual',
            'CODE_SIGN_IDENTITY=Apple Distribution',
        ];
    run('xcodebuild', [
        '-quiet',
        '-project',
        SAFARI_PROJECT_PATH,
        '-scheme',
        'Kode Injector',
        '-configuration',
        'Release',
        '-destination',
        'generic/platform=macOS',
        '-archivePath',
        SAFARI_ARCHIVE_PATH,
        `MARKETING_VERSION=${packageVersion}`,
        `CURRENT_PROJECT_VERSION=${buildNumber}`,
        `DEVELOPMENT_TEAM=${teamIdentifier}`,
        'ARCHS=arm64 x86_64',
        'ONLY_ACTIVE_ARCH=NO',
        ...signingArgs,
        'archive',
    ]);
    console.log(`${unsigned ? 'Unsigned validation' : 'App Store'} archive built:`);
    console.log(SAFARI_ARCHIVE_PATH);
} finally {
    fs.rmSync(GENERATED_HELPER_PATH, { force: true });
    fs.rmSync(helperBuildPath, { recursive: true, force: true });
}
