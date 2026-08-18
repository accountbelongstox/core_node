# Queue Center Blocking and Duplicate Request Fix

Date: 2026-07-31

## Scope

This change follows `_prompts/队列中心.txt`: Queue Center reads must stay
decoupled, UI controls must be explicit, Laravel event streams are primary, and
fallback reconciliation must never block unrelated UI operations.

## Completed-task history

- Removed the unbounded `sync_all()` workflow.
- A sync request now fetches exactly one cursor page from Laravel.
- The first page reserves bounded space for recent local Pycore records; later
  pages use the Laravel cursor without skipping records.
- Laravel and resource-download I/O no longer runs on the archive serialized
  owner. Only the short manifest commit is serialized.
- Archive reads and cached-resource lookups no longer wait behind synchronization.
- Queue Center snapshots no longer embed completed-history file reads. The
  Recent section owns its separate paginated request.
- Remote resources are not downloaded during metadata synchronization.
- Timed-out serialized calls are skipped before execution when their response
  guard has already expired, preventing stale queue amplification.

## Frontend request ownership

- Removed the duplicate Laravel endpoint provider from the top bar. The
  application layout is the single endpoint-state owner.
- Removed the automatic endpoint probe/follow-up list cycle. Endpoint listing
  runs once at initialization and after explicit add/remove/select/probe actions.
- Endpoint-list reads use one module cache and one in-flight promise, so React
  development remounts and sibling consumers reuse the same request.
- OCR, STT, TTS, AI, and capability status use one module-level cached snapshot.
  Periodic five-endpoint polling was removed; manual refresh remains available.
- Removed the Recent panel's second Queue Center refresh. The page-level hub is
  the only snapshot requester.
- Added a short Pycore snapshot cache so closely spaced callers reuse one result.

## Pycore to Laravel reconciliation

- Translation list reconciliation falls back every five minutes while the event
  stream is connected.
- Translation monitor construction and endpoint-change callbacks no longer
  prewarm Laravel while the UI-controlled callback is disabled.
- Dictionary pending-word counts are refreshed at most every five minutes and
  reused between reconciliations.
- Sentence monitor requests are single-flight, debounced, and limited to 50 rows.

## Laravel query changes

- Completed-task type aggregation is optional, cached, and omitted on subsequent
  cursor pages.
- Translation queue pagination reuses cached summary totals for known status
  buckets and selects only fields rendered by Queue Center.
- Pending dictionary summary uses one conditional aggregate query instead of
  four table counts. Worker activity uses one grouped cached query.
- Sentence missing-list reads are database-only. They no longer reconcile rows,
  write status, or perform repeated filesystem checks in a GET request.
- Added idempotent `sys:init` indexes for completed-task cursor reads,
  translation queue ordering, dictionary pending reads, and sentence queue
  ordering.

## Worker queue handshake

- Removed Pycore's standalone worker register and heartbeat requests.
- Worker identity, processor types, and capabilities now travel with each queue
  pull. Laravel discovers or refreshes the worker before claiming in that same
  request.
- Word-audio and sentence-audio remain separate consumers because they own
  different execution lanes, but each cycle now starts directly with its queue
  pull.
- The existing register and heartbeat endpoints remain available for legacy
  consumers; Pycore no longer calls them.

## Verification boundary

Per project instructions, no tests, builds, services, migrations, or runtime
verification commands were executed. Review was static and read-only after the
code changes.

## 2026-08-01 timeout follow-up

- Production sampling showed 30,636 global tasks: 7,097 pending, 18,645 failed,
  and 4,894 completed. A cold status aggregation took 6.884 seconds while the
  lightweight health probe took 0.211 seconds, identifying database and worker
  contention rather than response payload size as the timeout source.
- Sentence Queue Monitor now reads live `sentence_audio` rows from the central
  `global_tasks` queue instead of counting and paging every language table.
- The audio feeder rotates its language starting point every tick, preventing a
  permanently busy early language from starving later languages.
- Typed worker pulls refresh heartbeat timestamps at most once per 30 seconds,
  combine urgent and fast backlog counts into one aggregate, and use an index
  matching task-type claim order. One failed task-type pull no longer prevents
  the remaining task types from being requested in the same Pycore cycle.
- Task statistics use a 15-second fresh and 60-second stale shared snapshot with
  locked refresh, reducing repeated full-table status aggregation.
- Code-last-modified still scans all configured source directories. Linux now
  computes the maximum timestamp in one native `find | awk` pass and returns one
  line; Windows performs a single-pass maximum without sorting. A shared file
  cache keeps results fresh for 60 seconds, serves stale data for up to 10
  minutes during refresh, and serializes cold scans. Native scanning is capped
  at two seconds, the PHP fallback at one second, and a concurrent cold request
  waits at most one second before returning a lightweight scan-busy snapshot.

## 2026-08-01 article-audio queue unification

- The Agent History Laravel upload used an unsupported `json_data` keyword and
  then treated the raw HTTP response as a dictionary. It now sends `json`,
  checks the HTTP status, parses JSON once, and records the Laravel article and
  expected audio URL in the local Pycore record.
- Agent History synthesizes the full article locally before submission and
  uploads the article and MP3 together. Laravel stores that full-article audio,
  while every parsed sentence still enters the central `sentence_audio` queue.
  The sentence worker retains its Qwen-first engine profile; words remain on
  `word_audio`.
- `sentence_audio` payloads now identify sentence rows, daily articles, or
  article-library rows with `target_kind`. One processor dispatches the result
  to the matching existing storage model instead of creating a parallel audio
  queue.
- Missing `daily` or `agent_history` static MP3 requests enqueue or move the
  corresponding article task to the head, emit the existing sentence priority
  event, and return HTTP 202 with a retry hint. A completed request continues to
  use the normal static-file response.
- WordNew distinguishes queued article URLs from playable files and exposes an
  explicit priority request for missing audio. Pycore Manager falls back from
  its local record to the Laravel URL and caches the generated MP3 after it is
  available.
- The Laravel feeder now covers sentence rows, daily/article records, and
  language article-library rows. Runtime and backfill paths no longer assign
  article generation to the word-audio worker.

### Production volume sample

- Queue Center reported 26,010 word-audio tasks (6,362 pending, 4 assigned) and
  3,623 sentence-audio tasks (462 pending). Laravel held eight daily-reading
  articles; the reported missing file belonged to one of those rows.
- Item pages returned in 124–177 ms, while the cold overview aggregation took
  16.228 seconds. This isolates the main timeout risk to repeated aggregate and
  claim queries, not response body size. Queue stats now use a short shared
  cache, and the existing typed-pull index remains required at deployment.
- The reported MP3 returned 404 before this change even though its database row
  said `tts_generated=true`. File availability is now reported independently
  from that stale flag, so either UI can requeue the missing artifact instead of
  presenting it as playable.

## 2026-08-01 diff-ID pagination follow-up

- Agent History again synthesizes the full article locally before submission.
  The repaired Laravel client sends the MP3 in `audio_base64`; Laravel stores
  that article audio immediately, while every parsed sentence is still added to
  the central sentence queue for independent missing-audio completion.
- Word and sentence discovery now use a shared persistent diff-ID page catalog.
  The initial snapshot records table IDs in bounded pages, and incremental
  discovery advances from the stored high-water ID instead of rereading IDs
  already cataloged.
- Catalog discovery selects IDs only. Full word or sentence columns are loaded
  for one pending ID page only when the corresponding live queue is below its
  backlog target. With an adequate backlog, the timer performs only the small
  ID-page query and leaves business rows untouched.
- Each page is stored separately in Laravel's persistent cache. The timer holds
  only one ID page in process memory, acknowledges it after successful enqueue,
  and retains a failed page for idempotent retry.

## 2026-08-13 section-contract drift repair

- The Pycore snapshot builder treated heartbeat runtime health as a fifth Queue
  Center section even though the canonical contract defines only the four
  business sections. This caused every snapshot request to fail while resolving
  the absent `heartbeat` definition.
- Heartbeat remains lightweight scheduler state and is no longer wrapped as a
  queue contract. Business section construction now iterates the canonical JSON
  scope catalog instead of maintaining another hardcoded scope list.
- The Python adapter validates control-to-section and category-to-section
  coverage when loading the canonical contract. The UI scope type is derived
  from the same JSON keys, preventing another manually synchronized scope union.
- Per project instructions, this repair was reviewed statically; no tests,
  builds, services, or runtime verification commands were run.
