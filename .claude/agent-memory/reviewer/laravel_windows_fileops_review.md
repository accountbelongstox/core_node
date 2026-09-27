---
name: laravel-windows-fileops-review
description: Reviewing laravel_main file deletes on Windows - junction semantics in PHP 8.5, unsafe Illuminate deleteDirectory guard, read-only link probe, and the verdict rule for all-deferred leader fix tasks
metadata:
  type: project
---

Laravel file operations must also work on the local Windows D8 node (FrankenPHP). `FileSystemManager::delete/rename` were sudo-only (they did nothing on Windows); B1 of laravel-api-D7 was found on 2026-09-27.

The junction facts were verified read-only on 2026-09-27 on PHP 8.5.2 CLI and FrankenPHP php-cli 8.5.11:
- A junction gives `is_link()=false`, `filetype()='unknown'` and lstat type 0. `is_dir` depends on the stat cache: true when first called on a fresh path, false after any lstat (`is_link`/`filetype`) of it (re-probed read-only on `C:\Users\Default User`). So an `is_dir`-first walk recurses into a nested junction, and a probe must `clearstatcache(true)` before the call under test or it hides the walk-through.
- A dir symlink gives `filetype()='link'`.
- `RecursiveDirectoryIterator::hasChildren()` is false for both a junction and a dir symlink. So the iterator never descends into a nested link, but a walk rooted at a junction lists its target.
- The only safe top-level guard is `@filetype($p)==='dir'`. A guard of `is_dir && !is_link` walks through junctions and deletes the target's files.
- Illuminate `Filesystem::deleteDirectory` uses `isDir() && !isLink()` (vendor Filesystem.php:751), so it has the same hazard on Windows.

**Why:** the leader's first prototype lost a junction target's files. Any review of a Windows delete or recursive walk has to check the guard.

**How to apply:**
- Probe with read-only stats on existing links: `C:\Users\Default User` (junction), `C:\Documents and Settings` (junction), `C:\Users\All Users` (symlinkd). No sandbox writes are needed.
- Developer Mode is on (`AllowDevelopmentWithoutDevLicense=1`), so `symlink()` works unprivileged. Still, a prototype's report should print its `*_created` flags, otherwise its link cases may be vacuous.
- DataSync real sessions are in `D:/www/backup/data-sync/{jobs,locks}`. A prune test must back-date scratch `updated_at` to before the oldest real session, because arsort compares strings.
- A reuse check that greps only for the new code's own tokens (CHILD_FIRST, filetype() misses scandir-based walks. Also grep `rmdir(` and `unlink(` together with scandir. In laravel-api-D7-fix round 2 (2026-09-27) this found `ServerManagerV1ElevatedAccess::nativeRmdir`, an unsafe duplicate using is_dir&&!is_link, so the verdict was changes_requested (delegate it to FileSystemManager::delete).
- Verdict rule for a leader "-fix" task whose items are all deferred to the owner: the deferral is confirmed, but the item stays open, so the verdict is `changes_requested`, re-dispatched to the owner and not to the leader. Precedents: pycore-runtime-D7P2-fix and laravel-api-D7-fix (rounds 1 and 3).
- For a deferred patch, diff the live files against the leader's `patched/` copies (they must differ only by the stated hunks), and diff the test copies against `patched/` (they may differ only by class renames). Flag it when hand-off files exist only in a session scratchpad instead of `.claude/agents_shared/`. Also check that the report's section status line was updated in the new round.

Related: [[laravel-schema-review-checklist]], [[pycore-review-patterns]].
