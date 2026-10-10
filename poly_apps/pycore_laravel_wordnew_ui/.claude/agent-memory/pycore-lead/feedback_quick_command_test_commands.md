---
name: quick-command-test-commands
description: Which library quick commands are safe to fire when live-testing the terminal quick-command route in a scratch window
metadata:
  type: feedback
---

When live-testing `ui/terminal/quick_command/run`, use `system:clear_screen` (cls/clear) or `system:git_status`; never `system:git_pull`, `preset:dd_gitsync` or `custom:*`.

**Why:** a test with `system:git_pull` really ran `git pull` in the live core_node repo (fast-forward, harmless that time) although AGENTS.md allows only read-only git unless the prompt asks. The scratch window's cwd is the repo.

**How to apply:** pick read-only library entries; start the scratch PowerShell with `Set-Location` to a scratch dir if a mutating command is ever needed. Harness tips: the HTTP API lives under `/api/ui/terminal/...` on port 59000 with a JSON body; `ui/terminal/text` with refresh is rate-limited (`terminal_text_recent`) and can return a stale export.
