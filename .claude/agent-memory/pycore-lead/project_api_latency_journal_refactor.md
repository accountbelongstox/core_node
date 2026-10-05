---
name: project-api-latency-journal-refactor
description: 2026-10-06 root-level pycore API latency refactor - event journal/console log/RPC pool design decisions and test-isolation traps
metadata:
  type: project
---

Event journal is in-process (writer thread + push subscriptions), not Redis-backed: a single XADD costs ~120us wall (GIL hops), in-process post ~3us. `pyutils/common/redis_state.py` exists as optional generic state (KV/hash/stream, protocol=2, probe with backoff) but the journal does not use it.

- Journal: `event_journal.publish_topic` = taps on publisher thread + one THREAD_BUS post; `EventJournalWriterThread` (BatchOwnerThread) owns `EventRecordJournal`; WS sessions are subscriptions (`subscribe/retopic/unsubscribe/acknowledge`, deliver runs on writer thread, hands off with `loop.call_soon_threadsafe`). `pycore_log` is live-only (no seq, not replayed, not published unless a subscriber wants it; taps still see it). Empty `topics` list now means no topics (None = all).
- Console log: `console_log_file.py` holds the file + sparse seq->offset index; history reads on the caller thread; compact JSON lines (`{"instance_id":"..","seq":N,`).
- RPC sync handlers run on `ElasticWorkerPool` (grower thread starts workers; loop never calls Thread.start). Request log lines go through `HttpAccessLog` batch thread.
- orjson replaces stdlib json via `pyfoundations/json_codec.py`; NaN now encodes as null (was a 500).

**Why:** measured 10-16s tails on trivial routes from GIL hops/thread storms.
**How to apply:** do not reintroduce owner hops or per-step threads on publish/history paths.

Test traps:
- `CORE_NODE_CACHE_DIR` does NOT isolate the console log dir (`get_app_logs_dir` -> `get_system_cache_dir` = D:\www\core_node\logs). A scratch run that posts to console_log_journal appends to the LIVE pycore_console.jsonl. Patch `pycore.pyfoundations.system_paths.get_app_logs_dir` BEFORE importing console_log_file/console_log_journal.
- The session scratchpad is shared with other agents: use a unique `lead_` prefix, never `rm -rf cache`.
- `python -u` (or flush=True) before `os._exit`.
