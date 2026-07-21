# AGENTS.md

Guidance for LLM agents working in this repository.

Environment setup, build commands, the tech stack, and the project structure
are documented once in [DEVELOPMENT.md](DEVELOPMENT.md); this file covers the
conventions and safety rules specific to working on the code.

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

## Tech Stack & Project Structure

See [DEVELOPMENT.md — Tech stack](DEVELOPMENT.md#tech-stack) and
[DEVELOPMENT.md — Project structure](DEVELOPMENT.md#project-structure).

## Architecture

- **Background runtime** holds the single source of truth: an in-memory
  `injections` list and `settings`, both persisted to `chrome.storage`. It runs
  as a service worker in Chromium and a background page in Firefox.
- **Content script** runs at `document_start` on `<all_urls>`. On load it sends
  a `GET_INJECTIONS_CODE` message to the background, receives matching JS/CSS,
  and executes them on the page.
- **Popup** queries the background for the current tab's state (matching rules,
  blacklisted?) and provides per-rule, per-site, and global toggles plus an
  "add rule for this site" deep link into the options page.
- **Options page** manages injection rules: create/edit in a modal (site plus
  an optional JS and/or CSS path — at least one required), duplicate,
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

## File Access Method Policy

Build and development commands are listed in
[DEVELOPMENT.md — Available commands](DEVELOPMENT.md#available-commands).

Chrome and Edge default to browser-managed file-URL access. Their Native Host
mode is an Advanced opt-in and its `nativeMessaging` permission must remain
optional; request it only from an explicit Advanced Options action. Firefox is
Native Host-only and declares `nativeMessaging` as required. Never silently
fall back between the selected methods. Chromium may offer an explicit popup
action to return an unavailable Native Host selection to browser access; that
action must persist the method before removing the unused optional permission.

## Native Host Safety

- The host is read-only. Never add file writes, directory listing, file or
  subprocess execution, shell access, or network operations.
- Treat every native message as untrusted. Preserve the 64 KiB request bound,
  sub-1 MiB response envelopes, 512 KiB raw chunks, and 5 MiB logical limit.
- Standard output is protocol-only. Send minimal diagnostics to standard error
  and never log local file contents.
- Update the JSON Schema, Go structures, and TypeScript validators together.
- Firefox authorization uses only `kode-injector@maximtop.dev`. Chromium
  manifests use explicit origins without wildcards. Never infer IDs by scanning
  browser profiles.
- Never expose Apple signing identities, notarization profiles, release tokens,
  or other credentials in source files or logs.
- The managed macOS manifests must point directly to the signed host inside
  `Kode Injector Helper.app/Contents/Helpers/`. Never add a second hidden host
  copy, daemon, login item, privileged helper, auto-updater, or profile scan.
- The graphical app may invoke only its fixed bundle-relative installer with
  the closed `status`, `install`, and `uninstall` actions. Never pass
  user-controlled paths or arguments, invoke a shell, or inherit an unsafe
  process environment.
- Keep platform, architecture, lifecycle, action, and error domains as closed
  enums/constants. Do not repeat magic platform strings or release asset names.
- Sign nested helpers before the outer app without `codesign --deep`. Notarize,
  staple, and validate the app before creating and separately notarizing the
  DMG. Recreate checksums only after final stapling.
- Run `(cd native-host && go test -race ./...)`,
  `swift test --package-path native-host/macos-helper`,
  `pnpm native:macos:validate`, `pnpm native:validate`, and `pnpm validate`
  after native-host lifecycle or packaging changes.

## Testing

Build helper tests run with `pnpm test:build`. Extension behavior is verified
with headless Playwright smoke tests that load the unpacked extension and test
target sites.

Tests must verify observable behavior. Do not mirror repository-owned source,
workflow, manifest, locale, configuration, or exported constants in test
expectations merely to pin their current contents. Parsing JSON/YAML or importing
a constant does not make such an assertion behavioral. Exercise transformation
logic with synthetic inputs, inspect artifacts actually produced by code, and
use schemas or linters for externally defined formats. When meaningful execution
is not practical, document a manual verification instead of testing that source
text or duplicated literal values are present or ordered.

### Extension smoke testing

Browser smoke and regression checks MUST run headlessly in CI and unattended
automation. A headed run is allowed only for explicit local debugging. Configure
the default once in `playwright.config.ts`; the custom fixture must consume the
resolved Playwright project value rather than adding a separate Chromium
headless flag. Launch Playwright's bundled Chromium with a newly created
temporary `userDataDir` and the built extension:

```ts
const { headless } = testInfo.project.use;
const context = await chromium.launchPersistentContext(userDataDir, {
    channel: 'chromium',
    headless,
    args: [
        '--disable-extensions-file-access-check',
        `--disable-extensions-except=${extensionPath}`,
        `--load-extension=${extensionPath}`,
    ],
});
```

Derive the extension ID from the MV3 service-worker URL and assert file access
with `isAllowedFileSchemeAccess()` before testing. Teardown must close the
context and remove the temporary profile. Use `build/dev/chrome/` for local
workflow checks. A local headed run must still use the temporary profile and
close all pages afterward. Never attach to a user's browser session, reuse a
user profile, or leave test tabs open.
