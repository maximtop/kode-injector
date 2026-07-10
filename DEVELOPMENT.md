# Development

This document describes how to set up the development environment, build the
extension, and contribute to the project.

## Prerequisites

- [Node.js 24 LTS](https://nodejs.org/)
- [pnpm](https://pnpm.io/) package manager

## Getting started

```sh
git clone https://gitlab.com/maximtop/kode-injector.git
cd kode-injector
make install
```

This installs all dependencies via `pnpm install`.

## Available commands

Convenience targets are defined in the `Makefile` and map to `pnpm` scripts:

| Command | What it does |
| --- | --- |
| `make install` | Install dependencies (`pnpm install`) |
| `make start` | Watch the Chrome development build |
| `make build` | Create release builds for every browser |
| `make lint` | Run ESLint over source, scripts, and tests |
| `make typecheck` | Run TypeScript validation without emitting files |
| `make test` | Run build and localization tests |
| `make validate` | Run tests, catalog validation, lint, and typecheck |

Equivalent `pnpm` scripts:

```sh
pnpm install   # install dependencies
pnpm dev       # one-shot development build for every browser
pnpm dev chrome --watch # watch one development target
pnpm release   # release build for every browser
pnpm lint      # run ESLint over source, scripts, and the Rspack config
pnpm typecheck # validate TypeScript and TSX without emitting files
pnpm test      # run build-helper and localization tests
pnpm locales:validate # validate all locale catalogs and UI usage
pnpm validate  # run the complete local quality gate
```

## Build channels and browser targets

The build CLI accepts `chrome`, `edge`, or `firefox` as an optional browser
subcommand. Omitting the browser builds all three targets:

```sh
pnpm dev
pnpm dev edge
pnpm release
pnpm release firefox
```

Development builds are emitted under `build/dev/<browser>/`; release builds
are emitted under `build/release/<browser>/`. Each unpacked directory has a
matching `build/<channel>/<browser>.zip`. Development locale names receive the
`(Dev)` suffix; release names remain unchanged.

Watch mode requires one explicit development target:

```sh
pnpm dev chrome --watch
```

`pnpm dev --watch` and release watch commands fail by design.

The Commander build entry point imports the typed `rspack.config.ts`
configuration factory. Rspack's built-in SWC compiler handles TypeScript, TSX,
legacy decorators, and React JSX. Rspack
built-ins handle HTML generation, copy transforms, output cleanup, assets, and
CSS. The manifest version is injected from `package.json` during the build.

## Loading the extension for development

1. Run `make start` (or `pnpm dev chrome --watch`) to start the Chrome watcher.
2. Open `chrome://extensions/` in Chrome.
3. Enable **Developer mode** (top-right toggle).
4. Click **Load unpacked** and select the `build/dev/chrome/` directory.

The extension reloads automatically when source files change. Use the reload
button on the extension card in `chrome://extensions/` after content-script
or background changes.

## Tech stack

- **Runtime:** Manifest V3 browser extension (Chrome / Firefox / Edge)
- **UI:** React 17, MobX 6, Ant Design 4
- **Bundling:** Rspack 2 with built-in SWC
- **Styling:** PostCSS with `postcss-import`, `postcss-preset-env`,
  `postcss-nested`, and `postcss-svg`; CSS Modules via Rspack native CSS
- **Polyfill:** `webextension-polyfill` for cross-browser APIs
- **Linting:** ESLint with the Airbnb config; 4-space indentation

## Project structure

```
src/
  manifest.json          # MV3 manifest (version injected at build time)
  _locales/              # i18n message bundles (30 supported locales)
  assets/                # Static images (icons)
  app/
    background/           # Service worker — injections logic, messaging, storage, update service
    common/               # Shared utilities, locale resolver, translator, messenger, tabs, and logs
    content-script/       # Content script injected at document_start on all URLs
    options/              # Options page UI (React) — manage injection rules
    popup/                # Toolbar popup UI (React) — per-site/global toggles
  pages/                  # Rspack entry points (HTML + TypeScript bootstrap)
scripts/
  constants.ts            # Build-channel constants
  build/
    archive-plugin.ts     # Production ZIP archive plugin
    helpers.ts            # Manifest & locale transforms
rspack.config.ts          # Typed Rspack and SWC configuration
build/                    # Build output (dev/ and prod/)
```

## Linting

```sh
make lint
```

ESLint uses the Airbnb base config with React plugins. Key conventions:

- 4-space indentation (JS and JSX)
- Arrow body style is off; default exports are allowed alongside named exports
- `react/prop-types` is disabled

## Localization workflow

Locale catalogs live in `src/_locales/<locale>/messages.json`. English is the
canonical catalog: add a key there with a translator description, then add the
same key to all 29 target catalogs. User-facing options and popup text must use
`translator.getMessage()`; technical file paths, URLs, the product name, and
copyright text stay literal where appropriate.

Run `pnpm locales:validate` after changing a catalog or UI copy. It checks the
exact 30-directory set, key parity, non-empty messages, formatter structure,
manifest/source usage, and hardcoded component strings. The `@adguard/translate`
validator is used for placeholder and plural compatibility. The selected
language is persisted by the background service and synchronized to open UI
contexts without a reload.

For a browser smoke test, build with `pnpm dev chrome`, load
`build/dev/chrome/` as an
unpacked extension, open the options page, switch languages, and verify that
the form, table, popup, document language, and RTL direction update immediately.

## TypeScript validation

```sh
make typecheck
```

`make typecheck` mirrors `pnpm typecheck` and runs `tsc --noEmit`.

## Deployment

Production uploads to the Chrome Web Store use the `Makefile` targets below and
the local `go-webext` checkout. Store credentials and app IDs are stored in
`.env` (gitignored).

The `Makefile` exposes additional targets:

| Command | What it does |
| --- | --- |
| `make chrome_status` | Check the status of the Chrome Web Store item |
| `make chrome_update` | Upload a new build to the Chrome Web Store |
| `make chrome_code` | Obtain the OAuth authorization code |
| `make chrome_refresh` | Exchange the code for a refresh token |

## Releases

1. Bump the `version` field in `package.json`.
2. Run `make build` to produce the browser directories and ZIPs under
   `build/release/`.
3. Run `make chrome_update` to publish to the Chrome Web Store.

## Firefox local-file permission

Firefox uses a Manifest V3 background page because it does not support
extension service workers. The generated manifest requires Firefox 153 or newer.
Users must open the Kode Injector extension permissions and enable **Access
local files on your computer** before local injection paths can be read. The
options page and popup display guidance while access is disabled.
