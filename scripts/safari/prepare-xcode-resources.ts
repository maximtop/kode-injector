/**
 * @file Generates Xcode file lists for the built Safari WebExtension resources.
 */

import fs from 'node:fs';
import path from 'node:path';
import { SAFARI_BUILD_PATH } from './config';

const RESOURCE_LIST_PATH = path.join(
    SAFARI_BUILD_PATH,
    'web-extension-resources.txt',
);
const INPUT_FILE_LIST_PATH = path.join(
    SAFARI_BUILD_PATH,
    'web-extension-inputs.xcfilelist',
);
const OUTPUT_FILE_LIST_PATH = path.join(
    SAFARI_BUILD_PATH,
    'web-extension-outputs.xcfilelist',
);

/**
 * Recursively lists regular files under one generated resource directory.
 *
 * @param directory Directory currently being traversed.
 * @param root Root used to produce stable relative paths.
 *
 * @returns Sorted POSIX-style relative file paths.
 */
const listFiles = (directory: string, root: string): string[] => fs
    .readdirSync(directory, { withFileTypes: true })
    .flatMap((entry) => {
        const entryPath = path.join(directory, entry.name);
        if (entry.isDirectory()) {
            return listFiles(entryPath, root);
        }
        if (!entry.isFile()) {
            throw new Error(`Unexpected Safari resource type: ${entryPath}`);
        }
        return [path.relative(root, entryPath).split(path.sep).join('/')];
    })
    .sort();

/**
 * Creates sandbox-aware Xcode input and output file lists for a WebExtension build.
 *
 * @param webExtensionPath Generated unpacked Safari WebExtension directory.
 *
 * @throws When the generated resource tree is absent or incomplete.
 */
export const prepareXcodeResources = (webExtensionPath: string): void => {
    const manifestPath = path.join(webExtensionPath, 'manifest.json');
    if (!fs.existsSync(manifestPath)) {
        throw new Error(`Missing generated Safari manifest: ${manifestPath}`);
    }

    const relativePaths = listFiles(webExtensionPath, webExtensionPath);
    if (relativePaths.length === 0) {
        throw new Error('Generated Safari WebExtension resource tree is empty');
    }

    fs.mkdirSync(SAFARI_BUILD_PATH, { recursive: true });
    fs.writeFileSync(RESOURCE_LIST_PATH, `${relativePaths.join('\n')}\n`);
    fs.writeFileSync(INPUT_FILE_LIST_PATH, [
        '$(KODE_INJECTOR_WEB_EXTENSION_RESOURCE_LIST)',
        ...relativePaths.map((relativePath) => (
            `$(KODE_INJECTOR_WEB_EXTENSION_PATH)/${relativePath}`
        )),
        '',
    ].join('\n'));
    fs.writeFileSync(OUTPUT_FILE_LIST_PATH, [
        ...relativePaths.map((relativePath) => (
            `$(TARGET_BUILD_DIR)/$(UNLOCALIZED_RESOURCES_FOLDER_PATH)/${relativePath}`
        )),
        '',
    ].join('\n'));
};
