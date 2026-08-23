/**
 * @file Options-page state of the Safari built-in demo.
 */

import { makeObservable, observable, runInAction } from 'mobx';

import {
    DEMO_WAIT_TIMEOUT_MS,
    DemoFailureReason,
    DemoLaunchStatus,
    type DemoLaunchState,
    type RunDemoResult,
} from '../../common/demo-contracts';
import { log } from '../../common/log';

/**
 * Presentation status of the demo card.
 */
export enum DemoUiStatus {
    Idle = 'idle',
    Running = 'running',
    Applied = 'applied',
    Failed = 'failed',
}

/**
 * Interval between background state polls.
 */
export const DEMO_POLL_INTERVAL_MS = 500;

/**
 * Upper bound of UI polling; slightly above the background's bounded wait so
 * the background's own diagnosis (website access, tab closed) wins.
 */
export const DEMO_UI_WAIT_LIMIT_MS = DEMO_WAIT_TIMEOUT_MS + 5_000;

/**
 * Collaborators of the demo store, injected for testability.
 */
export interface DemoStoreDependencies {
    /**
     * Starts the demo or focuses its tab.
     */
    runDemo(): Promise<RunDemoResult>;

    /**
     * Reads the background launch state.
     */
    getDemoLaunchState(): Promise<DemoLaunchState>;

    /**
     * Schedules a callback and returns a cancel function.
     *
     * @param callback Work to run after the delay.
     * @param delayMs Delay in milliseconds.
     */
    schedule(callback: () => void | Promise<void>, delayMs: number): ScheduleCancel;
}

/**
 * Cancels a scheduled callback.
 */
type ScheduleCancel = () => void;

/**
 * Schedules through the window timer.
 *
 * @param callback Work to run after the delay.
 * @param delayMs Delay in milliseconds.
 *
 * @returns Cancel function.
 */
export const windowSchedule = (
    callback: () => void | Promise<void>,
    delayMs: number,
): ScheduleCancel => {
    const id = window.setTimeout(callback, delayMs);
    return () => window.clearTimeout(id);
};

/**
 * Runs the demo and mirrors the background launch state for the card.
 */
export class DemoStore {
    /**
     * Presentation status.
     */
    @observable
    status = DemoUiStatus.Idle;

    /**
     * Failure reason while the status is failed.
     */
    @observable
    failure: DemoFailureReason | null = null;

    /**
     * Cancels the scheduled poll, when one is pending.
     */
    private cancelPoll: (() => void) | null = null;

    /**
     * Generation counter that discards stale asynchronous results.
     */
    private generation = 0;

    /**
     * Collaborators.
     */
    private readonly deps: DemoStoreDependencies;

    /**
     * Creates the store.
     *
     * @param deps Collaborators (runtime messenger and window timers in production).
     */
    constructor(deps: DemoStoreDependencies) {
        makeObservable(this);
        this.deps = deps;
    }

    /**
     * Starts the demo and polls the background until it settles.
     */
    run = async (): Promise<void> => {
        if (this.status === DemoUiStatus.Running) {
            return;
        }
        this.generation += 1;
        const { generation } = this;
        this.stopPolling();
        this.setState(DemoUiStatus.Running, null);

        let result: RunDemoResult;
        try {
            result = await this.deps.runDemo();
        } catch (error) {
            log.error('Run demo request failed', error);
            result = { ok: false, reason: DemoFailureReason.Interrupted };
        }
        if (generation !== this.generation) {
            return;
        }
        if (!result.ok) {
            this.setState(DemoUiStatus.Failed, result.reason);
            return;
        }
        this.pollUntilSettled(generation, 0);
    };

    /**
     * Stops polling and returns to idle. Called when the rule collection
     * leaves the zero-rule state, so a card that reappears after the last
     * rule is deleted never shows an earlier activation (FR-016).
     */
    reset = (): void => {
        this.generation += 1;
        this.stopPolling();
        this.setState(DemoUiStatus.Idle, null);
    };

    /**
     * Polls the background state once and reschedules while waiting.
     *
     * @param generation Run generation this poll belongs to.
     * @param elapsedMs Time already spent polling.
     */
    private pollUntilSettled = (generation: number, elapsedMs: number): void => {
        this.cancelPoll = this.deps.schedule(async () => {
            this.cancelPoll = null;
            let state: DemoLaunchState;
            try {
                state = await this.deps.getDemoLaunchState();
            } catch (error) {
                log.error('Demo state request failed', error);
                state = { status: DemoLaunchStatus.None };
            }
            if (generation !== this.generation) {
                return;
            }
            switch (state.status) {
                case DemoLaunchStatus.Applied:
                    this.setState(DemoUiStatus.Applied, null);
                    return;
                case DemoLaunchStatus.Failed:
                    this.setState(
                        DemoUiStatus.Failed,
                        state.failure ?? DemoFailureReason.NotConfirmed,
                    );
                    return;
                case DemoLaunchStatus.None:
                    // The launch vanished (tab closed, background restarted).
                    this.setState(DemoUiStatus.Failed, DemoFailureReason.Interrupted);
                    return;
                default:
                    break;
            }
            const nextElapsedMs = elapsedMs + DEMO_POLL_INTERVAL_MS;
            if (nextElapsedMs >= DEMO_UI_WAIT_LIMIT_MS) {
                this.setState(DemoUiStatus.Failed, DemoFailureReason.NotConfirmed);
                return;
            }
            this.pollUntilSettled(generation, nextElapsedMs);
        }, DEMO_POLL_INTERVAL_MS);
    };

    /**
     * Cancels a pending poll.
     */
    private stopPolling = (): void => {
        if (this.cancelPoll) {
            this.cancelPoll();
            this.cancelPoll = null;
        }
    };

    /**
     * Applies observable state inside a MobX action.
     *
     * @param status New presentation status.
     * @param failure New failure reason.
     */
    private setState = (status: DemoUiStatus, failure: DemoFailureReason | null): void => {
        runInAction(() => {
            this.status = status;
            this.failure = failure;
        });
    };
}
