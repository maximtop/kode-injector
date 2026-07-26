/**
 * @file
 */

/* eslint-disable import/no-extraneous-dependencies */
import { execFileSync } from 'node:child_process';
import {
    existsSync,
    mkdtempSync,
    readFileSync,
    rmSync,
    writeFileSync,
} from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import AdmZip from 'adm-zip';
import { expect, test } from 'vitest';

import {
    AMO_REVIEW_SECTION_HEADING,
    AMO_REVIEW_TOC_ANCHOR,
    APPROVAL_NOTES,
} from './amo-review';
import { isGitWorkTree, writeSourceArchive } from './source-archive-plugin';

/**
 * Runs git with a deterministic identity inside a directory.
 *
 * @param cwd Repository directory.
 * @param args Git arguments.
 */
const git = (cwd: string, args: string[]): void => {
    execFileSync('git', [
        '-c', 'user.name=Test',
        '-c', 'user.email=test@example.com',
        '-c', 'commit.gpgsign=false',
        ...args,
    ], { cwd, stdio: 'ignore' });
};

/**
 * Creates a scratch git repository with a committed README.
 *
 * @returns Repository root path.
 */
const createRepo = (): string => {
    const root = mkdtempSync(path.join(os.tmpdir(), 'kode-injector-source-'));

    git(root, ['init', '--initial-branch=main']);
    writeFileSync(path.join(root, 'README.md'), [
        '# Fixture',
        '',
        '- [Installation](#installation)',
        AMO_REVIEW_TOC_ANCHOR,
        '',
    ].join('\n'));
    writeFileSync(path.join(root, 'tracked.txt'), 'tracked');
    git(root, ['add', 'README.md', 'tracked.txt']);
    git(root, ['commit', '-m', 'init']);

    return root;
};

test('writeSourceArchive packages HEAD with reviewer README and notes', () => {
    const root = createRepo();
    const archivePath = path.join(root, 'source.zip');
    const notesPath = path.join(root, 'approval-notes.txt');

    writeFileSync(path.join(root, 'untracked.txt'), 'untracked');

    writeSourceArchive(root, archivePath, notesPath, 'kode-injector-1.2.3');

    const zip = new AdmZip(archivePath);
    const entries = zip.getEntries().map((entry) => entry.entryName);

    expect(entries).toContain('kode-injector-1.2.3/tracked.txt');
    expect(entries.some((entry) => entry.includes('untracked.txt'))).toBe(false);
    expect(entries.every((entry) => entry.startsWith('kode-injector-1.2.3/'))).toBe(true);

    const readme = zip.readAsText('kode-injector-1.2.3/README.md');

    expect(readme).toContain(AMO_REVIEW_SECTION_HEADING);
    expect(readme).not.toContain(AMO_REVIEW_TOC_ANCHOR);

    expect(readFileSync(notesPath, 'utf8')).toBe(APPROVAL_NOTES);

    rmSync(root, { recursive: true, force: true });
});

test('writeSourceArchive rejects a README without the anchor', () => {
    const root = createRepo();

    writeFileSync(path.join(root, 'README.md'), '# No anchor\n');
    git(root, ['add', 'README.md']);
    git(root, ['commit', '-m', 'drop anchor']);

    expect(() => writeSourceArchive(
        root,
        path.join(root, 'source.zip'),
        path.join(root, 'approval-notes.txt'),
        'kode-injector-1.2.3',
    )).toThrow(/TOC:AMO_REVIEW/);

    rmSync(root, { recursive: true, force: true });
});

test('isGitWorkTree distinguishes git checkouts from plain directories', () => {
    const plain = mkdtempSync(path.join(os.tmpdir(), 'kode-injector-plain-'));
    const repo = createRepo();

    expect(isGitWorkTree(plain)).toBe(false);
    expect(isGitWorkTree(repo)).toBe(true);
    expect(existsSync(path.join(plain, 'source.zip'))).toBe(false);

    rmSync(plain, { recursive: true, force: true });
    rmSync(repo, { recursive: true, force: true });
});
