---
name: wsl-verification-recipe
description: How to run Linux dry runs from this Windows host in Debian WSL2 (quoting, tools present, shared scratchpad)
metadata:
  type: reference
---

Running Linux checks from the Windows host:
- PowerShell 5.1 mangles embedded quotes and `$` when calling `wsl.exe -- bash -lc '...'`. Write the check as a script file in the scratchpad, then run it from the Bash tool: `MSYS_NO_PATHCONV=1 wsl.exe -d Debian -- bash /mnt/d/.tmp/claude/<...>/scratchpad/<unique>.sh`. The repo is at `/mnt/d/programing/core_node`, and the default user is root.
- Inline Bash-tool heredocs containing quotes can break the tool wrapper. Write the file with Write and append with `cat file >> target`.
- The Windows host has no python3 (Store alias only), so do edits with the Edit tool. Debian 13 WSL has python3, pgrep, ps and stty, but no tmux, node, shellcheck or terminal emulator. WSLg exports DISPLAY=:0 and WAYLAND_DISPLAY, so launcher code takes the headless path there.
- The scratchpad is shared with concurrent workflows (another agent overwrote probe.sh), so use task-prefixed file names.
- Fake binaries (claude, ssh, tmux stubs) first on PATH let you verify argv and quoting without starting sessions or using the network.

**Why:** learned during D13 shell-linux-1 (2026-09-27). **How to apply:** use this for any `--status`/dry-run verification when no native Linux host is available. See [[crlf-mixed-line-endings]].
