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
| `make start` | Start the development build in watch mode |
| `make build` | Create a production build |
| `make lint` | Run ESLint over source, scripts, and tests |
| `make typecheck` | Run TypeScript validation without emitting files |
| `make test` | Run build and localization tests |
| `make validate` | Run tests, catalog validation, lint, and typecheck |

Equivalent `pnpm` scripts:

```sh
pnpm install   # install dependencies
pnpm start     # development watch build (CHANNEL_ENV=dev)
pnpm build     # production build (CHANNEL_ENV=prod)
pnpm lint      # run ESLint over source, scripts, and the Rspack config
pnpm typecheck # validate TypeScript and TSX without emitting files
pnpm test      # run build-helper and localization tests
pnpm locales:validate # validate all locale catalogs and UI usage
pnpm validate  # run the complete local quality gate
```

## Build channels

The build is driven by the `CHANNEL_ENV` environment variable, which is set
automatically by the npm scripts:

| Channel | Command | Output directory | Notes |
| --- | --- | --- | --- |
| `dev` | `pnpm start` | `build/dev/` | Watch mode, source maps, appends `(Dev)` to the extension name |
| `prod` | `pnpm build` | `build/prod/` | Optimized build; also produces `build/<version>-prod.zip` |

Rspack 2 loads the typed `rspack.config.ts` configuration directly. Its built-in
SWC compiler handles TypeScript, TSX, legacy decorators, and React JSX. Rspack
built-ins handle HTML generation, copy transforms, output cleanup, assets, and
CSS. The manifest version is injected from `package.json` during the build.

## Loading the extension for development

1. Run `make start` (or `pnpm start`) to start the watch build.
2. Open `chrome://extensions/` in Chrome.
3. Enable **Developer mode** (top-right toggle).
4. Click **Load unpacked** and select the `build/dev/` directory.

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

For a browser smoke test, build with `pnpm start`, load `build/dev/` as an
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
2. Run `make build` to produce `build/prod/` and `build/<version>-prod.zip`.
3. Run `make chrome_update` to publish to the Chrome Web Store.
