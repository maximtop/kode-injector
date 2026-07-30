/**
 * @file
 */

import { beforeEach, expect, test, vi } from 'vitest';

import { injections } from '../src/app/background/injections';
import { executeScript } from '../src/app/background/execute-script';
import { localSourceAccess } from '../src/app/background/local-source-access';
import { sourceReader } from '../src/app/background/native-host';
import { SourceReadErrorCode } from '../src/app/background/source-reader';
import { NativeErrorCode } from '../src/app/common/native-host-protocol';

const documentToken = '00112233445566778899aabbccddeeff';

vi.mock('../src/app/background/app', () => ({
    app: { enabled: true },
}));

vi.mock('../src/app/background/execute-script', () => ({
    executeScript: vi.fn().mockResolvedValue(undefined),
}));

vi.mock('../src/app/background/local-source-access', () => ({
    localSourceAccess: { markReadFailed: vi.fn() },
}));

vi.mock('../src/app/background/native-host', () => ({
    sourceReader: { read: vi.fn() },
}));

vi.mock('../src/app/background/storage', () => ({
    storage: { get: vi.fn(), set: vi.fn() },
}));

beforeEach(() => {
    vi.clearAllMocks();
    injections.clearSourceCache();
    injections.injections = [{
        id: 'injection-1',
        site: 'example.com',
        jsPath: 'file:///tmp/index.js',
        cssPath: 'file:///tmp/styles.css',
        enabled: true,
        jsEnabled: true,
        cssEnabled: true,
    }];
    injections.blocklist = [];
});

test('a browser file fetch failure does not mark native JavaScript access failed', async () => {
    injections.injections[0].cssPath = '';
    vi.mocked(sourceReader.read).mockResolvedValue({
        ok: false,
        errorCode: SourceReadErrorCode.FetchFailed,
    });

    await expect(injections.getPageInjections(
        'https://example.com',
        7,
        documentToken,
    )).resolves.toEqual([]);

    expect(localSourceAccess.markReadFailed).not.toHaveBeenCalled();
    expect(executeScript).not.toHaveBeenCalled();
});

test('a browser file fetch failure does not mark native CSS access failed', async () => {
    injections.injections[0].jsPath = '';
    vi.mocked(sourceReader.read).mockResolvedValue({
        ok: false,
        errorCode: SourceReadErrorCode.FetchFailed,
    });

    await expect(injections.getPageInjections(
        'https://example.com',
        7,
        documentToken,
    )).resolves.toEqual([]);

    expect(localSourceAccess.markReadFailed).not.toHaveBeenCalled();
});

test.each([
    NativeErrorCode.AuthorizationRequired,
    NativeErrorCode.FileNotFound,
    NativeErrorCode.InvalidUtf8,
    NativeErrorCode.FileTooLarge,
])('a file-specific %s failure does not mark the whole native host failed', async (errorCode) => {
    vi.mocked(sourceReader.read).mockResolvedValue({ ok: false, errorCode });

    await expect(injections.getPageInjections(
        'https://example.com',
        7,
        documentToken,
    )).resolves.toEqual([]);

    expect(localSourceAccess.markReadFailed).not.toHaveBeenCalled();
    expect(executeScript).not.toHaveBeenCalled();
});

test('a native transport failure marks the host failed without partial injection', async () => {
    vi.mocked(sourceReader.read).mockResolvedValue({
        ok: false,
        errorCode: SourceReadErrorCode.NativeFailed,
    });

    await expect(injections.getPageInjections(
        'https://example.com',
        7,
        documentToken,
    )).resolves.toEqual([]);

    expect(localSourceAccess.markReadFailed).toHaveBeenCalledTimes(2);
    expect(executeScript).not.toHaveBeenCalled();
});
