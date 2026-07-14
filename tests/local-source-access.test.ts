/**
 * @file
 */

import { expect, test, vi } from 'vitest';

import { LocalSourceAccess } from '../src/app/background/local-source-access';
import { LocalSourceAccessKind } from '../src/app/common/contracts';
import { NativeHostStatus } from '../src/app/common/native-host-protocol';

vi.mock('webextension-polyfill', () => ({
    default: { runtime: { connectNative: vi.fn() } },
}));

test('maps compatible hosts to ready', async () => {
    const access = new LocalSourceAccess({
        ping: vi.fn().mockResolvedValue({ protocolVersion: 1, hostVersion: '0.8.3' }),
    });

    await expect(access.getState()).resolves.toEqual({
        kind: LocalSourceAccessKind.NativeHost,
        host: { status: NativeHostStatus.Ready, hostVersion: '0.8.3' },
    });
});

test('maps incompatible hosts to update required', async () => {
    const access = new LocalSourceAccess({
        ping: vi.fn().mockResolvedValue({ protocolVersion: 2, hostVersion: '2.0.0' }),
    });

    await expect(access.getState()).resolves.toEqual({
        kind: LocalSourceAccessKind.NativeHost,
        host: { status: NativeHostStatus.UpdateRequired, hostVersion: '2.0.0' },
    });
});

test('maps an unsupported-protocol response to update required', async () => {
    const access = new LocalSourceAccess({
        ping: vi.fn().mockRejectedValue(new Error('UNSUPPORTED_PROTOCOL')),
    });

    await expect(access.getState()).resolves.toMatchObject({
        host: { status: NativeHostStatus.UpdateRequired },
    });
});

test('maps unavailable and disconnected hosts', async () => {
    const ping = vi.fn()
        .mockRejectedValueOnce(new Error('Specified native messaging host not found'))
        .mockRejectedValueOnce(new Error('NATIVE_DISCONNECTED'));
    const access = new LocalSourceAccess({ ping });

    await expect(access.getState()).resolves.toMatchObject({
        host: { status: NativeHostStatus.NotInstalled },
    });
    await expect(access.getState()).resolves.toMatchObject({
        host: { status: NativeHostStatus.Disconnected },
    });
});
