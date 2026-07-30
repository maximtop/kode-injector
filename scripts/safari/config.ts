/**
 * @file Shared build configuration for the Safari containing application.
 */

/* eslint-disable no-console */

import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';

export const ROOT_PATH = path.resolve(import.meta.dirname, '../..');
export const SAFARI_PATH = path.join(ROOT_PATH, 'safari');
export const SAFARI_PROJECT_PATH = path.join(
    SAFARI_PATH,
    'macos/Kode Injector/Kode Injector.xcodeproj',
);
export const SAFARI_EXTENSION_SOURCE_PATH = path.join(
    SAFARI_PATH,
    'macos/Kode Injector/Kode Injector Extension',
);
export const GENERATED_HELPER_PATH = path.join(
    SAFARI_EXTENSION_SOURCE_PATH,
    'Helpers/kode-injector-native',
);
export const SAFARI_BUILD_PATH = path.join(ROOT_PATH, 'build/safari');
export const SAFARI_STORE_PATH = path.join(SAFARI_BUILD_PATH, 'store');
export const SAFARI_ARCHIVE_PATH = path.join(
    SAFARI_STORE_PATH,
    'Kode Injector.xcarchive',
);
export const SAFARI_APP_NAME = 'Kode Injector.app';
export const SAFARI_APP_BUNDLE_IDENTIFIER = 'dev.maximtop.kode-injector.safari';
export const SAFARI_EXTENSION_BUNDLE_IDENTIFIER = 'dev.maximtop.kode-injector.safari.Extension';
export const SAFARI_APP_CATEGORY = 'public.app-category.developer-tools';
export const APPLE_TEAM_IDENTIFIER = 'WF967PV46P';
export const SAFARI_APP_STORE_APP_PROFILE = 'Kode Injector Mac App Store';
export const SAFARI_APP_STORE_EXTENSION_PROFILE = 'Kode Injector Safari Extension Mac App Store';

/**
 * Package metadata consumed by the native build scripts.
 */
interface PackageMetadata {
    /**
     * Public product version embedded into all Safari artifacts.
     */
    version?: unknown;
}

/**
 * Reads and validates the public product version from package.json.
 *
 * @returns Apple-compatible three-component product version.
 *
 * @throws When package.json does not contain a valid product version.
 */
export const readPackageVersion = (): string => {
    const packagePath = path.join(ROOT_PATH, 'package.json');
    const metadata = JSON.parse(fs.readFileSync(packagePath, 'utf8')) as PackageMetadata;
    if (typeof metadata.version !== 'string'
        || !/^\d+\.\d+\.\d+$/u.test(metadata.version)) {
        throw new Error('package.json must contain an Apple-compatible semantic version');
    }
    return metadata.version;
};

/**
 * Validates an Apple bundle build number.
 *
 * @param value Candidate build number.
 *
 * @returns Validated one-to-three-component build number.
 *
 * @throws When the build number is not accepted by Apple bundle metadata.
 */
export const validateBuildNumber = (value: string): string => {
    if (!/^[1-9]\d*(?:\.\d+){0,2}$/u.test(value)) {
        throw new Error(
            'SAFARI_BUILD_NUMBER must contain one to three integer components and start above zero',
        );
    }
    const [major, minor, patch] = value.split('.').map(Number);
    if (major > 9999 || (minor ?? 0) > 99 || (patch ?? 0) > 99) {
        throw new Error(
            'SAFARI_BUILD_NUMBER components exceed Apple limits of four, two, and two digits',
        );
    }
    return value;
};

/**
 * Reads the configured Apple Developer team identifier.
 *
 * @returns Validated Apple team identifier.
 *
 * @throws When an override is not a ten-character identifier.
 */
export const readAppleTeamIdentifier = (): string => {
    const teamIdentifier = process.env.APPLE_TEAM_ID ?? APPLE_TEAM_IDENTIFIER;
    if (!/^[A-Z0-9]{10}$/u.test(teamIdentifier)) {
        throw new Error('APPLE_TEAM_ID must be a ten-character Apple team identifier');
    }
    return teamIdentifier;
};

/**
 * Runs one fixed build tool without invoking a shell.
 *
 * @param command Executable name or absolute path.
 * @param args Closed argument list supplied by the build script.
 * @param cwd Working directory for the child process.
 * @param env Optional environment additions for the child process.
 */
export const run = (
    command: string,
    args: string[],
    cwd = ROOT_PATH,
    env: NodeJS.ProcessEnv = process.env,
): void => {
    console.log(`$ ${command} ${args.join(' ')}`);
    execFileSync(command, args, { cwd, env, stdio: 'inherit' });
};

/**
 * Builds the optional App Store Connect authentication arguments for xcodebuild.
 *
 * @returns Empty arguments for an authenticated local Xcode account, or a
 * complete API-key argument list.
 *
 * @throws When only part of the API-key environment is configured.
 */
export const appStoreConnectAuthenticationArgs = (): string[] => {
    const keyPath = process.env.APP_STORE_CONNECT_API_KEY_PATH;
    const keyId = process.env.APP_STORE_CONNECT_API_KEY_ID;
    const issuerId = process.env.APP_STORE_CONNECT_API_ISSUER_ID;
    const configured = [keyPath, keyId, issuerId].filter(Boolean).length;
    if (configured === 0) {
        return [];
    }
    if (configured !== 3) {
        throw new Error(
            'APP_STORE_CONNECT_API_KEY_PATH, APP_STORE_CONNECT_API_KEY_ID, and '
            + 'APP_STORE_CONNECT_API_ISSUER_ID must be configured together',
        );
    }
    return [
        '-authenticationKeyPath',
        keyPath as string,
        '-authenticationKeyID',
        keyId as string,
        '-authenticationKeyIssuerID',
        issuerId as string,
    ];
};
