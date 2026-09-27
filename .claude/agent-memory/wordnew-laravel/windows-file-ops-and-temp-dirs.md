---
name: windows-file-ops-and-temp-dirs
description: FileSystemManager::delete/rename shell out to sudo rm and fail on Windows; how to test file-purging code in a scratch temp dir; AppQyV1 PHP files are CRLF
metadata:
  type: project
---

- `App\Utils\FileSystemManager::delete()` (and the delete step of `rename()`) runs `sudo -u <user> rm <path>` through `shell_exec`, and has no Windows branch. On Windows it never deletes a file and returns false. It belongs to pycore-laravel and was reported in wordnew-laravel-G1.
- To verify purge logic on Windows anyway, run the scratch script with a `sudo.bat` shim first on PATH: `@echo off` plus `if /I "%3"=="rm" del /f /q "%~4"`, invoked as `PATH="$scratch/shim:$PATH" php script.php`.
- To point a service's private storage dir at a scratch temp dir, pre-fill `FileSystemManager::$externalPathMappings` through reflection. Map the real dir, and each real file path the code reads, to the temp paths. `mapExternalPath` consults this cache first.
- The AppQyV1 PHP files are fully CRLF. The Edit tool keeps CRLF. Check it with `wc -l` equal to `grep -c $'\r'`.
- The user's own "win0.0.1" sweep commits can pick up uncommitted working-tree changes in the middle of a task. After that, `git status` is clean, so find your hunks with `git diff <prev> <sweep>`.

**Why:** In wordnew-laravel-G1 (2026-09-27), the LDRI-22 purge returned 0 on Windows only because of the foundation delete.

**How to apply:** Use these whenever AppQyV1 code deletes files, or needs a disk-state test without touching `D:\www\wwwroot\laravel_db`. Related: [[verify-in-process-without-writes]].
