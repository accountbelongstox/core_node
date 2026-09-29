# FIX 2026-09-30 00:04 — Cross-device claudeteam, role dedup, Claude settings preset, shared-dir ownership and auth backfill

Host: `debian-cpu` (Linux). Windows changes are parse-checked and unit-tested under pwsh on Linux only; the server (laravel-remote) is not verified.
Related: `FIX_20260929_2052_GPU_BLACKSCREEN_TAILNET_HTTPS_PERMISSIONS.md` (Tailscale), `development-guides/claude_code/CLAUDE_CODE_AGENTS_GUIDE.md` §8.

## Requirements (user, 2026-09-29/30)

1. Window Launcher gets a cross-device mode. py only starts `claudeteam`; claudeteam resolves the Tailscale device and IP, the profile and the role. Shared helpers are allowed.
2. Profiles (minimal orchestration, one doc):
   - GPU host: 2 claudeteam — pyservice full-stack, and the shell role of this OS (Windows/Linux).
   - Desktop without GPU (debian-cpu): 4 claudeteam — shell-linux, pycore UI / pycore-manager, ui-wordnew full-stack, laravel-manager full-stack (new role).
   - Server (no graphical interface = server): laravel backend / 175 deploy (`laravel-remote`).
   - Other cells run plain Claude Code.
3. Session name = `<device>-<role full name>-<abbr>` with `--remote-control`. When it cannot be added at launch, print the manual `/remote-control <name>` line.
4. Remove roles that duplicate the roles above.
5. claudeteam presets (user's command, preset in shell, not Claude's own initiative), Plan A only: `crossSessionInbound=accept`; `permissions.allow` += `SendMessage`, `ListAgents`; `autoMode.allow` = `"$defaults"` + a rule that messaging the user's own sessions is routine. A helper py guards against broken settings. It is idempotent: in-place update (never delete and recreate), all other config and login kept, and preset text changes are propagated.
6. `claudeteam.sh` as root with the shared dir: chown once before launch; the `--device-slot` path also runs the post-exit chown.
7. When first-run setup or project trust is missing in `$CLAUDE_CONFIG_DIR/.claude.json`, fill only the missing parts from `~/.claude.json`.

## Implementation

| Area | Files |
|---|---|
| Launcher menu `[4]` / `--mode device` (i18n en/zh) | `pycore/pyutils/launcher/launcher.py`, `grid_profile.py` (`enable_cross_device_mode`, cells 1–8 → `claudeteam --device-slot <n>`), `launcher_i18n/{en,zh}/grid.json` |
| Device profile helpers | `scripts/shells/linux/common/claude_device_profile_common.sh`, `scripts/shells/win/win_common/ClaudeDeviceProfileCommon.ps1` (Tailscale name/IP via existing Tailscale libs; GPU via `gpu_hardware_present` / PCI `VEN_10DE`; server = no `graphical.target` and no `DISPLAY`/`WAYLAND_DISPLAY`) |
| `--device-slot` | `scripts/linuxenvs/claudeteam.sh`, `scripts/winenvs/claudeteam.ps1` |
| Profiles | `config/claude_team_roles.json` `device_profiles` (`{os}` = windows/linux) |
| New role | `.claude/agents/laravel-manager-lead.md`; catalog row, tab group, group |
| Removed duplicate roles | `laravel`, `laravel-api`, `laravel-codemart`, `laravel-qyapp`, `pycore`, `ui-codemart`, `ui-laravel-manager`, `ui-pycore-manager`, `ui-wordnew`, `mcp-chrome` (agent files, catalog rows, guide routing table); `pycore-ui` / `laravel-remote` descriptions updated |
| Settings preset | `scripts/ai_shtools/claude_team_settings.py` + catalog `user_settings_preset`; `crossSessionInbound` moved out of add-only `user_settings_merge`; run by both claudeteam launchers on every launch (the remote pane runs claudeteam.sh on the server) |
| Ownership | `claudeteam.sh` `claude_team_restore_shared_owner`: before launch and after exit; the plain `--device-slot` path no longer `exec`s |
| Auth backfill | `claude_team_settings.py` `backfill_global_config`: `hasCompletedOnboarding`, `lastOnboardingVersion`, missing `projects` entries, and in existing projects only `hasTrustDialogAccepted` / `hasCompletedProjectOnboarding`; false in target with true in source counts as missing; `oauthAccount`, metrics and all other keys untouched |

Helper rules (`claude_team_settings.py`):
- Scalars are enforced and objects merged.
- List items that were withdrawn from the preset are removed (tracked in `<config dir>/core_node_settings_preset.json`); user items are kept.
- `"$defaults"` is added only to lists this tool creates.
- Invalid JSON is left untouched.
- Every write takes a `.bak`, then rewrites the same file in place (same inode, owner, mode; original indent kept).
- `--check` only reports.

## Verification

- Linux claudeteam with a stub `claude`:
  - slot 4 → `laravel-manager-lead`, `--name debian-cpu-laravel-manager-lead-lml --remote-control …`
  - slot 5 → plain claude
  - `ANTHROPIC_BASE_URL` set → no RC flag plus the `[ACTION] … /remote-control …` line
- Profile detection: `debian-cpu` → desktop; simulated headless → server.
- PS slot/abbreviation logic tested under pwsh with the Tailscale import stubbed.
- Preset on scratch files — every case behaved as designed:
  - check
  - first apply keeps foreign keys
  - rerun = SKIP
  - preset text change replaces the old item
  - invalid JSON untouched
  - inode, owner and mode unchanged
- Real `/home/debian/.claude/settings.json`: two runs = SKIP; inode, size and mtime unchanged; all original keys kept.
- Root chown test (shared dir owned by debian): the preset state file is owned by debian at launch, and a root-written file is owned by debian after exit, on both slot paths.
- Auth restore: `/home/debian/.claude/.claude.json` had `oauthAccount` but no onboarding flag and 0 projects (the trust/onboarding screens reappeared).
  - Merged from `/home/debian/.claude.json` in place: 21 → 57 keys, onboarding true, `/www/programing/core_node` trusted; `.bak` kept; rerun = SKIP.
  - `.credentials.json` was never touched.

## Open items

- The server and Windows are not run end to end (Windows: a real `--device-slot` launch and the preset run; server: the preset applied by the remote pane).
- The Tailscale machine that shows `[T] Tailscale [false|NeedsLogin]` needs Install/Repair (sets `INSTALL_TAILSCALE=true`) and a login. Until then its sessions are named after the hostname.
- A server that has an NVIDIA GPU but no graphical interface resolves to `gpu` (GPU is checked first).
- Windows has no server profile; the desktop profile's first slot there is `shell-windows`.
- Orphaned `.claude/agent-memory/<removed role>/` directories were kept.
- Auto mode blocked the preset writes three times (`[Self-Modification]`). They were written in Manual mode, with each write approved by the user.
