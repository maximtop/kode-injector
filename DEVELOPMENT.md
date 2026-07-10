# Development

This document describes how to set up the development environment, build the
extension, and contribute to the project.

## Prerequisites

- [Node.js](https://nodejs.org/) (LTS or later)
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
| `make lint` | Run ESLint over `src/` and `scripts/` |
| `make typecheck` | Run TypeScript validation without emitting files |

Equivalent `pnpm` scripts:

```sh
pnpm install   # install dependencies
pnpm start     # development watch build (CHANNEL_ENV=dev)
pnpm build     # production build (CHANNEL_ENV=prod)
pnpm lint      # eslint --ext .js,.jsx,.ts,.tsx src scripts
pnpm typecheck # validate TypeScript and TSX without emitting files
```

## Build channels

The build is driven by the `CHANNEL_ENV` environment variable, which is set
automatically by the npm scripts:

| Channel | Command | Output directory | Notes |
| --- | --- | --- | --- |
| `dev` | `pnpm start` | `build/dev/` | Watch mode, source maps, appends `(Dev)` to the extension name |
| `prod` | `pnpm build` | `build/prod/` | Optimized build; also produces `build/<version>-prod.zip` |

Webpack configuration lives in `scripts/build/webpack.config.babel.js`. The
JavaScript file is a webpack-cli compatibility shim that loads the typed
configuration from `scripts/build/webpack.config.ts`. The manifest version is
injected from `package.json` during the build.

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
- **Bundling:** Webpack 5, Babel 7
- **Styling:** PostCSS with `postcss-import`, `postcss-preset-env`,
  `postcss-nested`, and `postcss-svg`; CSS Modules via `css-loader`
- **Polyfill:** `webextension-polyfill` for cross-browser APIs
- **Linting:** ESLint with the Airbnb config; 4-space indentation

## Project structure

```
src/
  manifest.json          # MV3 manifest (version injected at build time)
  _locales/              # i18n message bundles (en, ru)
  assets/                # Static images (icons)
  js/
    background/           # Service worker — injections logic, messaging, storage, update service
    common/               # Shared utilities — messenger, tabs, url-utils, log, constants
    content-script/       # Content script injected at document_start on all URLs
    options/              # Options page UI (React) — manage injection rules
    popup/                # Toolbar popup UI (React) — per-site/global toggles
  pages/                  # Webpack entry points (HTML + JS bootstrap)
scripts/
  constants.ts            # Build-channel constants
  build/
    helpers.ts            # Manifest & locale transforms
    webpack.config.babel.js  # Webpack CLI compatibility shim
    webpack.config.ts     # Webpack configuration
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

## TypeScript validation

```sh
make typecheck
```

`make typecheck` mirrors `pnpm typecheck` and runs `tsc --noEmit`.

## Deployment

Production uploads to the Chrome Web Store are handled by `deploy.sh`, which
runs the [`adguard/extension-deployer`](https://hub.docker.com/r/adguard/extension-deployer)
Docker image. Store credentials and app IDs are stored in `.env` (gitignored).

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
