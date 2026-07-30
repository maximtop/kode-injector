/**
 * @file
 */

import {
    beforeEach,
    expect,
    test,
    vi,
} from 'vitest';

import { executeScript } from '../src/app/background/execute-script';
import { Injections } from '../src/app/background/injections';
import { sourceReader } from '../src/app/background/native-host';
import { NativeErrorCode } from '../src/app/common/native-host-protocol';

const documentToken = '00112233445566778899aabbccddeeff';

vi.mock('webextension-polyfill', () => ({
    default: {
        storage: {
            local: {
                get: vi.fn(),
                set: vi.fn(),
            },
        },
    },
}));

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

const deferred = <T>() => {
    let resolve!: (value: T) => void;
    const promise = new Promise<T>((resolvePromise) => {
        resolve = resolvePromise;
    });
    return { promise, resolve };
};

const flushAsyncWork = (): Promise<void> => new Promise((resolve) => {
    setTimeout(resolve, 0);
});

const makeInjections = (): Injections => {
    const service = new Injections(true);
    service.injections = [{
        id: 'rule-1',
        site: 'example.com',
        jsPath: 'file:///source.js',
        cssPath: 'file:///source.css',
        enabled: true,
        jsEnabled: true,
        cssEnabled: true,
    }];
    return service;
};

beforeEach(() => {
    vi.clearAllMocks();
});

test('rapid reloads inject one stale version per document and share one refresh', async () => {
    const javascriptRefresh = deferred<{ ok: true; content: string }>();
    const cssRefresh = deferred<{ ok: true; content: string }>();
    vi.mocked(sourceReader.read)
        .mockResolvedValueOnce({ ok: true, content: 'js-one' })
        .mockResolvedValueOnce({ ok: true, content: 'css-one' })
        .mockReturnValueOnce(javascriptRefresh.promise)
        .mockReturnValueOnce(cssRefresh.promise)
        .mockResolvedValue({ ok: true, content: 'unused-refresh' });
    const service = makeInjections();

    const first = await service.getPageInjections(
        'https://example.com', 7, documentToken,
    );
    const second = await service.getPageInjections(
        'https://example.com', 7, documentToken,
    );
    const rapidThird = await service.getPageInjections(
        'https://example.com', 7, documentToken,
    );

    expect(first).toEqual([{ css: { code: 'css-one' } }]);
    expect(second).toEqual(first);
    expect(rapidThird).toEqual(first);
    expect(sourceReader.read).toHaveBeenCalledTimes(4);
    expect(vi.mocked(executeScript).mock.calls.map(([script]) => script))
        .toEqual(['js-one', 'js-one', 'js-one']);

    javascriptRefresh.resolve({ ok: true, content: 'js-two' });
    cssRefresh.resolve({ ok: true, content: 'css-two' });
    await Promise.all([javascriptRefresh.promise, cssRefresh.promise]);
    await flushAsyncWork();

    const updated = await service.getPageInjections(
        'https://example.com', 7, documentToken,
    );
    expect(updated).toEqual([{ css: { code: 'css-two' } }]);
    const updatedCalls = vi.mocked(executeScript).mock.calls;
    expect(updatedCalls[updatedCalls.length - 1]?.[0]).toBe('js-two');
});

test('publishes JavaScript and CSS atomically after a failed refresh', async () => {
    vi.mocked(sourceReader.read)
        .mockResolvedValueOnce({ ok: true, content: 'js-one' })
        .mockResolvedValueOnce({ ok: true, content: 'css-one' })
        .mockResolvedValueOnce({ ok: true, content: 'js-two' })
        .mockResolvedValueOnce({ ok: false, errorCode: NativeErrorCode.FileNotFound })
        .mockResolvedValueOnce({ ok: true, content: 'js-three' })
        .mockResolvedValueOnce({ ok: true, content: 'css-three' });
    const service = makeInjections();

    await service.getPageInjections('https://example.com', 7, documentToken);
    const stale = await service.getPageInjections('https://example.com', 7, documentToken);
    expect(stale).toEqual([{ css: { code: 'css-one' } }]);
    await vi.waitFor(() => {
        expect(sourceReader.read).toHaveBeenCalledTimes(4);
    });
    await flushAsyncWork();

    const recovered = await service.getPageInjections(
        'https://example.com', 7, documentToken,
    );

    expect(recovered).toEqual([{
        css: { code: 'css-three' },
    }]);
    expect(vi.mocked(executeScript).mock.calls.map(([script]) => script))
        .toEqual(['js-one', 'js-one', 'js-three']);
});

test('editing a rule invalidates its last-known-good sources immediately', async () => {
    vi.mocked(sourceReader.read)
        .mockResolvedValueOnce({ ok: true, content: 'js-one' })
        .mockResolvedValueOnce({ ok: true, content: 'css-one' })
        .mockResolvedValueOnce({ ok: true, content: 'js-two' })
        .mockResolvedValueOnce({ ok: true, content: 'css-two' });
    const service = makeInjections();
    await service.getPageInjections('https://example.com', 7, documentToken);

    service.updateInjection('rule-1', {
        site: 'example.com',
        jsPath: 'file:///source-v2.js',
        cssPath: 'file:///source-v2.css',
    });
    const afterEdit = await service.getPageInjections(
        'https://example.com', 7, documentToken,
    );

    expect(afterEdit).toEqual([{
        css: { code: 'css-two' },
    }]);
    const updatedCalls = vi.mocked(executeScript).mock.calls;
    expect(updatedCalls[updatedCalls.length - 1]?.[0]).toBe('js-two');
});
