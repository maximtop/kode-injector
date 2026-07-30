/**
 * @file Validates the produced Safari app through its public bundle contract.
 */

/* eslint-disable no-console */
/* eslint-disable camelcase */

import { execFileSync, spawnSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

const ROOT_PATH = path.resolve(import.meta.dirname, '../..');
const PACKAGE_PATH = path.join(ROOT_PATH, 'package.json');
const APP_PATH = path.join(ROOT_PATH, 'build/safari/dev/Kode Injector.app');
const EXTENSION_PATH = path.join(
    APP_PATH,
    'Contents/PlugIns/Kode Injector Extension.appex',
);
const HELPER_PATH = path.join(
    EXTENSION_PATH,
    'Contents/Helpers/kode-injector-native',
);
const MANIFEST_PATH = path.join(EXTENSION_PATH, 'Contents/Resources/manifest.json');
const APP_ICON_PATH = path.join(APP_PATH, 'Contents/Resources/AppIcon.icns');
const ASSET_CATALOG_PATH = path.join(APP_PATH, 'Contents/Resources/Assets.car');

/**
 * Package metadata required by Safari artifact validation.
 */
interface PackageMetadata {
    /**
     * Product version expected in bundles and executables.
     */
    version: string;
}

const PACKAGE_VERSION = (JSON.parse(
    fs.readFileSync(PACKAGE_PATH, 'utf8'),
) as PackageMetadata).version;

/**
 * Requires one public artifact path to exist.
 *
 * @param target Expected artifact path.
 *
 * @throws When the artifact path does not exist.
 */
const requirePath = (target: string): void => {
    if (!fs.existsSync(target)) {
        throw new Error(`Missing Safari artifact: ${target}`);
    }
};

/**
 * Reads the bundle identifier from a built app or extension.
 *
 * @param bundlePath Bundle whose Info.plist should be inspected.
 *
 * @returns Built bundle identifier.
 */
const readBundleIdentifier = (bundlePath: string): string => execFileSync(
    'plutil',
    ['-extract', 'CFBundleIdentifier', 'raw', path.join(bundlePath, 'Contents/Info.plist')],
    { encoding: 'utf8' },
).trim();

/**
 * Reads one string value from a built bundle's Info.plist.
 *
 * @param bundlePath Bundle whose Info.plist should be inspected.
 * @param key Info.plist key to read.
 *
 * @returns Built plist value.
 */
const readBundleValue = (bundlePath: string, key: string): string => execFileSync(
    'plutil',
    ['-extract', key, 'raw', path.join(bundlePath, 'Contents/Info.plist')],
    { encoding: 'utf8' },
).trim();

/**
 * Reads and parses the effective code-signing entitlements of an artifact.
 *
 * @param target Signed executable or bundle to inspect.
 *
 * @returns Parsed entitlement dictionary.
 *
 * @throws When code-signing output is unavailable or malformed.
 */
const readEntitlements = (target: string): Record<string, unknown> => {
    const displayed = spawnSync(
        'codesign',
        ['--display', '--entitlements', ':-', target],
        { encoding: 'utf8' },
    );
    if (displayed.status !== 0) {
        throw new Error(displayed.stderr || `Could not inspect entitlements for ${target}`);
    }
    const plist = displayed.stdout || displayed.stderr;
    const xmlStart = plist.indexOf('<?xml');
    const plistStart = plist.indexOf('<plist');
    const start = xmlStart >= 0 ? xmlStart : plistStart;
    if (start < 0) {
        throw new Error(`Missing entitlement plist for ${target}`);
    }
    const converted = spawnSync(
        'plutil',
        ['-convert', 'json', '-o', '-', '-'],
        { input: plist.slice(start), encoding: 'utf8' },
    );
    if (converted.status !== 0) {
        throw new Error(converted.stderr || `Could not parse entitlements for ${target}`);
    }
    return JSON.parse(converted.stdout) as Record<string, unknown>;
};

/**
 * Pings the final embedded helper bytes through their framed native protocol.
 *
 * The production helper inherits its parent's sandbox and cannot be launched
 * directly by this unsandboxed validator. A temporary copy is therefore
 * ad-hoc re-signed without inheritance; the built app remains untouched.
 *
 * @returns Host version reported by the executable itself.
 *
 * @throws When the helper cannot run or returns an invalid framed response.
 */
const readEmbeddedHelperVersion = (): string => {
    const request = Buffer.from(JSON.stringify({
        protocolVersion: 1,
        requestId: 'safari_validate',
        operation: 'ping',
    }));
    const header = Buffer.alloc(4);
    header.writeUInt32LE(request.byteLength);
    const temporaryDirectory = fs.mkdtempSync(
        path.join(os.tmpdir(), 'kode-injector-safari-version-'),
    );
    const executable = path.join(temporaryDirectory, 'kode-injector-native');
    try {
        fs.copyFileSync(HELPER_PATH, executable);
        execFileSync('codesign', [
            '--force',
            '--sign',
            '-',
            '--timestamp=none',
            executable,
        ]);
        const result = spawnSync(
            executable,
            [],
            {
                input: Buffer.concat([header, request]),
                maxBuffer: 1024 * 1024,
            },
        );
        if (result.error || result.status !== 0 || !Buffer.isBuffer(result.stdout)) {
            throw new Error(
                result.error?.message
                || result.stderr?.toString()
                || 'Could not ping the embedded Safari helper',
            );
        }
        if (result.stdout.byteLength < 4) {
            throw new Error('Embedded Safari helper returned a truncated frame');
        }
        const responseBytes = result.stdout.readUInt32LE(0);
        if (responseBytes !== result.stdout.byteLength - 4) {
            throw new Error('Embedded Safari helper returned an invalid frame length');
        }
        const response = JSON.parse(
            result.stdout.subarray(4).toString('utf8'),
        ) as Record<string, unknown>;
        const expectedKeys = ['hostVersion', 'ok', 'protocolVersion', 'requestId', 'type'];
        if (JSON.stringify(Object.keys(response).sort()) !== JSON.stringify(expectedKeys)
            || response.protocolVersion !== 1
            || response.requestId !== 'safari_validate'
            || response.type !== 'status'
            || response.ok !== true
            || typeof response.hostVersion !== 'string') {
            throw new Error('Embedded Safari helper returned an invalid status response');
        }
        return response.hostVersion;
    } finally {
        fs.rmSync(temporaryDirectory, { recursive: true, force: true });
    }
};

requirePath(APP_PATH);
requirePath(EXTENSION_PATH);
requirePath(HELPER_PATH);
requirePath(MANIFEST_PATH);
requirePath(APP_ICON_PATH);
requirePath(ASSET_CATALOG_PATH);
['en', 'ru'].forEach((locale) => {
    requirePath(path.join(
        APP_PATH,
        `Contents/Resources/${locale}.lproj/Localizable.strings`,
    ));
    requirePath(path.join(
        EXTENSION_PATH,
        `Contents/Resources/${locale}.lproj/Localizable.strings`,
    ));
});
execFileSync('codesign', ['--verify', '--strict', APP_PATH], { stdio: 'inherit' });

if (readBundleIdentifier(APP_PATH) !== 'dev.maximtop.kode-injector.safari') {
    throw new Error('Unexpected Safari containing-app bundle identifier');
}
if (readBundleIdentifier(EXTENSION_PATH) !== 'dev.maximtop.kode-injector.safari.Extension') {
    throw new Error('Unexpected Safari extension bundle identifier');
}
if (readBundleValue(APP_PATH, 'CFBundleShortVersionString') !== PACKAGE_VERSION
    || readBundleValue(EXTENSION_PATH, 'CFBundleShortVersionString') !== PACKAGE_VERSION) {
    throw new Error('Safari bundle versions must match package.json');
}
if (readBundleValue(APP_PATH, 'CFBundleIconName') !== 'AppIcon'
    || fs.statSync(APP_ICON_PATH).size === 0) {
    throw new Error('Safari containing app icon is missing');
}

const manifest = JSON.parse(fs.readFileSync(MANIFEST_PATH, 'utf8')) as {
    version?: string;
    permissions?: string[];
    optional_permissions?: string[];
};
if (manifest.version !== PACKAGE_VERSION) {
    throw new Error('Safari manifest version must match package.json');
}
if (readEmbeddedHelperVersion() !== PACKAGE_VERSION) {
    throw new Error('Embedded Safari helper version must match package.json');
}
if (!manifest.permissions?.includes('nativeMessaging')
    || manifest.optional_permissions?.includes('nativeMessaging')) {
    throw new Error('Safari manifest must require nativeMessaging');
}

const appEntitlements = readEntitlements(APP_PATH);
const extensionEntitlements = readEntitlements(EXTENSION_PATH);
const helperEntitlements = readEntitlements(HELPER_PATH);
if (appEntitlements['com.apple.security.app-sandbox'] !== true) {
    throw new Error('Safari app sandbox entitlement is missing');
}
if (extensionEntitlements['com.apple.security.app-sandbox'] !== true
    || extensionEntitlements['com.apple.security.files.user-selected.read-only'] !== true
    || extensionEntitlements['com.apple.security.files.bookmarks.app-scope'] !== true) {
    throw new Error('Safari extension read-only sandbox entitlements are incomplete');
}
if (helperEntitlements['com.apple.security.app-sandbox'] !== true
    || helperEntitlements['com.apple.security.inherit'] !== true) {
    throw new Error('Embedded Safari helper must inherit the extension sandbox');
}

console.log(`Safari artifact validated: ${APP_PATH}`);
