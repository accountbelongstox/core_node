---
name: stuck-onboarding-panes
description: Launched ct-* role panes can sit at Claude Code first-run onboarding (theme picker / OAuth login) and then never appear in ListAgents; check the panes before trusting a roster count
metadata:
  type: project
---

A running `claude --agent <role> --name ct-<role>` process does not mean a live role session. On 2026-09-28 all 28 local panes of tmux `-L claudeagents` session `core-node-team` were stuck at first-run onboarding: 27 on the theme picker and ct-shell-windows on the OAuth login URL. None of them was in ListAgents, so only ct-laravel-remote (Remote Control) could get messages. The laravel-remote ssh-loop pane sat at an ssh host-key prompt, but the server session was still reachable. An earlier record had counted 28 running sessions from the process list alone.

**Why:** Process lists and messaging sockets exist before onboarding completes. Only ListAgents shows who can receive a message.

**How to apply:** For a census, trust ListAgents rows, then classify panes with `tmux -L claudeagents capture-pane -p -t <pane>` (look for "Choose the text style", "oauth/authorize", "Are you sure you want to continue connecting").
- Never type into another session's login or host-key prompt; report it to the user instead.
- For role work while the panes are stuck, spawn that agent type on demand, as guide §1 allows.
- Do not read /proc environ or process trees for launch context; auto mode denies that as credential exploration.

**Two teams by uid.** The user may also run a full team as `debian` (uid 1000; tmux `/tmp/tmux-1000/claudeagents`; lead reachable over Remote Control as `ca-orchestrator [13ea0a]`). Root's ListAgents cannot see its local `ct-*` sessions, because messaging sockets are per uid. Before editing shared launcher or config files, fence the paths with that lead over SendMessage and release them afterwards. It acknowledged the fence and recorded it (R6).

**Census since orch-wf1 (2026-09-28):** `bash scripts/linuxenvs/claudeteamup.sh --status` is read-only and prints each role as blocked:onboarding, login, trust, ssh-hostkey or usage-limit, or as stalled, with its pane id. Prefer it to hand-written capture-pane loops.

Related: [[remote-role-messaging]], [[parallel-user-sessions]].
