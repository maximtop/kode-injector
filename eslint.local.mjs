/**
 * @file Lint settings specific to Kode Injector: local ignores and the globals of the demo scripts.
 */

import globals from 'globals';

export default [
    {
        ignores: [
            // Claude Code session worktrees carry their own copies of the sources.
            '.claude/',
            // Swift build products of the native helpers.
            'native-host/macos-helper/.build/',
            'native-host/macos-helper/.swiftpm/',
            'safari/native-bridge/.build/',
            // Store deployment downloads.
            'store-upload/',
        ],
    },
    {
        // Demo scripts are injected into example.com pages as plain browser scripts.
        files: ['src/demo/**/*.js'],
        languageOptions: {
            sourceType: 'script',
            globals: globals.browser,
        },
    },
];
