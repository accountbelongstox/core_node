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
