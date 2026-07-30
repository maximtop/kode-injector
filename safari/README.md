# Kode Injector for Safari

This directory contains the production macOS Safari wrapper and its native
bridge. The WebExtension UI and runtime are built from the repository's shared
`src/` tree; generated JavaScript, CSS, locale files, and the current-architecture
Go executable are intentionally not committed here.

Build and validate the locally installable app:

```sh
pnpm safari:build
pnpm safari:validate
```

The result is `build/safari/dev/Kode Injector.app`. Copy it to `/Applications`
manually, launch it, and enable the extension in Safari Settings. See
[`DEVELOPMENT.md`](../DEVELOPMENT.md#testing-safari-locally) for the end-to-end
fixture workflow.
