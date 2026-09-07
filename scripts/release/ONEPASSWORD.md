# Release credentials in 1Password

Use one 1Password item as the source of truth and GitHub Actions secrets and
variables as deployment copies. Do not import `.env` wholesale: it contains
obsolete and renamed fields, short-lived tokens, and two different Apple
signing flows.

## Item to create

Create one item named `kode-injector-release` for the project-specific fields
and add the sections and fields below. Account-level store credentials are
shared by every extension and live in separate items with the same field
labels: `chrome-web-store-api`, `edge-addons-api`, and `firefox-amo-api` (see
the store sections).
Use concealed fields for passwords, private keys, tokens, API keys, and base64
certificate data. IDs and product metadata can be regular text fields.

### Apple Developer ID

Used to sign and notarize the separately distributed Native Host Helper:

- `APPLE_CERTIFICATE_P12_BASE64`
- `APPLE_CERTIFICATE_PASSWORD`
- `APPLE_DEVELOPER_ID`
- `APPLE_NOTARY_KEY_P8_BASE64`
- `APPLE_NOTARY_KEY_ID`
- `APPLE_NOTARY_ISSUER_ID`

The certificate must be a **Developer ID Application** certificate.

### Apple App Store

Used only for the Mac App Store Safari application:

- `APPLE_APP_STORE_CERTIFICATE_P12_BASE64`
- `APPLE_APP_STORE_CERTIFICATE_PASSWORD`
- `APPLE_APP_STORE_INSTALLER_CERTIFICATE_P12_BASE64`
- `APP_STORE_CONNECT_API_KEY_P8_BASE64`
- `APP_STORE_CONNECT_API_KEY_ID`
- `APP_STORE_CONNECT_API_ISSUER_ID`

The first P12 must contain an **Apple Distribution** identity and the installer
P12 must contain a **Mac Installer Distribution** identity. Both P12 files use
`APPLE_APP_STORE_CERTIFICATE_PASSWORD`. Do not copy the Developer ID certificate
into these fields. The API key must be able to upload builds and read
Certificates, Identifiers & Profiles so CI can download the named profiles.

### Chrome Web Store

- `CHROME_APP_ID`

Only the item ID is specific to this extension. `CHROME_CLIENT_ID`,
`CHROME_CLIENT_SECRET`, `CHROME_REFRESH_TOKEN`, and `CHROME_PUBLISHER_ID`
belong to the Google account and are shared by every extension it publishes,
so they live in the separate `chrome-web-store-api` item with the same field
labels; this section keeps only a `CHROME_CREDENTIALS` note pointing there.
Rotate them in that item and push the new value to every repository listed in
its notes.

### Edge Add-ons

- `EDGE_PRODUCT_ID`
- `KODE_INJECTOR_EDGE_ID`

`EDGE_PRODUCT_ID` identifies the Partner Center product. `KODE_INJECTOR_EDGE_ID`
is the 32-letter installed extension ID and remains optional until the listing
has assigned it.

`EDGE_CLIENT_ID` and `EDGE_API_KEY` belong to the Partner Center account and are
shared by every extension it publishes, so they live in the separate
`edge-addons-api` item; this section keeps only an `EDGE_CREDENTIALS` note
pointing there. Take the Client ID from the API-key experience of the Publish
API page: the Client ID of the retired v1 experience, stored here until
2026-09-06, is rejected with `403 Client ID is Invalid`. The API key expires;
its name and expiry date are recorded in that item.

### Firefox AMO

`FIREFOX_CLIENT_ID` and `FIREFOX_CLIENT_SECRET` belong to the Mozilla account
and are shared by every add-on it publishes, so they live in the separate
`firefox-amo-api` item; this section keeps only a `FIREFOX_CREDENTIALS` note
pointing there. Regenerating the AMO key invalidates the previous one for every
repository at once, so update all of them together.

The Firefox extension ID is fixed in source and is not a credential field.

### Product metadata

Keep the public identifiers in the same item so the complete release setup is
visible in one place:

- `APPLE_TEAM_ID`
- `APP_STORE_CONNECT_APP_NAME`
- `APP_STORE_CONNECT_BUNDLE_IDENTIFIER`
- `SAFARI_APP_BUNDLE_IDENTIFIER`
- `SAFARI_EXTENSION_BUNDLE_IDENTIFIER`
- `FIREFOX_APP_ID`

These fields document the release configuration. Most are fixed in source and
changing only the 1Password value does not reconfigure a build.

## Existing `.env` migration

Migrate one provider at a time. The following names currently match the release
workflows and can be copied after confirming that the credential is still
active:

- `APPLE_CERTIFICATE_P12_BASE64`
- `APPLE_CERTIFICATE_PASSWORD`
- `CHROME_APP_ID`
- `CHROME_CLIENT_ID`
- `CHROME_CLIENT_SECRET`
- `CHROME_PUBLISHER_ID`
- `CHROME_REFRESH_TOKEN`
- `EDGE_CLIENT_ID`
- `EDGE_PRODUCT_ID`
- `FIREFOX_CLIENT_ID`
- `FIREFOX_CLIENT_SECRET`
- `KODE_INJECTOR_EDGE_ID`

These old fields need deliberate migration:

| Old `.env` field | Current destination | Action |
| --- | --- | --- |
| `APP_STORE_CONNECT_ISSUER_ID` | `APP_STORE_CONNECT_API_ISSUER_ID` | Rename after checking the API key is the intended App Store key. |
| `APP_STORE_CONNECT_KEY_ID` | `APP_STORE_CONNECT_API_KEY_ID` | Rename together with its issuer and private key. |
| `APP_STORE_CONNECT_PRIVATE_KEY` | `APP_STORE_CONNECT_API_KEY_P8_BASE64` | Confirm it is the matching `.p8`; store the base64 of the complete file. |
| `EDGE_CLIENT_SECRET` | `EDGE_API_KEY` | Do not rename blindly; obtain the current Partner Center API key. |

Do not migrate these obsolete or short-lived values:

- `CHROME_ACCESS_TOKEN`
- `CHROME_CODE`
- `EDGE_ACCESS_TOKEN_URL`

Move `APP_STORE_CONNECT_APP_NAME`, `APP_STORE_CONNECT_BUNDLE_IDENTIFIER`,
`FIREFOX_APP_ID`, `SAFARI_APP_BUNDLE_IDENTIFIER`, and
`SAFARI_EXTENSION_BUNDLE_IDENTIFIER` to the Product metadata section. Keep
`EDGE_CLIENT_SECRET` only in a clearly marked Legacy section if it may still be
needed outside this repository; the current workflow requires `EDGE_API_KEY`
instead.

Chrome access tokens and authorization codes are short-lived intermediates;
the refresh token is the durable credential. Safari and Firefox identifiers are
fixed and validated by the build.

The existing `.env` does not contain every current release field. In
particular, add the Apple notary key fields, the separate Apple Distribution
certificate fields, the current App Store API-key fields, `APPLE_DEVELOPER_ID`,
and `EDGE_API_KEY` from their authoritative provider consoles rather than
guessing values.

## Local secret references

Copy the reference template and replace `VAULT_NAME` without adding secret
values to the file:

```sh
cp 1password.env.example .env.1password
```

`.env.1password` is ignored by Git. After filling the 1Password items and
signing in to the CLI, resolve references for a single command with:

```sh
op run --env-file=.env.1password -- your-command
```

Do not print the environment or use shell tracing around `op run`. A resolved
environment is appropriate for validation and for copying values into GitHub,
but the signed local Safari archive still expects
`APP_STORE_CONNECT_API_KEY_PATH` to point to a temporary `.p8` file. Materialize
that file with `op read`, give it mode `0600`, and remove it immediately after
the archive or upload command.

## GitHub destinations

Copy values from 1Password to these exact destinations only after each provider
has been checked independently:

- Repository secrets: Developer ID certificate/password, notary `.p8`, Chrome
  OAuth credentials, Edge API credentials, and Firefox AMO credentials.
- Repository variables: public IDs for Apple notarization, Chrome (`CHROME_APP_ID`
  and `CHROME_PUBLISHER_ID`), Edge, Firefox (`FIREFOX_AMO_ID`), and
  `KODE_INJECTOR_EDGE_ID`.
- `apple-app-store` Environment secrets: Apple Distribution
  certificate/password and App Store Connect `.p8`.
- `apple-app-store` Environment variables: App Store Connect key ID and issuer
  ID.

Keep `.env` until all five provider checks succeed. Delete the old local copy
only as a separate, explicit cleanup step.
