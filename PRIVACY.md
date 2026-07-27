# Kode Injector Privacy Policy

Effective date: July 27, 2026

Kode Injector is a browser extension that lets a user associate local
JavaScript and CSS files with website hostnames and apply that code when a
matching page is opened. This policy explains what information the extension
processes and how it is handled.

## Information processed by the extension

Kode Injector processes the following information locally on the user's
device:

- Injection rules created by the user, including website hostnames, local file
  paths, per-file state, and enable or disable settings.
- The URL and hostname of an open browser tab, so the extension can determine
  which user-created rules apply and display the matching state in its popup.
- The contents of local JavaScript and CSS files explicitly selected by the
  user. The extension reads those files only to apply the configured rule to a
  matching website.
- Interface preferences such as language, theme, and local-file access method.

These values are application data required to provide the extension's single
purpose. They are not used for advertising, profiling, or analytics.

## Storage and transmission

Rules and preferences are stored in the browser's local extension storage.
Kode Injector does not operate a server and does not transmit rules, browsing
activity, local file paths, or local file contents to the developer or to an
analytics service.

In Chrome and Microsoft Edge, local files are read through browser-managed
file-URL access by default. If the user explicitly selects the optional Native
Host method, Kode Injector Helper reads only the exact local regular file path
requested by the extension. The helper is read-only: it cannot write files,
list directories, execute programs, start subprocesses, or access the network.

When a rule matches, the user-selected JavaScript or CSS is applied to that
website in the browser. The selected code is therefore exposed to scripts
running on that page: CSS is inserted into the page DOM, and JavaScript runs in
the page's main world. Injected JavaScript also logs its configured local file
URL in that page's console for diagnostics. The website can process or transmit
information available to its page under its own privacy policy. Users should
only configure code and websites they trust.

Links to GitHub Releases, documentation, or support open only after a user
action. Those sites process requests under their own privacy policies.

## Sharing and sale

Kode Injector does not sell personal information. It does not share personal
information with the developer, advertisers, data brokers, or other third
parties, except for the user-directed disclosure of selected source code and
the JavaScript file URL to the website configured for that rule as described
above.

## Retention and deletion

Rules and preferences remain in local browser storage until the user deletes
them, clears the extension's data, or uninstalls the extension. The developer
does not hold a server-side copy.

## Children

Kode Injector is a developer tool and is not directed to children. It does not
knowingly collect personal information from children.

## Changes to this policy

Material changes will be published in this repository with a new effective
date. The public version history records previous revisions.

## Contact

Questions or privacy requests can be sent to
[maximtop@gmail.com](mailto:maximtop@gmail.com) or filed through
[GitHub Issues](https://github.com/maximtop/kode-injector/issues/new).
