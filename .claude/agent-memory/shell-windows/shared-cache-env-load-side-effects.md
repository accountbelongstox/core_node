---
name: shared-cache-env-load-side-effects
description: SharedCacheEnv.ps1 creates real D:\www\cache\* subdirectories just by being dot-sourced — never dot-source it in a scratch/isolated test; stub its globals and functions instead
metadata:
  type: project
---

`scripts/shells/win/win_common/SharedCacheEnv.ps1` is not side-effect-free at load time for its whole scope: the D28/D30 drive-layout constants section (`CN_TOOL_ROOT`/`CN_CACHE_ROOT`/`CN_TREES_ROOT`/etc.) is detection-only as documented, but a separate, older, pre-existing block in the same file (the shared pycore/HF/pip/torch user-cache section, `$Global:WWW_CACHE_DIR` and its `$__sccSubDirs` loop) does `New-Item -ItemType Directory` for `huggingface`, `whisper`, `torch`, `pip`, `xdg`, `core_node`, `uv`, `pycore` under the real `D:\www\cache` on every dot-source, unconditionally.

**Why:** needed to test `ProjectTreeCommon.ps1`'s dependency on `SharedCacheEnv.ps1`'s globals (`$Global:CN_TREES_ROOT`, `Write-ProgramDriveFallbackWarning`, `New-CnNamespaceDirectory`) in a scratch dir per the shell-windows scratch-probe safety rule. Dot-sourcing the real file to get those would have written real directories on the live D: drive outside the scratch dir, which is not a "harmless scratch probe".

**How to apply:** when writing an isolated/scratch test for any script that consumes `SharedCacheEnv.ps1` globals or functions, define lightweight local stubs for the specific globals/functions actually used (`$Global:CN_TREES_ROOT`, `$Global:WINDOWS_PROGRAM_DRIVE_IS_FALLBACK`, `Write-ProgramDriveFallbackWarning`, `New-CnNamespaceDirectory`, `Write-ColorMessage`) instead of dot-sourcing the real file. See [[dual-boot-parity-ledger-can-lag-code]].
