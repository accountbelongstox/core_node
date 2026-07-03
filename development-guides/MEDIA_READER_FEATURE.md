# Media Reader (Books & Documents) — Feature Specification

Read-only reader for ingested **books** and uploaded **documents** on the
laravel-manager Vocabulary page (`/laravel-manager#/vocabulary` → **Libraries**
tab). Clicking a book card (Books Library panel) or a document row (Documents
panel) opens a full-screen reader with chapter/sentence modes, per-sentence
audio, continuous playback, and multi-page paging.

## 1. Entry points

| Source | Panel | Opens reader with |
|---|---|---|
| Book | `ExistingBooksPanel` card click | `kind='book'`, `sourceKey=item.source_key` |
| Document | `ExistingDocumentsPanel` row click | `kind='document'`, `documentId=doc.id` |

Both render one shared `MediaReaderModal`
(`components/vocabulary/reader/MediaReaderModal.tsx`).

## 2. Backend contract (all under `/api/app_qy_v1/media`, prefix `api.mediaQuery`)

### 2.1 Book detail — `GET /media/books/{source_key}`  (public)
Query: `grain` (`cue|sentence|all`, default `sentence`), `per_page` (≤2000,
default 500), `page`, `chapter_index` (scope to one chapter). Returns:
```
data: { source: <Book>, chapter_index: int|null,
        sentences: { items: ReaderSentence[], total, per_page, current_page, last_page } }
```

### 2.2 Book chapters — `GET /media/books/{source_key}/chapters`  (public)
```
data: { source_key, languages: string[], chapter_count,
        chapters: [{ chapter_index, corr_id, sentence_count, titles: {lang: string|null} }] }
```
Empty `chapters: []` for a chapterless/legacy book → reader falls back to
Sentences mode only.

### 2.3 Document detail — `GET /media/documents/{id}`  (**owner-scoped, NEW**)
Added in `MediaBrowseController::documentDetail` + route in `routes/api.php`.
Needs a bearer token; 401 without one, 404 if the doc isn't the caller's.
Documents are chapterless. Sentences come from the **shared** source-sentence
store keyed by `source_key = 'doc_{id}'` (written by
`AppQyV1VocabularyDocumentController::extractSentences`), served through the
same `buildSentencesPaginator()` books use. Before a document has been
sentence-extracted the paginator is empty → reader shows "extract sentences
first". Per-sentence audio depends on the shared content_id-keyed TTS
enrichment (documents don't generate audio at extract time).
```
data: { source: { id, source_key, title, language, word_count, created_at },
        chapter_index: null, sentences: { items: ReaderSentence[], total, ... } }
```

### 2.4 `ReaderSentence` shape
```
grain, seq, ref?, book?, text, language?,
explanation?, grammar?, ai_commentary?, special_usage?,
audio?,                       // BARE "{lang}/{content_id}.mp3" or null (NOT a URL)
occurrence_count?,
// only when a v3 correspondence is resolved:
corr_id?, chapter_index?,
languages?: { [lang]: { text, audio, explanation, has_audio } }
```

## 3. Audio resolution & the "no audio" rule

- `audio` is a **bare storage-relative path**, not a URL. Playable URL =
  `mediaUrl('/static/app_qy_v1/sentence_sounds/' + audio)` (pins API origin
  :9000; matches `AppQyV1SentenceAudioUrl::PREFIX`). Helper: `readerAudioUrl()`
  in `reader/mediaReader.ts`.
- **Authoritative "has audio" gate** = `languages[lang].has_audio` when the v3
  map is present; else presence of the flat `audio` string. Resolved by
  `resolveCell(sentence, lang)` → `{ text, audioBare, hasAudio }`.
- **Missing audio ⇒ prompt**: the sentence's audio icon renders muted
  (`VolumeX`) with a `title="No audio available"`; clicking it toasts
  "No audio available for this sentence". No silent dead button.

## 4. Reader UI (`MediaReaderModal`)

Hosted in the shared `Modal size="full"` (Portal + ESC + backdrop, 90vh).

- **Mode toggle** (books with chapters only): **Chapters** | **Sentences**.
  - Chapters: left chapter rail (per-language titles + verse counts) → selected
    chapter's verses (loaded with `chapter_index`, `per_page=500`).
  - Sentences: the whole source, paginated `per_page=50` (multi-page).
  - Documents: Sentences mode only (chapterless).
- **Language select** (when the source carries >1 language): picks the
  reading/audio language; text + audio icon follow it live.
- **Per-sentence row**: ref/seq · text · audio icon (top-right). Playing row is
  amber-highlighted; its icon shows `Pause`.
- **Pager**: `{total} sentences · Page X of Y` + Prev/Next (shown when >1 page).
- **Read / Stop**: top-right; starts continuous playback from the first
  playable sentence / stops.

## 5. Continuous playback ("play until pause")

Clicking any sentence's play icon (or **Read**) starts continuous playback and
keeps reading until the user pauses/stops:

1. Play the sentence's audio in the current reading language.
2. On `ended`, advance to the next sentence in the loaded list that has audio in
   that language (skipping missing-audio verses).
3. At the **end of the page**: if more pages exist, load the next page (the view
   pages forward) and continue from its first playable sentence.
4. In Chapters mode, at the **end of a chapter**: auto-advance to the next
   chapter and continue.
5. Stop when there is nothing left, or when the user clicks Stop / the playing
   sentence's Pause / switches mode/chapter/page / closes the reader.

Implementation notes (`MediaReaderModal`):
- One reused `HTMLAudioElement` (`audioRef`); `playAt(list, index)` sets
  `audio.onended = () => advanceRef.current(list, index)`.
- All moving state (`readLang`, `mode`, `page`, `lastPage`, `activeChapter`,
  `chapters`) is mirrored into refs so the stable playback callbacks and the
  `onended` handler always see the latest values across page/chapter loads.
- `playingRef` gates continuation so a pause during an async page load aborts
  the auto-advance (`if (items && playingRef.current) …`).

## 6. Files

FE (`poly_apps/pycore_laravel_wordflow_ui`):
- `core/api/modules/MediaQueryAPI.ts` — `getBookDetail`, `getBookChapters`,
  `getDocumentDetail` + `ReaderSentence` / `ReaderChapter` / `ReaderDetail` types.
- `components/vocabulary/reader/mediaReader.ts` — `readerAudioUrl`,
  `resolveCell`, `sentenceKey`, `sentenceLangs`, `chapterTitle`.
- `components/vocabulary/reader/MediaReaderModal.tsx` — the reader.
- `components/vocabulary/ExistingBooksPanel.tsx` / `ExistingDocumentsPanel.tsx`
  — open the reader on click.

Backend (`poly_apps/laravel_main`):
- `app/Http/Controllers/MediaBrowseController.php` — `documentDetail()`.
- `routes/api.php` — `GET app_qy_v1/media/documents/{id}`.

## 7. Known limits / follow-ups

- Document sentences require a prior `POST vocabulary/document/{id}/extract-sentences`
  run; audio requires the shared TTS enrichment. Until then a document reads empty.
- The KJV/CUV seed corpus has no per-sentence TTS yet, so its verses show the
  muted audio icon (expected). Audio lights up once the sentence-audio pipeline
  fills `LangSentence.audio` by `content_id`.
- Chapter mode loads a whole chapter (`per_page=500`); a chapter exceeding that
  gets Prev/Next paging too (continuous playback pages within it).
