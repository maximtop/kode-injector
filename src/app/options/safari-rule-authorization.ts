/**
 * @file Safari folder authorization performed from the explicit Save action.
 */

import { BrowserTarget } from '../common/browser-target';
import type { NewInjectionData } from '../common/contracts';
import { InjectionField } from '../common/constants';
import { NativeErrorCode } from '../common/native-host-protocol';

/**
 * Minimal native authorization surface used by rule persistence.
 */
export interface SafariFolderAuthorizer {
    /**
     * Requests access to the immediate folder containing a source file.
     *
     * @param fileUrl Local source URL whose folder must be authorized.
     */
    authorizeFolder(fileUrl: string): Promise<void>;
}

/**
 * Field-specific native authorization failure presented by the rule editor.
 */
export class SafariRuleAuthorizationError extends Error {
    /**
     * Source field that failed authorization.
     */
    public readonly field: InjectionField.JsPath | InjectionField.CssPath;

    /**
     * Closed native error code returned for the field.
     */
    public readonly code: string;

    /**
     * Creates a field-specific authorization failure.
     *
     * @param field Source field that failed authorization.
     * @param code Closed native error code.
     */
    public constructor(
        field: InjectionField.JsPath | InjectionField.CssPath,
        code: string,
    ) {
        super(code);
        this.field = field;
        this.code = code;
    }
}

/**
 * Authorizes every configured Safari source before rule persistence.
 *
 * @param browserTarget Current browser target.
 * @param data Validated rule values.
 * @param authorizer Safari native authorizer.
 */
export const authorizeSafariRuleSources = async (
    browserTarget: BrowserTarget,
    data: NewInjectionData,
    authorizer: SafariFolderAuthorizer,
): Promise<void> => {
    if (browserTarget !== BrowserTarget.Safari) {
        return;
    }

    const sources = [InjectionField.JsPath, InjectionField.CssPath] as const;
    await sources.reduce<Promise<void>>(async (previous, field) => {
        await previous;
        const fileUrl = data[field];
        if (!fileUrl) {
            return;
        }
        try {
            await authorizer.authorizeFolder(fileUrl);
        } catch (error) {
            throw new SafariRuleAuthorizationError(
                field,
                error instanceof Error ? error.message : NativeErrorCode.AuthorizationFailed,
            );
        }
    }, Promise.resolve());
};

/**
 * Persists a rule only after all required Safari folder grants succeed.
 *
 * @param browserTarget Current browser target.
 * @param data Validated rule values.
 * @param authorizer Safari native authorizer.
 * @param persist Existing add or update operation.
 *
 * @returns Whether persistence succeeded.
 */
export const saveRuleWithSafariAuthorization = async (
    browserTarget: BrowserTarget,
    data: NewInjectionData,
    authorizer: SafariFolderAuthorizer,
    persist: () => Promise<boolean>,
): Promise<boolean> => {
    await authorizeSafariRuleSources(browserTarget, data, authorizer);
    return persist();
};
