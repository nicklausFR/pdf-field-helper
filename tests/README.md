# Browser checks

Use Node.js, Playwright and Google Chrome. If Playwright is not installed in the project, set `PLAYWRIGHT_MODULE` to the path of its package directory.

Run these checks from the repository root after rebuilding the standalone application:

```sh
node scripts/build-standalone.cjs
node tests/portable-form.cjs
node tests/save-pdf-ui.cjs
node tests/browser-storage.cjs
node tests/delimited-fields.cjs
```

`portable-form.cjs` creates synthetic documents, tests editable PDF and offline HTML exports, and writes fixtures used by `save-pdf-ui.cjs`. Run those two in the order shown. `browser-storage.cjs` checks restoration of legacy browser records; the current Save buttons write PDFs.

`delimited-fields.cjs` requires the local CERFA fixtures in `Pour_test/`: `cerfa_13406-17.pdf`, `cerfa_13757-03.pdf`, `cerfa_14599-01.pdf`, `cerfa_15036-02.pdf`, and `cerfa_15692-01.pdf`. These PDFs are not included in the repository. Set `QA_DIR` to a local output directory to save visual checks.

Generated documents, screenshots and temporary browser profiles are written under `tmp/`, which is excluded from Git.
