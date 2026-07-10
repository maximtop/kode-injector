/**
 * @file
 */

/**
 * Browser API required to query local-file permission.
 */
export interface FileAccessApi {
    /**
     * Returns whether the extension may access file-scheme URLs.
     */
    isAllowedFileSchemeAccess(): Promise<boolean>;
}

/**
 * Logger used by the file-access service.
 */
export interface FileAccessLogger {
    /**
     * Records a failed permission query.
     */
    error(...args: unknown[]): void;
}

/**
 * Reads local-file permission from the browser without persisting it.
 */
export class FileAccessService {
    /**
     * Browser permission API.
     */
    private api: FileAccessApi;

    /**
     * Diagnostic logger.
     */
    private logger: FileAccessLogger;

    /**
     * Creates a file-access service.
     *
     * @param api Browser permission API.
     * @param logger Diagnostic logger.
     */
    constructor(api: FileAccessApi, logger: FileAccessLogger) {
        this.api = api;
        this.logger = logger;
    }

    /**
     * Checks whether local-file URLs are currently accessible.
     *
     * @returns Current browser-owned permission state.
     */
    public isAllowed = async (): Promise<boolean> => {
        try {
            return await this.api.isAllowedFileSchemeAccess();
        } catch (error) {
            this.logger.error('Failed to check local file access', error);
            return false;
        }
    };
}
