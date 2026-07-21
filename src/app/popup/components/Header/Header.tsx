/**
 * @file
 */

import React, { useContext } from 'react';
import { observer } from 'mobx-react';
import { Button } from '@mantine/core';

import { translator } from '../../../common/translator';
import { IconPause } from '../../../common/components/icons';
import { rootStore } from '../../stores/RootStore';

export const Header = observer(() => {
    const { settingsStore } = useContext(rootStore);
    const paused = !settingsStore.appEnabled;
    const title = paused
        ? translator.getMessage('popup_enable_all')
        : translator.getMessage('popup_pause_all');

    /**
     * Toggles the global pause state.
     */
    const handlePauseClick = async (): Promise<void> => {
        if (paused) {
            await settingsStore.enableApp();
        } else {
            await settingsStore.disableApp();
        }
    };

    return (
        <header className="p-head">
            <img src="assets/img/icon-48.png" alt="" />
            <h1 className="p-head-name">Kode Injector</h1>
            <Button
                variant="subtle"
                size="compact-sm"
                className="p-head-pause"
                leftSection={<IconPause size={13} />}
                aria-pressed={paused}
                title={title}
                onClick={handlePauseClick}
                data-testid="popup-pause"
            >
                {paused
                    ? translator.getMessage('pause_resume')
                    : translator.getMessage('injections_pause_all')}
            </Button>
        </header>
    );
});
