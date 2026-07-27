# Microsoft Edge Add-ons listing

This file is the source of truth for the English Partner Center listing and
certification answers. Keep store-only copy here so future package updates do
not silently drift from the published description.

## Listing

- Product name: `Kode Injector`
- Short description: `Inject JavaScript and CSS from local files into websites`
- Category: `Developer tools`
- Website: `https://github.com/maximtop/kode-injector`
- Support URL: `https://github.com/maximtop/kode-injector/issues/new`
- Support email: `maximtop@gmail.com`
- Privacy policy: `https://github.com/maximtop/kode-injector/blob/master/PRIVACY.md`

### Full description

Kode Injector connects local JavaScript and CSS files to the websites where
you need them. Create a rule for a hostname, choose a local JS file, a CSS
file, or both, and the extension applies your code automatically whenever you
open a matching page.

It is built for web developers, QA engineers, and designers who need to test a
fix, automate a repetitive check, adjust a live layout, or compare a local
build against staging or production without pasting the same snippet into
DevTools after every reload.

Features:

- Run local JavaScript and CSS automatically on matching websites.
- Create, edit, duplicate, pause, and delete rules from a focused options page.
- Enable or disable individual files, one website, or all injection at once.
- See matching rules and change the current site's state from the toolbar
  popup.
- Use the browser's built-in local-file access in Microsoft Edge, or opt in to
  the read-only Kode Injector Helper as an advanced alternative.
- Use the interface in 30 languages with light and dark themes.

Kode Injector has no analytics service, advertising, or developer-operated
backend. When a rule matches, the selected code is exposed to the configured
website's page, and the JavaScript file URL is included in that page's
diagnostic console log. Only configure code and websites you trust. Review the
privacy policy for details.

After installation, open Kode Injector settings and follow the file-access
prompt. Add a rule for a website, select your local code, and reload the page.

### Search terms

1. `javascript injection`
2. `css injection`
3. `userscript`
4. `local development`
5. `web testing`
6. `live site debugging`
7. `browser developer tools`

## Assets

- Logo: `src/assets/img/icon-128.png` (128×128)
- Small promotional tile: `assets/store/small-promo-tile.png` (440×280)
- Large promotional tile: `assets/store/marquee-promo-tile.png` (1400×560)
- Screenshots: `assets/store/screenshots/*.png` (five images, 1280×800)
- Localized full descriptions and search terms:
  `assets/store/edge-listings/*.md` (all 30 package locales)

Use the same image set for every localized listing and copy each locale's text
from its matching file in `assets/store/edge-listings/`.

## Properties and privacy answers

### Single purpose

Allow a user to apply JavaScript and CSS from local files to user-selected
websites for development, testing, and design work.

### Permission justifications

- `storage`: stores the user's injection rules, settings, and per-site state in
  local browser storage.
- `scripting`: applies the JavaScript and CSS selected by the user to a
  matching page.
- `activeTab`: reads the active tab URL when the user opens the toolbar popup,
  so it can show matching rules and current-site controls.
- `<all_urls>`: a rule may target any hostname chosen by the user, so the
  content script must be available on user-selected websites. Code is applied
  only when an enabled rule matches.
- Optional `nativeMessaging`: after an explicit Advanced Options action, talks
  to the read-only Kode Injector Helper to read only the local files configured
  by the user. Microsoft Edge uses browser-managed file access by default.

### Remote code

Kode Injector does not download or execute remotely hosted code. It executes
only code bundled with the extension and local JavaScript or CSS explicitly
selected by the user. Local user-provided files are never fetched from a
network location by the extension or its optional helper.

### Data use

The extension locally processes browsing activity (the current URL and
hostname), user-created rules, local file paths, and selected file contents to
provide its single purpose. It does not transmit this data to the developer or
an analytics or advertising service, or sell it. Applying a rule exposes the
selected code and the JavaScript file URL to the website configured by the
user; that page can process or transmit information under the website's own
privacy policy. See `PRIVACY.md` for the complete disclosure.

## Certification notes

Kode Injector is intentionally a local-code injection developer tool. The
extension does not fetch remote scripts. A user creates each rule and chooses
the exact local JavaScript or CSS file to apply to an exact hostname. In Edge,
browser-managed file-URL access is the default; `nativeMessaging` is optional
and requested only from the explicit Advanced Options action.

Suggested review steps:

1. Install the extension and enable **Allow access to file URLs** in its Edge
   extension settings.
2. Create a local JavaScript or CSS file.
3. Open Kode Injector Options and add a rule for a test hostname such as
   `example.com` with that file's `file:///` URL.
4. Reload the matching page and verify the selected code is applied.
5. Use the toolbar popup to disable and re-enable the rule for the current
   site, and use **Pause all** to verify the global control.

The optional Kode Injector Helper is read-only and performs no writes,
directory listing, process execution, shell access, or network operations.
