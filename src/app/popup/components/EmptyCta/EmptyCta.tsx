/**
 * @file Call to action shown when no rules match the current site.
 */

import React, { useContext } from 'react';
import { observer } from 'mobx-react';
import { Button } from '@mantine/core';

import { rootStore } from '../../stores/RootStore';
import { translator } from '../../../common/translator';

/**
 * Renders the add-rule call to action, or nothing when rules exist.
 *
 * @returns CTA element or null.
 */
export const EmptyCta = observer((): React.JSX.Element | null => {
    const { settingsStore } = useContext(rootStore);

    if (settingsStore.matchingInjections.length > 0) {
        return null;
    }

    return (
        <div className="cta-block" data-testid="popup-empty-cta">
            <Button
                variant="filled"
                onClick={() => settingsStore.openOptionsForCurrentSite()}
                data-testid="popup-add-rule"
            >
                {translator.getMessage('popup_add_rule')}
            </Button>
        </div>
    );
});
