/**
 * @file Lint settings specific to Kode Injector: paths outside the sources that ESLint must skip.
 */

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
];
