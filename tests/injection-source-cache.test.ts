/**
 * @file
 */

import {
    beforeEach,
    expect,
    test,
    vi,
} from 'vitest';

import {
    InjectionSourceCache,
    type ActiveRuleSources,
    type RuleSourceSnapshot,
} from '../src/app/background/injection-source-cache';

const sources: ActiveRuleSources = {
    ruleId: 'rule-1',
    javascriptPath: 'file:///source.js',
    cssPath: 'file:///source.css',
};

const snapshot = (version: string): RuleSourceSnapshot => ({
    ...sources,
    javascriptCode: `js-${version}`,
    cssCode: `css-${version}`,
});

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

beforeEach(() => {
    vi.restoreAllMocks();
});

test('serves a cached snapshot while one shared refresh updates the next load', async () => {
    const nextVersion = deferred<RuleSourceSnapshot | null>();
    const load = vi.fn()
        .mockResolvedValueOnce(snapshot('one'))
        .mockReturnValueOnce(nextVersion.promise)
        .mockResolvedValue(snapshot('two'));
    const cache = new InjectionSourceCache(load, vi.fn());

    const cold = await cache.resolve(sources);
    const second = await cache.resolve(sources);
    const rapidThird = await cache.resolve(sources);

    expect(cold).toMatchObject({ snapshot: snapshot('one'), cacheHit: false });
    expect(second).toMatchObject({ snapshot: snapshot('one'), cacheHit: true });
    expect(rapidThird).toMatchObject({ snapshot: snapshot('one'), cacheHit: true });
    expect(load).toHaveBeenCalledTimes(2);

    nextVersion.resolve(snapshot('two'));
    await nextVersion.promise;
    await flushAsyncWork();

    const updated = await cache.resolve(sources);
    expect(updated).toMatchObject({ snapshot: snapshot('two'), cacheHit: true });
});

test('a failed refresh invalidates the stale snapshot for the next load', async () => {
    const failedRefresh = deferred<RuleSourceSnapshot | null>();
    const load = vi.fn()
        .mockResolvedValueOnce(snapshot('one'))
        .mockReturnValueOnce(failedRefresh.promise)
        .mockResolvedValueOnce(null);
    const cache = new InjectionSourceCache(load, vi.fn());

    await cache.resolve(sources);
    const stale = await cache.resolve(sources);
    expect(stale).toMatchObject({ snapshot: snapshot('one'), cacheHit: true });

    failedRefresh.resolve(null);
    await failedRefresh.promise;
    await flushAsyncWork();

    await expect(cache.resolve(sources)).resolves.toBeNull();
    expect(load).toHaveBeenCalledTimes(3);
});

test('invalidation prevents an older in-flight refresh from publishing', async () => {
    const oldRead = deferred<RuleSourceSnapshot | null>();
    const load = vi.fn()
        .mockReturnValueOnce(oldRead.promise)
        .mockResolvedValue(snapshot('new'));
    const cache = new InjectionSourceCache(load, vi.fn());

    const obsoleteResolution = cache.resolve(sources);
    cache.invalidate(sources.ruleId);
    const current = await cache.resolve(sources);
    oldRead.resolve(snapshot('old'));

    await expect(obsoleteResolution).resolves.toBeNull();
    expect(current).toMatchObject({ snapshot: snapshot('new'), cacheHit: false });
    const cached = await cache.resolve(sources);
    expect(cached).toMatchObject({ snapshot: snapshot('new'), cacheHit: true });
});

test('clearing starts a new read instead of reusing obsolete in-flight work', async () => {
    const oldRead = deferred<RuleSourceSnapshot | null>();
    const load = vi.fn()
        .mockReturnValueOnce(oldRead.promise)
        .mockResolvedValue(snapshot('new'));
    const cache = new InjectionSourceCache(load, vi.fn());

    const obsoleteResolution = cache.resolve(sources);
    cache.clear();
    const current = await cache.resolve(sources);
    oldRead.resolve(snapshot('old'));

    await expect(obsoleteResolution).resolves.toBeNull();
    expect(current).toMatchObject({ snapshot: snapshot('new'), cacheHit: false });
    expect(load).toHaveBeenCalledTimes(2);
});

test('evicts least-recently-used entries while respecting the memory limit', async () => {
    const load = vi.fn(async (descriptor: ActiveRuleSources): Promise<RuleSourceSnapshot> => ({
        ...descriptor,
        javascriptCode: descriptor.ruleId,
    }));
    const cache = new InjectionSourceCache(load, vi.fn(), 2, 12);
    const first = { ruleId: 'first', javascriptPath: 'file:///first.js' };
    const second = { ruleId: 'second', javascriptPath: 'file:///second.js' };
    const third = { ruleId: 'third', javascriptPath: 'file:///third.js' };

    await cache.resolve(first);
    await cache.resolve(second);
    await cache.resolve(third);
    await cache.resolve(first);

    expect(load).toHaveBeenCalledTimes(4);
});
