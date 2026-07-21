/**
 * @file Radio cards selecting the local-file access method.
 */

import React from 'react';
import classNames from 'classnames';

import { BrowserTarget } from '../../../common/browser-target';
import { LocalSourceAccessMethod } from '../../../common/contracts';
import { translator } from '../../../common/translator';

/**
 * AccessMethodCards props.
 */
interface AccessMethodCardsProps {
    /**
     * Browser hosting the extension.
     */
    browserTarget: BrowserTarget;

    /**
     * Currently selected access method.
     */
    method: LocalSourceAccessMethod;

    /**
     * Whether selection is temporarily disabled.
     */
    disabled: boolean;

    /**
     * Applies a newly selected method.
     */
    onChange: (method: LocalSourceAccessMethod) => void;
}

/**
 * Renders the access-method selector.
 *
 * Firefox cannot read file URLs from extensions, so there the method is
 * fixed to the Helper and the selector is replaced with an explanation.
 *
 * @param props AccessMethodCards props.
 *
 * @returns Method selector element.
 */
export const AccessMethodCards = ({
    browserTarget,
    method,
    disabled,
    onChange,
}: AccessMethodCardsProps): React.JSX.Element => {
    if (browserTarget === BrowserTarget.Firefox) {
        return (
            <div className="firefox-method-note">
                <strong>{translator.getMessage('local_source_method_native_host')}</strong>
                <span>{translator.getMessage('settings_firefox_helper_locked')}</span>
                <span>{translator.getMessage('native_host_read_only')}</span>
            </div>
        );
    }

    const cards = [
        {
            value: LocalSourceAccessMethod.Browser,
            title: translator.getMessage('local_source_method_browser'),
            tag: translator.getMessage('tag_default'),
            description: translator.getMessage('local_source_method_browser_description'),
        },
        {
            value: LocalSourceAccessMethod.NativeHost,
            title: translator.getMessage('local_source_method_native_host'),
            tag: translator.getMessage('local_source_method_advanced'),
            description: translator.getMessage('local_source_method_native_host_description'),
        },
    ];

    return (
        <div className="radio-cards" role="radiogroup" aria-label={translator.getMessage('local_source_method')}>
            {cards.map((card) => (
                <label
                    key={card.value}
                    htmlFor={`method-${card.value}`}
                    className={classNames('radio-card', {
                        selected: method === card.value,
                        disabled,
                    })}
                >
                    <input
                        id={`method-${card.value}`}
                        type="radio"
                        name="local-source-method"
                        value={card.value}
                        checked={method === card.value}
                        disabled={disabled}
                        onChange={() => {
                            if (method !== card.value) {
                                onChange(card.value);
                            }
                        }}
                    />
                    <span>
                        <span className="radio-card-title">
                            {card.title}
                            <span className="tag">{card.tag}</span>
                        </span>
                        <span className="radio-card-desc">
                            {card.description}
                        </span>
                    </span>
                </label>
            ))}
        </div>
    );
};
