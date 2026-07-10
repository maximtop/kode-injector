/**
 * @file
 */

import { Command } from 'commander';

import {
    ALL_BROWSER_TARGETS,
    BROWSER_TARGETS,
    CHANNEL_ENVS,
    type BrowserTarget,
    type BuildEnv,
} from '../constants';

/**
 * Executes an accepted build request.
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
 * @param target Selected browser, when present.
 * @param watch Whether watch mode was requested.
 */
const validateWatch = (
    program: Command,
    buildEnv: BuildEnv,
    target: BrowserTarget | undefined,
    watch: boolean,
): void => {
    if (!watch) {
        return;
    }

    if (buildEnv === CHANNEL_ENVS.RELEASE) {
        program.error('Release builds do not support watch mode.');
    }

    if (!target) {
        program.error('Watch mode requires a browser target.');
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

                validateWatch(program, buildEnv, target, options.watch);
                await build([target], options.watch);
            });
    }

    program.action(async (options: BuildCommandOptions) => {
        validateWatch(program, buildEnv, undefined, options.watch);
        await build([...ALL_BROWSER_TARGETS], options.watch);
    });

    return program;
};

export { BROWSER_TARGETS };
