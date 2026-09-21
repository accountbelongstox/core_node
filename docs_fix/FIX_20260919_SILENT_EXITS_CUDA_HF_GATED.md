# Silent Process Exits — CUDA Native Crashes, In-Process torch Isolation, HF Gated Downloads

Date: 2026-09-19

Status: Fixed and verified (installer Step56 re-run clean; pycore bootstrap no
longer loads torch/ctranslate2 native DLLs; HF catalog listing works through
308 redirects; gated repos are detected with actionable guidance).

## Incident

The pycore console (merged ColorPrint log: `[tts]`, `[laravel]`, `[qwen3tts]`,
`[Relay]`) stopped with no shutdown lines and no error — "exited for no
reason, no message". Around the same window:

- `POST /queue/submit -> 429` (qwen3tts queue saturated)
- `POST /api/worker/tasks/word_audio/result -> ERR (18843ms) _ssl.c:1015:
  The handshake operation timed out` (uploads to https://api.si.12gm.com,
  public 43.163.112.77 — network/remote-side, handled + retried by the
  durable outbox; NOT a crash cause)
- Step56 fishspeech checkpoint download failed: huggingface.co 401,
  hf-mirror.com 308 Permanent Redirect not followed

## Evidence (Windows Error Reporting, Application log)

Every graceful pycore exit prints at least `[ThreadBus] Shutdown requested:
reason=...` (`pycore/pyfoundations/thread_bus/shutdown_stack.py:189`). None
appeared -> abnormal termination. WER confirmed native hard crashes:

| When | Module | Process |
|---|---|---|
| 09-19 15:38 | nvcuda64.dll (c0000005) | python 3.13 (pycore main / qwen3tts venv) |
| 09-18 repeatedly | torch_cpu.dll (c0000005) | python 3.13 (crash loop) |
| 09-19 all day | php8ts.dll (c0000005) | php.exe -> laravel_main NSSM service crash-loop |
| 09-19 repeatedly | hf_xet.pyd (BEX64 c0000409) | python 3.12 isolated venvs (HF downloads) |

Native crashes bypass Python/PHP exception handling entirely: no traceback, no
shutdown log, the process just disappears. Only WER records them. Diagnostic
rule: if the console shows no `[ThreadBus] Shutdown requested`, check Event
Viewer -> Application -> Windows Error Reporting. `PYCORE_SHUTDOWN_TRACE=1`
dumps the requesting stack for graceful shutdowns.

## Root causes and fixes

### 1. pycore main process loaded torch/CUDA native code in-process

`import pycore.pyutils.tts.memory_gate` dragged torch into the service process
through THREE eager paths; a faulting NVIDIA driver (nvcuda64.dll) or torch
binary (torch_cpu.dll) then killed the whole service silently:

- `memory_gate._free_vram_bytes()` called `torch.cuda.mem_get_info()`
  in-process (initializes the CUDA driver).
- `model_tiers.py` top-level `import ctranslate2` -> transformers -> torch.
- `third_party/_torch_cuda.py` top-level `import torch` (pulled into every
  process via `third_party/api.py`).

Fixes:
- `pycore/pyutils/tts/memory_gate.py` — `_free_vram_bytes()` now queries
  `nvidia-smi --query-gpu=memory.free --format=csv,noheader,nounits` in a
  SUBPROCESS (max free across GPUs; a model tier loads onto one device).
- `pycore/pyutils/common/model_tiers.py` — ctranslate2 import moved into
  `_faster_whisper_gpu_usable()` (lazy).
- `pycore/pyfoundations/third_party/_torch_cuda.py` — top-level torch import
  replaced by `_torch_module()` lazy getter (install-time guards only).

Verified: after `import pycore.pyutils.tts.memory_gate`, neither `torch` nor
`ctranslate2` is in `sys.modules`; VRAM reading correct (3.6 GiB free);
gates behave (parler RAM-masked, bark VRAM-masked, kokoro/unlisted engines
pass). The install-time guard `_ensure_torch_cpu_build_when_no_gpu()` still
works (lazy import).

### 2. fishspeech checkpoint download broken (Step56)

Two layers:

- hf-mirror.com 308-redirects the HF tree APIs to huggingface.co; Windows
  PowerShell 5.1 `Invoke-RestMethod` does NOT follow 308 -> catalog listing
  failed on both bases ("could not list repo files").
  Fix: `scripts/shells/win/win_common/TtsInstallAssetsCommon.ps1` — new
  `Invoke-HfRestGet()` uses curl.exe `-fsSL` (already a hard dependency of
  the download path) for both catalog requests.
- `fishaudio/openaudio-s1` AND `fishaudio/openaudio-s1-mini` (-> s1-mini) are
  both `"gated":"auto"`: anonymous file downloads 401 on every file. No
  public fishaudio checkpoint exists.
  Fixes:
  - Default checkpoint is now `openaudio-s1-mini` on both tiers
    (`pycore/tts_install_assets/tts_model_tiers.py` TIER_TABLE +
    `fishspeech_checkpoint()`); openaudio-s1 remains via explicit
    `FISHSPEECH_CHECKPOINT=openaudio-s1`. Doc strings updated
    (`fishspeech_engine.py`, `pyctl/capabilities.py`, ENGINE_NOTES).
  - `Install-HfRepoFlat()` gained a gated-repo preflight: one HEAD probe on
    the first wanted file; on HTTP 401/403 it prints exactly what to do
    (accept the license at the repo page, set HF_TOKEN) and skips instead of
    spamming one bare curl error per file.

Verified: Step56 re-run lists the catalog (7 files, 5 allow-listed), detects
the gate, exits 0 with guidance; idempotent resume contract unchanged.

### 3. hf_xet.pyd BEX64 crashes during HF downloads

`pycore/pyutils/tts/tts_service_manager.py::_isolated_env` now sets
`HF_HUB_DISABLE_XET=1` (setdefault — explicit opt-out wins) for all class-C
engine servers, so huggingface_hub downloads use plain HTTP chunks.

### 4. php8ts.dll crashes -> laravel_main service crash-loop

`.data/logs/laravel_main.service.out.log`: every launch died at
`poly_apps/laravel_main/scripts/start.ps1:270` ("Secure runtime value
generation failed: app-key") because the `php -r` subprocess crashed natively
(php8ts.dll c0000005, repeatedly all day); NSSM restarted it silently.
Interactive `php -r` works, so this is the service-context PHP (php.ini
extensions / TS build). NOT related to the pycore exit. Open item: repair the
PHP installation (extension mismatch / OPCache), then `Restart-Service`
laravel_main.

## Remaining manual actions

- Upgrade the NVIDIA driver (current 32.0.16.1074; nvcuda64.dll c0000005 is a
  driver-layer fault). Shared common
  `win_common/NvidiaDriverUpgradeNoticeCommon.ps1` ->
  `Invoke-NvidiaDriverUpgradeNotice` watches WER for nvcuda crashes and prints
  upgrade guidance (idempotent: skips without GPU, re-prompts only on new
  crashes or a driver version change). It is a library function, not an
  installer step: wired into `TorchCudaInstallCommon.ps1`
  (`Install-PycoreTorchStack`) so every torch/CUDA install runs it; any other
  script can dot-source and call it the same way.
- For fishspeech local weights: accept the license at
  https://huggingface.co/fishaudio/openaudio-s1-mini, then set HF_TOKEN.

## Follow-up 2026-09-19 — HF token auto-discovery (gated download unblocked)

The license for `fishaudio/openaudio-s1-mini` has been granted ("You have been
granted access to this model"), so the remaining blocker was auth plumbing.

- `TtsInstallAssetsCommon.ps1` now auto-discovers EVERY
  `.secret_keys/.secret_ignore/HF_TOKEN_<index>` (numeric order, not capped at
  5) plus env `HF_TOKEN` / `HUGGING_FACE_HUB_TOKEN` and the bare `HF_TOKEN`
  file, validates each `hf_*` candidate against
  `https://huggingface.co/api/whoami-v2`, and uses the FIRST usable one
  (rejected 401/403 candidates fall through to the next; an unverifiable
  network probe accepts the candidate with a warning). The pick is printed
  once, masked (`[hf] HF auth: using HF_TOKEN_1 (...xxxx); whoami OK`), and
  exported to `$env:HF_TOKEN` so child processes (pip, huggingface_hub,
  fish-speech) inherit it.
- `Get-HfRequestHeaders()` consumes the validated token, so the catalog
  requests, the gated preflight HEAD probe, and the resumable curl downloads
  in `Install-HfRepoFlat()` are all authenticated.
- The gated preflight message now names the token source when a configured
  token lacks access, and points at the `.secret_keys` path when anonymous.
- Mirror auth fix: hf-mirror.com 308-redirects repo API/resolve URLs to
  huggingface.co, and plain curl `-L` drops the `Authorization` header on the
  cross-host redirect (verified: mirror `-L` -> 401, mirror
  `--location-trusted` -> 200, hf.co direct -> 200). All three authenticated
  curl call sites in `TtsInstallAssetsCommon.ps1` (`Invoke-HfRestGet`, the
  gated preflight HEAD probe, `Invoke-HfFileDownloadResumable`) now use
  `--location-trusted` when a token is present.

Verified: Step56 -Full run resolved `HF_TOKEN_1` via whoami, listed the gated
catalog, passed the preflight, and completed the resumable download —
`[OK] checkpoint ready at D:\www\cache\pycore\fishspeech\checkpoints\
openaudio-s1-mini (3,606,222,702 bytes); local inference mode enabled`.
- Python side already had the convention: `pyfoundations.secret_manager.
  get_all_secret_keys_indexed("HF_TOKEN")` + the `huggingface` provider entry
  in `pycore/pyctl/ai/ai_keys.py` (rotation pool), and
  `scripts/pytools/aitools/hf_secret.py` (first-non-empty). No change needed.

## Follow-up 2026-09-19 — Linux port (Debian 13 trixie / Ubuntu 26.04)

The same three changes are now mirrored into the Linux shell stack; all HF
downloads funnel through the single choke point
`scripts/shells/linux/common/tts_install_assets_common.sh`
(`install_hf_repo_flat`, used by fishspeech/qwen3tts/voxcpm2/bark/parler/
chattts/gptsovits/qwen25/nllb200/deepseek installers), so one fix covers every
engine.

- HF token auto-discovery: `resolve_hf_auth_token()` walks env
  `HF_TOKEN`/`HUGGING_FACE_HUB_TOKEN` -> EVERY
  `.secret_keys/.secret_ignore/HF_TOKEN_<index>` (numeric order, uncapped) ->
  bare `HF_TOKEN` file, validates each `hf_*` candidate against whoami-v2
  (401/403 falls through), prints the masked pick once
  (`[hf] HF auth: using HF_TOKEN_1 (...xxxx); whoami OK`), and exports
  `HF_TOKEN` for child processes. Per-process cache, same as Windows.
- Mirror auth fix: `_hf_curl_auth_setup()` switches the authenticated curls
  (size HEAD probe, gated preflight HEAD, resumable download) from `-L` to
  `--location-trusted` so the hf-mirror 308 to huggingface.co keeps the
  `Authorization` header. The urllib catalog walker (`_hf_repo_catalog`) sends
  the token itself and gained an `http_error_308` handler (urllib forwards
  request headers across redirects; stock urllib does not follow 308 on the
  older dedicated 3.10 runtime — Debian 13's 3.13 / Ubuntu 26.04's 3.13+ are
  covered either way).
- Gated-repo preflight in `install_hf_repo_flat()`: one HEAD probe on the
  first allow-listed file; on 401/403 it prints the accept-license guidance
  (naming the token source when a configured token lacks access) and returns
  instead of spamming one curl error per file.
- NVIDIA driver upgrade notice: new
  `scripts/shells/linux/common/nvidia_driver_upgrade_notice_common.sh` ->
  `nvidia_driver_upgrade_notice()`, the Linux counterpart of
  `NvidiaDriverUpgradeNoticeCommon.ps1`. Crash evidence comes from the kernel
  log (`journalctl -k --since "14 days ago"`, dmesg fallback) matching
  `NVRM: Xid` / nvidia+libcuda segfault lines; idempotency marker
  (`driver=...;crash=...`) lives in the shared global-var store
  (`NVIDIA_DRIVER_UPGRADE_NOTICE`). Wired into `install_pycore_torch_stack()`
  in `torch_cuda_install.sh` so every torch/CUDA install runs it; skip switch
  `NVIDIA_DRIVER_NOTICE_SKIP=1`. It never installs anything.
- Verified: `bash -n` clean on all three touched/new scripts. Runtime
  verification belongs to the next Linux installer run (Step143 fishspeech
  checkpoint download exercises the whole chain).
