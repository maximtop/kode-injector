/**
 * @file
 */

/* eslint-disable import/no-extraneous-dependencies */

import { expect, test } from 'vitest';

import {
    getInstallerLdflags,
    getNativeArtifactNames,
    NATIVE_TARGETS,
    PRODUCTION_CHROME_EXTENSION_ID,
} from './package';

test('native package matrix covers every supported target', () => {
    expect(NATIVE_TARGETS).toEqual([
        { os: 'darwin', arch: 'amd64' },
        { os: 'darwin', arch: 'arm64' },
        { os: 'linux', arch: 'amd64' },
        { os: 'linux', arch: 'arm64' },
        { os: 'windows', arch: 'amd64' },
        { os: 'windows', arch: 'arm64' },
    ]);
});

test('native artifact names are deterministic', () => {
    expect(getNativeArtifactNames('0.8.2')).toEqual([
        'kode-injector-native-0.8.2-darwin-amd64.dmg',
        'kode-injector-native-0.8.2-darwin-arm64.dmg',
        'kode-injector-native-0.8.2-linux-amd64.tar.gz',
        'kode-injector-native-0.8.2-linux-arm64.tar.gz',
        'kode-injector-native-0.8.2-windows-amd64.zip',
        'kode-injector-native-0.8.2-windows-arm64.zip',
    ]);
});

test('installer embeds the production Chrome ID without requiring Edge', () => {
    const flags = getInstallerLdflags();

    expect(PRODUCTION_CHROME_EXTENSION_ID).toBe('fgdehkdkmaiedleekbjpfoicpmodbicg');
    expect(flags).toContain(
        `-X=main.defaultChromeID=${PRODUCTION_CHROME_EXTENSION_ID}`,
    );
    expect(flags).not.toContain('main.defaultEdgeID');
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
