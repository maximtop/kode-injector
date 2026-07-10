# AGENTS.md

Guidance for LLM agents working in this repository.

## Project Overview

**Kode Injector** is a browser extension (Manifest V3) that injects custom
JavaScript and CSS from local files into specified websites. Developers, QA
testers, and designers map `file:///` paths to site hostnames; the matching
code is injected automatically when those sites are visited.

## Target Platform

Browser extension running on Chrome, Firefox, and Edge (Manifest V3 service
worker model).

## Project Type

Browser extension with a React-based popup and options page.

## Tech Stack

- **UI:** React 17, MobX 6, Ant Design 4
- **Bundling:** Rspack 2 with built-in SWC
- **Styling:** PostCSS with Rspack native CSS Modules
- **Cross-browser API:** `webextension-polyfill`
- **Linting:** ESLint (Airbnb config, 4-space indent)
- **Package manager:** pnpm

## Project Structure

```
src/
  manifest.json              # MV3 manifest
  _locales/{en,ru}/          # i18n message bundles
  assets/img/                # Extension icons
  js/
    background/              # Service worker
      index.ts              # Entry — wires up stores and message handler
      injections.ts         # Injection rules store (CRUD, matching, code fetch)
      settings.ts           # App-level settings (enabled/disabled)
      storage.ts            # chrome.storage wrapper
      message-handler.ts    # Routes runtime messages to injections/settings/app
      execute-script.ts     # Injects JS into tabs
      app.ts                # Global enable/disable
      update-service.ts     # Update checks
    common/
      constants.ts          # MESSAGE_TYPES, STORAGE_KEYS, SETTINGS
      messenger.ts          # Message-passing helpers between popup/options and background
      tabs.ts               # Tab helpers
      url-utils.ts          # URL/hostname parsing
      log.ts                # Logging
    content-script/
      index.ts              # Runs at document_start; requests injection code
    options/
      index.tsx             # Options page root
      components/            # Header, Footer, OptionsApp, NewInjectionForm, InjectionsTable
      stores/InjectionsStore.ts, RootStore.ts
    popup/
      index.tsx             # Popup root
      components/            # Header, Footer, Main, PopupApp
      stores/RootStore.ts, SettingsStore.ts
  pages/
    background/              # Background HTML + JS bootstrap
    content-script/         # Content script entry
    options/                 # Options HTML + JS bootstrap
    popup/                   # Popup HTML + JS bootstrap
scripts/
  constants.ts              # Build channel constants (dev/prod)
  build/
    archive-plugin.ts       # Production ZIP archive plugin
    helpers.ts              # Manifest & locale transforms
rspack.config.ts            # Typed Rspack and SWC config
build/                      # Output (build/dev, build/prod)
```

## Architecture

- **Background service worker** holds the single source of truth: an in-memory
  `injections` list and `settings`, both persisted to `chrome.storage`. It
  listens for runtime messages from the popup and options page.
- **Content script** runs at `document_start` on `<all_urls>`. On load it sends
  a `GET_INJECTIONS_CODE` message to the background, receives matching JS/CSS,
  and executes them on the page.
- **Popup** queries the background for the current tab's state (has injections?
  blacklisted?) and provides per-site and global toggles.
- **Options page** manages injection rules: add (site + JS path + CSS path),
  enable/disable, and delete.
- **Messaging** flows through `src/js/common/messenger.ts`, with message types
  defined in `src/js/common/constants.ts`.

## Key Conventions

- **Indentation:** 4 spaces (enforced by ESLint for JS and JSX).
- **Styling:** `.pcss` files with CSS Modules; styles imported as side effects
  or via camelCase class names.
- **State management:** MobX observables and `observer` components.
- **Entry naming:** Pages live under `src/pages/<name>/`; React UI under
  `src/js/<name>/components/`.
- **i18n:** Messages in `src/_locales/<locale>/messages.json`; referenced in
  the manifest via `__MSG_name__`.

## Build & Development Commands

```sh
pnpm install   # install dependencies
pnpm start     # dev watch build -> build/dev/
pnpm build     # production build -> build/prod/ and versioned ZIP
make lint      # ESLint and TypeScript validation
```

Load the dev build via `chrome://extensions/` → **Load unpacked** → `build/dev/`.

## Testing

Build helper tests run with `pnpm test:build`. Extension behavior is verified
manually by loading the unpacked extension and testing target sites.
