# WordNew Queue Command Center Refactor

Date: 2026-08-11

Source: `_prompts/队列中心.txt`, especially the bounded data-segment, canonical-contract, shared-component, and no-duplicate-command requirements.

## Command ownership

- Added a shared bounded queue command gateway with item-level single-flight ownership.
- Merged sentence audio, word audio, word translation, and word image priority commands into `WordNewQueueCenter`.
- Removed the audio-only queue center and all direct WordNew queue writes from hooks and table services.
- Kept `WordNewQueueRuntime` state-only: it now projects command responses, delivery receipts, and Worker presence without issuing queue commands.
- Overlapping batches reuse active item promises and submit only fresh resource items.
- Capacity rejection occurs before UI waiting state is created, and network failures explicitly end affected receipts as failed.
- Word-audio producer requests are segmented by the canonical producer batch limit while retaining the requested priority order.

## Canonical state and UI

- Promoted queue resource and visual-stage types to the canonical TypeScript Queue Center contract.
- Replaced the audio-named resource icon wrapper with `WordNewResourceStatusIcon` across Daily Reading, Library, Shelf/Study, and Book Reader.
- Kept one shared delivery icon group for resource stage, Laravel acknowledgement, and one Worker-kind aggregate icon.
- Reset completed receipts to waiting when a previously completed resource becomes missing again.

## Response and backend corrections

- Fixed the word-audio HTTP adapter to unwrap Laravel response envelopes before reading item results and canonical queue task IDs.
- Made sentence batch priority responses return one explicit success, ready, or failed receipt for every unique request item while realtime priority events continue to contain queued items only.
- Made word and sentence interactive enqueue failures explicit when Queue Center does not create a canonical task ID.
- Mapped already-available audio responses directly to ready and rejected missing canonical task IDs instead of leaving unpollable acknowledgements.
- Added the word-audio producer batch limit to the shared contract and reused it in Laravel request validation and WordNew segmentation.
- Assigned the canonical audio capability exclusively to Pycore and advanced the Queue Center schema to version 13; mcp-chrome remains responsible for its non-audio lanes.

## Static calculation

- Confirmed WordNew queue commands now occur only inside `WordNewQueueCenter`.
- Confirmed the removed audio center, audio-named status wrapper, runtime-owned translation command, and direct word-image writes have no remaining references.
- Confirmed queue visual-stage and resource-kind unions have one canonical definition.
- Confirmed no stale Pycore-plus-Chrome audio claimant definition remains.

Per project instructions, no tests, builds, services, migrations, or runtime verification commands were run.
