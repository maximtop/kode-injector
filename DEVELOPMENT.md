# Development

This document describes how to set up the development environment, build the
extension, and contribute to the project.

## Prerequisites

- [Node.js 24 LTS](https://nodejs.org/)
- [pnpm](https://pnpm.io/) package manager
- [Go 1.26](https://go.dev/) for the native host
- Xcode 16 or newer, including the Swift 6 toolchain and command-line tools,
  for the macOS helper application and disk images

## Getting started

```sh
git clone https://github.com/maximtop/kode-injector.git
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
| `make native_test` | Run native-host tests with the race detector |
| `make native_package` | Build native release packages (the Edge store ID is optional) |

Equivalent `pnpm` scripts:

```sh
pnpm install   # install dependencies
pnpm dev       # one-shot development build for every browser
pnpm dev chrome --watch # watch one development target
pnpm release   # release build for every browser
pnpm lint      # run ESLint over source, scripts, and the Rspack config
pnpm typecheck # validate TypeScript and TSX without emitting files
pnpm test      # run build-helper and localization tests
pnpm exec playwright install chromium # one-time local Chromium installation
pnpm test:e2e  # build dev Chrome and run the headless core injection E2E
pnpm locales:validate # validate all locale catalogs and UI usage
pnpm validate  # run the complete local quality gate
pnpm native:test # run Go unit and subprocess tests with race detection
pnpm native:validate # cross-compile and inspect all native packages
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
5. Open the extension's details and enable **Allow access to file URLs** for
   the default browser-file access method.

The extension reloads automatically when source files change. Use the reload
button on the extension card in `chrome://extensions/` after content-script
or background changes.

### Testing local-file access in unpacked builds

Build every unpacked target:

```sh
pnpm dev
```

- Load `build/dev/chrome/` from `chrome://extensions`.
- Load `build/dev/edge/` from `edge://extensions`.
- Load `build/dev/firefox/manifest.json` from `about:debugging` → **This
  Firefox** → **Load Temporary Add-on**.

Firefox Native Messaging uses the stable Gecko ID
`kode-injector@maximtop.dev`; the changing `moz-extension://` UUID is not an
authorization ID. Use separate Firefox profiles if development and release
builds must coexist. Firefox supports only the Native Host method, so install
the package before testing injection there.

Chrome and Edge use browser file access by default. Enable **Allow access to
file URLs** on the unpacked extension's details page and confirm that Options
dismisses its warning after **Check again**. This path does not require the
Native Host or `nativeMessaging`.

To test Native Host as an optional Chromium method, expand **Advanced** in
Options, choose **Use Native Host**, and accept the browser's permission request.
Chrome and Edge show their unpacked IDs on their extension-management pages. Copy
`native-host/dev-extension-ids.example.json` to the gitignored
`native-host/dev-extension-ids.json`, enter those IDs, and run the packaged
installer's contributor-only command. On macOS, after copying the app to
Applications, run it explicitly from the repository root:

```sh
"/Applications/Kode Injector Helper.app/Contents/Helpers/kode-injector-installer" \
  development \
  --ids native-host/dev-extension-ids.json \
  --confirm
```

Linux and Windows contributors use the equivalent installer executable from
their extracted platform package. The command prints the exact
`chrome-extension://<id>/` origins and requires confirmation before updating
development registrations. If an unpacked ID changes, update the local file
and repeat the command. This copy-based development path is intentionally
separate from the end-user app lifecycle; there are no end-user changing-ID
controls, profile scanning, wildcard origins, or Makefile install shortcuts.

Switching back with **Use browser file access**, either in Advanced Options or
from the compact popup warning shown when Helper is unavailable, removes the
optional Chromium `nativeMessaging` permission. Permission requests must
originate from the Advanced Options user action; background code must never
request it automatically or silently fall back between methods.

### Headless core injection E2E

Install Playwright's bundled Chromium once, then run the self-contained test:

```sh
pnpm exec playwright install chromium
pnpm test:e2e
```

The default is configured once as `DEFAULT_HEADLESS` in
`tests/e2e/playwright.config.ts`. To watch the browser during local debugging,
build first and use Playwright's standard override:

```sh
pnpm dev chrome
pnpm test:e2e:run --headed
```

The test creates an isolated temporary profile, loads `build/dev/chrome`,
enables file access only through Chromium's automation switch, adds one rule
through the real Options UI, and verifies real local JavaScript and CSS on a
matching loopback hostname. It also verifies that a second hostname is not
modified. It never opens a visible window, uses an installed browser profile,
or requires Kode Injector Helper.

`pnpm test:e2e:run` skips the build and is intended for CI. Set
`KODE_INJECTOR_E2E_EXTENSION_PATH=build/release/chrome` to test an existing
release candidate. `pnpm validate` remains browser-independent; GitHub CI and
the Release workflow install Chromium and run E2E explicitly.

Firefox/Native Host, Edge-specific packaging, popup controls, localization,
and target-page CSP behavior are outside this minimal scenario.

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
    archive-plugin.ts     # Browser ZIP archive plugin
    helpers.ts            # Manifest & locale transforms
rspack.config.ts          # Typed Rspack and SWC configuration
build/                    # Build output (dev/ and release/)
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

Chrome Web Store deployment is automated by the `Deploy Chrome Web Store`
workflow. Publishing a GitHub Release for a `vX.Y.Z` tag verifies the
release's `chrome.zip` against `SHA256SUMS` and the tag version, uploads it to
the store item with a pinned `go-webext`, and submits it for review with
deferred publishing. Nothing goes live automatically: when the review verdict
email arrives, publish the approved version manually in the Chrome Web Store
Developer Dashboard. An approved staged submission expires back to a draft
after about 30 days if left unpublished.

The workflow can also be started manually from the Actions tab for an
already-published release tag. That is required for releases whose tag
predates the workflow (their `published` event runs the workflow tree at the
tagged commit, which lacks it) and for re-deploying after a staged submission
expired.

Configure these sensitive repository secrets:

- `CHROME_CLIENT_ID` and `CHROME_CLIENT_SECRET` — the OAuth 2.0 client ID and
  secret of a **Web application** client with
  `https://developers.google.com/oauthplayground` as an authorized redirect
  URI, created on the Credentials page of the Google Cloud Console project
  that has the Chrome Web Store API enabled (mirrored from the local `.env`)
- `CHROME_REFRESH_TOKEN`
- `CHROME_PUBLISHER_ID` (shown on the Developer Dashboard account page)

Configure this repository variable:

- `CHROME_APP_ID` (the public store item ID)

The Google Cloud OAuth consent screen backing these credentials must be in
the "In production" status: refresh tokens issued while it is in "Testing"
are revoked after seven days. An unused refresh token also expires after
about six months. To obtain a new refresh token, open the
[Google OAuth Playground](https://developers.google.com/oauthplayground/),
enable "Use your own OAuth credentials" (gear icon) with the client ID and
secret, authorize the `https://www.googleapis.com/auth/chromewebstore`
scope, exchange the authorization code for tokens, and copy the issued
`refresh_token` into `.env`. Verify the credentials by exchanging the
refresh token for an access token:

```sh
source .env
curl -s "https://oauth2.googleapis.com/token" -d \
  "client_id=$CHROME_CLIENT_ID&client_secret=$CHROME_CLIENT_SECRET&grant_type=refresh_token&refresh_token=$CHROME_REFRESH_TOKEN"
```

Then update the `CHROME_REFRESH_TOKEN` secret. If the store API answers
`deleted_client`, the OAuth client itself was removed: create a new Web
application client (redirect URI
`https://developers.google.com/oauthplayground`), update
`CHROME_CLIENT_ID`/`CHROME_CLIENT_SECRET` locally and in the GitHub secrets,
and issue a fresh refresh token.

Failure playbook:

- **Authentication failure (`deleted_client`, `invalid_grant`, 401)**: the
  OAuth client or refresh token is dead. Recreate the credentials per the
  runbook above, update the GitHub secrets, and re-run the workflow —
  nothing was uploaded to the store.
- **Upload stuck `IN_PROGRESS` or a previous submission still in review**:
  the run fails without submitting anything. Re-run it after the store
  settles — re-uploading the same version replaces the unsubmitted draft.
- **Submission rejected after review**: no workflow fails; the verdict
  arrives by store email days after a green run. Read the reasons in the
  dashboard, then appeal, ship a fixed version through a new release, or
  resubmit the same version from the dashboard if only listing metadata was
  at fault.
- **Staged submission expired**: start the workflow manually for the same
  release tag.

The local fallback uses the `Makefile` targets below and the local
`go-webext` checkout. Store credentials and app IDs are stored in `.env`
(gitignored).

| Command | What it does |
| --- | --- |
| `make chrome_status` | Check the status of the Chrome Web Store item |
| `make chrome_update` | Upload a new build to the Chrome Web Store |

## Releases

1. Bump the `version` field in `package.json`.
2. Run `make build` to produce the browser directories and ZIPs under
   `build/release/`.
3. Push the matching version tag to create a GitHub Draft Release containing
   the same store-ready `chrome.zip`, `edge.zip`, and `firefox.zip` artifacts.
4. After checking the draft assets, publish the GitHub Release. Publishing
   triggers the Chrome Web Store deployment automatically; Edge and Firefox
   submission remains manual until the remaining item in `TODO.md` is done.
5. When the store review completes, publish the approved version manually in
   the Chrome Web Store Developer Dashboard.

## Native host development and releases

The native host lives in `native-host/` and uses protocol v1 from
`.sdd/.current/contracts/native-messaging.schema.json`. Requests and responses
are 32-bit little-endian length-prefixed JSON. Host responses stay below 1 MiB;
logical UTF-8 files are limited to 5 MiB and use 512 KiB raw chunks.

Per-user manifests are installed in each browser's documented
`NativeMessagingHosts` location. Windows uses the Mozilla, Google Chrome, and
Microsoft Edge HKCU registry keys. macOS and Linux use browser-specific manifest
directories. In the managed macOS flow, every manifest points directly to the
signed host at `Kode Injector Helper.app/Contents/Helpers/kode-injector-native`;
the application never creates a second hidden executable copy. The legacy
copy-install code remains only for Linux, Windows, and the explicit unpacked-ID
contributor flow.

Firefox declares `nativeMessaging` as a required permission. Chrome and Edge
declare it in `optional_permissions`; existing Chromium users remain on browser
file access unless they explicitly choose Native Host under **Advanced** in
Options. This avoids a new required-permission prompt or upgrade disablement for
those users. A missing selected Helper produces an explicit popup action that
returns to browser access; it never changes the method without a user click.

`pnpm native:package` produces these stable, separate release assets under
`build/native/<version>/`:

- `kode-injector-helper-macos-intel.dmg`
- `kode-injector-helper-macos-apple-silicon.dmg`
- `kode-injector-native-linux-x86-64.tar.gz`
- `kode-injector-native-linux-arm64.tar.gz`
- `kode-injector-native-windows-x86-64.zip`
- `kode-injector-native-windows-arm64.zip`
- `SHA256SUMS`

Options constructs a version-matched public URL of the form
`https://github.com/maximtop/kode-injector/releases/download/v<version>/<asset>`
from `runtime.getManifest().version` and `runtime.getPlatformInfo()`. It never
uses a moving latest-release alias, guesses an unsupported target, or calls the GitHub API;
unknown values fall back to the complete Releases page. Consequently the draft
must be manually published before these end-user links become available.

Each macOS disk image contains one architecture-specific `Kode Injector
Helper.app` and an Applications symlink, with no root-level executable. The app
has a normal Dock/Finder identity and this signed layout:

```text
Kode Injector Helper.app/
  Contents/
    Info.plist
    MacOS/Kode Injector Helper
    Resources/AppIcon.icns
    Helpers/kode-injector-native
    Helpers/kode-injector-installer
```

Run `pnpm native:macos:test` for the dependency-free Swift tests and
`pnpm native:macos:validate` for Swift, Go, Info.plist, bundle-layout, and exact
architecture checks. The production Chrome origin is always the Chrome Web
Store ID
`fgdehkdkmaiedleekbjpfoicpmodbicg`. `KODE_INJECTOR_EDGE_ID` is optional: when
it is unset, production Chromium manifests contain only the Chrome origin. An
unpacked Edge build remains available through the explicit
development-registration flow described above; no wildcard origin is added.

The end-user macOS lifecycle is deliberately graphical and per-user: drag the
app to `/Applications`, or use Finder's **Go → Home** command, create the
`Applications` folder if needed, and drag it to `~/Applications` without an
administrator password. Open the installed copy and use **Install**,
**Repair/Reinstall**, or confirmed **Uninstall**. Reopening the app from Finder,
Spotlight, or Launchpad shows the current host path and all three registration
states. After Uninstall removes only Kode Injector registrations, the user moves
the app to Trash. The app has no daemon, login item, privileged helper,
automatic updater, network client, shell invocation, or arbitrary command
arguments.

### GitHub Actions validation

The `CI` workflow runs for pushes to `master` and pull requests. It validates
the extension with Node.js 24 and pnpm, runs the headless core injection E2E,
builds every browser release artifact, and runs the Go 1.26 native-host suite
with the race detector. CI has read-only repository permissions and never
publishes a release.

The `Release` workflow builds `chrome.zip`, `edge.zip`, and `firefox.zip` on a
GitHub-hosted Linux runner and retains them as store-ready artifacts. A separate
GitHub-hosted macOS runner signs the two nested helpers inside-out and then
signs the outer app; signing commands must not use `--deep`. Each architecture
is notarized twice: first a ZIP of the app is submitted, accepted, stapled, and
validated, then the disk image is rebuilt around that stapled app, signed,
submitted, stapled, and validated. Final checks use `codesign`, `stapler`,
`syspolicy_check distribution`, `spctl --type execute` for the mounted app, and
`spctl --type open` for the DMG. `SHA256SUMS` is regenerated after final
stapling and extended with the three browser-extension archives before the
draft release is created.

The `Deploy Chrome Web Store` workflow runs when a GitHub Release is
published (or manually from the Actions tab for an existing release tag). It
re-verifies `chrome.zip` against the release `SHA256SUMS` and the tag
version, uploads it with a pinned `go-webext`, and submits it for review with
deferred publishing. It has read-only repository permissions and uses the
`CHROME_*` secrets and variable listed in the Deployment section; deployments
are serialized through a concurrency group so runs never interleave.

Configure
these sensitive repository secrets:

- `APPLE_CERTIFICATE_P12_BASE64`
- `APPLE_CERTIFICATE_PASSWORD`
- `APPLE_NOTARY_KEY_P8_BASE64`

Configure these repository variables:

- `APPLE_DEVELOPER_ID`
- `APPLE_NOTARY_KEY_ID`
- `APPLE_NOTARY_ISSUER_ID`
- `KODE_INJECTOR_EDGE_ID` (optional, after the extension is published in Edge
  Add-ons)

The workflow imports the Developer ID certificate into a temporary keychain
and decodes the App Store Connect API key only for the job. It removes both even
when a step fails. Never print these values. For local notarization,
set `APPLE_NOTARY_KEY_PATH`, `APPLE_NOTARY_KEY_ID`, and
`APPLE_NOTARY_ISSUER_ID` together for direct API-key authentication, or set
`APPLE_NOTARY_PROFILE` as the keychain-profile alternative. Do not combine the
two modes. Windows artifacts remain unsigned until a signing certificate is
configured.

Before creating a tag, run the signing preflight:

1. Open **Actions** → **Release** and choose **Run workflow**.
2. Wait for validation, packaging, signing, notarization, stapling, and checksum
   verification to complete.
3. Download and inspect the retained `kode-injector-helper-<version>` and
   `kode-injector-extensions-<version>` workflow artifacts. They expire after
   30 days. A manual run does not create a GitHub Release.

To prepare a release:

1. Set `package.json` to the intended semantic version and merge the change to
   `master`.
2. Create a matching tag, such as `v0.9.0`, on that `master` commit and push it.
3. Wait for the workflow to verify the tag, rebuild and sign the packages, and
   create an unpublished [GitHub Draft Release](https://github.com/maximtop/kode-injector/releases).
4. Download the draft assets and inspect `chrome.zip`, `edge.zip`,
   `firefox.zip`, the native platform archives, both notarized macOS DMGs, both
   independently stapled apps, and `SHA256SUMS`. For the final manual
   Gatekeeper gate, download each DMG through a browser on a clean test account,
   verify quarantine is present, launch the app from the mounted image and
   Applications without bypassing Gatekeeper, test Install/Repair/Uninstall,
   and repeat once without network access to confirm the stapled tickets work.
5. If the candidate is correct, click **Publish release** in the GitHub UI.

The workflow refuses a tag that does not match `package.json`, does not point to
a `master` commit, or already has a GitHub Release. It never silently replaces
existing release assets.
