/**
 * @file Compact file-access notice with a single recovery action.
 */

import React, { useContext } from 'react';
import { observer } from 'mobx-react';
import { Button } from '@mantine/core';

import { rootStore } from '../../stores/RootStore';
import { getCurrentBrowserTarget } from '../../../common/browser-target';
import { OPTIONS_TABS } from '../../../common/constants';
import { messenger } from '../../../common/messenger';
import { tabs } from '../../../common/tabs';
import { log } from '../../../common/log';
import { getAccessBlockState } from './access-block-state';

/**
 * Renders the compact access notice, or nothing when access is healthy.
 *
 * @returns Notice element or null.
 */
export const AccessBlock = observer((): React.JSX.Element | null => {
    const { settingsStore } = useContext(rootStore);
    const browserTarget = getCurrentBrowserTarget();
    const blockState = getAccessBlockState(settingsStore.localSourceAccess, browserTarget);

    if (!blockState) {
        return null;
    }

    /**
     * Runs the notice's recovery action.
     */
    const handleAction = (): void => {
        if (blockState.action === 'useBrowserAccess') {
            settingsStore.useBrowserFileAccess();
            return;
        }

        messenger.openTab(tabs.getOptionsUrlForTab(OPTIONS_TABS.SETTINGS))
            .catch((error) => log.error(error));
    };

    return (
        <div className="broken" data-testid="popup-access-notice">
            <span className="broken-line">
                <span className="broken-dot" />
                <span>{blockState.message}</span>
            </span>
            <Button
                variant="default"
                size="xs"
                disabled={settingsStore.localSourceAccessMethodPending}
                onClick={handleAction}
            >
                {blockState.actionLabel}
            </Button>
        </div>
    );
});
