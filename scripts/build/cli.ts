/**
 * @file
 */

import { Command } from 'commander';

import {
    ALL_BROWSER_TARGETS,
    BROWSER_TARGETS,
    CHANNEL_ENVS,
    DEFAULT_BROWSER_TARGETS,
    type BrowserTarget,
    type BuildEnv,
} from '../constants';

/**
 * Executes an accepted build request.
 *
 * @param targets Browser targets selected for the build.
 * @param watch Whether to keep rebuilding changed inputs.
 */
export type BuildCommandHandler = (
    targets: BrowserTarget[],
    watch: boolean,
) => Promise<void>;

/**
 * Global build command options.
 */
type BuildCommandOptions = {
    /**
     * Whether to keep rebuilding changed inputs.
     */
    watch: boolean;
};

/**
 * Validates whether watch mode is supported for the request.
 *
 * @param program Commander program used to report validation failures.
 * @param buildEnv Selected build channel.
 * @param watch Whether watch mode was requested.
 */
const validateWatch = (
    program: Command,
    buildEnv: BuildEnv,
    watch: boolean,
): void => {
    if (!watch) {
        return;
    }

    if (buildEnv === CHANNEL_ENVS.RELEASE) {
        program.error('Release builds do not support watch mode.');
    }
};

/**
 * Creates the cross-browser build command program.
 *
 * @param buildEnv Selected build channel.
 * @param build Accepted build request handler.
 *
 * @returns Configured Commander program.
 */
export const createBuildProgram = (
    buildEnv: BuildEnv,
    build: BuildCommandHandler,
): Command => {
    const program = new Command();

    program
        .name('bundle')
        .description('Build Kode Injector for supported browsers')
        .allowExcessArguments(false)
        .option('-w, --watch', 'rebuild a selected development target on changes', false)
        .showHelpAfterError();

    for (const target of ALL_BROWSER_TARGETS) {
        program
            .command(target)
            .description(`build Kode Injector for ${target}`)
            .action(async (_options: unknown, command: Command) => {
                const options = command.parent?.opts<BuildCommandOptions>()
                    ?? { watch: false };

                validateWatch(program, buildEnv, options.watch);
                await build([target], options.watch);
            });
    }

    program.action(async (options: BuildCommandOptions) => {
        const targets = buildEnv === CHANNEL_ENVS.DEV
            ? [BROWSER_TARGETS.CHROME]
            : [...DEFAULT_BROWSER_TARGETS];
        validateWatch(program, buildEnv, options.watch);
        await build(targets, options.watch);
    });

    return program;
};

export { BROWSER_TARGETS };
