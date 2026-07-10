/**
 * @file
 */

import lodash from 'lodash';
import {
    BROWSER_TARGETS,
    CHANNEL_ENVS,
    type BrowserTarget,
    type BuildEnv,
} from '../constants';

const { capitalize } = lodash;

/**
 * Source content accepted by build transforms.
 */
type TransformContent = Buffer | string;

/**
 * Manifest values supplied by the build configuration.
 */
interface ManifestOptions {
    /**
     * Browser receiving the generated manifest.
     */
    browser: BrowserTarget;

    /**
     * Extension version written to the manifest.
     */
    version: string;
}

/**
 * Localized messages transformed during the build.
 */
interface LocaleMessages {
    /**
     * Localized extension name entry.
     */
    name: {
        /**
         * Localized extension name text.
         */
        message: string;
    };
}

/**
 * Updates the extension manifest for the selected build.
 *
 * @param content Manifest source content.
 * @param options Manifest transformation options.
 *
 * @returns Serialized manifest content.
 */
export const updateManifest = (
    content: TransformContent,
    options: ManifestOptions,
): string => {
    const manifest = JSON.parse(content.toString()) as Record<string, unknown>;

    const background = options.browser === BROWSER_TARGETS.FIREFOX
        ? { page: 'background.html' }
        : { service_worker: 'background.js' };

    const browserSpecificSettings = options.browser === BROWSER_TARGETS.FIREFOX
        ? {
            gecko: {
                id: 'kode-injector@maximtop.dev',
                strict_min_version: '153.0',
                data_collection_permissions: {
                    required: ['none'],
                },
            },
        }
        : undefined;

    manifest.background = background;
    manifest.version = options.version;

    if (browserSpecificSettings) {
        manifest.browser_specific_settings = browserSpecificSettings;
    } else {
        delete manifest.browser_specific_settings;
    }

    return JSON.stringify(manifest, null, 4);
};

/**
 * Adds the build channel suffix to the localized extension name.
 *
 * @param content Locale messages source content.
 * @param buildEnv Selected build environment.
 *
 * @returns Serialized locale messages content.
 */
export const updateLocalesMSGName = (
    content: TransformContent,
    buildEnv: BuildEnv,
): string => {
    const messages = JSON.parse(content.toString()) as LocaleMessages;
    const isRelease = buildEnv === CHANNEL_ENVS.RELEASE;

    if (!isRelease) {
        messages.name.message += ` (${capitalize(buildEnv)})`;
    }

    return JSON.stringify(messages, null, 4);
};
