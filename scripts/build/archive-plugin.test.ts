/**
 * @file
 */

/* eslint-disable import/no-extraneous-dependencies */
import assert from 'node:assert/strict';
import {
    mkdtempSync,
    mkdirSync,
    readFileSync,
    rmSync,
    writeFileSync,
} from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';
import AdmZip from 'adm-zip';

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

    assert.equal(entries.includes('manifest.json'), true);
    assert.equal(entries.includes('assets/icon.txt'), true);
    assert.equal(entries.some((entry) => entry.startsWith('prod/')), false);
    assert.equal(readFileSync(archivePath).length > 0, true);
    rmSync(root, { recursive: true, force: true });
});
