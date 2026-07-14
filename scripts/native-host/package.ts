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

export interface NativeTarget {
    os: 'darwin' | 'linux' | 'windows';
    arch: 'amd64' | 'arm64';
}

export const NATIVE_TARGETS: NativeTarget[] = [
    { os: 'darwin', arch: 'amd64' },
    { os: 'darwin', arch: 'arm64' },
    { os: 'linux', arch: 'amd64' },
    { os: 'linux', arch: 'arm64' },
    { os: 'windows', arch: 'amd64' },
    { os: 'windows', arch: 'arm64' },
];

const CHROME_EXTENSION_ID = 'cikgoagbggecambahlmphhdgmahgeepl';
const VALIDATION_EDGE_ID = 'bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb';
const CHROMIUM_ID_PATTERN = /^[a-p]{32}$/u;
const HOST_COMMAND = './cmd/kode-injector-native';
const INSTALLER_COMMAND = './cmd/kode-injector-installer';

export const getNativeArtifactNames = (version: string): string[] => [
    `kode-injector-native-${version}-darwin-universal.dmg`,
    `kode-injector-native-${version}-linux-amd64.tar.gz`,
    `kode-injector-native-${version}-linux-arm64.tar.gz`,
    `kode-injector-native-${version}-windows-amd64.zip`,
    `kode-injector-native-${version}-windows-arm64.zip`,
];

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
    if (!edgeID || !CHROMIUM_ID_PATTERN.test(edgeID)) {
        throw new Error('KODE_INJECTOR_EDGE_ID must be the 32-letter Edge Add-ons ID');
    }
    const nativeRoot = path.join(rootPath, 'native-host');
    const outputPath = path.join(rootPath, 'build', 'native', version);
    const workPath = fs.mkdtempSync(path.join(os.tmpdir(), 'kode-injector-native-'));
    fs.rmSync(outputPath, { recursive: true, force: true });
    fs.mkdirSync(outputPath, { recursive: true });
    const installerFlags = [
        '-s',
        '-w',
        `-X=main.defaultChromeID=${CHROME_EXTENSION_ID}`,
        `-X=main.defaultEdgeID=${edgeID}`,
    ].join(' ');
    const hostFlags = `-s -w -X=main.hostVersion=${version}`;

    try {
        for (const target of NATIVE_TARGETS) {
            const suffix = target.os === 'windows' ? '.exe' : '';
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

        const darwinStage = path.join(workPath, 'darwin-universal');
        fs.mkdirSync(darwinStage);
        for (const name of ['kode-injector-native', 'kode-injector-installer']) {
            run('lipo', [
                '-create',
                path.join(workPath, 'darwin-amd64', name),
                path.join(workPath, 'darwin-arm64', name),
                '-output',
                path.join(darwinStage, name),
            ], rootPath);
        }
        fs.copyFileSync(
            path.join(nativeRoot, 'packaging', 'README.txt'),
            path.join(darwinStage, 'README.txt'),
        );
        run('hdiutil', [
            'create', '-quiet', '-ov', '-format', 'UDZO',
            '-srcfolder', darwinStage,
            path.join(outputPath, getNativeArtifactNames(version)[0]),
        ], rootPath);

        for (const target of NATIVE_TARGETS.filter(({ os: targetOS }) => targetOS === 'linux')) {
            const artifact = `kode-injector-native-${version}-linux-${target.arch}.tar.gz`;
            run('tar', ['-czf', path.join(outputPath, artifact), '-C', path.join(workPath, `linux-${target.arch}`), '.'], rootPath);
        }
        for (const target of NATIVE_TARGETS.filter(({ os: targetOS }) => targetOS === 'windows')) {
            const artifact = `kode-injector-native-${version}-windows-${target.arch}.zip`;
            const archive = new AdmZip();
            archive.addLocalFolder(path.join(workPath, `windows-${target.arch}`));
            archive.writeZip(path.join(outputPath, artifact));
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
