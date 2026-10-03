<#
.SYNOPSIS
    DeepSeek Harness (dsh), DeepSeek's official agent CLI.

.DESCRIPTION
      deepseek                  Web UI (dsh web)
      deepseek -p "<task>"      one headless task in the current directory: answer, then exit
      deepseek <dsh args...>    passed to dsh unchanged
    Key: secret DEEPSEEK_API_KEY_1 -> DEEPSEEK_API_KEY. A missing dsh is installed
    through Step65_InstallAiTools.ps1 (catalog key dsh). Permissions follow dsh's own
    DSH_PERMISSION_MODE (default workspace-write).
    Linux counterpart: scripts/linuxenvs/deepseek.sh.
#>

$deepseekSecretKeyName = "DEEPSEEK_API_KEY_1"
$deepseekWebProfile = "web"
$deepseekHeadlessProfile = "headless"
$scriptActualPath = $PSCommandPath
$item = $null
$scriptCurrentPath = $null
$scriptsDirPath = $null
$winCommonDirPath = $null
$deepseekApiKey = ""
$dshArgs = @()
$dshExitCode = 0

$item = Get-Item -LiteralPath $PSCommandPath
if ($item -and $item -is [System.IO.FileInfo] -and $item.LinkType) {
    $scriptActualPath = $item.Target
}
$scriptCurrentPath = Split-Path $scriptActualPath -Parent
$scriptsDirPath = Split-Path $scriptCurrentPath -Parent
$winCommonDirPath = Join-Path (Join-Path (Join-Path $scriptsDirPath "shells") "win") "win_common"

. (Join-Path $winCommonDirPath "WindowsPathFunction.ps1")
Set-CoreNodePaths
. (Join-Path $winCommonDirPath "GlobalVars.ps1")
. (Join-Path $winCommonDirPath "AiCliProvisionCommon.ps1")

Invoke-AiCliProvision -Tool "dsh"

$deepseekApiKey = Read-SecretValue -Name $deepseekSecretKeyName
if (-not $deepseekApiKey) {
    Write-Host "[ERROR] DeepSeek API key not found ($deepseekSecretKeyName)." -ForegroundColor Red
    Write-Host "[ACTION] Set it with dd.cmd > Special Software Environment Variables > DeepSeek." -ForegroundColor Yellow
    exit 1
}
$env:DEEPSEEK_API_KEY = $deepseekApiKey

if ($args.Count -eq 0) {
    $dshArgs = @($deepseekWebProfile)
}
elseif (($args[0] -eq "-p") -or ($args[0] -eq "--print")) {
    $dshArgs = @("--profile", $deepseekHeadlessProfile) + @($args | Select-Object -Skip 1)
}
else {
    $dshArgs = @($args)
}

Write-Host "[INFO] DeepSeek Harness $(Get-AiCliVersion -VersionText ((& dsh --version 2>$null) | Out-String)); key $(Get-AiCliMaskedSecret -Value $deepseekApiKey)" -ForegroundColor White
Write-Host "[INFO] Workspace: $((Get-Location).Path)" -ForegroundColor White
& dsh @dshArgs
$dshExitCode = $LASTEXITCODE
exit $dshExitCode
