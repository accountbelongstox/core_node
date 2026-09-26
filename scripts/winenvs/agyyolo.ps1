# ### AI SPECIAL ATTENTION RULES START ###
# When AI/ALL DEVELOPERS sees this prompt, MUST IMMEDIATELY COMPLY WITH THESE RULES:
# 1. Write all code in English only.
# 2. Never execute, create, or modify test code.
# 3. Never create or update documentation (*.md).
# 4. Never write summaries during development or thinking process.
# 5. Declare all variables at the beginning of the file.
# 6. For PowerShell (*.ps1) scripts: Do not append strings directly to variables, Do not use relative paths such as "..\..\"; instead resolve absolute paths using parent path parsing (Split-Path, Join-Path, or Resolve-Path).
# 7. Do not modify these rules.
# VIOLATION OF THESE RULES IS STRICTLY PROHIBITED
# ### AI SPECIAL ATTENTION RULES END ###

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
$serviceContractScript = $null
$mcpChromePath = $null
$mcpChromeNodeModulesPath = $null
$mcpChromeSharedArtifactPath = $null
$mcpChromeNativeArtifactPath = $null
$mcpChromeExtensionManifestPath = $null
$mcpChromeRegisterScriptPath = $null
$mcpChromeEnsureWinBinScriptPath = $null
$mcpChromeSupervisorScriptPath = $null
$mcpChromeNeedsDependencies = $false
$mcpChromeNeedsBuild = $false
$mcpChromeInstalled = $false
$mcpChromeJustInstalled = $false
$mcpChromeHost = $null
$mcpChromeUrl = $null
$mcpChromePort = 0
$mcpChromePortReady = $false
$mcpChromePortWaitCount = 0
$mcpChromePython = $null
$mcpChromeSupervisorArgs = @()
$existingMcpJsonText = ""
$previousLocation = $null
$pnpmCommand = $null
$nodeCommand = $null
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
$serviceContractScript = Join-Path $winCommonDirPath "ServiceContract.ps1"
. $windowsPathFunctionScript
. $serviceContractScript
Set-CoreNodePaths

$mcpChromePath = Join-Path $coreNodePath "apps"
$mcpChromePath = Join-Path $mcpChromePath "mcp-chrome"
$mcpChromeNodeModulesPath = Join-Path $mcpChromePath "node_modules"
$mcpChromeSharedArtifactPath = Join-Path $mcpChromePath "packages"
$mcpChromeSharedArtifactPath = Join-Path $mcpChromeSharedArtifactPath "shared"
$mcpChromeSharedArtifactPath = Join-Path $mcpChromeSharedArtifactPath "dist"
$mcpChromeSharedArtifactPath = Join-Path $mcpChromeSharedArtifactPath "index.js"
$mcpChromeNativeArtifactPath = Join-Path $mcpChromePath "app"
$mcpChromeNativeArtifactPath = Join-Path $mcpChromeNativeArtifactPath "native-server"
$mcpChromeNativeArtifactPath = Join-Path $mcpChromeNativeArtifactPath "dist"
$mcpChromeNativeArtifactPath = Join-Path $mcpChromeNativeArtifactPath "index.js"
$mcpChromeExtensionManifestPath = Join-Path $mcpChromePath ".output"
$mcpChromeExtensionManifestPath = Join-Path $mcpChromeExtensionManifestPath "build_extension"
$mcpChromeExtensionManifestPath = Join-Path $mcpChromeExtensionManifestPath "manifest.json"
$mcpChromeRegisterScriptPath = Join-Path $mcpChromePath "scripts"
$mcpChromeEnsureWinBinScriptPath = Join-Path $mcpChromeRegisterScriptPath "ensure_win_bin.ps1"
$mcpChromeSupervisorScriptPath = Join-Path $mcpChromeRegisterScriptPath "service_supervisor.py"
$mcpChromeRegisterScriptPath = Join-Path $mcpChromeRegisterScriptPath "register-local-dev.cjs"

$mcpChromeHost = Get-ServiceContractHost -Name "loopback"
$mcpChromePort = Get-ServiceContractPort -Name "mcp_chrome"
$mcpChromeUrl = New-ServiceContractUrl -Protocol "http" -HostName $mcpChromeHost -Port $mcpChromePort -Path "mcp"
$mcpChromePython = (Resolve-Path -LiteralPath $Global:PYTHON_EXE_PATH).Path

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

# Chrome MCP (apps/mcp-chrome) setup & auto-load
$userProfilePath = [System.Environment]::GetFolderPath([System.Environment+SpecialFolder]::UserProfile)
$geminiConfigDirPath = Join-Path $userProfilePath ".gemini"
$geminiConfigDirPath = Join-Path $geminiConfigDirPath "config"
if (-not (Test-Path -LiteralPath $geminiConfigDirPath)) {
    New-Item -ItemType Directory -Path $geminiConfigDirPath -Force | Out-Null
}
$geminiMcpConfigPath = Join-Path $geminiConfigDirPath "mcp_config.json"
$utf8Encoding = New-Object System.Text.UTF8Encoding($false)

$mcpChromeNeedsDependencies = -not (Test-Path -LiteralPath $mcpChromeNodeModulesPath)
$mcpChromeNeedsBuild = (-not (Test-Path -LiteralPath $mcpChromeSharedArtifactPath)) -or
    (-not (Test-Path -LiteralPath $mcpChromeNativeArtifactPath)) -or
    (-not (Test-Path -LiteralPath $mcpChromeExtensionManifestPath))

$mcpChromeInstalled = $false
if ((Test-Path -LiteralPath $geminiMcpConfigPath) -and (-not $mcpChromeNeedsBuild)) {
    $existingMcpJsonText = [System.IO.File]::ReadAllText($geminiMcpConfigPath)
    if ($existingMcpJsonText -match '"chrome"') {
        $mcpChromeInstalled = $true
    }
}

$nodeCommand = Get-Command node -ErrorAction SilentlyContinue
$pnpmCommand = Get-Command pnpm -ErrorAction SilentlyContinue

if ($mcpChromeInstalled) {
    Write-Host "[INFO] Chrome MCP already installed and configured." -ForegroundColor Green
} else {
    $mcpChromeJustInstalled = $true
    if ($mcpChromeNeedsDependencies -or $mcpChromeNeedsBuild) {
        if ($null -eq $nodeCommand) {
            throw "node is required to build Chrome MCP."
        }
        if ($null -eq $pnpmCommand) {
            throw "pnpm is required to build Chrome MCP."
        }
        Write-Host "[INFO] Ensuring Chrome MCP dependencies and artifacts..." -ForegroundColor Cyan
        $previousLocation = Get-Location
        try {
            Set-Location -LiteralPath $mcpChromePath
            if ($mcpChromeNeedsDependencies) {
                & $pnpmCommand.Source install
            }
            if ($mcpChromeNeedsBuild) {
                & $mcpChromeEnsureWinBinScriptPath -WorkspaceRoot $mcpChromePath
                & $pnpmCommand.Source run build:all
            }
            & $nodeCommand.Source $mcpChromeRegisterScriptPath
        } finally {
            Set-Location -LiteralPath $previousLocation
        }
    }

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
}

# Ensure Chrome MCP supervisor is running
$mcpChromePortReady = $null -ne (Get-NetTCPConnection -LocalPort $mcpChromePort -State Listen -ErrorAction SilentlyContinue | Select-Object -First 1)
if (-not $mcpChromePortReady) {
    $mcpChromeSupervisorArgs = @(
        $mcpChromeSupervisorScriptPath,
        "--project-root", $mcpChromePath,
        "--watch-mode", "dev"
    )
    if ($mcpChromeNeedsBuild) {
        $mcpChromeSupervisorArgs += @("--recover-on-start")
    }
    Write-Host "[INFO] Starting Chrome MCP development service..." -ForegroundColor Cyan
    Start-Process -FilePath $mcpChromePython -ArgumentList $mcpChromeSupervisorArgs -WindowStyle Hidden
    if ($mcpChromeJustInstalled) {
        while (-not $mcpChromePortReady -and $mcpChromePortWaitCount -lt 20) {
            Start-Sleep -Milliseconds 500
            $mcpChromePortReady = $null -ne (Get-NetTCPConnection -LocalPort $mcpChromePort -State Listen -ErrorAction SilentlyContinue | Select-Object -First 1)
            $mcpChromePortWaitCount = $mcpChromePortWaitCount + 1
        }
    }
}
if ($mcpChromePortReady) {
    Write-Host ("[INFO] Chrome MCP is listening on {0}:{1}." -f $mcpChromeHost, $mcpChromePort) -ForegroundColor Green
} else {
    Write-Host "[INFO] Chrome MCP service initialized ($mcpChromeUrl)." -ForegroundColor DarkGray
}

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
