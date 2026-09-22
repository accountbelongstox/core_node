# Audio Queue-Head Part1/Part2 Split — Development Requirements

Date: 2026-09-22
Scope: `pycore` (audio workers, audio orchestration, queue-center RPC),
`poly_apps/laravel_main` (queue center), `poly_apps/pycore_laravel_wordnew_ui`
(wordnew app, pycore-manager app), `config/queue_center_contract.json`.
Runtime entry: `./pyservice.sh` → `pycore/pycore_module_caller.py` (the pycore
runtime is the `pycore/` tree).

This file is the binding requirement list. Implementation must follow it;
verification notes reference the measured facts below, not assumptions.

## 1. Background and incident

pycore only ASSISTS Laravel in audio generation. The authoritative queue and
its head order live in Laravel; Laravel notifies pycore (Mercure `{queue}_head`
events + diff sync). The reverse direction — pycore pushing head state INTO
Laravel — was introduced by R3/R4 of
`TASK_20260919_AUDIO_QUEUE_ALIGNMENT_HEAD_PROMOTION.md` and is now retracted.

Incident (2026-09-22): an audio-orchestration manifest with 700+ missing
`word_audio` items produced

```
[laravel] POST /api/queue-center/queues/word_audio/head/batch -> ERR (30596ms) The read operation timed out
[QueueHead] batch word_audio items 601-700 deferred: timed out
```

i.e. pycore POSTed its orchestration misses to Laravel's head/batch endpoint in
100-item chunks; a chunk exceeded the 30s read timeout and was durably deferred
for replay. This cross-side push is architecturally wrong for the new model and
is the failure class this split removes.

## 2. Measured facts (code scan, 2026-09-22)

### 2.1 Part2 chain (exists, UNCHANGED behavior)

wordnew UI is the ONLY actor that may notify Laravel of head moves:

- `apps/wordnew/services/WordNewQueueCenter.ts::moveWordsToHead` (line 69) /
  `moveSentencesToHead` (line 39) → `wfNewApi.moveWordAudioToHead` /
  `moveSentenceAudioToHead` → Laravel gateways
  (`AppQyV1WordMediaController` / `AppQyV1SentenceAudioController` →
  `AppQyV1AudioGateway::requestWord/requestSentence`, enqueueMissing=true,
  moveToHead=true) → `QueueCenterService::moveToHead` /
  `moveToHeadBatch` (enqueue-or-move by dedup key, monotonic locked head
  tickets) → `QueueHeadNotificationService::record()` → Mercure
  `{queue}_head` event.
- pycore consumption of Part2: realtime
  `pycore/pyctl/queue_center/snapshot_service.py::apply_head_event` (line 505)
  → `worker.set_cached_task_head`
  (`pycore/pyctl/tts/laravel_audio_worker.py:507`) →
  `AudioTaskQueue.move_to_head` + `diff_task_segment_store.move_to_head` →
  `request_pull(prefer_remote=True)`. Diff fallback:
  `ordered_task_ids` → `_apply_local_queue_order` → `AudioTaskQueue.reorder`
  (`pycore/pyutils/tts/audio_task_queue.py:93`).
- wordnew also mirrors head moves into its own local diff context via
  `diffQueueContext.touch` (`core/tasks/DiffQueueContext.ts:77`).

### 2.2 pycore orchestration (currently crosses into Part2 — must change)

- `pycore/pyctl/audio_orchestration/orch_resources.py::resolve_batch` (line
  263) computes local-cache misses and calls
  `orch_promote.promote_missing_to_queue_head(misses, base_url)`.
- `pycore/pyctl/audio_orchestration/orch_promote.py:86` builds dedup-key items
  (`word_audio` → `{lang}:{md5(lower(word))}`, `sentence_audio` →
  `{lang}:{media_content_id(text)}`, mirroring
  `QueueCenterService::dedupKeyFor`) and calls
  `queue_head_client.promote_batch`.
- `pycore/pyutils/laravel/queue_head_client.py::promote_batch` POSTs
  `queue_center_queue_head_batch` in chunks of
  `BATCH_CHUNK_SIZE = 100` with `HEAD_POST_TIMEOUT_SECONDS = 30`; failed
  chunks persist into a durable SQLite backlog
  (`queue_head_pending_promotions.sqlite3`) replayed by `flush_pending`
  (10s timeout, max 10 chunks/queue) on: next successful batch
  (`queue_head_client.py:259-267`), Laravel online edge
  (`orch_resources.py:378`), and process startup (`orch_resources.py:383`).
- Returned head tickets are mirrored into the local lane heap via
  `_apply_local_head_order` (`orch_promote.py:65`) →
  `worker.set_cached_task_head` + `request_pull(prefer_remote=True)`.

### 2.3 Local ordering primitive

`pycore/pyutils/tts/audio_task_queue.py::AudioTaskQueue` is a heap keyed by
`(language_tier_rank, -queue_position, seq)` (line 37), mirroring the Laravel
claim-head SQL. `push` dedups by `task_id:retry_count` and refreshes a queued
duplicate in place (no duplicate insertion). `move_to_head` (line 134) /
`reorder` (line 93) rewrite `queue_position`. `pop` always takes the head.

### 2.4 pycore-manager UI

Has queue-center display and translation priority promote
(`apps/pycore-manager/hooks/useQueueCenterHub.tsx::promoteTranslationTask`),
but NO audio head-promote action and no pycore RPC for it. pycore RPC routes
are registered in `pycore/callmodule/rpc_routes/` (pattern:
`local_queue_accept_routes.py`; route name constants in `route_names.py`);
the UI route map is
`core/integrations/pycore/PycoreHttpRoutes.ts`.

## 3. Core concepts (binding definitions)

- **Queue ALWAYS = Part1 + Part2.** At any moment a lane's queue
  (`word_audio`, `sentence_audio`) contains BOTH parts; Part1 is simply
  EMPTY until an orchestration/promote fills it. Part1 is only ever filled
  by an orchestration push (or a pycore-manager manual promote) — nothing
  else writes Part1.
- **External abstraction = ONE Queue.** To every actor outside the queue
  implementation (wordnew UI, pycore-manager UI, Laravel, lane consumers)
  Part1+Part2 IS the Queue: they never see the split, never address a part,
  and never receive part-specific data. The split is an INTERNAL
  implementation detail of the queue, and every part-related behavior must
  be annotated as such inside the queue code (ordering key, membership set,
  fill paths, dedup).
- **Whole-Queue operation.** ANY head promotion — whether it originates
  from Part1 (pycore orchestration / pycore-manager) or Part2 (wordnew via
  Laravel) — is an operation on the WHOLE Queue, never on one part in
  isolation. The parts only decide WHERE a promoted item lands.
- **Whole-Queue dedup.** Deduplication always runs against the whole Queue
  (Part1+Part2 together): an item exists at most once across both parts.
  A promote that hits an existing item — in either part — moves/refreshes
  that single copy; it never creates a second one.
- **Part1 fill path (pycore orchestration / pycore-manager):** the
  promotion writes DIRECTLY into Part1. Dedup still checks the whole Queue:
  if the item already exists in Part2, its single copy is claimed into
  Part1 (front position wins); if it exists in Part1, it is refreshed in
  place.
- **Part2 fill path (wordnew → Laravel):** wordnew pushes by notifying
  Laravel FIRST; Laravel's head notification therefore DEFAULTS to landing
  in Part2 when pycore applies it. Dedup at apply time likewise runs
  against the whole Queue: an item that already exists in Part1 keeps its
  single Part1 (front) copy instead of being duplicated into Part2.
- **Ordering:** every Part1 item sits in front of every Part2 item
  (`part_rank`: Part1=0 < Part2=1), ahead of `queue_position`. Within one
  part the existing order (language tier, then queue_position, then FIFO)
  is unchanged.
- **Direction:** Laravel → pycore only. pycore never sends head state to
  Laravel. The Laravel `head` / `head/batch` endpoints stay (wordnew is
  their only producer after this change).

## 4. Development requirements

### R1 — Part rank in the local ordering key (pycore)

`pycore/pyutils/tts/audio_task_queue.py`: extend the heap key to
`(part_rank, language_tier_rank, -queue_position, seq)` where `part_rank` is
0 for Part1 members and 1 otherwise. `part_rank` is INTERNAL to the queue:
the heap is and remains ONE whole-Queue structure — the part split is only
this ordering component plus the membership set, and every related code
path (ordering key, membership lookup, fill paths, dedup) must carry a
comment stating so. `push` resolves an entry's part rank at
insert/refresh time; `move_to_head` / `reorder` (the Part2 ticket paths)
keep entries at Part2 rank unless the entry is a Part1 member. Dedup
semantics (`task_id:retry_count` active keys, in-place refresh) are
unchanged and always run against the whole Queue.

### R2 — Per-lane Part1 membership (pycore)

`pycore/pyctl/tts/laravel_audio_worker.py` (`BaseLaravelAudioWorker`): add a
per-lane Part1 membership set keyed by the canonical dedup key
(`word_audio` → `{lang}:{md5(lower(word))}`, `sentence_audio` →
`{lang}:{media_content_id(text)}` — identical to
`orch_promote._promotion_item` / `QueueCenterService::dedupKeyFor`). Provide
`promote_local_head(items)` on the worker: this FILLS Part1 directly —
record membership for the given dedup keys, claim any already-queued
single copy of those items into Part1 (whole-Queue dedup: an item whose
copy sits in Part2 moves its ONE copy to Part1; an item already in Part1
is refreshed in place), re-rank the heap, and `request_pull(prefer_remote=True)`.
`accept_task`/`push` assigns part rank from membership. Part2 tickets
(`set_cached_task_head`, `reorder`) never demote a Part1 member — the
existing single copy keeps its Part1 (front) position. Part1 membership is
in-process; it is rebuilt when an orchestration manifest re-resolves
(manifests are durable), satisfying "empty Part1 by default after restart
with no orchestration".

### R3 — Orchestration self-promotion becomes local-only (pycore)

`pycore/pyctl/audio_orchestration/orch_promote.py::
promote_missing_to_queue_head`: stop calling
`queue_head_client.promote_batch`. Compute the same dedup-key items and call
the lane worker's `promote_local_head` (R2) per queue — the orchestration
push FILLS Part1 directly; dedup runs against the whole Queue inside the
worker/heap. No HTTP, no timeout, no deferred backlog. Generation of the
misses proceeds exactly as today.

### R4 — Remove the pycore→Laravel head client (pycore)

`pycore/pyutils/laravel/queue_head_client.py`: delete the Laravel head/head
POST path, the durable pending-promotion store and `flush_pending` (the
`[QueueHead] deferred` log class disappears with them). Remove its call
sites in `orch_resources.py` (import, online-edge flush at line 378, startup
flush at line 383). If the module becomes empty, delete it; otherwise keep
only what still has callers. This removes the 30s `head/batch` read-timeout
incident class entirely.

### R5 — Local head-promote RPC (pycore → pycore-manager)

New RPC route `ui/queue_center/promote_local_head` in
`pycore/callmodule/rpc_routes/` (name constant in `route_names.py`,
controller wired like `local_queue_accept_routes.py`). Params:
`{queue, items: [{kind: "word"|"sentence", language, text}, ...]}`.
Controller resolves the lane via `lane_registry.lane_worker`, computes
canonical dedup keys (shared helper — extract the dedup-key logic so
`orch_promote` and the controller use ONE implementation), and calls
`promote_local_head` — the SAME Part1 fill path as orchestration (R3),
with whole-Queue dedup inside the worker. Never touches Laravel.

### R6 — pycore-manager head-notify action (UI)

`poly_apps/pycore_laravel_wordnew_ui/apps/pycore-manager`: add a
move-to-head action for audio items (vocabulary / orchestration panels —
wherever missing audio rows are listed), calling R5 through
`core/integrations/pycore/PycoreHttpRoutes.ts` (new
`queueCenterPromoteLocalHead` entry). Labels via `pc-locales` (zh + en,
i18n keys only, no hardcoded strings). This is a LOCAL self-adjust: the UI
must NOT call any Laravel head endpoint for it.

### R7 — Laravel comments only (poly_apps/laravel_main)

Part2 behavior is UNCHANGED. Add code comments on
`QueueCenterService::moveToHead` / `moveToHeadBatch` and
`QueueHeadNotificationService` documenting the Part1/Part2 contract:
externally the queue is ONE whole Queue; internally it is Part1+Part2;
Laravel's notification is the Part2 fill path — because wordnew notifies
Laravel first, a head notification DEFAULTS to landing in Part2 when
pycore applies it, with whole-Queue dedup at apply time (an item already
held in Part1 keeps its single front copy); Laravel's only head producer
is wordnew; pycore consumes Part2 via Mercure/diff and never pushes head
state back.

### R8 — wordnew role comments + contract descriptor (UI + contract)

Behavior UNCHANGED. Comments on
`apps/wordnew/services/WordNewQueueCenter.ts::moveWordsToHead /
moveSentencesToHead` and `core/tasks/DiffQueueContext.ts::touch` stating
wordnew is the sole notifier of Laravel head moves (the Part2 fill path:
wordnew notifies Laravel FIRST, so Laravel's head notification defaults to
landing in Part2, deduped against the whole Queue at apply time). Add a
`head_parts` descriptor block to `config/queue_center_contract.json`
(parts always co-exist, Part1 filled only by orchestration/pycore-manager
pushes, Part2 filled by Laravel notifications, external whole-Queue
abstraction, whole-Queue operation + dedup, ordering, direction) so all
sides share one machine-readable definition.

## 5. Acceptance checks

1. Run an audio-orchestration manifest with missing word/sentence audio:
   ZERO requests to `/api/queue-center/queues/*/head*` leave pycore; the
   misses are generated locally as today, and the orchestration push has
   FILLED Part1 directly.
2. The queue always presents ONE whole-Queue face externally: no API,
   event, log, or UI surface exposes the Part1/Part2 split; the split is
   annotated only inside the queue implementation code.
3. With Part1 populated (orchestration or pycore-manager promote), the lane
   worker's next `pop()`s drain Part1 items before any Part2 item, and
   Laravel's queue rows are untouched by the promote.
4. A wordnew head move still lands end-to-end: Laravel row moved/created,
   Mercure `{queue}_head` received, local heap re-ranked (landing in Part2
   by default unless the item already holds a Part1 copy).
5. Promote the same item via Part1 (orchestration) and Part2 (wordnew) in
   either order: exactly one live copy in the whole Queue, drained from
   the Part1 position.
6. pycore-manager promote (R6) fills Part1 locally; no Laravel request is
   issued.
7. Restart the pycore service with no orchestration run: Part1 is empty
   (the Queue is then pure Part2) and the lane drains in Part2 order.

## 6. Implementation roadmap (after this doc is approved)

1. `config/queue_center_contract.json`: `head_parts` block (R8).
2. pycore `AudioTaskQueue` part rank (R1) + lane-worker Part1 membership
   (R2).
3. pycore `orch_promote` local-only (R3); delete `queue_head_client`
   Laravel path and `orch_resources` flush call sites (R4).
4. pycore RPC `ui/queue_center/promote_local_head` (R5).
5. pycore-manager UI action + i18n (R6); wordnew role comments (R8).
6. laravel_main Part2 comments (R7).
7. Verify per section 5 (py_compile / php -l / tsc --noEmit; runtime checks
   need the running deploy).

## 7. Relationship to earlier docs

- Supersedes R4 of `TASK_20260919_AUDIO_QUEUE_ALIGNMENT_HEAD_PROMOTION.md`
  (pycore orchestration self-promotion via Laravel head/batch): that R4 is
  replaced by R3/R4 here. R1/R2/R3/R5 of that doc remain valid.
- The offline durable backlog
  (`queue_head_pending_promotions.sqlite3`) is retired: Part1 needs no
  cross-side replay because it is local-only by definition.
