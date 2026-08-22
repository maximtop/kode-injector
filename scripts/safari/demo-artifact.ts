/**
 * @file Validates the built-in demo inside built Safari WebExtension resources.
 */

import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import postcss from 'postcss';

import {
    DEMO_RESOURCE_PATHS,
    DEMO_RUN_TEST_ID,
    isDemoCss,
    isDemoJavaScript,
} from '../../src/app/common/demo-contracts';

/**
 * Built bundle that must load the demo sources.
 */
const BACKGROUND_BUNDLE = 'background.js';

/**
 * Built bundle that must contain the Run Demo control.
 */
const OPTIONS_BUNDLE = 'options.js';

/**
 * Reads one built text artifact.
 *
 * @param filePath Artifact path.
 * @param label Human-readable artifact name.
 *
 * @returns Artifact text.
 *
 * @throws When the artifact is missing.
 */
const readArtifact = (filePath: string, label: string): string => {
    if (!fs.existsSync(filePath)) {
        throw new Error(`Missing Safari built-in demo artifact: ${label} (${filePath})`);
    }
    return fs.readFileSync(filePath, 'utf8');
};

/**
 * Validates the demo files and their references inside one built resource tree.
 *
 * @param resourcesPath Directory containing the built WebExtension resources
 * (the appex `Contents/Resources`, or `build/<channel>/safari`).
 *
 * @throws When either demo source is absent, empty, unmarked, or unparseable,
 * or when the built background or options bundle does not reference the demo.
 */
export const validateBuiltInDemoResources = (resourcesPath: string): void => {
    const javascriptPath = path.join(resourcesPath, DEMO_RESOURCE_PATHS.javascript);
    const cssPath = path.join(resourcesPath, DEMO_RESOURCE_PATHS.css);
    const javascript = readArtifact(javascriptPath, 'demo JavaScript');
    const css = readArtifact(cssPath, 'demo CSS');

    if (!isDemoJavaScript(javascript)) {
        throw new Error('Safari built-in demo JavaScript is empty or lacks its Kode Injector marker');
    }
    try {
        vm.compileFunction(javascript, [], { filename: javascriptPath });
    } catch (error) {
        throw new Error(`Safari built-in demo JavaScript does not parse: ${(error as Error).message}`);
    }
    if (!isDemoCss(css)) {
        throw new Error('Safari built-in demo CSS is empty or lacks its marker property');
    }
    try {
        postcss.parse(css, { from: cssPath });
    } catch (error) {
        throw new Error(`Safari built-in demo CSS does not parse: ${(error as Error).message}`);
    }

    const background = readArtifact(path.join(resourcesPath, BACKGROUND_BUNDLE), 'background bundle');
    if (!background.includes(DEMO_RESOURCE_PATHS.javascript)
        || !background.includes(DEMO_RESOURCE_PATHS.css)) {
        throw new Error('Safari background bundle does not load the built-in demo sources');
    }
    const options = readArtifact(path.join(resourcesPath, OPTIONS_BUNDLE), 'options bundle');
    if (!options.includes(DEMO_RUN_TEST_ID)) {
        throw new Error('Safari options bundle has no Run Demo control');
    }
};
