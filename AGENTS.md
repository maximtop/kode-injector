# AGENTS.md

Guidance for LLM agents working in this repository.

## Project Overview

**Kode Injector** is a browser extension (Manifest V3) that injects custom
JavaScript and CSS from local files into specified websites. Developers, QA
testers, and designers map `file:///` paths to site hostnames; the matching
code is injected automatically when those sites are visited.

## Target Platform

Browser extension running on Chrome, Firefox, and Edge. Chrome and Edge use a
Manifest V3 service worker; Firefox uses a Manifest V3 background page.

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
  _locales/{...}/            # i18n message bundles (30 supported locales)
  assets/img/                # Extension icons
  app/
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
  constants.ts              # Build channel and browser target constants
  build/
    bundle.ts               # Commander-based build entry point
    bundle-runner.ts        # Rspack run/watch orchestration
    cli.ts                  # Browser subcommands and watch validation
    archive-plugin.ts       # Browser ZIP archive plugin
    helpers.ts              # Manifest & locale transforms
rspack.config.ts            # Typed Rspack and SWC config
build/                      # Output (build/<channel>/<browser>)
```

## Architecture

- **Background runtime** holds the single source of truth: an in-memory
  `injections` list and `settings`, both persisted to `chrome.storage`. It runs
  as a service worker in Chromium and a background page in Firefox.
- **Content script** runs at `document_start` on `<all_urls>`. On load it sends
  a `GET_INJECTIONS_CODE` message to the background, receives matching JS/CSS,
  and executes them on the page.
- **Popup** queries the background for the current tab's state (has injections?
  blacklisted?) and provides per-site and global toggles.
- **Options page** manages injection rules: add (site + JS path + CSS path),
  enable/disable, and delete.
- **Messaging** flows through `src/app/common/messenger.ts`, with message types
  defined in `src/app/common/constants.ts`.

### Settings ownership

- `SettingsService` is the single owner of runtime application settings.
- All settings changes must go through `SettingsService` methods. Code outside
  the service must not write `STORAGE_KEYS.SETTINGS` directly.
- After `SettingsService.init()` completes, its in-memory state is authoritative.
  Persisted settings are validated and repaired during initialization.
- Do not use `browser.storage.onChanged` to synchronize application settings.
  Internal writes already update the in-memory state before persistence.

## Key Conventions

- **Indentation:** 4 spaces (enforced by ESLint for JS and JSX).
- **Styling:** `.pcss` files with CSS Modules; styles imported as side effects
  or via camelCase class names.
- **State management:** MobX observables and `observer` components.
- **Entry naming:** Pages live under `src/pages/<name>/`; React UI under
  `src/app/<name>/components/`.
- **i18n:** Messages in `src/_locales/<locale>/messages.json`; referenced in
  the manifest via `__MSG_name__`.
- **No magic values:** Repeated domain identifiers and literals must use named
  constants or enums. Represent closed domain sets, such as browser targets,
  with TypeScript enums instead of string unions or repeated string literals.
  Keep component-specific values local; place values shared across modules in
  `src/app/common/constants.ts` or the relevant common contract.

## Build & Development Commands

```sh
pnpm install   # install dependencies
pnpm dev       # one-shot dev build for Chrome, Edge, and Firefox
pnpm dev chrome --watch # watch one explicit dev browser target
pnpm release   # release build for Chrome, Edge, and Firefox
make lint      # ESLint and TypeScript validation
```

Append `chrome`, `edge`, or `firefox` to `pnpm dev` or `pnpm release` to build
one target. Outputs are `build/<channel>/<browser>/` and
`build/<channel>/<browser>.zip`. Load the Chrome dev build via
`chrome://extensions/` → **Load unpacked** → `build/dev/chrome/`.

Firefox builds require Firefox 153 or newer. Users must grant **Access local
files on your computer** in the extension permissions; the UI reports the
current browser-owned permission state and must not persist its own copy.

## Testing

Build helper tests run with `pnpm test:build`. Extension behavior is verified
with headless Playwright smoke tests that load the unpacked extension and test
target sites.

### Headless extension smoke testing

Browser smoke and regression checks for this repository MUST run headlessly and
must not open or expose a visible browser window. When Playwright is available,
launch Chromium with the built extension loaded through both flags below:

```ts
const browser = await chromium.launch({
    headless: true,
    args: [
        '--headless=new',
        `--disable-extensions-except=${extensionPath}`,
        `--load-extension=${extensionPath}`,
    ],
});
```

Use `build/dev/chrome/` for localization and workflow smoke checks. Keep the browser
context isolated, verify popup/options pages through their extension URLs, and
close the browser after the run. Do not use headed mode, attach to a user's
visible browser session, or leave test tabs open.
