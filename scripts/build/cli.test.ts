/**
 * @file
 */

import { Command } from 'commander';
import { expect, test } from 'vitest';

/* eslint-disable jsdoc/require-jsdoc */

import {
    BROWSER_TARGETS,
    CHANNEL_ENVS,
    type BrowserTarget,
} from '../constants';
import {
    createBuildProgram,
    type BuildCommandHandler,
} from './cli';

type BuildCall = {
    targets: BrowserTarget[];
    watch: boolean;
};

/**
 * Creates a test program and records accepted build requests.
 *
 * @param buildEnv Build channel passed to the CLI.
 *
 * @returns Test program and recorded build calls.
 */
const createTestProgram = (buildEnv: typeof CHANNEL_ENVS[keyof typeof CHANNEL_ENVS]): {
    program: Command;
    calls: BuildCall[];
} => {
    const calls: BuildCall[] = [];
    const build: BuildCommandHandler = async (targets, watch) => {
        calls.push({ targets, watch });
    };
    const program = createBuildProgram(buildEnv, build);

    program.exitOverride();
    program.configureOutput({
        writeErr: () => undefined,
        writeOut: () => undefined,
    });

    return { program, calls };
};

test.each([CHANNEL_ENVS.DEV, CHANNEL_ENVS.RELEASE])(
    '%s builds all browsers by default',
    async (buildEnv) => {
        const { program, calls } = createTestProgram(buildEnv);

        await program.parseAsync(['node', 'bundle']);

        expect(calls).toEqual([{
            targets: [
                BROWSER_TARGETS.CHROME,
                BROWSER_TARGETS.EDGE,
                BROWSER_TARGETS.FIREFOX,
            ],
            watch: false,
        }]);
    },
);

test.each([
    BROWSER_TARGETS.CHROME,
    BROWSER_TARGETS.EDGE,
    BROWSER_TARGETS.FIREFOX,
])('builds only the selected %s target', async (target) => {
    const { program, calls } = createTestProgram(CHANNEL_ENVS.DEV);

    await program.parseAsync(['node', 'bundle', target]);

    expect(calls).toEqual([{ targets: [target], watch: false }]);
});

test('watches one explicitly selected development target', async () => {
    const { program, calls } = createTestProgram(CHANNEL_ENVS.DEV);

    await program.parseAsync(['node', 'bundle', BROWSER_TARGETS.CHROME, '--watch']);

    expect(calls).toEqual([{
        targets: [BROWSER_TARGETS.CHROME],
        watch: true,
    }]);
});

test('rejects development watch mode without a browser target', async () => {
    const { program, calls } = createTestProgram(CHANNEL_ENVS.DEV);

    await expect(program.parseAsync(['node', 'bundle', '--watch']))
        .rejects.toMatchObject({ code: 'commander.error' });
    expect(calls).toEqual([]);
});

test('rejects release watch mode', async () => {
    const { program, calls } = createTestProgram(CHANNEL_ENVS.RELEASE);

    await expect(program.parseAsync([
        'node',
        'bundle',
        BROWSER_TARGETS.FIREFOX,
        '--watch',
    ])).rejects.toMatchObject({ code: 'commander.error' });
    expect(calls).toEqual([]);
});

test('rejects unknown browser commands and options', async () => {
    const unknownCommand = createTestProgram(CHANNEL_ENVS.DEV);
    const unknownOption = createTestProgram(CHANNEL_ENVS.DEV);

    await expect(unknownCommand.program.parseAsync(['node', 'bundle', 'safari']))
        .rejects.toMatchObject({ code: 'commander.excessArguments' });
    await expect(unknownOption.program.parseAsync(['node', 'bundle', '--unknown']))
        .rejects.toMatchObject({ code: 'commander.unknownOption' });
    expect(unknownCommand.calls).toEqual([]);
    expect(unknownOption.calls).toEqual([]);
});
