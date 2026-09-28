# FIX 20260918 — SSH Sessions Repeatedly Dropping ("SSH session ended / Press any key to exit")

Date: 2026-09-18
Host: VM-0-2-debian (Tencent Cloud VM, Debian 12, OpenSSH 9.2p1, ssh.service)
Script: `scripts/shells/linux/debian/install_shells/23_setup_ssh_remote.sh`
Shared component: `scripts/shells/linux/common/ssh_server_common.sh`

## Symptom

The Windows SSH client kept reporting "SSH session ended ... Press any key to exit".
Reconnecting worked, but sessions dropped again minutes to hours later ("不停的断开").

## Diagnosis (evidence from `journalctl -u ssh`, last 48h)

- Authenticated sessions ended with **only** `pam_unix(sshd:session): session closed for user root` —
  no `Received disconnect`, no `Timeout, client not responding`. The TCP transport was cut
  externally; sshd never initiated the disconnect.
- All sessions from the same client IP **died at the same minute**
  (e.g. 116.68.21.67 sessions opened 07:27/07:30/07:34 all closed 07:38–07:40).
- The client egress IP rotated across `116.68.18.x / 116.68.21.x / 116.68.22.x` between sessions.
- ssh.service ran uninterrupted for 4+ days (no restarts, no OOM, no reload-related kills);
  NIC counters show zero errors/drops; no firewall/fail2ban rules present.

Conclusion: the disconnects are caused by the **client-side network path** —
CGNAT/NAT rebinding and middlebox RST on the route between the Windows client and the VM.
No sshd setting can prevent an external TCP RST.

## Official documentation check (sshd_config(5), https://man.openbsd.org/sshd_config)

- `ClientAliveCountMax 0` — the manual: "Setting a zero ClientAliveCountMax disables connection
  termination." Verified effective (`sshd -T`: `clientaliveinterval 60`, `clientalivecountmax 0`):
  sshd never kills idle or unresponsive clients.
- `TCPKeepAlive no` — kept on purpose: the manual warns TCP keepalives terminate connections
  on transient route disruptions; harmful on unstable networks.
- `ChannelTimeout none` / `UnusedConnectionTimeout none` — pinned so no idle-channel timeout exists.
- `LoginGraceTime 30`, `MaxStartups 100:30:200`, `PerSourceMaxStartups 10` — bound the heavy
  internet brute-force pre-auth noise visible in the logs; stale pre-auth holders are reaped each run.

## Fix

### Linux server side (deployed by the script, self-healing/idempotent)

1. `ssh_server_common.sh` gained `ssh_server_ensure_session_persistence()`:
   - Installs tmux if missing (already present at `/usr/bin/tmux`).
   - Writes `/etc/profile.d/ncore_ssh_tmux_persistence.sh` (644 root:root, via
     `write_file_if_changed`) which attaches interactive SSH logins to the persistent tmux
     session `main`:
     `if [ -n "$SSH_CONNECTION" ] && [ -z "$TMUX" ] && [ -t 0 ] && [ -t 1 ]; then ... tmux new-session -A -s main && exit; fi`
   - Non-interactive ssh/sftp/scp never source /etc/profile.d, and the tty guards double-protect
     them; a tmux failure falls through to a plain login shell, so the hook cannot lock users out.
   - Per-user opt-out: `touch ~/.ncore-no-auto-tmux`.
   - Env overrides: `SSH_SERVER_TMUX_PERSISTENCE_ENABLED=false`,
     `SSH_SERVER_TMUX_SESSION_NAME=<name>`.
2. `23_setup_ssh_remote.sh` calls the new step after `ssh_server_reap_stale_preauth`, prints the
   resulting state, and carries a FIX RECORD comment block (symptom, evidence, doc references).
3. Re-run result (2026-09-18): sshd config/service/firewall already converged (all SKIP);
   the tmux hook was written; `bash -n` and `sh -n` pass on both files. Effective from the next
   SSH login: a dropped connection no longer kills the shell — reconnecting resumes the same
   tmux session (`Ctrl-b d` detaches manually).

### Windows client side (recorded here together with the Linux fix; cannot be deployed from the server)

- Add to the client's SSH config (`%USERPROFILE%\.ssh\config` or the terminal app's settings):
  `ServerAliveInterval 30` — detects dead paths faster and triggers reconnect sooner.
- Terminal emulators (MobaXterm/PuTTY/Tabby/Windows Terminal): enable their built-in keepalive
  option if present.
- Root cause is the ISP/CGNAT egress rotation; for a permanent cure use a stable path:
  the VM already has `tailscale0` up — connecting over Tailscale (100.x address) bypasses the
  unstable public route entirely.

## Verification

- `sshd -T` effective values confirmed: port 22, clientaliveinterval 60, clientalivecountmax 0,
  tcpkeepalive no, unusedconnectiontimeout none, persourcemaxstartups 10, maxstartups 100:30:200.
- `/etc/profile.d/ncore_ssh_tmux_persistence.sh` content and syntax verified after the run.
- Existing SSH sessions were untouched by the run (reload-only convergence; no sshd restart).
- Self-heal re-run (2026-09-18, after the Windows client feedback): every step converged
  with no changes — sshd config/drop-in/systemd restart policy all `[SKIP] already up to date`,
  listener already matches the newest config, no stale pre-auth connections, tmux hook already
  in place. `sshd -T` re-verified: clientaliveinterval 60, clientalivecountmax 0,
  tcpkeepalive no, unusedconnectiontimeout none, passwordauthentication no.

## Follow-up (2026-09-18) — Client-side keepalive implemented in generated ssh$index scripts

The Windows client-side recommendation above ("cannot be deployed from the server") is now
implemented in the script generator so every generated SSH connection script carries it.

### Changes

1. `scripts/pytools/special_software_env_manager/script_sections/ssh_command_generator.py`
   - Module docstring gained a FIX RECORD block (symptom, evidence, official doc references).
   - All generated ssh invocations (Windows PowerShell and Linux bash, password and key-auth
     branches) now use:
     `ssh -o ServerAliveInterval=30 -o ServerAliveCountMax=3 -o TCPKeepAlive=no <connection>`
     - `ServerAliveInterval=30` + `ServerAliveCountMax=3`: the client detects a dead link within
       ~90s via encrypted SSH-layer keepalives instead of hanging on a silently cut TCP socket
       (the exact failure mode diagnosed above: external RST/CGNAT rebinding leaves no FIN).
     - `TCPKeepAlive=no`: per ssh_config(5), TCP keepalive "will cause connections to die if the
       route is down temporarily" — disabled client-side for the same reason as server-side.
   - Generated scripts print a post-session TIP: re-run the script to reconnect; the server-side
     tmux session persists (pairs with `/etc/profile.d/ncore_ssh_tmux_persistence.sh`).
2. Regenerated in place via the generator itself (diff-verified, only the keepalive lines and
   the TIP line changed):
   - `scripts/winenvs/ssh1.ps1`
   - `scripts/linuxenvs/ssh1.sh`
   Other ssh$index scripts pick up the fix on their next regeneration by Special Software
   Environment Manager.

### Verification

- `bash -n scripts/linuxenvs/ssh1.sh` — pass.
- PowerShell parser (`System.Management.Automation.Language.Parser::ParseInput`) on
  `scripts/winenvs/ssh1.ps1` — zero errors.
- Generator output diffed against the pre-change files: only the four `ssh` invocation/echo
  lines plus the TIP line differ; no unrelated drift.

## Windows Client Test Feedback (2026-09-18 08:12 CST) — ssh1.ps1 live run

Tested from Windows (user mpc, Git Bash / Kimi CLI) against root@43.163.112.77,
using the exact invocation ssh1.ps1 executes:
`ssh -o ServerAliveInterval=30 -o ServerAliveCountMax=3 -o TCPKeepAlive=no root@43.163.112.77`

### Results

- **Secret loading**: `secret_read.py` loads `SSH_CONNECTION_1` = `root@43.163.112.77` and
  `SSH_PASSWORD_1` (present, 13 chars) correctly. PASS.
- **Authentication**: server reports `passwordauthentication no` / `pubkeyauthentication yes`
  (`sshd -T`), so the script's password-paste branch cannot authenticate by itself. The
  connection succeeds via the local key `C:\Users\mpc\.ssh\id_ed25519`
  (SHA256:gYAnGUMLS4JzBbtW1IXXZkggNhJj0zHWsIWiNfmls2A), which is already in the server's
  `authorized_keys`. Under PowerShell (USERPROFILE=C:\Users\mpc) default key lookup finds it
  automatically; under Git Bash with a redirected HOME an explicit `-i` is required. PASS (key auth).
- **Keepalive options**: `ServerAliveInterval=30 ServerAliveCountMax=3 TCPKeepAlive=no` accepted,
  session stable, exit code 0. PASS.
- **Server-side state verified over SSH**: tmux persistence hook present
  (`/etc/profile.d/ncore_ssh_tmux_persistence.sh`, 644 root:root, dated 2026-09-18 07:49);
  sshd effective config confirmed: port 22, clientaliveinterval 60, clientalivecountmax 0,
  tcpkeepalive no. No tmux session currently running — it is created on the next interactive
  login by the profile.d hook. PASS.
- **Linux-side record**: this test was appended server-side to
  `/var/log/ncore/windows_ssh_client_test.log` so the Linux side has the Windows client
  feedback on file.

### Note for future regeneration

Since the server has password auth disabled, the password display / paste guidance printed by
ssh1.ps1 is moot for this server. Consider having the generator emit the key-auth branch
(no `SSH_PASSWORD_1`) for this connection, or add a hint that login relies on the local
`id_ed25519` key.

## Follow-up (2026-09-18) — Two simultaneous SSH windows mirrored each other

Symptom: with the hook above, every interactive login ran `tmux new-session -A -s main`,
so two open SSH windows attached to the SAME tmux session and shared one current window —
input typed in one window appeared in the other and both screens stayed in sync.

Fix (server side, deployed by the self-heal run):

1. `ssh_server_common.sh` `ssh_server_ensure_session_persistence()` hook now picks the first
   session name (`main`, `main-2`, `main-3`, ...) that is missing or has no attached clients:
   - A dropped connection leaves its session unattached, so a reconnect still resumes it
     (original persistence goal preserved).
   - A second simultaneous window gets its own session instead of mirroring the first.
2. Per the user's decision, auto-entry is disabled for root on this server:
   `touch /root/.ncore-no-auto-tmux` (the hook's per-user opt-out). Root logins now land in
   a plain shell; delete that file to re-enable the fixed per-window tmux behavior.
3. Self-heal re-run of `23_setup_ssh_remote.sh` (2026-09-18): all sshd/firewall steps
   converged `[SKIP]`, `/etc/profile.d/ncore_ssh_tmux_persistence.sh` rewritten with the
   new selection logic, `sh -n`/`bash -n` pass. Selection logic verified live against the
   running tmux server: attached `main` -> picks `main-2`; an unattached existing session
   is resumed.

Manual step for already-open windows (client side): press `Ctrl-b` then `d` in each window
to detach, then re-login. Do not use `exit`, which would close the shared shell.
