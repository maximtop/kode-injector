/**
 * @file Centered modal creating and editing injection rules.
 */

import React, { useEffect, useState } from 'react';
import { Button, Modal, TextInput } from '@mantine/core';

import { InjectionField } from '../../../common/constants';
import type { InjectionRule, NewInjectionData } from '../../../common/contracts';
import {
    isValidInjectionInput,
    validateInjectionInput,
    type InjectionInputErrors,
} from '../../../common/injection-validation';
import { translator } from '../../../common/translator';
import { urlUtils } from '../../../common/url-utils';

import './rule-editor.pcss';

/**
 * RuleEditorModal props.
 */
interface RuleEditorModalProps {
    /**
     * Whether the modal is open.
     */
    opened: boolean;

    /**
     * Rule being edited, or null when creating a new rule.
     */
    rule: InjectionRule | null;

    /**
     * Site prefilled into a new rule, or null.
     */
    prefillSite: string | null;

    /**
     * Closes the modal without saving.
     */
    onClose: () => void;

    /**
     * Persists the form values.
     *
     * @returns Whether saving succeeded and the modal may close.
     */
    onSave: (data: NewInjectionData, ruleId: string | null) => Promise<boolean>;
}

/**
 * Empty form values.
 */
const EMPTY_FORM: NewInjectionData = {
    [InjectionField.Site]: '',
    [InjectionField.JsPath]: '',
    [InjectionField.CssPath]: '',
};

/**
 * Hint and error render below the input, as in the design prototype.
 */
const INPUT_ORDER = ['label', 'input', 'description', 'error'] as const;

/**
 * Builds a platform-aware example file URL.
 *
 * @param fileName Example file name.
 *
 * @returns Example path matching the user's operating system.
 */
const getExamplePath = (fileName: string): string => {
    const isWindows = window.navigator.userAgent.includes('Windows');
    return isWindows
        ? `file:///C:/overrides/${fileName}`
        : `file:///Users/you/overrides/${fileName}`;
};

/**
 * Renders the rule editor modal.
 *
 * @param props RuleEditorModal props.
 *
 * @returns Modal element.
 */
export const RuleEditorModal = ({
    opened,
    rule,
    prefillSite,
    onClose,
    onSave,
}: RuleEditorModalProps): React.JSX.Element => {
    const [form, setForm] = useState<NewInjectionData>(EMPTY_FORM);
    const [errors, setErrors] = useState<InjectionInputErrors>({});
    const [saving, setSaving] = useState(false);

    useEffect(() => {
        if (!opened) {
            return;
        }

        setForm({
            [InjectionField.Site]: rule?.site ?? prefillSite ?? '',
            [InjectionField.JsPath]: rule?.jsPath ?? '',
            [InjectionField.CssPath]: rule?.cssPath ?? '',
        });
        setErrors({});
        setSaving(false);
    }, [opened, rule, prefillSite]);

    /**
     * Updates one form field and clears its error.
     *
     * @param field Field to update.
     * @param value New field value.
     */
    const setField = (field: InjectionField, value: string): void => {
        setForm((current) => ({ ...current, [field]: value }));
        setErrors((current) => ({ ...current, [field]: undefined, missingSource: undefined }));
    };

    /**
     * Validates and saves the form.
     */
    const handleSubmit = async (event: React.FormEvent): Promise<void> => {
        event.preventDefault();

        const normalizedSite = urlUtils.normalizeRuleSite(form.site);
        const data: NewInjectionData = {
            site: normalizedSite ?? form.site.trim(),
            jsPath: urlUtils.normalizeRuleFilePath(form.jsPath),
            cssPath: urlUtils.normalizeRuleFilePath(form.cssPath),
        };

        const validationErrors = validateInjectionInput(data);
        setErrors(validationErrors);
        if (!isValidInjectionInput(validationErrors)) {
            // Move focus to the first invalid field so keyboard and
            // screen-reader users land on the problem immediately.
            window.setTimeout(() => {
                const invalid = document.querySelector<HTMLInputElement>(
                    '.editor-fields [aria-invalid="true"]',
                );
                invalid?.focus();
            }, 0);
            return;
        }

        setSaving(true);
        try {
            const saved = await onSave(data, rule?.id ?? null);
            if (saved) {
                onClose();
            }
        } finally {
            setSaving(false);
        }
    };

    const normalizedSite = urlUtils.normalizeRuleSite(form.site);
    const siteHint = normalizedSite
        ? translator.getMessage('editor_site_match_hint', { site: normalizedSite })
        : translator.getMessage('editor_site_hint');

    return (
        <Modal
            opened={opened}
            onClose={onClose}
            title={rule
                ? translator.getMessage('editor_title_edit')
                : translator.getMessage('editor_title_new')}
            centered
            size={480}
            transitionProps={{ transition: 'pop', duration: 160 }}
        >
            <form onSubmit={handleSubmit} noValidate>
                <div className="editor-fields">
                    <TextInput
                        label={translator.getMessage('editor_site_label')}
                        value={form.site}
                        onChange={(event) => {
                            setField(InjectionField.Site, event.currentTarget.value);
                        }}
                        placeholder="example.com"
                        description={siteHint}
                        error={errors[InjectionField.Site]
                            ? translator.getMessage('editor_site_error')
                            : undefined}
                        classNames={{ input: 'mono' }}
                        inputWrapperOrder={[...INPUT_ORDER]}
                        autoComplete="off"
                        spellCheck={false}
                        data-autofocus
                        data-testid="editor-site"
                    />
                    <p className="editor-files-hint">
                        {translator.getMessage('editor_files_hint')}
                    </p>
                    <TextInput
                        label={translator.getMessage('editor_js_label')}
                        value={form.jsPath}
                        onChange={(event) => {
                            setField(InjectionField.JsPath, event.currentTarget.value);
                        }}
                        placeholder={getExamplePath('patch.js')}
                        error={errors[InjectionField.JsPath]
                            ? translator.getMessage('editor_file_scheme_error')
                            : undefined}
                        classNames={{ input: 'mono' }}
                        inputWrapperOrder={[...INPUT_ORDER]}
                        autoComplete="off"
                        spellCheck={false}
                        data-testid="editor-js"
                    />
                    <TextInput
                        label={translator.getMessage('editor_css_label')}
                        value={form.cssPath}
                        onChange={(event) => {
                            setField(InjectionField.CssPath, event.currentTarget.value);
                        }}
                        placeholder={getExamplePath('theme.css')}
                        error={errors[InjectionField.CssPath]
                            ? translator.getMessage('editor_file_scheme_error')
                            : undefined}
                        classNames={{ input: 'mono' }}
                        inputWrapperOrder={[...INPUT_ORDER]}
                        autoComplete="off"
                        spellCheck={false}
                        data-testid="editor-css"
                    />
                    {errors.missingSource && (
                        <p className="editor-form-error" role="alert">
                            {translator.getMessage('editor_at_least_one_error')}
                        </p>
                    )}
                </div>
                <div className="editor-foot">
                    <Button variant="default" onClick={onClose}>
                        {translator.getMessage('cancel')}
                    </Button>
                    <Button
                        type="submit"
                        variant="filled"
                        loading={saving}
                        data-testid="editor-submit"
                    >
                        {rule
                            ? translator.getMessage('editor_save')
                            : translator.getMessage('form_add_injection')}
                    </Button>
                </div>
            </form>
        </Modal>
    );
};
