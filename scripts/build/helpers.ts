/**
 * @file
 */

import { capitalize } from 'lodash';
import { CHANNEL_ENVS, type BuildEnv } from '../constants';

/**
 * Source content accepted by webpack transforms.
 */
type TransformContent = Buffer | string;

/**
 * Manifest values supplied by the build configuration.
 */
interface ManifestOptions {
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

    manifest.version = options.version;

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
    const isProd = buildEnv === CHANNEL_ENVS.PROD;

    if (!isProd) {
        messages.name.message += ` (${capitalize(buildEnv)})`;
    }

    return JSON.stringify(messages, null, 4);
};
