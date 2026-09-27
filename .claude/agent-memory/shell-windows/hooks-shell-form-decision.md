---
name: hooks-shell-form-decision
description: Project hooks in .claude/settings.json stay in shell form; exec form ("args") deferred because an older CLI would silently disable the git guard
metadata:
  type: project
---

`.claude/settings.json` hooks stay `"command": "node \"${CLAUDE_PROJECT_DIR}/.claude/hooks/<x>.mjs\""` (shell form). The D13 spec offered exec form (`"command": "node", "args": [...]`) as optional hardening; it was not applied on 2026-09-27 (shell-windows-1).

**Why:** CLI 2.1.283 supports `args` (in its zod schema and the official hooks docs), but a CLI that predates it drops the unknown key and runs bare `node` with the hook JSON on stdin: a non-blocking error, so the PreToolUse git guard would silently stop working. The server's CLI version is not recorded and its upgrade prompt defaults to N. The hooks report only by exit code + stderr, so the shell-profile stdout corruption that exec form prevents does not apply.

**How to apply:** revisit only after every machine running role sessions (local and the laravel-remote server) is confirmed on a CLI with `args`; keep the git guard behavior identical when changing it.
