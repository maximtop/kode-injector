/**
 * @file Routes configured source URLs to the browser or native host.
 */

/* eslint-disable jsdoc/require-jsdoc, no-useless-constructor, no-empty-function */

import { log } from '../common/log';
import { NativeErrorCode } from '../common/native-host-protocol';

const FILE_URL_PREFIX = 'file://';

export enum SourceReadErrorCode {
    FetchFailed = 'FETCH_FAILED',
    NativeFailed = 'NATIVE_FAILED',
}

export type SourceReadResult = {
    ok: true;
    content: string;
} | {
    ok: false;
    errorCode: SourceReadErrorCode | NativeErrorCode;
};

interface NativeFileReader {
    readFile(fileUrl: string): Promise<string>;
}

type FetchSource = (url: string) => Promise<{ text(): Promise<string> }>;

export class SourceReader {
    public constructor(
        private readonly native: NativeFileReader,
        private readonly fetchSource: FetchSource,
    ) {}

    public read = async (url: string): Promise<SourceReadResult> => {
        if (url.startsWith(FILE_URL_PREFIX)) {
            return this.readNative(url);
        }
        return this.readNetwork(url);
    };

    private readNative = async (url: string): Promise<SourceReadResult> => {
        try {
            return { ok: true, content: await this.native.readFile(url) };
        } catch (error) {
            const errorCode = getNativeErrorCode(error);
            log.error('Native source read failed', errorCode);
            return { ok: false, errorCode };
        }
    };

    private readNetwork = async (url: string): Promise<SourceReadResult> => {
        try {
            const response = await this.fetchSource(url);
            return { ok: true, content: await response.text() };
        } catch {
            log.error('Network source read failed', SourceReadErrorCode.FetchFailed);
            return { ok: false, errorCode: SourceReadErrorCode.FetchFailed };
        }
    };
}

const getNativeErrorCode = (error: unknown): NativeErrorCode | SourceReadErrorCode => {
    const message = error instanceof Error ? error.message : '';
    return Object.values(NativeErrorCode).includes(message as NativeErrorCode)
        ? message as NativeErrorCode
        : SourceReadErrorCode.NativeFailed;
};
