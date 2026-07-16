# CUDA stack alignment: isolate ctranslate2 (cu12) from paddle/torch (cu13)

## Root cause (verified)
- One system Python (`D:\.dev_win10\python313`, `$Global:PYTHON_VERSION=3.13`) hosts BOTH:
  - paddlepaddle-gpu 3.3.0 = CUDA-13 (pins bare `nvidia-cublas`, `nvidia-cudnn-cu13`, `nvidia-cuda-runtime`) via Step10.
  - faster-whisper + ctranslate2 4.8.1 = CUDA-12 (Step11 installs `nvidia-cublas-cu12` + `nvidia-cudnn-cu12==9.*` for CTranslate2).
- cu12 and cu13 nvidia packages share `nvidia\cudnn\bin\` and `nvidia\cublas\bin\` and clobber each other's DLLs (both RECORD-claim `cudnn_cnn64_9.dll`). `import paddle` / `import torch` then hit `WinError 127` (procedure not found = CUDA-runtime major mismatch). The installed `nvidia-cudnn-cu12 9.24.0.43` is exactly Step11's `==9.*` spec — NOT an upgrade orphan.
- In-process conflict: pycore's video-extract STT imports ctranslate2 (cu12) while the same process uses torch (cu13) for OCR. One `cudnn_cnn64_9.dll` per process → can't host both majors → isolation requires a separate PROCESS (venv), not just a separate site-packages.

## Strategy (chosen: keep cu13, isolate ctranslate2 in a venv)
- System Python (py313) → cu13-only: paddlepaddle-gpu + torch (cu130). glm-coding-helper backend (paddle) works.
- faster-whisper + ctranslate2 + cu12 nvidia libs → dedicated cu12 venv.
- pycore video-extract STT (the ONLY ctranslate2 consumer) runs ctranslate2 via a subprocess using the venv python.
- Audio STT (`whisper_provider.py`) uses openai-whisper (torch/cu13) — UNTOUCHED.

## Current broken state (informational; code self-heals on next run)
cu12 trio already uninstalled from py313; cu13 cudnn DLL restore was interrupted → `cudnn_cnn64_9.dll` MISSING. Both paddle and faster-whisper currently broken in py313. NOT touched manually (per instruction); the heal logic below repairs it on the next Step10 / one-click-start run.

## Phase-safety gate (key design)
`Sync-NvidiaCuStack -TargetMajor 13` removes cu12 nvidia libs from system Python ONLY when the whisper cu12 venv exists (`Resolve-WhisperCu12Python` non-null). If the venv is absent, it leaves cu12 in place and warns (pycore STT keeps working in-process; paddle stays broken until the venv is created). This makes the heal safe to ship in any phase and auto-activates once the venv exists.

## Implementation

### A. NEW `scripts/shells/win/win_common/NvidiaCuStackAlign.ps1`
Idempotent CUDA-stack aligner. Sources `CudaIndex.ps1` + `PythonRuntimeCommon.ps1`.
- `Get-NvidiaCuTargetMajor [-PythonCmd]`: from `torch.version.cuda` ("13.0"→13, "12.4"→12); else driver cv (`Get-CudaDriverCv` ≥1300→13 else 12); else 13.
- `Get-InstalledNvidiaPackages [-PipExe]`: parse `pip list --format=freeze` for `nvidia-*` (exclude `nvidia-ml-py`). Classify major: bare `nvidia-<lib>`→13; `*-cu13`→13; `*-cu12`→12; `*-cu11`→11.
- `Sync-NvidiaCuStack [-PythonCmd] [-PipExe] [-TargetMajor] [-AllowCu12Removal]`:
  1. target major (auto if omitted).
  2. off-major pkgs (target 13 → all `nvidia-*-cu12`).
  3. none → return (idempotent, fast).
  4. gate: if removing cu12 and `Resolve-WhisperCu12Python` is null AND `-AllowCu12Removal` not set → warn + return (phase-safety).
  5. else `pip uninstall -y <off-major>`; for each removed pkg map to on-major counterpart (strip `-cu12` → try `nvidia-<base>-cu13` then bare `nvidia-<base>`) and `pip install --force-reinstall --no-deps <pkg>==<installed-version>` to restore clobbered files.

### B. NEW `scripts/shells/win/win_common/WhisperCu12Venv.ps1`
- `$script:WhisperCu12VenvDir = Join-Path $Global:LANG_COMPILER_DIR 'venvs\whisper_cu12'` (= `D:\.dev_win10\venvs\whisper_cu12`).
- `Resolve-WhisperCu12Python`: `<venv>\Scripts\python.exe` if exists else $null.
- `Ensure-WhisperCu12Venv [-BasePython]`: idempotent. Create venv if missing; venv-pip install `faster-whisper`, `ctranslate2`, `nvidia-cublas-cu12`, `nvidia-cudnn-cu12==9.*` (cu12 libs isolated INSIDE the venv site-packages). Gate on `Test-CudaPresent` (CPU host → no venv; STT uses openai-whisper CPU). Write venv python path to a registry json under `$Global:USER_DIR` for the pycore resolver.

### C. EDIT `scripts/shells/win/install_powershells/Step11_InstallFasterWhisper.ps1`
- Stop installing faster-whisper + cu12 libs into `$Global:PIP_EXE_PATH` (system python).
- Call `Ensure-WhisperCu12Venv` → install faster-whisper + ctranslate2 + cu12 libs INTO the venv.
- Model pre-download uses venv python: `& $venvPython -c "from faster_whisper import download_model; ..."`.
- Idempotent (skip if venv already has faster-whisper).

### D. pycore video-extract STT → venv subprocess
NEW `pycore/callmodule/services/processors/whisper_transcribe_runner.py` (standalone, runs in cu12 venv; imports only stdlib + faster_whisper, NO pycore):
- argv: `--model M --device D --compute C --audio PATH --srt PATH --language L [--resume-from S] [--duration F] | --probe catalog|languages|installed`.
- transcribe mode: load `WhisperModel`, read partial SRT for resume, append SRT, emit one JSON line per segment `{"pct","start","end","text","idx"}` + final `{"done":true,"segments":N,"language":..}` or `{"error":..}`. exit 0 on success.
- probe mode: print catalog / languages / installed-models JSON (for whisper_runtime UI helpers).

NEW `pycore/pyutils/whisper_stt/whisper_venv.py` (resolver):
- `resolve_whisper_python()`: env `PYCORE_WHISPER_PYTHON` → registry json (from Step11) → venv known path → fallback `sys.executable` (legacy in-process, only if venv absent).

EDIT `pycore/callmodule/services/processors/subtitle_engine.py`:
- `transcribe_to_srt_faster` rewritten to spawn `<venvPython> whisper_transcribe_runner.py ...` (mirror `safe_subprocess`/`commander` Popen), read stdout JSON lines, forward to `log`/`on_progress`. SRT written by runner (shared FS). Resume + progress contract preserved.
- `load_faster_whisper` returns a lightweight handle carrying (model,device,compute) for the runner; no in-process `WhisperModel`.

EDIT `pycore/callmodule/services/processors/whisper_runtime.py`:
- `has_nvidia_gpu`: drop in-process `import ctranslate2` probe (would load cu12 in the cu13 process); use `CUDADetector.is_cuda_available()` only. Comment why.
- `_fw_model_repos` / `list_supported_languages` / `list_installed_whisper_models`: route through runner `--probe` (fallback to hardcoded catalog / `["en"]` on failure — already try/except-wrapped).

`video_extract_processor.py`: NO change (calls `load_faster_whisper`/`transcribe_to_srt_faster`; signatures preserved).

### E. System Python cu13 cleanup + heal wiring
- `PaddleCpuGuard.ps1`: after `Install-GpuPaddle` and in the not-usable repair branch → `Sync-NvidiaCuStack -TargetMajor 13`.
- `TorchCpuGuard.ps1`: after GPU torch install/reinstall → `Sync-NvidiaCuStack` (auto target).
- `PythonPrereqInstallCommon.ps1`: source the two new modules; after `Install-PaddleOcrBundle` → `Sync-NvidiaCuStack -TargetMajor 13`; add idempotent `Remove-WhisperFromSystemPython` (uninstall `faster-whisper`,`ctranslate2`,cu12 trio from system python ONLY when the venv exists).
- `TorchCudaInstallCommon.ps1::Install-Ctranslate2Cuda12Libs`: reroute to install into the venv, not system python (or delegate to `Ensure-WhisperCu12Venv`).

### F. EDIT `D:\programing\glm-coding-helper\scripts\one_click_start.ps1`
- Before launching the backend (after dep check): resolve core_node `NvidiaCuStackAlign.ps1` (via existing `Resolve-Step10PrereqInstaller`-style path) and run `Sync-NvidiaCuStack -PythonCmd $RunPy -TargetMajor 13`. Self-heals py313 on every launch (no-op when clean; gated removal of cu12 only when the whisper venv exists, so it never breaks pycore STT mid-migration).
- `one-click-start.cmd`: no change (delegates to .ps1).

### G. Linux mirrors (follow-up, out of scope this pass)
`linux/common/{cuda_index.sh,torch_cpu_guard.sh,paddle_cpu_guard.sh,torch_cuda_install.sh}` + `linux/debian/install_shells/14_install_faster_whisper.sh` mirror the win logic; same collision applies. Deferred (bug is Windows). Flag for a follow-up to mirror A–F.

## Phase ordering
1. A + B (pure additions, no behavior change).
2. C + D (relocate STT to venv; pycore STT works via subprocess).
3. E + F (system-python cu13 cleanup + one-click-start heal; gated on venv presence so safe at every phase).
4. G (linux mirror, follow-up).

## File list
NEW:
- `scripts/shells/win/win_common/NvidiaCuStackAlign.ps1`
- `scripts/shells/win/win_common/WhisperCu12Venv.ps1`
- `pycore/callmodule/services/processors/whisper_transcribe_runner.py`
- `pycore/pyutils/whisper_stt/whisper_venv.py`
EDIT:
- `scripts/shells/win/install_powershells/Step11_InstallFasterWhisper.ps1`
- `scripts/shells/win/win_common/PythonPrereqInstallCommon.ps1`
- `scripts/shells/win/win_common/PaddleCpuGuard.ps1`
- `scripts/shells/win/win_common/TorchCpuGuard.ps1`
- `scripts/shells/win/win_common/TorchCudaInstallCommon.ps1`
- `pycore/callmodule/services/processors/subtitle_engine.py`
- `pycore/callmodule/services/processors/whisper_runtime.py`
- `D:\programing\glm-coding-helper\scripts\one_click_start.ps1`

## Non-goals
- No test code (AGENTS). No git ops beyond local edits. No build/run/pip on system python (per instruction) — code self-heals on the next user-run Step10/one-click-start.
- Audio STT provider (openai-whisper/torch/cu13) untouched.
- Linux mirror deferred (G).
- No docs (*.md) created/updated (AGENTS); this plan file is the only .md touched.
