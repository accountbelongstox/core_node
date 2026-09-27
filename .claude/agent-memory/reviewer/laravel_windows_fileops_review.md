---
name: laravel-windows-fileops-review
description: Reviewing laravel_main file deletes on Windows - junction semantics in PHP 8.5, unsafe Illuminate deleteDirectory guard, read-only link probe, and the verdict rule for all-deferred leader fix tasks
metadata:
  type: project
---

Laravel file operations must also work on the local Windows D8 node (FrankenPHP). `FileSystemManager::delete/rename` were sudo-only (they did nothing on Windows); B1 of laravel-api-D7 was found on 2026-09-27.

The junction facts were verified read-only on 2026-09-27 on PHP 8.5.2 CLI and FrankenPHP php-cli 8.5.11:
- A junction gives `is_link()=false`, `filetype()='unknown'` and lstat type 0. `is_dir` is false for system junctions and inconsistent for scratch ones.
- A dir symlink gives `filetype()='link'`.
- `RecursiveDirectoryIterator::hasChildren()` is false for both a junction and a dir symlink. So the iterator never descends into a nested link, but a walk rooted at a junction lists its target.
- The only safe top-level guard is `@filetype($p)==='dir'`. A guard of `is_dir && !is_link` walks through junctions and deletes the target's files.
- Illuminate `Filesystem::deleteDirectory` uses `isDir() && !isLink()` (vendor Filesystem.php:751), so it has the same hazard on Windows.

**Why:** the leader's first prototype lost a junction target's files. Any review of a Windows delete or recursive walk has to check the guard.

**How to apply:**
- Probe with read-only stats on existing links: `C:\Users\Default User` (junction), `C:\Documents and Settings` (junction), `C:\Users\All Users` (symlinkd). No sandbox writes are needed.
- Developer Mode is on (`AllowDevelopmentWithoutDevLicense=1`), so `symlink()` works unprivileged. Still, a prototype's report should print its `*_created` flags, otherwise its link cases may be vacuous.
- DataSync real sessions are in `D:/www/backup/data-sync/{jobs,locks}`. A prune test must back-date scratch `updated_at` to before the oldest real session, because arsort compares strings.
- Verdict rule for a leader "-fix" task whose items are all deferred to the owner: the deferral is confirmed, but the item stays open, so the verdict is `changes_requested`, re-dispatched to the owner and not to the leader. Precedents: pycore-runtime-D7P2-fix and laravel-api-D7-fix.

Related: [[laravel-schema-review-checklist]], [[pycore-review-patterns]].
