/**
 * @file Current site hostname, status line, and per-site switch.
 */

import React, { useContext } from 'react';
import { observer } from 'mobx-react';
import classNames from 'classnames';
import { Switch } from '@mantine/core';

import { rootStore } from '../../stores/RootStore';
import { getCurrentBrowserTarget } from '../../../common/browser-target';
import { StatusTone } from '../../../common/status-tone';
import { translator } from '../../../common/translator';
import { getSiteStatus } from './site-status';

/**
 * Renders the current-site block.
 *
 * @returns Site block element.
 */
export const SiteBlock = observer((): React.JSX.Element => {
    const { settingsStore } = useContext(rootStore);
    const browserTarget = getCurrentBrowserTarget();

    const status = getSiteStatus({
        appEnabled: settingsStore.appEnabled,
        localSourceAccess: settingsStore.localSourceAccess,
        browserTarget,
        matchingCount: settingsStore.matchingInjections.length,
        activeCount: settingsStore.activeInjectionCount,
        siteIsBlacklisted: settingsStore.siteIsBlacklisted,
    });

    const siteEnabled = !settingsStore.siteIsBlacklisted;
    const switchTitle = siteEnabled
        ? translator.getMessage('popup_disable_site')
        : translator.getMessage('popup_enable_site');

    /**
     * Toggles injections for the current site.
     */
    const handleSiteToggle = async (): Promise<void> => {
        if (siteEnabled) {
            await settingsStore.disableInjectionsForSite();
        } else {
            await settingsStore.enableInjectionsForSite();
        }
    };

    return (
        <div className="site-block" data-testid="popup-site-block">
            <div className="site-info">
                <div className="site-host">{settingsStore.currentTabHostname}</div>
                <div className={classNames('site-status', {
                    off: status.tone === StatusTone.Off,
                    warn: status.tone === StatusTone.Warn,
                })}
                >
                    <span className="site-status-dot" />
                    <span>{status.text}</span>
                </div>
            </div>
            {settingsStore.matchingInjections.length > 0 && (
                <Switch
                    checked={siteEnabled}
                    disabled={!settingsStore.appEnabled}
                    onChange={handleSiteToggle}
                    title={switchTitle}
                    aria-label={switchTitle}
                    size="sm"
                    data-testid="popup-site-toggle"
                />
            )}
        </div>
    );
});
