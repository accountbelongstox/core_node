---
name: dot-sourced-servicecontract-shadows-module
description: Get-ServiceContractValue fails with "$script:ServiceContractDocument cannot be retrieved" on the 2nd launcher run in one session; the bug only reproduces with two runs in one process
metadata:
  type: project
---

Dot-sourcing `ServiceContract.ps1` (launchers do, e.g. `codexyolo.ps1`) defines `Get-ServiceContractValue` whose `$script:ServiceContractDocument` is bound to the *calling script's* scope. Child scripts (e.g. `& WindowsPathFunction.ps1 "unique"` from `Invoke-AiCliNativeEnsure`) that load `SharedCacheEnv.ps1` resolved the bare name to that outer function first, not the private-module import, and hit StrictMode "variable has not been set".

**Why:** it only reproduced when the same PowerShell process ran the launcher twice (`& ./repro3.ps1; & ./repro3.ps1`), never with a single `-File` run, so a single-run test gives a false pass.

**How to apply:** SharedCacheEnv.ps1 now calls the module command via `$__sccGetContractValue = $module.ExportedCommands['Get-ServiceContractValue']`. Any new code loaded from a child script scope should bind the module command the same way. Test launcher scope bugs with two consecutive runs in one process. See [[shared-cache-env-load-side-effects]].
