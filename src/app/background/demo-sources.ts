/**
 * @file Loads and validates the fixed built-in demo sources from the bundle.
 */

/* eslint-disable no-useless-constructor, no-empty-function */

import browser from 'webextension-polyfill';

import {
    DEMO_RESOURCE_PATHS,
    isDemoCss,
    isDemoJavaScript,
    type DemoSources,
} from '../common/demo-contracts';
import { log } from '../common/log';

/**
 * Reads one bundle-relative text resource.
 *
 * @param resourcePath Bundle-relative resource path.
 */
type FetchResourceText = (resourcePath: string) => Promise<string>;

/**
 * Error message raised when a bundled demo source is missing or invalid.
 */
export const DEMO_SOURCES_INVALID = 'DEMO_SOURCES_INVALID';

/**
 * Loads both demo sources once and fails closed when either is unusable.
 */
export class DemoSourceLoader {
    /**
     * In-flight or completed load shared by all callers.
     */
    private pending: Promise<DemoSources> | null = null;

    /**
     * Creates a loader over a resource reader.
     *
     * @param fetchResourceText Reads one bundle-relative text resource.
     */
    public constructor(private readonly fetchResourceText: FetchResourceText) {}

    /**
     * Returns the validated demo sources, loading them on first use.
     *
     * @returns Both sources.
     *
     * @throws Error with `DEMO_SOURCES_INVALID` (or the underlying read
     * failure) when a source is missing, empty, or lacks its marker. The next
     * call retries instead of caching the failure.
     */
    public load = (): Promise<DemoSources> => {
        if (!this.pending) {
            this.pending = this.read().catch((error: unknown) => {
                this.pending = null;
                throw error;
            });
        }
        return this.pending;
    };

    /**
     * Reads and validates both sources.
     *
     * @returns Validated sources.
     *
     * @throws Error with `DEMO_SOURCES_INVALID` when validation fails.
     */
    private read = async (): Promise<DemoSources> => {
        const [javascript, css] = await Promise.all([
            this.fetchResourceText(DEMO_RESOURCE_PATHS.javascript),
            this.fetchResourceText(DEMO_RESOURCE_PATHS.css),
        ]);
        if (!isDemoJavaScript(javascript) || !isDemoCss(css)) {
            log.error('Built-in demo sources are missing or invalid');
            throw new Error(DEMO_SOURCES_INVALID);
        }
        return { javascript, css };
    };
}

export const demoSources = new DemoSourceLoader(async (resourcePath) => {
    const response = await fetch(browser.runtime.getURL(resourcePath));
    if (!response.ok) {
        throw new Error(`${DEMO_SOURCES_INVALID}: ${response.status}`);
    }
    return response.text();
});
