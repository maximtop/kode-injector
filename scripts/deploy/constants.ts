/**
 * @file Store deployment constants of this repository. Every other file under scripts/deploy
 * and tests/deploy is identical across the extension repositories; only this file differs.
 */

/**
 * Prefix of every release asset: `<prefix>-<version>-<browser>.zip` and
 * `<prefix>-<version>-source.zip`, listed in `SHA256SUMS.txt`.
 */
export const RELEASE_ASSET_PREFIX = 'kode-injector';

/**
 * Stores this extension is deployed to; each one has a deploy-<store>.yml workflow.
 */
export const STORE_TARGETS = ['chrome', 'edge', 'firefox'] as const;

/**
 * Store this repository can deploy to.
 */
export type StoreTarget = typeof STORE_TARGETS[number];

/**
 * Firefox add-on ID (`browser_specific_settings.gecko.id`); empty when Firefox is not a target.
 */
export const GECKO_ID = 'kode-injector@maximtop.dev';

/**
 * Files the Firefox source archive must contain; unused when Firefox is not a target.
 */
export const SOURCE_REQUIRED_FILES = [
    'package.json',
    'pnpm-lock.yaml',
    'src/manifest.json',
    'rspack.config.ts',
    'native-host/go.mod',
];

/**
 * Reviewer notes inside the source archive, submitted to AMO with every new Firefox version.
 */
export const AMO_REVIEW_NOTES_PATH = 'docs/AMO_REVIEW.md';

/**
 * Shape of a release tag; the version is the tag without the `v` prefix.
 */
export const RELEASE_TAG_PATTERN = /^v[0-9]+\.[0-9]+\.[0-9]+$/;

/**
 * Directory the deploy workflows download the release assets into.
 */
export const STORE_UPLOAD_DIRECTORY = 'store-upload';
