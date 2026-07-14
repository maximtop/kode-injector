/**
 * @file Native-host readiness state for local source access.
 */

/* eslint-disable jsdoc/require-jsdoc, no-useless-constructor, no-empty-function */

import type { LocalSourceAccessState, NativeHostState } from '../common/contracts';
import { LocalSourceAccessKind } from '../common/contracts';
import {
    isCompatibleHost,
    type NativeHostInfo,
    NativeHostStatus,
} from '../common/native-host-protocol';
import { nativeHostClient } from './native-host';

interface NativeHostProbe {
    ping(): Promise<NativeHostInfo>;
}

export class LocalSourceAccess {
    private state: NativeHostState = { status: NativeHostStatus.Checking };

    public constructor(private readonly client: NativeHostProbe) {}

    public getState = async (): Promise<LocalSourceAccessState> => {
        this.state = { status: NativeHostStatus.Checking };
        try {
            const host = await Promise.resolve().then(() => this.client.ping());
            this.state = isCompatibleHost(host)
                ? { status: NativeHostStatus.Ready, hostVersion: host.hostVersion }
                : { status: NativeHostStatus.UpdateRequired, hostVersion: host.hostVersion };
        } catch (error) {
            const errorMessage = error instanceof Error ? error.message : '';
            this.state = {
                status: getFailureStatus(errorMessage),
            };
        }
        return this.currentState;
    };

    public markReadFailed = (): void => {
        this.state = { status: NativeHostStatus.ReadFailed };
    };

    public markReady = (hostVersion?: string): void => {
        this.state = { status: NativeHostStatus.Ready, hostVersion };
    };

    public get currentState(): LocalSourceAccessState {
        return {
            kind: LocalSourceAccessKind.NativeHost,
            host: { ...this.state },
        };
    }
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

export const localSourceAccess = new LocalSourceAccess(nativeHostClient);
