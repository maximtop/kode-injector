/**
 * @file
 */

/* eslint-disable import/no-unresolved, no-console */
import {
    rspack,
    type Configuration,
    type MultiStats,
    type Stats,
} from '@rspack/core';

/**
 * Rspack statistics returned by a single or multi-compiler build.
 */
type BuildStats = Stats | MultiStats;

/**
 * Prints successful build statistics and rejects compilation errors.
 *
 * @param stats Rspack build statistics.
 *
 * @throws When the compilation contains errors.
 */
const reportStats = (stats: BuildStats): void => {
    console.log(stats.toString({
        chunks: false,
        colors: true,
    }));

    if (stats.hasErrors()) {
        throw new Error('Rspack compilation failed.');
    }
};

/**
 * Runs or watches the requested Rspack configurations.
 *
 * @param configurations Browser configurations to compile.
 * @param watch Whether to continue watching for changes.
 *
 * @returns Promise resolved after the build, or the initial watch compilation.
 */
export const bundleRunner = (
    configurations: Configuration[],
    watch: boolean,
): Promise<void> => {
    const options = configurations.length === 1
        ? configurations[0]
        : configurations;
    const compiler = rspack(options);

    if (watch) {
        return new Promise((resolve, reject) => {
            let initialBuildComplete = false;

            compiler.watch({}, (error, stats) => {
                try {
                    if (error) {
                        throw error;
                    }

                    reportStats(stats);
                    if (!initialBuildComplete) {
                        initialBuildComplete = true;
                        resolve();
                    }
                } catch (buildError) {
                    if (!initialBuildComplete) {
                        reject(buildError);
                        return;
                    }

                    console.error(buildError);
                    process.exitCode = 1;
                }
            });
        });
    }

    return new Promise((resolve, reject) => {
        compiler.run((error, stats) => {
            /**
             * Closes the compiler and settles the build promise.
             *
             * @param buildError Compilation error, when present.
             */
            const finish = (buildError?: Error): void => {
                compiler.close((closeError) => {
                    if (buildError || closeError) {
                        reject(buildError ?? closeError);
                        return;
                    }

                    resolve();
                });
            };

            if (error) {
                finish(error);
                return;
            }

            try {
                reportStats(stats);
                finish();
            } catch (buildError) {
                finish(buildError instanceof Error
                    ? buildError
                    : new Error(String(buildError)));
            }
        });
    });
};
