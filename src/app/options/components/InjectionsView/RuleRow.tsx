/**
 * @file One injection rule rendered as a row card.
 */

import React, { useEffect, useRef } from 'react';
import classNames from 'classnames';
import {
    ActionIcon,
    Button,
    Menu,
    Switch,
    Tooltip,
} from '@mantine/core';

import type { InjectionFileField, InjectionRule } from '../../../common/contracts';
import {
    FILE_ENABLED_FLAGS,
    FILE_KINDS,
    FILE_KIND_LABELS,
} from '../../../common/injection-files';
import { translator } from '../../../common/translator';
import { getDisplayPath, getFileName, truncateMiddle } from '../../../common/text-utils';
import { IconDots } from '../../../common/components/icons';

/**
 * RuleRow props.
 */
interface RuleRowProps {
    /**
     * Rule displayed by this row.
     */
    rule: InjectionRule;

    /**
     * Path fields of this rule whose files could not be read.
     */
    fileIssues: string[];

    /**
     * Whether the row shows the inline delete confirmation.
     */
    confirmingDelete: boolean;

    /**
     * Toggles the rule's enabled state.
     */
    onToggle: (id: string) => void;

    /**
     * Toggles one file of the rule.
     */
    onFileToggle: (id: string, field: InjectionFileField, enabled: boolean) => void;

    /**
     * Opens the rule editor for this rule.
     */
    onEdit: (rule: InjectionRule) => void;

    /**
     * Duplicates this rule.
     */
    onDuplicate: (id: string) => void;

    /**
     * Requests the inline delete confirmation.
     */
    onRequestDelete: (id: string) => void;

    /**
     * Cancels the inline delete confirmation.
     */
    onCancelDelete: () => void;

    /**
     * Deletes this rule permanently.
     */
    onConfirmDelete: (id: string) => void;

    /**
     * Opens a rule file in a browser tab.
     */
    onOpenFile: (path: string) => void;
}

/**
 * Renders one injection rule as a row card.
 *
 * @param props RuleRow props.
 *
 * @returns Rule row element.
 */
export const RuleRow = ({
    rule,
    fileIssues,
    confirmingDelete,
    onToggle,
    onFileToggle,
    onEdit,
    onDuplicate,
    onRequestDelete,
    onCancelDelete,
    onConfirmDelete,
    onOpenFile,
}: RuleRowProps): React.JSX.Element => {
    const cancelRef = useRef<HTMLButtonElement>(null);
    const menuRef = useRef<HTMLButtonElement>(null);

    useEffect(() => {
        if (!confirmingDelete) {
            return undefined;
        }

        cancelRef.current?.focus();

        /**
         * Cancels the confirmation on Escape.
         *
         * @param event Keyboard event.
         */
        const handleKeyDown = (event: KeyboardEvent): void => {
            if (event.key === 'Escape') {
                onCancelDelete();
            }
        };
        document.addEventListener('keydown', handleKeyDown);
        return () => document.removeEventListener('keydown', handleKeyDown);
    }, [confirmingDelete, onCancelDelete]);

    if (confirmingDelete) {
        return (
            <div
                className="rule"
                data-testid="rule-row"
                role="alertdialog"
                aria-label={translator.getMessage('rule_delete_question', { host: rule.site })}
            >
                <div className="rule-confirm">
                    {translator.getMessage('rule_delete_question', { host: rule.site })}
                    <span className="rule-confirm-spacer" />
                    <Button
                        ref={cancelRef}
                        variant="default"
                        size="xs"
                        onClick={onCancelDelete}
                    >
                        {translator.getMessage('cancel')}
                    </Button>
                    <Button
                        className="btn-danger"
                        variant="filled"
                        size="xs"
                        onClick={() => onConfirmDelete(rule.id)}
                        data-testid="rule-delete-confirm"
                    >
                        {translator.getMessage('rule_delete_confirm')}
                    </Button>
                </div>
            </div>
        );
    }

    const toggleTitle = rule.enabled
        ? translator.getMessage('injection_disable_for', { host: rule.site })
        : translator.getMessage('injection_enable_for', { host: rule.site });

    return (
        <div className={classNames('rule', { off: !rule.enabled })} data-testid="rule-row">
            <Switch
                checked={rule.enabled}
                onChange={() => onToggle(rule.id)}
                title={toggleTitle}
                aria-label={toggleTitle}
                size="md"
            />
            <div className="rule-body">
                <div className="rule-site">
                    <button
                        type="button"
                        className="host host-button"
                        onClick={() => onEdit(rule)}
                        title={translator.getMessage('rule_edit')}
                    >
                        {rule.site}
                    </button>
                    {!rule.enabled && (
                        <span className="tag">{translator.getMessage('rule_tag_off')}</span>
                    )}
                    {fileIssues.length > 0 && (
                        <span className="tag tag-warn">
                            {translator.getMessage('rule_tag_file_issue')}
                        </span>
                    )}
                </div>
                <div className="rule-files">
                    {FILE_KINDS.map((kind) => {
                        const path = rule[kind];
                        if (!path) {
                            return null;
                        }

                        const unreadable = fileIssues.includes(kind);
                        const fileOff = !rule[FILE_ENABLED_FLAGS[kind]];
                        const openLabel = translator.getMessage('rule_open_file');
                        let suffix = openLabel;
                        if (unreadable) {
                            suffix = translator.getMessage('rule_file_unreadable');
                        } else if (fileOff) {
                            suffix = `${translator.getMessage('rule_tag_off')} — ${openLabel}`;
                        }
                        const tooltip = `${path} — ${suffix}`;

                        return (
                            <Tooltip
                                key={kind}
                                label={tooltip}
                                withArrow={false}
                                events={{ hover: true, focus: true, touch: true }}
                            >
                                <button
                                    type="button"
                                    className={classNames('chip', { 'chip-off': fileOff })}
                                    onClick={() => onOpenFile(path)}
                                    aria-label={tooltip}
                                >
                                    <b>{FILE_KIND_LABELS[kind]}</b>
                                    <span className="chip-path">
                                        {truncateMiddle(getDisplayPath(path))}
                                    </span>
                                    {fileOff && (
                                        <span className="chip-off-tag">
                                            {translator.getMessage('rule_tag_off')}
                                        </span>
                                    )}
                                    {unreadable && <span className="chip-warn-dot" />}
                                </button>
                            </Tooltip>
                        );
                    })}
                </div>
            </div>
            <div className="rule-actions">
                <Menu
                    position="bottom-end"
                    width={180}
                    transitionProps={{ transition: 'pop-top-right', duration: 140 }}
                >
                    <Menu.Target>
                        <ActionIcon
                            ref={menuRef}
                            variant="subtle"
                            size={34}
                            title={translator.getMessage('rule_actions_title')}
                            aria-label={translator.getMessage('rule_actions_title')}
                            data-testid="rule-menu"
                        >
                            <IconDots size={17} />
                        </ActionIcon>
                    </Menu.Target>
                    <Menu.Dropdown>
                        <Menu.Item onClick={() => onEdit(rule)} data-testid="rule-edit">
                            {translator.getMessage('rule_edit')}
                        </Menu.Item>
                        <Menu.Item onClick={() => onDuplicate(rule.id)}>
                            {translator.getMessage('rule_duplicate')}
                        </Menu.Item>
                        <Menu.Divider />
                        {FILE_KINDS.map((kind) => {
                            const path = rule[kind];
                            if (!path) {
                                return null;
                            }

                            const fileEnabled = rule[FILE_ENABLED_FLAGS[kind]];
                            const name = `${FILE_KIND_LABELS[kind]} ${getFileName(path)}`;
                            const label = translator.getMessage('popup_file_toggle_for', { name });
                            return (
                                <Menu.Item
                                    key={kind}
                                    className="menu-item-file"
                                    role="menuitemcheckbox"
                                    aria-checked={fileEnabled}
                                    aria-label={label}
                                    title={label}
                                    closeMenuOnClick={false}
                                    onClick={() => onFileToggle(rule.id, kind, !fileEnabled)}
                                    rightSection={(
                                        <Switch
                                            checked={fileEnabled}
                                            onChange={() => undefined}
                                            size="xs"
                                            tabIndex={-1}
                                            aria-hidden
                                        />
                                    )}
                                    data-testid={`rule-file-toggle-${kind}`}
                                >
                                    {FILE_KIND_LABELS[kind]}
                                </Menu.Item>
                            );
                        })}
                        <Menu.Divider />
                        <Menu.Item
                            className="menu-item-danger"
                            onClick={() => onRequestDelete(rule.id)}
                            data-testid="rule-delete"
                        >
                            {translator.getMessage('rule_delete')}
                        </Menu.Item>
                    </Menu.Dropdown>
                </Menu>
            </div>
        </div>
    );
};
