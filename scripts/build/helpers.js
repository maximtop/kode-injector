import { capitalize } from 'lodash';
import { CHANNEL_ENVS } from '../constants';

export const updateManifest = (content, isDev, options) => {
    const manifest = JSON.parse(content.toString());

    manifest.version = options.version;

    return JSON.stringify(manifest, null, 4);
};

export const updateLocalesMSGName = (content, buildEnv) => {
    const messages = JSON.parse(content.toString());
    const isProd = buildEnv === CHANNEL_ENVS.PROD;

    if (!isProd) {
        messages.name.message += ` (${capitalize(buildEnv)})`;
    }

    return JSON.stringify(messages, null, 4);
};
