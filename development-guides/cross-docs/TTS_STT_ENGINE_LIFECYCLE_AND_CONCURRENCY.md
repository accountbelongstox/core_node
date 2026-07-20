# TTS / STT Engine Lifecycle & Concurrency — Shared Contract v1

Status: CANONICAL. This is the single source of truth for how pycore starts, shares,
serializes, and unloads speech engines (TTS + STT), and how install scripts keep the
Python environments from colliding.

Owner split:
- pycore owns lifecycle + concurrency (this doc's rules live in code as module docstrings).
- laravel/user_data owns engine PRIORITY (see the pipeline docs below).
- pycore-manager UI only READS status and toggles settings.

Cross-references (do NOT restate their content, link to it):
- `development-guides/SENTENCE_AUDIO_GENERATION_PIPELINE.md` §5 (engine selection + single queue)
- `development-guides/cross-docs/WORD_AUDIO_REALTIME_PRIORITY_PIPELINE.md` §9 (priority decision)
- Sub-app view: `poly_apps/pycore_laravel_wordflow_ui/apps/pycore-manager/docs/TTS_STT_ENGINE_LIFECYCLE.md`
- Implementation docstrings: `pycore/pyutils/common/managed_service.py`,
  `pycore/pyutils/tts/tts_service_manager.py`, `pycore/pyutils/tts/tts_orchestrator.py`,
  `pycore/pyutils/stt/stt_orchestrator.py`, `pycore/pyutils/edge_tts/edge_tts_client.py`,
  `pycore/pyutils/tts/qwen3tts_venv.py`, `pycore/pyutils/tts/qwen3tts_service.py`,
  `pycore/pyutils/tts/isolated_venv.py` (generic per-engine venv: melotts, gptsovits).

---

## 1. Engine taxonomy (three classes)

| Class | Engines | Runs where | Lifecycle |
|---|---|---|---|
| A. Cloud / CLI API | edge-tts, azure, gtts_web, streamelements (TTS); azure (STT) | network / CLI, no local model | NOT managed. edge-tts is SERIALIZED process-wide. |
| B. In-process local model | sherpa, kokoro, bark, voxcpm2 (TTS); faster-whisper, whisper, vosk (STT) | main interpreter, loaded on first call | managed `kind="model"`: load-on-use, may run in PARALLEL, each idle-unloads independently. |
| C. Local API/HTTP server | chattts, cosyvoice, fishspeech, gptsovits, f5tts, qwen3tts, melotts (TTS) | own subprocess exposing HTTP | managed `kind="server"`: Popen + health, MUTUALLY EXCLUSIVE, busy-protected, idle-shutdown. |

qwen3tts, melotts and gptsovits are ISOLATED-VENV class-C servers (see §5): each runs
its api server inside a DEDICATED per-engine venv because each pins a `transformers`
that cannot coexist with the main interpreter's `4.46.x` (qwen-tts `4.57.3`, melo
`~4.27.x`, GPT-SoVITS old). They are NEVER imported in the main interpreter.

---

## 2. Concurrency rules (the contract)

1. **CLI / in-process local models may run in PARALLEL** (class B). They are cheap to
   hold and load lazily; each keeps its own idle timer. This covers command-line STT
   and non-edge local TTS.
2. **edge-tts NEVER runs concurrently.** A single PROCESS-WIDE lock serializes every
   edge-tts synthesis (`_EDGE_SYNTH_LOCK` in `edge_tts_client.py`). Rationale: 403 /
   rate-limit resilience. edge is not registered with the manager; the lock is its only
   serialization mechanism.
3. **Class-C API/HTTP-server models are MUTUALLY EXCLUSIVE.** Starting one server STOPS
   the other class-C servers in the same category — EXCEPT any server that is currently
   processing a task (in-flight > 0 is never killed). Goal: minimum memory footprint,
   at most ONE heavy server resident at a time. This is `single-active` and applies to
   `kind="server"` ONLY (starting a class-B model never evicts anything).
4. **Idle unload after 3 MINUTES (180s).** A managed service with no calls for
   `idle_shutdown_s` (default 180) is stopped/unloaded by the watchdog. A busy service
   (in-flight > 0) is never unloaded. `idle_shutdown_s = 0` disables auto-unload.
5. **Busy protection is absolute.** `stop`, `single-active` eviction, and idle-unload all
   skip any service with an in-flight call. Callers MUST wrap synthesis/transcription in
   `managed_services.using(name)` so in-flight is tracked.

### 2.1 Per-engine parallel safety (`concurrency` in `tts_status`)

Each TTS engine reports a `concurrency` annotation (`_ENGINE_CONCURRENCY` in
`tts_orchestrator.py`) — a capability label only; workers still synthesize
sequentially. The UI (pycore-manager) labels engines from this map:

| `concurrency` | Engines | Parallel-safe? | Why |
|---|---|---|---|
| `serial` | edge | **NO** — process-wide `_EDGE_SYNTH_LOCK` | 403 / rate-limit protection |
| `cloud` | streamelements, gtts_web, azure | Yes, per-provider rate limits / quotas | class A, no local lock |
| `in_process` | sherpa, kokoro, bark, parler, voxcpm2 | Yes | class B; locks guard model LOAD only |
| `server` | qwen3tts, melotts, gptsovits, chattts, cosyvoice, fishspeech, f5tts | Concurrent HTTP OK | class C single-active mutual exclusion between servers; qwen3tts also has a `/synthesize_batch` GPU batch endpoint |

---

## 3. The manager (`pycore/pyutils/common/managed_service.py`)

- `ServiceSpec(name, category, kind, installed, config_ready, ...)`; server hooks:
  `start_command`, `health`, `on_started`, `on_stopped`; model hooks: `unload`, `is_loaded`.
- `start_command()` returns `(cwd, argv)` OR `(cwd, argv, env)`. When an `env` dict is
  returned the manager launches the subprocess with that environment; for a service run
  under an ISOLATED interpreter (e.g. qwen3tts's venv) it must strip `PYTHONPATH` /
  `PYTHONHOME` so the main interpreter's site-packages cannot shadow the venv.
- `using(name)` context manager: `ensure_running` + in-flight++ / touch on enter,
  in-flight-- / touch on exit. No-op for unregistered names (edge/azure/gtts/streamelements).
- Category settings persist in `user_data.json` under the category section with a prefix:
  TTS `server_` (`server_auto_manage`, `server_single_active`, `server_idle_shutdown_s`,
  `server_enabled`), STT `model_` (`model_*`). Default `idle_shutdown_s = 180`.
- Watchdog thread polls periodically and unloads idle, non-busy, managed services.

---

## 4. Orchestrators

- TTS `pycore/pyutils/tts/tts_orchestrator.py`: resolves priority (env >
  `capability_priorities` user_data > default), then for each candidate calls
  `prepare_server_for_use(name)` and wraps the synth in `managed_services.using(name)`.
  Class-C engines (incl. qwen3tts) synthesize over HTTP; class-B in-process; class-A direct.
- STT `pycore/pyutils/stt/stt_orchestrator.py`: same shape (faster-whisper → whisper →
  vosk → azure), class-B models wrapped in `using(engine)`; azure is class-A.

### 4.1 Sentence chain: GPU gate + synthesis cache

Two rules apply ONLY to the sentence profile (`_priority("sentence")` /
`synthesize(..., priority_profile="sentence")`); word/default chains are untouched.

- **GPU gate (qwen3tts PRIMARY only when its venv is ready).** qwen3tts is the
  first sentence engine whenever its isolated venv is ready
  (`qwen3tts_venv.venv_ready()` — the managed service then starts/loads the
  HTTP server on demand). The MAIN interpreter's CUDA state is intentionally
  NOT consulted: qwen3tts never runs in the main interpreter (it is a separate
  subprocess venv, port 57210, that owns its own device), so a headless /
  sanitized-PATH main interpreter must not demote a GPU-backed qwen server.
  Only when the venv is NOT ready is qwen3tts DEMOTED to the END of the
  sentence chain, so the request transparently falls back to the rest
  (edge/sherpa/...). Demote-only: a user's `capability_priorities.sentence_tts`
  override is preserved (qwen3tts is never force-promoted, only kept off the
  front when the gate fails). Lives in `_apply_sentence_gpu_gate()`.
- **Sentence-audio cache** (`pycore/pyutils/tts/sentence_audio_cache.py`).
  Content-addressed dedup keyed by
  `sha256(text|lang|speaker|instruct|engine|format|model_id)`; files at
  `map_web_path('cache')/pycore/tts_sentence_cache/<key>.<ext>` (atomic temp+replace
  writes, safe for concurrent readers). Checked at the orchestrator sentence entry
  BEFORE any engine runs (iterating the gated sentence chain for a hit) and populated
  after a successful synth under the engine that actually produced the audio. Word
  audio is intentionally not cached (short, cheap, edge-first).

---

## 5. Isolated-venv HTTP servers — qwen3tts, melotts, gptsovits (class C, Bucket B)

Engines whose pinned deps conflict with the main interpreter's shared stack run
their api server inside a DEDICATED per-engine venv and are talked to only over
stdlib HTTP. Per-engine venv dir (next to the interpreter, `get_lang_compiler_dir()`)
and default port:

| Engine   | Venv dir                          | Port | Pin isolated        |
|----------|-----------------------------------|------|---------------------|
| qwen3tts | `py_venv_<major.minor>`           | 57210 | transformers 4.57.3 |
| melotts  | `py_venv_melotts_<major.minor>`   | 57212 | transformers ~4.27.x |
| gptsovits| `py_venv_gptsovits_<major.minor>` | 9880 | transformers (old)  |

(e.g. `D:\.dev_win10\py_venv_melotts_3.13`, `D:\.dev_win10\py_venv_gptsovits_3.11`.)

`pycore/pyutils/tts/isolated_venv.py` GENERALISES the qwen3tts pattern to any engine:
`resolve_python(engine)` / `venv_ready(engine)` are RUNTIME-only (resolve the PRE-BUILT
venv, never build); `ensure_venv(engine, pip_packages, pins)` is the INSTALL-time
build+repair (`--system-site-packages` reusing the system CUDA torch, install pins
that shadow the system copies, verify with a real import-health probe, rebuild on
failure). Override per engine via `<ENGINE>_PYTHON` (refused if it is the main
interpreter). qwen3tts keeps its own `qwen3tts_venv.py` module (its venv dir has no
engine suffix, kept for back-compat); melotts + gptsovits use `isolated_venv`.

- **melotts** — `pycore/tts_install_assets/melotts_api_server.py` (standalone FastAPI:
  `/health`, `/load`, `/synthesize` with `format=wav|mp3`; env `MELOTTS_HOST/PORT/
  MODEL/DEVICE`) runs under `isolated_venv.resolve_python("melotts")`. The main-
  interpreter `melotts_engine.py` is a stdlib-urllib HTTP client (`available()` =
  `isolated_venv.venv_ready("melotts")`). `tts_service_manager` registers it as
  `kind="server"` (start command = venv python + api server + `MELOTTS_*` env,
  PYTHONPATH/PYTHONHOME stripped).
- **gptsovits** — already a class-C server (the cloned repo's `api_v2.py`). Only its
  INTERPRETER changed: `tts_service_manager` launches `api_v2.py` under
  `isolated_venv.resolve_python("gptsovits")` (None -> not started), env-stripped.

qwen-tts pins `transformers==4.57.3`; the main interpreter pins `4.46.x` (parler/bark).
Therefore qwen-tts is NEVER imported in the main interpreter. Instead:

- `pycore/pyutils/tts/qwen3tts_venv.py` builds a DEDICATED venv next to the interpreter
  (`get_lang_compiler_dir()/py_venv_<major.minor>`, e.g. `D:\.dev_win10\py_venv_3.13`),
  created `--system-site-packages` so it REUSES the system CUDA torch; only the pinned
  `transformers`/`accelerate` are installed INTO the venv (shadowing the system copies).
  Readiness is a real `import qwen_tts` (not a presence probe); the venv is rebuilt when
  that import fails. Override: `QWEN3TTS_PYTHON` (refused if it equals the main interpreter).
- `pycore/tts_install_assets/qwen3tts_api_server.py` is the standalone FastAPI server
  (`/health`, `/load`, `/synthesize`, `/synthesize_batch`; `format=wav` avoids ffmpeg).
- `pycore/pyutils/tts/qwen3tts_service.py` (`Qwen3TtsService`) launches that server in the
  venv, streams its stdout (model-loading visible), waits `/health`, and is the HTTP client.
- Production wiring: `tts_service_manager.py` registers qwen3tts as `kind="server"` (start
  command = venv python + api server + `QWEN3TTS_PORT`/`QWEN3TTS_HOST` env, PYTHONPATH
  stripped); `qwen3tts_engine.py` synthesizes by POSTing to the managed server (no
  in-process qwen-tts import). This is the same path the tester
  (`scripts/pytools/aitools/qwen3tts_tester.py`) uses — the tester just runs the server
  standalone with live stdout streaming.

Because qwen3tts is class C, starting it evicts the other TTS servers (single-active) and
it idle-unloads after 3 minutes — bounding GPU memory to one heavy engine at a time.

---

## 6. Capability status / AI page

`pycore/pyutils/common/capabilities.py` builds the Libraries strip. qwen3tts MUST appear
as ONE entry (server-backed), not two. Do not emit both a `qwen_tts` pip row (whose
version comes from the main interpreter) and a `qwen3tts` api row. Version, when shown,
comes from the venv, and `installed`/`available` reflect venv-readiness + server health.
Every Test button runs via the WS RPC routes (`local.{tts,stt,ocr,ai}.test`).

---

## 7. Install-time environment shielding

The lifecycle only works if install scripts keep the interpreters coherent.

- **Bucket A — compatible LLMs share ONE pinned transformers in the main interpreter.**
  DeepSeek-VL, DeepSeek-OCR, Qwen2.5, NLLB-200, Bark install `transformers` at the SHARED
  pin (`LLM_TRANSFORMERS_SPEC`, Linux `common_functions.sh`; add the same on Windows).
  Install is version-idempotent: install only when absent or the version differs; NEVER
  `--upgrade` (that is the race that breaks the pinned stack).
- **Bucket B — incompatible pins are ISOLATED in per-engine venvs.**
  qwen-tts (`transformers==4.57.3`), melotts (`4.27.4`), gptsovits (old) each get their own
  venv via `pycore/pyutils/tts/isolated_venv.py` (`ensure_venv(engine, pip_packages, pins)`,
  qwen3tts via `qwen3tts_venv.py`). They never touch the main interpreter. Install scripts
  call `ensure_venv` (build/repair); the runtime only resolves the pre-built venv.
- Every install script is IDEMPOTENT and self-REPAIRING: sentinels (`.deps_done`,
  `.model_installed` = repo-id) gate re-install; weight verification re-downloads
  incomplete/corrupt files; a version-idempotent transformers install self-heals a
  clobbered pin even when a sentinel exists. Re-running the full sweep (`pyservice`) is
  safe and repairs drift.

---

## 8. Env overrides & tunables (documented at their definitions)

- `TTS_ENGINE_PRIORITY`, `STT_ENGINE_PRIORITY` — override priority order.
- `EDGE_TTS_SYNTH_TIMEOUT_S`, `EDGE_TTS_PROXY` — edge resilience.
- `QWEN3TTS_PYTHON`, `QWEN3TTS_HOST`, `QWEN3TTS_PORT`, `QWEN3TTS_MODEL`, `QWEN3TTS_DEVICE`.
- `MELOTTS_PYTHON`, `MELOTTS_HOST`, `MELOTTS_PORT`, `MELOTTS_MODEL`, `MELOTTS_DEVICE`.
- `GPTSOVITS_PYTHON` (isolated-venv interpreter override), `GPTSOVITS_URL` (:9880 bind).
- `server_idle_shutdown_s` / `model_idle_shutdown_s` (per category, default 180).
- `LLM_TRANSFORMERS_SPEC` — shared Bucket-A transformers pin.

---

## 9. Model-load progress (surfaced to the UI, every engine)

Loading a model — a class-C server subprocess starting up, or a class-B model
loading weights in-process — can take tens of seconds. One shared registry makes
that progress visible so the UI never looks frozen.

- **Contract** (`pycore/pyutils/common/model_load_status.py`): a thread-safe
  `name -> {state, message, device, started_at, updated_at, elapsed_ms,
  log_tail:[…]}` registry. `state` ∈ `idle | loading | loaded | error`;
  `log_tail` is bounded (last 40 lines). API: `set_loading/set_loaded/set_error/
  append_log/set_log_tail/reset/get/snapshot` + `report_model_load(name, is_loaded)`
  (a context manager for the class-B path). One simple lock, mirroring
  managed_service — no heavy machinery.
- **Written from ONE place per engine class** (never double-reported):
  - **class C (servers)** — `managed_service._start_server`: `set_loading('starting
    server')` at launch; on health OK `set_loaded('server ready')`; on start
    failure / health timeout `set_error(...)` with the TAIL of the per-service log
    (`get_app_logs_dir()/services/<cat>_<name>.log`, already captured). `stop()`
    `reset()`s to idle. All best-effort — a status error never breaks start.
  - **class B (in-process models)** — the ORCHESTRATORS wrap the engine call inside
    `managed_services.using(name)` with `report_model_load(...)` (TTS
    `tts_orchestrator._model_load_ctx`, STT `stt_orchestrator._model_load_ctx`):
    when the model is NOT already resident it reports `loading` before the call and
    `loaded`/`error` after (probed via the engine's own `is_model_loaded`). Warm
    calls are a no-op. A server engine (kind `server`) or class-A engine
    (edge/azure/gtts/streamelements — no model) is skipped here.
- **Endpoint**: `GET /api/local/engines/load-status` -> `{success, engines:
  snapshot()}` (`engines_load_status_router`, registered with the other local
  routers). Each state change is ALSO best-effort broadcast over the existing
  rpc_v2 WS/SSE bus via `THREAD_BUS.trigger_event('engine_load_status_update', …)`
  (listener registered in `callmodule/rpc_routes/thread_bus_routes.py`); the polled
  endpoint is authoritative, the broadcast is a live-refresh optimization.
- **UI consumer** (pycore-manager, read-only): the shared store
  `core/api-libs/pycore/PycoreEngineLoadStore.ts` (`usePcEngineLoadStatus`)
  multiplexes the WS event and fast-polls the endpoint (~1.5s) ONLY while a load is
  relevant (a test popup running, or any engine `loading`). `PcTestPopup` renders a
  live load view (state badge + elapsed + streaming `log_tail`) while a test runs;
  `PcPipelineStatusPanels` shows a per-tile `loading`/`error` badge (TTS + STT).
