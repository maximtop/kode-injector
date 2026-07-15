/**
 * @file Builds deterministic native-host release packages.
 */

/* eslint-disable jsdoc/require-jsdoc, no-restricted-syntax, no-await-in-loop */
/* eslint-disable import/no-extraneous-dependencies */

import crypto from 'node:crypto';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { pathToFileURL } from 'node:url';
import AdmZip from 'adm-zip';

export enum NativeOS {
    Darwin = 'darwin',
    Linux = 'linux',
    Windows = 'windows',
}

export enum NativeArch {
    Amd64 = 'amd64',
    Arm64 = 'arm64',
}

export interface NativeTarget {
    os: NativeOS;
    arch: NativeArch;
}

export const NATIVE_TARGETS: NativeTarget[] = [
    { os: NativeOS.Darwin, arch: NativeArch.Amd64 },
    { os: NativeOS.Darwin, arch: NativeArch.Arm64 },
    { os: NativeOS.Linux, arch: NativeArch.Amd64 },
    { os: NativeOS.Linux, arch: NativeArch.Arm64 },
    { os: NativeOS.Windows, arch: NativeArch.Amd64 },
    { os: NativeOS.Windows, arch: NativeArch.Arm64 },
];

export const PRODUCTION_CHROME_EXTENSION_ID = 'fgdehkdkmaiedleekbjpfoicpmodbicg';
const VALIDATION_EDGE_ID = 'bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb';
const CHROMIUM_ID_PATTERN = /^[a-p]{32}$/u;
const HOST_COMMAND = './cmd/kode-injector-native';
const INSTALLER_COMMAND = './cmd/kode-injector-installer';

const getNativeArtifactExtension = (targetOS: NativeOS): string => {
    switch (targetOS) {
        case NativeOS.Darwin:
            return 'dmg';
        case NativeOS.Linux:
            return 'tar.gz';
        case NativeOS.Windows:
            return 'zip';
        default:
            throw new Error(`Unsupported native target OS: ${targetOS}`);
    }
};

const getNativeArtifactName = (version: string, target: NativeTarget): string => {
    const extension = getNativeArtifactExtension(target.os);
    return `kode-injector-native-${version}-${target.os}-${target.arch}.${extension}`;
};

export const getNativeArtifactNames = (version: string): string[] => {
    return NATIVE_TARGETS.map((target) => getNativeArtifactName(version, target));
};

export const getInstallerLdflags = (edgeID?: string): string => {
    if (edgeID && !CHROMIUM_ID_PATTERN.test(edgeID)) {
        throw new Error(
            'KODE_INJECTOR_EDGE_ID must be empty or a 32-letter Edge Add-ons ID',
        );
    }
    const flags = [
        '-s',
        '-w',
        `-X=main.defaultChromeID=${PRODUCTION_CHROME_EXTENSION_ID}`,
    ];
    if (edgeID) {
        flags.push(`-X=main.defaultEdgeID=${edgeID}`);
    }
    return flags.join(' ');
};

const readVersion = (rootPath: string): string => {
    const packageJson = JSON.parse(
        fs.readFileSync(path.join(rootPath, 'package.json'), 'utf8'),
    ) as { version: string };
    return packageJson.version;
};

const run = (command: string, args: string[], cwd: string, env?: NodeJS.ProcessEnv): void => {
    execFileSync(command, args, {
        cwd,
        env: { ...process.env, ...env },
        stdio: 'inherit',
    });
};

const buildBinary = (
    nativeRoot: string,
    target: NativeTarget,
    command: string,
    destination: string,
    ldflags: string,
): void => {
    run('go', ['build', '-trimpath', '-ldflags', ldflags, '-o', destination, command], nativeRoot, {
        CGO_ENABLED: '0',
        GOOS: target.os,
        GOARCH: target.arch,
    });
};

const createChecksums = (outputPath: string, artifactNames: string[]): void => {
    const lines = artifactNames.sort().map((name) => {
        const data = fs.readFileSync(path.join(outputPath, name));
        return `${crypto.createHash('sha256').update(data).digest('hex')}  ${name}`;
    });
    fs.writeFileSync(path.join(outputPath, 'SHA256SUMS'), `${lines.join('\n')}\n`);
};

export const packageNativeHost = (
    rootPath = process.cwd(),
    validation = false,
): string => {
    const version = readVersion(rootPath);
    const edgeID = validation ? VALIDATION_EDGE_ID : process.env.KODE_INJECTOR_EDGE_ID;
    const nativeRoot = path.join(rootPath, 'native-host');
    const outputPath = path.join(rootPath, 'build', 'native', version);
    const workPath = fs.mkdtempSync(path.join(os.tmpdir(), 'kode-injector-native-'));
    fs.rmSync(outputPath, { recursive: true, force: true });
    fs.mkdirSync(outputPath, { recursive: true });
    const installerFlags = getInstallerLdflags(edgeID);
    const hostFlags = `-s -w -X=main.hostVersion=${version}`;

    try {
        for (const target of NATIVE_TARGETS) {
            const suffix = target.os === NativeOS.Windows ? '.exe' : '';
            const targetPath = path.join(workPath, `${target.os}-${target.arch}`);
            fs.mkdirSync(targetPath, { recursive: true });
            buildBinary(
                nativeRoot,
                target,
                HOST_COMMAND,
                path.join(targetPath, `kode-injector-native${suffix}`),
                hostFlags,
            );
            buildBinary(
                nativeRoot,
                target,
                INSTALLER_COMMAND,
                path.join(targetPath, `kode-injector-installer${suffix}`),
                installerFlags,
            );
            fs.copyFileSync(
                path.join(nativeRoot, 'packaging', 'README.txt'),
                path.join(targetPath, 'README.txt'),
            );
        }

        for (const target of NATIVE_TARGETS) {
            const targetPath = path.join(workPath, `${target.os}-${target.arch}`);
            const artifactPath = path.join(
                outputPath,
                getNativeArtifactName(version, target),
            );
            switch (target.os) {
                case NativeOS.Darwin:
                    run('hdiutil', [
                        'create', '-quiet', '-ov', '-format', 'UDZO',
                        '-srcfolder', targetPath,
                        artifactPath,
                    ], rootPath);
                    break;
                case NativeOS.Linux:
                    run('tar', [
                        '-czf', artifactPath, '-C', targetPath, '.',
                    ], rootPath);
                    break;
                case NativeOS.Windows: {
                    const archive = new AdmZip();
                    archive.addLocalFolder(targetPath);
                    archive.writeZip(artifactPath);
                    break;
                }
                default:
                    throw new Error(`Unsupported native target OS: ${target.os}`);
            }
        }
        createChecksums(outputPath, getNativeArtifactNames(version));
        return outputPath;
    } finally {
        fs.rmSync(workPath, { recursive: true, force: true });
    }
};

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
    const validation = process.argv.includes('--validation');
    process.stdout.write(`${packageNativeHost(process.cwd(), validation)}\n`);
}
