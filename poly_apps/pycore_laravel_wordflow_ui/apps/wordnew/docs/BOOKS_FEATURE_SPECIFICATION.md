# Books Feature Specification (v3.1 — unified per-language sentence + chapter model)

> v3.1 (2026-06-19): chapters are now **per-language** (`app_qy_v1_chapters_{lang}`);
> the shared `app_qy_v1_sentences` / single `app_qy_v1_chapters` tables are **removed**
> (no compatibility layer); all `language` fields are **codes only**; v1/v2 ingest is
> folded into the per-language model. `sys:init` idempotently creates the full
> per-language set and drops the removed tables.

Status: CANONICAL. This document is the single source of truth for the Books
feature across **pycore** (Python scanner + React UI) and **laravel_main** (DB +
ingest + audio). It supersedes the conflicting parts of:

- `pycore/docs/pipelines/MEDIA_SYNC_PIPELINE.md` §2 (dual-key shared table) and §8
  (books v2 model) — the **single shared `app_qy_v1_sentences` table is deprecated**;
  see §3 below.
- `development-guides/SENTENCE_AUDIO_GENERATION_PIPELINE.md` — audio is now keyed by
  `(language, content_id)` against the per-language sentence tables; see §6.

When this doc and an older doc disagree, **this doc wins**; update the older doc to
point here (done as a linked change).

---

## 1. Goal

For **any** book (any format: txt/md/pdf/docx/doc/epub/html/htm/rtf), the scanner
must extract:

1. **All chapters.** Every chapter the format/heuristics can find. If a book yields
   **no** detectable chapters, it is represented as **exactly one** chapter ("default
   chapter") that contains all sentences.
2. **All sentences under each chapter**, preserving the existing **sentence grains**
   (`cue` = one source line/paragraph; `sentence` = lines merged then re-split on
   terminal punctuation). Both grains are kept ("以前句子类型" — keep the prior
   sentence typing).
3. **Multi-language correspondence.** The UI requires **at least one** language and
   allows **multiple** checked languages. Each sentence is a *correspondence slot*:
   it has text in the languages the book actually contains, and the other checked
   languages are **left empty** (the slot still exists so the FE renders a blank for
   that language). All languages are shown in the FE per sentence.

### 1.1 ONE shared multi-language sentence library (applies to ALL source types)

This is the central invariant for the whole platform, not just books:

- There is **ONE shared, multi-language sentence library** — the per-language
  `app_qy_v1_sentences_{lang}` tables (§3.1). It is shared across **every** source
  type: **book, subtitle, document, article — and any future type.**
- **Every** such source **keeps its own original text** (the book's `full_content`,
  the subtitle's `.srt` backup, the document/article body) **AND** maps each of its
  sentences **into the shared library** — never a private per-source sentence copy.
- Mapping = the `app_qy_v1_source_sentences` slot (§3.3): `source_type ∈
  {book, subtitle, document, article}`, with `corr_id` + `lang_content_ids` linking
  the slot to the shared per-language sentence rows by `content_id`.
- The library **deduplicates by `content_id`** (fill-missing, `occurrence_count++`):
  the same sentence appearing in a book, a subtitle, a document and an article is
  ONE row per language, referenced by four slots. Audio (§6) is therefore generated
  **once** and reused everywhere.
- `MediaIngestService::ingest()` accepts all four `source_type`s (one persistence
  path). Documents (`AppQyV1VocabularyDocumentController`, `source_type='document'`)
  and articles (`source_type='article'`) map through the same per-language model;
  see §13.

---

## 2. Supported languages

Canonical set = `AppQyV1TableMaps::getSupportedLanguages()`
(= keys of `config('edge_tts.lang_code_mapping')`) — the **same set** that backs the
per-language word tables `app_qy_v1_tts_cache_{lang}`. Always **language codes**
(`en`/`zh`/`ja`/...), never names. pycore's canonical list must mirror this set.

**Language-field normalization (mandatory).** Every `language`/lang field in every
table, payload and API stores a **code only**. Legacy full-name values (`english`,
`japanese`, ...) are **not supported** anywhere in the new model — normalize to codes
on the way in and reject/normalize names. This is a clean cut (see §3.4): there is no
dual name/code compatibility layer.

---

## 3. Database schema (laravel_main) — created at `sys:init`

All tables are created by **migrations**, which `sys:init` runs in its
`run_migrations` step (`AppQyV1Initializer`). Per-language tables are created by a
migration that loops `AppQyV1TableMaps::getSupportedLanguages()` — exactly mirroring
`AppQyV1_2026_05_19_000000_create_tts_cache_dictionary_tables.php`. Every `create()`
is guarded by `hasTable()`; `down()` is a **no-op** (never drop sentence data).

### 3.1 `app_qy_v1_sentences_{lang}` (per language) — AUTHORITATIVE sentence store

Replaces the single shared `app_qy_v1_sentences` table. One table per supported
language. Columns:

| column | type | notes |
|---|---|---|
| `id` | bigIncrements | |
| `content_id` | string(32), **unique** | `md5(lowercase(collapse(strip_punctuation(text))))` — language-agnostic content key, unique within this table |
| `sentence_id` | string(64), index | `sha1(normalize(text) . '|' . lang)` — legacy compat key |
| `corr_id` | string(40), index, nullable | cross-language correspondence group id (see §5) |
| `text` | text | original case, punctuation-stripped + whitespace-normalized |
| `language` | string(20), index | the lang code (== table suffix) |
| `explanation` | text, nullable | AI enrich-only |
| `ai_commentary` | text, nullable | AI enrich-only |
| `grammar` | text, nullable | AI enrich-only |
| `special_usage` | text, nullable | AI enrich-only |
| `audio` | string, nullable | relative path cache `"{lang}/{content_id}.mp3"` |
| `has_audio` | boolean, default false, index | DB flag ONLY; the file on disk is truth (§6) |
| `occurrence_count` | integer, default 1 | times ingested |
| `metadata` | json, nullable | |
| `tts_status` | string(20), index, nullable | pending/processing/completed/failed |
| `tts_attempts` | integer, default 0 | |
| `tts_error` | text, nullable | |
| `tts_locked_at` | dateTime, index, nullable | claim lease |
| `tts_locked_by` | string(100), nullable | claim lease owner |
| `tts_priority` | integer, default 0, index | |
| `tts_requested_at` | dateTime, nullable | |
| `tts_completed_at` | dateTime, nullable | |
| `created_at`,`updated_at` | timestamps | |

### 3.2 `app_qy_v1_chapters_{lang}` (per language) — book/subtitle chapters

Chapters are **per-language** (a book may carry chapters in several languages; the
title/structure can differ per language). One table per supported language, created
by the same `getSupportedLanguages()` loop migration as §3.1 (idempotent `hasTable()`
guard, no-op `down()`). Cross-language correspondence is by `(source_type, source_key,
chapter_index)` — the same `chapter_index` across the per-language chapter tables is
"the same chapter". A language the book lacks simply has **no row** (or a null-title
row) in that language's chapter table (**留空**).

| column | type | notes |
|---|---|---|
| `id` | bigIncrements | |
| `source_type` | string(20), index | `book` \| `subtitle` |
| `source_key` | string(64), index | FK to books/subtitles `source_key` |
| `chapter_index` | integer, default 0 | 0-based order; a no-chapter book has a single row `chapter_index=0` |
| `language` | string(20), index | the lang code (== table suffix) |
| `title` | string, nullable | chapter title in this language (or `"Chapter 1"` default), null where 留空 |
| `corr_id` | string(40), index, nullable | `sha1(source_key . '|chapter|' . chapter_index)` — cross-language chapter group |
| `sentence_count` | integer, default 0 | |
| `metadata` | json, nullable | |
| `created_at`,`updated_at` | timestamps | |
| unique | (`source_type`,`source_key`,`chapter_index`) | |

`AppQyV1TableMaps::getChapterTableName(string $langCode): string`
→ `"{prefix}_chapters_{lang}"` (mirrors `getSentenceTableName`).

### 3.3 `app_qy_v1_source_sentences` (EXTEND existing) — slot + correspondence anchor

Existing columns kept: `source_type`, `source_key`, `grain`, `seq`,
`seg_index`, `sub_idx`, `start_sec`, `end_sec`, `metadata`, timestamps;
unique(`source_type`,`source_key`,`grain`,`seq`). **Add** (idempotent migration,
`hasColumn()` guards):

> **Redundancy note (decided):** `source_sentences` does **NOT** duplicate text —
> text lives only in `sentences_{lang}`. This table is the persistent index of
> *order + cross-language correspondence (`corr_id`/`lang_content_ids`) + timing +
> library reference*, not recoverable cheaply from the source's raw original (esp.
> multi-track subtitle alignment). It is KEPT. The legacy **`sentence_id` column is
> REMOVED** (dropped via `dropColumn`, `hasColumn`-guarded) — the per-language link
> is now carried entirely by `lang_content_ids` (`content_id` refs). The unique key
> `(source_type, source_key, grain, seq)` does not use it, so the drop is safe.

| column | type | notes |
|---|---|---|
| `chapter_index` | integer, default 0, index | which chapter this slot belongs to |
| `corr_id` | string(40), index, nullable | correspondence group id for this slot |
| `primary_language` | string(20), nullable | the source's primary language code |
| `lang_content_ids` | json, nullable | `{"en":"<md5>","ja":null,"zh":"<md5>"}` — per selected-language content_id, `null` = empty correspondence |

`source_sentences` is **language-independent**: one row per (source, grain, seq)
slot. The actual per-language text lives in `app_qy_v1_sentences_{lang}` keyed by the
`content_id` found in `lang_content_ids`.

### 3.4 Removed — but DATA-PRESERVING (migrate-then-drop, never destroy)

The single shared sentence table and the single shared chapters table are retired in
favour of the per-language stores. **This is NOT a destructive clean cut**: a real
install carries v1/v2 subtitle/book sentences in the shared table, and the project
rule is *idempotent structure adjustment, never rebuild/destroy existing data*. So the
removal migration (`AppQyV1_2026_06_19_000004`) **migrates the rows first, then drops**:

- `app_qy_v1_sentences` (shared single table): its **creating migration is removed**
  so `sys:init` no longer creates it. The removal migration **copies every row into
  its per-language `app_qy_v1_sentences_{lang}` table** (lang from `normalizeLangCode`,
  keyed by `content_id`, `insertOrIgnore` = fill-missing / never clobber), **then**
  `dropIfExists`. `hasTable`-guarded + re-runnable; on any error it leaves the shared
  table in place (does not drop) so a later pass can retry. The `Sentence` Eloquent
  model is removed; **v1 (subtitle) and v2 (book) ingest are folded into the
  per-language model** — every path writes `app_qy_v1_sentences_{lang}` /
  `app_qy_v1_chapters_{lang}` using language **codes**; read paths resolve via
  `SourceSentence::langSentence($lang)` (the old `sentence` relation is gone).
- `app_qy_v1_chapters` (single shared chapters table, if an earlier pass created it):
  rows are folded into `app_qy_v1_chapters_{lang}` (primary language from
  `source_sentences`, else `en`) **then** the shared table is dropped; replaced by the
  per-language `app_qy_v1_chapters_{lang}` tables (§3.2).

`sys:init` must (a) **not** create the removed tables, (b) idempotently create the full
per-language set every run (`hasTable()` guards), and (c) **never lose existing data** —
the shared tables are emptied into the per-language stores before being dropped.

---

## 4. Models (laravel_main)

- `LangSentence` model — table set dynamically via `setTable(AppQyV1TableMaps::getSentenceTableName($lang))`,
  fillable = all §3.1 columns. Helper `LangSentence::for($lang)`.
- `LangChapter` model — table set dynamically via `setTable(AppQyV1TableMaps::getChapterTableName($lang))`,
  fillable = all §3.2 columns. Helper `LangChapter::for($lang)`. (Replaces the removed
  single-table `Chapter` model.)
- `AppQyV1TableMaps::getSentenceTableName($langCode)` → `"{prefix}_sentences_{lang}"`
  and `getChapterTableName($langCode)` → `"{prefix}_chapters_{lang}"`
  (both mirror `getDictionaryTableName`).
- `SourceSentence`: add `chapter_index`, `corr_id`, `primary_language`, `lang_content_ids`
  to fillable + cast `lang_content_ids` to array. Add a `langSentence($lang)` accessor
  resolving from the per-language table by `content_id`, and a `langChapter($lang)`
  accessor by `chapter_index`.
- The `Sentence` model (shared table) is **removed**; all callers use `LangSentence`.

---

## 5. Correspondence semantics

- A book has a detected **primary language** `L0`. The UI submits the set of checked
  languages `Lsel` (≥1; `L0` is auto-checked and cannot be unchecked).
- For each sentence slot (per grain, in chapter order):
  - Compute `corr_id = sha1(source_key . '|' . grain . '|' . seq)` (stable per slot).
  - For each `Li ∈ Lsel`: if the book actually contains text for `Li` at this slot,
    upsert it into `app_qy_v1_sentences_{Li}` (dedupe by `content_id`, fill-missing,
    increment `occurrence_count`), and set `lang_content_ids[Li] = content_id`. If the
    book has no `Li` text, set `lang_content_ids[Li] = null` (**留空** — empty).
  - All rows for one slot share `corr_id`, so the FE can render every checked language
    side by side, blank where `null`.
- Monolingual book (only `en`) with `Lsel = [en, ja, zh]` →
  `lang_content_ids = {"en":"<md5>","ja":null,"zh":null}`.

---

## 6. Sentence audio (PHP-computed path, DB flag only)

- File path is **PHP-computed** and disk is the source of truth:
  `PathMapper::getAppQyV1SentenceSoundsDir("{lang}/{content_id}.mp3")`.
- DB stores only a **flag** (`has_audio`) + cache (`audio`) to **prevent duplicate
  generation** ("数据库中只是标识，防止重复生成"). Resolution always stats disk first
  and reconciles the flag (existing file-first logic, now keyed by `content_id` and
  the per-language table).
- Claim/report/resolve operate on `app_qy_v1_sentences_{lang}`:
  - **claim**: `WHERE has_audio=false` ordered by `tts_priority DESC, occurrence_count DESC, id ASC`,
    across the requested language(s); honor lease (`tts_locked_at`/`tts_locked_by`).
  - **report**: validate audio, write file via PathMapper, set `has_audio=true`,
    `audio="{lang}/{content_id}.mp3"`, `tts_status=completed`; idempotent (existing file → `already_done`).
  - **resolve** (`GET .../tts/sentence/audio?hash=<content_id>&language=<lang>`):
    file-first stat, URL via `AppQyV1SentenceAudioUrl::forRelative("{lang}/{content_id}.mp3")`.
- Serve route `/static/app_qy_v1/sentence_sounds/{language}/{filename}` unchanged.

---

## 7. Ingest contract (pycore → laravel_main `POST /api/app_qy_v1/media/ingest`)

`model_version: 3`. Payload:

```jsonc
{
  "source_type": "book",            // or "subtitle"
  "model_version": 3,
  "source": {
    "source_key": "<sha1 of abs path>",
    "title": "...", "original_name": "...", "ascii_name": "...",
    "language": "en",               // primary language L0
    "selected_languages": ["en","ja","zh"],   // Lsel (>=1, includes L0)
    "full_content": "...",          // backup
    "metadata": { /* TextStats: counts, languages[], etc. */ },
    "poster": { /* optional */ }
  },
  "chapters": [
    {
      "chapter_index": 0,
      "sentence_count": 42,
      "titles": {                   // per-language chapter title; null => 留空
        "en": "Chapter 1",
        "ja": null,
        "zh": null
      }
    }
  ],
  "slots": [                        // ordered correspondence slots
    {
      "chapter_index": 0,
      "grain": "sentence",          // or "cue"
      "seq": 0,
      "corr_id": "<sha1>",
      "primary_language": "en",
      "langs": {                    // per-language text; missing/empty => null
        "en": "the actual english sentence",
        "ja": null,
        "zh": null
      },
      "seg_index": null, "sub_idx": null, "start_sec": null, "end_sec": null
    }
  ]
}
```

Server: idempotent fill-missing (never clobber). For each chapter, upsert a row into
each selected language's `chapters_{lang}` (title where present, else null/留空) with
`corr_id = sha1(source_key . '|chapter|' . chapter_index)`. For each slot/lang with
non-null text → compute `content_id`, upsert `sentences_{lang}`, set `lang_content_ids`.
All `language` values are **codes**. Chunked ingest (first chunk carries
source+chapters; later chunks carry only `source_key` + more `slots`). Audio is
**never** generated at ingest (filled later by the TTS worker).

---

## 8. pycore Python (scanner + sync)

- `book_processor.py`: add `segment_chapters(text, ext, language) -> List[{chapter_index,title,text}]`:
  - **epub**: chapters from spine/TOC items (ebooklib); each item is a chapter.
  - **html/htm**: split on `<h1>`/`<h2>` headings.
  - **md**: split on `#`/`##` headings.
  - **txt/pdf/docx/doc/rtf**: heading regex — `^(Chapter|CHAPTER)\s+[\dIVXLC]+`,
    `^第\s*[0-9一二三四五六七八九十百千]+\s*[章回]`, markdown headings, standalone
    short ALL-CAPS / numbered lines.
  - **fallback**: a single chapter (`chapter_index=0`, title `"Chapter 1"`) with all text.
  - Each chapter's text → existing `segment_sentences()` (both grains preserved).
- Correspondence builder: the scanner provides per-language text where the book
  supplies it (multi-language books). For monolingual books only `L0` is filled; the
  other `Lsel` are emitted as `null`. Per-sentence language detection still runs.
- Build `model_version:3` payload (§7); keep `source_key = sha1(normalized abs path)`.
- Endpoints: `/analyze` and `/submit` accept `languages: string[]` (≥1) and return
  the chapter→slot tree; `/list` supports `kind=chapters` and chapter-scoped sentences.

## 9. pycore React UI (PcBooksPage + BooksPanel)

- **Language multi-select**: checkbox group of supported languages; **≥1 required**
  (validate before analyze/submit); the detected primary language is checked and
  locked. Selection is passed as `languages` to the API.
- **Chapter → sentence tree**: render chapters; under each, the sentences; each
  sentence shows **all checked languages** side by side, blank where the
  correspondence is empty. Keep the grain (cue/sentence) indicator.
- Types: `Book → Chapter[] → Slot{ corr_id, grain, seq, langs: Record<lang,string|null> }`.
  Chapters carry a per-language `titles: Record<lang,string|null>` (or a resolved
  primary-language `title`); the FE shows the chapter title in the active/primary language.

---

## 10. Conflict resolution checklist (done as linked changes)

- [x] `MEDIA_SYNC_PIPELINE.md` §2/§8: replace "single shared sentence table" +
      "dual-key" with the per-language model; link here.
- [x] `SENTENCE_AUDIO_GENERATION_PIPELINE.md`: audio keyed by `(language, content_id)`
      against per-language tables; link here.
- [x] Memory notes (media-sentence-pipeline / sentence-audio-pipeline) updated.
- [ ] v3.1: chapters → per-language `app_qy_v1_chapters_{lang}`; shared
      `app_qy_v1_sentences` + single `app_qy_v1_chapters` removed (drop migration +
      code removal); all `language` fields normalized to codes; v1/v2 ingest folded
      into the per-language model; docs (this + the two pipeline docs) re-synced.

## 11. Shipped seed corpus (initial book list)

A fresh install ships with an initial book list so the Books UI is never empty
on first run — no network fetch required.

- **Committed blob:** `poly_apps/laravel_main/database/seed_data/books/bible-corpus.unique.tar.xz.js`.
  An xz-compressed tar of the zeoinjesus.com Chinese/English parallel Bible
  (66 books) carrying a `.js` extension so the binary lives cleanly in the code
  tree. ~4.7 MB. Personal academic / devotional study use only; the seeded pair
  is public-domain (en ← KJV, zh ← 和合本 CUV). The full 6-edition corpus
  (cuv/kjv/lzz/nasb/ncv/niv) is inside the blob and noted in each book's
  `metadata.available_versions`. Regenerate with
  `scripts/learning-tools/zeoinjesus-bible` (`scrape.js`).

- **Seed step:** `AppQyV1Initializer` runs a new idempotent `seed_books` step
  (after `seed_initial_data`) →
  `App\Apps\AppQyV1\Utils\AppQyV1SystemInit\AppQyV1BookSeedImporter`. It:
  1. copies the blob to a **runtime temp dir** (`PathMapper::getLaravelTmpDir`)
     under its real `.tar.xz` name and extracts it THERE — the code tree is
     never polluted with the extracted JSON;
  2. best-effort/idempotently ensures decompression tooling (tar + xz/7z;
     attempts `apt-get install xz-utils` on Debian/Ubuntu if missing);
  3. transcodes each book → a `model_version:3` payload (chapter → per-language
     `slots[].langs{en,zh}`) and calls `MediaIngestService::ingest()`
     (fill-missing, never clobber);
  4. deletes the temp dir.

  v3.1 note (chapter layer): chapters are persisted to per-language
  `app_qy_v1_chapters_{lang}` via the `LangChapter` model (the single shared
  `app_qy_v1_chapters` table + `Chapter` model were removed). `ingestChapters`
  creates a chapter row for **every** `source.selected_languages[]`, so the
  seed payload MUST set `source.selected_languages = ['en','zh']` (in addition
  to `source.language = 'en'`) — otherwise only the primary-language chapter
  rows are written and `zh` chapters are missing. A language with no chapter
  title gets a null-title row (留空). `slots[].langs` is iterated directly, so
  sentence-level seeding does not depend on `selected_languages`.

- **Idempotency:** a completion sentinel (the last book, `mal`) is checked by
  `AppQyV1BookSeedImporter::isSeeded()` — used both by the importer fast-path and
  by `stepStillSatisfiedInDb('seed_books')`, so a reset/empty DB re-seeds while a
  seeded DB skips without touching the blob. Decompression/seed failure returns
  `'warning'` (non-fatal): init still completes and the seed retries next run.

---

## 12. Subtitles — multi-language (same per-language model)

Subtitles reuse the ENTIRE per-language model: `app_qy_v1_sentences_{lang}`,
`app_qy_v1_source_sentences` slots (`corr_id` + `lang_content_ids` +
`primary_language` + timing), `source_type='subtitle'`. **No new tables.** A
subtitle *source* = ONE video; one or more language tracks attach to the same
`source_key`. `media_segments` (clip mapping) is unchanged.

A subtitle is multi-language **or** single-language: each cue/sentence is a
correspondence slot whose `lang_content_ids` holds text for the languages present
and `null` for the other checked languages (留空), exactly like a book sentence.

### 12.1 Two input forms (pycore handles BOTH)

**(a) Single-file bilingual** — one `.srt` whose cue blocks contain lines in
several languages (the common 双语字幕). pycore splits each cue's lines by
detected language (`guess_language`) → ONE slot per cue, `langs` map across the
detected languages. Alignment is by cue order → `seq`, so
`corr_id = sha1("{source_key}|{grain}|{seq}")` (unchanged formula).

**(b) Multi-track** — several per-language `.srt` for the SAME video
(`movie.en.srt`, `movie.zh.srt`, ...). The **primary-language track defines the
canonical slots** (grain, `seq`, time window, `corr_id = sha1(source_key|grain|seq)`).
Each OTHER track's cue attaches to the primary slot with the **largest time
overlap** (`start_sec`/`end_sec`); its text fills `lang_content_ids[lang]`. A
secondary cue overlapping no primary slot is appended as an extra slot
(best-effort) and the drop/append count is `log()`-ed (no silent loss). pycore
performs the time alignment and emits ALREADY-MERGED `slots[].langs`; the second
track's own `seq` is NOT used for correspondence.

Both grains (`cue`, merged `sentence`) are preserved in both forms.

### 12.2 selected_languages

UI multi-select on the Voice & Subtitle page (≥1, primary locked) — same control
as Books §9. The set also auto-includes every language actually detected across
the tracks. Stored on `app_qy_v1_subtitles.selected_languages` (json, **add**
column, `hasColumn` guard) **and** per-slot `lang_content_ids`. `subtitles.language`
stays = primary code.

### 12.3 Ingest

`model_version:3`, `source_type:'subtitle'`. `slots[]` carry `langs` (multi) +
timing (`seg_index`/`sub_idx`/`start_sec`/`end_sec`); `laravel`
`MediaIngestService::ingestSlotsV3` MUST persist the timing columns for subtitle
slots. Chapters: subtitles use a single default chapter (`chapter_index 0`) unless
the video carries scene chapters. `media_segments` ingest unchanged. pycore now
emits v3 for subtitles (the legacy v1 `sentences[]`/`convertLegacyToV3` monolingual
path is replaced for new syncs).

### 12.4 Audio + correspondence

Identical to books: per-language `sentences_{lang}`, file-first audio keyed by
`(language, content_id)` (§6). The FE renders every checked language side by side
per cue/sentence, blank where `null`.

---

## 13. Documents & Articles (same shared library)

Documents and articles are first-class sources that map into the SAME shared
multi-language sentence library (§1.1). They keep their original body text AND map
every sentence into `app_qy_v1_sentences_{lang}` via `source_sentences` slots.

### 13.1 Documents (`source_type='document'`) — already integrated

`AppQyV1VocabularyDocumentController::extractSentences` ingests an uploaded
document's sentences into the per-language store (content_id-keyed) with positional
links in `source_sentences` (`source_type='document'`). It keeps the original
uploaded document (`AppQyV1UploadedDocumentModel`) as the source-of-truth text.
Bring it fully in line with the v3 model: write `corr_id` + `lang_content_ids` +
`primary_language` on each slot (multi-language when the document is multilingual,
else single language with the others `null`); language codes only.

### 13.2 Articles (`source_type='article'`) — to integrate

Articles (`AppQyV1ArticleController`, the `articles` table, daily-reading, the
`article` TTS type) currently keep article text + a private `article_words` table but
**do NOT yet map sentences into the shared library**. Integrate them:

- On article create/ingest, segment the body into BOTH grains (cue/sentence), upsert
  each sentence into `app_qy_v1_sentences_{lang}` by `content_id` (fill-missing,
  `occurrence_count++`), and write `source_sentences` rows with
  `source_type='article'`, `source_key` = the article's stable key (e.g.
  `'article_' . article_id` or the existing `article_id`), `corr_id =
  sha1(source_key|grain|seq)`, `primary_language`, `lang_content_ids`.
- The `articles` row keeps `content` (original text) — unchanged. `article_words`
  may stay (article-level word view) but words should resolve to the shared
  per-language `tts_cache_{lang}` dictionary like everywhere else.
- Multi-language: an article may carry several languages (checked set), same
  correspondence rules as §5; monolingual articles fill only the primary, others
  `null`.

### 13.3 Unified ingest path

`MediaIngestService::ingest()` must accept `source_type ∈ {subtitle, book, document,
article}` (widen the `in_array` guard). The source-row upsert switches per type
(book/subtitle/document/article row), but chapters(optional)/slots/words all flow
through the one per-language v3 path. Update the `source_type` column comments
(`source_sentences`, `MediaIngestTablesInitializer`) to `book|subtitle|document|article`.
Audio + correspondence are identical to §6/§5 for every type.
