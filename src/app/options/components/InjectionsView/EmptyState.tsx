/**
 * @file First-run onboarding shown when no injection rules exist.
 */

import React from 'react';
import { Button } from '@mantine/core';

import { translator } from '../../../common/translator';

/**
 * EmptyState props.
 */
interface EmptyStateProps {
    /**
     * Opens the rule editor for a new rule.
     */
    onCreate: () => void;
}

/**
 * Renders the zero-rules onboarding state.
 *
 * @param props EmptyState props.
 *
 * @returns Empty state element.
 */
export const EmptyState = ({ onCreate }: EmptyStateProps): React.JSX.Element => {
    const steps = [
        {
            title: translator.getMessage('empty_step_site_title'),
            text: translator.getMessage('empty_step_site_text'),
        },
        {
            title: translator.getMessage('empty_step_files_title'),
            text: translator.getMessage('empty_step_files_text'),
        },
        {
            title: translator.getMessage('empty_step_reload_title'),
            text: translator.getMessage('empty_step_reload_text'),
        },
    ];

    return (
        <div className="empty" data-testid="empty-state">
            <h2>{translator.getMessage('empty_title')}</h2>
            <p className="empty-sub">{translator.getMessage('empty_description')}</p>
            <div className="empty-steps">
                {steps.map((step, index) => (
                    <div className="estep" key={step.title}>
                        <span className="estep-number">{index + 1}</span>
                        <span className="estep-text">
                            <strong>{step.title}</strong>
                            {step.text}
                        </span>
                    </div>
                ))}
            </div>
            <Button variant="filled" onClick={onCreate} data-testid="new-injection-btn">
                {translator.getMessage('injections_new')}
            </Button>
        </div>
    );
};
