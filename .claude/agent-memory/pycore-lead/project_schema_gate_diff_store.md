---
name: project-schema-gate-diff-store
description: 2026-10-02 stall audit pycore changes - server schema gate, SQLite diff staging (JSON mirror dropped), atomic-writer temp sweep, orchestration batch presence diff, word_text decode
metadata:
  type: project
---

- `pyutils/laravel/server_schema_gate.py` is the one server-level pause (503 SERVER_SCHEMA_PENDING or 3x 5xx on gated routes, fed by `laravel_client`). Consumers: TaskPuller, AudioLaneLeases, delivery scheduler/reconciler, worker_base assist reason. `delivery_store.defer` replaces `defer_offline`.
- `pyutils/common/diff_task_segments.py` is now SQLite (`queue_diff.sqlite3`); lease lanes are structurally excluded; legacy `queue_center_segments.json` is migrated/dropped at first open.
- `atomic_json_store._write_replace` cleans its temp in `finally` and sweeps stale (>1h) `.tmp.<pid>.<id>` files once per directory per process (THREAD_BUS signal, not a SerializedValue: a serialized owner can be stopped during shutdown flushes).
- Orchestration sentence lookups: `orch_resources.server_sentence_presence` (one delivery diff) gates the per-item Laravel fetch; `orch_plan.speakable_pieces` cuts verse-glued text; plan signature carries `SEGMENTATION_PLAN`.
- `word_text` (normalization.py) decodes HTML entities for word lane tasks in `build_local_task`.

**Why:** live Laravel had no sys:init, so every claim/report 500ed and pycore replayed an 8.8 MB dead mirror.
**How to apply:** new Laravel-facing routes that touch gap tables belong in `SCHEMA_GATED_PATH_PREFIXES` roles; never persist lease-lane rows locally. See [[project-pycore-pitfalls]].
