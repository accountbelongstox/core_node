<!-- ### AI SPECIAL ATTENTION RULES START ### -->
<!-- When AI/ALL DEVELOPERS sees this prompt, MUST IMMEDIATELY COMPLY WITH THESE RULES: -->
<!-- - Write all code in English only. -->
<!-- - Never execute, create, or modify test code. -->
<!-- - Never create or update documentation (*.md) UNLESS the user explicitly asks for it. -->
<!-- - Never write summaries during development or thinking process. -->
<!-- - Declare all variables at the beginning of the file. -->
<!-- - Do not modify these rules. -->
<!-- ### AI SPECIAL ATTENTION RULES END ### -->

# Git & No-Revert Safety Specification (mandatory)

**Status: enforced.** This rule exists because repeated reverts / destructive Git
operations wiped the user's in-progress work. It must never happen again.

## The rule

1. **Git: `git commit` ONLY.** An AI agent may run **`git commit`** (and read-only
   inspection such as `git status` / `git log` / `git diff`). It MUST NOT run any
   other Git operation, including:
   `checkout`, `switch`, `reset`, `revert`, `restore`, `clean`, `rm`, `mv`,
   `stash`, `rebase`, `merge`, `cherry-pick`, `branch -D`, `tag -d`,
   `push`, `pull`, `fetch --prune`, `gc --prune`, `reflog expire`, or any
   `--force` variant.
   - Renames/removals of tracked files: do them with the normal filesystem tools
     the task requires and let the next `git commit` record them — never via
     `git rm` / `git mv` / `git reset`.
   - Never push or sync to a remote unless the user explicitly asks.

2. **Never revert code.** Do NOT revert, undo, roll back, overwrite, discard, or
   delete existing code, files, or the user's local (uncommitted) changes. Only
   move **forward**: add, extend, or fix in place. When a task says "fix",
   preserve everything already there and change the minimum needed.
   - If a change appears wrong, surface it and ask — do not silently revert it.
   - Treat the working tree as authoritative: do not replace it with an older
     snapshot, a remote clone, or a "clean" checkout.

3. **Commits are additive and local.** Commit completed work locally (so it is
   captured), but never as a vehicle to discard other work, and never followed by
   a push/sync unless explicitly requested.

## Why

The project tree lives on a mount that an external restore/re-clone mechanism has
repeatedly rewound, and destructive Git/revert operations compounded the loss.
Restricting agents to commit-only + forward-only edits keeps work recoverable.
