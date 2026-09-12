# Releasing

This document has the same structure in every extension repository; only the
store list, the identifiers, and the repository-specific notes differ.

The cross-repository contract and extraction boundary are documented in [Shared store deployment](STORE_DEPLOYMENT.md).

- [Cut a release](#cut-a-release)
- [Store deployment](#store-deployment)
  - [Chrome Web Store](#chrome-web-store)
  - [Edge Add-ons](#edge-add-ons)
  - [Firefox Add-ons](#firefox-add-ons)
  - [Apple App Store](#apple-app-store)
- [Store configuration](#store-configuration)
- [Local store commands](#local-store-commands)
- [Failure playbook](#failure-playbook)

## Cut a release

Use the manual `Please release` workflow for the normal path:

```sh
gh workflow run please-release.yml -f version=X.Y.Z
```

The requested version must be a stable `X.Y.Z` newer than `package.json`.
Release Please creates or updates a release PR that changes `package.json` and
`CHANGELOG.md`. Merging that PR is the release approval: `release.yml` runs the
full checks, builds the archives, creates `vX.Y.Z`, and publishes the GitHub
Release. Nothing is sent to a browser store. Use `-f mode=validate` to check a
version without creating a branch or PR.

The workflow uses the built-in `GITHUB_TOKEN` unless an optional
`RELEASE_PLEASE_TOKEN` is configured. The built-in token requires the repository
setting that allows Actions to create pull requests. It does not start ordinary
PR workflows for the PR it creates, so `release.yml` deliberately repeats the
full quality and artifact checks after merge and creates no tag or release if
they fail. A fine-grained token can be used when CI on the release PR itself is
also wanted.

The manual version-and-tag fallback remains available:

1. Bump `version` in `package.json` (semantic `X.Y.Z`) in a normal pull
   request and merge it to `master`.
2. Tag the merged commit and push the tag:

   ```sh
   git tag vX.Y.Z && git push origin vX.Y.Z
   ```

3. `.github/workflows/release.yml` rejects a tag that does not match
   `package.json`, is not reachable from `master`, or already has a release,
   then runs `pnpm check`, builds the extension for every browser, verifies
   the manifest versions, and publishes a GitHub Release with:
   - `kode-injector-<version>-chrome.zip`,
     `kode-injector-<version>-edge.zip`, and
     `kode-injector-<version>-firefox.zip`, the store-ready
     archives
   - `kode-injector-<version>-source.zip`, the tagged repository
     state, which Firefox submissions attach as the reviewable source
   - `SHA256SUMS.txt`, GNU `sha256sum` lines with the bare asset names
   - the signed Kode Injector Helper packages (`kode-injector-helper-*.dmg`,
     `kode-injector-native-*.tar.gz`, `kode-injector-native-*.zip`), built,
     notarized and attached by the `native` job of the same workflow, which
     also appends their checksums to `SHA256SUMS.txt`

Release notes are a fixed sentence followed by the notes GitHub generates from
the pull requests merged since the previous tag. Edit them afterwards with
`gh release edit vX.Y.Z --notes` when needed.

Running `release.yml` by hand from the Actions tab (or
`gh workflow run release.yml`) is a dry run: it builds and verifies everything,
including the signed helper packages, and uploads workflow artifacts, but
publishes nothing. Use it as the signing preflight before tagging.

`gh release create` uploads the assets to a draft and publishes it last; a
failed upload deletes the draft again, so a failed run normally leaves no
release behind and can simply be re-run. If a draft survives a cancelled run,
delete it with `gh release delete vX.Y.Z --yes` before re-running.

## Store deployment

Nothing is sent to a store automatically. Each store has its own manual
workflow that takes an already published GitHub Release:

```sh
gh workflow run deploy-chrome-store.yml -f tag=vX.Y.Z
gh workflow run deploy-edge-addons.yml -f tag=vX.Y.Z
gh workflow run deploy-firefox-amo.yml -f tag=vX.Y.Z
```

The `tag` input is optional; blank deploys the latest published release,
resolved once at the start of the run. The `mode` input defaults to `submit`;
`validate` resolves and verifies the release without touching the store, which
is the way to test a workflow. Each store has its own concurrency group, so
simultaneous runs for the same store are serialized.

Every deploy workflow runs `scripts/deploy/cli.ts` first, which refuses tags
that do not match `vX.Y.Z`, draft and pre-release releases, release commits
that are not reachable from `master`, and a tagged `package.json` version that
differs from the tag. It then downloads the release assets, never a fresh
rebuild, verifies their SHA-256 checksums against `SHA256SUMS.txt`, and checks
the manifest inside the archive: exactly one root `manifest.json`, manifest
version 3, the release version, and the background format of the target
browser (Firefox additionally the Gecko ID and the source archive metadata).
What users can verify is exactly what the store receives. Only then does the
store-specific part start. The validation code and its tests (`tests/deploy`)
are identical across the repositories; the repository specifics live in
`scripts/deploy/constants.ts`.

### Chrome Web Store

`deploy-chrome-store.yml` uploads the archive through Chrome Web Store API v2
with the `go-webext` version pinned by `GO_WEBEXT_VERSION` in the workflow,
refuses to continue unless the store confirms the upload of that exact version
(`Upload State: SUCCEEDED`), submits the draft for review with deferred
(staged) publishing, and writes the store status to the job summary. The status
covers the published and submitted state only; draft processing is visible in
the Developer Dashboard.

When the review verdict arrives by e-mail, publish the approved version by hand
in the Chrome Web Store Developer Dashboard. A staged submission left
unpublished expires back to a draft after about 30 days; re-run the workflow
with the same tag to submit it again. A green run proves a successful
submission, not approval.

Descriptions, screenshots and promo images are not part of the API: the store
only accepts them through the Developer Dashboard.

### Edge Add-ons

`deploy-edge-addons.yml` updates a product that already exists in Partner
Center. The Microsoft Edge Add-ons API can neither create a product nor change
listing metadata, so the first submission, and every later change to
Availability, Properties, Privacy or Store listings, is done by hand in Partner
Center.

Modes:

- `submit` (default): upload the release's Edge archive to the draft
  submission, wait until Partner Center reports the package as processed,
  then request certification.
- `upload`: only upload the package to the draft. Use it when the release
  changes permissions or anything else the Privacy or Store listings pages
  must reflect: finish those pages in Partner Center, then click **Publish**
  there.

The workflow uploads the archive with `go-webext` through the Edge Add-ons API
v1.1 (API key). The step fails unless package processing reaches `Succeeded`;
`go-webext` v0.4.2 waits for that for one minute. In `submit` mode it then
requests certification. `go-webext` reads the publish operation once, so
`InProgress` in a green run means the request was accepted. The verdict
arrives in Partner Center and by email, usually within seven business days,
and Microsoft publishes a certified update itself according to the listing's
availability settings.

There is no deferred publishing on Edge. The manual gates are running the
workflow itself, the `upload` mode for releases that need listing or privacy
changes, and the account owner's confirmations inside Partner Center.
Certification notes cannot be sent by `go-webext` v0.4.2: keep the reviewer
notes in Partner Center and, when a release changes the test steps, deploy it
in `upload` mode and finish the submission there. Microsoft accepts one
submission at a time, and each update needs a higher package version than the
one in the store. `KODE_INJECTOR_EDGE_ID` (the public 32-letter extension ID)
is a build input for the native host origin, not a deployment setting.

### Firefox Add-ons

`deploy-firefox-amo.yml` has two store modes:

- `submit` (default): validate the Firefox archive and the matching source
  archive, check the authenticated AMO API for that exact version, then
  submit only if absent. Existing versions are never uploaded again. If an
  existing version has no source attached, fix it in the Developer Hub using
  the matching release source archive before continuing.
- `status`: read review/publication status without uploading. Once AMO offers
  the signed XPI, download it, check the AMO SHA-256, manifest version, Gecko
  ID and Mozilla signature envelope, then retain it as an Actions artifact
  for 30 days. The AMO hash authenticates the download; this is not a separate
  cryptographic verification of Mozilla's signing certificate chain.

Firefox publishes automatically after Mozilla approval. The summary separates
submission, pending review, approval and current publication. Signing does not
keep the job running: run `status` again later. A status API failure after a
successful upload produces a warning without invalidating that submission. In
status-only mode, the same failure fails the run. Never retry an upload merely
because status is temporarily unavailable.

The helper (`scripts/deploy/firefox.ts`) reads AMO JSON directly because
`go-webext v0.4.2` cannot parse some current `categories` responses.
`go-webext update firefox` still handles listed uploads and matching source
attachment; it does not wait for signing.

A new submission requires `docs/AMO_REVIEW.md` inside that same release's
source archive; it is uploaded as the AMO approval notes and explains why the
`nativeMessaging` permission and the Kode Injector Helper are needed. Update
these [reviewer instructions](AMO_REVIEW.md) whenever build requirements or
the test steps change.

Releases up to v0.9.2 carried `chrome.zip`-style asset names and cannot be
deployed with these workflows; ship a new version instead.

### Apple App Store

`deploy-apple-app-store.yml` rebuilds the tagged commit on `macos-26`,
creates and validates a universal Xcode archive of the Safari app, and uploads
it to App Store Connect; App Review submission stays manual. It keeps its own
release resolution and the `apple-app-store` environment because no store
archive is downloaded. The one-time Apple setup, the environment secrets and
variables, and the resubmission steps live in
[safari/APP_STORE.md](../safari/APP_STORE.md).

## Store configuration

The store items must exist before any deployment: no store API can create
the listing. One-time setup per store:

1. Create the item in the store console by uploading any release archive by
   hand and complete the listing, privacy, and distribution pages there
   (Chrome: leave the item as an unsubmitted draft; Edge: complete the first
   submission in Partner Center; Firefox: submit the first version in the
   Developer Hub with the matching source archive).
2. Copy the store's item identifier into the repository variable below.
3. Add the variables and secrets below.
4. Run the store's deploy workflow once with `mode: validate`, then with
   `mode: submit`.

Configure these in the GitHub repository under **Settings → Secrets and
variables → Actions**. Workflows reference them by name only; no value is ever
committed. The Apple signing and App Store Connect values are listed in
[safari/APP_STORE.md](../safari/APP_STORE.md), and the 1Password layout of
every credential in
[scripts/release/ONEPASSWORD.md](../scripts/release/ONEPASSWORD.md).

| Kind | Name | Description |
| --- | --- | --- |
| Variable | `CHROME_APP_ID` | Item ID from the Chrome Web Store Developer Dashboard item URL. Specific to this extension. |
| Variable | `CHROME_PUBLISHER_ID` | Publisher ID from the Developer Dashboard account page. |
| Secret | `CHROME_CLIENT_ID` | OAuth 2.0 client ID of the Google Cloud project with the Chrome Web Store API enabled. |
| Secret | `CHROME_CLIENT_SECRET` | Secret of that OAuth client. |
| Secret | `CHROME_REFRESH_TOKEN` | Refresh token granted for the `https://www.googleapis.com/auth/chromewebstore` scope. |
| Variable | `EDGE_PRODUCT_ID` | Product ID (GUID) from the extension overview page in Partner Center; not the public store ID. Specific to this extension. |
| Secret | `EDGE_CLIENT_ID` | Partner Center → Microsoft Edge → **Publish API** → Client ID (API-key experience). |
| Secret | `EDGE_API_KEY` | An active API key from the same page; Partner Center shows its expiry date. |
| Variable | `FIREFOX_AMO_ID` | AMO listing slug or numeric identifier. Specific to this extension. |
| Secret | `FIREFOX_CLIENT_ID` | JWT issuer from the [AMO API credentials](https://addons.mozilla.org/en-US/developers/addon/api/key/) page. |
| Secret | `FIREFOX_CLIENT_SECRET` | JWT secret from the same page; use the full original secret, AMO later shows only a masked value that cannot authenticate. |

The account-level values are shared by every extension of the account and
have one source of truth each in 1Password: `chrome-web-store-api`,
`edge-addons-api` (which also records the key name and expiry date), and
`firefox-amo-api`. Their notes list every repository that uses them and the
rotation steps. Regenerating the AMO key or an Edge API key invalidates the
previous one for every repository at once; update all of them together. Push a
value to a repository without printing it:

```sh
op read op://Private/chrome-web-store-api/CHROME_REFRESH_TOKEN | gh secret set CHROME_REFRESH_TOKEN
```

Always capture a value before piping it into `gh secret set`: a failed `op`
command otherwise stores an empty secret without any error.

## Local store commands

The deploy workflows are the normal path. For a local fallback, install Go and
`go-webext` (`go install github.com/adguardteam/go-webext@v0.4.2`), copy
`1password.env.example` to `.env.1password` (gitignored) with the vault name
filled in, and resolve the credentials for one command with `op run`:

| Command | Result |
| --- | --- |
| `op run --env-file=.env.1password -- make chrome_status` | Print the published and submitted state of the Chrome item. |
| `op run --env-file=.env.1password -- make chrome_update` | Build the Chrome release archive and upload it as the store draft. |
| `op run --env-file=.env.1password -- make chrome_publish` | Submit the Chrome draft for review with deferred publishing. |
| `op run --env-file=.env.1password -- go-webext status edge -a "$EDGE_PRODUCT_ID"` | Print the Edge product state. |
| `op run --env-file=.env.1password -- go-webext status firefox` | Print the AMO listing state (limited by the `categories` parsing issue above). |

Without 1Password, a `.env` filled in from `.env.example` works the same way;
`go-webext` reads it itself. Never commit either file.

## Failure playbook

Chrome Web Store:

- **`invalid_client`:** `CHROME_CLIENT_ID` or `CHROME_CLIENT_SECRET` is wrong;
  the refresh token is fine. Google no longer shows an existing client secret:
  add a new secret to the same OAuth client in the Google Cloud Console,
  store it in `chrome-web-store-api`, push it to every repository, and re-run.
- **`invalid_grant`:** the refresh token is dead and nothing was uploaded.
  Mint a new one for the existing OAuth client in the
  [OAuth Playground](https://developers.google.com/oauthplayground) with
  "Use your own OAuth credentials" and the
  `https://www.googleapis.com/auth/chromewebstore` scope, store it in
  `chrome-web-store-api`, push it to every repository, and re-run. The OAuth
  consent screen must be **In production**; refresh tokens issued while it is
  in **Testing** expire after seven days.
- **`deleted_client`:** the OAuth client itself is gone. Create a new Web
  application client in the Google Cloud project with
  `https://developers.google.com/oauthplayground` as an authorized redirect
  URI, then store the new client ID and secret and mint a new refresh token.
- **A 5xx from the token endpoint:** transient on Google's side; re-run.
- **Upload did not reach `SUCCEEDED`:** the store is still processing the
  draft. Wait, then re-run with the same tag; re-uploading the same version
  replaces the draft.
- **Submission failed after a successful upload:** the draft is still in
  place. Re-run with the same tag; the re-upload replaces it and the
  submission is repeated.
- **Upload rejected because the version is already published:** ship a new
  version.
- **Upload rejected because a submission is pending review:** the store
  refuses every package upload in that state regardless of version. Wait for
  the verdict or cancel the review in the Developer Dashboard, then re-run.
- **Upload rejected because an approved submission is staged:** publish the
  staged version in the Developer Dashboard, or let the 30-day expiry return
  it to a draft, then re-run.
- **Review rejected:** no workflow signal exists; the verdict arrives by
  e-mail. Address the feedback and ship a new version.

Edge Add-ons:

- **401 `API Key is Invalid`:** the key is missing, expired or belongs to
  another Client ID. Create a new key on the Publish API page, store it in
  `edge-addons-api`, push it to every repository, and re-run; nothing was
  uploaded.
- **403 `Client ID is Invalid`:** the Client ID comes from the retired v1
  experience. Take the one shown by the API-key experience of the Publish API
  page.
- **Upload step times out while processing stays `InProgress`:** check the
  draft in Partner Center, wait for processing to settle and re-run only if
  no package was accepted.
- **Submission already in review:** wait for certification to finish before
  deploying again.
- **Certification rejected:** the verdict arrives after the run; fix the
  cause, then ship a new release or update the metadata in Partner Center.

Firefox Add-ons:

- **`HTTP 401 (signature)`:** `FIREFOX_CLIENT_SECRET` is not the full JWT
  secret (AMO shows existing secrets masked). Push the value from
  `firefox-amo-api` and re-run.
- **Version already exists on AMO:** nothing is uploaded; use `status` mode
  to follow the review, or ship a new version.
- **Status endpoint unavailable after a successful upload:** the submission
  stands; re-run in `status` mode later.
