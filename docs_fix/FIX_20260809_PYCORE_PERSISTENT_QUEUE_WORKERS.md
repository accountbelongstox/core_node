# Pycore Persistent Queue Workers and Word Audio Priority Fix

## Cause

- Queue processing was owned by a browser `SentenceAudioQueuePump`, so closing the Pycore Manager UI stopped Laravel task pulls.
- The Pycore audio and translation services accepted pushed tasks and submitted results but did not own the typed Laravel pull lifecycle.
- WordNew library playback routed missing word clips through sentence-audio scheduling, and several speech fallback paths did not notify Laravel.
- Interactive word-media resolution could wait on external pronunciation providers before adding the missing audio task.
- Queue-head changes were written to the realtime outbox but were not shown directly by the Pycore Queue Center.

## Changes

- Registered persistent Pycore heartbeat callbacks for translation, Word Audio, and Sentence Audio. Persisted category switches enable or disable these callbacks; processing continues while the UI is closed.
- Added bounded typed `pull -> accept -> result` handling to the shared Pycore Laravel worker base. Pulled task payloads use the persistent diff-ID/data-segment store and are removed only after Laravel accepts a terminal result.
- Kept the browser queue-pump implementation as a compatibility API, but removed all automatic UI start/stop ownership. UI controls now only update category switches and bind the selected Laravel endpoint.
- Changed WordNew word playback to notify Laravel immediately through the centralized word-audio priority gateway, poll within the shared data-segment limit, and cover library, study, subtitles, word cards, and daily-reading fallbacks.
- Changed Laravel word-media resolve to enqueue missing word audio immediately without waiting for an external pronunciation request.
- Added an English Laravel queue-head log and connected the Queue Center toast surface to the existing Laravel realtime stream for both `word_audio.priority` and `sentence.priority`.
- Kept Word Audio and Sentence Audio as independent queues while displaying both on the same Queue Center page.
- Added Queue Center source comments that point maintainers to `_prompts/队列中心.txt`.

## Runtime Ownership

1. WordNew requests missing audio from Laravel.
2. Laravel creates or moves the typed audio task to the queue head and emits the realtime event.
3. An enabled persistent Pycore worker receives the task through Laravel's typed pull API, accepts it, processes it, and submits the result.
4. The UI observes state and realtime queue-head events, but is not required for processing.

## Common-Layer Consolidation

- Moved `BaseLaravelWorkerService` from the translation package to `pycore/pyctl/laravel/worker_base.py`. Translation, Word Audio, and Sentence Audio now depend on the same neutral Laravel worker base; the old module is a compatibility re-export only.
- Centralized stable worker-ID construction in the shared base through `WORKER_ID_PREFIX`. Concrete workers only declare their prefix and state-owner identity.
- Replaced repeated heartbeat registrations with one declarative Queue Center callback table.
- Added `QueueCenterService::schedule()` as the single Laravel enqueue-or-promote entry and migrated word audio, sentence audio, daily article audio, and article-library audio producers to its normalized result contract.
- Added `WordNewAudioQueueCenter.notifyMissingWord()` for single-word fire-and-forget notification and merged duplicated library request/retry handling.
- Added the shared `WfNewWordMediaOptions` contract plus passive word/sentence resolve modes. WordNew now sends one active priority notification, then polls current media state without repeatedly enqueueing, raising priority, logging, or emitting realtime events.
- Added persistent segment retry deadlines. Temporary transport or server failures defer terminal-result recovery without requiring a Pycore restart; non-retryable result responses release local ownership and fall back to Laravel lease reassignment.
- Moved the recovery limit into `DiffTaskSegmentStore.pending()`, so only the capacity-sized page is marked delivered; tasks beyond current worker capacity remain available for the next cycle.
- Changed persistent data-segment saturation from “trim oldest payloads” to admission control. Unconsumed/deferred tasks are never evicted to make room; new pulls stop when the bounded segment is full.
- Deducted multi-type pull capacity by staged payload count rather than successful local dispatch count, preventing a busy local executor from over-claiming later Laravel task types.

## Static Flow Reasoning

- Startup: worker singletons bind persisted Laravel endpoint state, then the idempotent runtime registrar installs one callback per enabled category.
- Claim: each callback calculates remaining capacity, restores its persistent local segment first, and only then performs a bounded typed pull.
- Dispatch: Laravel atomically assigns the task, Pycore acknowledges it, records task type plus source endpoint, and dispatches to the lane-specific processor.
- Recovery: a locally busy task remains in the persistent segment and becomes dispatchable again. Accepted terminal results are consumed, temporary submission failures are deferred, and ownership conflicts/non-retryable responses are released safely.
- Endpoint change: new pulls use the selected endpoint while already claimed tasks retain their source endpoint for result submission.
- Interactive audio miss: WordNew notifies once, Laravel schedules or promotes the deduplicated task and emits the live event, Pycore receives it, and subsequent word and sentence polling is passive.
- UI offline: persisted switches and heartbeat callbacks remain authoritative, so neither task claiming nor result submission depends on a mounted React component.

## Verification Boundary

No tests, builds, services, or runtime verification were run, as required by the project instructions.
