# Unified GPU/CPU Toolchain Refactor (Python / CUDA / Driver / Model Constants)

Date: 2026-09-21
Scope: multi-Python host (3.13 host venv, 3.12, 3.10), NVIDIA driver + CUDA toolkit,
GPU/CPU wheel selection, model constant center, and all callers across Linux shell,
Windows PowerShell, and pycore Python.

## 1. Root causes fixed

1. **Wrong device probe for engine venvs.** `isolated_venv.py` decided the torch
   wheel flavor by importing torch from the HOST venv. Host torch was 2.14.0+cu130
   while the loaded driver (550) only supports CUDA 12.4, so the probe returned
   False and every auto engine silently installed CPU wheels on a GPU machine
   (observed: voxcpm2 installed torch+cpu).
2. **Policy gap.** `ai_runtime_policy.env` `AI_CUDA_TIERS` had a single tier
   (cu130 / min driver cv 1300 / driver 580.95.05). A working but older driver
   (cv=1204) matched nothing and script 11 never upgraded a "working but too old"
   driver.
3. **pip fragility on slow links.** pip's 15s read timeout aborted 500MB-2GB
   wheels (torch, nvidia_cudnn_cuXX, paddlepaddle-gpu) whenever two installers
   shared the link; downloads restarted from zero.
4. **CRLF/BOM class bugs on the shared NTFS tree** (`/www` = Windows `D:`):
   - Windows-written sentinel files carry BOM+CRLF (fixed earlier via
     `_hf_read_sentinel`).
   - `pycore/tts_install_assets/chattts_model_files.txt` had CRLF endings;
     `read -r` kept the `\r`, so every `-s "$path\r"` check failed and the
     ChatTTS readiness contract could never pass.

## 2. Architecture: one constant center, three mirrors

```
scripts/shells/ai_runtime_policy.env            <- single source of truth
   AI_CUDA_TIERS='cu130:1300:13:13.0.2:580.95.05'  (tag:min_cv:major:toolkit:driver)
        |
        +-- Linux   scripts/shells/linux/common/base_libs/cuda_index.sh
        |           cuda_policy_tag / cuda_policy_newest_row /
        |           cuda_policy_driver_below_tiers / torch_cuda_index_url / ...
        |
        +-- Windows scripts/shells/win/win_common/CudaIndex.ps1
        |           Get-CudaRuntimePolicy / Get-AiCudaNewestTier /
        |           Test-CudaDriverBelowTiers (+ AiRuntimePolicy.ps1 tier table)
        |
        +-- Python  pycore/pyfoundations/runtime_abi.py (cuda_tier_for_driver)
                    +-> pycore/pyutils/common/python_env/isolated_venv.py
                        _torch_stack_target (per-engine venv torch stack)
        |
        v  consumers
   torch/paddle cpu guards, 11 / Step9 driver prereq, 15 / Step10 python deps,
   all engine install scripts (105..183 / StepXX)
```

### Unified decision rule (identical semantics on all three ends)

1. Explicit override wins: `<ENGINE>_DEVICE=cpu|cuda`, `CORE_CUDA_TAG`,
   `PYTORCH_CUDA_INDEX_URL` / `PADDLE_CUDA_INDEX_URL` tag.
2. Driver cv available -> highest tier whose `min_cv <= cv` (engine-pinned tags
   like fishspeech cu128 require `cv >= wheel_tag_minimum_cv`, cu128 -> 1208).
3. No cv report but GPU hardware present (driver absent or pre-reboot) ->
   preload the newest policy tier so installers still fetch CUDA wheels.
4. Otherwise -> CPU wheels.

## 3. Files changed

### Python (cross-OS, single codebase)

- `pycore/pyutils/common/python_env/isolated_venv.py`
  - Removed `_host_cuda_available` host-venv probe.
  - New `_driver_cuda_cv()` (via `CUDADetector.get_cuda_info()['cuda_version']`,
    same source as shell `cuda_driver_cv`).
  - New `_wheel_tag_minimum_cv()` (cu128 -> 1208; `digits//10*100 + digits%10`).
  - Rewrote `_torch_stack_target` implementing the rule chain above.
- `pycore/pyutils/common/python_env/isolated_venv_runtime.py`
  - `_subprocess_env` injects `PIP_DEFAULT_TIMEOUT=120`, `PIP_RETRIES=10`
    (setdefault; caller values win).

### Linux shell

- `scripts/shells/ai_runtime_policy.env` — added `AI_PYTHON312_VERSION`;
  3.10/3.12 selection is pinned per engine spec, not globally.
- `scripts/shells/linux/common/base_libs/cuda_index.sh`
  - `cuda_policy_newest_row()` (highest min-cv row; mirrors runtime_abi sorting).
  - `cuda_policy_driver_below_tiers()` (cv present but below every tier -> true).
  - `cuda_policy_tag` no-cv + hardware -> newest/requested tier (preload).
- `scripts/shells/linux/common/base_libs/pip_lock.sh`
  - `vpip` wraps commands with `PIP_DEFAULT_TIMEOUT=120`, `PIP_RETRIES=10`,
    `PIP_RESUME_RETRIES=10` (byte-offset resume; pip < 24 ignores unknown env).
- `scripts/shells/linux/common/tts_install_assets_common.sh`
  - `neural_tts_local_weights_ready` strips `\r` from manifest lines.
- `scripts/shells/linux/debian/install_shells/11_cuda_nvidia_prereq.sh`
  - New driver-upgrade branch: NVIDIA official repo (cuda-keyring) + dynamic apt
    pin `/etc/apt/preferences.d/nvidia-cuda-repo-pin` (version glob 1000,
    origin 600, fallback 100; unqualified globs need `:i386` variants from
    `dpkg --print-foreign-architectures`; note `libnvcuvid1`/`libnvoptix1` do
    NOT contain the substring "nvidia").
  - `cnp_pick_driver_version` picks the newest version of the OLDEST branch
    satisfying >= target (580.95.05).
  - Installs `nvidia-driver-cuda` (nvidia-smi lives there in 590 packaging;
    the `nvidia-smi` package is a transitional dummy).
  - Never uses `nvidia-detect` when a >= target driver is already installed
    (conflicts with nvidia-kernel-support); pending-reboot branch instead.
  - Kill switch: `NVIDIA_DRIVER_UPGRADE=0`.
- `scripts/shells/linux/common/install_cuda_toolkit.sh`
  - Idempotency by ABI major (`release (13)\.`), minor floats.
  - `cti_find_nvcc`: canonical home -> /usr/local/cuda symlink -> cuda-<major>.* glob.
  - Path A candidates `cuda-toolkit-13-0` -> `cuda-toolkit-13` (repo has 13-1..13-4).
  - Path B runfile uses `env -u DISPLAY -u XAUTHORITY` (makeself self-reenters
    xterm GUI mode and hangs when DISPLAY is set).

### Windows PowerShell (mirrors)

- `win_common/CudaIndex.ps1` — no-cv + GPU -> preload newest/requested tier,
  `Enabled = gpuPresent && tier`; new `Test-CudaDriverBelowTiers`.
- `win_common/AiRuntimePolicy.ps1` — new `Get-AiCudaNewestTier`.
- `win_common/GlobalVars.ps1` — pip resilience env defaults
  (`PIP_DEFAULT_TIMEOUT/PIP_RETRIES/PIP_RESUME_RETRIES`, only when unset).
- `install_powershells/Step9_InstallCudaNvidiaPrereq.ps1` — below-tier driver
  prints manual upgrade warning (Windows drivers are user-managed).
- `win_common/TtsInstallAssetsCommon.ps1` — needs no CRLF fix
  (`Get-Content` strips CR).

### Data files

- `pycore/tts_install_assets/chattts_model_files.txt` — normalized CRLF -> LF.

## 4. System state (this machine: Debian 13, RTX 4060 Laptop 8GB)

- nvidia-driver 590.48.01-1 installed (DKMS + initramfs done). Pre-reboot
  `nvidia-smi` reports "NVML library version: 590.48 / mismatch" — EXPECTED,
  kernel still runs 550. After ONE reboot: cv=1300, `torch.cuda.is_available()`
  True, GPU chain live; no venv reinstall needed.
- CUDA toolkit 13.4.92 via apt (`cuda-toolkit-13`), `/usr/local/cuda/bin/nvcc`.
- Host venv: torch 2.14.0+cu130, paddlepaddle-gpu cu130.
- voxcpm2 venv: torch/torchaudio/torchcodec +cu130.
- Pre-reboot `torch.cuda.is_available()=False` shows CUDA Error 804
  (forward compatibility on non-supported HW) — the designed reboot gate.
- Windows side shares the same flat cache layout (`/www/www/cache/pycore/*` ==
  `D:\www\cache\pycore\*`); hub<->flat materialization works both directions
  with zero network when a complete snapshot exists.

## 5. Verification

Method: direct logic probes (seconds) instead of waiting on full end-to-end
installer downloads.

- PowerShell: 4 edited files pass AST parse; 6-scenario matrix on the real
  `Get-CudaRuntimePolicy` body (mocked cv/GPU): no-cv+GPU -> cu130 preload;
  cv=1204 -> CPU + BelowTiers; cv=1300 -> cu130; no-GPU -> CPU; explicit tag
  via env and via index URL both honored.
- Shell: 4 scenarios with stubbed nvidia-smi (cv=1300 / cv=1204+below_tiers /
  NVML fail + hardware -> cu130 / no GPU -> CPU).
- Python: 7 scenarios for `_torch_stack_target` (cv=1204 -> CPU both;
  cv=1300 -> cu130 / pinned cu128; no-cv+hardware -> cu130; DEVICE=cpu/cuda
  overrides; pip env injection confirmed).
- Real installer runs (logs in `/tmp/verify_chain/`): 20 of 21 target scripts
  pass (129,141,145,151,13,14,15,105,107,109,111,127,147,131,133,135,137,143;
  139 melotts opt-in skip by design). 183 qwen3tts is blocked only by the
  reboot gate (SoX dependency fixed); rerun it after reboot.

## 6. Operational notes

- **Reboot once** to load driver 590. Then rerun `183_install_qwen3tts.sh`.
- Env switches: `NVIDIA_DRIVER_UPGRADE=0` (skip driver upgrade branch),
  `NVIDIA_DRIVER_NOTICE_SKIP=1` (Windows crash-notice),
  `NEURAL_TTS_INSTALL=1` / per-engine opt-ins.
- All installers are idempotent: sentinels + size-verified weights, interrupted
  downloads resume (pip `PIP_RESUME_RETRIES`, curl `-C -`).
- When adding a CUDA tier, edit ONLY `ai_runtime_policy.env`; all three ends
  sort tiers by min driver cv descending.
