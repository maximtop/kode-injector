/**
 * @file
 */

/* eslint-disable import/no-extraneous-dependencies */
import {
    mkdtempSync,
    mkdirSync,
    readFileSync,
    rmSync,
    writeFileSync,
} from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import AdmZip from 'adm-zip';
import { expect, test } from 'vitest';

import { writeArchive } from './archive-plugin';

test('writeArchive packages output contents without the parent directory', () => {
    const root = mkdtempSync(path.join(os.tmpdir(), 'kode-injector-'));
    const outputPath = path.join(root, 'prod');
    const archivePath = path.join(root, 'extension.zip');

    mkdirSync(path.join(outputPath, 'assets'), { recursive: true });
    writeFileSync(path.join(outputPath, 'manifest.json'), '{"manifest_version":3}');
    writeFileSync(path.join(outputPath, 'assets/icon.txt'), 'icon');

    writeArchive(outputPath, archivePath);

    const archive = new AdmZip(archivePath);
    const entries = archive.getEntries().map((entry) => entry.entryName);

    expect(entries).toContain('manifest.json');
    expect(entries).toContain('assets/icon.txt');
    expect(entries.some((entry) => entry.startsWith('prod/'))).toBe(false);
    expect(readFileSync(archivePath).length).toBeGreaterThan(0);
    rmSync(root, { recursive: true, force: true });
});
