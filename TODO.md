## TODO
- [x] FIXME switch from webpack to rspack (actuallize bundle and remove what is not needed)
- [x] Add more locales
- [x] Switch from js to ts
- [ ] Handle popup open on the service pages
- [x] Create draft releases from version tags with GitHub Actions
- [x] Automate extension publishing to Chrome Web Store (deploy workflow on release publication)
- [ ] Automate extension publishing to Microsoft Edge Add-ons and Firefox Add-ons (AMO)
- [ ] Import/export injections
- [ ] Support multiple files per rule (arbitrary list of JS/CSS sources instead
      of one jsPath + one cssPath; needs storage schema v3 migration — the
      versioned migration runner in src/app/common/storage-migrations.ts is
      ready for it — plus editor UI for adding/removing/reordering file rows,
      and generalizing the per-file enabled flags to the list entries)
- [x] Switch to vitest

## Promotion / store listing
- [ ] Rework the Chrome Web Store listing title: lead with the job, not the name
      (e.g. "Kode Injector — run local JS/CSS on any site"); keep under 45 chars
      so it is not truncated in search results
- [ ] Rewrite the store short description around the developer workflow
      (map local build output to staging/prod, toggle per site, no rebuild) and
      repeat the main keywords ("inject JavaScript", "inject CSS", "userscript",
      "local files") naturally for store search
- [ ] Upload fresh 1280x800 store screenshots of the redesigned UI (light +
      dark options page, rule editor, popup on a stage) and a 440x280 small
      promo tile in the new brand style
- [ ] Localize the store listing description for the top store languages
      (the extension UI already ships 30 locales — mention that in the listing)
- [ ] Add a short demo GIF/video (add a rule -> reload -> injected) for the
      store listing and the README
- [ ] Refresh the README hero: feature bullets under the screenshot, dark-mode
      screenshot variant, badges for store rating/users once available
- [ ] Announce the redesign: GitHub release notes with before/after screenshots,
      post to r/webdev / Hacker News (Show HN) / dev.to write-up about the
      design-token + Mantine migration
- [ ] Ask early users for Chrome Web Store reviews after the redesign ships
      (in-product "enjoying it? leave a review" link in Options footer, gated
      and dismissible)
