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
import { isNativeHostWideFailure } from './source-reader';
import { localSourceAccess } from './local-source-access';
import { BrowserTarget, getCurrentBrowserTarget } from '../common/browser-target';
import {
    InjectionSourceCache,
    type ActiveRuleSources,
    type RuleSourceResolution,
    type RuleSourceSnapshot,
} from './injection-source-cache';

/**
 * Manages injection rules, site blocklisting, and code retrieval.
 */
export class Injections {
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
     * In-memory Safari source cache.
     */
    private readonly sourceCache: InjectionSourceCache;

    /**
     * Creates the rule service.
     *
     * @param staleSourceCacheEnabled Whether page loads use stale-while-revalidate.
     */
    public constructor(
        private readonly staleSourceCacheEnabled = (
            getCurrentBrowserTarget() === BrowserTarget.Safari
        ),
    ) {
        this.sourceCache = new InjectionSourceCache(
            (sources) => this.readRuleSources(sources),
            (error) => log.error('Background source refresh failed', error),
        );
    }

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
        this.sourceCache.invalidate(id);
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
        this.sourceCache.invalidate(id);
        this.updateStorage();
        return updated;
    };

    /**
     * Removes an injection rule by identifier.
     *
     * @param id Rule identifier to remove.
     */
    removeInjection = (id: string): void => {
        const removedInjection = this.injections.find((injection) => injection.id === id);
        if (!removedInjection) {
            log.error(`Injection with id = "${id}" not found`);
            return;
        }

        const { site } = removedInjection;
        this.injections = this.injections.filter((injection) => injection.id !== id);
        this.sourceCache.invalidate(id);

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
     *
     * @param id Rule identifier to enable.
     */
    enableInjection = (id: string): void => {
        const injection = find(this.injections, { id });
        if (!injection) {
            log.error(`Injection with id = "${id}" not found`);
            return;
        }
        const idx = this.injections.indexOf(injection);
        this.injections.splice(idx, 1, { ...injection, enabled: true });
        this.sourceCache.invalidate(id);
        this.updateStorage();
    };

    /**
     * Disables an injection rule by identifier.
     *
     * @param id Rule identifier to disable.
     */
    disableInjection = (id: string): void => {
        const injection = find(this.injections, { id });
        if (!injection) {
            log.error(`Injection with id = "${id}" not found`);
            return;
        }
        const idx = this.injections.indexOf(injection);
        this.injections.splice(idx, 1, { ...injection, enabled: false });
        this.sourceCache.invalidate(id);
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
     *
     * @param url Page URL whose hostname should be matched.
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
     *
     * @param url Page URL whose enabled rules should be resolved.
     */
    getAllowedInjectionsByUrl = (url: string): InjectionRule[] | null => {
        const hostname = urlUtils.getHostnameWithoutWww(url);
        if (!hostname || this.blocklist.includes(hostname)) {
            return null;
        }
        return this.getInjectionsByUrl(url);
    }

    /**
     * Resolves one document-bound snapshot, starts JavaScript execution, and
     * returns CSS from the same rule versions.
     *
     * @param url URL of the document requesting injections.
     * @param tabId Browser tab containing the requesting document, when available.
     * @param documentToken Identity used to reject work for a superseded document.
     */
    getPageInjections = async (
        url: string,
        tabId: number | undefined,
        documentToken: string,
    ): Promise<InjectionsCodeResponse> => {
        if (!app.enabled) {
            return null;
        }

        const matchingInjections = this.getAllowedInjectionsByUrl(url);
        if (!matchingInjections) {
            return null;
        }

        const descriptors = matchingInjections
            .map(this.getActiveRuleSources)
            .filter((sources): sources is ActiveRuleSources => sources !== null);
        const resolved = (await Promise.all(
            descriptors.map(this.resolveRuleSources),
        )).filter((value): value is RuleSourceResolution => value !== null);

        resolved.forEach(({ snapshot }) => {
            if (!snapshot.javascriptPath || snapshot.javascriptCode === undefined) {
                return;
            }
            executeScript(
                snapshot.javascriptCode,
                tabId,
                documentToken,
            ).catch((error) => {
                log.error('JavaScript injection failed', error);
            });
        });

        return resolved.reduce<CssInjectionCode[]>((result, { snapshot }) => {
            if (snapshot.cssPath && snapshot.cssCode !== undefined) {
                result.push({
                    css: {
                        code: snapshot.cssCode,
                    },
                });
            }
            return result;
        }, []);
    };

    /**
     * Drops all source content held in memory.
     */
    clearSourceCache = (): void => {
        this.sourceCache.clear();
    };

    /**
     * Selects active source paths from one rule.
     *
     * @param injection Rule to inspect.
     *
     * @returns Active paths, or null when the rule has no active source.
     */
    private getActiveRuleSources = (injection: InjectionRule): ActiveRuleSources | null => {
        const javascriptPath = isFileActive(injection, InjectionField.JsPath)
            ? injection.jsPath
            : undefined;
        const cssPath = isFileActive(injection, InjectionField.CssPath)
            ? injection.cssPath
            : undefined;
        if (!javascriptPath && !cssPath) {
            return null;
        }
        return {
            ruleId: injection.id,
            javascriptPath,
            cssPath,
        };
    };

    /**
     * Resolves one rule through Safari cache or a fresh browser read.
     *
     * @param sources Active source paths.
     *
     * @returns A complete atomic rule snapshot, or null after a read failure.
     */
    private resolveRuleSources = async (
        sources: ActiveRuleSources,
    ): Promise<RuleSourceResolution | null> => {
        if (this.staleSourceCacheEnabled) {
            return this.sourceCache.resolve(sources);
        }

        const snapshot = await this.readRuleSources(sources);
        return snapshot ? {
            snapshot,
            cacheHit: false,
        } : null;
    };

    /**
     * Reads all active files of a rule and publishes them only as a complete set.
     *
     * @param sources Active source paths.
     *
     * @returns Fresh rule sources, or null when any source fails.
     */
    private readRuleSources = async (
        sources: ActiveRuleSources,
    ): Promise<RuleSourceSnapshot | null> => {
        const [javascript, css] = await Promise.all([
            this.readSource(sources.javascriptPath),
            this.readSource(sources.cssPath),
        ]);
        if (javascript.failed || css.failed) {
            return null;
        }
        return {
            ...sources,
            javascriptCode: javascript.code,
            cssCode: css.code,
        };
    };

    /**
     * Reads one optional source path.
     *
     * @param sourcePath Source URL, or undefined for an inactive file.
     *
     * @returns Source content and whether reading failed.
     */
    private readSource = async (
        sourcePath: string | undefined,
    ): Promise<{ code?: string; failed: boolean }> => {
        if (!sourcePath) {
            return { failed: false };
        }
        const result = await sourceReader.read(sourcePath);
        if (result.ok) {
            return { code: result.content, failed: false };
        }
        if (urlUtils.isFileUrl(sourcePath)
            && isNativeHostWideFailure(result.errorCode)) {
            localSourceAccess.markReadFailed();
        }
        return { failed: true };
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

        this.injections
            .filter((injection) => injection.site === hostname)
            .forEach((injection) => this.sourceCache.invalidate(injection.id));
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
        this.injections
            .filter((injection) => injection.site === hostname)
            .forEach((injection) => this.sourceCache.invalidate(injection.id));
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
     *
     * @param url Page URL whose hostname should be checked.
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
        this.sourceCache.clear();
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
