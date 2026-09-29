# dd.sh / dd.cmd: Tailscale Quick Menu, One-Step OS Upgrade, Unified AI Tools

Date: 2026-09-28
Scope: Linux `dd.sh` (scripts/shells/linux) and Windows `dd.cmd`/`dd.ps1`
(scripts/shells/win) in parity. Three tasks; each upgrades existing components
instead of adding parallel ones.

## Task 1: Tailscale quick menu (upgrade)

Existing (keep, upgrade): `menu_itemshells/tailscale_menu.sh` (Status, Devices,
Restart, Panel, Install/Reconfigure, Help) over `common/tailscale_common.sh`
(single source of truth) and `install_shells/97_install_tailscale.sh`.
Windows: `win_common/TailscaleCommon.ps1` via `WindowsManagementManager.ps1`.

Requirements:
1. Quick entry: "[T] Tailscale" in Linux System Tools (label shows the
   `INSTALL_TAILSCALE` flag and the connection state), Windows mirrored.
2. Items: Install/Repair, Settings, Open UI, All IPs, Status, Restart service,
   Logout/Login, Help. Every item calls the shared library/installer (no
   duplicated logic in menus).
3. All IPs: this machine (Tailscale IPv4/IPv6, MagicDNS name, LAN IPs) and every
   peer (hostname, OS, online, all TailscaleIPs, exit-node/relay), from
   `tailscale status --json`.
4. Settings (via `tailscale set`, never a destructive `up --reset` unless the
   user confirms): hostname, accept-routes, advertise-exit-node / use exit node,
   Tailscale SSH, shields-up, operator=<real user> (so the normal user can run
   the CLI without sudo). Show current values from `tailscale debug prefs` /
   status JSON.
5. Open UI: admin console + local web UI (`tailscale web`), opened as the real
   desktop user; print URLs when headless.
6. Windows parity: add a real installer (`winget install --id Tailscale.Tailscale -e`,
   idempotent) instead of the current hint-only path; same menu items.

## Task 2: One-step OS upgrade to the latest release (Debian and Ubuntu)

Root cause of "Ubuntu upgrade menu not shown": no Ubuntu upgrade feature exists;
only `upgrade_to_debian_13.sh` (Debian < 13) is wired.

Requirements:
1. One entry "Upgrade OS -> latest (<target>)" shown only when the host is
   Debian < 13 or Ubuntu < 26.04 (target resolved from the official metadata,
   not hard-coded beyond the minimum shown above).
2. Official paths only:
   - Debian: release notes "Upgrades from Debian N" chain (11 -> 12 -> 13), one
     major per hop, reusing/generalizing `upgrade_to_debian_13.sh` (backup,
     preflight, point-release update, sources reset, minimal + full upgrade).
   - Ubuntu: `do-release-upgrade` (update-manager-core); it only moves to the
     next sequential release, LTS->LTS only after the .1 point release
     (26.04.1 is out); `Prompt=lts` for LTS hosts, `normal` for interim ones;
     `apt dist-upgrade -o APT::Get::Always-Include-Phased-Updates=true` before
     each hop; unattended frontend `-f DistUpgradeViewNonInteractive`.
3. Multi-hop with reboots: after each hop that needs a reboot, register a
   one-shot resume unit (`ncore-os-upgrade-resume.service`, After=network-online)
   that re-runs the upgrader with `--resume`, prompt the user to reboot, and
   continue automatically after boot until the latest release. When finished
   (or on failure after N attempts) the unit, its state file and any temporary
   sources/backups flagged temporary are removed (cleanup is mandatory).
4. Idempotent: every step detects its state; re-running resumes. State lives in
   `/var/lib/core_node/os-upgrade/state`; logs in `/var/log/core_node-os-upgrade.log`.
5. Windows: no OS upgrade; the WSL Debian manager gets "Upgrade WSL Debian ->
   latest" that runs the same Linux upgrader inside the distro (reboot =
   `wsl --terminate` + resume on next launch).

## Task 3: AI & MCP Management -> AI Tools first; one AI tools script

### Current state (inventory 2026-09-28)
AI CLIs are scattered: 153 AI group (gemini, codex, cursor_agent, kimi, cline,
arkcli, superclaude, opencode, auggie, droid), 155 (cursor agent as real user,
no /usr/local/bin link), 165 (agy CLI), 171 (claude native + team + MCP), 177
(qwen; top-level `return` never skips -> reinstalls every run), 179 (zhipuai
SDK), 185 (pi/omp/bun; settings script path wrong), launchers
(`ai_cli_provision_common.sh`). Windows: Step21 ApplicationsList, Step41,
Step63, `AiCliProvisionCommon.ps1`.

### Requirements
1. One script owns every AI CLI install: Linux
   `install_shells/99_install_ai_tools.sh` + `common/ai_tools_catalog.sh`
   (catalog: key, command, method, package/URL, link name). Windows mirror
   `StepXX_InstallAiTools.ps1` + `win_common/AiToolsCatalog.ps1`. The code is
   extracted from 153/155/165/171/177/179/185 and `ai_cli_provision_common.sh`
   uses the catalog (no second package table). Old steps become thin callers or
   are removed; AI IDEs (Cursor IDE, Antigravity IDE, VS Code) stay desktop apps.
2. Ordering: the AI step runs after its dependencies (17 node/pnpm/bun, 13/15
   python venv, 25 uv, 27 git, 37 pnpm globals, 51 chrome). When run alone it
   idempotently runs those prerequisite steps first (each already skips work
   that is done).
3. Every tool installed as root into shared locations and linked into
   `/usr/local/bin` (all users). Per-tool, per-step idempotency: installed and
   linked -> no download.
4. Shared login between root and the normal user using each tool's official
   config-dir variable (e.g. Claude Code `CLAUDE_CONFIG_DIR`, Codex
   `CODEX_HOME`, others per their docs): one config dir owned by the real user,
   exported for root (profile.d / sudoers env_keep as documented), ownership
   repaired after root writes. Tools without an official variable are listed
   as not shareable.
5. MCP: only `apps/mcp-chrome`. The AI script builds it and installs it as the
   `ncore-mcp-chrome` service (existing `start.sh --service`, bun dev watch =
   hot reload for the server and extension), then syncs the chrome MCP entry
   into every installed AI tool. Native-host manifest registered for the real
   user and system-wide (fixes user/system path mismatch).
6. Menu redesign (both OSes): "AI Tools & MCP":
   Ensure ALL AI tools (one click) / per-tool install+upgrade / status table
   (installed, version, linked, login shared) / shared-login setup /
   mcp-chrome build+service (status, restart, logs) / sync chrome MCP to all
   tools / back. Remove the dead "OpenAI env" item.

## Verification (each task)
- `bash -n` on every changed shell file; PowerShell parse check on changed .ps1.
- Re-running any installer is a no-op when everything is present.
- Menus render and every item calls the shared script (no duplicated logic).

## Update 2026-09-29

- `tailscale_common.sh::ts_self_dnsname` is the single MagicDNS-name lookup (reused by `ts_show_all_ips`, domain setup and web access config). Any host with a connected tailscaled now gets `https://<machine>.<tailnet>.ts.net` → UI and `/laravel-api` → Laravel main (tailscale cert), additive to public domains, on Linux and Windows. See `FIX_20260929_2052_GPU_BLACKSCREEN_TAILNET_HTTPS_PERMISSIONS.md` §5.
