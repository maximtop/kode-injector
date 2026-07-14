/**
 * @file Readiness state for the active local-source access method.
 */

/* eslint-disable jsdoc/require-jsdoc, no-useless-constructor, no-empty-function */

import type {
    LocalSourceAccessState,
    NativeHostAccessState,
    NativeHostState,
} from '../common/contracts';
import { LocalSourceAccessMethod } from '../common/contracts';
import { log } from '../common/log';
import { nativeMessagingPermission } from '../common/native-messaging-permission';
import {
    isCompatibleHost,
    type NativeHostInfo,
    NativeHostStatus,
} from '../common/native-host-protocol';
import { nativeHostClient } from './native-host';
import { fileAccess } from './file-access';
import { settings } from './settings';

interface NativeHostProbe {
    ping(): Promise<NativeHostInfo>;
    disconnect(): void;
}

interface BrowserFileAccessProbe {
    isAllowed(): Promise<boolean>;
}

interface NativeMessagingPermissionProbe {
    contains(): Promise<boolean>;
}

type GetLocalSourceAccessMethod = () => LocalSourceAccessMethod;

export class LocalSourceAccess {
    private state: NativeHostAccessState = {
        kind: LocalSourceAccessMethod.NativeHost,
        permissionGranted: true,
        host: { status: NativeHostStatus.Checking },
    };

    private stateRevision = 0;

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

const getFailureStatus = (errorMessage: string): NativeHostStatus => {
    if (errorMessage === 'UNSUPPORTED_PROTOCOL') {
        return NativeHostStatus.UpdateRequired;
    }
    if (errorMessage === 'NATIVE_DISCONNECTED') {
        return NativeHostStatus.Disconnected;
    }
    return NativeHostStatus.NotInstalled;
};

export const localSourceAccess = new LocalSourceAccess(
    nativeHostClient,
    fileAccess,
    nativeMessagingPermission,
    settings.getLocalSourceAccessMethod,
);
