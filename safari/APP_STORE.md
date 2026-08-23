# Mac App Store release

Kode Injector ships as a macOS containing application with an embedded Safari
Web Extension. The App Store build must use the Xcode archive flow because the
extension contains a custom Swift bridge and a fixed Go helper; Apple's
web-only Safari packager is not sufficient for this bundle.

The automated flow uploads a build to App Store Connect. It deliberately does
not select the build for a version, change listing metadata, answer legal
questions, or submit the version for App Review.

## One-time Apple setup

1. Use Apple Developer team `WF967PV46P` and accept current agreements in
   App Store Connect.
2. Register these explicit identifiers in Certificates, Identifiers & Profiles:
   - containing app: `dev.maximtop.kode-injector.safari`
   - Safari extension: `dev.maximtop.kode-injector.safari.Extension`
3. Create the macOS app record in App Store Connect with the containing-app
   identifier. Suggested values:
   - name: `Kode Injector`
   - SKU: `kode-injector-safari` (the SKU cannot be changed later)
   - primary category: Developer Tools
   - privacy policy URL:
     `https://github.com/maximtop/kode-injector/blob/master/PRIVACY.md`
   - support URL: `https://github.com/maximtop/kode-injector/issues`
4. Complete App Privacy, age rating, availability, pricing, export compliance,
   required regional business information, description, keywords, and macOS
   screenshots. The maintained behavior and disclosure source is
   [`PRIVACY.md`](../PRIVACY.md).
5. Create both an Apple Distribution certificate and a Mac Installer
   Distribution certificate. Export each as a password-protected PKCS#12 file
   using the same release password. Do not reuse the Developer ID Application
   certificate used for the separately distributed Helper app.
6. Create these `Mac App Store` provisioning profiles, using the Apple
   Distribution certificate:
   - `Kode Injector Mac App Store` for the containing app;
   - `Kode Injector Safari Extension Mac App Store` for the extension.
7. Create an App Store Connect API key that can upload builds and manage signing
   assets. Record its key ID and issuer ID, and download its `.p8` file once.

The app and extension include privacy manifests declaring no tracking or data
collection. The extension also declares Apple's required reasons for reading
timestamps of user-authorized files, measuring elapsed request time, and
storing app-scoped folder bookmarks in `UserDefaults`. `ITSAppUsesNonExemptEncryption`
is set to `NO`; confirm that this remains the correct legal answer before each
release. SHA-256 integrity checks and Apple's system TLS APIs do not add custom
encryption code to the product.

## Local archive and upload

First run the credential-free release gate. It produces and validates an
unsigned universal archive without contacting Apple:

```sh
pnpm safari:store:check
```

For a local signed archive, sign in to the Apple account in Xcode, pick a
build number (`<build>` below) that is higher than every build already listed
under the app in App Store Connect, and run the three commands with the same
value. `validateBuildNumber` accepts one to three integer components within
Apple's four/two/two-digit limits; the workflow derives its own numbers from
the run counter (`1.<run>.<attempt>` shape, e.g. `1.57.1`), so a local number
above that sequence blocks later automated uploads — prefer the workflow.

```sh
pnpm safari:store:profiles
SAFARI_BUILD_NUMBER=<build> pnpm safari:store:archive
SAFARI_BUILD_NUMBER=<build> pnpm safari:store:validate
```

The normal path for a resubmission is the workflow, not a local archive: see
“Resubmitting a version” below.

The result is `build/safari/store/Kode Injector.xcarchive`. The archive command
builds release WebExtension resources, runs Swift and Go tests, creates a
universal `arm64 + x86_64` Go helper, and signs the helper before the extension
and containing app with the explicit Mac App Store profiles. The archive has a
verified Apple-team signature; the explicit upload step performs a manual Xcode
export with the same profiles and the Mac Installer Distribution certificate.
The flow never uses `codesign --deep` and does not require Cloud Signing access.

For API-key authentication instead of the Xcode account, configure all three
values together:

```sh
export APP_STORE_CONNECT_API_KEY_PATH=/absolute/path/AuthKey_KEYID.p8
export APP_STORE_CONNECT_API_KEY_ID=KEYID
export APP_STORE_CONNECT_API_ISSUER_ID=00000000-0000-0000-0000-000000000000
```

Upload is a separate explicit command:

```sh
SAFARI_BUILD_NUMBER=<build> pnpm safari:store:upload
```

`xcodebuild -exportArchive` uses the `app-store-connect` method and uploads the
validated archive for processing. After processing completes, select the build
on the intended macOS version page, finish the listing and compliance fields,
add App Review notes, and submit manually.

## GitHub Actions

Create a protected GitHub Environment named `apple-app-store`. Configure these
environment secrets:

- `APPLE_APP_STORE_CERTIFICATE_P12_BASE64`
- `APPLE_APP_STORE_CERTIFICATE_PASSWORD`
- `APPLE_APP_STORE_INSTALLER_CERTIFICATE_P12_BASE64`
- `APP_STORE_CONNECT_API_KEY_P8_BASE64`

Configure these environment variables:

- `APP_STORE_CONNECT_API_KEY_ID`
- `APP_STORE_CONNECT_API_ISSUER_ID`

Encode the binary credential files without line wrapping, for example:

```sh
base64 < distribution-certificate.p12 | tr -d '\n'
base64 < installer-distribution-certificate.p12 | tr -d '\n'
base64 < AuthKey_KEYID.p8 | tr -d '\n'
```

The `Deploy Apple App Store` workflow runs on Xcode 26, imports both signing
identities into a temporary keychain, downloads the two named profiles through
the App Store Connect API, archives the published tag, validates the complete
signed layout, and uploads it. The build number is derived monotonically from
the workflow run number and attempt (`run × 100 + attempt`, encoded into
`major.minor.patch` such as `1.57.1`) and applied to both the containing app
and the extension, respecting Apple's `four digits.two digits.two digits`
limits, so a retry receives a new number. The workflow removes the keychain,
certificate, and API key even after failure.

Start the workflow for a published release tag from **Actions → Deploy
stores** (Apple checkbox) or from **Deploy Apple App Store → Run workflow**;
publishing the GitHub Release by itself deploys nothing. Protect the
environment with required reviewers if every upload should need explicit
approval.

## Resubmitting a version

`Deploy Apple App Store` builds the source of a **published release tag**, so a
fix that must reach App Review (such as the built-in demo) has to be on a
tagged, released commit:

1. Run **Actions → Start release** with the next version (for example
   `0.9.2`): it bumps `package.json` on `master`, tags it, and **Release**
   drafts the GitHub Release — publish it, then run **Deploy stores** and
   tick the stores this release should reach (at minimum Apple). Chrome,
   Edge, and Firefox receive the same source with the Safari demo compiled
   out. App Store Connect receives a new workflow-derived build number (for
   example `1.57.1`) of the new version.
2. Run the clean-install gate below on the processed build, then select it
   for the version in App Store Connect, paste the review notes, and submit.

Re-running the workflow manually for an existing tag (Actions → Deploy Apple
App Store → tag) uploads the *same* source again with a new build number; use
that only when metadata, not code, changed.

## Final release gate

Before App Review submission, run the clean-install gate on a macOS user
account that has never had Kode Injector data (or after removing the app,
its containers, and Safari's extension data):

1. Confirm the processed build in App Store Connect shows the released
   marketing version and the workflow-derived build number (e.g. `1.57.1`)
   for both the app and the extension; the upload step already enforced that
   both bundles carry the same values.
2. Install the processed build through TestFlight or an App Store Connect
   test path. Launch **Kode Injector**, click **Try Demo** while the extension
   is still disabled: Safari's extension settings open and the app explains
   that the extension must be enabled. Enable **Kode Injector** in Safari.
3. Click **Try Demo** again: Safari comes forward; if the extension background
   is running, the Rules page opens automatically, otherwise follow the status
   text (Kode Injector toolbar button → Options). Record which of the two
   happened.
4. On Rules, confirm the **Demo** card names `https://example.com/`, shows the
   JS and CSS chips, and sits above the normal “New rule” onboarding. Select
   **Run Demo**. When Safari asks for website access, first dismiss the
   request: within the bounded wait (≤ 15 s) the card must report that website
   access is needed — never “Done”. Then grant access through the toolbar
   button, reload the tab or run the demo again.
5. On the example page, observe both effects: the green banner and page
   background (CSS) and the “Kode Injector demo” panel that reports the
   JavaScript and the detected CSS. The Rules card reports “Done”.
6. Reload the example tab three times: exactly one panel and one banner each
   time. Open a second tab at `https://example.com/`: no demo there. Click
   **Run Demo** again: the existing tab is focused and reloaded, no second tab
   opens. Leave the example tab idle for about two minutes (long enough for
   Safari to unload the extension background), then reload it once more: both
   effects still appear (the launch is kept in session storage). Quit and
   relaunch Safari, reload the tab: nothing is injected until **Run Demo**
   runs again (session storage is cleared on quit).
7. Open Settings: the **Built-in demo** link returns to the Rules card.
8. Add any custom rule (for example `localhost` with a `file:///` CSS path and
   the folder authorization). The demo card disappears; reloading the example
   tab no longer injects anything. Delete the rule: the card returns with no
   status, and the example tab still receives nothing until you run the demo
   again.
9. Pause injections from the popup: the card shows the paused notice with
   **Resume**; after **Resume**, **Run Demo** works again. Disconnect the
   network and run the demo once more: the card must end with a retryable
   error (not a success), and reconnecting plus **Run Demo** recovers.
9a. Switch the interface language to Arabic (RTL) and to German (long text):
    the card, its status line, and the Settings link stay readable, the
    `https://example.com/` host stays left-to-right, and **Run Demo** remains
    reachable with the keyboard; switch back.
10. Confirm that no folder-authorization panel, Helper prompt, download, or
    account prompt appeared during steps 3–7, and that Safari Settings →
    Extensions shows no new permission for Kode Injector.
11. Run the existing JS+CSS folder-authorization scenario from
    [`DEVELOPMENT.md`](../DEVELOPMENT.md#testing-safari-locally), restart
    Safari, and confirm the bookmark persists; verify missing files, invalid
    UTF-8, oversized files, cancellation, and a second authorized folder
    without partial injection.
12. Review App Privacy and export-compliance answers against `PRIVACY.md`,
    select manual or automatic release in App Store Connect, paste the review
    notes below, and submit for review.

## Suggested App Review notes

Be explicit about the extension's developer-tool behavior because it executes
scripts selected by the user and therefore merits context for Guidelines 2.5.2
and 4.4.2. Adapt the following notes to the submitted build:

> Kode Injector is a Safari Web Extension for developers and QA engineers. It
> never downloads executable code. Normal use: a user enters a local JavaScript
> or CSS `file:///` URL, saves the rule, and confirms the exact containing
> folder in the standard macOS open panel; the extension receives a read-only
> security-scoped bookmark only for that folder. Injection occurs only on
> hostnames the user configured and only after Safari's website permission is
> granted. The bundled helper is sandboxed and cannot write files, list
> folders, access the network, or execute user-selected programs. No account
> or demo credentials are needed.
>
> To review injection without preparing any files, use the built-in demo:
> 1. Open the Kode Injector app and enable the extension in Safari Settings →
>    Extensions when prompted.
> 2. In Safari, click the Kode Injector toolbar button and choose Options (the
>    app's Try Demo button brings Safari forward and shows the same
>    instruction), then stay on the Rules tab.
> 3. Select **Run Demo**. Safari opens https://example.com; if Safari asks for
>    website access, allow it and reload the page or select Run Demo again.
> 4. Observe the injected CSS (green banner and page background) and the
>    injected JavaScript (the “Kode Injector demo” panel). The demo uses fixed
>    content bundled in the extension, creates no rule, reads no local file,
>    and disappears once a custom rule exists.

The extension asks for broad website access because rules can target any
hostname chosen by the user; it injects nothing until the user runs the demo
or a matching rule exists. App Review is discretionary, so keep the product
description, screenshots, permission text, and these notes consistent with
the submitted behavior.

Apple references:

- [Distributing a Safari web extension](https://developer.apple.com/documentation/safariservices/distributing-your-safari-web-extension)
- [Upload builds](https://developer.apple.com/help/app-store-connect/manage-builds/upload-builds/)
- [Create an App Store provisioning profile](https://developer.apple.com/help/account/provisioning-profiles/create-an-app-store-provisioning-profile)
- [App information](https://developer.apple.com/help/app-store-connect/reference/app-information/app-information)
- [Export compliance](https://developer.apple.com/help/app-store-connect/manage-app-information/overview-of-export-compliance)
- [App Review Guidelines](https://developer.apple.com/app-store/review/guidelines/)
