/**
 * @file Ephemeral, tab-bound launch of the Safari built-in demo.
 *
 * Pure service: every browser and product collaborator is injected, so the
 * lifecycle is unit-testable without module mocks. `demo-launch.ts` wires it.
 */

/* eslint-disable no-useless-constructor, no-empty-function */

import type { CssInjectionCode, InjectionsCodeResponse } from '../common/contracts';
import {
    DEMO_TARGET_URL,
    DemoFailureReason,
    DemoLaunchStatus,
    isBuiltInDemoOffered,
    isDemoTargetUrl,
    type DemoLaunchState,
    type DemoSources,
    type PersistedDemoLaunch,
    type RunDemoResult,
} from '../common/demo-contracts';
import { log } from '../common/log';

/**
 * Persistence of the single launch across background unloads.
 */
export interface DemoLaunchStore {
    /**
     * Reads the stored launch, or null when none is stored or it is malformed.
     */
    read(): Promise<PersistedDemoLaunch | null>;

    /**
     * Stores the launch, or clears it with null.
     *
     * @param launch Launch to store, or null.
     */
    write(launch: PersistedDemoLaunch | null): Promise<void>;
}

/**
 * Browser tab data used by the demo launch.
 */
export interface DemoTab {
    /**
     * Tab identifier.
     */
    id?: number;

    /**
     * Tab URL; Safari returns an empty string when the extension has no
     * website access for the tab.
     */
    url?: string;
}

/**
 * Collaborators of the demo launch service, injected for testability.
 */
export interface DemoLaunchDependencies {
    /**
     * Whether this build ships the demo.
     */
    shipped: boolean;

    /**
     * Session-scoped store that keeps the launch across background unloads.
     */
    launchStore: DemoLaunchStore;

    /**
     * Opens one active tab and returns it.
     *
     * @param url URL to open.
     */
    createTab(url: string): Promise<DemoTab>;

    /**
     * Reads a tab, or resolves undefined when it no longer exists.
     *
     * @param tabId Tab identifier.
     */
    getTab(tabId: number): Promise<DemoTab | undefined>;

    /**
     * Brings a tab to the front and loads a URL in it.
     *
     * @param tabId Tab identifier.
     * @param url URL to load.
     */
    navigateTab(tabId: number, url: string): Promise<void>;

    /**
     * Subscribes to tab removal.
     *
     * @param listener Receives the removed tab identifier.
     */
    onTabRemoved(listener: (tabId: number) => void): void;

    /**
     * Executes JavaScript in the main world; resolves false on failure.
     *
     * @param script JavaScript source.
     * @param tabId Target tab.
     * @param documentToken Identity of the requesting document.
     */
    executeScript(script: string, tabId: number, documentToken: string): Promise<boolean>;

    /**
     * Loads the validated fixed sources; rejects when unusable.
     */
    loadSources(): Promise<DemoSources>;

    /**
     * Returns the current custom-rule count.
     */
    getRuleCount(): number;

    /**
     * Whether injections are globally enabled.
     */
    isAppEnabled(): boolean;

    /**
     * Whether the user disabled injecting on a site (per-site blocklist).
     *
     * @param url Document URL.
     */
    isSiteBlocked(url: string): boolean;

    /**
     * Clock in milliseconds.
     */
    now(): number;

    /**
     * Bounded wait before an unconfirmed launch fails.
     */
    waitTimeoutMs: number;
}

/**
 * One ephemeral launch bound to a tab (the persisted record shape).
 */
type Launch = PersistedDemoLaunch;

/**
 * Owns the single built-in demo launch of this Safari session.
 *
 * Launch records are replaced, never mutated: identity is the tab id plus the
 * arming time, so a record swapped by a status change still counts as the
 * same launch for work that started earlier, while a repeated Run Demo
 * (new `startedAt`) makes older continuations stale.
 */
export class DemoLaunchService {
    /**
     * Current launch, or null when none is active. Mirrors the session store.
     */
    private launch: Launch | null = null;

    /**
     * In-flight Run Demo request shared by rapid repeated clicks.
     */
    private pendingRun: Promise<RunDemoResult> | null = null;

    /**
     * One-time restore of a launch left by a previous background instance.
     */
    private restoring: Promise<void> | null = null;

    /**
     * Whether the restore finished (successfully or not).
     */
    private restored = false;

    /**
     * Whether this instance wrote the launch itself; a local write is
     * authoritative over a restore that resolves later.
     */
    private overwritten = false;

    /**
     * Creates the service over injected browser and product collaborators.
     *
     * @param deps Collaborators.
     */
    public constructor(private readonly deps: DemoLaunchDependencies) {}

    /**
     * Registers tab lifecycle listeners; does nothing when the demo is not shipped.
     */
    public init = (): void => {
        if (!this.deps.shipped) {
            return;
        }
        this.deps.onTabRemoved((tabId) => {
            if (this.restored) {
                this.forgetTab(tabId);
            } else {
                this.ensureRestored().then(() => this.forgetTab(tabId));
            }
        });
    };

    /**
     * Starts the demo or re-focuses the existing demo tab.
     *
     * Rapid repeated calls share one promise, so one click sequence can never
     * open competing tabs.
     *
     * @returns Whether a launch is active after the call, or why not.
     */
    public run = (): Promise<RunDemoResult> => {
        if (!this.pendingRun) {
            this.pendingRun = this.startOrFocus().finally(() => {
                this.pendingRun = null;
            });
        }
        return this.pendingRun;
    };

    /**
     * Returns the launch state, failing an unconfirmed launch after the
     * bounded wait. Evaluated lazily on request because the background may be
     * suspended between timers.
     */
    public getState = async (): Promise<DemoLaunchState> => {
        if (!this.restored) {
            await this.ensureRestored();
        }
        const { launch } = this;
        if (launch
            && launch.status === DemoLaunchStatus.Waiting
            && this.deps.now() - launch.startedAt >= this.deps.waitTimeoutMs) {
            const tab = await this.deps.getTab(launch.tabId);
            if (!this.isCurrent(launch)) {
                return this.getState();
            }
            if (!tab) {
                this.setLaunch(null);
            } else {
                // Safari hides the URL of tabs the extension may not access.
                this.fail(launch, tab.url
                    ? DemoFailureReason.NotConfirmed
                    : DemoFailureReason.WebsiteAccessRequired);
            }
        }
        return this.snapshot();
    };

    /**
     * Serves the demo for one document of the launch tab.
     *
     * @param url Document URL reported by the content script.
     * @param tabId Tab containing the document.
     * @param documentToken Identity of the requesting document.
     *
     * @returns `undefined` when the regular rule flow should handle the
     * request; `null` when the document belongs to the launch but nothing may
     * be applied; otherwise the CSS to apply after JavaScript was executed.
     */
    public handleDocumentRequest = async (
        url: string,
        tabId: number | undefined,
        documentToken: string,
    ): Promise<InjectionsCodeResponse | undefined> => {
        if (!this.deps.shipped) {
            return undefined;
        }
        // Once restored, capture the launch synchronously so that an
        // invalidation racing this request is detected by isCurrent() below.
        if (!this.restored) {
            await this.ensureRestored();
        }
        const { launch } = this;
        if (!launch || tabId === undefined || launch.tabId !== tabId) {
            return undefined;
        }
        if (!isDemoTargetUrl(url)
            || !isBuiltInDemoOffered(this.deps.getRuleCount(), this.deps.shipped)) {
            // Navigated away from the target, or a custom rule now exists.
            this.setLaunch(null);
            return undefined;
        }
        if (!this.deps.isAppEnabled()) {
            this.fail(launch, DemoFailureReason.Paused);
            return null;
        }
        if (this.deps.isSiteBlocked(url)) {
            this.fail(launch, DemoFailureReason.SiteDisabled);
            return null;
        }

        let sources: DemoSources;
        try {
            sources = await this.deps.loadSources();
        } catch (error) {
            log.error('Built-in demo sources could not be loaded', error);
            this.fail(launch, DemoFailureReason.SourcesUnavailable);
            return null;
        }
        if (!this.isCurrent(launch)) {
            // Invalidated while loading: reject stale work before any injection.
            return null;
        }

        const executed = await this.deps.executeScript(sources.javascript, tabId, documentToken);
        if (!executed) {
            this.fail(launch, DemoFailureReason.NotConfirmed);
            return null;
        }
        // JavaScript already ran in this document: its CSS completes the same
        // document even if the launch ended meanwhile; later documents get
        // nothing (the launch is gone), so no partial demo reaches them.
        if (this.isCurrent(launch)) {
            this.setLaunch({
                tabId: launch.tabId,
                startedAt: launch.startedAt,
                status: DemoLaunchStatus.Applied,
            });
        }
        const css: CssInjectionCode[] = [{ css: { code: sources.css } }];
        return css;
    };

    /**
     * Ends any launch, e.g. after the first custom rule is saved.
     */
    public invalidate = (): void => {
        this.setLaunch(null);
    };

    /**
     * Opens a new demo tab or re-arms the existing one.
     */
    private startOrFocus = async (): Promise<RunDemoResult> => {
        if (!this.restored) {
            await this.ensureRestored();
        }
        if (!isBuiltInDemoOffered(this.deps.getRuleCount(), this.deps.shipped)) {
            return { ok: false, reason: DemoFailureReason.Unavailable };
        }
        if (!this.deps.isAppEnabled()) {
            return { ok: false, reason: DemoFailureReason.Paused };
        }
        if (this.deps.isSiteBlocked(DEMO_TARGET_URL)) {
            return { ok: false, reason: DemoFailureReason.SiteDisabled };
        }
        try {
            await this.deps.loadSources();
        } catch (error) {
            log.error('Built-in demo sources could not be loaded', error);
            return { ok: false, reason: DemoFailureReason.SourcesUnavailable };
        }

        // Re-arm the bound tab by navigating it to the target: this also
        // brings back a tab that left example.com through a link.
        const existing = this.launch;
        if (existing && await this.deps.getTab(existing.tabId)) {
            try {
                await this.deps.navigateTab(existing.tabId, DEMO_TARGET_URL);
                this.setLaunch({
                    tabId: existing.tabId,
                    startedAt: this.deps.now(),
                    status: DemoLaunchStatus.Waiting,
                });
                return { ok: true };
            } catch (error) {
                log.error('Could not reuse the demo tab', error);
            }
        }
        this.setLaunch(null);

        let tab: DemoTab;
        try {
            tab = await this.deps.createTab(DEMO_TARGET_URL);
        } catch (error) {
            log.error('Could not open the demo tab', error);
            return { ok: false, reason: DemoFailureReason.OpenFailed };
        }
        if (typeof tab.id !== 'number') {
            return { ok: false, reason: DemoFailureReason.OpenFailed };
        }
        if (!isBuiltInDemoOffered(this.deps.getRuleCount(), this.deps.shipped)) {
            // A rule saved while the tab was opening is authoritative.
            return { ok: false, reason: DemoFailureReason.Unavailable };
        }
        this.setLaunch({
            tabId: tab.id,
            startedAt: this.deps.now(),
            status: DemoLaunchStatus.Waiting,
        });
        return { ok: true };
    };

    /**
     * Restores a launch left by a previous background instance, once.
     */
    private ensureRestored = (): Promise<void> => {
        if (!this.restoring) {
            this.restoring = this.deps.launchStore.read()
                .then((stored) => {
                    if (stored && this.launch === null && !this.overwritten) {
                        this.launch = { ...stored };
                    }
                })
                .catch((error) => {
                    log.error('Could not restore the demo launch', error);
                })
                .finally(() => {
                    this.restored = true;
                });
        }
        return this.restoring;
    };

    /**
     * Drops the launch when the removed tab is the demo tab.
     *
     * @param tabId Removed tab identifier.
     */
    private forgetTab = (tabId: number): void => {
        if (this.launch?.tabId === tabId) {
            this.setLaunch(null);
        }
    };

    /**
     * Checks whether a launch captured before an await is still the active
     * arming of the same tab (a repeated Run Demo re-arms with a new
     * `startedAt`, so stale continuations must not write its status).
     *
     * @param launch Launch captured before an await.
     */
    private isCurrent = (launch: Launch): boolean => (
        this.launch !== null
        && this.launch.tabId === launch.tabId
        && this.launch.startedAt === launch.startedAt
    );

    /**
     * Replaces the launch and writes it through to the session store.
     *
     * @param launch New launch, or null to clear.
     */
    private setLaunch = (launch: Launch | null): void => {
        this.launch = launch;
        this.overwritten = true;
        const snapshot = launch ? { ...launch } : null;
        this.deps.launchStore.write(snapshot).catch((error) => {
            log.error('Could not persist the demo launch', error);
        });
    };

    /**
     * Marks the launch failed when it is still the active one.
     *
     * @param launch Launch captured before an await.
     * @param reason Failure reason.
     */
    private fail = (launch: Launch, reason: DemoFailureReason): void => {
        if (!this.isCurrent(launch)) {
            return;
        }
        this.setLaunch({
            tabId: launch.tabId,
            startedAt: launch.startedAt,
            status: DemoLaunchStatus.Failed,
            failure: reason,
        });
    };

    /**
     * Reads the current launch as a public state value.
     */
    private snapshot = (): DemoLaunchState => {
        const { launch } = this;
        if (!launch) {
            return { status: DemoLaunchStatus.None };
        }
        return launch.failure
            ? { status: launch.status, failure: launch.failure }
            : { status: launch.status };
    };
}
