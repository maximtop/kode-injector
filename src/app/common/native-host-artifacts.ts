/**
 * @file Authoritative published Kode Injector Helper artifact catalog.
 */

/* eslint-disable jsdoc/require-jsdoc */

export enum RuntimeOS {
    Mac = 'mac',
    Windows = 'win',
    Linux = 'linux',
}

export enum RuntimeArchitecture {
    Amd64 = 'x86-64',
    Arm64 = 'arm64',
}

export enum NativeHostPackageTarget {
    MacOSIntel = 'macosIntel',
    MacOSAppleSilicon = 'macosAppleSilicon',
    WindowsArm64 = 'windowsArm64',
    WindowsX8664 = 'windowsX86_64',
    LinuxArm64 = 'linuxArm64',
    LinuxX8664 = 'linuxX86_64',
}

export interface NativeHostPublishedAsset {
    target: NativeHostPackageTarget;
    runtimeOS: RuntimeOS;
    runtimeArchitecture: RuntimeArchitecture;
    name: string;
}

export const NATIVE_HOST_PUBLISHED_ASSETS: readonly NativeHostPublishedAsset[] = [
    {
        target: NativeHostPackageTarget.MacOSIntel,
        runtimeOS: RuntimeOS.Mac,
        runtimeArchitecture: RuntimeArchitecture.Amd64,
        name: 'kode-injector-helper-macos-intel.dmg',
    },
    {
        target: NativeHostPackageTarget.MacOSAppleSilicon,
        runtimeOS: RuntimeOS.Mac,
        runtimeArchitecture: RuntimeArchitecture.Arm64,
        name: 'kode-injector-helper-macos-apple-silicon.dmg',
    },
    {
        target: NativeHostPackageTarget.WindowsArm64,
        runtimeOS: RuntimeOS.Windows,
        runtimeArchitecture: RuntimeArchitecture.Arm64,
        name: 'kode-injector-native-windows-arm64.zip',
    },
    {
        target: NativeHostPackageTarget.WindowsX8664,
        runtimeOS: RuntimeOS.Windows,
        runtimeArchitecture: RuntimeArchitecture.Amd64,
        name: 'kode-injector-native-windows-x86-64.zip',
    },
    {
        target: NativeHostPackageTarget.LinuxArm64,
        runtimeOS: RuntimeOS.Linux,
        runtimeArchitecture: RuntimeArchitecture.Arm64,
        name: 'kode-injector-native-linux-arm64.tar.gz',
    },
    {
        target: NativeHostPackageTarget.LinuxX8664,
        runtimeOS: RuntimeOS.Linux,
        runtimeArchitecture: RuntimeArchitecture.Amd64,
        name: 'kode-injector-native-linux-x86-64.tar.gz',
    },
];

export const findNativeHostPublishedAsset = (
    runtimeOS: string,
    runtimeArchitecture: string,
): NativeHostPublishedAsset | undefined => {
    return NATIVE_HOST_PUBLISHED_ASSETS.find((asset) => {
        return asset.runtimeOS === runtimeOS
            && asset.runtimeArchitecture === runtimeArchitecture;
    });
};

export const getNativeHostPublishedAsset = (
    target: NativeHostPackageTarget,
): NativeHostPublishedAsset => {
    const asset = NATIVE_HOST_PUBLISHED_ASSETS.find((candidate) => {
        return candidate.target === target;
    });
    if (!asset) {
        throw new Error(`Unsupported Kode Injector Helper target: ${target}`);
    }
    return asset;
};
