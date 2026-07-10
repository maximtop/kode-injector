/**
 * Validates the extension's locale catalogs and translation usage.
 */

import fs from 'node:fs';
import path from 'node:path';
import ts from 'typescript';
import { pathToFileURL } from 'node:url';
import { validator, type Locale } from '@adguard/translate';

import { AVAILABLE_LOCALES, BASE_LOCALE } from '../../src/app/common/locale/locale-constants';
import type { MessagesJson } from '../../src/app/common/locale/locale-types';

/**
 * Paths and locale expectations used by the locale validator.
 */
export interface LocaleValidationOptions {
    /**
     * Repository root used to resolve default paths.
     */
    rootPath: string;

    /**
     * Optional locale catalog directory.
     */
    localesPath?: string;

    /**
     * Optional source directory to scan for translation usage.
     */
    sourcePath?: string;

    /**
     * Optional manifest path to scan for message placeholders.
     */
    manifestPath?: string;

    /**
     * Optional expected locale list used instead of the project defaults.
     */
    expectedLocales?: readonly string[];
}

const MESSAGE_KEY_PATTERN = /__MSG_([A-Za-z0-9_]+)__/g;
const TRANSLATOR_KEY_PATTERN = /translator\.getMessage\(\s*['"]([^'"]+)['"]/g;
const UI_ATTRIBUTE_NAMES = new Set(['title', 'placeholder', 'aria-label', 'alt']);

const UI_STRING_EXEMPTIONS = new Map([
    ['src/app/options/components/Header/Header.tsx:Kode Injector', 'Product name'],
    ['src/app/popup/components/Header/Header.tsx:Kode Injector', 'Product name'],
    ['src/app/options/components/Footer/Footer.tsx:© maximtop, 2017-', 'Copyright'],
    ['src/app/options/components/NewInjectionForm/NewInjectionForm.tsx:file:///index.js', 'Technical example'],
    ['src/app/options/components/NewInjectionForm/NewInjectionForm.tsx:file:///styles.css', 'Technical example'],
]);

/**
 * Checks whether a value is a non-null, non-array object record.
 *
 * @param value Value to inspect.
 *
 * @returns Whether the value is an object record.
 */
const isRecord = (value: unknown): value is Record<string, unknown> => (
    typeof value === 'object' && value !== null && !Array.isArray(value)
);

/**
 * Reads and parses a JSON file.
 *
 * @param filePath Path to the JSON file.
 *
 * @returns Parsed JSON value.
 *
 * @throws Error when the file cannot be parsed as JSON.
 */
const readJson = (filePath: string): unknown => {
    try {
        return JSON.parse(fs.readFileSync(filePath, 'utf8')) as unknown;
    } catch (error) {
        throw new Error(`${filePath}: invalid JSON (${(error as Error).message})`);
    }
};

/**
 * Extracts a message string from a catalog entry.
 *
 * @param entry Potential locale catalog entry.
 *
 * @returns The entry message, when it is a string.
 */
const getMessageText = (entry: unknown): string | undefined => {
    if (!isRecord(entry) || typeof entry.message !== 'string') {
        return undefined;
    }
    return entry.message;
};

/**
 * Converts a path to a root-relative, slash-separated path.
 *
 * @param rootPath Path used as the relative-path base.
 * @param filePath Path to convert.
 *
 * @returns Normalized relative path.
 */
const relativePath = (rootPath: string, filePath: string): string => (
    path.relative(rootPath, filePath).split(path.sep).join('/')
);

/**
 * Recursively collects files below a directory.
 *
 * @param directory Directory to scan.
 *
 * @returns Absolute paths for files found below the directory.
 */
const collectFiles = (directory: string): string[] => {
    if (!fs.existsSync(directory)) {
        return [];
    }

    return fs.readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
        const entryPath = path.join(directory, entry.name);
        if (entry.isDirectory()) {
            return collectFiles(entryPath);
        }
        return entry.isFile() ? [entryPath] : [];
    });
};

/**
 * Collects translation keys referenced by source files and the manifest.
 *
 * @param sourcePath Source directory to scan.
 * @param manifestPath Manifest file to scan.
 *
 * @returns Set of referenced translation keys.
 */
const collectUsedKeys = (sourcePath: string, manifestPath: string): Set<string> => {
    const usedKeys = new Set<string>();
    const manifest = fs.existsSync(manifestPath) ? fs.readFileSync(manifestPath, 'utf8') : '';
    for (const match of manifest.matchAll(MESSAGE_KEY_PATTERN)) {
        usedKeys.add(match[1]);
    }

    for (const filePath of collectFiles(sourcePath)) {
        if (!/\.(ts|tsx)$/.test(filePath)) {
            continue;
        }
        const source = fs.readFileSync(filePath, 'utf8');
        for (const match of source.matchAll(TRANSLATOR_KEY_PATTERN)) {
            usedKeys.add(match[1]);
        }
    }

    return usedKeys;
};

/**
 * Checks whether a string contains at least one Unicode letter.
 *
 * @param value String to inspect.
 *
 * @returns Whether the string contains a letter.
 */
const hasLetters = (value: string): boolean => /\p{L}/u.test(value);

/**
 * Finds hardcoded user-facing strings in TSX source files.
 *
 * @param rootPath Repository root used for diagnostics.
 * @param sourcePath Source directory to scan.
 *
 * @returns Human-readable hardcoded-string diagnostics.
 */
const reportHardcodedStrings = (rootPath: string, sourcePath: string): string[] => {
    const errors: string[] = [];
    const componentRoot = path.join(sourcePath);
    for (const filePath of collectFiles(componentRoot)) {
        if (!filePath.endsWith('.tsx')) {
            continue;
        }

        const sourceText = fs.readFileSync(filePath, 'utf8');
        const sourceFile = ts.createSourceFile(filePath, sourceText, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
        const relative = relativePath(rootPath, filePath);

        /**
         * Records a hardcoded UI string unless it is explicitly exempted.
         *
         * @param node AST node containing the string.
         * @param value Hardcoded string value.
         */
        const report = (node: ts.Node, value: string): void => {
            const key = `${relative}:${value}`;
            if (UI_STRING_EXEMPTIONS.has(key)) {
                return;
            }
            const line = sourceFile.getLineAndCharacterOfPosition(node.getStart(sourceFile)).line + 1;
            errors.push(`Hardcoded UI string: ${relative}:${line} "${value}"`);
        };

        /**
         * Traverses the source tree and reports hardcoded UI strings.
         *
         * @param node AST node to inspect.
         */
        const visit = (node: ts.Node): void => {
            if (ts.isJsxText(node)) {
                const value = node.getText(sourceFile).trim();
                if (value && hasLetters(value)) {
                    report(node, value);
                }
            } else if (ts.isJsxAttribute(node)
                && node.name.kind === ts.SyntaxKind.Identifier
                && UI_ATTRIBUTE_NAMES.has(node.name.text)
                && node.initializer
                && ts.isStringLiteral(node.initializer)) {
                report(node.initializer, node.initializer.text);
            } else if (ts.isCallExpression(node)
                && ts.isPropertyAccessExpression(node.expression)
                && node.expression.name.text === 'confirm'
                && ts.isIdentifier(node.expression.expression)
                && node.expression.expression.text === 'window'
                && node.arguments.length === 1
                && ts.isStringLiteral(node.arguments[0])) {
                report(node.arguments[0], node.arguments[0].text);
            } else if (filePath.endsWith(path.join('InjectionsTable.tsx'))
                && ts.isPropertyAssignment(node)
                && ts.isIdentifier(node.name)
                && node.name.text === 'title'
                && ts.isStringLiteral(node.initializer)) {
                report(node.initializer, node.initializer.text);
            }
            ts.forEachChild(node, visit);
        };
        visit(sourceFile);
    }
    return errors;
};

/**
 * Validates one locale catalog against the base catalog.
 *
 * @param locale Locale identifier being validated.
 * @param catalog Locale catalog to validate.
 * @param baseCatalog English catalog used as the schema.
 * @param errors Mutable validation error list.
 * @param validateFormats Whether formatter placeholders should be checked.
 */
const validateCatalog = (
    locale: string,
    catalog: unknown,
    baseCatalog: MessagesJson,
    errors: string[],
    validateFormats: boolean,
): void => {
    if (!isRecord(catalog)) {
        errors.push(`${locale}: catalog must be an object`);
        return;
    }

    const baseKeys = Object.keys(baseCatalog);
    const keys = Object.keys(catalog);
    for (const key of baseKeys) {
        if (!(key in catalog)) {
            errors.push(`${locale}: missing key ${key}`);
            continue;
        }
        const message = getMessageText(catalog[key]);
        if (message === undefined) {
            errors.push(`${locale}: ${key} must contain a string message`);
            continue;
        }
        if (message.trim() === '') {
            errors.push(`${locale}: empty message ${key}`);
            continue;
        }
        if (validateFormats && locale !== BASE_LOCALE) {
            const baseMessage = getMessageText(baseCatalog[key]);
            try {
                if (baseMessage !== undefined && !validator.isTranslationValid(
                    baseMessage,
                    message,
                    locale.toLowerCase().replace('-', '_') as Locale,
                )) {
                    errors.push(`${locale}: invalid formatter structure for ${key}`);
                }
            } catch (error) {
                errors.push(`${locale}: invalid formatter structure for ${key} (${(error as Error).message})`);
            }
        }
    }
    for (const key of keys) {
        if (!baseKeys.includes(key)) {
            errors.push(`${locale}: unexpected key ${key}`);
        }
    }
};

/**
 * Validates locale directories, catalog structure, source usage, and UI literals.
 *
 * @param options Repository paths used by the validator.
 * @returns Human-readable validation errors.
 */
export const validateLocales = (options: LocaleValidationOptions): string[] => {
    const localesPath = options.localesPath ?? path.join(options.rootPath, 'src/_locales');
    const sourcePath = options.sourcePath ?? path.join(options.rootPath, 'src/app');
    const manifestPath = options.manifestPath ?? path.join(options.rootPath, 'src/manifest.json');
    const errors: string[] = [];
    const actualLocales = fs.existsSync(localesPath)
        ? fs.readdirSync(localesPath, { withFileTypes: true })
            .filter((entry) => entry.isDirectory())
            .map((entry) => entry.name)
            .sort()
        : [];
    const expectedLocales = [...(options.expectedLocales ?? AVAILABLE_LOCALES)].sort();
    for (const locale of expectedLocales) {
        if (!actualLocales.includes(locale)) {
            errors.push(`Missing locale directory: ${locale}`);
        }
    }
    for (const locale of actualLocales) {
        if (!expectedLocales.includes(locale)) {
            errors.push(`Unexpected locale directory: ${locale}`);
        }
    }

    const basePath = path.join(localesPath, `${BASE_LOCALE}/messages.json`);
    let baseCatalog: MessagesJson = {};
    if (!fs.existsSync(basePath)) {
        errors.push(`Missing catalog: ${relativePath(options.rootPath, basePath)}`);
    } else {
        try {
            const parsed = readJson(basePath);
            baseCatalog = isRecord(parsed) ? parsed as MessagesJson : {};
            for (const [key, entry] of Object.entries(baseCatalog)) {
                const message = getMessageText(entry);
                if (message === undefined || message.trim() === '') {
                    errors.push(`${BASE_LOCALE}: ${key} must contain a non-empty string message`);
                }
                if (!isRecord(entry) || typeof entry.description !== 'string' || entry.description.trim() === '') {
                    errors.push(`${BASE_LOCALE}: ${key} must contain a translator description`);
                }
            }
        } catch (error) {
            errors.push((error as Error).message);
        }
    }

    for (const locale of actualLocales) {
        const filePath = path.join(localesPath, locale, 'messages.json');
        if (!fs.existsSync(filePath)) {
            errors.push(`${locale}: missing messages.json`);
            continue;
        }
        try {
            validateCatalog(
                locale,
                readJson(filePath),
                baseCatalog,
                errors,
                expectedLocales.includes(locale),
            );
        } catch (error) {
            errors.push((error as Error).message);
        }
    }

    const usedKeys = collectUsedKeys(sourcePath, manifestPath);
    for (const key of Object.keys(baseCatalog)) {
        if (!usedKeys.has(key)) {
            errors.push(`Unused English message: ${key}`);
        }
    }
    errors.push(...reportHardcodedStrings(options.rootPath, sourcePath));
    return errors;
};

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
    const errors = validateLocales({ rootPath: process.cwd() });
    if (errors.length > 0) {
        errors.forEach((error) => process.stderr.write(`${error}\n`));
        process.exitCode = 1;
    }
}
