/**
 * @file Readiness state for the active local-source access method.
 */

import { getBrowserCapabilities } from '../common/browser-capabilities';
import { getCurrentBrowserTarget } from '../common/browser-target';
import { LocalSourceAccessMethod } from '../common/contracts';
import { log } from '../common/log';
import {
    isCompatibleHost,
    type NativeHostInfo,
    NativeHostStatus,
} from '../common/native-host-protocol';
import { nativeMessagingPermission } from '../common/native-messaging-permission';

import { fileAccess } from './file-access';
import { nativeHostClient } from './native-host';
import { settings } from './settings';

import type {
    LocalSourceAccessState,
    NativeHostAccessState,
    NativeHostState,
} from '../common/contracts';

/**
 * Native-host operations needed to probe readiness.
 */
interface NativeHostProbe {
    ping(): Promise<NativeHostInfo>;
    disconnect(): void;
}

/**
 * Browser file URL access check.
 */
interface BrowserFileAccessProbe {
    isAllowed(): Promise<boolean>;
}

/**
 * Native messaging permission check.
 */
interface NativeMessagingPermissionProbe {
    contains(): Promise<boolean>;
}

/**
 * Reads the currently selected local-source access method.
 *
 * @returns Currently selected access method.
 */
type GetLocalSourceAccessMethod = () => LocalSourceAccessMethod;

/**
 * Maps a native-host probe failure to a reported status.
 *
 * @param errorMessage Message of the error raised by the probe.
 *
 * @returns Status describing the failure.
 */
const getFailureStatus = (errorMessage: string): NativeHostStatus => {
    if (errorMessage === 'UNSUPPORTED_PROTOCOL') {
        return NativeHostStatus.UpdateRequired;
    }
    if (errorMessage === 'NATIVE_DISCONNECTED') {
        return NativeHostStatus.Disconnected;
    }
    return NativeHostStatus.NotInstalled;
};

/**
 * Tracks and refreshes the readiness of the active local-source access method.
 */
export class LocalSourceAccess {
    private state: NativeHostAccessState = {
        kind: LocalSourceAccessMethod.NativeHost,
        permissionGranted: true,
        host: { status: NativeHostStatus.Checking },
    };

    private stateRevision = 0;

    /**
     * Creates a local-source access tracker.
     *
     * @param client Native-host probe used to check readiness.
     * @param browserFileAccess Browser file URL access check.
     * @param nativePermission Native messaging permission check.
     * @param getMethod Reads the currently selected access method.
     */
    public constructor(
        private readonly client: NativeHostProbe,
        private readonly browserFileAccess: BrowserFileAccessProbe,
        private readonly nativePermission: NativeMessagingPermissionProbe,
        private readonly getMethod: GetLocalSourceAccessMethod,
    ) {}

    public getState = async (): Promise<LocalSourceAccessState> => {
        if (this.getMethod() === LocalSourceAccessMethod.Browser) {
            return {
                kind: LocalSourceAccessMethod.Browser,
                allowed: await this.browserFileAccess.isAllowed(),
            };
        }

        this.stateRevision += 1;
        const { stateRevision } = this;
        this.state = {
            kind: LocalSourceAccessMethod.NativeHost,
            permissionGranted: true,
            host: { status: NativeHostStatus.Checking },
        };

        let permissionGranted = false;
        try {
            permissionGranted = await this.nativePermission.contains();
        } catch (error) {
            log.error('Failed to check native messaging permission', error);
        }

        if (!permissionGranted) {
            this.client.disconnect();
            return this.applyProbeState(stateRevision, {
                kind: LocalSourceAccessMethod.NativeHost,
                permissionGranted: false,
                host: { status: NativeHostStatus.NotInstalled },
            });
        }

        let probeState: NativeHostState;
        try {
            const host = await Promise.resolve().then(() => this.client.ping());
            probeState = isCompatibleHost(host)
                ? { status: NativeHostStatus.Ready, hostVersion: host.hostVersion }
                : { status: NativeHostStatus.UpdateRequired, hostVersion: host.hostVersion };
        } catch (error) {
            const errorMessage = error instanceof Error ? error.message : '';
            probeState = {
                status: getFailureStatus(errorMessage),
            };
        }
        return this.applyProbeState(stateRevision, {
            kind: LocalSourceAccessMethod.NativeHost,
            permissionGranted: true,
            host: probeState,
        });
    };

    /**
     * Applies runtime cleanup required by a method transition.
     *
     * @param method Newly selected method.
     */
    public methodChanged = (method: LocalSourceAccessMethod): void => {
        this.stateRevision += 1;
        this.state = {
            kind: LocalSourceAccessMethod.NativeHost,
            permissionGranted: true,
            host: { status: NativeHostStatus.Checking },
        };
        if (method === LocalSourceAccessMethod.Browser) {
            this.client.disconnect();
        }
    };

    public markReadFailed = (): void => {
        if (this.getMethod() !== LocalSourceAccessMethod.NativeHost) {
            return;
        }
        this.stateRevision += 1;
        this.state = {
            ...this.state,
            host: { status: NativeHostStatus.ReadFailed },
        };
    };

    public markReady = (hostVersion?: string): void => {
        this.stateRevision += 1;
        this.state = {
            kind: LocalSourceAccessMethod.NativeHost,
            permissionGranted: true,
            host: { status: NativeHostStatus.Ready, hostVersion },
        };
    };

    /**
     * Applies a probe result only while it is still the newest state operation.
     *
     * @param revision Revision captured when the probe started.
     * @param state State produced by the probe.
     *
     * @returns Current state after rejecting stale probe results.
     */
    private applyProbeState = (
        revision: number,
        state: NativeHostAccessState,
    ): NativeHostAccessState => {
        if (revision === this.stateRevision) {
            this.state = state;
        }
        return {
            ...this.state,
            host: { ...this.state.host },
        };
    };
}

export const localSourceAccess = new LocalSourceAccess(
    nativeHostClient,
    fileAccess,
    getBrowserCapabilities(getCurrentBrowserTarget()).usesEmbeddedNativeHost
        ? { contains: () => Promise.resolve(true) }
        : nativeMessagingPermission,
    settings.getLocalSourceAccessMethod,
);
