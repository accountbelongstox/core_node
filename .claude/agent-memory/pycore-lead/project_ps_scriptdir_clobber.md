---
name: ps-scriptdir-clobber-nexus-dash
description: Dot-sourcing win_common/GlobalVars.ps1 clobbered the caller's $ScriptDir (PowerShell vars are case-insensitive), so nexus-dash NSSM service was registered with a nonexistent script and sat Paused
metadata:
  type: project
---

GlobalVars.ps1 used top-level `$scriptDir = $PSScriptRoot`; any launcher that dot-sources it (start.ps1 via FrankenPhpManager.ps1) had its own `$ScriptDir` overwritten with win_common. start.ps1 built `$SelfScript` after that, so `ncore-nexus-dash` got `-File ...\win_common\start.ps1` (missing) and NSSM left the service Paused; port 13054 never opened.

**Why:** found while debugging "127.0.0.1:13054 not reachable". Fixed by renaming the GlobalVars variable to `$globalVarsDirectory`, using `$PSCommandPath` for `$SelfScript`, and treating Paused as restartable in NssmServiceManager (Get-ServiceRunState now returns "paused").

**How to apply:** in dot-sourced win_common files never assign generic names (`$scriptDir`, `$root`) at top level; derive caller paths from `$PSCommandPath`/`$PSScriptRoot` before any dot-source. Related: [[dot-sourced-servicecontract-shadows-module]].
