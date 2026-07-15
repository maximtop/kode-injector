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
import {
    getNativeHostPublishedAsset,
    NativeHostPackageTarget,
} from '../../src/app/common/native-host-artifacts';

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
    assetName: string;
    swiftTriple?: string;
}

export const NATIVE_TARGETS: NativeTarget[] = [
    {
        os: NativeOS.Darwin,
        arch: NativeArch.Amd64,
        assetName: getNativeHostPublishedAsset(
            NativeHostPackageTarget.MacOSIntel,
        ).name,
        swiftTriple: 'x86_64-apple-macosx12.0',
    },
    {
        os: NativeOS.Darwin,
        arch: NativeArch.Arm64,
        assetName: getNativeHostPublishedAsset(
            NativeHostPackageTarget.MacOSAppleSilicon,
        ).name,
        swiftTriple: 'arm64-apple-macosx12.0',
    },
    {
        os: NativeOS.Linux,
        arch: NativeArch.Amd64,
        assetName: getNativeHostPublishedAsset(
            NativeHostPackageTarget.LinuxX8664,
        ).name,
    },
    {
        os: NativeOS.Linux,
        arch: NativeArch.Arm64,
        assetName: getNativeHostPublishedAsset(
            NativeHostPackageTarget.LinuxArm64,
        ).name,
    },
    {
        os: NativeOS.Windows,
        arch: NativeArch.Amd64,
        assetName: getNativeHostPublishedAsset(
            NativeHostPackageTarget.WindowsX8664,
        ).name,
    },
    {
        os: NativeOS.Windows,
        arch: NativeArch.Arm64,
        assetName: getNativeHostPublishedAsset(
            NativeHostPackageTarget.WindowsArm64,
        ).name,
    },
];

export const PRODUCTION_CHROME_EXTENSION_ID = 'fgdehkdkmaiedleekbjpfoicpmodbicg';
export const MAC_APPLICATION_NAME = 'Kode Injector Helper';
export const MAC_MAIN_EXECUTABLE_NAME = MAC_APPLICATION_NAME;
export const MAC_BUNDLE_IDENTIFIER = 'dev.maximtop.kode-injector.helper';

const MAC_ICON_FILE_NAME = 'AppIcon.icns';
const MAC_ICON_PLIST_VALUE = 'AppIcon';
const MAC_MINIMUM_SYSTEM_VERSION = '12.0';
const MAC_APPLICATION_CATEGORY = 'public.app-category.developer-tools';
const MAC_HELPER_PRODUCT_NAME = 'KodeInjectorHelper';
const MAC_HOST_EXECUTABLE_NAME = 'kode-injector-native';
const MAC_INSTALLER_EXECUTABLE_NAME = 'kode-injector-installer';
const APPLICATIONS_LINK_NAME = 'Applications';
const APPLICATIONS_PATH = '/Applications';
const VALIDATION_EDGE_ID = 'bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb';
const CHROMIUM_ID_PATTERN = /^[a-p]{32}$/u;
const HOST_COMMAND = './cmd/kode-injector-native';
const INSTALLER_COMMAND = './cmd/kode-injector-installer';

export interface MacApplicationSources {
    mainExecutable: string;
    hostExecutable: string;
    installerExecutable: string;
    infoPlistTemplate: string;
    icon: string;
}

export const getNativeArtifactNames = (nativeOS?: NativeOS): string[] => {
    return NATIVE_TARGETS
        .filter((target) => nativeOS === undefined || target.os === nativeOS)
        .map((target) => target.assetName);
};

export const getInstallerLdflags = (
    edgeID?: string,
    packageVersion?: string,
): string => {
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
    if (packageVersion) {
        flags.push(`-X=main.defaultPackageVersion=${packageVersion}`);
    }
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

const runAndCapture = (
    command: string,
    args: string[],
    cwd: string,
    env?: NodeJS.ProcessEnv,
): string => {
    return execFileSync(command, args, {
        cwd,
        encoding: 'utf8',
        env: { ...process.env, ...env },
    }).trim();
};

const renderPlistVersion = (template: string, version: string): string => {
    const versionKeys = ['CFBundleShortVersionString', 'CFBundleVersion'];
    return versionKeys.reduce((plist, key) => {
        const expression = new RegExp(
            `(<key>${key}</key>\\s*<string>)[^<]*(</string>)`,
            'u',
        );
        if (!expression.test(plist)) {
            throw new Error(`Info.plist template is missing ${key}`);
        }
        return plist.replace(expression, (_match, prefix: string, suffix: string) => {
            return `${prefix}${version}${suffix}`;
        });
    }, template);
};

const copyExecutable = (source: string, destination: string): void => {
    fs.copyFileSync(source, destination);
    fs.chmodSync(destination, 0o755);
};

export const assembleMacApplication = (
    stagePath: string,
    sources: MacApplicationSources,
    version: string,
): string => {
    const appPath = path.join(stagePath, `${MAC_APPLICATION_NAME}.app`);
    const contentsPath = path.join(appPath, 'Contents');
    const macOSPath = path.join(contentsPath, 'MacOS');
    const helpersPath = path.join(contentsPath, 'Helpers');
    const resourcesPath = path.join(contentsPath, 'Resources');

    fs.rmSync(stagePath, { recursive: true, force: true });
    fs.mkdirSync(macOSPath, { recursive: true });
    fs.mkdirSync(helpersPath, { recursive: true });
    fs.mkdirSync(resourcesPath, { recursive: true });

    copyExecutable(
        sources.mainExecutable,
        path.join(macOSPath, MAC_MAIN_EXECUTABLE_NAME),
    );
    copyExecutable(
        sources.hostExecutable,
        path.join(helpersPath, MAC_HOST_EXECUTABLE_NAME),
    );
    copyExecutable(
        sources.installerExecutable,
        path.join(helpersPath, MAC_INSTALLER_EXECUTABLE_NAME),
    );
    const infoPlist = renderPlistVersion(
        fs.readFileSync(sources.infoPlistTemplate, 'utf8'),
        version,
    );
    fs.writeFileSync(path.join(contentsPath, 'Info.plist'), infoPlist);
    fs.copyFileSync(sources.icon, path.join(resourcesPath, MAC_ICON_FILE_NAME));
    fs.symlinkSync(
        APPLICATIONS_PATH,
        path.join(stagePath, APPLICATIONS_LINK_NAME),
    );

    return appPath;
};

const buildSwiftExecutable = (
    rootPath: string,
    target: NativeTarget,
): string => {
    if (!target.swiftTriple) {
        throw new Error(`Swift triple is missing for ${target.os}-${target.arch}`);
    }
    const packagePath = path.join(rootPath, 'native-host', 'macos-helper');
    const buildArguments = [
        'build',
        '--package-path', packagePath,
        '--configuration', 'release',
        '--triple', target.swiftTriple,
    ];
    run('swift', buildArguments, rootPath);
    const binaryPath = runAndCapture(
        'swift',
        [...buildArguments, '--show-bin-path'],
        rootPath,
    );
    return path.join(binaryPath, MAC_HELPER_PRODUCT_NAME);
};

const assertDirectoryEntries = (
    directoryPath: string,
    expectedEntries: string[],
): void => {
    const entries = fs.readdirSync(directoryPath)
        .filter((entry) => !entry.startsWith('.'))
        .sort();
    const expected = [...expectedEntries].sort();
    if (JSON.stringify(entries) !== JSON.stringify(expected)) {
        throw new Error(
            `${directoryPath} contains ${entries.join(', ')}, expected ${expected.join(', ')}`,
        );
    }
};

const readPlistValue = (
    rootPath: string,
    infoPlistPath: string,
    key: string,
): string => {
    return runAndCapture(
        'plutil',
        ['-extract', key, 'raw', '-o', '-', infoPlistPath],
        rootPath,
    );
};

const validatePlistValue = (
    rootPath: string,
    infoPlistPath: string,
    key: string,
    expected: string,
): void => {
    const actual = readPlistValue(rootPath, infoPlistPath, key);
    if (actual !== expected) {
        throw new Error(`Info.plist ${key} is ${actual}, expected ${expected}`);
    }
};

const expectedMachArchitecture = (arch: NativeArch): string => {
    switch (arch) {
        case NativeArch.Amd64:
            return 'x86_64';
        case NativeArch.Arm64:
            return 'arm64';
        default:
            throw new Error(`Unsupported native architecture: ${arch}`);
    }
};

const validateExecutableArchitecture = (
    rootPath: string,
    executablePath: string,
    expectedArchitecture: string,
): void => {
    const architectures = runAndCapture(
        'lipo',
        ['-archs', executablePath],
        rootPath,
    ).split(/\s+/u);
    if (architectures.length !== 1 || architectures[0] !== expectedArchitecture) {
        throw new Error(
            `${executablePath} has ${architectures.join(', ')}, expected only ${expectedArchitecture}`,
        );
    }
};

const validateMacApplication = (
    rootPath: string,
    stagePath: string,
    target: NativeTarget,
    version: string,
): void => {
    assertDirectoryEntries(stagePath, [
        APPLICATIONS_LINK_NAME,
        `${MAC_APPLICATION_NAME}.app`,
    ]);
    const applicationsLink = path.join(stagePath, APPLICATIONS_LINK_NAME);
    if (!fs.lstatSync(applicationsLink).isSymbolicLink()
        || fs.readlinkSync(applicationsLink) !== APPLICATIONS_PATH) {
        throw new Error('macOS package Applications entry must link to /Applications');
    }

    const appPath = path.join(stagePath, `${MAC_APPLICATION_NAME}.app`);
    const contentsPath = path.join(appPath, 'Contents');
    const infoPlistPath = path.join(contentsPath, 'Info.plist');
    const mainExecutablePath = path.join(
        contentsPath,
        'MacOS',
        MAC_MAIN_EXECUTABLE_NAME,
    );
    const hostExecutablePath = path.join(
        contentsPath,
        'Helpers',
        MAC_HOST_EXECUTABLE_NAME,
    );
    const installerExecutablePath = path.join(
        contentsPath,
        'Helpers',
        MAC_INSTALLER_EXECUTABLE_NAME,
    );
    assertDirectoryEntries(path.join(contentsPath, 'MacOS'), [
        MAC_MAIN_EXECUTABLE_NAME,
    ]);
    assertDirectoryEntries(path.join(contentsPath, 'Helpers'), [
        MAC_HOST_EXECUTABLE_NAME,
        MAC_INSTALLER_EXECUTABLE_NAME,
    ]);
    assertDirectoryEntries(path.join(contentsPath, 'Resources'), [
        MAC_ICON_FILE_NAME,
    ]);

    run('plutil', ['-lint', infoPlistPath], rootPath);
    if (fs.readFileSync(infoPlistPath, 'utf8').includes('<key>LSUIElement</key>')) {
        throw new Error('Info.plist must not hide Kode Injector Helper from the Dock');
    }
    for (const [key, expected] of Object.entries({
        CFBundleIdentifier: MAC_BUNDLE_IDENTIFIER,
        CFBundleName: MAC_APPLICATION_NAME,
        CFBundleDisplayName: MAC_APPLICATION_NAME,
        CFBundleExecutable: MAC_MAIN_EXECUTABLE_NAME,
        CFBundlePackageType: 'APPL',
        CFBundleIconFile: MAC_ICON_PLIST_VALUE,
        CFBundleShortVersionString: version,
        CFBundleVersion: version,
        LSMinimumSystemVersion: MAC_MINIMUM_SYSTEM_VERSION,
        LSApplicationCategoryType: MAC_APPLICATION_CATEGORY,
    })) {
        validatePlistValue(rootPath, infoPlistPath, key, expected);
    }

    const architecture = expectedMachArchitecture(target.arch);
    for (const executablePath of [
        mainExecutablePath,
        hostExecutablePath,
        installerExecutablePath,
    ]) {
        validateExecutableArchitecture(rootPath, executablePath, architecture);
    }
};

const validateMacDiskImage = (
    rootPath: string,
    artifactPath: string,
    target: NativeTarget,
    version: string,
): void => {
    const mountPath = fs.mkdtempSync(
        path.join(os.tmpdir(), 'kode-injector-dmg-validation-'),
    );
    let attached = false;
    try {
        run('hdiutil', [
            'attach', '-quiet', '-nobrowse', '-readonly',
            '-mountpoint', mountPath,
            artifactPath,
        ], rootPath);
        attached = true;
        validateMacApplication(rootPath, mountPath, target, version);
    } finally {
        try {
            if (attached) {
                run('hdiutil', ['detach', '-quiet', mountPath], rootPath);
            }
        } finally {
            fs.rmSync(mountPath, { recursive: true, force: true });
        }
    }
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
    const installerFlags = getInstallerLdflags(edgeID, version);
    const hostFlags = `-s -w -X=main.hostVersion=${version}`;

    try {
        for (const target of NATIVE_TARGETS) {
            const suffix = target.os === NativeOS.Windows ? '.exe' : '';
            const targetName = `${target.os}-${target.arch}`;
            const binaryPath = path.join(workPath, 'binaries', targetName);
            const stagePath = path.join(workPath, 'stages', targetName);
            fs.mkdirSync(binaryPath, { recursive: true });
            buildBinary(
                nativeRoot,
                target,
                HOST_COMMAND,
                path.join(binaryPath, `${MAC_HOST_EXECUTABLE_NAME}${suffix}`),
                hostFlags,
            );
            buildBinary(
                nativeRoot,
                target,
                INSTALLER_COMMAND,
                path.join(binaryPath, `${MAC_INSTALLER_EXECUTABLE_NAME}${suffix}`),
                installerFlags,
            );

            if (target.os === NativeOS.Darwin) {
                const mainExecutable = buildSwiftExecutable(rootPath, target);
                assembleMacApplication(stagePath, {
                    mainExecutable,
                    hostExecutable: path.join(binaryPath, MAC_HOST_EXECUTABLE_NAME),
                    installerExecutable: path.join(
                        binaryPath,
                        MAC_INSTALLER_EXECUTABLE_NAME,
                    ),
                    infoPlistTemplate: path.join(
                        nativeRoot,
                        'macos-helper',
                        'Info.plist',
                    ),
                    icon: path.join(nativeRoot, 'macos-helper', MAC_ICON_FILE_NAME),
                }, version);
                if (validation) {
                    validateMacApplication(rootPath, stagePath, target, version);
                }
            } else {
                fs.mkdirSync(stagePath, { recursive: true });
                copyExecutable(
                    path.join(binaryPath, `${MAC_HOST_EXECUTABLE_NAME}${suffix}`),
                    path.join(stagePath, `${MAC_HOST_EXECUTABLE_NAME}${suffix}`),
                );
                copyExecutable(
                    path.join(binaryPath, `${MAC_INSTALLER_EXECUTABLE_NAME}${suffix}`),
                    path.join(stagePath, `${MAC_INSTALLER_EXECUTABLE_NAME}${suffix}`),
                );
                fs.copyFileSync(
                    path.join(nativeRoot, 'packaging', 'README.txt'),
                    path.join(stagePath, 'README.txt'),
                );
            }
        }

        for (const target of NATIVE_TARGETS) {
            const targetName = `${target.os}-${target.arch}`;
            const stagePath = path.join(workPath, 'stages', targetName);
            const artifactPath = path.join(outputPath, target.assetName);
            switch (target.os) {
                case NativeOS.Darwin:
                    run('hdiutil', [
                        'create', '-quiet', '-ov', '-format', 'UDZO',
                        '-volname', MAC_APPLICATION_NAME,
                        '-srcfolder', stagePath,
                        artifactPath,
                    ], rootPath);
                    if (validation) {
                        validateMacDiskImage(rootPath, artifactPath, target, version);
                    }
                    break;
                case NativeOS.Linux:
                    run('tar', [
                        '-czf', artifactPath, '-C', stagePath, '.',
                    ], rootPath);
                    break;
                case NativeOS.Windows: {
                    const archive = new AdmZip();
                    archive.addLocalFolder(stagePath);
                    archive.writeZip(artifactPath);
                    break;
                }
                default:
                    throw new Error(`Unsupported native target OS: ${target.os}`);
            }
        }
        createChecksums(outputPath, getNativeArtifactNames());
        return outputPath;
    } finally {
        fs.rmSync(workPath, { recursive: true, force: true });
    }
};

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
    if (process.argv.includes('--list-artifacts')) {
        process.stdout.write(`${getNativeArtifactNames().join('\n')}\n`);
    } else if (process.argv.includes('--list-macos-artifacts')) {
        process.stdout.write(`${getNativeArtifactNames(NativeOS.Darwin).join('\n')}\n`);
    } else {
        const validation = process.argv.includes('--validation');
        process.stdout.write(`${packageNativeHost(process.cwd(), validation)}\n`);
    }
}
