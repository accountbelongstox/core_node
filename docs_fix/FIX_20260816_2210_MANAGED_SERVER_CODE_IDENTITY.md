# Managed class-C server code identity (adoption contract completion)

> **Partially superseded** by `FIX_20260816_2242_SINGLE_VERSION_MULTI_SENTENCE_PIPELINE.md`:
> the code-identity contract (§2.1, §2.2) REMAINS the lifecycle mechanism;
> the pipeline-version half (§2.3: `sentence_chunk_version`, v1/v2 comparison,
> freeze-on-offline) was replaced the same day by the single-version
> multi-sentence marker design (`tts_chunked`, missing = legacy).

- **Date:** 2026-08-16 22:10
- **Scope:** `pycore/pyutils/common/managed_service.py`, `pycore/pyutils/tts/*`, `pycore/pyctl/agent_history/pipeline/audio_rebuild.py`, `pycore/tts_install_assets/qwen3tts_*`
- **Status:** implemented (static check only - `py_compile`; no services run, per repo rules)
- **Related:** `FIX_20260803_SENTENCE_AUDIO_QUEUE_PUMP_TIMEOUT.md`, `FIX_20260804_QWEN_QUEUE_TRANSPORT_RECOVERY.md`, `FIX_20260811_TTS_ENGINE_REGISTRY_QWEN_QUEUE.md`, `FIX_20260811_TTS_MANAGED_ENGINE_HANDOFF.md`

## 1. Problem

A Qwen3-TTS class-C API server started 2026-08-15 16:32 (before the sentence-chunking
fix, `SENTENCE_CHUNK_VERSION=2`, written 2026-08-16 01:13) kept serving long-text
audio with a degraded second half (QwenLM/Qwen3-TTS#258). Root cause chain:

1. `pycore_module_caller.py` workers restart on code change, but worker restart
   never restarts the managed subprocess it launched earlier.
2. `managed_service.py` adoption (`adopt_foreign = adapter.healthy`) accepted the
   still-healthy legacy listener across worker generations - the only probe was
   `consumer_running && !stalled`, with **no notion of which code the listener
   runs**.
3. The audio rebuild lane (`audio_rebuild.py`) therefore stayed frozen: the live
   legacy server reported no `sentence_chunk_version`, which the old code mapped
   to `LEGACY_SENTENCE_CHUNK_VERSION = 1`.

So the v2 fix existed on disk but never became live - an architectural hole in
the adoption contract, not a bug in the chunking pipeline.

## 2. Architectural fix (not a patch)

**Principle:** adoption may only pin a listener that provably runs the code a
fresh start would launch. Two distinct generations must never be conflated:

- **Code generation** (lifecycle identity): which script set the process runs.
- **Pipeline generation** (audio algorithm): `sentence_chunk_version`, stamped
  on article records and consumed by the rebuild lane.

### 2.1 Code-identity contract (shared layer, single implementation)

`pycore/pyutils/common/managed_service.py`:

- `SERVER_CODE_ID_ENV = "PYCORE_MANAGED_CODE_ID"` - wire name; owned standalone
  api-server scripts echo it in `/status` as `code_id` (they cannot import
  pycore, so the name is fixed on both sides).
- `service_script_code_id(scripts)` - sha256 over sorted (name, bytes) of the
  launch script set; `""` (empty set / all missing) disables the contract for
  that service.
- `ServiceSpec` gains `server_scripts` (expected identity source) and
  `reported_code_id` (live probe). The contract activates only when BOTH are
  declared - a spec with neither keeps today's behavior.
- `_start_server` injects the expected digest into every owned class-C launch
  environment.
- Enforcement, on the three execution paths of `ensure_running`, always
  deferred while `in_flight > 0` (busy protection stays absolute):
  - adopted listener: stale report -> reclaim (`stop` -> fresh start);
  - foreign listener: code mismatch fails adoption -> existing `stop_foreign`
    reclaim path;
  - owned process: script set changed under a live process -> restart.
- `runtime_status` exposes `code_id` / `expected_code_id` / `code_stale` for
  UI diagnostics.

### 2.2 Engine wiring (declarative, per engine)

- `pycore/pyutils/tts/engine_registry.py`: adapter base gains
  `status_report()` (via `module.get_status`) and `reported_code_id()`
  (None when the engine exposes no probe).
- `pycore/pyutils/tts/tts_service_manager.py`: `_server_scripts(engine)`
  declares each owned server's launch script set beside `_start_command`
  (single module owns launch facts):
  - `qwen3tts`: `qwen3tts_api_server.py` + `qwen3tts_synthesis.py` +
    `qwen3tts_queue.py` + `qwen3tts_gpu.py` + `qwen3tts_web.py` (repo path -
    exactly what the isolated venv imports).
  - `chattts` / `fishspeech` / `f5tts`: the `tts_install_assets` template -
    `_start_command` re-syncs staging from that same template before every
    launch, so hashing the template hashes what a start would run (a drifted
    staging copy self-heals on the next lease).
  - `melotts`: repo script.
  - `cosyvoice` / `gptsovits`: cloned foreign codebases - `[]`, off-contract
    (they already reclaim foreign listeners because they declare no
    `adopt_foreign`).
  - Registration activates the contract only when the engine also has a
    `get_status` probe; today that is qwen3tts only, which is also the only
    engine with `adopt_foreign` (the sole stale-code survival path).

### 2.3 Pipeline generation: single source of truth

- Deleted the duplicated constants `SENTENCE_CHUNK_VERSION` /
  `LEGACY_SENTENCE_CHUNK_VERSION` from `pycore/pyutils/tts/qwen/config.py`.
  The only definition is now the server script
  (`qwen3tts_synthesis.SENTENCE_CHUNK_VERSION`), reported over the wire.
- `qwen/engine.active_sentence_chunk_version()` now returns `Optional[int]`:
  the live `/status` report only; `None` = no verifiable version (offline or
  pre-versioning listener). Never guess, never mirror.
- `tts_orchestrator.engine_chunk_version()`: `int(...) or 0` - `0` = no
  chunk-version identity.
- `audio_rebuild.pending_rebuild_records()`: freeze while `version <= 0`
  (no live chunk-capable report). The lane self-activates once a v2+ server
  reports in.

## 3. Behavior after this change (no manual kills needed)

Next qwen lease: the legacy listener (no `code_id` in `/status`) fails
adoption -> `stop_foreign` reclaims the port -> a fresh start loads the current
script set with `PYCORE_MANAGED_CODE_ID` injected -> `/status` reports
`code_id` + `sentence_chunk_version: 2` -> rebuild lane unfreezes by itself and
regenerates flawed records. Busy legacy listeners are never interrupted; they
convert on their next lease.

## 4. Changed files

| File | Change |
| --- | --- |
| `pycore/pyutils/common/managed_service.py` | code-identity contract (constant, digest helper, spec fields, env injection, 3-path enforcement, status fields, docstring, `__all__`) |
| `pycore/pyutils/tts/engine_registry.py` | adapter `status_report()` / `reported_code_id()` |
| `pycore/pyutils/tts/tts_service_manager.py` | `_ASSETS_DIR`, `_server_scripts()`, contract wiring in `_register_services()` |
| `pycore/pyutils/tts/qwen/config.py` | removed mirrored version constants |
| `pycore/pyutils/tts/qwen/engine.py` | `active_sentence_chunk_version() -> Optional[int]`, live-only |
| `pycore/pyutils/tts/tts_orchestrator.py` | `engine_chunk_version` folds `None -> 0` |
| `pycore/pyctl/agent_history/pipeline/audio_rebuild.py` | freeze at `<= 0`, removed LEGACY import |
| `pycore/tts_install_assets/qwen3tts_api_server.py` | `/status` echoes `code_id`; env doc |
| `pycore/tts_install_assets/qwen3tts_synthesis.py` | comment: single definition, no pycore mirror |

## 5. Verification boundary

`py_compile` on all changed files (passed). No services started, no tests run,
no processes touched - per repo rules. Live behavior (legacy listener reclaim,
fresh-start identity echo, rebuild lane unfreeze) verifies itself on the next
synthesis lease after the running worker reloads `pyutils`.
