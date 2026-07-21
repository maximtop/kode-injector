/**
 * @file Amber strip shown while injecting is paused everywhere.
 */

import React, { useContext } from 'react';
import { observer } from 'mobx-react';

import { rootStore } from '../../stores/RootStore';
import { translator } from '../../../common/translator';

/**
 * Renders the global-pause strip, or nothing while enabled.
 *
 * @returns Strip element or null.
 */
export const PausedStrip = observer((): React.JSX.Element | null => {
    const { settingsStore } = useContext(rootStore);

    if (settingsStore.appEnabled) {
        return null;
    }

    return (
        <div className="paused-strip" role="status" data-testid="popup-paused-strip">
            <strong>{translator.getMessage('popup_paused_strip')}</strong>
            <button type="button" onClick={() => settingsStore.enableApp()}>
                {translator.getMessage('pause_resume')}
            </button>
        </div>
    );
});
