# Books seed data

Shipped, version-controlled corpus used to seed an **initial book list** into the
AppQyV1 database on first `sys:init`, so the Books UI is never empty on a fresh
install and no network fetch is required.

## `bible-corpus.unique.tar.xz.js`

- **What it is:** an xz-compressed tar of the zeoinjesus.com Chinese/English
  parallel Bible — 66 books, chapter → verse, bilingual. ~4.7 MB.
- **Why the `.js` extension:** the payload is a binary archive; the `.js`
  suffix lets it live cleanly in the code tree and be committed without binary
  tooling friction. It is **not** JavaScript. The seed step strips the `.js`
  (in a temp dir) to recover the real `bible-corpus.unique.tar.xz` before
  extracting. Magic bytes are `fd 37 7a 58 5a 00` (xz).
- **Archive layout:** a single top dir `zeoinjesus-bible/` containing
  `NN_<abbr>_<English>.json` per book plus `index.json` / `stats.json`.

## How it is consumed

`App\Apps\AppQyV1\Utils\AppQyV1SystemInit\AppQyV1BookSeedImporter`, invoked by the
`seed_books` step of `AppQyV1Initializer`:

1. copies this blob to a **runtime temp dir** (`PathMapper::getLaravelTmpDir`)
   under its real `.tar.xz` name and extracts it **there** — the code tree is
   never polluted with the extracted JSON;
2. idempotently ensures `tar` + `xz`/`7z` (best effort);
3. transcodes each book into a Books v3 `model_version:3` payload
   (chapter → per-language `slots[].langs{en,zh}`) and calls
   `MediaIngestService::ingest()` (fill-missing, never clobber);
4. deletes the temp dir.

Idempotent: a completion sentinel (last book, `mal`) short-circuits re-seeding;
a reset/empty DB re-seeds automatically. See
`poly_apps/pycore_laravel_wordnew_ui/apps/wordnew/docs/BOOKS_FEATURE_SPECIFICATION.md` §11.

## Seeded editions / license

Only two **public-domain** editions are inserted as the bilingual pair:

- `en` ← **KJV** (King James Version, 1611)
- `zh` ← **CUV** (Chinese Union Version, 1919)

The full six editions (`cuv/kjv/lzz/nasb/ncv/niv`) remain inside the blob and are
listed in each book's `metadata.available_versions`. **Personal academic /
devotional study use only.**

## Regenerating the blob

Produced by `scripts/learning-tools/zeoinjesus-bible`:

```bash
cd scripts/learning-tools/zeoinjesus-bible
node scrape.js                              # writes ~/.core_node/learning-tools/zeoinjesus-bible
# package WITHOUT the redundant combined bible.json (the per-book files are enough):
tar -C ~/.core_node/learning-tools --exclude='*/bible.json' -cf - zeoinjesus-bible | xz -9e > bible-corpus.unique.tar.xz
cp bible-corpus.unique.tar.xz <repo>/poly_apps/laravel_main/database/seed_data/books/bible-corpus.unique.tar.xz.js
```
