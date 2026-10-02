# BACKLOG 2026-10-02 — Open items and constraints carried from retired docs_fix documents

Source: docs_fix audit 2026-10-02. Each item names the retired source document. Relay/transport items live in `DESIGN_RELAY.md` and `DESIGN_TRANSPORT_PLANE.md`.

## Durable constraints

- Laravel: no lock-less `Cache::flexible` on request paths (FIX_20260814_0038). Still violated at `AppQyV1LangDictionaryModel.php:1148` and `:1215`.
- Laravel agent-history submit (FIX_20260820_2208): never a random UUID when an `idempotency_key` is present; minimum-step progression; marker and outbox written in one locked transaction; `tts_chunked` is the only completion marker; deterministic `<article_id>.mp3`; keep the PostgreSQL unique keys.
- Machine data sync (FIX_20260815): the receiver is globally exclusive (rejects inbound sync while sending); 502/503/504 are retryable; recovery stages a pending JSON copy; manifest summaries are aggregate-only.
- Never test a remote peer via loopback/LAN (REQUIREMENTS_20260927_MACHINE_DATA_SYNC_REFACTOR rule #12).
- Before creating a file, run `git check-ignore` on its path (FIX_20261001_DELIVERY_BATCH_IGNORED_SOURCES).
- New CUDA tiers are added only in `ai_runtime_policy.env`; driver-590 needs a reboot gate, then rerun `183_install_qwen3tts` (DESIGN_20260921_GPU_CPU_UNIFIED_TOOLCHAIN).

## Open items by area

### Infra / shell
- debian-gpu: pull and rerun 175/Step175; run Windows Step2, then set `WINDOWS_RTC_UTC=1` (FIX_20260929_2052_GPU_BLACKSCREEN).
- Every Linux host: rerun `175 --domains-only`; explain the 30.9 s server delay from laravel.log (FIX_20261001_DELIVERY_BATCH).
- GPU VRAM sharing never run on a real NVIDIA host; parler/bark/faster-whisper and Ollama have no VRAM cap (FIX_20260930_GPU_DISPLAY_VRAM_SHARING).
- Resource watchdog: restart via `scripts/services/resource_watchdog.sh`; memory sizing still open (RESOURCE_WATCHDOG_FRANKENPHP_FREEZE).
- TTS Docker: real `docker compose up --build` never run; legacy 83/99 deploy generator refactor deferred (TTS_DOCKER_INSTALL_METHOD_DEVELOPMENT_PROGRESS).
- Claude team: live tmux readiness wait and a real `claudeteamup.ps1 -Status` run not done (TASK_20260928_PRIOR_WORKFLOW_COMPLETION).

### pycore / agent history
- Runtime smoke test on Windows slot roots (`D:\programing\Users`, `D:\.tmp\Users`); `php -l RelayDeviceService.php` (DESIGN_20260919_AGENT_HISTORY_..._PROGRESS).
- Prompt-derive service: no end-to-end run on a Linux host (PROGRESS_20260920_PROMPT_DERIVE_EN).
- LAN phone access: pair the phone to a scoped K3 key (DESIGN_20261001_CLIENT_KEY_DEVICE_IDENTITY §4.1) or add a default-off unsigned LAN read policy for `api/status` and the audio_orch resource lookup/chunk routes in `local_rpc_guard` (TODO_20261001_PYCORE_LAN_PHONE_ACCESS).

### Team board leftovers (re-check against PROGRESS_20261001_PYCORE_REFACTOR)
- O2 W5 audio contract, O3 Queue Center machine auth (now client-key auth), PY1 shared deliver-to-Laravel layer, PY5 audio-orchestration acceptance (TASK_20260927_CLAUDE_TEAM_BOARD).
