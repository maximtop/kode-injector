/**
 * @file
 */

/* eslint-disable import/no-extraneous-dependencies */

import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { afterEach, expect, test } from 'vitest';
import {
    getNativeHostPublishedAsset,
    NATIVE_HOST_PUBLISHED_ASSETS,
    NativeHostPackageTarget,
} from '../../src/app/common/native-host-artifacts';

import {
    assembleMacApplication,
    getInstallerLdflags,
    getNativeArtifactNames,
    MAC_APPLICATION_NAME,
    MAC_MAIN_EXECUTABLE_NAME,
    NATIVE_TARGETS,
    PRODUCTION_CHROME_EXTENSION_ID,
} from './package';

const temporaryPaths: string[] = [];

/**
 * Creates a per-test temporary directory.
 *
 * @returns Temporary directory path.
 */
const createTemporaryPath = (): string => {
    const temporaryPath = fs.mkdtempSync(
        path.join(os.tmpdir(), 'kode-injector-package-test-'),
    );
    temporaryPaths.push(temporaryPath);
    return temporaryPath;
};

afterEach(() => {
    temporaryPaths.splice(0).forEach((temporaryPath) => {
        fs.rmSync(temporaryPath, { recursive: true, force: true });
    });
});

test('native package matrix covers every supported target', () => {
    expect(NATIVE_TARGETS.map((target) => `${target.os}/${target.arch}`).sort()).toEqual([
        'darwin/amd64',
        'darwin/arm64',
        'linux/amd64',
        'linux/arm64',
        'windows/amd64',
        'windows/arm64',
    ]);
});

test('release asset names come from the shared catalog and are human readable', () => {
    expect([...getNativeArtifactNames()].sort()).toEqual(
        NATIVE_HOST_PUBLISHED_ASSETS.map((asset) => asset.name).sort(),
    );
    expect(new Set(getNativeArtifactNames()).size).toBe(NATIVE_TARGETS.length);
    getNativeArtifactNames().forEach((name) => {
        expect(name).toMatch(/^kode-injector-(?:helper|native)-[a-z0-9.-]+$/u);
    });
    expect(getNativeHostPublishedAsset(NativeHostPackageTarget.MacOSIntel).name)
        .toMatch(/macos.*\.dmg$/u);
});

test('macOS app assembly exposes only the branded app and Applications link', () => {
    const temporaryPath = createTemporaryPath();
    const sourcePath = path.join(temporaryPath, 'source');
    const stagePath = path.join(temporaryPath, 'stage');
    const sourceFiles = {
        mainExecutable: path.join(sourcePath, 'KodeInjectorHelper'),
        hostExecutable: path.join(sourcePath, 'kode-injector-native'),
        installerExecutable: path.join(sourcePath, 'kode-injector-installer'),
        infoPlistTemplate: path.join(sourcePath, 'Info.plist'),
        icon: path.join(sourcePath, 'AppIcon.icns'),
    };
    fs.mkdirSync(sourcePath, { recursive: true });
    fs.writeFileSync(sourceFiles.mainExecutable, 'main');
    fs.writeFileSync(sourceFiles.hostExecutable, 'host');
    fs.writeFileSync(sourceFiles.installerExecutable, 'installer');
    fs.writeFileSync(
        sourceFiles.infoPlistTemplate,
        [
            '<plist>',
            '<key>CFBundleShortVersionString</key>',
            '<string>__PACKAGE_VERSION__</string>',
            '<key>CFBundleVersion</key>',
            '<string>__BUNDLE_VERSION__</string>',
            '</plist>',
        ].join('\n'),
    );
    fs.writeFileSync(sourceFiles.icon, 'icon');

    const appPath = assembleMacApplication(
        stagePath,
        sourceFiles,
        '0.8.2',
    );

    expect(path.basename(appPath)).toBe(`${MAC_APPLICATION_NAME}.app`);
    expect(fs.readdirSync(stagePath).sort()).toEqual([
        'Applications',
        `${MAC_APPLICATION_NAME}.app`,
    ]);
    expect(fs.lstatSync(path.join(stagePath, 'Applications')).isSymbolicLink()).toBe(true);
    expect(fs.readlinkSync(path.join(stagePath, 'Applications'))).toBe('/Applications');
    expect(fs.readFileSync(
        path.join(appPath, 'Contents', 'Info.plist'),
        'utf8',
    )).toContain('0.8.2');
    expect(fs.existsSync(
        path.join(appPath, 'Contents', 'Resources', 'AppIcon.icns'),
    )).toBe(true);
    expect(fs.readFileSync(
        path.join(appPath, 'Contents', 'MacOS', MAC_MAIN_EXECUTABLE_NAME),
        'utf8',
    )).toBe('main');
    expect(fs.readFileSync(
        path.join(appPath, 'Contents', 'Helpers', 'kode-injector-native'),
        'utf8',
    )).toBe('host');
    expect(fs.readFileSync(
        path.join(appPath, 'Contents', 'Helpers', 'kode-injector-installer'),
        'utf8',
    )).toBe('installer');
    expect(() => fs.accessSync(
        path.join(appPath, 'Contents', 'MacOS', MAC_MAIN_EXECUTABLE_NAME),
        fs.constants.X_OK,
    )).not.toThrow();
    expect(() => fs.accessSync(
        path.join(appPath, 'Contents', 'Helpers', 'kode-injector-native'),
        fs.constants.X_OK,
    )).not.toThrow();
    expect(() => fs.accessSync(
        path.join(appPath, 'Contents', 'Helpers', 'kode-injector-installer'),
        fs.constants.X_OK,
    )).not.toThrow();
});

test('installer embeds the production Chrome ID without requiring Edge', () => {
    const flags = getInstallerLdflags(undefined, '0.8.2');

    expect(PRODUCTION_CHROME_EXTENSION_ID).toBe('fgdehkdkmaiedleekbjpfoicpmodbicg');
    expect(flags).toContain(
        `-X=main.defaultChromeID=${PRODUCTION_CHROME_EXTENSION_ID}`,
    );
    expect(flags).not.toContain('main.defaultEdgeID');
    expect(flags).toContain('-X=main.defaultPackageVersion=0.8.2');
});

test('installer embeds an explicit valid Edge ID when configured', () => {
    const edgeID = 'bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb';

    expect(getInstallerLdflags(edgeID)).toContain(`-X=main.defaultEdgeID=${edgeID}`);
});

test('installer rejects invalid Edge origins instead of using a wildcard', () => {
    expect(() => getInstallerLdflags('*')).toThrow(
        'KODE_INJECTOR_EDGE_ID must be empty or a 32-letter Edge Add-ons ID',
    );
});
