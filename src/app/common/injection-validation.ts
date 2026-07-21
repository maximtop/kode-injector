/**
 * @file Form-level validation of injection rule input.
 */

import { InjectionField } from './constants';
import { hasInjectionSource, type NewInjectionData } from './contracts';
import { urlUtils } from './url-utils';

/**
 * Validation issues detected in injection rule input.
 */
export type InjectionInputErrors = {
    /**
     * Whether the site is not a valid hostname.
     */
    [InjectionField.Site]?: boolean;

    /**
     * Whether the JS path is present but not a file URL.
     */
    [InjectionField.JsPath]?: boolean;

    /**
     * Whether the CSS path is present but not a file URL.
     */
    [InjectionField.CssPath]?: boolean;

    /**
     * Whether both source paths are empty.
     */
    missingSource?: boolean;
};

/**
 * Validates user input for a new or edited injection rule.
 *
 * The site must normalize to a valid hostname, each provided path must be
 * a file:/// URL, and at least one of the two paths must be present.
 *
 * @param data Trimmed form values.
 *
 * @returns Detected issues; an empty object means the input is valid.
 */
export const validateInjectionInput = (data: NewInjectionData): InjectionInputErrors => {
    const errors: InjectionInputErrors = {};

    if (!urlUtils.normalizeRuleSite(data.site)) {
        errors[InjectionField.Site] = true;
    }

    if (data.jsPath && !urlUtils.isFileUrl(data.jsPath)) {
        errors[InjectionField.JsPath] = true;
    }

    if (data.cssPath && !urlUtils.isFileUrl(data.cssPath)) {
        errors[InjectionField.CssPath] = true;
    }

    if (!hasInjectionSource(data)) {
        errors.missingSource = true;
    }

    return errors;
};

/**
 * Checks whether validation found no issues.
 *
 * @param errors Result of validateInjectionInput.
 *
 * @returns Whether the input is valid.
 */
export const isValidInjectionInput = (errors: InjectionInputErrors): boolean => {
    return Object.keys(errors).length === 0;
};
