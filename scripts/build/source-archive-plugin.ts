/**
 * @file
 */

/* eslint-disable no-console */
import { execFileSync } from 'node:child_process';
import { writeFileSync } from 'node:fs';
import path from 'node:path';
import type { Compiler } from '@rspack/core';
import AdmZip from 'adm-zip';

import { APPROVAL_NOTES, appendAmoReviewSection } from './amo-review';

/**
 * Checks whether a directory sits inside a git work tree.
 *
 * @param repoRoot Directory to probe.
 *
 * @returns Whether git is available and the directory is a work tree.
 */
export const isGitWorkTree = (repoRoot: string): boolean => {
    try {
        const output = execFileSync('git', ['rev-parse', '--is-inside-work-tree'], {
            cwd: repoRoot,
            stdio: ['ignore', 'pipe', 'ignore'],
        });

        return output.toString().trim() === 'true';
    } catch {
        return false;
    }
};

/**
 * Writes the AMO source archive and its approval notes.
 *
 * The archive holds the committed repository state, so it reproduces the
 * submitted package exactly. Inside it, the README gains the Firefox reviewer
 * section in place of the table-of-contents anchor; the notes file is
 * uploaded to the AMO `approval_notes` field at deploy time.
 *
 * @param repoRoot Repository root directory.
 * @param archivePath Destination source ZIP path.
 * @param notesPath Destination approval notes path.
 * @param prefix Top-level directory name inside the archive.
 *
 * @throws When the archived README is missing.
 */
export const writeSourceArchive = (
    repoRoot: string,
    archivePath: string,
    notesPath: string,
    prefix: string,
): void => {
    execFileSync('git', [
        'archive',
        '--format=zip',
        `--prefix=${prefix}/`,
        '-o', archivePath,
        'HEAD',
    ], { cwd: repoRoot, stdio: ['ignore', 'ignore', 'inherit'] });

    const archive = new AdmZip(archivePath);
    const readmeEntry = `${prefix}/README.md`;
    const readme = archive.readAsText(readmeEntry);

    if (!readme) {
        throw new Error(`Source archive is missing ${readmeEntry}.`);
    }

    archive.updateFile(readmeEntry, Buffer.from(appendAmoReviewSection(readme)));
    archive.writeZip(archivePath);

    writeFileSync(notesPath, APPROVAL_NOTES);
};

/**
 * Creates the AMO source archive and approval notes after Rspack emits all
 * assets.
 *
 * Builds that run outside a git checkout — a Mozilla reviewer rebuilding the
 * extension from this very archive — log a warning and skip instead of
 * failing, because the reviewer has no repository to archive.
 */
export class SourceArchivePlugin {
    /**
     * Repository root directory.
     */
    repoRoot: string;

    /**
     * Destination source ZIP path.
     */
    archivePath: string;

    /**
     * Destination approval notes path.
     */
    notesPath: string;

    /**
     * Top-level directory name inside the archive.
     */
    prefix: string;

    /**
     * Creates a source archive plugin.
     *
     * @param repoRoot Repository root directory.
     * @param archivePath Destination source ZIP path.
     * @param notesPath Destination approval notes path.
     * @param prefix Top-level directory name inside the archive.
     */
    constructor(
        repoRoot: string,
        archivePath: string,
        notesPath: string,
        prefix: string,
    ) {
        this.repoRoot = repoRoot;
        this.archivePath = archivePath;
        this.notesPath = notesPath;
        this.prefix = prefix;
    }

    /**
     * Registers source archive creation after emit.
     *
     * @param compiler Rspack compiler.
     */
    apply(compiler: Compiler): void {
        compiler.hooks.afterEmit.tap('SourceArchivePlugin', () => {
            if (!isGitWorkTree(this.repoRoot)) {
                console.warn(
                    '[SourceArchivePlugin] Not a git checkout; skipping source archive.',
                );
                return;
            }

            writeSourceArchive(
                this.repoRoot,
                path.resolve(this.archivePath),
                path.resolve(this.notesPath),
                this.prefix,
            );
        });
    }
}
