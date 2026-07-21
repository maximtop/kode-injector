/**
 * @file Options page header with brand, status pill, and quick actions.
 */

import React from 'react';
import classNames from 'classnames';
import {
    ActionIcon,
    useMantineColorScheme,
    type MantineColorScheme,
} from '@mantine/core';

import { COLOR_SCHEMES } from '../../../common/color-scheme';
import { PROJECT_REPOSITORY_URL } from '../../../common/constants';
import type { LocalSourceAccessState } from '../../../common/contracts';
import { StatusTone } from '../../../common/status-tone';
import { translator } from '../../../common/translator';
import {
    IconContrast,
    IconGitHub,
    IconMoon,
    IconSun,
} from '../../../common/components/icons';
import { getAccessPillState } from './access-pill-state';

/**
 * Topbar props.
 */
interface TopbarProps {
    /**
     * Current local-source access state.
     */
    localSourceAccess: LocalSourceAccessState;

    /**
     * Opens the Settings tab.
     */
    onOpenSettingsTab: () => void;
}

/**
 * Cycle order of the header theme toggle.
 */
const SCHEME_CYCLE: MantineColorScheme[] = [
    COLOR_SCHEMES.AUTO,
    COLOR_SCHEMES.LIGHT,
    COLOR_SCHEMES.DARK,
];

/**
 * Translator keys of the scheme labels.
 */
const SCHEME_LABEL_KEYS: Record<string, string> = {
    auto: 'theme_system',
    light: 'theme_light',
    dark: 'theme_dark',
};

/**
 * Renders the options page header.
 *
 * @param props Topbar props.
 *
 * @returns Header element.
 */
export const Topbar = ({
    localSourceAccess,
    onOpenSettingsTab,
}: TopbarProps): React.JSX.Element => {
    const { colorScheme, setColorScheme } = useMantineColorScheme();
    const pill = getAccessPillState(localSourceAccess);

    /**
     * Advances the theme through system, light, and dark.
     */
    const cycleColorScheme = (): void => {
        const index = SCHEME_CYCLE.indexOf(colorScheme);
        const next = SCHEME_CYCLE[(index + 1) % SCHEME_CYCLE.length];
        setColorScheme(next);
    };

    const schemeLabel = translator.getMessage(SCHEME_LABEL_KEYS[colorScheme] ?? 'theme_system');
    const themeTitle = `${translator.getMessage('theme_toggle_title')} — ${schemeLabel}`;
    const themeIcons: Record<string, React.JSX.Element> = {
        auto: <IconContrast size={17} />,
        light: <IconSun size={17} />,
        dark: <IconMoon size={17} />,
    };

    return (
        <header className="topbar">
            <div className="topbar-inner">
                <h1 className="brand">
                    <img src="assets/img/icon-48.png" alt="" />
                    Kode Injector
                </h1>
                <span className="topbar-spacer" />
                <button
                    type="button"
                    className={classNames('status-pill', {
                        warn: pill.tone === StatusTone.Warn,
                        pending: pill.tone === StatusTone.Pending,
                    })}
                    onClick={onOpenSettingsTab}
                    title={translator.getMessage('access_pill_title')}
                    aria-label={`${pill.label}. ${translator.getMessage('access_pill_title')}`}
                    data-testid="access-status-pill"
                >
                    <span className="status-dot" />
                    <span className="status-pill-text">{pill.label}</span>
                </button>
                <ActionIcon
                    variant="subtle"
                    size={34}
                    onClick={cycleColorScheme}
                    title={themeTitle}
                    aria-label={themeTitle}
                >
                    {themeIcons[colorScheme] ?? themeIcons.auto}
                </ActionIcon>
                <ActionIcon
                    component="a"
                    variant="subtle"
                    size={34}
                    href={PROJECT_REPOSITORY_URL}
                    target="_blank"
                    rel="noreferrer"
                    title={translator.getMessage('source_code_title')}
                    aria-label={translator.getMessage('source_code')}
                >
                    <IconGitHub size={17} />
                </ActionIcon>
            </div>
        </header>
    );
};
