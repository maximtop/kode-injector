/**
 * @file
 */

/* eslint-disable no-console */
import { createRspackConfig } from '../../rspack.config';
import {
    CHANNEL_ENVS,
    type BuildEnv,
} from '../constants';
import { bundleRunner } from './bundle-runner';
import { createBuildProgram, type BuildCommandHandler } from './cli';

const channelEnv = process.env.CHANNEL_ENV;

if (channelEnv !== CHANNEL_ENVS.DEV && channelEnv !== CHANNEL_ENVS.RELEASE) {
    throw new Error(`Unsupported CHANNEL_ENV: ${channelEnv ?? '(missing)'}`);
}

const buildEnv = channelEnv as BuildEnv;

/**
 * Builds the browser configurations selected by the command line.
 */
const build: BuildCommandHandler = async (targets, watch) => {
    const configurations = targets.map((target) => createRspackConfig(target, buildEnv));
    await bundleRunner(configurations, watch);
};

createBuildProgram(buildEnv, build)
    .parseAsync(process.argv)
    .catch((error: unknown) => {
        console.error(error);
        process.exitCode = 1;
    });
