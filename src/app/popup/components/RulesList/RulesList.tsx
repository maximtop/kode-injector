/**
 * @file Files of rules matching the current site, each with its own toggle.
 */

import React, { useContext } from 'react';
import { observer } from 'mobx-react';
import classNames from 'classnames';
import { Switch } from '@mantine/core';

import { rootStore } from '../../stores/RootStore';
import { FILE_KIND_LABELS } from '../../../common/injection-files';
import { messenger } from '../../../common/messenger';
import { translator } from '../../../common/translator';
import { getFileName } from '../../../common/text-utils';
import { log } from '../../../common/log';
import { getRuleFileEntries } from './rule-file-entries';

/**
 * Renders the matched-files list, or nothing when no rules match.
 *
 * @returns Files list element or null.
 */
export const RulesList = observer((): React.JSX.Element | null => {
    const { settingsStore } = useContext(rootStore);
    const entries = getRuleFileEntries(settingsStore.matchingInjections);

    if (entries.length === 0) {
        return null;
    }

    /**
     * Opens a rule source file in a browser tab.
     *
     * @param path File path to open.
     */
    const openFile = (path: string): void => {
        messenger.openTab(path).catch((error) => log.error(error));
    };

    return (
        <div className="rules" data-testid="popup-rules-list">
            <p className="rules-cap">{translator.getMessage('popup_rules_caption')}</p>
            <div>
                {entries.map((entry) => {
                    const label = `${FILE_KIND_LABELS[entry.field]} ${getFileName(entry.path)}`;
                    const dimmed = !entry.checked
                        || !settingsStore.appEnabled
                        || settingsStore.siteIsBlacklisted;
                    const switchDisabled = !settingsStore.appEnabled || entry.ruleDisabled;
                    const switchTitle = entry.ruleDisabled
                        ? translator.getMessage('popup_file_rule_off')
                        : translator.getMessage('popup_file_toggle_for', { name: label });
                    const chipTitle = `${entry.path} — ${translator.getMessage('rule_open_file')}`;

                    return (
                        <div
                            key={`${entry.ruleId}:${entry.field}`}
                            className={classNames('rule', { off: dimmed })}
                        >
                            <button
                                type="button"
                                className="chip"
                                title={chipTitle}
                                aria-label={chipTitle}
                                onClick={() => openFile(entry.path)}
                            >
                                <b>{FILE_KIND_LABELS[entry.field]}</b>
                                <span className="chip-path">{getFileName(entry.path)}</span>
                            </button>
                            <Switch
                                checked={entry.checked}
                                disabled={switchDisabled}
                                onChange={() => {
                                    settingsStore.toggleInjectionFile(entry.ruleId, entry.field);
                                }}
                                title={switchTitle}
                                aria-label={switchTitle}
                                size="sm"
                            />
                        </div>
                    );
                })}
            </div>
        </div>
    );
});
