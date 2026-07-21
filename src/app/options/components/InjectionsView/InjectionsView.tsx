/**
 * @file Injections tab: toolbar, notices, rule list, and empty state.
 */

import React, { useContext, useState } from 'react';
import { observer } from 'mobx-react';
import { Button, TextInput } from '@mantine/core';

import { rootStore } from '../../stores/RootStore';
import type { InjectionRule, LocalSourceAccessState } from '../../../common/contracts';
import { LocalSourceAccessMethod } from '../../../common/contracts';
import { NativeHostStatus } from '../../../common/native-host-protocol';
import { translator } from '../../../common/translator';
import { messenger } from '../../../common/messenger';
import { log } from '../../../common/log';
import { IconPause, IconPlus, IconSearch } from '../../../common/components/icons';
import { RuleRow } from './RuleRow';
import { EmptyState } from './EmptyState';

import './injections-view.pcss';

/**
 * InjectionsView props.
 */
interface InjectionsViewProps {
    /**
     * Opens the rule editor for a new rule.
     */
    onCreate: () => void;

    /**
     * Opens the rule editor for an existing rule.
     */
    onEdit: (rule: InjectionRule) => void;

    /**
     * Opens the Settings tab.
     */
    onOpenSettingsTab: () => void;
}

/**
 * Checks whether local-source access needs the user's attention.
 *
 * @param state Current local-source access state.
 *
 * @returns Whether a warning line should be shown.
 */
const needsAccessAttention = (state: LocalSourceAccessState): boolean => {
    if (state.kind === LocalSourceAccessMethod.Browser) {
        return !state.allowed;
    }

    if (!state.permissionGranted) {
        return true;
    }

    return state.host.status !== NativeHostStatus.Ready
        && state.host.status !== NativeHostStatus.Checking;
};

/**
 * Renders the Injections tab.
 *
 * @param props InjectionsView props.
 *
 * @returns Injections tab element.
 */
export const InjectionsView = observer(({
    onCreate,
    onEdit,
    onOpenSettingsTab,
}: InjectionsViewProps): React.JSX.Element => {
    const { injectionsStore } = useContext(rootStore);
    const [filter, setFilter] = useState('');
    const [pendingDeleteId, setPendingDeleteId] = useState<string | null>(null);

    const { injections, appEnabled } = injectionsStore;
    const query = filter.trim().toLowerCase();
    const visibleInjections = query
        ? injections.filter((rule) => rule.site.toLowerCase().includes(query))
        : injections;
    const offCount = injections.filter((rule) => !rule.enabled).length;

    /**
     * Opens a rule source file in a browser tab.
     *
     * @param path File path to open.
     */
    const openFile = (path: string): void => {
        messenger.openTab(path).catch((error) => log.error(error));
    };

    /**
     * Builds the list summary line.
     *
     * @returns Localized list meta text.
     */
    const getListMeta = (): string => {
        if (query) {
            return translator.getMessage('rules_filter_match', {
                visible: String(visibleInjections.length),
                total: String(injections.length),
                query: filter.trim(),
            });
        }

        const countText = translator.getPlural('rules_count', injections.length);
        if (offCount) {
            return `${countText} · ${translator.getPlural('rules_off_count', offCount)}`;
        }

        return countText;
    };

    if (injections.length === 0) {
        return (
            <section>
                <EmptyState onCreate={onCreate} />
            </section>
        );
    }

    return (
        <section>
            <div className="toolbar">
                <div className="toolbar-search">
                    <TextInput
                        value={filter}
                        onChange={(event) => setFilter(event.currentTarget.value)}
                        placeholder={translator.getMessage('injections_filter_placeholder')}
                        aria-label={translator.getMessage('injections_filter_placeholder')}
                        leftSection={<IconSearch size={15} />}
                        type="search"
                    />
                </div>
                <Button
                    variant="default"
                    leftSection={<IconPause size={14} />}
                    onClick={() => injectionsStore.toggleAppEnabled()}
                    aria-pressed={!appEnabled}
                    title={appEnabled
                        ? translator.getMessage('popup_pause_all')
                        : translator.getMessage('popup_enable_all')}
                    data-testid="pause-all-btn"
                >
                    {appEnabled
                        ? translator.getMessage('injections_pause_all')
                        : translator.getMessage('pause_resume')}
                </Button>
                <Button
                    variant="filled"
                    leftSection={<IconPlus size={14} />}
                    onClick={onCreate}
                    data-testid="new-injection-btn"
                >
                    {translator.getMessage('injections_new')}
                </Button>
            </div>

            {needsAccessAttention(injectionsStore.localSourceAccess) && (
                <div className="access-line">
                    <span className="access-line-dot" />
                    <span>{translator.getMessage('access_line_attention')}</span>
                    <button
                        type="button"
                        className="link-btn"
                        onClick={onOpenSettingsTab}
                    >
                        {translator.getMessage('access_review_settings')}
                    </button>
                </div>
            )}

            <p className="list-meta" role="status">{getListMeta()}</p>
            {visibleInjections.length === 0 ? (
                <div className="filter-empty" data-testid="filter-empty">
                    <span>
                        {translator.getMessage('rules_filter_empty', { query: filter.trim() })}
                    </span>
                    <Button variant="default" size="xs" onClick={() => setFilter('')}>
                        {translator.getMessage('rules_filter_clear')}
                    </Button>
                </div>
            ) : (
                <div className="rules" data-testid="rules-list">
                    {visibleInjections.map((rule) => (
                        <RuleRow
                            key={rule.id}
                            rule={rule}
                            fileIssues={injectionsStore.fileIssues[rule.id] ?? []}
                            confirmingDelete={pendingDeleteId === rule.id}
                            onToggle={(id) => injectionsStore.toggleInjection(id)}
                            onFileToggle={(id, field, enabled) => {
                                injectionsStore.setInjectionFileEnabled(id, field, enabled);
                            }}
                            onEdit={onEdit}
                            onDuplicate={(id) => injectionsStore.duplicateInjection(id)}
                            onRequestDelete={setPendingDeleteId}
                            onCancelDelete={() => setPendingDeleteId(null)}
                            onConfirmDelete={(id) => {
                                setPendingDeleteId(null);
                                injectionsStore.removeInjection(id);
                            }}
                            onOpenFile={openFile}
                        />
                    ))}
                </div>
            )}
        </section>
    );
});
