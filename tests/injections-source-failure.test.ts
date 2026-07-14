/**
 * @file
 */

import { beforeEach, expect, test, vi } from 'vitest';

import { injections } from '../src/app/background/injections';
import { localSourceAccess } from '../src/app/background/local-source-access';
import { sourceReader } from '../src/app/background/native-host';
import { SourceReadErrorCode } from '../src/app/background/source-reader';

vi.mock('../src/app/background/app', () => ({
    app: { enabled: true },
}));

vi.mock('../src/app/background/execute-script', () => ({
    executeScript: vi.fn(),
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
    injections.injections = [{
        id: 'injection-1',
        site: 'example.com',
        jsPath: 'file:///tmp/index.js',
        cssPath: 'file:///tmp/styles.css',
        enabled: true,
    }];
    injections.blocklist = [];
});

test('a browser file fetch failure does not mark native JavaScript access failed', async () => {
    vi.mocked(sourceReader.read).mockResolvedValue({
        ok: false,
        errorCode: SourceReadErrorCode.FetchFailed,
    });

    await injections.injectJs('https://example.com', 7);

    expect(localSourceAccess.markReadFailed).not.toHaveBeenCalled();
});

test('a browser file fetch failure does not mark native CSS access failed', async () => {
    vi.mocked(sourceReader.read).mockResolvedValue({
        ok: false,
        errorCode: SourceReadErrorCode.FetchFailed,
    });

    await expect(injections.getCssInjection('https://example.com')).resolves.toEqual([]);

    expect(localSourceAccess.markReadFailed).not.toHaveBeenCalled();
});
