/**
 * @file Per-document injection identity shared by content and background code.
 */

const DOCUMENT_TOKEN_BYTE_LENGTH = 16;
const DOCUMENT_TOKEN_HEX_LENGTH = DOCUMENT_TOKEN_BYTE_LENGTH * 2;
const HEX_PATTERN = /^[0-9a-f]+$/;

/**
 * DOM attribute carrying the identity of the content script's document.
 */
export const DOCUMENT_TOKEN_ATTRIBUTE = 'data-kode-injector-document';

/**
 * Creates an opaque identity for one content-script document.
 */
export const createDocumentToken = (): string => {
    const bytes = crypto.getRandomValues(new Uint8Array(DOCUMENT_TOKEN_BYTE_LENGTH));
    return Array.from(bytes, (byte) => byte.toString(16).padStart(2, '0')).join('');
};

/**
 * Checks an untrusted document token received through runtime messaging.
 *
 * @param value Candidate token to validate.
 */
export const isDocumentToken = (value: unknown): value is string => (
    typeof value === 'string'
    && value.length === DOCUMENT_TOKEN_HEX_LENGTH
    && HEX_PATTERN.test(value)
);
