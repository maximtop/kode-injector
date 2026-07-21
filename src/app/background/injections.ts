/**
 * @file
 */

import throttle from 'lodash/throttle';
import find from 'lodash/find';

import { nanoid } from 'nanoid';
import { storage } from './storage';
import type {
    CssInjectionCode,
    InjectionFileField,
    InjectionFileIssues,
    InjectionRule,
    InjectionsCodeResponse,
    NewInjectionData,
    StoredInjectionsState,
} from '../common/contracts';
import { InjectionField } from '../common/constants';
import { hasInjectionSource, normalizeStoredInjectionsState } from '../common/contracts';
import {
    FILE_ENABLED_FLAGS,
    FILE_KINDS,
    isFileActive,
} from '../common/injection-files';
import {
    CURRENT_INJECTIONS_SCHEMA_VERSION,
    INJECTIONS_MIGRATIONS,
} from './injections-migrations';
import { runMigrations, SCHEMA_VERSION_KEY } from '../common/storage-migrations';
import { log } from '../common/log';
import { urlUtils } from '../common/url-utils';
import { app } from './app';
import { executeScript } from './execute-script';
import { sourceReader } from './native-host';
import { SourceReadErrorCode } from './source-reader';
import { localSourceAccess } from './local-source-access';

const FILE_URL_PREFIX = 'file://';

/**
 * Manages injection rules, site blocklisting, and code retrieval.
 */
class Injections {
    /**
     * Storage key for persisted injection state.
     */
    STORAGE_KEY = 'injections';

    /**
     * Delay used to throttle storage updates.
     */
    UPDATE_STORAGE_TIMEOUT_MS = 1000;

    /**
     * Configured injection rules.
     */
    injections: InjectionRule[] = [];

    /**
     * Hostnames where injections are disabled.
     */
    blocklist: string[] = [];

    /**
     * Persists the current injection and blocklist state.
     */
    updateStorage = throttle(async (): Promise<void> => {
        await storage.set<StoredInjectionsState>(this.STORAGE_KEY, {
            [SCHEMA_VERSION_KEY]: CURRENT_INJECTIONS_SCHEMA_VERSION,
            injections: this.injections,
            blocklist: this.blocklist,
        } as StoredInjectionsState);
    }, this.UPDATE_STORAGE_TIMEOUT_MS);

    /**
     * Normalizes user-provided injection data.
     *
     * @param injectionData Raw injection data.
     *
     * @returns Trimmed data with a site and at least one source path, or null.
     */
    private normalizeInjectionData = (
        injectionData: Partial<NewInjectionData> | null | undefined,
    ): NewInjectionData | null => {
        const site = injectionData?.site?.trim() ?? '';
        const jsPath = urlUtils.normalizeRuleFilePath(injectionData?.jsPath ?? '');
        const cssPath = urlUtils.normalizeRuleFilePath(injectionData?.cssPath ?? '');

        if (!site || !hasInjectionSource({ jsPath, cssPath })) {
            return null;
        }

        return { site, jsPath, cssPath };
    };

    /**
     * Adds a validated injection rule.
     *
     * @param injectionData Raw injection data.
     * @param enabled Initial enabled state of the created rule.
     *
     * @returns The created rule, or null when the data is invalid.
     */
    addInjection = (
        injectionData: Partial<NewInjectionData> | null | undefined,
        enabled = true,
    ): InjectionRule | null => {
        const normalized = this.normalizeInjectionData(injectionData);
        if (!normalized) {
            return null;
        }

        const injection: InjectionRule = {
            id: nanoid(),
            ...normalized,
            enabled,
            [InjectionField.JsEnabled]: true,
            [InjectionField.CssEnabled]: true,
        };
        this.injections.push(injection);
        this.updateStorage();
        return injection;
    };

    /**
     * Updates an injection rule, preserving its identifier and enabled state.
     *
     * @param id Identifier of the rule to update.
     * @param injectionData Raw replacement data.
     *
     * @returns The updated rule, or null when the rule or data is invalid.
     */
    updateInjection = (
        id: string,
        injectionData: Partial<NewInjectionData> | null | undefined,
    ): InjectionRule | null => {
        const normalized = this.normalizeInjectionData(injectionData);
        if (!normalized) {
            return null;
        }

        const injection = find(this.injections, { id });
        if (!injection) {
            log.error(`Injection with id = "${id}" not found`);
            return null;
        }

        const updated: InjectionRule = {
            ...injection,
            ...normalized,
            // Clearing a path resets its flag, so re-adding the file later
            // never resurrects a stale disabled state.
            [InjectionField.JsEnabled]: normalized.jsPath ? injection.jsEnabled : true,
            [InjectionField.CssEnabled]: normalized.cssPath ? injection.cssEnabled : true,
        };
        const idx = this.injections.indexOf(injection);
        this.injections.splice(idx, 1, updated);
        this.updateStorage();
        return updated;
    };

    /**
     * Enables or disables one source file of a rule.
     *
     * @param id Identifier of the rule.
     * @param field Path field whose file is toggled.
     * @param enabled New enabled state of the file.
     *
     * @returns The updated rule, or null when the rule or file is missing.
     */
    setInjectionFileEnabled = (
        id: string,
        field: InjectionFileField,
        enabled: boolean,
    ): InjectionRule | null => {
        const injection = find(this.injections, { id });
        if (!injection) {
            log.error(`Injection with id = "${id}" not found`);
            return null;
        }
        if (!injection[field]) {
            log.error(`Injection "${id}" has no ${field} file to toggle`);
            return null;
        }

        const updated: InjectionRule = { ...injection, [FILE_ENABLED_FLAGS[field]]: enabled };
        const idx = this.injections.indexOf(injection);
        this.injections.splice(idx, 1, updated);
        this.updateStorage();
        return updated;
    };

    /**
     * Removes an injection rule by identifier.
     */
    removeInjection = (id: string): void => {
        const removedInjection = this.injections.find((injection) => injection.id === id);
        if (!removedInjection) {
            log.error(`Injection with id = "${id}" not found`);
            return;
        }

        const { site } = removedInjection;
        this.injections = this.injections.filter((injection) => injection.id !== id);

        // clear blocklist
        const injectionsForSameSite = this.injections
            .filter((injection) => injection.site === site);
        if (injectionsForSameSite.length === 0) {
            this.blocklist = this.blocklist.filter((blockedSite) => blockedSite !== site);
        }

        this.updateStorage();
    };

    /**
     * Enables an injection rule by identifier.
     */
    enableInjection = (id: string): void => {
        const injection = find(this.injections, { id });
        if (!injection) {
            log.error(`Injection with id = "${id}" not found`);
            return;
        }
        const idx = this.injections.indexOf(injection);
        this.injections.splice(idx, 1, { ...injection, enabled: true });
        this.updateStorage();
    };

    /**
     * Disables an injection rule by identifier.
     */
    disableInjection = (id: string): void => {
        const injection = find(this.injections, { id });
        if (!injection) {
            log.error(`Injection with id = "${id}" not found`);
            return;
        }
        const idx = this.injections.indexOf(injection);
        this.injections.splice(idx, 1, { ...injection, enabled: false });
        this.updateStorage();
    };

    /**
     * Returns all configured injection rules.
     */
    getInjections = (): InjectionRule[] => {
        return this.injections;
    };

    /**
     * Returns injection rules matching a URL.
     */
    getInjectionsByUrl = (url: string): InjectionRule[] | null => {
        const hostname = urlUtils.getHostnameWithoutWww(url);
        if (!hostname) {
            return null;
        }
        // Exact host matching: subdomains need their own rule, and a rule
        // never fires on unrelated hosts that merely contain the site text.
        return this.injections.filter((inj) => inj.site === hostname);
    };

    /**
     * Returns enabled injection rules allowed for a URL.
     */
    getAllowedInjectionsByUrl = (url: string): InjectionRule[] | null => {
        const hostname = urlUtils.getHostnameWithoutWww(url);
        if (!hostname || this.blocklist.includes(hostname)) {
            return null;
        }
        return this.getInjectionsByUrl(url);
    }

    /**
     * Injects matching JavaScript into a browser tab.
     */
    injectJs = async (url: string, tabId?: number): Promise<void> => {
        if (!app.enabled) {
            return;
        }

        const injections = this.getAllowedInjectionsByUrl(url);
        if (!injections) {
            return;
        }

        // Only active JS files run: rule enabled, path set, per-file flag on.
        // (An empty path would also resolve to the worker's own bundle.)
        const enabledInjections = injections
            .filter((injection) => isFileActive(injection, InjectionField.JsPath));
        const promises = enabledInjections.map(async (injection) => {
            const { jsPath } = injection;
            const result = await sourceReader.read(jsPath);
            if (result.ok) {
                await executeScript(result.content, tabId, jsPath);
            } else if (jsPath.startsWith(FILE_URL_PREFIX)
                && result.errorCode !== SourceReadErrorCode.FetchFailed) {
                localSourceAccess.markReadFailed();
            }
        });

        await Promise.all(promises);
    };

    /**
     * Builds CSS injection payloads matching a URL.
     */
    getCssInjection = async (url: string): Promise<InjectionsCodeResponse> => {
        if (!app.enabled) {
            return null;
        }

        const injections = this.getAllowedInjectionsByUrl(url);
        if (!injections) {
            return null;
        }

        const promises: Promise<CssInjectionCode | null>[] = injections
            .filter((injection) => isFileActive(injection, InjectionField.CssPath))
            .map(async (injection) => {
                const { cssPath } = injection;
                const result = await sourceReader.read(cssPath);
                if (!result.ok) {
                    if (cssPath.startsWith(FILE_URL_PREFIX)
                        && result.errorCode !== SourceReadErrorCode.FetchFailed) {
                        localSourceAccess.markReadFailed();
                    }
                    return null;
                }
                return {
                    css: { filename: cssPath, code: result.content },
                };
            });
        const results = await Promise.all(promises);
        return results.filter((result): result is CssInjectionCode => result !== null);
    };

    /**
     * Enables injections for a site.
     *
     * @param url Site URL to remove from the blocklist.
     */
    enableInjectionsForSite(url: string): void {
        const hostname = urlUtils.getHostnameWithoutWww(url);
        if (!hostname) {
            this.updateStorage();
            return;
        }

        this.blocklist = this.blocklist.filter((item) => item !== hostname);
        this.updateStorage();
    }

    /**
     * Disables injections for a site.
     *
     * @param url Site URL to add to the blocklist.
     */
    disableInjectionsForSite(url: string): void {
        const hostname = urlUtils.getHostnameWithoutWww(url);
        if (!hostname || this.blocklist.includes(hostname)) {
            return;
        }
        this.blocklist.push(hostname);
        this.updateStorage();
    }

    /**
     * Probes every configured source file and reports unreadable ones.
     *
     * @returns Unreadable path fields keyed by rule identifier; rules whose
     * files all read successfully are omitted.
     */
    getFileIssues = async (): Promise<InjectionFileIssues> => {
        const issues: InjectionFileIssues = {};

        await Promise.all(this.injections.map(async (injection) => {
            const failed = (await Promise.all(FILE_KINDS.map(async (field) => {
                const path = injection[field];
                if (!path) {
                    return null;
                }
                const result = await sourceReader.read(path);
                return result.ok ? null : field;
            }))).filter((field): field is InjectionFileField => field !== null);

            if (failed.length > 0) {
                issues[injection.id] = failed;
            }
        }));

        return issues;
    };

    /**
     * Checks whether a site is blocklisted.
     */
    isSiteBlacklisted = (url: string): boolean => {
        const hostname = urlUtils.getHostnameWithoutWww(url);
        if (!hostname) {
            return false;
        }

        return this.blocklist.some((h) => h === hostname);
    };

    /**
     * Restores persisted injection state.
     *
     * Sites saved by older versions may carry schemes, www prefixes, or
     * paths; they are normalized to bare hostnames so exact matching keeps
     * firing for them. Unrecognizable values are preserved as-is.
     */
    init = async (): Promise<void> => {
        const storedState = await storage.get<unknown>(this.STORAGE_KEY);
        const { state, migrated } = runMigrations(
            storedState,
            CURRENT_INJECTIONS_SCHEMA_VERSION,
            INJECTIONS_MIGRATIONS,
        );
        const { injections, blocklist } = normalizeStoredInjectionsState(state);
        let repaired = migrated;
        this.injections = injections.map((injection) => {
            const site = urlUtils.normalizeRuleSite(injection.site) ?? injection.site;
            if (site !== injection.site) {
                repaired = true;
                return { ...injection, site };
            }
            return injection;
        });
        this.blocklist = blocklist;
        // Persist immediately after a schema migration or site repair so the
        // stored state converges without waiting for the next user mutation.
        if (repaired) {
            this.updateStorage();
        }
    };
}

export const injections = new Injections();
