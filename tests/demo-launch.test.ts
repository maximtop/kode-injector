/**
 * @file
 */

import { beforeEach, expect, test, vi } from 'vitest';

import {
    DemoLaunchService,
    type DemoLaunchDependencies,
    type DemoTab,
} from '../src/app/background/demo-launch-service';
import {
    DEMO_TARGET_URL,
    DemoFailureReason,
    DemoLaunchStatus,
    type DemoSources,
    type PersistedDemoLaunch,
} from '../src/app/common/demo-contracts';

const SOURCES: DemoSources = { javascript: 'demo-js', css: 'demo-css' };
const DEMO_DOCUMENT_URL = 'https://example.com/';
const DEMO_CSS_RESPONSE = [{ css: { code: SOURCES.css } }];
const tokenFor = (index: number): string => index.toString(16).padStart(32, '0');

const deferred = <T>() => {
    let resolve!: (value: T) => void;
    const promise = new Promise<T>((resolvePromise) => {
        resolve = resolvePromise;
    });
    return { promise, resolve };
};

const makeLaunchStore = () => {
    let stored: PersistedDemoLaunch | null = null;
    return {
        read: vi.fn(async () => (stored ? { ...stored } : null)),
        write: vi.fn(async (launch: PersistedDemoLaunch | null) => {
            stored = launch ? { ...launch } : null;
        }),
        peek: () => stored,
    };
};

const makeHarness = (overrides: Partial<DemoLaunchDependencies> = {}) => {
    const openTabs = new Map<number, DemoTab>();
    const removedListeners: Array<(tabId: number) => void> = [];
    const launchStore = makeLaunchStore();
    let nextTabId = 100;
    let clock = 1_000;
    const deps: DemoLaunchDependencies = {
        shipped: true,
        launchStore,
        createTab: vi.fn(async (url: string) => {
            const id = nextTabId;
            nextTabId += 1;
            openTabs.set(id, { id, url });
            return { id, url };
        }),
        getTab: vi.fn(async (tabId: number) => openTabs.get(tabId)),
        navigateTab: vi.fn(async (tabId: number, url: string) => {
            openTabs.set(tabId, { id: tabId, url });
        }),
        onTabRemoved: vi.fn((listener: (tabId: number) => void) => {
            removedListeners.push(listener);
        }),
        executeScript: vi.fn(async () => true),
        loadSources: vi.fn(async () => SOURCES),
        getRuleCount: vi.fn(() => 0),
        isAppEnabled: vi.fn(() => true),
        isSiteBlocked: vi.fn(() => false),
        now: vi.fn(() => clock),
        waitTimeoutMs: 15_000,
        ...overrides,
    };
    const service = new DemoLaunchService(deps);
    service.init();
    return {
        deps,
        service,
        launchStore,
        // Simulates a background unload: a fresh instance over the same
        // browser state and session store.
        restart: (): DemoLaunchService => {
            const next = new DemoLaunchService(deps);
            next.init();
            return next;
        },
        removeTab: (tabId: number) => {
            openTabs.delete(tabId);
            removedListeners.forEach((listener) => listener(tabId));
        },
        hideUrl: (tabId: number) => {
            openTabs.set(tabId, { id: tabId, url: '' });
        },
        navigateAway: (tabId: number, url: string) => {
            openTabs.set(tabId, { id: tabId, url });
        },
        advance: (ms: number) => {
            clock += ms;
        },
    };
};

beforeEach(() => {
    vi.clearAllMocks();
});

test('run opens exactly one tab at the fixed target and waits', async () => {
    const { deps, service } = makeHarness();

    await expect(service.run()).resolves.toEqual({ ok: true });

    expect(deps.createTab).toHaveBeenCalledOnce();
    expect(deps.createTab).toHaveBeenCalledWith(DEMO_TARGET_URL);
    await expect(service.getState()).resolves.toEqual({ status: DemoLaunchStatus.Waiting });
});

test.each([
    ['a build without the demo', { shipped: false }, DemoFailureReason.Unavailable],
    ['existing custom rules', { getRuleCount: () => 1 }, DemoFailureReason.Unavailable],
    ['paused injections', { isAppEnabled: () => false }, DemoFailureReason.Paused],
    ['a site the user turned off', { isSiteBlocked: () => true }, DemoFailureReason.SiteDisabled],
    ['unusable sources', { loadSources: async () => { throw new Error('DEMO_SOURCES_INVALID'); } }, DemoFailureReason.SourcesUnavailable],
])('run refuses for %s without opening a tab', async (_name, overrides, reason) => {
    const { deps, service } = makeHarness(overrides);

    await expect(service.run()).resolves.toEqual({ ok: false, reason });

    expect(deps.createTab).not.toHaveBeenCalled();
    await expect(service.getState()).resolves.toEqual({ status: DemoLaunchStatus.None });
});

test('run reports a tab that could not be opened', async () => {
    const { service } = makeHarness({
        createTab: async () => { throw new Error('blocked'); },
    });

    await expect(service.run()).resolves.toEqual({
        ok: false,
        reason: DemoFailureReason.OpenFailed,
    });
    await expect(service.getState()).resolves.toEqual({ status: DemoLaunchStatus.None });
});

test('20 rapid runs coalesce into one launch with one tab', async () => {
    const { deps, service } = makeHarness();

    const results = await Promise.all(
        Array.from({ length: 20 }, () => service.run()),
    );

    expect(results).toEqual(Array(20).fill({ ok: true }));
    expect(deps.createTab).toHaveBeenCalledOnce();
    await expect(service.getState()).resolves.toEqual({ status: DemoLaunchStatus.Waiting });
});

test('a repeated run navigates the bound tab to the target instead of opening another', async () => {
    const { deps, service, advance } = makeHarness();
    await service.run();
    await service.handleDocumentRequest(DEMO_DOCUMENT_URL, 100, tokenFor(1));
    await expect(service.getState()).resolves.toEqual({ status: DemoLaunchStatus.Applied });

    advance(1_000);
    await expect(service.run()).resolves.toEqual({ ok: true });

    expect(deps.createTab).toHaveBeenCalledOnce();
    expect(deps.navigateTab).toHaveBeenCalledWith(100, DEMO_TARGET_URL);
    await expect(service.getState()).resolves.toEqual({ status: DemoLaunchStatus.Waiting });
});

test('a repeated run brings a tab that left the target back to it', async () => {
    const { deps, service, navigateAway } = makeHarness();
    await service.run();
    navigateAway(100, 'https://www.iana.org/domains/example');

    await expect(service.run()).resolves.toEqual({ ok: true });

    expect(deps.createTab).toHaveBeenCalledOnce();
    expect(deps.navigateTab).toHaveBeenCalledWith(100, DEMO_TARGET_URL);
    await expect(service.handleDocumentRequest(DEMO_DOCUMENT_URL, 100, tokenFor(1)))
        .resolves.toEqual(DEMO_CSS_RESPONSE);
});

test('every document of the launch tab receives JavaScript once and CSS once, across 20 rapid reloads', async () => {
    const { deps, service } = makeHarness();
    await service.run();

    const responses = await Promise.all(
        Array.from({ length: 20 }, (_, index) => (
            service.handleDocumentRequest(DEMO_DOCUMENT_URL, 100, tokenFor(index))
        )),
    );

    expect(responses).toEqual(Array(20).fill(DEMO_CSS_RESPONSE));
    expect(deps.executeScript).toHaveBeenCalledTimes(20);
    for (let index = 0; index < 20; index += 1) {
        expect(deps.executeScript).toHaveBeenNthCalledWith(
            index + 1,
            SOURCES.javascript,
            100,
            tokenFor(index),
        );
    }
    await expect(service.getState()).resolves.toEqual({ status: DemoLaunchStatus.Applied });
});

test('documents outside the launch tab or target never receive the demo', async () => {
    const { deps, service } = makeHarness();
    await service.run();

    await expect(service.handleDocumentRequest(DEMO_DOCUMENT_URL, 101, tokenFor(1)))
        .resolves.toBeUndefined();
    await expect(service.handleDocumentRequest(DEMO_DOCUMENT_URL, undefined, tokenFor(2)))
        .resolves.toBeUndefined();
    expect(deps.executeScript).not.toHaveBeenCalled();
    await expect(service.getState()).resolves.toEqual({ status: DemoLaunchStatus.Waiting });

    await expect(service.handleDocumentRequest('https://example.org/', 100, tokenFor(3)))
        .resolves.toBeUndefined();
    expect(deps.executeScript).not.toHaveBeenCalled();
    await expect(service.getState()).resolves.toEqual({ status: DemoLaunchStatus.None });
});

test('the first custom rule rejects in-flight demo work and later runs start fresh', async () => {
    const sources = deferred<DemoSources>();
    const ruleCount = vi.fn(() => 0);
    const { deps, service } = makeHarness({
        getRuleCount: ruleCount,
        loadSources: vi.fn()
            .mockResolvedValueOnce(SOURCES)
            .mockReturnValueOnce(sources.promise)
            .mockResolvedValue(SOURCES),
    });
    await service.run();

    // A rule is saved while the first document's sources are still loading.
    const request = service.handleDocumentRequest(DEMO_DOCUMENT_URL, 100, tokenFor(1));
    service.invalidate();
    ruleCount.mockReturnValue(1);
    sources.resolve(SOURCES);
    await expect(request).resolves.toBeNull();
    expect(deps.executeScript).not.toHaveBeenCalled();
    await expect(service.getState()).resolves.toEqual({ status: DemoLaunchStatus.None });

    // Deleting the rule restores availability only: the old tab gets nothing.
    ruleCount.mockReturnValue(0);
    await expect(service.handleDocumentRequest(DEMO_DOCUMENT_URL, 100, tokenFor(2)))
        .resolves.toBeUndefined();
    expect(deps.executeScript).not.toHaveBeenCalled();

    await expect(service.run()).resolves.toEqual({ ok: true });
    expect(deps.createTab).toHaveBeenCalledTimes(2);
});

test('a failed JavaScript execution withholds CSS and reports not confirmed', async () => {
    const { service } = makeHarness({ executeScript: async () => false });
    await service.run();

    await expect(service.handleDocumentRequest(DEMO_DOCUMENT_URL, 100, tokenFor(1)))
        .resolves.toBeNull();
    await expect(service.getState()).resolves.toEqual({
        status: DemoLaunchStatus.Failed,
        failure: DemoFailureReason.NotConfirmed,
    });
});

test('a site turned off by the user at document time applies nothing and reports it', async () => {
    const blocked = vi.fn(() => false);
    const { deps, service } = makeHarness({ isSiteBlocked: blocked });
    await service.run();

    blocked.mockReturnValue(true);
    await expect(service.handleDocumentRequest(DEMO_DOCUMENT_URL, 100, tokenFor(1)))
        .resolves.toBeNull();
    expect(deps.executeScript).not.toHaveBeenCalled();
    await expect(service.getState()).resolves.toEqual({
        status: DemoLaunchStatus.Failed,
        failure: DemoFailureReason.SiteDisabled,
    });
});

test('a build without the demo never touches the session store for documents', async () => {
    const { deps, service } = makeHarness({ shipped: false });

    await expect(service.handleDocumentRequest(DEMO_DOCUMENT_URL, 100, tokenFor(1)))
        .resolves.toBeUndefined();

    expect(deps.launchStore.read).not.toHaveBeenCalled();
    expect(deps.executeScript).not.toHaveBeenCalled();
});

test('pause at document time applies nothing and reports paused', async () => {
    const enabled = vi.fn(() => true);
    const { deps, service } = makeHarness({ isAppEnabled: enabled });
    await service.run();

    enabled.mockReturnValue(false);
    await expect(service.handleDocumentRequest(DEMO_DOCUMENT_URL, 100, tokenFor(1)))
        .resolves.toBeNull();
    expect(deps.executeScript).not.toHaveBeenCalled();
    await expect(service.getState()).resolves.toEqual({
        status: DemoLaunchStatus.Failed,
        failure: DemoFailureReason.Paused,
    });
});

test('the bounded wait distinguishes missing website access, an unconfirmed page, and a vanished tab', async () => {
    const withoutAccess = makeHarness();
    await withoutAccess.service.run();
    withoutAccess.hideUrl(100);
    withoutAccess.advance(15_000);
    await expect(withoutAccess.service.getState()).resolves.toEqual({
        status: DemoLaunchStatus.Failed,
        failure: DemoFailureReason.WebsiteAccessRequired,
    });

    const withAccess = makeHarness();
    await withAccess.service.run();
    withAccess.advance(14_999);
    await expect(withAccess.service.getState())
        .resolves.toEqual({ status: DemoLaunchStatus.Waiting });
    withAccess.advance(1);
    await expect(withAccess.service.getState()).resolves.toEqual({
        status: DemoLaunchStatus.Failed,
        failure: DemoFailureReason.NotConfirmed,
    });

    const vanished = makeHarness();
    await vanished.service.run();
    vi.mocked(vanished.deps.getTab).mockResolvedValue(undefined);
    vanished.advance(15_000);
    await expect(vanished.service.getState()).resolves.toEqual({ status: DemoLaunchStatus.None });
});

test('a late document still applies after a website-access grant', async () => {
    const { deps, service, advance } = makeHarness();
    await service.run();
    advance(15_000);
    await expect(service.getState()).resolves.toMatchObject({ status: DemoLaunchStatus.Failed });

    await expect(service.handleDocumentRequest(DEMO_DOCUMENT_URL, 100, tokenFor(1)))
        .resolves.toEqual(DEMO_CSS_RESPONSE);
    expect(deps.executeScript).toHaveBeenCalledOnce();
    await expect(service.getState()).resolves.toEqual({ status: DemoLaunchStatus.Applied });
});

test('closing the demo tab discards the launch', async () => {
    const { service, removeTab, launchStore } = makeHarness();
    await service.run();
    expect(launchStore.peek()).toMatchObject({ tabId: 100, status: DemoLaunchStatus.Waiting });

    removeTab(100);

    await expect(service.getState()).resolves.toEqual({ status: DemoLaunchStatus.None });
    expect(launchStore.peek()).toBeNull();
});

test('a launch survives a background restart and stays bound to its tab', async () => {
    const { deps, service, restart, launchStore } = makeHarness();
    await service.run();

    const restarted = restart();
    await expect(restarted.getState()).resolves.toEqual({ status: DemoLaunchStatus.Waiting });
    await expect(restarted.handleDocumentRequest(DEMO_DOCUMENT_URL, 101, tokenFor(1)))
        .resolves.toBeUndefined();
    await expect(restarted.handleDocumentRequest(DEMO_DOCUMENT_URL, 100, tokenFor(2)))
        .resolves.toEqual(DEMO_CSS_RESPONSE);
    expect(deps.createTab).toHaveBeenCalledOnce();
    expect(launchStore.peek()).toMatchObject({ tabId: 100, status: DemoLaunchStatus.Applied });
});

test('a restarted background forgets a launch whose tab closed, and invalidation clears the store', async () => {
    const { service, restart, removeTab, launchStore } = makeHarness();
    await service.run();

    const restarted = restart();
    removeTab(100);
    await expect(restarted.getState()).resolves.toEqual({ status: DemoLaunchStatus.None });
    expect(launchStore.peek()).toBeNull();

    await restarted.run();
    expect(launchStore.peek()).toMatchObject({ tabId: 101 });
    restarted.invalidate();
    expect(launchStore.peek()).toBeNull();
    await expect(restarted.getState()).resolves.toEqual({ status: DemoLaunchStatus.None });
});

test('a first rule saved before the restore resolves wins over the stored launch', async () => {
    const { service, restart, launchStore } = makeHarness();
    await service.run();
    expect(launchStore.peek()).toMatchObject({ tabId: 100 });

    const restarted = restart();
    const pending = restarted.getState();
    restarted.invalidate();

    await expect(pending).resolves.toEqual({ status: DemoLaunchStatus.None });
    await expect(restarted.getState()).resolves.toEqual({ status: DemoLaunchStatus.None });
    expect(launchStore.peek()).toBeNull();
});

test('a malformed or unreadable session record is ignored', async () => {
    const broken = makeHarness();
    vi.mocked(broken.deps.launchStore.read).mockRejectedValueOnce(new Error('storage gone'));
    await expect(broken.service.getState()).resolves.toEqual({ status: DemoLaunchStatus.None });
    await expect(broken.service.run()).resolves.toEqual({ ok: true });
});
