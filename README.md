# Kode Injector

> Inject JavaScript and CSS from local files into specified websites — for
> developers, QA testers, and designers who need to apply custom code to live
> pages.

<p align="center">
  <!-- TODO: add screenshot -->
  <img src="assets/screenshot.png" alt="Kode Injector screenshot" width="600">
</p>

## Description

Kode Injector is a browser extension for web developers, QA testers, and
designers who need to inject custom JavaScript and CSS code into live websites.

During development, debugging, or visual review you often need to override or
add code on a page that you do not control. Re-pasting snippets into DevTools
on every page load is repetitive and error-prone. Kode Injector solves this by
mapping local files (using `file:///` URLs) to website hostnames. When you visit
a matching site, the extension automatically injects the associated JavaScript
and CSS — every time, without manual steps.

## Table of Contents

- [Installation](#installation)
- [Quick Start](#quick-start)
- [Features](#features)
- [Permissions](#permissions)
- [FAQ / Troubleshooting](#faq--troubleshooting)
- [Documentation](#documentation)

---

## Installation

[![Chrome Web Store](
  https://img.shields.io/badge/Chrome-Add_to_Store-blue
)](
  https://chrome.google.com/webstore/detail/kode-injector/fgdehkdkmaiedleekbjpfoicpmodbicg
)

Install Kode Injector from the Chrome Web Store.

### Install from source

To run the latest development build from source:

1. Clone the repository.
2. Run `make build` to create release builds for Chrome, Edge, and Firefox.
3. In Chrome or Edge, open the browser's extensions page and enable
   **Developer mode**.
4. Click **Load unpacked** and select `build/release/chrome/` for Chrome or
   `build/release/edge/` for Edge.

For Firefox, open `about:debugging`, select **This Firefox**, click
**Load Temporary Add-on**, and select `build/release/firefox/manifest.json`.
Firefox 153 or newer is required. In the extension's settings, open
**Permissions** and enable **Access local files on your computer** before using
local injection paths.

See [DEVELOPMENT.md](DEVELOPMENT.md) for full setup details.

## Quick Start

1. Install the extension from the Chrome Web Store (or load it from source).
2. Navigate to a website where you want to inject code.
3. Click the **Kode Injector** toolbar icon, then click the settings button to
   open the options page.
4. In the **Add injection** form, enter the site hostname, a `file:///` path to
   your JavaScript file, and a `file:///` path to your CSS file, then click
   **Add injection**.
5. Reload the target site — your JavaScript and CSS are now injected
   automatically.

## Features

### Injection rules

Create rules that map a website hostname to local JavaScript and CSS files.
Each rule specifies:

- **Site** — the hostname to match (e.g. `example.com`).
- **JS file path** — a `file:///` URL to a JavaScript file.
- **CSS file path** — a `file:///` URL to a CSS file.

Matching rules are applied automatically whenever you visit the site.

### Manage injections

Open the options page to view all your injection rules in a table. From there
you can:

- **Toggle** an injection on or off without deleting it.
- **Delete** an injection permanently.
- Click a file path to open the referenced local file in a new tab.

### Per-site control

The toolbar popup shows the current site's hostname and lets you enable or
disable all injections for that site with a single switch.

### Global pause

Need to temporarily stop all injections across every site? Use the pause button
in the popup header to suspend injecting everywhere, then resume with one click
when you are ready.

### Localized interface

The interface is available in 30 languages, including English and Russian.
The options page header has a language selector; choose **Browser language** to
follow the browser UI automatically, or select a specific language. Changes
apply immediately in open options pages and popups. Unsupported browser
languages use English, and the extension preserves the browser's direction for
Arabic, Persian, and Hebrew.

The extension's manifest name and description remain controlled by the browser's
WebExtension locale rules. The in-app selector changes the options and popup
interface only.

## Permissions

| Permission | Reason |
| --- | --- |
| `storage` | Save injection rules, settings, and the per-site blocklist |
| `scripting` | Inject JavaScript and CSS into web pages |
| `activeTab` | Read the current tab's URL to match injection rules |
| `<all_urls>` (host permission) | Run the content script and apply injections on any website |

---

## FAQ / Troubleshooting

**My code isn't being injected.**

Check that the injection rule's **Site** field matches the page's hostname,
that the file paths are valid `file:///` URLs, and that the injection is enabled
in the options table. Make sure the extension is not paused globally or disabled
for the current site via the popup.

**The popup shows "No injections".**

No injection rules match the current site's hostname. Open the options page and
add a rule for this site.

**The extension can't read my local file.**

Ensure the path is a valid `file:///` URL and that the file exists at that
location. The extension reads local files over `fetch()`, so the path must be
directly accessible by the browser. In Chrome or Edge, enable **Allow access to
file URLs** for Kode Injector. In Firefox 153 or newer, enable **Access local
files on your computer** from the extension's permissions. Kode Injector shows
a warning while this browser permission is disabled.

**How do I inject only JavaScript or only CSS?**

Currently each rule requires both a JS and a CSS file path. If you only need
one type, point the other field at an empty file.

---

## Documentation

- [Development](DEVELOPMENT.md) — how to set up and contribute
- [LLM agent rules](AGENTS.md) — AI-assisted development guidelines
