/**
 * @file
 */

import { translate, type I18nInterface } from '@adguard/translate';

import { i18n } from './i18n';

/**
 * String translator for extension-owned UI messages.
 */
export const translator = translate.createTranslator(i18n as I18nInterface);
