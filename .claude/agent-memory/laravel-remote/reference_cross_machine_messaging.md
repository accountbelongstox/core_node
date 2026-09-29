---
name: cross-machine-messaging
description: How startup contact with ca-orchestrator behaves from the laravel-main server, and what not to do when it fails
metadata:
  type: reference
---

When `ca-orchestrator` is unreachable, `ListAgents` from `ct-laravel-remote` shows "No reachable agents" with no Remote Control rows, and `SendMessage` fails with "No agent named 'ca-orchestrator' is reachable". This happened on 2026-09-27 in two sessions.

- The fallback channel is `.claude/agents_shared/reports/laravel-remote.md` in the server checkout. Write the status there and wait.
- Do not inspect env vars, process args or credentials to diagnose Remote Control. The auto-mode classifier denies it as credential exploration. Ask the user instead.
- The fix belongs to the user: start the orchestrator with `--remote-control` on the same claude.ai account, per guide §10.
- Pitfall (2026-09-28): after orchestrator restarts, several `ca-orchestrator` sessions coexist, and some of them are offline. A bare-name send goes to the one this conversation confirmed first, which may be offline. Reply with the incoming message's `from` value (`bridge:session_...`), or check `ListAgents` and use `name [ref]`.
