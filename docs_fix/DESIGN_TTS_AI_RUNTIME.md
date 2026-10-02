# TTS / AI Runtime (pycore)

Scope: TTS, STT, OCR, LLM and translation engines in pycore: the model manifest and boot masking, the AI hub and live monitors, the TTS engine classes, registry, memory gate and load gate, the pinned runtime plan, managed servers and code identity, qwen3tts and kokoro, per-engine venv and Docker installs, the GPU/CPU toolchain, compute classes per task type, the local-models-only policy and local AI translation.

Authority: code > `config/service_contract.json` / `config/queue_center_contract.json` / `config/pycore_rpc_contract.json` > this document. Notebook launch, persist root, secrets and assist default: `DESIGN_SHELL_HOSTS.md` §15. Queue lanes and work leases: `DESIGN_QUEUE_PIPELINE.md`. Relay: `DESIGN_RELAY.md`.

Nodes are GPU nodes or CPU nodes only: the compute class (`gpu` | `cpu_only`) of the worker registration. Colab/Kaggle is a place a GPU or CPU node runs, not a node kind.

## 1. Model manifest and boot masking

- One schema, one registry: `pyutils/common/model_manifest.py` (`ModelEntry`, `BootVerdict`, `model_manifest`). Categories: `ai_text`, `ai_image`, `tts`, `stt`, `ocr`, `llm`, `translate`, `library`. Runtimes: `cloud`, `server`, `model`, `library`. Ids normalize `-` to `_`; aliases cover the rest.
- `ModelEntry` is the only readiness source: `packages` (main-interpreter imports), `install_markers` (`packages` | `venv` | `deps` | staging-relative path; any one means installed), `secrets`, `staging_env`, `installer` (the real `Step*.ps1 / *.sh`), plus `languages`, `chunk_capable`, `cloud`, `health_paths`, `live` (`qwen_queue` | `word_batch`), `tier_engine`, `concurrency`, `managed_kind`.
- Each domain declares its entries once in a leaf manifest: `pyutils/tts/tts_manifest.py`, `pyutils/stt/stt_manifest.py`, `pyutils/ocr_cluster/ocr_manifest.py`, `pyutils/llm/llm_manifest.py`, `pyutils/translator/translate_manifest.py`, `pyctl/ai/ai_manifest.py`. `pyctl/ai_hub/manifest_loader.py` imports every leaf and boot-check module so the registry is complete. Capability, priority and status tables derive from the registry.
- `pyutils/common/model_boot.py` (`model_boot`): checks are registered apart from entries (`register_checks`); verdicts are THREAD_BUS signals `model.boot.verdict.<key>`. `verify`, `record`, `is_blocked`, `reason`, `blocked_ids`, `records`, `policy_reason`, `third_party_block_reason`; `ThirdPartyServiceBlocked`.
- Verdicts: `ready` usable; `deferred` fixable by the managed lifecycle or installer (never masked; every `server` runtime that is not installed is deferred); `blocked` hard precondition missing (secret, package, weights, load error) and masked until `retry`.
- `pyctl/ai_hub/boot_service.py`: `verify_all()` at runtime-worker start (a raising check records a blocked load failure), one summary line, topic `ai_hub.boot.changed` per verdict change; `retry(id|None)`.
- Masking consumers call `model_boot.is_blocked`: TTS availability/config readiness, STT/OCR/LLM availability, AI gateway candidates and probes, `managed_services` starts, priority chains (blocked engines are skipped, never reordered).
- Coded reasons: `pyutils/common/model_reasons.py` (cross-category), `pyutils/tts/tts_reason_codes.py` (TTS). Missing models never block pycore: panels show unavailable rows with installer-named reasons (`tts_not_installed`, `tts_model_weights_missing`, `model_install_required`, `model_server_unreachable`, `model_platform_unsupported`).

## 2. AI hub and live monitors

Routes (`callmodule/rpc_routes/ai_hub_routes.py`, `model_live_routes.py`; services in `pyctl/ai_hub/`), all `{success, data|error}`:

| Route | Payload |
|---|---|
| `ui/ai_hub/catalog` | `{categories:[{id, entries:[{id, category, runtime, note, aliases, tier, boot, runtime_state, capabilities:{test, history, power, live}, test_schema}]}]}` (`catalog_service.py`) |
| `ui/ai_hub/test` `{id, params}` | dispatches by category through `probe_service.py`; always writes one history record |
| `ui/ai_hub/history` `{id?, category?, cursor?, limit?}` | keyset page `{items, next_cursor, has_more}` on `(created_at, record_id)` + `total` |
| `ui/ai_hub/history_delete` / `history_clear` | `{record_id}` / `{id?, category?}` |
| `ui/ai_hub/boot_status` / `boot_retry` | verdict records / `{id?}` |
| `ui/model_live/snapshot` / `watch` | live snapshot / sampler subscription with TTL |

- History: `pyctl/ai_hub/probe_history.py` over `JsonIndexStore` (`ai_hub_history.json`, max 300); audio/image bytes stay in their own stores and are linked by `result_ref`. Topic `ai_hub.history.changed` `{id, record_id}`.
- Live: `pyctl/ai_hub/live_service.py` snapshot = `{sampled_at, system:{cpu, mem, gpus[]}, qwen3tts:QwenLive|null, kokoro:KokoroLive|null, engines:{<id>:{loaded, in_flight, queue_depth}}}`, published on `model_live.changed` at most 1 Hz, revision-stamped, only while a client watches or a qwen job / kokoro batch is active. QwenLive normalizes the server `/status` (`pyutils/tts/qwen/live.py`: device, dtype, `max_parallel`, `capacity_plan`, gpu, queue, jobs, recent, counts); KokoroLive comes from `pyutils/tts/batch/kokoro_live.py` (batch progress, recent words, queue).
- UI (`apps/pycore-manager`, `/pycore-manager/ai`): manifest-driven rows; `test_schema` drives the test popup (no hardcoded engine lists).

## 3. TTS engine classes and registry

- `pyutils/common/engine_registry.py`: `EngineAdapter(name, category)` reads its `ModelEntry` (`probe`, `available` incl. boot mask, `status_row`); `EngineRegistry` (`available`, `best`, `priority`, `panel`); `build_engine_panel()` is the one panel shape for TTS, STT, LLM and OCR.
- `pyutils/tts/tts_engine.py`:
  - `TTSEngine(EngineAdapter)`: install, boot and availability views derived from the manifest; class flags `config_gate`, `venv_runtime`, `service_status_capable`, `process_free`, `boot_secrets_first`, `boot_strict_install`, `external_server_ok`; `unavailable_reason()` order: install -> disabled (secrets/settings) -> model weights -> `runtime_reason()` (load gate); `parallel_capacity()` (0 = no report).
  - `HttpServerEngine`: base URL `{P}_URL`, else `http://{P}_HOST:{P}_PORT`; one `TTS_AVAILABILITY_TTL_SECONDS` (30 s) THREAD_BUS health cache over `health_paths`; one POST path (`tts_http.py` on `http_client`, one error decoder; synthesis POSTs carry no total deadline).
  - `IsolatedVenvServerEngine`: readiness = its per-engine venv (`isolated_venv.venv_ready`); missing base interpreter reports `python310_not_registered` / "base interpreter incompatible".
  - `SerializedModelEngine`: in-process model owned by a serialized worker thread.
- `pyutils/tts/engine_registry.py`: `tts_engine_registry` holds the 16 engine instances in manifest order (azure, bark, chattts, cosyvoice, edge, f5tts, fishspeech, gptsovits, gtts_web, kokoro, melotts, parler, qwen3tts, sherpa, streamelements, voxcpm2) and registers their boot checks. `load_gate(name)` is the single gate entry (registry engine's `load_gate()`, else `memory_gate_allows(name)`).
- Config gate: engines with `config_gate = True` (chattts, fishspeech, f5tts, gptsovits) whose `config_ready()` fails are skipped before any lease (e.g. f5tts without `F5TTS_REF_AUDIO`), so no server starts for a configuration a start cannot fix; `last_error` carries the reason.

## 4. Memory gate and load gate

- `pyutils/tts/memory_gate.py` is the single admission authority for model loads. `_REQUIREMENTS` maps engine -> (RAM, VRAM) needed to LOAD its current tier (parler, bark tier/device aware; kokoro/sherpa 0.5-1 GB; qwen3tts 1 GB RAM only; chattts 4 GB, cosyvoice/fishspeech/gptsovits 6 GB, f5tts 4 GB, voxcpm2 8 GB, melotts 2 GB). Cloud engines are ungated. On Windows the gate also masks an engine when free commit headroom (`free_commit_bytes()`, `GlobalMemoryStatusEx.ullAvailPageFile`) is below its RAM need (the WinError 1455 case); a no-op on Linux. Unknown readings never mask. `TTS_MEMORY_GATE=0` disables.
- All GPU readings come from an nvidia-smi subprocess (`_gpu_query`, `free_vram_bytes`, `gpu_stats`); torch/CUDA is never initialized in the pycore process (a faulting driver would kill the service silently).
- `TTSEngine.load_gate()` = `memory_gate_allows(name)`, or pass when the model is resident. `resident()` caches `is_model_loaded()` (server `/health` or in-process owner flag) for 30 s; start/stop/unload clear it. A resident model is never masked by the memory it already holds.
- The sherpa family (kokoro, sherpa) reports no memory-gate reason (`SherpaEngine.runtime_reason` returns None).
- Callers: `runtime_reason`, the orchestrator mask, the batch self-check, `runtime_profile.engine_start_allowed`, `tts_service_manager.start_server`, and the audio worker memory wait.
- Audio lane memory wait (`laravel_audio_worker_engine._await_engine_memory`, called before every pop of the serial, parallel and word-batch drains in `laravel_audio_worker.py`): while the lane's pinned engine (word-batch engine or required engine) fails its load gate, the lane holds instead of popping tasks that would fail; `Backoff` 5-60 s, a per-lane wake signal ends the wait at once on halt or shutdown; `lane paused: <reason>` and `host memory recovered; resuming <engine>` are logged once per engine (`engine_memory_pauses`).
- Memory-pressure robustness: worker status reads outbox stats through `_delivery_outbox_stats()`, which degrades to `{kind, error}` instead of raising; delivery-outbox reconcile streams its inventory in pages of `RECONCILE_INVENTORY_PAGE` = 10000 (`pyutils/laravel/delivery/model.py`); a serialized-worker error with an empty message surfaces as `Serialized operation failed (<ErrorType>)` (e.g. `MemoryError`).
- Display GPU headroom: `display_reserve_mb()` keeps `max(GPU_DISPLAY_RESERVE_MIN_MB=1024, 10% of total)` free on a GPU with `display_active=Enabled` (headless GPU: 0; `PYCORE_GPU_DISPLAY_RESERVE_MB` overrides, 0 disables). Launch floors subtract it; `gpu_memory_env()` hands qwen3tts and chattts `PYCORE_GPU_MEMORY_FRACTION`, applied by `tts_server_common.apply_gpu_memory_fraction` before model load. pyservice never resets or reloads the GPU driver.
- VRAM reclaim (`reclaim_vram`) is opt-in (`QWEN3TTS_VRAM_RECLAIM=1`) and only stops GPU processes pycore started.

## 5. Pinned runtime plan (`tts_runtime_plan`)

`config/service_contract.json` `tts_runtime_plan` is the only engine plan and the only owner of the word-batch engine:

| Mode | word | word_batch | sentence (also agent_history, long text) |
|---|---|---|---|
| gpu | edge -> kokoro | kokoro | qwen3tts |
| cpu | kokoro | kokoro | kokoro |

- Readers: `pyutils/tts/runtime_profile.py` (`_GPU_PLAN`/`_CPU_PLAN`; `WORD_BATCH_ENGINE` must be one engine equal in both modes, checked at import), PHP `ServiceContract::ttsWordBatchEngine()`, TS `ServiceContract.ts` `TTS_WORD_BATCH_ENGINE`, `notebook_runtime.sh` (`notebook_inactive_plan_engines`). `queue_center_contract.json` `word_audio_batch` holds profile `word_batch`, device `cpu`, `default_batch_size` 20.
- The profile is pinned once per process (serialized owner, background pin after the optional `--tts-selfcheck` gate). Mode: `TTS_RUNTIME_PROFILE` = `auto` (gpu when `gpu_present()`, else cpu) | `gpu` | `cpu` | `off` (persisted chains of `engine_policy` apply).
- With the profile enabled, `engine_policy.configured_tts_priority()` returns the pinned chain; engines outside the plan are never auto-scheduled or auto-started. An explicit UI test or server start may run any engine that passes the load gate (`engine_start_allowed(..., explicit=True)`).
- With the profile off: sentence and agent_history stay pinned to qwen3tts (`_SENTENCE_PINNED_TTS`, `_AGENT_HISTORY_PINNED_TTS`, no fallback); the word chain excludes qwen3tts (`_WORD_EXCLUDED`) and follows the persisted `TTS_WORD_PRIORITY`. CosyVoice, Fish Speech, VoxCPM2, GPT-SoVITS and MeloTTS serve word generation only.
- Edge has a runtime cooldown (`engine_policy.mark_edge_cooldown`); the word chain degrades to kokoro while edge is down and recovers on the first success.

## 6. Managed services and code identity

- `pyutils/common/managed_service.py` (`managed_services`), category facades via `ManagedServiceFacade` (`managed_service_facade.py`). TTS facade: `pyutils/tts/tts_service_manager.py`, launch facts in `tts_server_launch.py`, foreign-listener handling in `tts_server_ownership.py`.
- Kinds: `server` (class C: subprocess HTTP API; chattts, cosyvoice, fishspeech, gptsovits, f5tts, qwen3tts, melotts, voxcpm2) and `model` (class B: in-process; bark, kokoro, sherpa, parler). Cloud/CLI engines are unmanaged.
- Contract:
  - `lease(name)` atomically starts (or adopts) the service and registers in-flight ownership; every synthesis/transcription/LLM call runs inside a lease. Release is the single idle-activity update.
  - Start is single-flight: `ensure_running(name)` and `lease(name)` run on the `ManagedServiceManager` serialized state owner (`pyutils/common/managed_service.py`, `init_serialized_owner`; busy tokens are mutated only by the owner), so concurrent callers (e.g. parallel qwen3tts lanes) share one start.
  - Busy protection is absolute: in-flight > 0 is never stopped or unloaded.
  - Single-active applies among servers of one category; a busy superseded peer is stopped right after its final lease is released.
  - Idle shutdown after `server_idle_shutdown_s` (default 180 s; 0 disables). Settings persist in `user_data.json` section `tts` (`server_auto_manage`, `server_single_active`, `server_idle_shutdown_s`, `server_enabled`); hot paths read the published settings snapshot.
  - Disabled engines reject new leases; with auto-management off a lease succeeds only for an already reachable server.
  - Runtime never builds venvs, pip-installs or downloads weights: a missing venv/weights means no start plus an installer-named reason.
- Code identity: `ServiceSpec.server_scripts` (launch script set, `tts_server_launch.server_scripts`) + `status_report` (lifecycle probe). Both present activates the contract: the manager injects `PYCORE_MANAGED_CODE_ID` (sha256 of the script set, `service_script_code_id`) into the launch env, the server echoes `code_id` in `/health` and `/status`, and a listener with a missing or different id is reclaimed (owned, adopted or foreign) unless busy; busy listeners convert on their next lease. `runtime_status` exposes `code_id`, `expected_code_id`, `code_stale`. Active today for qwen3tts (the only `service_status_capable` engine); script sets are declared for qwen3tts, chattts, fishspeech, f5tts, melotts and voxcpm2; cosyvoice and gptsovits run cloned repositories and stay off the contract.
- `_on_server_started/_on_server_stopped` clear the engine's availability cache; stopping any other TTS server asks qwen3tts to re-plan its batch (§7).
- Class-C launch env (`_isolated_env`): PYTHONPATH/PYTHONHOME stripped, `PYTHONNOUSERSITE=1` for self-contained venvs, `HF_HUB_DISABLE_XET=1` (setdefault), HF/Transformers offline flags, HF cache and `NLTK_DATA` from the shared cache. Servers bind loopback.
- ChatTTS: the installer owns `<chattts>/weights` and writes the model sentinel only after the asset set is complete; the server loads `source="custom"` from that directory before binding, `/health` reports `model_loaded`, inference is serialized; a missing model rejects the lease so the chain advances without a download. `external_server_ok` (a healthy external server counts as installed) applies to chattts only.

## 7. qwen3tts

Server: `pycore/tts_install_assets/qwen3tts_api_server.py` in its own venv (no pycore imports), modules `qwen3tts_synthesis.py`, `qwen3tts_queue.py`, `qwen3tts_gpu.py`, `qwen3tts_capabilities.py`, `qwen3tts_events.py`, `qwen3tts_web.py`. Client side: `pyutils/tts/qwen/` (`engine.py`, `client.py`, `events.py`, `live.py`, `weights.py`, `config.py`, `standalone_service.py`). Default bind `127.0.0.1:57210`.

- Endpoints: `GET /health` (lifecycle + `code_id` + `capacity_plan`), `GET /` (local web console), `GET /status` (runtime, GPU, queue, `chunked: true`, `speed`), `GET /capabilities`, `POST /synthesize`, `POST /synthesize_batch`, `POST /queue/submit`, `GET /queue/events`, `POST /queue/events/ack`, `POST /queue/cancel`, `GET /queue/result/{id}`, `POST /capacity/replan`, `/load`.
- Queue: process-local FIFO, not persisted (`QWEN3TTS_QUEUE_MAX` 16, `QWEN3TTS_QUEUE_RESULT_TTL_S` 900, `QWEN3TTS_QUEUE_RESULT_MAX` 200, job text limit `QWEN3TTS_JOB_MAX_CHARS` / `QWEN3TTS_JOB_TEXT_MAX_CHARS` 100000). Submissions are idempotent by `client_job_id`; pycore derives it from the Laravel task id + retry count, else a SHA-256 of text, language, format, speaker, instruction and speed. The client reconciles transient event-channel failures against the authoritative queue within the original synthesis deadline; callers recover from a server restart by resubmitting the same id. Status exposes `consumer_running`, running age and `stalled`; an unhealthy or stalled consumer is reclaimed.
- Capacity plan (`qwen3tts_gpu.build_capacity_plan`), computed after model load: `batch_size = min(memory_limit, compute_limit, profile_limit)` with `memory_limit = 1 + (free - reserve) // incremental` (reserve = max(512 MB, 8% of total); incremental 768 MB for 0.6B, 1536 MB for 1.7B), `compute_limit = SMs // per-item SMs` (6 for 0.6B, 12 for 1.7B), profile limit 16 (0.6B) / 8 (1.7B); CPU = 1; compute capability < 8 caps at 2; `QWEN3TTS_MAX_PARALLEL` caps further. `/status` `max_parallel` = `batch_size`.
- Re-plan: when the queue drains after work (`QwenQueue(on_idle=...)`, off the event loop) the server calls `torch.cuda.empty_cache()` and re-plans on current free VRAM (`source: runtime_replan`); `POST /capacity/replan` re-plans at once when idle and defers to the next drain when busy. pycore calls it whenever another managed TTS server stops.
- Worker fan-out: `TTSEngine.parallel_capacity()` (qwen3tts: `/status` `max_parallel`, refreshed once per drain cycle). The sentence lane cap (`laravel_audio_worker_engine._capacity_limit`) equals the reported native batch, capped at `MAX_CONCURRENCY` 8 (`tts_concurrency.py`); auto mode fills it exactly; a user-set concurrency still wins below it; with no report the lane's `CONCURRENCY_LIMIT` applies. A serial drain hands off to fan-out once concurrency > 1 and more than one task is queued.
- Synthesis: a single sentence-chunked pipeline. Every text is split by `tts_text_chunking.split_text` (shared sentence contract `config/sentence_segmentation_contract.json`): hard cap `QWEN3TTS_CHUNK_MAX_CHARS` (default 280, min 80), merge cap `SENTENCE_MERGE_RATIO` 0.85 of it; adjacent sentences merge only within the merge cap; a sentence over the hard cap is cut at clause/whitespace. Chunks of one job run through the native batch API in groups of `batch_size` and are concatenated in order with `QWEN3TTS_CHUNK_PAUSE_MS` (150) silence. Single-chunk jobs batch across jobs. Results carry `chunked: true`, `speaker`, `speaker_random`, `speed`.
- Speed: default `QWEN3TTS_DEFAULT_SPEED` 0.75 (`pyfoundations/network_constants.py`), env `QWEN3TTS_SPEED` overrides on both sides, request `speed` per job (clamped 0.25-3.0). Applied once to the final waveform by `librosa.effects.time_stretch`; speed does not shrink chunk budgets. `engine.effective_speed(rate)` forwards None so the server default applies; speed is part of the queue identity hash and of the sentence-audio cache key (`engine_policy.sentence_tts_cache_identity`, `sentence_audio_cache`).
- Languages (manifest and `qwen3tts_capabilities.LANGUAGE_NAMES`): en, zh, ja, ko, de, fr, ru, pt, es, it. Lease languages of a GPU node's sentence lane derive from the manifest.
- Speakers: explicit request or `QWEN3TTS_SPEAKER` pins; otherwise one speaker per job from the language's native pool intersected with the model's supported set (en: Ryan, Aiden; zh: Vivian, Serena, Uncle_Fu, Dylan, Eric; ja: Ono_Anna; ko: Sohee; other languages use the full set), chosen deterministically from `client_job_id`/`job_id` (random without an id). Variant previews use the ordered per-gender presets.
- Device launch (`tts_server_launch._qwen3tts_start_command`): explicit `QWEN3TTS_DEVICE` wins; otherwise opt-in reclaim, then the free-VRAM floor `QWEN3TTS_MIN_FREE_VRAM_MB` (800) minus the display reserve, else CPU. GPU launch pins `CUDA_VISIBLE_DEVICES` to the physical index (`QWEN3TTS_GPU_INDEX`), passes `QWEN3TTS_MODEL_VARIANT` and the memory fraction. Weights resolve only to the verified local directory (`qwen/weights.py`, `.model_installed` sentinel); installer `183_install_qwen3tts.sh` / `Step61_InstallQwen3Tts.ps1`.
- Startup prints `[api] QWEN3TTS_READY http://<host>:<port> (Web console: /)` after the port binds; `GET /` serves the local console (synthesis, GPU load, queue list, submit/cancel).
- Agent-history article audio: records carry `tts_chunked: true`; a record without the marker is rebuilt by the piggyback lane and re-uploaded through Laravel `article/worker/replace-audio` (details: `DESIGN_AGENT_HISTORY.md`).

## 8. kokoro

- Kokoro-82M via sherpa-onnx, in-process `SerializedModelEngine` (`pyutils/tts/kokoro_engine.py` over `sherpa_engine.py`), always on the CPU provider; GPU hosts may install `kokoro-multi-lang-v1_1`, CPU hosts `kokoro-int8-multi-lang-v1_1`. Model dir `KOKORO_TTS_MODEL_DIR`, else `<shared cache>/tts/kokoro`, else the sherpa dir; languages en, zh. Installer `145_install_kokoro.sh` / `Step57_InstallKokoro.ps1`.
- It is the word-batch engine in every mode and never competes with qwen3tts for the GPU. Batch path `pyutils/tts/batch/kokoro_batch.py`: words grouped, each group generated in one call on the kokoro worker under a managed lease (no idle unload mid-batch), mp3 encoded with 4 workers; no per-word fallback (a failed group fails its words); unsupported languages fail with `word_batch_language_unsupported`. `KOKORO_BATCH_MERGED=1` enables the merge-then-split variant. Progress feeds KokoroLive.

## 8a. Word-capable local servers (cosyvoice, fishspeech, voxcpm2, gptsovits, melotts)

- Each runs its heavy dependencies in its own venv (or container) as a class-C server; the main process holds only the HTTP client adapter. Ports: melotts 57212, voxcpm2 57214, gptsovits 9880 (`network_constants.py`).
- Shared long-text library (stdlib, no pycore imports): `tts_install_assets/tts_text_chunking.py` (`ChunkPolicy` owner/soft/hard limits, `max_chunks`, `max_attempts`, `pause_ms`, `total_deadline_s`; dot shielding for abbreviations/decimals/domains; sentence -> clause -> whitespace -> Unicode-safe cuts; `ChunkBudgetError`) and `tts_audio_assembly.py` (`generate_chunked`: per-chunk attempts, total deadline, cancellation at chunk boundaries, WAV validation, ordered concatenation; any failed chunk fails the whole task, no partial audio). Client-side helper `pyutils/tts/chunked_synthesis.py` (PCM frame concatenation, mismatched parameters fail) is used by cosyvoice and gptsovits; a single chunk goes straight through.
- voxcpm2: `voxcpm2_api_server.py` (`/health`, `/load`, `/synthesize`; model loaded once; server-side `generate_chunked`; prompt wav/text, cfg and timesteps passed through; PCM16 WAV out, mp3 converted in the main process). melotts: `_synthesize_guarded` splits only oversize input (native sentence split and speed are not applied twice). fishspeech: the bridge splits per chunk upstream (`split_text`) and concatenates WAV; the cloud SDK path sends one request. cosyvoice: PCM sample rate from `COSYVOICE_SAMPLE_RATE`, else model family (CosyVoice 300M 22050 Hz, CosyVoice2/3 24000 Hz).
- `tts_status.engine_chunked()` reports the manifest `chunk_capable` flag; per-task `chunked`/chunk counts are reported separately.
- Word audio delivery (`pyctl/tts/audio_resource_delivery.py`): `word_audio_service.upload_word_audio` passes through `data.status`, `message`, `http_status`; a `not_found` receipt (no dictionary row for lang/md5) or an md5-less `WORD_NOT_FOUND` rejection is terminal (logged once, completed), genuine failures raise and retry through the outbox.

## 9. Engine installs: venvs, Python ABIs, Docker

- Base interpreters: default Python 3.13 for pycore; dedicated 3.10 and 3.12 installed by `14_install_python310.sh` (`310|312|both`, own prefix, `make altinstall` semantics, `/usr/local/bin/python310|pip310` links) and `Step13_InstallPython310_312.ps1` (plus `Step64_InstallPython312.ps1`). Policy versions in `scripts/shells/ai_runtime_policy.env` (`AI_PYTHON_VERSION`, `AI_PYTHON310_VERSION`, `AI_PYTHON312_VERSION`).
- Engine spec (`pyutils/common/python_env/runtime_policy.py`): cosyvoice, gptsovits, melotts = 3.10 self-contained; fishspeech (`torch==2.8.0`, `torch_index_tag cu128`) and voxcpm2 = 3.12 self-contained; qwen3tts = 3.12 overlay; others run in the main interpreter. `resolve_engine_base_python`: `<ENGINE>_PYTHON` override -> registered base of the recommended version -> `pythonNNN_not_registered` (never falls back to the host 3.13).
- `isolated_venv.py` / `isolated_venv_runtime.py`: self-contained venvs are created by the resolved base (`-m venv`, no system site packages), keyed by engine + ABI; torch stack installed first by `_torch_stack_target` (§10); `_subprocess_env` sets `PIP_DEFAULT_TIMEOUT=120`, `PIP_RETRIES=10` (caller values win). Installers provision venvs (`tts_provision_isolated_venv` / `Invoke-IsolatedTtsVenvEnsure`); runtime only resolves them.
- Prerequisite manifest: `service_contract.json` `prerequisites.steps` (`id`, linux/windows scripts, `skip_env`, `mode` `neural|explicit|local_ai|""`, `full`), read by `prepare_pycore_prerequisites.sh`, `PycorePrerequisitesList.ps1` and `pyutils/common/prerequisite_steps.py`. gptsovits and melotts are explicit opt-in; neural engines follow `NEURAL_TTS_INSTALL` / `<ENGINE>_INSTALL` / `<ENGINE>_SKIP` / `--include`.
- Install method (cosyvoice, gptsovits, melotts, fishspeech: native | docker; voxcpm2: native only): `linux/common/install_method_common.sh` / `win_common/InstallMethodCommon.ps1`. First choice shows engine, backends, recommendation and source, and a 20 s monotonic countdown that commits the displayed item (Enter confirms, digits/arrows switch, B/Q cancels without writing); no TTY commits the default after the same 20 s; a single-backend engine persists without a countdown; a saved valid choice is reused silently. Keys (written only when changed): `TTS_<ENGINE>_INSTALL_METHOD`, `_INSTALL_METHOD_SOURCE` (`explicit|timeout_default`), `_INSTALL_METHOD_BACKENDS`, `TTS_<ENGINE>_BACKEND`. MeloTTS on Windows defaults to docker (official install.md recommendation); everything else defaults native.
- Docker branch (Linux): `docker_prereq_common.sh` `docker_prereq_ensure_for_engine` forces `START_DOCKER=true` in the global var store, records `TTS_DOCKER_BACKEND_ENGINES` and `TTS_DOCKER_TRIGGER=model_install`, and runs `79_install_docker.sh` (official deb822 APT source by os-release codename and dpkg arch; keyring, source, apt update, docker-ce, docker-ce-cli, containerd.io, buildx and compose plugins, daemon enable/start each converge independently; `--update` is the only upgrade path; `START_DOCKER=false` only skips and never stops a running Docker). Entries without step numbers: `ensure_docker_for_tts.sh`, `apply_tts_docker_for_engine.sh`.
- Compose assets: `scripts/shells/docker_compose/tts/<engine>/` (`Dockerfile` on `python:3.10-slim`, `compose.yml` with loopback ports, `restart: "no"` so the managed lifecycle owns start/stop, ownership labels; `compose.gpu.yml` NVIDIA device overlay; `model.sh` weights step). `tts_docker_compose_common.sh` `tts_docker_apply_engine` syncs assets by content, resolves the device (`<ENGINE>_DEVICE`, else nvidia-smi), skips `up` when the compose fingerprint matches a running container, and builds only project `pycore-tts-<engine>`. Containers mount `tts_server_common.py`, `pyfoundations` sources, `sentence_segmenter.py` and `service_contract.json`.
- Windows docker: `win_common/DockerWslBridge.ps1` provider `desktop_wsl2` (Docker Desktop, verified only) else `wsl_engine` (runs the same Linux chain inside the Debian WSL distro via `wsl.exe --distribution <d> --user root --exec bash <script>` with `wslpath` paths); a missing distro dispatches `Step30_InstallWSLDebian13.ps1`; a missing `wsl.exe` is reported (`Step29_InstallWSL.ps1` needs a reboot and is not triggered unattended). `Invoke-TtsDockerApply` mirrors the fingerprint skip.
- Hugging Face downloads funnel through `install_hf_repo_flat` (`tts_install_assets_common.sh`) / `Install-HfRepoFlat` (`TtsInstallAssetsCommon.ps1`): one catalog walk, resumable per-file downloads, token auto-discovery (env `HF_TOKEN`/`HUGGING_FACE_HUB_TOKEN`, every `.secret_keys/.secret_ignore/HF_TOKEN_<n>`, bare `HF_TOKEN` file) validated against `whoami-v2` and exported masked; `--location-trusted` keeps auth across the hf-mirror 308 redirect; a gated-repo preflight prints accept-license guidance and skips. Fish Speech default checkpoint `openaudio-s1-mini` (gated; `FISHSPEECH_CHECKPOINT=openaudio-s1` opts in); local mode launches the official `tools/api_server.py` when the checkpoint is present, else the bridge.
- Installers repair only missing parts: sentinels written after complete assets, size-verified weights, resumable downloads; every weight path resolves through `get_shared_download_cache_dir()` or the HF_HOME/HF_HUB_CACHE/TORCH_HOME exported by shell.

## 10. GPU/CPU toolchain

- One constant center `scripts/shells/ai_runtime_policy.env` (`AI_CUDA_TIERS='tag:min_cv:major:toolkit:driver'`, currently `cu130:1300:13:13.0.2:580.95.05`), mirrored by `linux/common/base_libs/cuda_index.sh`, `win_common/CudaIndex.ps1` + `AiRuntimePolicy.ps1`, and `pyfoundations/runtime_abi.py` (`cuda_tier_for_driver`). Adding a tier edits only the env file; all ends sort by min driver cv descending.
- Wheel rule (identical on all ends): explicit override (`<ENGINE>_DEVICE=cpu|cuda`, `CORE_CUDA_TAG`, `PYTORCH_CUDA_INDEX_URL`/`PADDLE_CUDA_INDEX_URL`) -> driver cv: highest tier with `min_cv <= cv` (engine-pinned tags need `cv >= wheel_tag_minimum_cv`, cu128 -> 1208) -> no cv but GPU hardware present: newest tier -> CPU wheels. Python `_torch_stack_target` reads the driver cv through `CUDADetector`, never host torch.
- `CUDA_VISIBLE_DEVICES=-1` hides the GPU in Python and in `lib_gpu.sh::gpu_hardware_present`. `CUDADetector` never reports CUDA from env vars alone.
- Linux driver: `11_cuda_nvidia_prereq.sh` upgrades a working driver below every tier through the NVIDIA repo with an apt pin (`NVIDIA_DRIVER_UPGRADE=0` disables); `install_cuda_toolkit.sh` is idempotent by ABI major. Windows `Step9_InstallCudaNvidiaPrereq.ps1` only warns (drivers are user-managed).
- Driver crash notice: `nvidia_driver_upgrade_notice_common.sh` / `NvidiaDriverUpgradeNoticeCommon.ps1` (kernel log Xid / WER nvcuda crashes), run by every torch/CUDA install, `NVIDIA_DRIVER_NOTICE_SKIP=1` skips; it never installs.
- pip resilience: `vpip` and `GlobalVars.ps1` set `PIP_DEFAULT_TIMEOUT=120`, `PIP_RETRIES=10`, `PIP_RESUME_RETRIES=10` when unset.
- Diagnostics: a pycore exit without `[ThreadBus] Shutdown requested` is a native crash (Windows: Event Viewer -> Windows Error Reporting; Linux: kernel log). `PYCORE_SHUTDOWN_TRACE=1` dumps the stack of graceful shutdowns.

## 11. Compute class per task type

Source: `config/queue_center_contract.json` `task_contract.task_types[].compute`. Laravel routes `gpu_preferred` rows to GPU nodes first; a `cpu_only` node gets them only while no online GPU node declares the lane + language; nothing is `gpu_required` today.

| Task type | Class | Engine on GPU / CPU node |
|---|---|---|
| word_audio | cpu_ok | kokoro / kokoro |
| sentence_audio | gpu_preferred | qwen3tts / kokoro |
| article_audio | gpu_preferred | qwen3tts (runs on CPU, slowly) |
| tts_synthesize | cpu_ok | edge -> kokoro / kokoro |
| stt, audio_transcribe, subtitle_search | gpu_preferred | faster-whisper (large on GPU, medium on CPU) |
| ocr_recognize | cpu_ok | cnocr (CPU) |
| prompt_translation | cpu_ok | cloud gateway, or translategemma:4b on Ollama on local-models-only nodes |
| other Laravel task types (word_translation, dictionary_explanation, poster, gemini/chatgpt, library_cover, word_validity, notebooklm) | cpu_ok | not GPU work |

The worker registration (`worker/registration.detect_compute_identity()`, nvidia-smi based) sends `compute_class`, `gpu_name`, `gpu_vram_mb` on register, heartbeat and pull; TPU runtimes register `cpu_only`.

## 12. Local-models-only policy

- Switch `pyfoundations/notebook_policy.local_models_only()`: true when `NOTEBOOK_PLATFORM` is colab|kaggle (exported by `notebook_runtime.sh`) or `PYCORE_LOCAL_MODELS_ONLY` is truthy on any host. Such a node never spends stored third-party keys or calls third-party AI/cloud services; it only offers its local models to the own server.
- Secrets: `secret_manager._secret_allowed` resolves only the client key (`client_key_auth.secret_key_base`, `CORE_NODE_CLIENT_KEY*`); every other secret, including OS env keys, resolves empty.
- Boot: every manifest entry with `cloud=True` is `blocked` with `model_local_models_only` (UI text in `PcAiHubLocales.ts`).
- Closed paths: AI balance checks return the coded reason; the TTS per-engine test refuses cloud engines; edge synth and probes are gated in the client; googletrans translators raise and the worker chain skips google; Fish Audio cloud key reader returns nothing and the server gets `FISH_API_KEY` cleared; the startup AI probe is skipped.
- Text generation: `ai_gateway.generate_text` routes to the local LLM orchestrator (ollama -> lmstudio -> llamacpp) with each engine's default model.

## 13. Local AI translation (Ollama + TranslateGemma)

- Contract `service_contract.json` `local_ai`: `install_env=PYCORE_LOCAL_AI_INSTALL`, `ollama_port=11434`, `ollama_models_subdir=ollama/models`, `translate_model=translategemma:4b`, `ollama_num_parallel_env=OLLAMA_NUM_PARALLEL`, `ollama_num_parallel={gpu: 4, cpu: 1}`. Readers: shell `sc_get`, PowerShell `Get-ServiceContractValue`, Python `service_contract.value`.
- Installers (idempotent; keep binary and model, pull resumable): `117_install_ollama.sh` (official `install.sh`, temporary `ollama serve` when none answers, `ollama pull`), `Step66_InstallOllama.ps1` (`winget install Ollama.Ollama`, same serve/pull). Model store `OLLAMA_MODELS`, else `<shared cache>/ollama/models`; a running system Ollama keeps its own store. The temporary serve gets `OLLAMA_NUM_PARALLEL` from the contract by GPU presence unless exported.
- Prerequisite `ollama` (mode `local_ai`, `OLLAMA_SKIP=1`) runs only with `PYCORE_LOCAL_AI_INSTALL=1` or an explicit include (`./pyservice.sh --only -- --include ollama`, `.\pyservice.ps1 -Only -InstallInclude ollama`); notebook hosts set it to 1 by default.
- pycore: `pyutils/llm/llm_engines.py` reads port/model from the contract; ollama's default model is the translate model; `ollama_start_command()` returns `(cwd, argv, env)` with `OLLAMA_MODELS`, `OLLAMA_HOST` and `OLLAMA_NUM_PARALLEL` (`ollama_num_parallel()`: env, else contract value by `gpu_present()`). Ollama finds CUDA by itself.
- Translator `pyctl/translation/local_ai_translator.py` (provider `local_ai`): TranslateGemma prompt template, `zh` -> `zh-Hans`, auto source guessed by script, `llm_orchestrator.chat(engine="ollama", model=translate_model, temperature=0)`; `unavailable_reason()`, `translate()`, `translate_many()` (one request per line, `ollama_num_parallel()` at a time via `map_bus_tasks`, order kept, `''` per failed line).
- Gateway: `pyctl/assist/task_capability_chains.py` default chain `google -> local_ai -> ecdict -> wordnet -> ai`; on local-models-only nodes `local_ai` first and never google. `manual_translation_service` (`translate_single`, `translate_batch`, `translate_ai`) answers from local AI there with `provider: local_ai`; `status()` reports `local_ai` availability and whether it is the default. `ai_batch_translate.translate_chunk` uses local AI line by line there. `prompt_translate.translate_prompt` on those nodes calls `local_ai_translator.translate(masked, "en", src)` (`english` = `cleaned`, no variants, code masking kept).
- Task contract: pycore claims `prompt_translation` (payload `text`, `source_lang`, `prompt_id`, `want_audio`; result `english`, `cleaned`, `variants`, `detected_language`, `audio_base64`); `word_translation` is Chrome-claimed.

## 14. Verification

```bash
cd /www/programing/core_node
python3 -c "import json;d=json.load(open('config/service_contract.json'));print(d['tts_runtime_plan']);print(d['local_ai'])"
python3 -m py_compile pycore/tts_install_assets/*.py
# boot verdicts and engine panels (no model needed)
python3 -c "import pycore.pyctl.ai_hub.boot_service as b; print(len(b.verify_all()))"
# live qwen3tts plan and fan-out input
curl -s http://127.0.0.1:57210/status | python3 -m json.tool | grep -E '"(batch_size|max_parallel|source|code_id|chunked)"'
curl -s -X POST http://127.0.0.1:57210/capacity/replan
```

Windows memory pressure (manual): under low commit headroom the lane log shows `lane paused: ...` then `host memory recovered`, and the page-file peak stays bounded.

## 15. Open items

- Not run end to end on a real Colab/Kaggle VM: Ollama install, pull and translation; Ollama has not been exercised on a GPU host.
- Display-GPU headroom is not verified on a real NVIDIA desktop host; in-process engines (parler, bark, faster-whisper) and Ollama are not capped by `PYCORE_GPU_MEMORY_FRACTION`.
- General AI prompts on local-models-only nodes use TranslateGemma (translation-specialized); a general local model can be added to `local_ai` when needed.
- NLLB-200/Qwen2.5 installers (`111_install_nllb200.sh`, `109_install_qwen25.sh`) exist but are not wired into pycore.
- qwen3tts compute heuristic (`multiprocessors_per_item` 12 for 1.7B) is uncalibrated; on 8 GB / 24-SM GPUs it binds the batch at 2 (0.6B would plan 4).
- article_audio uses qwen3tts even on CPU-only hosts and runs serially inside the word lane, which can delay word batches.
- Docker: the server-stack generators (`83_docker-compose-finish.sh`, `rebuild_docker_compose.sh`, `/usr/local/.pcore_local/deploy`) are not refactored onto the shared generate/apply functions; TTS images have not been built or started (`docker compose up --build` not run); voxcpm2 offers native only although compose assets exist.
- Code docstrings (`tts_service_manager.py`, `qwen3tts_api_server.py`, `managed_service.py`) cite `development-guides/cross-docs/TTS_STT_ENGINE_LIFECYCLE_AND_CONCURRENCY.md`, which does not exist; `qwen3tts_api_server.py` docstring still says slower speeds shrink the chunk budget and that the service accepts one active job, which the code no longer does.
- `scripts/pytools/aitools/qwen3tts_batch.py` keeps its own GPU snapshot.
