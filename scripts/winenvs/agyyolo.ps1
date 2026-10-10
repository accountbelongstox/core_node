# =============================================================================
# Antigravity CLI Launch Script [YOLO Auto Mode]
# =============================================================================

Set-StrictMode -Version Latest
$ErrorActionPreference = "Stop"

$scriptPath = $null
$scriptsDirPath = $null
$coreNodePath = $null
$shellsWinPath = $null
$winCommonDirPath = $null
$windowsPathFunctionScript = $null
$aiCliProvisionScript = $null
$serviceContractScript = $null
$mcpChromeHost = $null
$mcpChromeUrl = $null
$mcpChromePort = 0
$agyCommand = $null
$agyCandidatePath = $null
$localAppDataPath = $null
$agyBinDirPath = $null
$modelDeadline = $null
$modelKey = $null
$modelPick = $null
$agyModel = "gemini-3.8-flash-high"
$agyModelLabel = "Gemini 3.8 Flash (High)"
$agyArgs = @()
$displayArgs = $null
$userProfilePath = $null
$geminiConfigDirPath = $null
$geminiMcpConfigPath = $null
$geminiCliDirPath = $null
$geminiSettingsPath = $null
$mcpConfig = $null
$mcpServersProperty = $null
$mcpServers = $null
$chromeMcpConfig = $null
$chromeMcpProperty = $null
$mcpJson = $null
$utf8Encoding = $null
$settingsJson = $null
$trustedWorkspacesProperty = $null
$currentLocationPath = $null
$workspacesList = $null

$scriptPath = $PSScriptRoot
if ([string]::IsNullOrWhiteSpace($scriptPath)) {
    $scriptPath = Split-Path -Parent $MyInvocation.MyCommand.Path
}
$scriptsDirPath = Split-Path $scriptPath -Parent
$coreNodePath = Split-Path $scriptsDirPath -Parent
$shellsWinPath = Join-Path $scriptsDirPath "shells"
$shellsWinPath = Join-Path $shellsWinPath "win"
$winCommonDirPath = Join-Path $shellsWinPath "win_common"
$windowsPathFunctionScript = Join-Path $winCommonDirPath "WindowsPathFunction.ps1"
$aiCliProvisionScript = Join-Path $winCommonDirPath "AiCliProvisionCommon.ps1"
$serviceContractScript = Join-Path $winCommonDirPath "ServiceContract.ps1"
. $windowsPathFunctionScript
. $serviceContractScript
. $aiCliProvisionScript
Set-CoreNodePaths

$mcpChromeHost = Get-ServiceContractHost -Name "loopback"
$mcpChromePort = Get-ServiceContractPort -Name "mcp_chrome"
$mcpChromeUrl = New-ServiceContractUrl -Protocol "http" -HostName $mcpChromeHost -Port $mcpChromePort -Path "mcp"

Write-Host ""
Write-Host "============================================================" -ForegroundColor Cyan
Write-Host "agyyolo.ps1 - Antigravity CLI YOLO Auto Mode" -ForegroundColor Yellow
Write-Host "============================================================" -ForegroundColor Cyan

$localAppDataPath = [System.Environment]::GetFolderPath([System.Environment+SpecialFolder]::LocalApplicationData)
$agyBinDirPath = Join-Path $localAppDataPath "agy"
$agyBinDirPath = Join-Path $agyBinDirPath "bin"
$agyCandidatePath = Join-Path $agyBinDirPath "agy.exe"

$agyCommand = Get-Command agy -ErrorAction SilentlyContinue
if ($null -eq $agyCommand) {
    if (Test-Path -LiteralPath $agyCandidatePath) {
        $env:PATH = [string]::Join([System.IO.Path]::PathSeparator, @($agyBinDirPath, $env:PATH))
        $agyCommand = Get-Command agy -ErrorAction SilentlyContinue
    }
}

if ($null -eq $agyCommand) {
    Write-Host "[INFO] agy is not available on PATH; installing via official installer..." -ForegroundColor Cyan
    Invoke-RestMethod -Uri "https://antigravity.google/cli/install.ps1" | Invoke-Expression
    if (Test-Path -LiteralPath $agyBinDirPath) {
        $env:PATH = [string]::Join([System.IO.Path]::PathSeparator, @($agyBinDirPath, $env:PATH))
    }
    $agyCommand = Get-Command agy -ErrorAction SilentlyContinue
}

if ($null -eq $agyCommand) {
    throw "agy is not available on PATH."
}

# Model selection (default 1 = Gemini 3.8 Flash High; auto-select in 5 seconds)
Write-Host "Select model (default 1 = Gemini 3.8 Flash High; auto-select in 5 seconds):" -ForegroundColor Yellow
Write-Host "  [1] Gemini 3.8 Flash High (gemini-3.8-flash-high)" -ForegroundColor White
Write-Host "  [2] Claude Sonnet 4.6 Thinking (claude-sonnet-4-6)" -ForegroundColor White
Write-Host "  [3] Gemini 3.1 Pro High (gemini-3.1-pro-high)" -ForegroundColor White
Write-Host "  [4] Claude Opus 4.6 Thinking (claude-opus-4-6-thinking)" -ForegroundColor White
Write-Host "Model number [1-4] (Enter or timeout = 1): " -ForegroundColor Yellow -NoNewline

$modelDeadline = (Get-Date).AddSeconds(5)
while ((Get-Date) -lt $modelDeadline) {
    if ([Console]::KeyAvailable) {
        $modelKey = [Console]::ReadKey($true)
        if ($modelKey.Key -ne [ConsoleKey]::Enter) {
            $modelPick = [string]$modelKey.KeyChar
            Write-Host $modelPick
        }
        break
    }
    Start-Sleep -Milliseconds 100
}
while ([Console]::KeyAvailable) {
    [Console]::ReadKey($true) | Out-Null
}
if ([string]::IsNullOrWhiteSpace($modelPick)) {
    Write-Host "1 (auto)"
}
switch ($modelPick) {
    "2" { $agyModel = "claude-sonnet-4-6"; $agyModelLabel = "Claude Sonnet 4.6 Thinking" }
    "3" { $agyModel = "gemini-3.1-pro-high"; $agyModelLabel = "Gemini 3.1 Pro High" }
    "4" { $agyModel = "claude-opus-4-6-thinking"; $agyModelLabel = "Claude Opus 4.6 Thinking" }
    default { $agyModel = "gemini-3.8-flash-high"; $agyModelLabel = "Gemini 3.8 Flash (High)" }
}
Write-Host "[INFO] Model: $agyModelLabel ($agyModel)" -ForegroundColor White

# Chrome MCP service ensure and registration
$userProfilePath = [System.Environment]::GetFolderPath([System.Environment+SpecialFolder]::UserProfile)
$geminiConfigDirPath = Join-Path $userProfilePath ".gemini"
$geminiConfigDirPath = Join-Path $geminiConfigDirPath "config"
if (-not (Test-Path -LiteralPath $geminiConfigDirPath)) {
    New-Item -ItemType Directory -Path $geminiConfigDirPath -Force | Out-Null
}
$geminiMcpConfigPath = Join-Path $geminiConfigDirPath "mcp_config.json"
$utf8Encoding = New-Object System.Text.UTF8Encoding($false)

Invoke-AiCliChromeServiceEnsure

# Register Chrome MCP in Antigravity
& $agyCommand.Source mcp add chrome $mcpChromeUrl | Out-Null

if (Test-Path -LiteralPath $geminiMcpConfigPath) {
    try {
        $mcpConfig = Get-Content -Raw -LiteralPath $geminiMcpConfigPath | ConvertFrom-Json
    } catch {
        $mcpConfig = [PSCustomObject]@{}
    }
} else {
    $mcpConfig = [PSCustomObject]@{}
}
if ($null -eq $mcpConfig) {
    $mcpConfig = [PSCustomObject]@{}
}
$mcpServersProperty = $mcpConfig.PSObject.Properties["mcpServers"]
if ($null -eq $mcpServersProperty) {
    $mcpServers = [PSCustomObject]@{}
    $mcpConfig | Add-Member -MemberType NoteProperty -Name "mcpServers" -Value $mcpServers
} elseif ($null -eq $mcpServersProperty.Value) {
    $mcpServers = [PSCustomObject]@{}
    $mcpServersProperty.Value = $mcpServers
} else {
    $mcpServers = $mcpServersProperty.Value
}
$chromeMcpConfig = [PSCustomObject]@{
    disabled = $false
    serverUrl = $mcpChromeUrl
}
$chromeMcpProperty = $mcpServers.PSObject.Properties["chrome"]
if ($null -eq $chromeMcpProperty) {
    $mcpServers | Add-Member -MemberType NoteProperty -Name "chrome" -Value $chromeMcpConfig
} else {
    $chromeMcpProperty.Value = $chromeMcpConfig
}
$mcpJson = $mcpConfig | ConvertTo-Json -Depth 20
[System.IO.File]::WriteAllText($geminiMcpConfigPath, $mcpJson, $utf8Encoding)
Write-Host "[INFO] Chrome MCP registered in Antigravity: $geminiMcpConfigPath" -ForegroundColor Green

# Auto-configure workspace trust in settings.json
$geminiCliDirPath = Join-Path $userProfilePath ".gemini"
$geminiCliDirPath = Join-Path $geminiCliDirPath "antigravity-cli"
if (-not (Test-Path -LiteralPath $geminiCliDirPath)) {
    New-Item -ItemType Directory -Path $geminiCliDirPath -Force | Out-Null
}
$geminiSettingsPath = Join-Path $geminiCliDirPath "settings.json"
$currentLocationPath = (Get-Location).Path
if (Test-Path -LiteralPath $geminiSettingsPath) {
    try {
        $settingsJson = Get-Content -Raw -LiteralPath $geminiSettingsPath | ConvertFrom-Json
    } catch {
        $settingsJson = [PSCustomObject]@{}
    }
} else {
    $settingsJson = [PSCustomObject]@{}
}
if ($null -eq $settingsJson) {
    $settingsJson = [PSCustomObject]@{}
}
$trustedWorkspacesProperty = $settingsJson.PSObject.Properties["trustedWorkspaces"]
if ($null -eq $trustedWorkspacesProperty) {
    $settingsJson | Add-Member -MemberType NoteProperty -Name "trustedWorkspaces" -Value @($coreNodePath, $currentLocationPath)
} else {
    $workspacesList = [System.Collections.Generic.List[string]]::new()
    if ($trustedWorkspacesProperty.Value) {
        foreach ($w in $trustedWorkspacesProperty.Value) {
            $workspacesList.Add([string]$w)
        }
    }
    if (-not $workspacesList.Contains($coreNodePath)) {
        $workspacesList.Add($coreNodePath)
    }
    if (-not $workspacesList.Contains($currentLocationPath)) {
        $workspacesList.Add($currentLocationPath)
    }
    $trustedWorkspacesProperty.Value = $workspacesList.ToArray()
}
[System.IO.File]::WriteAllText($geminiSettingsPath, ($settingsJson | ConvertTo-Json -Depth 20), $utf8Encoding)

$displayArgs = if ($args.Count -gt 0) {
    [string]::Format("; extra args: {0}", ($args -join " "))
} else {
    ""
}

Write-Host "[INFO] Launch: agy --dangerously-skip-permissions --mode accept-edits --model $agyModel$displayArgs" -ForegroundColor Green
Write-Host "============================================================" -ForegroundColor Cyan
Write-Host ""

$agyArgs = @("--dangerously-skip-permissions", "--mode", "accept-edits", "--model", $agyModel)
& $agyCommand.Source @agyArgs @args
