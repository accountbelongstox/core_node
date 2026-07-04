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
  amber-highlighted; its icon is `Pause` while playing, `Play` while paused
  (click to resume), `Volume2` otherwise, `VolumeX` when the verse has no audio.
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
   pages forward) and continue from its first playable sentence. A **fully
   audio-less page/chapter is skipped forward**, not stopped on.
4. In Chapters mode, at the **end of a chapter**: auto-advance to the next
   chapter and continue.
5. Stop when there is nothing playable left anywhere, or when the user clicks
   Stop / switches mode/chapter/page / changes language / closes the reader.
6. **Pause/resume**: clicking the playing sentence's icon pauses (keeps position
   + highlight); clicking again resumes from the same spot.

Implementation notes (`MediaReaderModal`) — the single playback engine is
`playForward(list, fromIndex)`: it plays the first audio sentence after
`fromIndex`, and when the list is exhausted pages/chapters forward (skipping
audio-less pages) until audio runs out or the user stops (`fromIndex = -1` reads
from the start).
- One reused `HTMLAudioElement` (`audioRef`); `playAt(list, index)` sets
  `audio.onended = audio.onerror = () => playForwardRef.current(list, index)`
  (and `play().catch` skips forward too, so a missing/404 file is skipped
  silently — no error toast).
- All moving state (`readLang`, `mode`, `page`, `lastPage`, `activeChapter`,
  `chapters`) is mirrored into refs so the stable callbacks + `onended` always
  see the latest values across page/chapter loads.
- `playingRef` gates every continuation; `pausedRef` distinguishes pause from
  stop (both `playForward` and each continuation `.then` bail on `pausedRef`).
- The paging position (`PlayPos = {page, lastPage, chapterIndex}`) is threaded
  **explicitly** through `playForward(list, fromIndex, pos)` / `playAt(list,
  index, pos)` / the continuation `.then(r => … r.pos)`, so crossing a page or
  chapter never reads a `pageRef`/`activeChapterRef` React has not committed yet
  (which previously re-fetched audio-less pages twice).
- **`loadSeqRef`** is a monotonic token: `load()` captures `myTurn` at start and
  no-ops on resolve if superseded; Stop / navigation / a manual sentence pick /
  close all bump it, so a Stop or manual pick during an async page/chapter turn
  can never flip the view or override the user (`requirePlaying` also discards a
  continuation whose user already stopped or paused mid-load).
- **`loadCountRef`** drives `loading` (= in-flight count > 0), decremented in
  `finally` regardless of supersession, so a cancelled load never leaves the
  pager stuck disabled.
- **`playTokenRef`** is bumped per `playAt`; `onended`/`onerror`/`play().catch`
  share one `skipForward()` that advances only if the token still matches and we
  are playing and not paused — so a 404's `onerror`+`play()`-reject don't
  double-advance, and a pause/replace `AbortError` isn't mistaken for a dead file.
- **`emptyCrossRef`** bounds the audio hunt: it counts consecutive audio-less
  page/chapter crossings and stops after `MAX_EMPTY_CROSS` so a no-TTS source
  doesn't crawl the whole book. It resets **only when audio actually starts** (the
  `playing` event) — never merely because a URL exists — so a source whose
  `has_audio` cells all 404 is still bounded (it would otherwise reset every
  attempt). A fresh user intent (Read / manual pick / resume-in-gap) also resets it.
- Default reading language = `bestLang(items, langs)`, ranked by cells that have
  **both** text and audio, then most text (a reader needs text — never default to
  an audio-only track that renders blank), then most audio. The language list is
  derived per-render from the CURRENT page (`collectLangs(sentences)`), so the
  `<select>` only offers content-bearing languages present on the visible page.
- **Reading-language validity**: `load()` re-picks `readLang` on user navigation
  when the current language is empty on the loaded page; continuation loads keep
  it fixed (no mid-playback switch). A `!playing`-gated effect is the safety net —
  after playback stops on a page lacking `readLang`, it restores a content-bearing
  language so the body never stays blank.
- A **continuation load failure** keeps the current page visible (never blanks
  the reader); if the user had paused it preserves the pause (resume re-attempts
  the crossing), otherwise it stops playback with a toast. Only a user-initiated
  load shows the empty/error state.
- The **loading state spans the whole open sequence** (including the chapters
  fetch that precedes the first `load()`), so a slow backend shows a spinner
  rather than a transient "no readable content" empty.
- **Mode toggle keeps the chapter position**: switching to Sentences no longer
  clears `activeChapter`, so returning to Chapters restores the last-read chapter
  instead of resetting to the first.
- The currently-playing row is auto-scrolled into view (`data-skey` +
  `scrollIntoView`) so continuous reading stays on screen.
- On close/unmount `releaseAudio()` aborts any in-flight media download and drops
  the element's handlers.

## 6. Files

FE (`poly_apps/pycore_laravel_wordflow_ui`):
- `core/api/modules/MediaQueryAPI.ts` — `getBookDetail`, `getBookChapters`,
  `getDocumentDetail` + `ReaderSentence` / `ReaderChapter` / `ReaderDetail` types.
- `components/vocabulary/reader/mediaReader.ts` — `readerAudioUrl`,
  `resolveCell`, `sentenceKey`, `collectLangs`, `bestLang`, `chapterTitle`.
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
