<!-- ### AI SPECIAL ATTENTION RULES START ### -->
<!-- When AI/ALL DEVELOPERS sees this prompt, MUST IMMEDIATELY COMPLY WITH THESE RULES: -->
<!-- - Write all code in English only. -->
<!-- - Never execute, create, or modify test code. -->
<!-- - Never create or update documentation (*.md) UNLESS the user explicitly asks for it. -->
<!-- - Never write summaries during development or thinking process. -->
<!-- - Declare all variables at the beginning of the file. -->
<!-- - Do not modify these rules. -->
<!-- ### AI SPECIAL ATTENTION RULES END ### -->

# Git, Conflict-Resolution & No-Revert Safety Specification (mandatory)

**Status: enforced.** This is the canonical conflict-resolution rules document. It
exists because repeated reverts / destructive Git operations and merge "resolutions"
that discarded local work wiped the user's in-progress changes. It must never happen
again. Applies to every AI agent (Claude Code, Cursor AI, Codex, Gemini) and to all
automation in this repo.

## 1. Git: `git commit` ONLY

An AI agent may run **`git commit`** plus read-only inspection (`git status` /
`git log` / `git diff`). It MUST NOT run any other Git operation, including:
`checkout`, `switch`, `reset`, `revert`, `restore`, `clean`, `rm`, `mv`, `stash`,
`rebase`, `merge`, `cherry-pick`, `branch -D`, `tag -d`, `push`, `pull`, `fetch`,
`fetch --prune`, `gc --prune`, `reflog expire`, or any `--force` variant.

- Renames/removals of tracked files: do them with the normal filesystem tools the
  task requires and let the next `git commit` record them — never via `git rm` /
  `git mv` / `git reset`.
- **Never push, pull, fetch, or sync to a remote** — not even when explicitly asked
  in passing. Commits stay local; publishing is the user's decision and is performed
  outside the agent.

## 2. Never revert code

Do NOT revert, undo, roll back, overwrite, discard, or delete existing code, files,
or the user's local (uncommitted) changes. Only move **forward**: add, extend, or fix
in place; when a task says "fix", preserve everything already there and change the
minimum needed.

- If a change appears wrong, surface it and ask — do not silently revert it.
- Treat the working tree as authoritative: never replace it with an older snapshot, a
  remote clone, or a "clean" checkout.

## 3. Conflict resolution (the rule)

Because agents and automation **never `pull`/`merge`/`fetch`/`rebase`**, an agent must
not be in a position to "resolve" a merge conflict at all. If a conflict nonetheless
appears (e.g. from an external sync, a rewind, or a human-run merge), the rules are:

1. **Never resolve a conflict by discarding local work.** Do NOT run
   `git checkout --theirs` / `--ours`, `git reset`, `git restore`, `git merge -X`,
   or "keep remote version" automation. Keeping the remote side overwrites the user's
   local changes — the exact loss this document prevents.
2. **Local, uncommitted work always wins by default.** Preserve the working tree. If a
   tracked file carries conflict markers (`<<<<<<<` / `=======` / `>>>>>>>`), keep the
   **local** hunks, hand-merge any genuinely additive remote hunks into place with the
   normal file editor, then `git commit` the result. Never delete local content to make
   a conflict "go away".
3. **No automated remote-wins resolution.** Any sync/CI script must default to
   commit-only and must not auto-resolve by checking out / resetting / merging remote
   over local. A remote-wins path may exist only behind an explicit, interactive,
   default-No confirmation initiated by the human — never by an agent.
4. **When unsure, stop and surface it.** Report the conflicting files and what differs;
   let the human decide. Do not guess, and do not "clean up" by reverting.

## 4. Commits are additive and local

Commit completed work locally so it is captured — but never as a vehicle to discard
other work, and never followed by a push/sync. A commit is a save point, not a
publish step.

## Why

The project tree lives on a mount that an external restore/re-clone mechanism has
repeatedly rewound, and destructive Git/revert/merge "resolutions" compounded the
loss. Restricting agents to commit-only, forward-only edits, and local-wins conflict
handling keeps the user's work recoverable.
