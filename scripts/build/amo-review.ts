/**
 * @file Reviewer-facing texts shipped with the Firefox source archive.
 *
 * Mozilla requires a source archive whenever the submitted bundle is
 * minified. The build instructions live inside that archive's README, and a
 * short plain-text pointer is uploaded to the AMO `approval_notes` field.
 *
 * See https://extensionworkshop.com/documentation/publish/source-code-submission/
 */

/**
 * Invisible table-of-contents anchor kept in the repository README.
 *
 * The source archive build replaces it with a visible link to the reviewer
 * section it appends, so the public README stays free of review-only content.
 */
export const AMO_REVIEW_TOC_ANCHOR = '<!-- TOC:AMO_REVIEW -->';

/**
 * Heading of the reviewer section appended inside the source archive.
 */
export const AMO_REVIEW_SECTION_HEADING = '## Building Instructions for Firefox Add-ons Review Team';

/**
 * Table-of-contents entry that replaces the anchor inside the archive.
 */
const AMO_REVIEW_TOC_ENTRY = '- [Building Instructions for Firefox Add-ons Review Team]'
    + '(#building-instructions-for-firefox-add-ons-review-team)';

/**
 * Reviewer section appended to the README inside the source archive.
 */
const AMO_REVIEW_SECTION = `
${AMO_REVIEW_SECTION_HEADING}

This section is intended for the Firefox Add-ons Review team to reproduce the
extension build from this source archive.

### Prerequisites

Linux or macOS with Node.js 24.x. pnpm is provisioned through corepack at the
version pinned in \`package.json\`; no other tooling is required.

### Building the release version

\`\`\`sh
corepack enable
pnpm install --frozen-lockfile
pnpm release firefox
\`\`\`

The build output is \`build/release/firefox.zip\`, whose contents match the
submitted package. When building from this archive rather than from a git
checkout, the build prints a warning that the nested source archive is
skipped; that is expected.

### Why the nativeMessaging permission is required

Firefox extension pages cannot read \`file:///\` URLs, and the purpose of this
add-on is to inject JavaScript and CSS that the user keeps in local files. The
extension therefore reads those files through **Kode Injector Helper**, a
separate open source companion application that the user installs themselves.

The helper is read-only: it accepts a path over native messaging, returns that
file's contents, and does nothing else. No writes, no shell execution, no
network access. Its source is in this archive under \`native-host/\` (Go), and
signed packages are published on
[GitHub Releases](https://github.com/maximtop/kode-injector/releases).

The add-on itself makes no network requests: no analytics, no telemetry, no
remote code.

### How to test

1. Install Kode Injector Helper for your platform from the GitHub Releases
   page above, open it, and click **Install**. This registers the native
   messaging manifest for \`kode-injector@maximtop.dev\`.
2. Create \`/tmp/test.css\` containing \`body { background: #0f0 !important; }\`.
3. On the add-on's options page, add an injection with site \`example.com\` and
   CSS path \`file:///tmp/test.css\`. A rule needs a site plus at least one of
   the JS or CSS paths.
4. Open <https://example.com> — the page background turns green. Injection
   runs at document start.
5. The toolbar popup switch disables injections for the current site, and the
   pause button in the popup header suspends all injections everywhere.

Contact: maximtop@gmail.com
`;

/**
 * Plain-text notes uploaded to the AMO `approval_notes` field.
 *
 * Mozilla shows these next to the submitted version, so they stay short and
 * point at the full instructions inside the source archive.
 */
export const APPROVAL_NOTES = `Build reproduction instructions for the Firefox Add-ons Review team.

The attached source archive is the committed repository state that produced
the submitted package. To rebuild it, use Linux or macOS with Node.js 24.x
(pnpm is provisioned through corepack):

    corepack enable
    pnpm install --frozen-lockfile
    pnpm release firefox

Output: build/release/firefox.zip — compare its contents with the submitted
package.

Full details are in README.md inside source.zip, in the section
"Building Instructions for Firefox Add-ons Review Team": why the
nativeMessaging permission is required, and a step-by-step test scenario
with the Kode Injector Helper companion application.

Source repository: https://github.com/maximtop/kode-injector (MIT license)
Contact: maximtop@gmail.com
`;

/**
 * Rewrites README content for the source archive.
 *
 * @param readme Repository README content.
 *
 * @returns README with the reviewer table-of-contents entry and section.
 *
 * @throws When the README does not carry the reviewer anchor.
 */
export const appendAmoReviewSection = (readme: string): string => {
    if (!readme.includes(AMO_REVIEW_TOC_ANCHOR)) {
        throw new Error(`README is missing the ${AMO_REVIEW_TOC_ANCHOR} anchor.`);
    }

    return `${readme.replace(AMO_REVIEW_TOC_ANCHOR, AMO_REVIEW_TOC_ENTRY)}\n${AMO_REVIEW_SECTION}`;
};
