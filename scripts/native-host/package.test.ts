/**
 * @file
 */

/* eslint-disable import/no-extraneous-dependencies */

import { expect, test } from 'vitest';

import { getNativeArtifactNames, NATIVE_TARGETS } from './package';

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
        'kode-injector-native-0.8.2-darwin-universal.dmg',
        'kode-injector-native-0.8.2-linux-amd64.tar.gz',
        'kode-injector-native-0.8.2-linux-arm64.tar.gz',
        'kode-injector-native-0.8.2-windows-amd64.zip',
        'kode-injector-native-0.8.2-windows-arm64.zip',
    ]);
});
