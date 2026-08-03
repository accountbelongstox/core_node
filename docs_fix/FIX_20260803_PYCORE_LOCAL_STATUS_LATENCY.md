# Pycore Local Status Latency Fix

Date: 2026-08-03

## Scope

This change follows `_prompts/队列中心.txt`: local status reads must return
bounded snapshots and must not wait behind engine lifecycle work, queue writes,
external probes, or full-list materialization.

## TTS settings

- Managed-service settings now publish an immutable THREAD_BUS snapshot when a
  category is registered or its user settings change.
- The TTS settings route reads that snapshot directly instead of entering the
  lifecycle owner that may be starting, stopping, or probing a local server.
- Persisted settings remain centralized in `user_data.json`; the snapshot is a
  read model and does not introduce another configuration source.

## Voice Subtitle

- Queue reads now use one bounded page snapshot instead of three serialized
  owner calls for items, current index, and playback state.
- The default UI page uses the shared queue-center `data_segment_limit` and is
  published after startup and each mutation, so HTTP reads do not wait behind
  full queue persistence.
- Queue events publish the same bounded page instead of the complete queue.
- Rows carry their global queue index, total count, and next-page offset so
  control operations remain aligned with persistent queue order.
- Clipboard and screenshot monitor status remain local THREAD_BUS state reads;
  bounding queue response encoding prevents a large queue response from
  delaying these adjacent HTTP responses on the event loop.
- The UI reads both monitor states through one centralized snapshot route. The
  two original status routes remain compatible projections of that snapshot.

## Verification boundary

Per project instructions, no tests, builds, services, or runtime verification
commands were executed. Review was static after the code changes.
