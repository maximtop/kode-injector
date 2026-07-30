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
5. Create an Apple Distribution certificate and export it as a password-protected
   PKCS#12 file. Do not reuse the Developer ID Application certificate used for
   the separately distributed Helper app.
6. Create an App Store Connect API key that can upload builds and manage signing
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

For a signed archive, sign in to the Apple account in Xcode, choose a build
number higher than every build previously uploaded to App Store Connect, and
run:

```sh
SAFARI_BUILD_NUMBER=1.1.1 pnpm safari:store:archive
SAFARI_BUILD_NUMBER=1.1.1 pnpm safari:store:validate
```

The result is `build/safari/store/Kode Injector.xcarchive`. The archive command
builds release WebExtension resources, runs Swift and Go tests, creates a
universal `arm64 + x86_64` Go helper, and lets Xcode sign the helper before the
extension and containing app. The archive has a verified Apple-team signature;
the explicit upload step performs the standard Xcode export that applies the
App Store distribution signature and provisioning profiles. The flow never
uses `codesign --deep`.

For API-key authentication instead of the Xcode account, configure all three
values together:

```sh
export APP_STORE_CONNECT_API_KEY_PATH=/absolute/path/AuthKey_KEYID.p8
export APP_STORE_CONNECT_API_KEY_ID=KEYID
export APP_STORE_CONNECT_API_ISSUER_ID=00000000-0000-0000-0000-000000000000
```

Upload is a separate explicit command:

```sh
SAFARI_BUILD_NUMBER=1.1.1 pnpm safari:store:upload
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
- `APP_STORE_CONNECT_API_KEY_P8_BASE64`

Configure these environment variables:

- `APP_STORE_CONNECT_API_KEY_ID`
- `APP_STORE_CONNECT_API_ISSUER_ID`

Encode the binary credential files without line wrapping, for example:

```sh
base64 < distribution-certificate.p12 | tr -d '\n'
base64 < AuthKey_KEYID.p8 | tr -d '\n'
```

The `Deploy Apple App Store` workflow runs on Xcode 26, imports credentials into
a temporary keychain, archives the published tag, validates the complete signed
layout, and uploads it. The build number is
derived monotonically from the workflow run number and attempt while respecting
Apple's `four digits.two digits.two digits` limits, so a retry receives a new
number. The workflow removes the keychain, certificate, and API key even after
failure.

Publishing a non-prerelease GitHub Release starts the workflow. It can also be
run manually for an existing published tag. Protect the environment with
required reviewers if every upload should need explicit approval.

## Final release gate

Before App Review submission:

1. Confirm the processed build shows the expected version and build number.
2. Install it through TestFlight or an App Store Connect test path and enable
   the extension in Safari Settings.
3. Run the JS+CSS folder-authorization and injection scenario from
   [`DEVELOPMENT.md`](../DEVELOPMENT.md#testing-safari-locally).
4. Restart Safari and confirm the bookmark persists without another prompt.
5. Verify missing files, invalid UTF-8, oversized files, cancellation, and a
   second authorized folder without partial injection.
6. Review App Privacy and export-compliance answers against `PRIVACY.md`.
7. Select manual or automatic release in App Store Connect and submit for
   review.

## Suggested App Review notes

Be explicit about the extension's developer-tool behavior because it executes
scripts selected by the user and therefore merits context for Guidelines 2.5.2
and 4.4.2. Adapt the following notes to the submitted build:

> Kode Injector is a Safari Web Extension for developers and QA engineers. It
> never downloads executable code. A user manually enters a local JavaScript or
> CSS `file:///` URL, saves the rule, and confirms the exact containing folder
> in the standard macOS open panel. The extension receives a persistent,
> read-only security-scoped bookmark only for that folder. The source remains
> visible and editable by the user. Injection occurs only on hostnames the user
> configured and only after Safari's website permission is granted. The bundled
> helper is sandboxed and cannot write files, list folders, access the network,
> or execute user-selected programs. No account or demo credentials are needed.

Include concise review steps using a harmless local fixture. The extension asks
for broad website access because rules can target any hostname chosen by the
user; it does not inject anything until a matching rule exists. App Review is
discretionary, so keep the product description, screenshots, permission text,
and these notes consistent with the submitted behavior.

Apple references:

- [Distributing a Safari web extension](https://developer.apple.com/documentation/safariservices/distributing-your-safari-web-extension)
- [Upload builds](https://developer.apple.com/help/app-store-connect/manage-builds/upload-builds/)
- [Create an App Store provisioning profile](https://developer.apple.com/help/account/provisioning-profiles/create-an-app-store-provisioning-profile)
- [App information](https://developer.apple.com/help/app-store-connect/reference/app-information/app-information)
- [Export compliance](https://developer.apple.com/help/app-store-connect/manage-app-information/overview-of-export-compliance)
- [App Review Guidelines](https://developer.apple.com/app-store/review/guidelines/)
