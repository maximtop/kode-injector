/**
 * @file Routes configured source URLs to the browser or native host.
 */

import { LocalSourceAccessMethod } from '../common/contracts';
import { log } from '../common/log';
import { NativeErrorCode } from '../common/native-host-protocol';
import { urlUtils } from '../common/url-utils';

export enum SourceReadErrorCode {
    FetchFailed = 'FETCH_FAILED',
    NativeFailed = 'NATIVE_FAILED',
}

/**
 * Outcome of reading one configured source.
 */
export type SourceReadResult = {
    ok: true;
    content: string;
} | {
    ok: false;
    errorCode: SourceReadErrorCode | NativeErrorCode;
};

/**
 * Identifies transport failures that affect the native channel itself rather
 * than one configured file.
 *
 * @param errorCode Source read failure.
 *
 * @returns Whether global native-host readiness should be degraded.
 */
export const isNativeHostWideFailure = (
    errorCode: SourceReadErrorCode | NativeErrorCode,
): boolean => errorCode === SourceReadErrorCode.NativeFailed;

/**
 * Native-host operation needed to read one local source file.
 */
interface NativeFileReader {
    readFile(fileUrl: string): Promise<string>;
}

/**
 * Fetches one network source.
 *
 * @param url Source URL to fetch.
 *
 * @returns Response whose text can be read.
 */
type FetchSource = (url: string) => Promise<{ text(): Promise<string> }>;

/**
 * Reads the currently selected local-source access method.
 *
 * @returns Currently selected access method.
 */
type GetLocalSourceAccessMethod = () => LocalSourceAccessMethod;

/**
 * Maps a native read failure to a reported error code.
 *
 * @param error Error raised by the native read.
 *
 * @returns Native error code, or a generic native-failure code when unrecognized.
 */
const getNativeErrorCode = (error: unknown): NativeErrorCode | SourceReadErrorCode => {
    const message = error instanceof Error ? error.message : '';
    return Object.values(NativeErrorCode).includes(message as NativeErrorCode)
        ? message as NativeErrorCode
        : SourceReadErrorCode.NativeFailed;
};

/**
 * Reads configured source URLs through the browser or native host.
 */
export class SourceReader {
    /**
     * Creates a source reader.
     *
     * @param native Native-host operation used for file URL reads.
     * @param fetchSource Fetches one network source.
     * @param getLocalSourceAccessMethod Reads the currently selected access method.
     */
    public constructor(
        private readonly native: NativeFileReader,
        private readonly fetchSource: FetchSource,
        private readonly getLocalSourceAccessMethod: GetLocalSourceAccessMethod,
    ) {}

    public read = async (url: string): Promise<SourceReadResult> => {
        if (urlUtils.isFileUrl(url)
            && this.getLocalSourceAccessMethod() === LocalSourceAccessMethod.NativeHost) {
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
