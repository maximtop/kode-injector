/**
 * @file
 */

import path from 'node:path';
import type { Compiler } from '@rspack/core';
import AdmZip from 'adm-zip';

/**
 * Writes a ZIP containing files relative to an extension output directory.
 *
 * @param outputPath Extension output directory.
 * @param archivePath Destination ZIP path.
 */
export const writeArchive = (outputPath: string, archivePath: string): void => {
    const archive = new AdmZip();

    archive.addLocalFolder(outputPath);
    archive.writeZip(archivePath);
};

/**
 * Creates the production release archive after Rspack emits all assets.
 */
export class ArchivePlugin {
    /**
     * Extension output directory.
     */
    outputPath: string;

    /**
     * Destination ZIP path.
     */
    archivePath: string;

    /**
     * Creates an archive plugin.
     *
     * @param outputPath Extension output directory.
     * @param archivePath Destination ZIP path.
     */
    constructor(outputPath: string, archivePath: string) {
        this.outputPath = outputPath;
        this.archivePath = archivePath;
    }

    /**
     * Registers archive creation after emit.
     *
     * @param compiler Rspack compiler.
     */
    apply(compiler: Compiler): void {
        compiler.hooks.afterEmit.tap('ArchivePlugin', () => {
            writeArchive(this.outputPath, path.resolve(this.archivePath));
        });
    }
}
