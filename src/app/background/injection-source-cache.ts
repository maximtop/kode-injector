/**
 * @file Memory-only stale-while-revalidate cache for Safari rule sources.
 */

const DEFAULT_MAXIMUM_ENTRIES = 64;
const DEFAULT_MAXIMUM_BYTES = 10 * 1024 * 1024;

/**
 * Active local-source paths belonging to one enabled rule.
 */
export interface ActiveRuleSources {
    /**
     * Stable rule identifier used as the cache key.
     */
    ruleId: string;

    /**
     * Active local JavaScript URL, when configured.
     */
    javascriptPath?: string;

    /**
     * Active local CSS URL, when configured.
     */
    cssPath?: string;
}

/**
 * Atomic source contents captured for one rule descriptor.
 */
export interface RuleSourceSnapshot extends ActiveRuleSources {
    /**
     * Decoded JavaScript contents matching `javascriptPath`.
     */
    javascriptCode?: string;

    /**
     * Decoded CSS contents matching `cssPath`.
     */
    cssCode?: string;
}

/**
 * Cache resolution returned to the injection coordinator.
 */
export interface RuleSourceResolution {
    /**
     * Complete source snapshot selected for the current document.
     */
    snapshot: RuleSourceSnapshot;

    /**
     * Whether the current document received an existing cached snapshot.
     */
    cacheHit: boolean;
}

/**
 * Loads one complete rule snapshot from its local sources.
 *
 * @param sources Active source descriptor to load atomically.
 *
 * @returns Complete snapshot, or null when any active source fails.
 */
type SourceLoader = (sources: ActiveRuleSources) => Promise<RuleSourceSnapshot | null>;

/**
 * Receives failures from background refreshes that cannot be awaited by a document.
 *
 * @param error Refresh failure to report without exposing it to the page.
 */
type RefreshErrorHandler = (error: unknown) => void;

/**
 * LRU entry with its precomputed UTF-8 memory cost.
 */
interface CacheEntry {
    /**
     * Cached source contents and matching descriptor.
     */
    snapshot: RuleSourceSnapshot;

    /**
     * Combined UTF-8 byte length of JavaScript and CSS.
     */
    byteLength: number;
}

/**
 * Checks whether cached content belongs to the currently active paths.
 *
 * @param snapshot Cached descriptor to compare.
 * @param sources Current active descriptor.
 *
 * @returns Whether both descriptors identify the same rule sources.
 */
const descriptorMatches = (
    snapshot: ActiveRuleSources,
    sources: ActiveRuleSources,
): boolean => (
    snapshot.ruleId === sources.ruleId
    && snapshot.javascriptPath === sources.javascriptPath
    && snapshot.cssPath === sources.cssPath
);

/**
 * Creates a unique in-flight refresh key for one descriptor generation.
 *
 * @param sources Active source descriptor.
 * @param version Rule invalidation generation.
 *
 * @returns Stable refresh key.
 */
const descriptorKey = (sources: ActiveRuleSources, version: number): string => JSON.stringify([
    sources.ruleId,
    version,
    sources.javascriptPath ?? null,
    sources.cssPath ?? null,
]);

/**
 * Calculates the source memory retained by one snapshot.
 *
 * @param snapshot Source snapshot to measure.
 *
 * @returns Combined UTF-8 byte length.
 */
const snapshotByteLength = (snapshot: RuleSourceSnapshot): number => {
    const encoder = new TextEncoder();
    return encoder.encode(snapshot.javascriptCode ?? '').byteLength
        + encoder.encode(snapshot.cssCode ?? '').byteLength;
};

/**
 * Bounded stale-while-revalidate cache for complete per-rule source snapshots.
 * Refresh completion never mutates an already resolved document.
 */
export class InjectionSourceCache {
    /**
     * LRU entries keyed by rule identifier.
     */
    private readonly entries = new Map<string, CacheEntry>();

    /**
     * Deduplicated refreshes keyed by descriptor generation.
     */
    private readonly inFlight = new Map<string, Promise<RuleSourceSnapshot | null>>();

    /**
     * Invalidation generation for each rule.
     */
    private readonly versions = new Map<string, number>();

    /**
     * Most recent descriptor requested for each rule.
     */
    private readonly activeDescriptors = new Map<string, ActiveRuleSources>();

    /**
     * Loader used for fresh local-source reads.
     */
    private readonly load: SourceLoader;

    /**
     * Reporter for asynchronous refresh failures.
     */
    private readonly onRefreshError: RefreshErrorHandler;

    /**
     * Maximum number of retained rule snapshots.
     */
    private readonly maximumEntries: number;

    /**
     * Maximum combined source bytes retained in memory.
     */
    private readonly maximumBytes: number;

    /**
     * Current combined byte length of retained entries.
     */
    private totalBytes = 0;

    /**
     * Global generation incremented whenever the whole cache is cleared.
     */
    private epoch = 0;

    /**
     * Creates a bounded stale-while-revalidate source cache.
     *
     * @param load Loader for fresh atomic rule snapshots.
     * @param onRefreshError Reporter for detached refresh failures.
     * @param maximumEntries Maximum number of retained rules.
     * @param maximumBytes Maximum combined UTF-8 source bytes.
     */
    public constructor(
        load: SourceLoader,
        onRefreshError: RefreshErrorHandler,
        maximumEntries = DEFAULT_MAXIMUM_ENTRIES,
        maximumBytes = DEFAULT_MAXIMUM_BYTES,
    ) {
        this.load = load;
        this.onRefreshError = onRefreshError;
        this.maximumEntries = maximumEntries;
        this.maximumBytes = maximumBytes;
    }

    /**
     * Resolves sources for the current document and refreshes a cache hit in the background.
     *
     * @param sources Active source descriptor.
     *
     * @returns Selected snapshot and cache status, or null after a cold read failure.
     */
    public resolve = async (sources: ActiveRuleSources): Promise<RuleSourceResolution | null> => {
        const version = this.versions.get(sources.ruleId) ?? 0;
        this.activeDescriptors.set(sources.ruleId, sources);
        const cached = this.get(sources);
        if (cached) {
            this.refresh(sources, version);
            return {
                snapshot: cached,
                cacheHit: true,
            };
        }

        const snapshot = await this.refresh(sources, version);
        if (!snapshot) {
            return null;
        }
        return {
            snapshot,
            cacheHit: false,
        };
    };

    /**
     * Invalidates all cached and in-flight results for one rule.
     *
     * @param ruleId Rule identifier to invalidate.
     */
    public invalidate = (ruleId: string): void => {
        this.remove(ruleId);
        this.activeDescriptors.delete(ruleId);
        this.versions.set(ruleId, (this.versions.get(ruleId) ?? 0) + 1);
    };

    /**
     * Drops every retained snapshot and invalidates all outstanding refreshes.
     */
    public clear = (): void => {
        this.entries.clear();
        this.inFlight.clear();
        this.activeDescriptors.clear();
        this.versions.clear();
        this.totalBytes = 0;
        this.epoch += 1;
    };

    /**
     * Returns and touches a matching LRU entry.
     *
     * @param sources Active descriptor to match.
     *
     * @returns Cached snapshot, or null when absent or obsolete.
     */
    private get(sources: ActiveRuleSources): RuleSourceSnapshot | null {
        const entry = this.entries.get(sources.ruleId);
        if (!entry || !descriptorMatches(entry.snapshot, sources)) {
            if (entry) {
                this.remove(sources.ruleId);
            }
            return null;
        }
        this.entries.delete(sources.ruleId);
        this.entries.set(sources.ruleId, entry);
        return entry.snapshot;
    }

    /**
     * Starts or joins a refresh for one descriptor generation.
     *
     * @param sources Active source descriptor.
     * @param version Rule invalidation generation.
     *
     * @returns Fresh snapshot, or null when loading fails or becomes obsolete.
     */
    private refresh(
        sources: ActiveRuleSources,
        version: number,
    ): Promise<RuleSourceSnapshot | null> {
        const key = descriptorKey(sources, version);
        const existing = this.inFlight.get(key);
        if (existing) {
            return existing;
        }

        const { epoch } = this;
        const refresh = this.load(sources)
            .then((snapshot) => {
                if (!this.isCurrent(sources, version, epoch)) {
                    return null;
                }
                if (!snapshot || !descriptorMatches(snapshot, sources)) {
                    this.remove(sources.ruleId);
                    return null;
                }
                this.store(snapshot);
                return snapshot;
            })
            .catch((error: unknown) => {
                if (this.isCurrent(sources, version, epoch)) {
                    this.remove(sources.ruleId);
                }
                this.onRefreshError(error);
                return null;
            })
            .finally(() => {
                if (this.inFlight.get(key) === refresh) {
                    this.inFlight.delete(key);
                }
            });
        this.inFlight.set(key, refresh);
        return refresh;
    }

    /**
     * Checks whether a completed refresh still belongs to active cache state.
     *
     * @param sources Descriptor captured by the refresh.
     * @param version Rule generation captured by the refresh.
     * @param epoch Global generation captured by the refresh.
     *
     * @returns Whether the refresh may publish its result.
     */
    private isCurrent(
        sources: ActiveRuleSources,
        version: number,
        epoch: number,
    ): boolean {
        const active = this.activeDescriptors.get(sources.ruleId);
        return this.epoch === epoch
            && (this.versions.get(sources.ruleId) ?? 0) === version
            && Boolean(active && descriptorMatches(active, sources));
    }

    /**
     * Stores one snapshot and evicts oldest entries until both limits hold.
     *
     * @param snapshot Snapshot to retain.
     */
    private store(snapshot: RuleSourceSnapshot): void {
        const byteLength = snapshotByteLength(snapshot);
        this.remove(snapshot.ruleId);
        if (byteLength > this.maximumBytes) {
            return;
        }
        this.entries.set(snapshot.ruleId, { snapshot, byteLength });
        this.totalBytes += byteLength;
        while (this.entries.size > this.maximumEntries || this.totalBytes > this.maximumBytes) {
            const oldestRuleId = this.entries.keys().next().value as string | undefined;
            if (!oldestRuleId) {
                break;
            }
            this.remove(oldestRuleId);
        }
    }

    /**
     * Removes one LRU entry and updates the byte counter.
     *
     * @param ruleId Rule identifier to remove.
     */
    private remove(ruleId: string): void {
        const entry = this.entries.get(ruleId);
        if (!entry) {
            return;
        }
        this.entries.delete(ruleId);
        this.totalBytes -= entry.byteLength;
    }
}
