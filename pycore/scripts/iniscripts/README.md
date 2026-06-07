# iniscripts — Pycore service prerequisites

Shell-managed prerequisite installers that run **before** `pycore_module_caller.py`
launches. They set up the heavy / awkward third-party packages that are more
convenient to install from a shell than from Python's import-time auto-installer
(`pycore/pyfoundations/third_party.py`).

## How it fits together

```
pyservice.ps1 / pyservice.sh          (repo-root entry point — ONLY an entry point)
        │  1. resolve a real Python 3
        │  2. run prerequisites ▼            (skip with -NoInstall / --no-install)
        ▼
pycore/scripts/iniscripts/prepare.ps1 / prepare.sh   (orchestrator)
        │  auto-discovers every install_*.{ps1,sh} here and runs each,
        │  passing the resolved -Python
        ▼
install_whisper.ps1 / install_whisper.sh   (one prerequisite, e.g. whisper)
        │  └─ download_whisper_model.py     (shared helper: pre-download a model)
        ▼
pycore/pycore_module_caller.py        (3. the real worker — launched last)
```

`third_party.py` keeps **fast-detecting and installing the lighter packages** at
import time. These scripts cover the rest (large downloads, model files, GPU
runtime libs) where a shell install is simpler and faster to verify.

## Division of labour

| Where                          | Installs                                                        |
|--------------------------------|----------------------------------------------------------------|
| `pyfoundations/third_party.py` | lighter pip packages, fast import-time detection + install      |
| `iniscripts/install_*.{ps1,sh}`| heavy packages, model downloads, GPU libs (whisper, …)          |

## Capacity / environment guards (install_whisper)

The whisper installer skips itself on machines where the heavy install (torch +
model files) is not worth it. It exits 0 (a skip is a successful non-action), so
the service still launches. `-Force` / `--force` bypasses the whole guard.

| Condition                                                            | Windows (`.ps1`) | Linux/macOS (`.sh`) |
|----------------------------------------------------------------------|:----------------:|:-------------------:|
| Total RAM < 1 GB                                                      | skip             | skip                |
| Total **free** disk < 100 GB (summed across all drives/filesystems)  | skip             | skip                |
| Headless **server** (non-desktop) **and** no CUDA GPU                | —                | skip                |

Metrics that cannot be read are treated as *unknown* and never trigger a skip.
Thresholds live at the top of `install_whisper.ps1` / `install_whisper.sh`
(`$MinRamGB`/`$MinFreeDiskGB`, `MIN_RAM_GB`/`MIN_DISK_GB`).

## Adding a new prerequisite

1. Drop `install_<name>.ps1` **and** `install_<name>.sh` in this directory.
2. Each MUST accept `-Python` / `--python` and MUST be **idempotent** — detect
   "already installed" and skip (so re-running the service is cheap).
3. That's it. `prepare.ps1` / `prepare.sh` auto-discover `install_*` by glob — no
   edit to the orchestrator is needed.

Optional: if your installer takes extra options, wire them through the
orchestrator the same way `-WhisperModel` / `--whisper-model` is handled
(PowerShell side uses **hashtable splatting** so parameters bind by name — array
splatting binds positionally and will silently mis-bind `-Name value` tokens).

## Examples

```powershell
# Windows: install prereqs (pre-download whisper 'base'), then launch
.\pyservice.ps1 -WhisperModel base

# Only provision prerequisites, do not launch
.\pyservice.ps1 -Only -Include whisper

# Skip prerequisites entirely, just launch
.\pyservice.ps1 -NoInstall -Port 8000 -DebugMode

# Run a single installer directly
.\pycore\scripts\iniscripts\install_whisper.ps1 -Python python -Model base
```

```bash
# Linux / macOS / Git-Bash
./pyservice.sh -- --whisper-model base     # args after `--` go to prepare.sh
./pyservice.sh --only
./pyservice.sh --no-install --port 8000 --debug
bash pycore/scripts/iniscripts/install_whisper.sh --python python3 --model base
```
