/**
 * @file Vitest configuration.
 */

import { defineConfig } from 'vitest/config';

export default defineConfig({
    test: {
        exclude: [
            '**/node_modules/**',
            // Only the root output directory; `**/build/**` would also
            // swallow the build-script tests in `scripts/build/`.
            'build/**',
            // Claude Code session worktrees carry their own copies of the
            // test suite; they must not run against this checkout.
            '.claude/**',
        ],
    },
});
