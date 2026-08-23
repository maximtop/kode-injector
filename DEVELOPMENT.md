# Development

This document describes how to set up the development environment, build the
extension, and contribute to the project. Coding conventions, architecture
notes, and safety rules live in [AGENTS.md](AGENTS.md).

## Prerequisites

- [Node.js 24 LTS](https://nodejs.org/)
- [pnpm](https://pnpm.io/) package manager
- [Go 1.26](https://go.dev/) for the native host
- Xcode 16 or newer, including the Swift 6 toolchain and command-line tools,
  for the macOS helper application, Safari app, and disk images

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
pnpm test:e2e  # build dev Chrome + Safari resources and run the headless E2E suites
pnpm locales:validate # validate all locale catalogs and UI usage
pnpm validate  # run the complete local quality gate
pnpm native:test # run Go unit and subprocess tests with race detection
pnpm native:validate # cross-compile and inspect all native packages
pnpm dev safari # build shared Safari WebExtension resources only
pnpm safari:build # build Swift tests, current-arch helper, and ad-hoc Safari app
pnpm safari:validate # build and validate the Safari bundle and entitlements
pnpm safari:fixture # create JS/CSS fixtures and serve a localhost target
pnpm safari:store:check # build and validate an unsigned universal App Store archive
pnpm safari:store:archive # build a signed App Store archive
pnpm safari:store:validate # validate the existing signed archive
pnpm safari:store:upload # explicitly upload the signed archive to App Store Connect
```

## Build channels and browser targets

The build CLI accepts `chrome`, `edge`, `firefox`, or explicit `safari` as an
optional browser subcommand. Omitting the browser continues to build the three
store extension targets only:

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

Safari WebExtension resources are emitted under `build/dev/safari/`. They are
not a complete installable artifact until `pnpm safari:build` embeds them in
`build/safari/dev/Kode Injector.app` together with the native extension and
current-architecture Go helper.

Release resources are embedded by Xcode before signing. The Mac App Store build
uses a universal helper and an inside-out signature order; generated resources
or executables are never added to a signed archive afterward. Full setup and
release instructions are in [`safari/APP_STORE.md`](safari/APP_STORE.md).

### Testing Safari locally

1. Run `pnpm safari:build`.
2. Copy `build/safari/dev/Kode Injector.app` to `/Applications` manually.
3. Launch the app and click **Open Safari Extension Settings**.
4. If required for the ad-hoc development build, enable Safari's developer
   option **Allow Unsigned Extensions**, then enable Kode Injector.
5. Run `pnpm safari:fixture` and copy its printed site, JavaScript, and CSS URLs
   into a new rule.
6. Save the rule and authorize the exact folder shown by macOS. Selecting a
   different folder is rejected. Reload the printed localhost page to verify
   both JavaScript and CSS injection.
7. On a clean profile with no rules, Rules shows the **Demo** card. **Run
   Demo** opens `https://example.com/` in one tab and applies the fixed
   `demo/example-com.js` and `demo/example-com.css` shipped only in the Safari
   build; allow website access if Safari asks. Adding the first rule ends the
   demo. The launch is kept in `storage.session`, so it survives background
   unloads until the tab closes or Safari quits. The containing app's
   **Try Demo** button opens Safari's extension settings while the extension
   is disabled and otherwise asks the running background to open Rules.

Safari requests folder access only from the explicit Add/Save action. A
background page load never opens a picker. Read-only security-scoped bookmarks
are stored by the native extension and survive Safari restarts; edit and save a
rule again to restore a stale or missing grant. The build scripts never copy an
app into `/Applications` or modify that directory.

Safari uses a memory-only stale-while-revalidate source cache after the first
successful read. A page load receives one complete cached JS/CSS snapshot per
rule immediately, while a single background refresh prepares the next page
load. When testing an external file edit, reload once to refresh and a second
time to observe the new snapshot. A failed refresh invalidates that rule before
the next load, and rule mutations invalidate it immediately. The cache has no
fixed TTL, but it disappears whenever Safari suspends or restarts the extension
process.

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

`pnpm test:e2e` builds `build/dev/chrome` and the Safari WebExtension
resources in `build/dev/safari`, then runs two suites in an isolated temporary
profile: the core injection test loads the Chrome build, enables file access
only through Chromium's automation switch, adds one rule through the real
Options UI, and verifies real local JavaScript and CSS on a matching loopback
hostname (and nothing on a second hostname); the built-in demo test loads the
Safari-built resources into the same headless Chromium, serves
`https://example.com/` locally through Playwright routing, and verifies one
demo tab, one JavaScript and one CSS effect per document across 20 reloads,
no effect in unrelated tabs, the Settings link, rule-based deactivation, and
the paused state, plus the absence of the demo card in the Chrome build. It
never opens a visible window, uses an installed browser profile, or requires
Kode Injector Helper.

`pnpm test:e2e:run` skips the builds and is intended for CI. Set
`KODE_INJECTOR_E2E_EXTENSION_PATH=build/release/chrome` and
`KODE_INJECTOR_E2E_SAFARI_EXTENSION_PATH=build/release/safari` to test
release candidates. `pnpm validate` remains browser-independent; GitHub CI and
the Release workflow install Chromium and run E2E explicitly.

Firefox/Native Host, Edge-specific packaging, popup controls, localization,
and target-page CSP behavior are outside this minimal scenario.

## Tech stack

- **Runtime:** Manifest V3 browser extension (Chrome / Firefox / Edge / macOS Safari)
- **UI:** React 19, MobX 6, Mantine 9
- **Bundling:** Rspack 2 with built-in SWC
- **Styling:** PostCSS with `postcss-import`, `postcss-preset-env`,
  `postcss-nested`, and `postcss-svg`; CSS Modules via Rspack native CSS.
  Design tokens live in `src/app/common/styles/tokens.pcss` (light + dark
  schemes keyed to `data-mantine-color-scheme`); Mantine component overrides
  in `src/app/common/styles/mantine-overrides.pcss`. The selected theme is
  persisted in the localStorage key `kode-injector-color-scheme` shared by
  the options page and popup
- **Polyfill:** `webextension-polyfill` for cross-browser APIs
- **Linting:** ESLint with the Airbnb config; 4-space indentation

## Project structure

```
src/
  manifest.json              # MV3 manifest (version injected at build time)
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
      components/            # OptionsApp, Topbar, InjectionsView, RuleEditorModal, SettingsView, Footer
      stores/InjectionsStore.ts, RootStore.ts
    popup/
      index.tsx             # Popup root
      components/            # PopupApp, Header, PausedStrip, AccessBlock, SiteBlock, RulesList, EmptyCta, Footer
      stores/RootStore.ts, SettingsStore.ts
  pages/                     # Rspack entry points (HTML + TypeScript bootstrap)
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
native-host/                # Shared Go native messaging host and installer
safari/                     # macOS containing app and Safari native bridge
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
| `make edge_update` | Upload `edge.zip` to an existing Edge product |
| `make edge_publish` | Submit the Edge draft for certification |
| `make firefox_status` | Check the status of the AMO listing |
| `make firefox_update` | Upload `firefox.zip` + `source.zip` to AMO for review |

Firefox Add-ons deployment is automated by the separate `Deploy Firefox
Add-ons` workflow. Publishing a GitHub Release verifies the release's
`firefox.zip`, `source.zip`, and `approval-notes.txt` against `SHA256SUMS`,
the tag version, and the `kode-injector@maximtop.dev` gecko ID, then uploads
the package and its source to the listed AMO channel with a pinned
`go-webext`, passing the notes through the AMO `approval_notes` field. The
workflow only submits: Mozilla reviews and signs asynchronously, from hours
to days, and publishes the version automatically once approved, so there is
no publish step on our side. It keeps its own concurrency group and runs
independently of the Chrome deployment.

AMO requires the source archive because the release bundle is minified.
`source.zip` and `approval-notes.txt` are produced by the Firefox release
build itself through `SourceArchivePlugin`: the archive is the committed
repository state of the tag (`git archive`), with one difference — the
`README.md` inside it gains a "Building Instructions for Firefox Add-ons
Review Team" section in place of the invisible `<!-- TOC:AMO_REVIEW -->`
anchor in the repository README's table of contents. Do not remove that
anchor; the release build fails without it. Because the archive snapshots
`HEAD` rather than the working tree, a local release build packages the last
commit — CI always builds a clean tag checkout. Rebuilding from the archive
with `pnpm release firefox` reproduces the submitted package; such builds are
not git checkouts, so they skip the nested source archive with a warning.

The workflow can also be started manually from the Actions tab for an
already-published release tag. Releases published before these assets existed
(v0.9.1 and older) are refused before anything reaches AMO: the workflow
requires `firefox.zip`, `source.zip`, and `approval-notes.txt` to be present
on the release and covered by `SHA256SUMS`. Submit those releases from the
Developer Hub manually instead.

Configure these sensitive repository secrets for Firefox:

- `FIREFOX_CLIENT_ID` — the JWT issuer from the
  [AMO API credentials page](https://addons.mozilla.org/en-US/developers/addon/api/key/)
  (mirrored from the local `.env`)
- `FIREFOX_CLIENT_SECRET` — the JWT secret from the same page

AMO credentials belong to the Mozilla account, not to a single add-on. A
`401 Unknown JWT iss (issuer)` means the issuer no longer exists: generate a
new credential pair on the page above, then update both `.env` and the
GitHub secrets. The local `.env` also needs
`FIREFOX_APP_ID=kode-injector@maximtop.dev` for `make firefox_status`; the
workflow reads the ID from the built manifest instead.

Failure playbook:

- **`json: cannot unmarshal array into Go struct field
  AddonInfo.categories`**: a known go-webext v0.4.2 limitation, not a
  deployment failure. AMO now returns `categories` as an array of slugs
  while go-webext still expects the older object shape, so `status` and
  `insert` cannot decode the response. The upload path (`update`) never
  reads that struct and is unaffected; the workflow downgrades the status
  step to a warning so a submitted version is not reported as a failed
  deploy. `make firefox_status` surfaces the raw error until go-webext is
  fixed — read the listing in the Developer Hub meanwhile.
- **Authentication failure (401)**: see the credential runbook above.
  Nothing was uploaded.
- **Upload rejected during AMO validation**: the run fails before a version
  is created. Read the validation messages in the log, fix the package, and
  ship a new release.
- **`version already exists` during version creation**: the tag was already
  submitted — typically a re-run of a green deploy. The existing AMO
  submission is untouched and there is nothing to redo. If that version
  genuinely must be re-uploaded, delete it in the Developer Hub first, then
  re-run the workflow.
- **Submission rejected after review**: no workflow fails; the verdict
  arrives by email days after a green run. Address the reasons and ship a
  fixed version through a new release.

Microsoft Edge Add-ons deployment is automated by the separate `Deploy
Microsoft Edge Add-ons` workflow for updates to an already-published product.
Publishing a GitHub Release verifies `edge.zip` against `SHA256SUMS` and the
tag version, uploads it with pinned `go-webext` v0.4.2 and the Edge API v1.1,
then submits the draft for certification. Microsoft processes certification
asynchronously and publishes an accepted update according to the listing's
availability settings.

The Microsoft API cannot create a product or update its listing metadata. The
first release must therefore be completed in Partner Center:

1. Create the extension product and upload a store-ready `edge.zip` from a
   published GitHub Release.
2. Complete Availability, Properties, Privacy, and every enabled Store listing.
   Use `assets/store/edge-listing.md`, the localized copy under
   `assets/store/edge-listings/`, the other files under `assets/store/`, and
   the public `PRIVACY.md` as the maintained sources.
3. Submit the first release for certification and wait until it is **In the
   store**. The Update API is for an existing published product.
4. Copy the Product ID GUID from the Partner Center URL. This is the
   `EDGE_PRODUCT_ID` used by `go-webext`; it is not the public extension ID.
5. Open the Partner Center **Publish API** page, create a v1.1 API key, and
   record its Client ID and one-time key value.
6. Configure the GitHub Actions values below. Future published releases then
   upload and submit automatically.

Configure these sensitive repository secrets for Edge:

- `EDGE_CLIENT_ID` — the Client ID shown on the Partner Center Publish API page
- `EDGE_API_KEY` — an active v1.1 key from the same page

Configure this repository variable:

- `EDGE_PRODUCT_ID` — the Partner Center product GUID

API keys expire after 72 days, and Partner Center shows the exact expiry.
Rotate the key before that date and update `EDGE_API_KEY`; never print it or
commit it to source control. For local fallback, put the credentials in the
gitignored `.env`, using dotenv quoting when the key contains special
characters, and use `make edge_update` followed by `make edge_publish`. These
targets pin API v1.1 and let `go-webext` parse the credential values directly
so make does not alter quoted or special characters.

The Publish API accepts certification notes, but `go-webext` v0.4.2 does not
send them and has no Edge notes option. Keep stable reviewer guidance in the
Partner Center listing; if the review steps need to change for a release,
update them manually before the workflow submits that release.

The Edge Product ID and public Edge extension ID serve different purposes. The
32-letter public ID becomes available from the store listing and belongs in
the `KODE_INJECTOR_EDGE_ID` repository variable. Release builds use it only to
authorize the optional Native Host origin. A missing value does not affect the
default browser-managed file access, but the Advanced Native Host mode will not
work for a store-installed Edge build until a later release and matching
Helper packages are built with that ID.

Edge failure playbook:

- **Authentication failure (401/403)**: the v1.1 key is missing, expired, or
  does not match the Client ID. Create a new key, update `EDGE_API_KEY`, and
  re-run the workflow. Nothing is uploaded when authentication fails.
- **Upload timeout after package processing remains `InProgress`**:
  `go-webext` v0.4.2 bounds its processing wait at one minute. Check the draft
  in Partner Center, wait for processing to settle, and re-run if no package
  was accepted.
- **Submission already in review**: Microsoft permits only one active
  submission. Wait for certification to finish before starting another
  deployment.
- **Publish step reports `InProgress` in a green run**: the submission request
  was accepted and continues asynchronously. `go-webext` v0.4.2 checks the
  publish operation only once; monitor Partner Center for the final result.
- **Listing or privacy metadata change**: update it manually in Partner Center;
  the Update API manages packages and submissions only.
- **Certification rejection**: the verdict arrives through Partner Center and
  email after the workflow finishes. Address the feedback, then submit a fixed
  release or metadata update.

Mac App Store uploads are automated by the separate `Deploy Apple App Store`
workflow. It runs on the Xcode 26 macOS image, builds a universal signed
archive directly from the published tag, verifies its nested layout and
metadata, then uploads the build to App Store Connect. Uploading does not
submit a version for App Review.

The one-time app record, explicit identifiers, listing and privacy metadata,
Apple Distribution certificate, protected GitHub Environment, and API-key
configuration are documented in
[`safari/APP_STORE.md`](safari/APP_STORE.md). These credentials are separate
from the Developer ID and notarization credentials used for the downloadable
Kode Injector Helper app.

## Releases

The version in `package.json` is the single source of truth (the manifest,
the Safari bundles, and the AMO source archive all derive from it), and a
release tag must point at a `master` commit that already carries that
version. The **Start release** workflow does both steps:

1. **Actions → Start release → Run workflow**, enter the next version
   (`X.Y.Z`). The workflow bumps `package.json` on `master` (commit “Bump
   version to <version>” by `github-actions[bot]`), creates the `v<version>`
   tag on that commit, and starts the **Release** workflow on the tag, which
   builds the store-ready `chrome.zip`, `edge.zip`, `firefox.zip`,
   `source.zip`, `approval-notes.txt`, the signed Helper packages, and
   creates a GitHub Draft Release. The version must be higher than the
   current one and its tag must not exist yet.
2. After checking the draft assets, publish the GitHub Release. Publishing
   triggers the Chrome Web Store, Firefox Add-ons, Microsoft Edge Add-ons, and
   Apple App Store deployment workflows automatically. Edge and Apple
   automation start only after their one-time store setup and repository
   configuration are complete.
3. When the store review completes, publish the approved version manually in
   the Chrome Web Store Developer Dashboard.

Bumping `package.json` by hand, merging it, and pushing the matching
`vX.Y.Z` tag still triggers Release directly. If Start release fails after
its commit landed (for example the tag push was interrupted), push the tag by
hand: `git tag v<version> origin/master && git push origin v<version>`.

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

The `Release` workflow builds `chrome.zip`, `edge.zip`, `firefox.zip`, and the
AMO review assets (`source.zip`, `approval-notes.txt`) on a GitHub-hosted
Linux runner and retains them as store-ready artifacts. A separate
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

The `Deploy Microsoft Edge Add-ons` workflow applies the same release-asset
and version checks to `edge.zip`, uploads it to the configured existing
product through API v1.1, and requests certification. Edge deployments use a
separate concurrency group. A successful run means the package was processed
and the submission request was accepted; certification and publication remain
asynchronous in Partner Center.

The `Deploy Apple App Store` workflow independently rebuilds the published tag
on `macos-26`, creates and validates a universal Xcode archive, and uploads the
build for App Store Connect processing. The protected `apple-app-store`
environment contains the Apple Distribution certificate and App Store Connect
API key. App Review submission remains manual.

For the canonical 1Password item layout, current field names, and migration
mapping from older `.env` names, see
[`scripts/release/ONEPASSWORD.md`](scripts/release/ONEPASSWORD.md). The checked-in
[`1password.env.example`](scripts/release/1password.env.example) contains only
`op://` references and no credentials.

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
   30 days. A manual run on a branch does not create a GitHub Release; a run
   on a tag (which is how Start release starts it) does.

To prepare a release:

1. Run **Start release** with the intended semantic version. It commits the
   `package.json` bump to `master`, creates the matching tag, such as
   `v0.9.0`, on that commit, and starts Release on it.
2. (Alternatively set `package.json` by hand, merge it, and push the tag.)
3. Wait for the workflow to verify the tag, rebuild and sign the packages, and
   create an unpublished [GitHub Draft Release](https://github.com/maximtop/kode-injector/releases).
4. Download the draft assets and inspect `chrome.zip`, `edge.zip`,
   `firefox.zip`, `source.zip`, `approval-notes.txt`,
   the native platform archives, both notarized macOS DMGs, both
   independently stapled apps, and `SHA256SUMS`. For the final manual
   Gatekeeper gate, download each DMG through a browser on a clean test account,
   verify quarantine is present, launch the app from the mounted image and
   Applications without bypassing Gatekeeper, test Install/Repair/Uninstall,
   and repeat once without network access to confirm the stapled tickets work.
5. If the candidate is correct, click **Publish release** in the GitHub UI.

The workflow refuses a tag that does not match `package.json`, does not point to
a `master` commit, or already has a GitHub Release. It never silently replaces
existing release assets.
