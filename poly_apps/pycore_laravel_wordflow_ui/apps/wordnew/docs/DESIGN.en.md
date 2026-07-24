# Shelf Study Experience — Feature and Requirements Design

> **AI maintenance rule:** Read this English document first; it is the canonical
> specification. Every change to this file MUST update `DESIGN.zh.md` in the same
> change, preserving matching section numbers and requirements. Never update only
> one language file. `DESIGN.zh.md` is a backup translation only, not an
> independent or authoritative specification. If a requested edit starts from the
> Chinese file, update this English source first and then synchronize the Chinese
> backup in the same change.

> Scope: the `#/shelf` route (`components/WfNewShelfTab.tsx`) — specifically the
> **Default Vocabulary Group** deep-dive panel (when a course/group is opened).
> This document distills the FEATURE SET of the legacy dictionary-study web
> client at `D:/programing/dict-server-client/html-client` and reframes it as
> REQUIREMENTS for the wordnew shelf, plus a mapping from each old feature to its
> wordnew implementation (component + reused endpoint/service).

---

## 1. Source study — the legacy Bing-dictionary client

The old client (`<title>词典管理 - 来自Bing</title>`) is a jQuery + Bootstrap
"admin template" single page (`index.html`) driven by an ES-module app under
`static/translate_js/*`. It reads a Strapi/GraphQL backend of Bing-scraped
dictionary entries and plays them back as an **audio-first recitation trainer**.

### 1.1 Screen layout

- **Top progress rail** — three stacked striped bars:
  `.allreadedcount` (whole-group read %), `.dailyreadedcount` (daily-goal %),
  `.pagereadcount` (current-page played %).
- **Content header** — current group name (`.current_group_tab`), total
  `词` count and `未读` (unread) count.
- **Word river** — `#wordbox_contents_html`, a vertical list of "word boxes".
- **Right control-sidebar** (`aside.control-sidebar`) — two tabs:
  a searchable **group list**, and a **settings form** (auto-generated from the
  settings object).
- **Notifications** — a "Reviews" dropdown listing per-day review-due counts.
- **Two floating sticky toolbars**:
  - main (right): previous word ↑, next word ↓, **play/pause** toggle,
    set-review ↻.
  - bar (left): brief mode, project (projection) mode, refresh, previous page
    group ↑, next page group ↓, lock touch-move.

### 1.2 Word record (data model)

`fetchDictionaries` (GraphQL) returns per word:
`id, word, is_delete, word_sort, phonetic_us / phonetic_uk (+ *_sort / *_length),
word_length, translation`. `translation` is a JSON blob holding
`word_translation` (array of `[type, text…]`, e.g. `["n.", …]`, `["Web", …]`),
`phonetic_symbol`, `voice_files` (audio: `iterate_name` / `save_filename`),
`sample_images`, `plural_form`, `synonyms` / `synonyms_type`,
`advanced_translate` / `advanced_translate_type`.

- **Group** (`dictiongroup`): `id, name, namespace, wlink (word-id array),
  wcount, publishedAt`.
- **Progress** (`dictiongroupmap`, per user `uid`+`gid`): `group_map` = array of
  `[word_id, last_read_timestamp, read_count]`, **sorted ascending by
  last-read-time** so the least-recently-seen word is always studied first
  (a Leitner-ish spaced order). Read events are batched and flushed to the
  server, and reviewed words are removed from the DOM.

### 1.3 Word box rendering (`translateHtmlCase`)

Title (word) · phonetic-symbol row with per-voice **play buttons + hidden
`<audio>`** · translation lines (type badge + text) · **pinyin toggle** (pinyin-pro,
for Chinese glosses) · plural forms · sample images (capped by
`show_maximages`) · synonyms tabs · advanced-translation tabs (parses
part-of-speech / numbered senses / `[notes]`) · **"have-read" footer**
(mark-read ✓ + Like + last-read-time). Test builds (`dict_test`) swap the gloss
for **multiple-choice radios**: the correct answer plus 3 random distractors,
shuffled.

### 1.4 Study / recitation modes

- **Auto-play recitation loop** (`playControlNewCase`) — THE core feature.
  Play/pause toggle drives a queue: for each word, play its audio `maxplays`
  times (the last play marks it read), auto-scroll it into view, wait
  `interval_seconds` between plays; the PREVIOUS word gets a `glimpse` replay
  ("闪读", star-marked); a second **review** pass replays each word `maxreview`
  times. A preload → prerender → rendered buffer (`worddataProvider`, threshold
  `per_words / 2`) keeps the river full; read counts flush to the server in
  half-page batches.
- **Manual navigation** — previous / next word.
- **Mark read** (`submit_haveread`) and **set review** (re-queue).
- **Brief mode** — collapse advanced tabs to word + phonetic + gloss.
- **Project mode** — oversized "projection" typography (auto at 740–750 px).

### 1.5 Progress / stats

Daily-read set (`daily_readed.{date}`, % of `per_dayreads`), page-played %,
whole-group read vs unread counts (from `group_map` entries with a read time),
and per-day **review-due buckets** in the notifications list.

### 1.6 Settings (`baseSettingCase.global_config.settings`, localStorage)

`per_words 100` · `per_dayreads 2000` · `maxplays 1` · `maxreview 1` ·
`glimpse 0` · `interval_seconds 2.5` · `pre_delay 0.5` · `reviewday 60` ·
`wordliky / phoneticliky 30` · `show_maxphonetic 1` · `show_maximages 2` ·
`pre_load / pre_render 50`. Edited live in the sidebar form; persisted to
localStorage; JWT auth (Strapi login/register); gzip+base64 payloads (pako).

---

## 2. Requirements — wordnew shelf "Default Vocabulary Group" study

The shelf deep-dive (opening a group in `#/shelf`) MUST become a real study
surface for that group's words — including the user's **Default Vocabulary
Group** — not the static placeholder it was. Requirements, framed from §1:

- **R1 Study modes.** A mode switch inside the deep-dive: **List** (browse),
  **Cards** (flashcard reveal/flip), **Recite** (audio auto-play loop), and
  **Review** (only the words due for review). Distills §1.4.
- **R2 Per-word interactions.** Reveal / hide the gloss (blur until tapped),
  **pronounce** (real audio file when present, else Web-Speech TTS), mark
  **known / mastered** vs **forgot / needs-review**, toggle **favorite**, and
  open the existing **word-detail** modal. Distills §1.3 + §1.4.
- **R3 Recitation loop.** Play/pause auto-advance through the group; each word
  plays N times with a configurable inter-play interval and playback speed, then
  advances and optionally replays after a gap ("glimpse"); auto-scrolls the
  active word into view. Reuses the persisted play/replay settings. Distills
  §1.4.
- **R4 Progress & stats.** A stats header with progress bars (**mastered %**,
  **daily-goal %**, **session %**) and count chips (mastered / learning / due),
  matching the old three-bar rail (§1.1, §1.5). Least-recently-studied-first
  ordering for Recite/Review (§1.2 `group_map` semantics).
- **R5 Settings.** A compact settings sheet editing play count, replay count,
  interval, speed, review order + a **brief/compact** toggle — reusing the
  app's persisted learning-model + review settings. Distills §1.6 + brief mode.
- **R6 Real data + guest state.** For a logged-in user, words come from the live
  group endpoint and progress is read/written best-effort; logged-out or empty
  groups show a sensible empty/guest state (local session progress still works).

Non-goals (intentionally dropped as legacy-specific): pinyin toggle, sample
images / synonyms / advanced-tab rendering (covered by the word-detail modal),
gzip/pako transport, the preload/prerender DOM-recycling buffer (React list +
the app's CapDatabase word cache already handle this), and the multiple-choice
`dict_test` build (the shelf hands off to the existing Practice **Quiz** arena).

---

## 3. Mapping — old feature → wordnew implementation

| Old client feature | wordnew implementation (new component) | Reused wordnew stack (endpoint / service) |
| --- | --- | --- |
| Group word river `#wordbox_contents_html` | `WfNewGroupStudyPanel` + `WfNewStudyWordList` inside `WfNewShelfTab` deep-dive | `courseWords` prop, loaded by `useWfNewContentHandlers.selectBookCourse` → `wfNewApi.getVocabulary(gid)` (`GET /query_gwords`, maps `/group/get_words`) |
| Auto-play recitation loop (`playControlNewCase`) | `useWfNewReciteController` (play/pause, per-word N-plays, interval, replay-gap, auto-scroll) | `WfAudioCenter.playWord` / Web-Speech + `playPhoneticSpeech` prop; settings from `wfNewSettings` (`wmPlayCount`/`wmReplayCount`/`wmPlayInterval`/`wmReplaySpeed`/`wmReplayGapWords`) |
| Mark-read `submit_haveread` / set-review | `WfNewStudyWordList` + `WfNewFlashcard` mark buttons → `wfNewStudyProgress.mark()` | best-effort `wfProgressCenter.reportAnswers(gid, [{word_id, correct}])` (`POST /group/update_progress`) + `wfRecitationCenter.recordAction` (`POST /recitation/log`); local persist otherwise |
| Three-bar progress rail + read/unread counts | `WfNewStudyStatsBar` | `wfProgressCenter.getBlob(gid)` + `computeStats` / `dueWords` (`POST /group/get_progress_blob`); falls back to `Word.masteryLevel` + local store |
| Review-due buckets (notifications) | **Review** mode tab in `WfNewGroupStudyPanel` | `wfProgressCenter.dueWords(blob)`; local `needsReview` set fallback |
| Least-recently-read ordering (`group_map` sort) | Recite/Review ordering in the controller | `wfProgressCenter` entry `last_read_at` / local `lastStudiedAt`; unstudied first |
| Settings sidebar form | `WfNewStudySettingsSheet` | `wfNewSettings` (persisted `PersistedStore`) — `wmPlayCount`, `wmReplayCount`, `wmPlayInterval`, `wmPlaybackSpeed`, `wmReplayGapWords`, `reviewOrder` |
| Brief mode | `briefMode` toggle in the panel (collapses to word + phonetic + gloss) | local panel state |
| Project mode (projection) | folded into **Cards** mode (oversized flip card) | `WfNewFlashcard` |
| Pronounce buttons + `<audio>` | per-word speaker button | `Word.audioUrl` (direct `Audio`) → `playPhoneticSpeech` / `WfAudioCenter` fallback |
| Word box detail (images/synonyms/tabs) | existing word-detail modal | `setSelectedWordDetail(word)` prop → `WfNewWordDetailModal` (on-demand media via `getWordMedia`) |
| Favorite / "Like" | favorite star | `handleToggleFavorite` prop → `wfNewSettings.toggleFavorite` |
| daily_readed daily goal | daily-goal bar in the stats header | `wfNewSettings.dailyGoal` + `wfRecitationCenter.getToday()` (best-effort) |
| `dict_test` multiple-choice | handoff button to Practice Quiz | `startModePractice('quiz')` / `setActiveTab('practice')` props |

### Files

New, all under `apps/wordnew/components/study/` (each < 800 lines, modular):
`WfNewGroupStudyPanel.tsx` (orchestrator), `WfNewStudyStatsBar.tsx`,
`WfNewStudyWordList.tsx`, `WfNewFlashcard.tsx`, `WfNewStudySettingsSheet.tsx`,
`useWfNewReciteController.ts`, `WfNewStudyProgress.ts` (local store + best-effort
backend mirror), `WfNewStudyLocales.ts` (self-contained i18n block).

Changed: `components/WfNewShelfTab.tsx` — the `selectedCourse` deep-dive renders
`<WfNewGroupStudyPanel/>` in place of the static placeholder column + plain list,
keeping the existing Learn / Quiz handoff buttons.

---

## 4. Practice — Sequential Reading (顺序阅读) mode — Functional Requirements

> Scope: the `#/practice` route, **Sequential Reading (顺序阅读)** mode.
> This section is a FUNCTIONAL DESIGN-REQUIREMENTS specification: it describes
> BEHAVIOR ONLY — what the learner sees, what they can do, and the rules the mode
> must obey. It is deliberately implementation-free (no components, endpoints, or
> settings storage are named here). The reference model for tone and completeness
> is the legacy dictionary client's auto-play recitation loop, glimpse review,
> brief/projection display, page window, and per-word audio fallback (see §1.4);
> the requirements below re-express that behavior as native wordnew behavior for a
> selected word pack.

### 4.1 Purpose and character of the mode

Sequential Reading is a **passive, hands-free reading experience** for a selected
word pack (a vocabulary group). Its job is to walk the learner through the pack's
words one at a time, reading each word aloud and showing its meaning, so the
learner can absorb the pack by watching and listening rather than by testing
themselves. It is explicitly **not** a quiz or a flip-card drill: nothing is
hidden and no answer is ever demanded of the learner.

Requirements:

- **R-SR1 — It is a reading mode, not a test.** The learner is never asked to
  recall, guess, reveal, or grade a word. Meaning is always on screen.
- **R-SR2 — It is auto-driving.** Once started, playback moves through the words
  by itself; the learner may sit back and only intervene (skip, pause, jump) when
  they choose to.
- **R-SR3 — It operates on one pack at a time.** The words shown and read are the
  words of the currently opened pack; changing packs is outside this mode's flow.

### 4.2 The word list — ordering and always-visible meaning

The pack's words are presented as a **single vertical scrolling list**, one word
per row, in reading order. The learner can scroll the list freely at any time,
independent of where playback currently is.

Requirements:

- **R-SR4 — Least-recently-read first.** The list is ordered so that the word the
  learner has gone the longest without reading appears first, and the most
  recently read words appear last. Words never read before count as the
  least-recently-read and therefore lead the list. This ordering is what makes the
  reading "sequential" in a spaced sense, not merely alphabetical or insertion
  order. When a word is read during playback, its "last read" standing updates, so
  its position in a future ordering reflects that it was just seen.
- **R-SR5 — Meaning is always shown inline.** Every row **always** displays the
  word together with its translation / explanation at full visibility. There is
  **no** blur, no cover, no "tap to reveal", and no flip. Phonetic text may
  accompany the word. The learner can read any word's meaning at a glance whether
  or not playback has reached it yet.
- **R-SR6 — The active word is visually distinguished.** The word the reader is
  currently voicing is highlighted so the learner can see where the "read head"
  is, and the list keeps that active word comfortably in view as playback advances
  (auto-scroll), without fighting the learner if they have manually scrolled
  elsewhere.

### 4.3 Playback and the play cursor

Playback has a single **play cursor** — the position of the word currently being
read (or the word that will be read next when playback resumes). Reading proceeds
from the cursor forward through the list.

Requirements:

- **R-SR7 — Tapping a word moves the cursor there and reads from there.** Clicking
  or tapping any word in the list sets the play cursor to that word and begins (or
  continues) reading **starting from that word**, flowing forward through the rest
  of the list. Tapping a word is a "start reading here" gesture.
- **R-SR8 — Tapping a word does NOT open a detail popup.** In this mode a tap is
  reserved for positioning the cursor. It must not open a word-detail card,
  dictionary panel, or any other overlay. (Rich per-word detail belongs to other
  practice surfaces, not to the sequential reader.)
- **R-SR9 — Each word is read a configurable number of times.** When the cursor
  lands on a word, that word is read aloud its configured **play count** before
  the cursor advances.
- **R-SR10 — Pacing between words.** After a word finishes its reads (and any
  review described in §4.5), playback waits the configured **interval** before
  moving to the next word, giving the learner time to absorb it. Reading rate
  within a word is governed by the configured **playback speed**.

### 4.4 The floating control panel

Sequential Reading can run with a minimal, uncluttered screen. **When playback
starts, a floating control panel appears** over the reading list, giving the
learner direct manual control without leaving the reading view. It stays reachable
while reading and does not obscure the active word.

The panel MUST offer:

- **Play / Pause** — start or halt the auto-reading. Pausing freezes the cursor in
  place; resuming continues from the same word.
- **Next word** — advance the cursor by one word and continue reading from it.
- **Previous word** — step the cursor back by one word and continue reading from
  it.
- **Next page** — load the next page window (see §4.6) and begin reading from the
  first word of that new page.
- **Previous page** — load the previous page window and begin reading from it.
- **Large-font (大字) mode toggle** — switch the display style described in §4.4.1.

Requirements:

- **R-SR11 — The panel is playback-scoped.** It becomes available when reading is
  underway, so the learner always has stop / skip / jump controls at hand once the
  experience is running.
- **R-SR12 — Manual controls cooperate with auto-play.** Using Next word, Previous
  word, Next page, or Previous page repositions the cursor and lets reading
  continue from the new position; it does not end the session.

#### 4.4.1 Large-font (大字) display mode

Large-font mode is a **display-only toggle** that enlarges the **current word and
its translation** to oversized, easy-to-read-from-a-distance typography — suitable
for reading across a room or projecting to a class or screen. It changes only how
the active word is presented; it does not change the reading order, the cursor, or
any timing. It can be turned on or off at any time and the reading continues
uninterrupted.

- **R-SR13 — Large-font is presentation, not behavior.** Toggling it never alters
  which word is read, how many times, or the ordering — purely the size/emphasis
  of the current word and its meaning.

### 4.5 回跳 / temporary review (glimpse)

To reinforce what was just heard, the reader can perform a brief **backward
review** — 回跳 — right after reading a word: it momentarily re-reads a recent
earlier word as a quick refresher, then returns to reading forward. This mirrors
the legacy "闪读 / glimpse" behavior (§1.4).

Requirements:

- **R-SR14 — Trigger and target.** After a word has been read, the reader jumps
  back and replays an **earlier** word as a quick review before continuing
  forward. Which earlier word is chosen is governed by the **jump-back gap** (how
  many words back to reach — by default the immediately-previous word).
- **R-SR15 — Repetition.** The reviewed word is replayed the configured
  **jump-back count** of times. A count of zero means the review is disabled and
  reading simply proceeds forward with no backward glimpse.
- **R-SR16 — Then resume forward.** After the backward review completes, playback
  returns to its forward position and continues from where it left off — the
  review never loses the learner's place or rewinds the main cursor.
- **R-SR17 — Brief visual flag.** The word being reviewed is briefly flagged
  (e.g. a transient marker/emphasis on that row) so the learner can tell "this is
  a quick look back", and the flag clears once forward reading resumes.
- **R-SR18 — Interaction with the interval.** The backward review is inserted
  around the normal between-word **interval**: the glimpse is a short extra
  playback that happens within the pause rhythm rather than replacing it, so the
  overall cadence stays calm and predictable. A larger interval leaves more room
  around the glimpse; a jump-back count of zero collapses back to a plain forward
  cadence.

### 4.6 Paging — the page window

The pack is read through a **page window**: a fixed-size slice of the ordered word
list. Only one page's worth of words is the active reading window at a time, which
keeps long packs manageable and gives the learner clear "chunks".

Requirements:

- **R-SR19 — A page is a fixed-size window.** A page holds up to the configured
  **words-per-page** count, taken in the least-recently-read ordering of §4.2. The
  first page is the first slice of that ordering, the next page the following
  slice, and so on.
- **R-SR20 — Continuous flow across pages.** Reading does not stop at the end of a
  page. When the last word of the current page has been read, playback
  **automatically advances to the next page** and continues from that page's first
  word, so an unattended session reads the whole pack chunk by chunk.
- **R-SR21 — Manual paging is bounded.** Next page and Previous page move the
  window forward or back by one page and start reading from the new page's first
  word. Paging is clamped at the ends: there is no page before the first and none
  after the last, and the controls reflect (and prevent) trying to go past either
  boundary.

### 4.7 Voice selection and fallback

The learner can **choose the reading voice** used for playback. Because a chosen
voice may not be able to speak a given word — or a particular word may only exist
as a pre-recorded clip — the reader must degrade gracefully so that **a word is
never silently skipped without an attempt to voice it.**

Requirements:

- **R-SR22 — Selectable voice.** The learner can pick which voice reads the words,
  and that choice is remembered for the session.
- **R-SR23 — Graceful fallback order.** When the chosen voice (or a specific
  word's audio) is unavailable, the reader falls back in this preference order,
  stopping at the first that works:
  1. a **real, pre-generated audio clip** for that specific word, if one exists;
  2. otherwise a voice that **matches the target accent / language** of the pack;
  3. otherwise a **default voice**.
- **R-SR24 — Never a silent skip.** The reader must attempt every word through the
  fallback chain before moving on. It should not advance past a word having made
  no sound at all whenever any voice in the chain could have spoken it. (If, after
  exhausting the chain, nothing can be produced, the visual reading — highlight
  and meaning — still occurs and playback continues to the next word.)

### 4.8 Playback settings

The learner can tune how the reader behaves through a small set of playback
settings. All are adjustable and take effect on subsequent reads; sensible
defaults let the mode work well with no configuration.

| Setting | What it controls | Default |
| --- | --- | --- |
| Words per page (每页词数) | Size of the page window — how many words make up one reading chunk before it auto-advances to the next page. | 100 |
| Play count per word (每词播放次数) | How many times each word is read aloud before the cursor advances. | 1 |
| Jump-back count / 回跳次数 | How many times the earlier word is replayed during the 回跳 backward review; `0` disables the review. | 1 |
| Jump-back gap (回跳间隔词数) | How many words back the 回跳 review reaches (1 = the immediately-previous word). | 1 |
| Playback interval / 间隔 (seconds) | The pause between finishing one word and starting the next, setting the overall reading cadence. | 2.5 |
| Playback speed (播放速度) | The reading rate of the voice (playback rate multiplier). | 1.0× |
| Reading voice (朗读语音) | Which voice reads the words, with automatic fallback per §4.7. | System / accent-matched default |

Requirements:

- **R-SR25 — Live and remembered.** Changes to these settings apply to ongoing and
  future reading and are remembered for the learner between sessions.
- **R-SR26 — Safe extremes.** A jump-back count of `0` cleanly disables review; a
  words-per-page of one page's worth still pages normally; and interval / speed /
  play-count values always keep the reader in a stable, predictable cadence.

---

## 5. Default Vocabulary Group - Shuffle-Once & Daily-Goal Sequential Reading

> Scope: the **Default Vocabulary Group** on the `#/shelf` route. Adds two
> capabilities on top of §2–§4: (A) a **one-time random shuffle** of the default
> group's word order, persisted + ensured idempotently; (B) a **daily-goal-driven
> sequential reading** flow that reads the group's **unread** words in that
> shuffled order and submits per-word **play time** to the backend after each read.
> The default group's `group_word_progress.words` JSON map becomes the canonical
> **word mapping table** (per-word read/review time + counts) - the evolved form of
> the legacy `group_map` (§1.2).
>
> This section **MODIFIES** §3's `dict_test` handoff row (Start Quiz Arena no
> longer jumps straight to multiple-choice quiz - its default playback is now
> **list / sequential**) and **SUPPLEMENTS** §4 R-SR4 for the default group on the
> shelf (the default group uses **shuffle-once + unread-first**, not
> least-recently-read-first).

### 5.1 Ground truth (current state, from code audit)

- The legacy `app_qy_v1_group_words` + `app_qy_v1_user_word_progress` row-per-word
  tables are **DROPPED** (`AppQyV1_2026_06_12_160002`). They were consolidated into
  one `app_qy_v1_group_word_progress` table - **one JSON row per group**. The
  `LEARNING_GROUP_SYSTEM_IMPLEMENTATION.md` doc is stale on this point.
- `words` JSON map shape: `{ "<word_id>": {fr,lr,lv,nr,rc,vc,wt,pf,aa} }` (short
  keys, see `AppQyV1GroupWordProgressModel::ENTRY_LEGEND`). **No position / order /
  sort field exists.** Word ordering is derived in `orderedWordIds()` = sort by `aa`
  (added_at) asc, then `word_id` asc (`AppQyV1GroupWordProgressModel.php:362`).
- **No play-time / duration tracking exists.** `update_progress` only supports
  `read` (bumps `rc`, `lr`) and `review` (bumps `vc`, `lv`, `pf`). `total_study_time`
  in `/user/statistics` is hardcoded `0` with a "known design gap" comment.
- **No unread filter** server-side; unread is derivable (`rc==0` / `fr===null`) but
  not exposed by `get_words`.
- **Default group** is created lazily at login/register via
  `AppQyV1WordGroupPublicController::ensureDefaultGroupIfNotExist()` (name constant
  `"Default Vocabulary Group"`), NOT seeded by sys:init.
- **sys:init** = artisan `sys:init` (`app/Console/Commands/InitializeApps.php`); it
  runs `migrate --force` (idempotent) via `runSafeMigrations()`. New columns are
  added by a migration using `SafeMigrationHelper::alignTableStructureFromArray()`
  (pattern: `..._000005_add_language_fields_to_word_groups.php`) and auto-apply here.
- **Start Quiz Arena** button: `components/study/WfNewGroupStudyPanel.tsx:283`,
  wired in `components/WfNewShelfTab.tsx:140` -> currently calls
  `startModePractice('quiz')` (switches to the practice tab's multiple-choice quiz).
- Shelf study panel `StudyMode = 'list' | 'cards' | 'recite' | 'review'`
  (`WfNewGroupStudyPanel.tsx:50`). `list` = `WfNewStudyWordList` (browse); `recite`
  = `useWfNewReciteController` sequential auto-play loop (`setIndex(i+1)`, wraps).

### 5.2 R1 - Start Quiz Arena defaults to list (sequential playback)

**Requirement.** Clicking **Start Quiz Arena** must default to the **list** model -
i.e. **sequential playback** (顺序播放) - NOT immediately enter the multiple-choice
quiz. (The multiple-choice quiz remains reachable as a mode switch inside the
arena; it just is no longer the default landing.)

**Why.** The arena is the study surface for the opened group; sequential reading
(§4) is the primary, hands-free way to absorb the pack, so it is the right default.
Multiple-choice is an active-recall option, not the entry point.

**Implementation (FE).**
- `components/WfNewShelfTab.tsx:140-144` `onStartQuiz`: replace
  `startModePractice('quiz')` with logic that sets the study panel mode to `list`
  and engages sequential playback (the recite controller). Keep
  `setSelectedPracticeGroup(selectedCourse)` so the arena knows which group.
- Concretely: enter the shelf study panel's `list` mode, then start the recite
  controller (`recite.play()`) so words are read aloud sequentially in list order -
  this IS the "list / 顺序播放" default. The user may then switch to `cards` /
  `recite` / `review` / the quiz handoff manually.

### 5.3 R2 - Default Vocabulary Group shuffle ONCE (idempotent) + sys:init field

**Requirement.** The words in the **Default Vocabulary Group** must be randomly
shuffled **at least once**, but **only once**. If the group already has words that
have not yet been shuffled, the shuffle is **ensured on API request** (lazy, the
first time the group is read). Once shuffled, the order is stable and is NEVER
re-shuffled. The DB field backing this is **added through sys:init** (a migration
that `migrate --force` applies idempotently).

**Why.** A fixed insertion order (aa-asc) biases study toward the source library's
original sequence; one initial randomization gives an unbiased study order. But
re-shuffling on every read would destroy the stable position the learner is working
through (and break req 3's "new words interleave without disturbing existing").

**Data model.**
- New per-word entry key **`po`** (position, float in `[0,1)`) - the shuffle order.
  `null` means "not yet positioned" (legacy / non-default groups).
- New group-level column **`shuffled_at`** (timestamp, nullable) on
  `group_word_progress` - the one-time-shuffle idempotency flag. `null` = not yet
  shuffled; non-null = shuffled, do not reshuffle.
- `orderedWordIds()` becomes: sort by `po` asc (entries with `po === null` sort
  after positioned ones, tie-broken by `aa` asc, then `word_id` asc). For
  non-default groups (all `po` null) this reduces to the current `aa`-asc behavior,
  so no regression.

**Backend.**
- `AppQyV1GroupWordProgressModel`:
  - `ENTRY_LEGEND` += `'po' => 'position'`; `EMPTY_ENTRY` += `'po' => null`.
  - `orderedWordIds()`: sort by `[po_is_null asc, po asc, aa asc, word_id asc]`.
  - New `ensureShuffledOnce(): bool` - if `shuffled_at` is null AND the map has
    words, assign each entry `po = mt_rand()/mt_getrandmax()` (random float),
    set `shuffled_at = now()`, save once, return true. No-op (return false) if
    already shuffled or empty. Idempotent + concurrency-safe via `lockForGroup()`.
  - `$fillable` += `'shuffled_at'`; `$casts` += `'shuffled_at' => 'datetime'`.
  - `expandEntry()` picks up `po` automatically (iterates `ENTRY_LEGEND`).
- `AppQyV1WordGroupQueryController::getAllGroup` (`query_all_groups`): after
  `ensureDefaultGroupIfNotExist`, for the default group row call
  `ensureShuffledOnce()` - this is the "ensure once on API request" hook. Because
  `shuffled_at` gates it, repeated requests do not re-shuffle.
- `AppQyV1WordGroupWordController::getGroupWords` (`group/get_words`): for the
  default group, call `ensureShuffledOnce()` before reading, so the shelf always
  sees a shuffled order even on the very first `get_words` (before any
  `query_all_groups`).

**sys:init / migration.**
- New migration `AppQyV1_2026_07_18_000000_add_shuffled_at_to_group_word_progress.php`
  using `SafeMigrationHelper::alignTableStructureFromArray()` (adds `shuffled_at`
  nullable timestamp; idempotent). Picked up by `sys:init` -> `migrate --force`.
- `AppQyV1TableMaps::app_qy_v1_GROUP_WORD_PROGRESS['fields']` += `'shuffled_at'`.

### 5.4 R3 - Add to Default Vocabulary Group: randomize ONLY the new words

**Requirement.** When words are added to the **Default Vocabulary Group** (via
`group/add_library` or `group/add_word`), the **newly added** words are
auto-randomly inserted (each gets a random position). **Existing** words keep their
positions - the group is **not** re-shuffled on each add. "只随机将要加入的单词的
排序" / "不要加入一次随机一次".

**Why.** Re-shuffling on every add would scramble the order the learner is mid-way
through. Assigning only the new words a random `po` interleaves them naturally among
the existing positioned words without disturbing the stable sequence.

**Backend.**
- `AppQyV1GroupWordProgressModel::putWords($wordIds, $addedAt, $weights, bool $assignRandomPosition = false)`:
  when `$assignRandomPosition` is true, each newly added entry gets
  `po = mt_rand()/mt_getrandmax()`. Existing entries are never touched (already the
  case - `putWords` is merge-missing). When false, `po` stays `null` (current
  behavior for non-default groups).
- `AppQyV1WordGroupLibraryController::addLibraryToGroup` and
  `AppQyV1WordGroupWordController::addWordToGroup`: pass
  `$assignRandomPosition = ($group->gname === AppQyV1WordGroupPublicController::$default_group_name)`.
  Do NOT call `ensureShuffledOnce()` here (that is read-side only) - adds only
  position the new words; the one-time full shuffle remains gated by `shuffled_at`
  from R2.

**Note.** If a default group receives its first words via `add_library` BEFORE the
first `query_all_groups`/`get_words`, those new words already carry random `po`
(req 3). The later `ensureShuffledOnce()` (req 2) sees `shuffled_at` null and
assigns random `po` to any still-unpositioned entries, then sets `shuffled_at`. So
both paths converge to "all default-group words have a random `po`, exactly once".

### 5.5 R4 - Daily-goal sequential reading of unread words + play-time submission + word mapping table

**Requirement.** The `#/shelf` page reads, in the shuffled order, the **unread**
words of the Default Vocabulary Group, up to the user's **daily goal** count. As
each word is read (played), the frontend **auto-submits the play time** to the
backend, updating that word's entry. The Default Vocabulary Group's `words` JSON map
IS the **word mapping table** - an array of per-word records of the form
`{word_id, read_time, read_count, reread_time, review_count, review_time, …}`. The
frontend requests word info from the backend and updates backend data after
playback.

**Word mapping table (per-word entry, extended).** Maps to the user's intended
`[{单词ID, 阅读时间, 阅读次数, 重读时间, 复习次数, 复习时间}]` (last 复习次数 is a
duplicate/typo, ignored):

| User field | Short key | Existing? | Meaning |
| --- | --- | --- | --- |
| 单词ID (word_id) | map key | yes | per-language dictionary id |
| 阅读时间 (read time) | `pt` | **NEW** | total play/read duration (seconds), submitted per read |
| 阅读次数 (read count) | `rc` | yes | number of reads |
| 重读时间 (reread time) | `rpt` | **NEW** | total reread duration (seconds); a read with `rc>=1` before it is a reread |
| 复习次数 (review count) | `vc` | yes | number of reviews |
| 复习时间 (review time) | `lv` | yes | last_review_at (unix seconds) |
| (position) | `po` | NEW (R2) | shuffle order |
| first_read_at | `fr` | yes | auto-stamped when `rc` turns positive |
| last_read_at | `lr` | yes | updated on each read |
| next_review_at | `nr` | yes | auto-recomputed |
| proficiency | `pf` | yes | 0–100 |
| weight | `wt` | yes | word length |
| added_at | `aa` | yes | enrollment timestamp |

So the extended `ENTRY_LEGEND` adds `po`, `pt`, `rpt`; `EMPTY_ENTRY` adds
`po => null, pt => 0, rpt => 0`.

**Backend.**
- `AppQyV1WordGroupWordController::getGroupWords` (`group/get_words`):
  - New params `unread_only` (bool, default false) and `limit` (int, 0 = no limit).
  - When `unread_only`, filter `orderedWordIds()` to entries with `rc == 0` (i.e.
    `fr === null` - never read) BEFORE pagination/slicing. This is the server-side
    unread filter that does not exist today.
  - `limit` caps the returned word count (the frontend passes `daily_goal`).
  - For the default group, `ensureShuffledOnce()` first (R2), so unread words are
    returned in shuffled order.
- `AppQyV1WordGroupProgressController::updateProgress` (`group/update_progress`):
  - The `read` action accepts an optional `play_time` (seconds, float/int ≥ 0).
  - On `read`: `lr = time()`, `rc += 1`, and if `play_time` present ->
    `pt += play_time`; if `rc` was already `>= 1` before this read (i.e. this is a
    reread) -> `rpt += play_time` as well. `fr`/`nr` auto-stamped by
    `normalizeEntry`.
  - `normalizeEntry` unchanged (it already keys off `rc`/`vc`/`pf`); `pt`/`rpt` are
    pure accumulators, no observer side effect needed.
  - Response `progress` block += `play_time` (pt) + `reread_time` (rpt).
- `get_progress_blob` / `get_progress_stats`: `expandEntry()` now includes `po`,
  `pt`, `rpt` automatically (legend-driven), so the FE sees the full mapping table.

**Frontend.**
- `components/WfNewShelfTab.tsx` / `components/study/WfNewGroupStudyPanel.tsx`:
  when the opened group is the Default Vocabulary Group, load the daily reading set
  via `getGroupWordsPage(gid, { unread_only: true, per_page: dailyGoal, with_progress: true })`
  (or a new dedicated call). `dailyGoal` comes from `wfNewSettings.get('dailyGoal')`
  / `userStats.dailyGoal` (GET `/user/statistics`). These are the unread words in
  shuffled order - the day's reading queue.
- Default playback is list/sequential (R1). As the recite controller finishes a
  word, submit its play time:
  `wfProgressCenter`/`wfNewApi.updateGroupProgress({ gid, word_id, action: 'read', play_time: <seconds> })`.
  Play time = the actual playback duration for that word (audio length × play count,
  or the configured interval - see implementation note below).
- After submission, the word is no longer `rc==0`, so the next day's unread set
  excludes it - the shelf naturally advances through the group day by day at the
  daily-goal pace.

**Implementation note (play time).** `play_time` is the seconds the learner spent
on the word this pass. Concretely: `wmPlayCount × (audioDuration || wmPlayInterval)`,
clamped to a sane min/max. The FE measures the real audio duration when available;
otherwise it falls back to the configured interval. Exact formula is a FE detail,
but the submitted value is a non-negative seconds amount accumulated into `pt`.

### 5.6 Implementation file manifest

**Backend (`poly_apps/laravel_main/`)**
1. `database/migrations/AppQyV1_2026_07_18_000000_add_shuffled_at_to_group_word_progress.php` - NEW (SafeMigrationHelper).
2. `app/Apps/AppQyV1/AppQyV1DBTablesBrige/AppQyV1TableMaps.php` - `GROUP_WORD_PROGRESS` fields += `shuffled_at`.
3. `app/Apps/AppQyV1/AppQyV1Models/AppQyV1GroupWordProgressModel.php` - `ENTRY_LEGEND`/`EMPTY_ENTRY` += `po,pt,rpt`; `orderedWordIds()` sort by `po`; new `ensureShuffledOnce()`; `putWords($assignRandomPosition)`; read-action `pt`/`rpt` accumulation in `updateWordProgress`; `$fillable`/`$casts` += `shuffled_at`.
4. `app/Apps/AppQyV1/AppQyV1Controllers/AppQyV1Group/AppQyV1WordGroupQueryController.php` - `getAllGroup`: ensure default group shuffled.
5. `app/Apps/AppQyV1/AppQyV1Controllers/AppQyV1Group/AppQyV1WordGroupWordController.php` - `getGroupWords`: `unread_only` + `limit`; ensure default shuffled; `addWordToGroup`: pass `$assignRandomPosition`.
6. `app/Apps/AppQyV1/AppQyV1Controllers/AppQyV1Group/AppQyV1WordGroupLibraryController.php` - `addLibraryToGroup`: pass `$assignRandomPosition`.
7. `app/Apps/AppQyV1/AppQyV1Controllers/AppQyV1Group/AppQyV1WordGroupProgressController.php` - `updateProgress` `read` action: optional `play_time` -> `pt`/`rpt`; response += `play_time`/`reread_time`.

**Frontend (`poly_apps/pycore_laravel_wordflow_ui/apps/wordnew/`)**
8. `components/WfNewShelfTab.tsx` - `onStartQuiz` default = list/sequential (R1); load daily unread set for default group (R4).
9. `components/study/WfNewGroupStudyPanel.tsx` - default mode `list` + sequential recite when entering via Start Quiz Arena; daily-goal unread word source.
10. `components/study/useWfNewReciteController.ts` (or `WfNewStudyProgress.ts`) - after each word read, submit `play_time` via `updateGroupProgress`.
11. `api/methods/social.ts` + `api/types/*.ts` - `getGroupWordsPage` accepts `unread_only`/`limit`; `updateGroupProgress` accepts `play_time`; types updated. (Per `wordnew-api-mock-pattern`: keep TYPE + both impls + mock in sync.)

### 5.7 Cross-stack contract

- `POST /group/get_words` body adds `unread_only?: boolean`, `limit?: int` (0 = no
  cap). Response shape unchanged (already returns per-word cards); `with_progress`
  already returns `read_count` etc.
- `POST /group/update_progress` body, `read` action, adds `play_time?: number`
  (seconds). Response `progress` adds `play_time` + `reread_time`.
- Default-group identity = `gname === "Default Vocabulary Group"` (constant
  `AppQyV1WordGroupPublicController::$default_group_name`). Shuffle/position logic
  is scoped to the default group only; other groups keep `aa`-asc ordering.

### 5.8 Implementation verification (code audit, 2026-07-19)

Full-stack code audit against §5.2–§5.7: **all items IMPLEMENTED**, no missing
pieces, nothing contradicting the spec. Verified deviations (intentional,
documented in code comments with rationale):

**Backend — all 7 manifest items implemented.**
- `ensureShuffledOnce()` (`AppQyV1GroupWordProgressModel.php:447-474`) skips
  `lockForGroup` (single-row write + unique `group_id` index is race-safe) and
  only assigns `po` to entries with `po === null`, preserving positions already
  assigned by `putWords($assignRandomPosition=true)` (R3/R2 convergence).
- `pt`/`rpt` accumulation lives in a dedicated `recordRead()` (model :486-518)
  called by `AppQyV1WordGroupProgressController` inside a transaction with
  `lockForGroup`, instead of inside `updateWordProgress()` — same effect.
- Unread filter tests `rc == 0` only (equivalent to `fr === null`: `normalizeEntry`
  stamps `fr` whenever `rc > 0`).

**Frontend — all 4 items implemented.**
- R1: `onStartQuiz` (`WfNewShelfTab.tsx:140-147`) only sets the practice group;
  `WfNewGroupStudyPanel.tsx:210-214` does `setMode('list'); recite.play()`.
  `startModePractice('quiz')` no longer appears in source (unused prop residue on
  `WfNewShelfTabProps`, harmless).
- R4 unread daily set: `WfNewGroupStudyPanel.tsx:99-103` passes
  `{ unreadOnly: true, limit: dailyGoal }` for the default group via
  `useWfNewPracticePager.ts:110-112`. `dailyGoal` comes from
  `wfNewSettings.get('dailyGoal')` (fallback 20); the `userStats.dailyGoal`
  alternative source is not consulted (spec allowed either).
- R4 play-time: `useWfNewReciteController.ts:176-195` computes
  `clamp(playCount × (audioDuration || interval), 1, 600)` →
  `WfNewStudyProgress.recordSeen` → `WfProgressCenter.reportReadWithPlayTime` →
  `wordflowApi.updateGroupProgress({action:'read', play_time})` (fire-and-forget).
- API layer: `getGroupWordsPage` `unread_only`/`limit` in sync across
  type + real + mock (`api/types/api.ts:173,325`, `api/methods/social.ts:407`,
  `api/methods/mockSocial.ts:246`). `updateGroupProgress` lives in
  `api-libs/wordflow` (with `play_time` support), not on the wfNewApi surface —
  so it has no mock counterpart; in mock mode the fire-and-forget call degrades
  silently (`.catch(() => undefined)`). Accepted as-is.

---

## 6. Agent Daily Reading, sentence-word playback, and mcp-chrome covers

The planned cross-stack contract for agent-history monitoring, bilingual Daily
Reading articles, English audio, `/wordnew#/article/:sort`, shared sentence-word
analysis/playback, preview-driven queue priority, and exclusive mcp-chrome cover
ownership is maintained in:

`development-guides/cross-docs/AGENT_DAILY_READING_AND_MEDIA_PIPELINE.md`

That contract is canonical for this new scope. This document's implemented shelf
progress and playback behavior remains authoritative where the new contract
explicitly reuses it. The new scope is PLANNED and must not be treated as
implemented until its acceptance audit is recorded in the canonical cross-doc.
