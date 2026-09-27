---
name: remote-role-messaging
description: Prerequisites for reaching the laravel-remote role over Remote Control; lead needs /remote-control if started before the role was enabled; server / must not be world-writable
metadata:
  type: project
---

Reaching `ct-laravel-remote` needs Remote Control on BOTH ends, and cross-session messaging enabled on the server.

**Why:** 2026-09-27 first start failed twice: (1) server `/` was 0777, so Claude Code turned messaging off ("socket directory could not be set up"); fixed with user-approved `chmod 755 /`. (2) the lead was launched while the role was disabled, so it had no `--remote-control`; the remote send said "no agent named 'ca-orchestrator' is reachable".

**How to apply:** Before dispatching to laravel-remote, run ListAgents and look for a `Remote Control` row. If absent: check the remote pane (`tmux -L claudeagents capture-pane -t ct-laravel-remote`) for a messaging warning, and ask the user to run `/remote-control ca-orchestrator` in the lead. Start only the remote role with `claudeagents --no-windows --roles laravel-remote`; restart it by killing server tmux `-L claudeteam ct-laravel-remote` (the local ssh loop recreates it). Related: [[no-subagents]].

Code distribution: code reaches remote hosts (laravel-main, GPU test host) only through pyservice CodeSync (docs_fix/CODESYNC_AI_COMMUNICATION_API.md), never git (user D19, 2026-09-27). Remote roles check arrival by file SHA-256, not git HEAD. Never tell the user 'git or CodeSync'.
