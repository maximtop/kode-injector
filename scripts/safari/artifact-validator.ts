/**
 * @file Runtime validation for built Safari application artifacts.
 */

/* eslint-disable camelcase */

import { execFileSync, spawnSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {
    SAFARI_APP_BUNDLE_IDENTIFIER,
    SAFARI_APP_CATEGORY,
    SAFARI_EXTENSION_BUNDLE_IDENTIFIER,
    readAppleTeamIdentifier,
    validateBuildNumber,
} from './config';
import { validateBuiltInDemoResources } from './demo-artifact';

/**
 * Localized string key of the containing app's demo entry, written as a
 * `plutil -extract` key path: the dot must be escaped, otherwise plutil reads
 * `demo.button` as the nested path `demo` → `button` and fails.
 */
const DEMO_ENTRY_STRING_KEY_PATH = 'demo\\.button';

/**
 * Controls validation of one built Safari containing application.
 */
export interface SafariArtifactValidationOptions {
    /**
     * Absolute path to the containing application.
     */
    appPath: string;

    /**
     * Product version expected in the app, extension, manifest, and helper.
     */
    expectedVersion: string;

    /**
     * Optional build number expected in both Apple bundles.
     */
    expectedBuildNumber?: string;

    /**
     * Whether both Intel and Apple Silicon helper slices are required.
     */
    requireUniversalHelper: boolean;

    /**
     * Whether signatures and their entitlements must be verified.
     */
    verifySignatures: boolean;

    /**
     * Whether Mac App Store provisioning profiles must be embedded.
     */
    requireProvisioningProfiles: boolean;

    /**
     * Whether every nested signature must belong to the configured Apple team.
     */
    requireAppleTeamSignature: boolean;
}

/**
 * Public code-signing identity metadata reported by codesign.
 */
interface SigningMetadata {
    /**
     * Apple Developer team identifier attached to the signature.
     */
    teamIdentifier: string;

    /**
     * Certificate-chain authority names attached to the signature.
     */
    authorities: string[];
}

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
 * Reads one raw value from a property-list file.
 *
 * @param plistPath Property-list file to inspect.
 * @param key Key path to read.
 *
 * @returns Raw value printed by plutil.
 */
const readPlistValue = (plistPath: string, key: string): string => execFileSync(
    'plutil',
    ['-extract', key, 'raw', plistPath],
    { encoding: 'utf8' },
).trim();

/**
 * Reads one raw value from a built bundle's Info.plist.
 *
 * @param bundlePath Bundle whose Info.plist should be inspected.
 * @param key Info.plist key to read.
 *
 * @returns Raw bundle metadata value.
 */
const readBundleValue = (bundlePath: string, key: string): string => readPlistValue(
    path.join(bundlePath, 'Contents/Info.plist'),
    key,
);

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
 * Reads the signing team and certificate authorities of an artifact.
 *
 * @param target Signed executable or bundle to inspect.
 *
 * @returns Signing metadata reported by codesign.
 *
 * @throws When code-signing metadata is unavailable or incomplete.
 */
const readSigningMetadata = (
    target: string,
): SigningMetadata => {
    const displayed = spawnSync(
        'codesign',
        ['--display', '--verbose=4', target],
        { encoding: 'utf8' },
    );
    if (displayed.status !== 0) {
        throw new Error(displayed.stderr || `Could not inspect signature for ${target}`);
    }
    const output = `${displayed.stdout}\n${displayed.stderr}`;
    const teamIdentifier = /^TeamIdentifier=(.+)$/mu.exec(output)?.[1];
    const authorities = [...output.matchAll(/^Authority=(.+)$/gmu)]
        .map((match) => match[1]);
    if (!teamIdentifier || authorities.length === 0) {
        throw new Error(`Incomplete Apple signing metadata for ${target}`);
    }
    return { teamIdentifier, authorities };
};

/**
 * Pings embedded helper bytes through their framed native protocol.
 *
 * The production helper inherits its parent's sandbox and cannot be launched
 * directly by this unsandboxed validator. A temporary copy is ad-hoc signed
 * without inheritance; the built app remains untouched.
 *
 * @param helperPath Embedded helper executable to inspect.
 *
 * @returns Host version reported by the executable itself.
 *
 * @throws When the helper cannot run or returns an invalid framed response.
 */
const readEmbeddedHelperVersion = (helperPath: string): string => {
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
        fs.copyFileSync(helperPath, executable);
        execFileSync('codesign', [
            '--force',
            '--sign',
            '-',
            '--timestamp=none',
            executable,
        ]);
        const result = spawnSync(executable, [], {
            input: Buffer.concat([header, request]),
            maxBuffer: 1024 * 1024,
        });
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

/**
 * Validates one privacy manifest through the system property-list parser.
 *
 * @param manifestPath Privacy manifest path.
 * @param expectedAccessedAPIs Required-reason API categories and reason codes.
 *
 * @throws When the privacy manifest is absent, malformed, or declares tracking.
 */
const validatePrivacyManifest = (
    manifestPath: string,
    expectedAccessedAPIs: Record<string, string[]>,
): void => {
    requirePath(manifestPath);
    execFileSync('plutil', ['-lint', manifestPath], { stdio: 'ignore' });
    const manifest = JSON.parse(execFileSync(
        'plutil',
        ['-convert', 'json', '-o', '-', manifestPath],
        { encoding: 'utf8' },
    )) as Record<string, unknown>;
    if (manifest.NSPrivacyTracking !== false
        || !Array.isArray(manifest.NSPrivacyTrackingDomains)
        || manifest.NSPrivacyTrackingDomains.length !== 0
        || !Array.isArray(manifest.NSPrivacyCollectedDataTypes)
        || manifest.NSPrivacyCollectedDataTypes.length !== 0) {
        throw new Error(`Unexpected Safari privacy declaration: ${manifestPath}`);
    }

    if (!Array.isArray(manifest.NSPrivacyAccessedAPITypes)) {
        throw new Error(`Missing Safari required-reason API declarations: ${manifestPath}`);
    }
    const actualAccessedAPIs = manifest.NSPrivacyAccessedAPITypes
        .map((entry) => {
            if (!entry || typeof entry !== 'object' || Array.isArray(entry)) {
                throw new Error(`Invalid Safari required-reason API entry: ${manifestPath}`);
            }
            const record = entry as Record<string, unknown>;
            const type = record.NSPrivacyAccessedAPIType;
            const reasons = record.NSPrivacyAccessedAPITypeReasons;
            const expectedKeys = [
                'NSPrivacyAccessedAPIType',
                'NSPrivacyAccessedAPITypeReasons',
            ];
            if (JSON.stringify(Object.keys(record).sort()) !== JSON.stringify(expectedKeys)
                || typeof type !== 'string'
                || !Array.isArray(reasons)
                || reasons.length === 0
                || reasons.some((reason) => typeof reason !== 'string')
                || new Set(reasons).size !== reasons.length) {
                throw new Error(`Invalid Safari required-reason API entry: ${manifestPath}`);
            }
            return [type, [...reasons].sort()] as const;
        })
        .sort(([left], [right]) => left.localeCompare(right));
    if (new Set(actualAccessedAPIs.map(([type]) => type)).size
        !== actualAccessedAPIs.length) {
        throw new Error(`Duplicate Safari required-reason API entry: ${manifestPath}`);
    }
    const normalizedExpected = (
        Object.entries(expectedAccessedAPIs).map(([type, reasons]) => (
            [type, [...reasons].sort()] as const
        ))
    ).sort(([left], [right]) => left.localeCompare(right));
    if (JSON.stringify(actualAccessedAPIs) !== JSON.stringify(normalizedExpected)) {
        throw new Error(`Unexpected Safari required-reason APIs: ${manifestPath}`);
    }
};

/**
 * Reads the architectures of a Mach-O executable.
 *
 * @param executablePath Executable to inspect.
 *
 * @returns Sorted architecture names.
 */
const readArchitectures = (executablePath: string): string[] => execFileSync(
    'lipo',
    ['-archs', executablePath],
    { encoding: 'utf8' },
).trim().split(/\s+/u).sort();

/**
 * Verifies that an artifact has no quarantine extended attribute.
 *
 * @param target Bundle to inspect recursively.
 *
 * @throws When quarantine metadata is present.
 */
const validateNoQuarantine = (target: string): void => {
    const result = spawnSync(
        'xattr',
        ['-r', '-p', 'com.apple.quarantine', target],
        { encoding: 'utf8' },
    );
    if (result.stdout.trim().length > 0) {
        throw new Error('Safari artifact contains com.apple.quarantine metadata');
    }
};

/**
 * Validates signatures and the product sandbox entitlements.
 *
 * @param appPath Containing application path.
 * @param extensionPath Safari extension path.
 * @param helperPath Embedded helper executable path.
 * @param requireAppleTeamSignature Whether Apple team signatures are required.
 * @param requireStoreIdentity Whether team-scoped App Store entitlements are required.
 *
 * @throws When signatures or effective sandbox entitlements are invalid.
 */
const validateSignatures = (
    appPath: string,
    extensionPath: string,
    helperPath: string,
    requireAppleTeamSignature: boolean,
    requireStoreIdentity: boolean,
): void => {
    const signedTargets = [helperPath, extensionPath, appPath];
    signedTargets.forEach((target) => {
        execFileSync('codesign', ['--verify', '--strict', target], { stdio: 'inherit' });
    });

    if (requireAppleTeamSignature) {
        const teamIdentifier = readAppleTeamIdentifier();
        signedTargets.forEach((target) => {
            const metadata = readSigningMetadata(target);
            const hasAcceptedAuthority = metadata.authorities.some((authority) => (
                authority.startsWith('Apple Development:')
                || authority.startsWith('Apple Distribution:')
            ));
            if (metadata.teamIdentifier !== teamIdentifier || !hasAcceptedAuthority) {
                throw new Error('Safari archive is not signed by the configured Apple team');
            }
        });
    }

    const appEntitlements = readEntitlements(appPath);
    const extensionEntitlements = readEntitlements(extensionPath);
    const helperEntitlements = readEntitlements(helperPath);
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

    if (requireStoreIdentity) {
        const teamIdentifier = readAppleTeamIdentifier();
        const expectedAppIdentifier = `${teamIdentifier}.${SAFARI_APP_BUNDLE_IDENTIFIER}`;
        const expectedExtensionIdentifier = [
            teamIdentifier,
            SAFARI_EXTENSION_BUNDLE_IDENTIFIER,
        ].join('.');
        if (appEntitlements['com.apple.developer.team-identifier'] !== teamIdentifier
            || appEntitlements['com.apple.application-identifier'] !== expectedAppIdentifier
            || extensionEntitlements['com.apple.developer.team-identifier']
                !== teamIdentifier
            || extensionEntitlements['com.apple.application-identifier']
                !== expectedExtensionIdentifier) {
            throw new Error('Safari archive is not signed for the configured Apple team');
        }
    }
};

/**
 * Validates the public layout and metadata of a built Safari app.
 *
 * @param options Validation mode and expected artifact metadata.
 *
 * @throws When any runtime-visible artifact contract is violated.
 */
export const validateSafariArtifact = (
    options: SafariArtifactValidationOptions,
): void => {
    const { appPath } = options;
    const extensionPath = path.join(
        appPath,
        'Contents/PlugIns/Kode Injector Extension.appex',
    );
    const helperPath = path.join(
        extensionPath,
        'Contents/Helpers/kode-injector-native',
    );
    const manifestPath = path.join(extensionPath, 'Contents/Resources/manifest.json');
    const appIconPath = path.join(appPath, 'Contents/Resources/AppIcon.icns');
    const assetCatalogPath = path.join(appPath, 'Contents/Resources/Assets.car');

    [
        appPath,
        extensionPath,
        helperPath,
        manifestPath,
        appIconPath,
        assetCatalogPath,
    ].forEach(requirePath);
    ['en', 'ru'].forEach((locale) => {
        const appStringsPath = path.join(
            appPath,
            `Contents/Resources/${locale}.lproj/Localizable.strings`,
        );
        requirePath(appStringsPath);
        requirePath(path.join(
            extensionPath,
            `Contents/Resources/${locale}.lproj/Localizable.strings`,
        ));
        if (readPlistValue(appStringsPath, DEMO_ENTRY_STRING_KEY_PATH).length === 0) {
            throw new Error(`Safari containing app lacks the localized demo entry (${locale})`);
        }
    });

    validatePrivacyManifest(path.join(
        appPath,
        'Contents/Resources/PrivacyInfo.xcprivacy',
    ), {});
    validatePrivacyManifest(path.join(
        extensionPath,
        'Contents/Resources/PrivacyInfo.xcprivacy',
    ), {
        NSPrivacyAccessedAPICategoryFileTimestamp: ['3B52.1'],
        NSPrivacyAccessedAPICategorySystemBootTime: ['35F9.1'],
        NSPrivacyAccessedAPICategoryUserDefaults: ['CA92.1'],
    });
    validateNoQuarantine(appPath);

    if (readBundleValue(appPath, 'CFBundleIdentifier')
            !== SAFARI_APP_BUNDLE_IDENTIFIER) {
        throw new Error('Unexpected Safari containing-app bundle identifier');
    }
    if (readBundleValue(extensionPath, 'CFBundleIdentifier')
            !== SAFARI_EXTENSION_BUNDLE_IDENTIFIER) {
        throw new Error('Unexpected Safari extension bundle identifier');
    }
    if (readBundleValue(appPath, 'CFBundleShortVersionString')
            !== options.expectedVersion
        || readBundleValue(extensionPath, 'CFBundleShortVersionString')
            !== options.expectedVersion) {
        throw new Error('Safari bundle versions must match package.json');
    }

    const appBuildNumber = readBundleValue(appPath, 'CFBundleVersion');
    const extensionBuildNumber = readBundleValue(extensionPath, 'CFBundleVersion');
    validateBuildNumber(appBuildNumber);
    if (appBuildNumber !== extensionBuildNumber
        || (options.expectedBuildNumber
            && appBuildNumber !== options.expectedBuildNumber)) {
        throw new Error('Safari app and extension must have the expected Apple build number');
    }
    if (readBundleValue(appPath, 'LSApplicationCategoryType') !== SAFARI_APP_CATEGORY) {
        throw new Error('Safari containing app must use the Developer Tools category');
    }
    if (readBundleValue(appPath, 'ITSAppUsesNonExemptEncryption') !== 'false') {
        throw new Error('Safari export-compliance metadata is missing');
    }
    if (readBundleValue(extensionPath, 'ITSAppUsesNonExemptEncryption') !== 'false') {
        throw new Error('Safari extension export-compliance metadata is missing');
    }
    if (readBundleValue(appPath, 'CFBundleIconName') !== 'AppIcon'
        || fs.statSync(appIconPath).size === 0) {
        throw new Error('Safari containing app icon is missing');
    }

    const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8')) as {
        /**
         * Manifest version.
         */
        version?: string;

        /**
         * Required extension permissions.
         */
        permissions?: string[];

        /**
         * Optional extension permissions.
         */
        optional_permissions?: string[];
    };
    if (manifest.version !== options.expectedVersion) {
        throw new Error('Safari manifest version must match package.json');
    }
    if (!manifest.permissions?.includes('nativeMessaging')
        || manifest.optional_permissions?.includes('nativeMessaging')) {
        throw new Error('Safari manifest must require nativeMessaging');
    }
    if (readEmbeddedHelperVersion(helperPath) !== options.expectedVersion) {
        throw new Error('Embedded Safari helper version must match package.json');
    }
    validateBuiltInDemoResources(path.join(extensionPath, 'Contents/Resources'));

    if (options.requireUniversalHelper) {
        const expectedArchitectures = JSON.stringify(['arm64', 'x86_64']);
        const appExecutable = path.join(
            appPath,
            'Contents/MacOS',
            readBundleValue(appPath, 'CFBundleExecutable'),
        );
        const extensionExecutable = path.join(
            extensionPath,
            'Contents/MacOS',
            readBundleValue(extensionPath, 'CFBundleExecutable'),
        );
        [appExecutable, extensionExecutable, helperPath].forEach((executablePath) => {
            if (JSON.stringify(readArchitectures(executablePath))
                !== expectedArchitectures) {
                throw new Error(`Mac App Store executable is not universal: ${executablePath}`);
            }
        });
    }

    if (options.requireProvisioningProfiles) {
        requirePath(path.join(appPath, 'Contents/embedded.provisionprofile'));
        requirePath(path.join(extensionPath, 'Contents/embedded.provisionprofile'));
    }
    if (options.verifySignatures) {
        validateSignatures(
            appPath,
            extensionPath,
            helperPath,
            options.requireAppleTeamSignature,
            options.requireProvisioningProfiles,
        );
    }
};
