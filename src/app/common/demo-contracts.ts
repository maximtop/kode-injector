/**
 * @file Fixed product content and runtime contracts of the Safari built-in demo.
 */

import { urlUtils } from './url-utils';

/**
 * Whether this build ships the built-in demo.
 *
 * The Rspack DefinePlugin replaces the literal member expression
 * `process.env.KODE_INJECTOR_BUILT_IN_DEMO` at build time: `'true'` for the
 * Safari WebExtension build and `'false'` for every other browser. Keep the
 * expression literal; a computed `process.env[...]` access is not replaced.
 */
export const BUILT_IN_DEMO_SHIPPED = process.env.KODE_INJECTOR_BUILT_IN_DEMO === 'true';

/**
 * Hostname of the single fixed demo target.
 */
export const DEMO_TARGET_HOSTNAME = 'example.com';

/**
 * URL opened by the Run Demo action.
 */
export const DEMO_TARGET_URL = `https://${DEMO_TARGET_HOSTNAME}/`;

/**
 * Bundle-relative paths of the fixed demo sources inside the Safari build.
 */
export const DEMO_RESOURCE_PATHS = {
    javascript: 'demo/example-com.js',
    css: 'demo/example-com.css',
} as const;

/**
 * DOM id of the element created by the demo JavaScript; also the marker that
 * the bundled JavaScript must contain.
 */
export const DEMO_ELEMENT_ID = 'kode-injector-demo';

/**
 * Custom property set by the demo CSS; also the marker that the bundled CSS
 * must contain.
 */
export const DEMO_CSS_MARKER_PROPERTY = '--kode-injector-demo-css';

/**
 * Value of the CSS marker property once the stylesheet is applied.
 */
export const DEMO_CSS_MARKER_VALUE = 'applied';

/**
 * Bounded wait for a complete JavaScript-and-CSS result after the tab opens.
 */
export const DEMO_WAIT_TIMEOUT_MS = 15_000;

/**
 * Test id of the Run Demo control; shared by the card, the E2E, and the
 * store validator that requires the control in the built options bundle.
 */
export const DEMO_RUN_TEST_ID = 'demo-run-btn';

/**
 * Lifecycle status of the background demo launch.
 */
export enum DemoLaunchStatus {
    None = 'none',
    Waiting = 'waiting',
    Applied = 'applied',
    Failed = 'failed',
}

/**
 * Closed set of reasons why a demo did not complete.
 */
export enum DemoFailureReason {
    Unavailable = 'unavailable',
    Paused = 'paused',
    OpenFailed = 'openFailed',
    SourcesUnavailable = 'sourcesUnavailable',
    WebsiteAccessRequired = 'websiteAccessRequired',
    NotConfirmed = 'notConfirmed',
    Interrupted = 'interrupted',
    SiteDisabled = 'siteDisabled',
}

/**
 * Background launch state returned to the options page.
 */
export interface DemoLaunchState {
    /**
     * Current launch status.
     */
    status: DemoLaunchStatus;

    /**
     * Failure reason when the status is failed.
     */
    failure?: DemoFailureReason;
}

/**
 * Result of a Run Demo request.
 */
export type RunDemoResult =
    | { ok: true }
    | { ok: false; reason: DemoFailureReason };

/**
 * Fixed demo sources ready for injection.
 */
export interface DemoSources {
    /**
     * Demo JavaScript text.
     */
    javascript: string;

    /**
     * Demo CSS text.
     */
    css: string;
}

/**
 * `storage.session` key of the persisted demo launch. Session storage is
 * memory-backed, survives background unloads, disappears when the browser
 * quits, and is separate from the `storage.local` area of rules and settings.
 */
export const DEMO_LAUNCH_SESSION_KEY = 'demo.launch';

/**
 * Launch record persisted across background unloads.
 */
export interface PersistedDemoLaunch {
    /**
     * Tab opened by Run Demo.
     */
    tabId: number;

    /**
     * Clock value when the tab was opened or last reloaded by Run Demo.
     */
    startedAt: number;

    /**
     * Current status; never `none` (an absent record means no launch).
     */
    status: DemoLaunchStatus;

    /**
     * Failure reason when failed.
     */
    failure?: DemoFailureReason;
}

/**
 * Validates an untrusted value read from session storage.
 *
 * @param value Stored value.
 *
 * @returns A launch record, or null when the value is absent or malformed.
 */
export const toPersistedDemoLaunch = (value: unknown): PersistedDemoLaunch | null => {
    if (typeof value !== 'object' || value === null || Array.isArray(value)) {
        return null;
    }
    const record = value as Record<string, unknown>;
    const statuses: unknown[] = Object.values(DemoLaunchStatus);
    const reasons: unknown[] = Object.values(DemoFailureReason);
    if (typeof record.tabId !== 'number'
        || typeof record.startedAt !== 'number'
        || !statuses.includes(record.status)
        || record.status === DemoLaunchStatus.None
        || (record.failure !== undefined && !reasons.includes(record.failure))) {
        return null;
    }
    const launch: PersistedDemoLaunch = {
        tabId: record.tabId,
        startedAt: record.startedAt,
        status: record.status as DemoLaunchStatus,
    };
    if (record.failure !== undefined) {
        launch.failure = record.failure as DemoFailureReason;
    }
    return launch;
};

/**
 * Checks whether the demo card and actions should be offered.
 *
 * @param ruleCount Number of persisted custom rules.
 * @param shipped Whether the running build ships the demo.
 *
 * @returns Whether the built-in demo is currently available.
 */
export const isBuiltInDemoOffered = (
    ruleCount: number,
    shipped: boolean = BUILT_IN_DEMO_SHIPPED,
): boolean => shipped && ruleCount === 0;

/**
 * Checks whether a document URL belongs to the fixed HTTPS demo target.
 *
 * @param url Document URL reported by the content script or tab.
 *
 * @returns Whether the demo may apply to that document.
 */
export const isDemoTargetUrl = (url: string): boolean => {
    if (!url.startsWith('https://')) {
        return false;
    }
    return urlUtils.getHostnameWithoutWww(url) === DEMO_TARGET_HOSTNAME;
};

/**
 * Checks that bundled demo JavaScript is present and branded.
 *
 * @param source Loaded JavaScript text.
 *
 * @returns Whether the source is usable as the demo JavaScript.
 */
export const isDemoJavaScript = (source: string): boolean => (
    source.trim().length > 0 && source.includes(DEMO_ELEMENT_ID)
);

/**
 * Checks that bundled demo CSS is present and carries its marker.
 *
 * @param source Loaded CSS text.
 *
 * @returns Whether the source is usable as the demo CSS.
 */
export const isDemoCss = (source: string): boolean => (
    source.trim().length > 0 && source.includes(DEMO_CSS_MARKER_PROPERTY)
);
