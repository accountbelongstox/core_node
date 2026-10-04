# Native Windows NSSM install (idempotent, via winget) through the shared
# NssmServiceManager. NSSM wraps a plain script/command as a Windows service the SCM
# can start/stop -- needed by poly_apps/*/scripts/start.ps1's background-service option.

# Variables (declared at the beginning of the file)
$WinCommonDir = Join-Path (Split-Path $PSScriptRoot -Parent) "win_common"
$RepoRootDir  = Split-Path (Split-Path (Split-Path (Split-Path $PSScriptRoot -Parent) -Parent) -Parent) -Parent
$COMPONENT_ID = 'BaseTools_Nssm'
$nssmPath     = $null

. (Join-Path $WinCommonDir "GlobalVars.ps1")
. (Join-Path $WinCommonDir "CommonFunc.ps1")
. (Join-Path $WinCommonDir "NssmServiceManager.ps1")

Write-ColorMessage "[$COMPONENT_ID] NSSM install (idempotent, via winget)" -Type "Info"

$nssmPath = Ensure-Nssm -RepoRootDir $RepoRootDir

if ($nssmPath) {
    Write-ColorMessage "[$COMPONENT_ID] NSSM ready: $nssmPath" -Type "Success"
} else {
    Write-ColorMessage "[$COMPONENT_ID] NSSM install incomplete - see messages above." -Type "Error"
}
