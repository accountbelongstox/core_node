# Audio Orchestration + Audio Queue — State-Driven Refactor Requirements

Date: 2026-09-26
Status: binding requirement list (development requirements; design and
implementation record are appended below as work proceeds)
Scope: `pycore` (audio orchestration, audio queue library, word/sentence lane
workers, queue-center snapshot/control, RPC, pycore→UI push),
`poly_apps/pycore_laravel_wordnew_ui` (pycore-manager: audio-orchestration tab,
`/pycore-manager/queue-center` Word Audio / Sentence Audio sections, shared
contracts and pycore integration), `poly_apps/laravel_main` (listing/queue
endpoints; not running on this machine, so changes are derived from code),
`config/queue_center_contract.json`, and `docs_fix`.

## 0. Documentation first

- D1 Search `docs_fix` for every audio-orchestration and audio-queue document.
  These documents conflict with each other and with the code. The LATEST CODE
  logic wins. Correct each old document to match it: mark superseded
  sections, fix stale file/route/schema references, and point each topic to
  its one authoritative document.
- D2 This file is the binding requirement list for the work below. The old
  documents are updated to reference it where it supersedes them.

## 1. Issues to resolve (user directive, 2026-09-26)

- R1 **Stale upstream error shown on a successful call.** The audio-orchestration
  UI shows `HTTPSConnectionPool(host='api.si.12gm.com', port=443): Read timed
  out. (read timeout=60)` while pycore logs
  `POST /api/ui/audio_orch/books/list -> 200 (106.4 ms)`. Confirmed path:
  `books/list` answers from the local cache instantly. The failure text is the
  raw Python exception of an earlier BACKGROUND Laravel fetch
  (`orch_books._books_job` / sentence sync). It is persisted in `sync_state`
  and returned with every later `books/list` response. The UI
  (`VocabAudioOrchTab.loadBooks`) then renders it as a sticky error banner.
  Required: classify upstream failures into stable error codes (i18n in the
  UI, never raw exception text). A job's failure belongs to that job attempt
  and clears on the next attempt or success. The slow Laravel books/sentences
  path is fixed at its root: paging, timeouts, and the backend query cost.
- R2 **Word Part1 / Part2 / Queue visualization.** Build pycore-side state and
  UI-side visual components for the `word_audio` lane: Part1, Part2, and the
  whole Queue. The orchestration Task view embeds them, so the user can watch
  the task's MISSING word resources get filled
  (missing → queued in Part1 → generating → cached → synced to Laravel).
- R3 **Sentence Part1 / Part2 / Queue visualization.** The same as R2 for the
  `sentence_audio` lane and the task's missing sentence resources.
- R4 **Complete the sentence lane.** The sentence Part1/Part2/Queue
  implementation may be unfinished. It must reach parity with the word lane:
  Part1 fill from orchestration, whole-Queue dedup, head tickets, cache
  persistence and boot restore, drain, delivery, and status.
- R5 **State-driven Queue Center.** Bind the `/pycore-manager/queue-center`
  Word Audio and Sentence Audio sections to pycore state, and refactor the
  bottom layer to do it. Today a pycore state change does not reach the UI
  immediately. A UI change (switch, action) must propagate to pycore and back
  through the same state. Target model: pycore owns the single source of
  truth. State changes are pushed to the UI. The UI renders state and sends
  intents; it never keeps a second, drifting copy.
- R6 **Full cache pull and boot load.** When these features are enabled
  (persisted lane switch ON), pycore pulls the server-side (Laravel) data it
  needs into the local cache in full. At every pycore startup, the local cache
  is loaded in full before any remote access. This covers both lanes and the
  orchestration book/sentence cache. R2–R6 are interrelated and share one
  state model.
- R7 **System-wide root-cause refactor.** Fix problems in the bottom layer, not
  with local patches. This covers Laravel (`poly_apps/laravel_main`, derived
  logically), `pycore/`, and `poly_apps/pycore_laravel_wordnew_ui`. Priorities:
  - endless spinners caused by bottom-layer code (blocking RPCs, loading
    flags that never reset, single-flight guards that swallow, polls that
    never stop);
  - inconsistent data between surfaces (counts from different sources,
    snapshot vs switch, lifecycle strings);
  - unfinished logic (stubs, half-wired paths, word/sentence asymmetry).

## 2. Resolved conflicts with earlier documents

- `REQUIREMENTS_20260922_AUDIO_QUEUE_HEAD_PART1_PART2.md` §3 and acceptance
  check 2 said no UI surface may expose the Part1/Part2 split. R2/R3 supersede
  this for READ-ONLY observation. The queue library exposes a Part1/Part2/Queue
  state view for visualization. Actors still never ADDRESS a part: every
  mutation stays whole-Queue (whole-Queue dedup, M3 fills Part1, Laravel
  tickets land in Part2), and the direction stays Laravel → pycore only.
- Where older documents describe polling loops or snapshot caches as the
  UI refresh model, R5 replaces them with pycore-owned state pushed to the UI.

## 3. Constraints

- pycore: `development-guides/PYTHON_PYCORE.md` rules apply. These include
  layering, no try/except in new code, threading only through `Thread`
  subclasses and THREAD_BUS, shared instances created in their defining module,
  and ColorPrint output.
- UI: every user-visible string goes through i18n (zh + en). No hardcoded
  strings.
- Laravel: `development-guides/LARAVEL_GUIDE.md`. Wire shapes change only where
  the contract (`config/queue_center_contract.json`) is updated for all sides.
- Code, comments, and logs are in English. No git operations. Do not create,
  run, or modify tests. Do not run builds, services, or verification without
  a separate request.
- Reuse and upgrade existing components. Centralize shared classes and
  constants. Remove duplicate implementations.

## 4. Acceptance criteria

1. A successful `books/list` never shows an error from an earlier background
   attempt. A failed attempt shows a localized, actionable message with its
   own retry. No raw Python exception text reaches the UI.
2. Opening an orchestration Task shows the word and sentence Part1 / Part2 /
   Queue components. Each missing resource of the task is visible, and its
   state advances live until it is cached and synced.
3. The sentence lane has the same Part1/Part2/Queue behavior and the same
   boot restore as the word lane.
4. A Word Audio or Sentence Audio switch or action in the Queue Center is
   reflected in pycore and back in the UI without a manual refresh. A
   pycore-side state change (lane start/stop, queue size, head, full-sync
   progress) appears in the UI without waiting for a slow poll.
5. With a lane switch ON, pycore startup loads the local cache in full first,
   then pulls the server data in full in the background. With Laravel
   offline, the cached state still renders and drains.
6. No surface spins forever. Every loading state ends in data, an empty state,
   or a localized error.
7. Counts for the same quantity match across the Queue Center, the
   orchestration task, and the Laravel listing.

## 5. Design (binding)

### 5.1 Measured root causes (code scan, 2026-09-26)

- M1 **Sticky, raw sync errors.** `orch_books._books_job` / `_sentences_job`
  persist `str(exc)` in `sync_state.json`. `VocabAudioOrchTab.loadBooks` shows
  the books-job failure AND the first failed per-book sentence sync as ONE
  books banner. The banner keeps showing until that exact job succeeds again,
  so a 200 `books/list` still shows an old timeout.
- M2 **Slow sentence sync.** `_fetch_sentences_blocking` walks
  `media/books/{key}?grain=sentence&per_page=2000` with a 60 s timeout. Laravel
  answers each page with OFFSET pagination plus a `COUNT(*)`
  (`AppQyV1SourceSentenceModel::orderedSourcePage` → `paginate`), so deep
  pages of large books exceed the read timeout. A failure restarts the
  whole book.
- M3 **Part1 was not a priority lane.** `word_audio_full_sync` filled the ENTIRE
  dictionary backlog (≈130k words) into Part1, so orchestration misses queued
  behind it. The word audio flag and Part1 therefore meant nothing for
  orchestration.
- M4 **Double generation / invisible fill.** `orch_resources.resolve_batch`
  promoted misses into Part1 and then generated them itself. The lane worker
  later popped the same entries. Nothing recorded which entry belonged to which
  task or what its state was, so no UI could show the fill.
- M5 **Sentence Part1 unfinished.** `orch_promote` only re-ranked sentence
  entries that were ALREADY queued (no local task), so orchestration sentence
  misses never entered Part1. The sentence lane also had no cache restore at
  boot (`_start_word_audio_boot_chain` covered the word lane only).
- M6 **Not state-driven.** `queue_center.snapshot.changed` was published only
  for Laravel head/priority events. Lane switches, queue drain, full-sync
  progress and outbox changes pushed nothing, so the UI saw them only on the
  fallback poll. `setControl` patched the UI optimistically and re-polled
  once, which could flip the switch back.
- M7 **Heavy hot paths.** `AudioTaskQueue.head_preview` sorted the whole heap on
  every snapshot read. `persist_snapshot` serialized the whole Queue after
  every full-sync page (≈130 writes of ≈130k tasks). `find_cached_many`
  re-scanned the whole word-cache directory for every task run.

### 5.2 Queue model (supersedes the 2026-09-22 Part1 definition where it differs)

- Queue = Part1 + Part2, one whole-Queue structure per lane. Every mutation is
  whole-Queue and deduped.
- **Part1 = pycore-local priority.** It is filled ONLY by audio orchestration
  (manifest misses, words AND sentences, each as a local task) and by the
  pycore-manager manual promote.
- **Part2 = the Laravel backlog.** It holds Laravel's queue mirror
  (M1/M2/head tickets) AND pycore's full pull of the dictionary backlog. The
  pycore full pull is a MIRROR of Laravel's dict-lane live view
  (`DESIGN_20260922_DICT_LANE_LIVE_QUEUE.md`), so it is a Part2 fill
  (`accept_backlog`). Boot restore migrates old snapshots: full-sync keys
  leave Part1.
- **Tracker (read-only observability).** The library tracks each Part1 item:
  `queued → processing → done | failed`, with its owners (orchestration
  task ids), source, provider, and whether a lane worker or the owner settled
  it. Part2 is shown as counts plus a head preview. The split may be
  VISUALIZED. Actors still never address a part.
- **One generator per item.** Orchestration `take_local`s its Part1 items just
  before it generates them, removing them from the heap, and `settle_local`s
  the outcome. Items a lane worker already popped are waited for, then read
  from the cache. The lane worker reports its outcome through
  `complete(lane, task, outcome, provider)`.
- **Change signal.** Every mutation bumps a per-lane revision and signals
  THREAD_BUS `audio_queue_center.changed`. Snapshot persistence is
  debounced by a library-owned persister thread, and a final flush runs at
  shutdown.

### 5.3 State-driven Queue Center (pycore owns the truth)

- `pyctl/queue_center/audio_lane_state.py` composes each lane's state:
  - the switch (persisted capability) and lifecycle (heartbeat callback);
  - the section contract (the same builder as the snapshot);
  - the queue view (whole / Part1 / Part2 / tracker counts and previews);
  - worker counters, outbox stats, and full-sync status.
- A publisher thread waits on the change signals (queue, control, full sync,
  worker cycle), coalesces them for 300 ms, and publishes the SSE topic
  `queue_center.audio_lane.changed` with the full lane-state payload.
- RPC `ui/queue_center/audio_lane_state` returns the same payload, optionally
  scoped to one orchestration owner.
- `set_queue_center_control` applies the switch, activates the lane, and
  returns the authoritative lane state. The UI applies that returned state
  instead of an optimistic guess.
- The UI keeps ONE lane-state store with a revision guard. It is fed by the
  push topic, the RPC on mount, a reconnect or replay loss, and a slow
  fallback poll in relay mode (where the pycore SSE stream is not available).
  The Queue Center word and sentence sections render from it and replace their
  section contract from the pushed one.

### 5.4 Activation, full pull, and boot load (both lanes)

- `pyctl/tts/audio_lane_activation.py::activate_audio_lane(lane)` is the one
  ON transition, used by the UI control, the auto-start helpers, and boot. It
  runs:
  1. restore the lane from the local snapshot;
  2. start the full pull (word: dictionary without-audio listing →
     `accept_backlog`; sentence: the FULL_SYNC diff mirror of Laravel's pending
     `sentence_audio` tasks through `initialize_from_laravel`);
  3. wake the drain.
- Boot: for every lane whose persisted switch is ON, activate the lane. Also
  load the word-audio cache index in full (all languages) in the background,
  so orchestration cache lookups are O(1) instead of a directory scan.

### 5.5 Orchestration

- The resources phase (word and sentence):
  1. batch cache scan;
  2. misses → `promote_local_head(owner=task_id)` (local tasks for both kinds);
  3. per chunk: `take_local` → generate (word: one Kokoro batch per language;
     sentence: Laravel lookup, then local synthesis) → `settle_local`;
  4. items in flight on a lane worker are awaited, then resolved from the
     cache.
- Task progress carries per-lane tracker counts. The task view embeds the
  shared Part1 / Part2 / Queue component, scoped to the task owner.
- Sync jobs store `error_code` (stable, i18n on the UI) plus a short `detail`
  and the attempt time. The books banner shows only the books-list job.
  Per-book sentence failures render on that book's row with Retry.
- Sentence sync pages 500 rows with a 45 s timeout and 3 retries per page. It
  resumes from the persisted partial and uses Laravel keyset paging
  (`after_seq`) when the server supports it, falling back to page numbers.

### 5.6 Laravel

- `MediaBrowseController::bookDetail` accepts `after_seq` (grain `sentence`,
  no enrichment). Keyset `seq > after_seq ORDER BY seq LIMIT per_page`, with
  no OFFSET and no COUNT after the first page. It returns `next_after_seq`
  and `has_more`.
- Doc comments on the full-pull consumer contract change from "Part1 fill"
  to "Part2 mirror".

### 5.7 Contract

- `config/queue_center_contract.json`: `head_parts` rewritten per §5.2, new
  `audio_lane_state` block (topic, RPC, tracked states), and
  `word_audio_full_sync` marked as a Part2 fill. `schema_version` goes from
  36 to 37.

## 6. Implementation record

To be appended after development.
