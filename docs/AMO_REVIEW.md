# Building instructions for the Firefox Add-ons review team

These notes are uploaded to the AMO `approval_notes` field with every new
version and ship inside the source archive attached to the submission. The
archive is the committed repository state that produced the submitted package.

## Prerequisites

Linux or macOS with Node.js 24.x and pnpm 11.18.0, the version pinned by the
`packageManager` field of `package.json` (`corepack enable` provisions it).
No other tooling is required.

## Building the release version

```sh
pnpm install --frozen-lockfile
pnpm release firefox
```

The build output is `build/release/firefox.zip`, whose contents match the
submitted package.

## Why the nativeMessaging permission is required

Firefox extension pages cannot read `file:///` URLs, and the purpose of this
add-on is to inject JavaScript and CSS that the user keeps in local files. The
extension therefore reads those files through **Kode Injector Helper**, a
separate open source companion application that the user installs themselves.

The helper is read-only: it accepts a path over native messaging, returns that
file's contents, and does nothing else. No writes, no shell execution, no
network access. Its source is in this archive under `native-host/` (Go), and
signed packages are published on
[GitHub Releases](https://github.com/maximtop/kode-injector/releases).

The add-on itself makes no network requests: no analytics, no telemetry, no
remote code.

## How to test

1. Install Kode Injector Helper for your platform from the GitHub Releases
   page above, open it, and click **Install**. This registers the native
   messaging manifest for `kode-injector@maximtop.dev`.
2. Create `/tmp/test.css` containing `body { background: #0f0 !important; }`.
3. On the add-on's options page, add an injection with site `example.com` and
   CSS path `file:///tmp/test.css`. A rule needs a site plus at least one of
   the JS or CSS paths.
4. Open <https://example.com>: the page background turns green. Injection
   runs at document start.
5. The toolbar popup switch disables injections for the current site, and the
   pause button in the popup header suspends all injections everywhere.

Source repository: <https://github.com/maximtop/kode-injector> (MIT license).
Contact: maximtop@gmail.com
