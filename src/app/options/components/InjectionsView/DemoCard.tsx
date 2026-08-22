/**
 * @file Safari built-in demo card shown on the Rules tab while no rules exist.
 */

import React, { useContext } from 'react';
import { observer } from 'mobx-react';
import { Button } from '@mantine/core';

import { rootStore } from '../../stores/RootStore';
import { DemoUiStatus } from '../../stores/DemoStore';
import {
    DEMO_RUN_TEST_ID,
    DEMO_TARGET_HOSTNAME,
    DEMO_TARGET_URL,
    DemoFailureReason,
} from '../../../common/demo-contracts';
import { FILE_KIND_LABELS, FILE_KINDS } from '../../../common/injection-files';
import { translator } from '../../../common/translator';

/**
 * Values of the status line's `data-status` attribute.
 */
enum DemoStatusKind {
    Waiting = 'waiting',
    Applied = 'applied',
    Failed = 'failed',
    Paused = 'paused',
}

/**
 * Renders the demo card: target, source types, Run Demo, and honest status.
 *
 * @returns Demo card element.
 */
export const DemoCard = observer((): React.JSX.Element => {
    const { injectionsStore, demoStore } = useContext(rootStore);
    const { appEnabled } = injectionsStore;
    const siteParams = { site: DEMO_TARGET_HOSTNAME };

    const failureMessages: Record<DemoFailureReason, string> = {
        [DemoFailureReason.Unavailable]: translator.getMessage('demo_error_unavailable'),
        [DemoFailureReason.Paused]: translator.getMessage('demo_paused'),
        [DemoFailureReason.OpenFailed]: translator.getMessage('demo_error_open_failed', siteParams),
        [DemoFailureReason.SourcesUnavailable]: translator.getMessage('demo_error_sources'),
        [DemoFailureReason.WebsiteAccessRequired]: translator.getMessage('demo_error_website_access', siteParams),
        [DemoFailureReason.NotConfirmed]: translator.getMessage('demo_error_not_confirmed', siteParams),
        [DemoFailureReason.Interrupted]: translator.getMessage('demo_error_interrupted'),
        [DemoFailureReason.SiteDisabled]: translator.getMessage('demo_error_site_disabled', siteParams),
    };

    let statusText: string | null = null;
    let statusKind: DemoStatusKind | null = null;
    if (!appEnabled) {
        statusText = translator.getMessage('demo_paused');
        statusKind = DemoStatusKind.Paused;
    } else if (demoStore.status === DemoUiStatus.Running) {
        statusText = translator.getMessage('demo_status_waiting', siteParams);
        statusKind = DemoStatusKind.Waiting;
    } else if (demoStore.status === DemoUiStatus.Applied) {
        statusText = translator.getMessage('demo_status_applied', siteParams);
        statusKind = DemoStatusKind.Applied;
    } else if (demoStore.status === DemoUiStatus.Failed && demoStore.failure) {
        statusText = failureMessages[demoStore.failure];
        statusKind = DemoStatusKind.Failed;
    }

    return (
        <section
            className="demo-card"
            data-testid="demo-card"
            aria-labelledby="demo-card-title"
        >
            <div className="demo-card-head">
                <span className="tag tag-demo">{translator.getMessage('demo_badge')}</span>
                <h2 id="demo-card-title">{translator.getMessage('demo_title')}</h2>
            </div>
            <p className="demo-card-desc">
                {translator.getMessage('demo_description', siteParams)}
            </p>
            <div className="demo-card-target">
                <span className="host">{DEMO_TARGET_URL}</span>
                {FILE_KINDS.map((kind) => (
                    <span key={kind} className="chip chip-static">
                        <b>{FILE_KIND_LABELS[kind]}</b>
                    </span>
                ))}
            </div>
            <div className="demo-card-actions">
                <Button
                    variant="filled"
                    onClick={() => demoStore.run()}
                    loading={demoStore.status === DemoUiStatus.Running}
                    disabled={!appEnabled}
                    data-testid={DEMO_RUN_TEST_ID}
                >
                    {translator.getMessage('demo_run')}
                </Button>
                {!appEnabled && (
                    <Button
                        variant="default"
                        onClick={() => injectionsStore.toggleAppEnabled()}
                        data-testid="demo-resume-btn"
                    >
                        {translator.getMessage('pause_resume')}
                    </Button>
                )}
            </div>
            {statusText && (
                <p
                    className="demo-card-status"
                    role="status"
                    data-status={statusKind ?? undefined}
                    data-testid="demo-status"
                >
                    {statusText}
                </p>
            )}
        </section>
    );
});
