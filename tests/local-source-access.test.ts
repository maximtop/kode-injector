/**
 * @file
 */

import { expect, test, vi } from 'vitest';

import { LocalSourceAccess } from '../src/app/background/local-source-access';
import { LocalSourceAccessMethod } from '../src/app/common/contracts';
import { NativeHostStatus } from '../src/app/common/native-host-protocol';

vi.mock('webextension-polyfill', () => ({
    default: { runtime: { connectNative: vi.fn() } },
}));

test('maps compatible hosts to ready', async () => {
    const access = new LocalSourceAccess({
        ping: vi.fn().mockResolvedValue({ protocolVersion: 1, hostVersion: '0.8.3' }),
        disconnect: vi.fn(),
    }, { isAllowed: vi.fn() }, grantedPermission(), () => LocalSourceAccessMethod.NativeHost);

    await expect(access.getState()).resolves.toEqual({
        kind: LocalSourceAccessMethod.NativeHost,
        permissionGranted: true,
        host: { status: NativeHostStatus.Ready, hostVersion: '0.8.3' },
    });
});

test('maps incompatible hosts to update required', async () => {
    const access = new LocalSourceAccess({
        ping: vi.fn().mockResolvedValue({ protocolVersion: 2, hostVersion: '2.0.0' }),
        disconnect: vi.fn(),
    }, { isAllowed: vi.fn() }, grantedPermission(), () => LocalSourceAccessMethod.NativeHost);

    await expect(access.getState()).resolves.toEqual({
        kind: LocalSourceAccessMethod.NativeHost,
        permissionGranted: true,
        host: { status: NativeHostStatus.UpdateRequired, hostVersion: '2.0.0' },
    });
});

test('maps an unsupported-protocol response to update required', async () => {
    const access = new LocalSourceAccess({
        ping: vi.fn().mockRejectedValue(new Error('UNSUPPORTED_PROTOCOL')),
        disconnect: vi.fn(),
    }, { isAllowed: vi.fn() }, grantedPermission(), () => LocalSourceAccessMethod.NativeHost);

    await expect(access.getState()).resolves.toMatchObject({
        host: { status: NativeHostStatus.UpdateRequired },
    });
});

test('maps unavailable and disconnected hosts', async () => {
    const ping = vi.fn()
        .mockRejectedValueOnce(new Error('Specified native messaging host not found'))
        .mockRejectedValueOnce(new Error('NATIVE_DISCONNECTED'));
    const access = new LocalSourceAccess(
        { ping, disconnect: vi.fn() },
        { isAllowed: vi.fn() },
        grantedPermission(),
        () => LocalSourceAccessMethod.NativeHost,
    );

    await expect(access.getState()).resolves.toMatchObject({
        host: { status: NativeHostStatus.NotInstalled },
    });
    await expect(access.getState()).resolves.toMatchObject({
        host: { status: NativeHostStatus.Disconnected },
    });
});

test.each([true, false])('returns browser-owned file access state: %s', async (allowed) => {
    const ping = vi.fn();
    const isAllowed = vi.fn().mockResolvedValue(allowed);
    const access = new LocalSourceAccess(
        { ping, disconnect: vi.fn() },
        { isAllowed },
        grantedPermission(),
        () => LocalSourceAccessMethod.Browser,
    );

    await expect(access.getState()).resolves.toEqual({
        kind: LocalSourceAccessMethod.Browser,
        allowed,
    });
    expect(isAllowed).toHaveBeenCalledOnce();
    expect(ping).not.toHaveBeenCalled();
});

test('does not connect when native messaging permission is missing', async () => {
    const ping = vi.fn();
    const disconnect = vi.fn();
    const access = new LocalSourceAccess(
        { ping, disconnect },
        { isAllowed: vi.fn() },
        { contains: vi.fn().mockResolvedValue(false) },
        () => LocalSourceAccessMethod.NativeHost,
    );

    await expect(access.getState()).resolves.toEqual({
        kind: LocalSourceAccessMethod.NativeHost,
        permissionGranted: false,
        host: { status: NativeHostStatus.NotInstalled },
    });
    expect(ping).not.toHaveBeenCalled();
    expect(disconnect).toHaveBeenCalledOnce();
});

test('disconnects the native client when browser access is selected', () => {
    const disconnect = vi.fn();
    const access = new LocalSourceAccess(
        { ping: vi.fn(), disconnect },
        { isAllowed: vi.fn() },
        grantedPermission(),
        () => LocalSourceAccessMethod.Browser,
    );

    access.methodChanged(LocalSourceAccessMethod.Browser);

    expect(disconnect).toHaveBeenCalledOnce();
});

test('a stale readiness probe cannot overwrite a later read failure', async () => {
    let resolvePing: ((host: { protocolVersion: number; hostVersion: string }) => void) | undefined;
    const ping = vi.fn().mockReturnValue(new Promise((resolve) => {
        resolvePing = resolve;
    }));
    const access = new LocalSourceAccess(
        { ping, disconnect: vi.fn() },
        { isAllowed: vi.fn() },
        grantedPermission(),
        () => LocalSourceAccessMethod.NativeHost,
    );

    const state = access.getState();
    await vi.waitFor(() => { expect(ping).toHaveBeenCalledOnce(); });
    access.markReadFailed();
    resolvePing?.({ protocolVersion: 1, hostVersion: '0.8.3' });

    await expect(state).resolves.toEqual({
        kind: LocalSourceAccessMethod.NativeHost,
        permissionGranted: true,
        host: { status: NativeHostStatus.ReadFailed },
    });
});

test('concurrent permission probes return one coherent native state', async () => {
    let resolveStalePermission: ((granted: boolean) => void) | undefined;
    const contains = vi.fn()
        .mockReturnValueOnce(new Promise((resolve) => {
            resolveStalePermission = resolve;
        }))
        .mockResolvedValueOnce(true);
    const access = new LocalSourceAccess({
        ping: vi.fn().mockResolvedValue({ protocolVersion: 1, hostVersion: '0.8.3' }),
        disconnect: vi.fn(),
    }, { isAllowed: vi.fn() }, { contains }, () => LocalSourceAccessMethod.NativeHost);

    const staleState = access.getState();
    const currentState = access.getState();
    await expect(currentState).resolves.toEqual({
        kind: LocalSourceAccessMethod.NativeHost,
        permissionGranted: true,
        host: { status: NativeHostStatus.Ready, hostVersion: '0.8.3' },
    });

    resolveStalePermission?.(false);

    await expect(staleState).resolves.toEqual({
        kind: LocalSourceAccessMethod.NativeHost,
        permissionGranted: true,
        host: { status: NativeHostStatus.Ready, hostVersion: '0.8.3' },
    });
});

test('a stale native read failure is ignored after switching to browser access', async () => {
    let method = LocalSourceAccessMethod.NativeHost;
    let resolvePing: ((host: { protocolVersion: number; hostVersion: string }) => void) | undefined;
    const ping = vi.fn().mockReturnValue(new Promise((resolve) => {
        resolvePing = resolve;
    }));
    const access = new LocalSourceAccess(
        { ping, disconnect: vi.fn() },
        { isAllowed: vi.fn() },
        grantedPermission(),
        () => method,
    );

    const state = access.getState();
    await vi.waitFor(() => { expect(ping).toHaveBeenCalledOnce(); });
    method = LocalSourceAccessMethod.Browser;
    access.methodChanged(method);
    access.markReadFailed();
    resolvePing?.({ protocolVersion: 1, hostVersion: '0.8.3' });

    await expect(state).resolves.toEqual({
        kind: LocalSourceAccessMethod.NativeHost,
        permissionGranted: true,
        host: { status: NativeHostStatus.Checking },
    });
});

const grantedPermission = () => ({
    contains: vi.fn().mockResolvedValue(true),
});
