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

Set-StrictMode -Version Latest
$ErrorActionPreference = "Stop"

$scriptPath = $null
$scriptsDirPath = $null
$coreNodePath = $null
$shellsWinPath = $null
$winCommonDirPath = $null
$windowsPathFunctionScript = $null
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
$mcpChromeUrl = "http://127.0.0.1:12306/mcp"
$mcpChromePort = 12306
$mcpChromePortReady = $false
$mcpChromePortWasReady = $false
$mcpChromePortWaitCount = 0
$mcpChromePython = $null
$mcpChromeSupervisorArgs = @()
$previousLocation = $null
$upgradeChoice = $null
$kimiInstallerUrl = "https://code.kimi.com/kimi-code/install.ps1"
$kimiInstallerScript = $null
$pnpmCommand = $null
$nodeCommand = $null
$kimiCommand = $null
$currentVersionOutput = $null
$latestVersionOutput = $null
$currentVersionTokens = @()
$latestVersionTokens = @()
$versionSeparators = @()
$versionToken = $null
$versionCandidate = $null
$currentVersion = $null
$latestVersion = $null
$versionGapLarge = $false
$kimiArgs = @()
$displayArgs = $null
$userProfilePath = $null
$currentLocationPath = $null
$kimiCodeHomeCandidatePath = $null
$kimiCodeHomePath = $null
$kimiMcpConfigPath = $null
$mcpConfig = $null
$mcpServersProperty = $null
$mcpServers = $null
$chromeMcpConfig = $null
$chromeMcpProperty = $null
$mcpJson = $null
$utf8Encoding = $null

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
. $windowsPathFunctionScript
Set-CoreNodePaths
$mcpChromePython = (Resolve-Path -LiteralPath $Global:PYTHON_EXE_PATH).Path

Write-Host ""
Write-Host "============================================================" -ForegroundColor Cyan
Write-Host "kimiyolo.ps1" -ForegroundColor Yellow
Write-Host "============================================================" -ForegroundColor Cyan

$kimiCommand = Get-Command kimi -ErrorAction SilentlyContinue
if ($null -eq $kimiCommand) {
    throw "kimi is not available on PATH."
}
$pnpmCommand = Get-Command pnpm -ErrorAction SilentlyContinue
$versionSeparators = @([char]' ', [char]"`t", [char]"`r", [char]"`n")
if ($null -ne $pnpmCommand) {
    $currentVersionOutput = (& $kimiCommand.Source --version 2>$null | Out-String).Trim()
    $latestVersionOutput = (& $pnpmCommand.Source view "@moonshot-ai/kimi-code" version 2>$null | Out-String).Trim()
    $currentVersionTokens = $currentVersionOutput.Split($versionSeparators, [System.StringSplitOptions]::RemoveEmptyEntries)
    foreach ($versionToken in $currentVersionTokens) {
        $versionCandidate = $versionToken.Trim()
        if ($versionCandidate.StartsWith("v", [System.StringComparison]::OrdinalIgnoreCase)) {
            $versionCandidate = $versionCandidate.Substring(1)
        }
        if ([System.Version]::TryParse($versionCandidate, [ref]$currentVersion)) {
            break
        }
    }
    $latestVersionTokens = $latestVersionOutput.Split($versionSeparators, [System.StringSplitOptions]::RemoveEmptyEntries)
    foreach ($versionToken in $latestVersionTokens) {
        $versionCandidate = $versionToken.Trim()
        if ($versionCandidate.StartsWith("v", [System.StringComparison]::OrdinalIgnoreCase)) {
            $versionCandidate = $versionCandidate.Substring(1)
        }
        if ([System.Version]::TryParse($versionCandidate, [ref]$latestVersion)) {
            break
        }
    }
}
if (($null -ne $currentVersion) -and ($null -ne $latestVersion) -and ($latestVersion -gt $currentVersion)) {
    $versionGapLarge = ($latestVersion.Major -gt $currentVersion.Major) -or
        (($latestVersion.Major -eq $currentVersion.Major) -and ($latestVersion.Minor -gt $currentVersion.Minor))
}
if ($versionGapLarge) {
    Write-Host "Upgrade Kimi Code CLI with the official native installer? [N/y]: " -ForegroundColor Yellow -NoNewline
    $upgradeChoice = Read-Host
}
if (($upgradeChoice -eq "y") -or ($upgradeChoice -eq "Y")) {
    Write-Host "[INFO] Upgrading Kimi Code CLI with the official native installer..." -ForegroundColor Cyan
    $kimiInstallerScript = Invoke-RestMethod -Uri $kimiInstallerUrl
    Invoke-Expression $kimiInstallerScript
    Write-Host "[INFO] Kimi Code CLI native upgrade command completed." -ForegroundColor Green
} elseif ($versionGapLarge) {
    Write-Host "[INFO] Kimi Code CLI upgrade skipped." -ForegroundColor DarkGray
}

$mcpChromeNeedsDependencies = -not (Test-Path -LiteralPath $mcpChromeNodeModulesPath)
$mcpChromeNeedsBuild = (-not (Test-Path -LiteralPath $mcpChromeSharedArtifactPath)) -or
    (-not (Test-Path -LiteralPath $mcpChromeNativeArtifactPath)) -or
    (-not (Test-Path -LiteralPath $mcpChromeExtensionManifestPath))
$nodeCommand = Get-Command node -ErrorAction SilentlyContinue
if ($null -eq $nodeCommand) {
    throw "node is required to install Chrome MCP."
}
if ($mcpChromeNeedsDependencies -or $mcpChromeNeedsBuild) {
    $pnpmCommand = Get-Command pnpm -ErrorAction SilentlyContinue
    if ($null -eq $pnpmCommand) {
        throw "pnpm is required to install Chrome MCP."
    }
}

Write-Host "[INFO] Ensuring Chrome MCP is installed..." -ForegroundColor Cyan
$previousLocation = Get-Location
try {
    Set-Location -LiteralPath $mcpChromePath
    if ($mcpChromeNeedsDependencies) {
        Write-Host "[INFO] Installing Chrome MCP dependencies..." -ForegroundColor Cyan
        & $pnpmCommand.Source install
    }
    if ($mcpChromeNeedsBuild) {
        & $mcpChromeEnsureWinBinScriptPath -WorkspaceRoot $mcpChromePath
        Write-Host "[INFO] Building missing Chrome MCP artifacts..." -ForegroundColor Cyan
        & $pnpmCommand.Source run build:all
    }
    & $nodeCommand.Source $mcpChromeRegisterScriptPath
} finally {
    Set-Location -LiteralPath $previousLocation
}

$userProfilePath = [Environment]::GetFolderPath([Environment+SpecialFolder]::UserProfile)
$currentLocationPath = (Get-Location).Path
if ([string]::IsNullOrWhiteSpace($env:KIMI_CODE_HOME)) {
    $kimiCodeHomeCandidatePath = Join-Path $userProfilePath ".kimi-code"
} elseif ([System.IO.Path]::IsPathRooted($env:KIMI_CODE_HOME)) {
    $kimiCodeHomeCandidatePath = $env:KIMI_CODE_HOME
} else {
    $kimiCodeHomeCandidatePath = Join-Path $currentLocationPath $env:KIMI_CODE_HOME
}
if (-not (Test-Path -LiteralPath $kimiCodeHomeCandidatePath)) {
    New-Item -ItemType Directory -Path $kimiCodeHomeCandidatePath -Force | Out-Null
}
$kimiCodeHomePath = (Resolve-Path -LiteralPath $kimiCodeHomeCandidatePath).Path
$kimiMcpConfigPath = Join-Path $kimiCodeHomePath "mcp.json"

if (Test-Path -LiteralPath $kimiMcpConfigPath) {
    $mcpConfig = Get-Content -Raw -LiteralPath $kimiMcpConfigPath | ConvertFrom-Json
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
    url = $mcpChromeUrl
}
$chromeMcpProperty = $mcpServers.PSObject.Properties["chrome"]
if ($null -eq $chromeMcpProperty) {
    $mcpServers | Add-Member -MemberType NoteProperty -Name "chrome" -Value $chromeMcpConfig
} else {
    $chromeMcpProperty.Value = $chromeMcpConfig
}
$mcpJson = $mcpConfig | ConvertTo-Json -Depth 20
$utf8Encoding = New-Object System.Text.UTF8Encoding($false)
[System.IO.File]::WriteAllText($kimiMcpConfigPath, $mcpJson, $utf8Encoding)
Write-Host "[INFO] Chrome MCP registered in Kimi Code: $kimiMcpConfigPath" -ForegroundColor Green

$mcpChromePortReady = $null -ne (Get-NetTCPConnection -LocalPort $mcpChromePort -State Listen -ErrorAction SilentlyContinue | Select-Object -First 1)
$mcpChromePortWasReady = $mcpChromePortReady
if ($mcpChromeNeedsBuild -or -not $mcpChromePortWasReady) {
    $mcpChromeSupervisorArgs = @(
        $mcpChromeSupervisorScriptPath,
        "--project-root", $mcpChromePath,
        "--watch-mode", "dev",
        "--recover-on-start"
    )
} else {
    $mcpChromeSupervisorArgs = @(
        $mcpChromeSupervisorScriptPath,
        "--project-root", $mcpChromePath,
        "--watch-mode", "dev"
    )
}
Write-Host "[INFO] Starting Chrome MCP development service..." -ForegroundColor Cyan
Start-Process -FilePath $mcpChromePython -ArgumentList $mcpChromeSupervisorArgs -WindowStyle Hidden
while (-not $mcpChromePortReady -and $mcpChromePortWaitCount -lt 60) {
    Start-Sleep -Milliseconds 500
    $mcpChromePortReady = $null -ne (Get-NetTCPConnection -LocalPort $mcpChromePort -State Listen -ErrorAction SilentlyContinue | Select-Object -First 1)
    $mcpChromePortWaitCount = $mcpChromePortWaitCount + 1
}
if ($mcpChromePortReady) {
    Write-Host "[INFO] Chrome MCP is listening on 127.0.0.1:$mcpChromePort." -ForegroundColor Green
} else {
    Write-Host "[WARN] Chrome MCP did not become ready; reload the unpacked extension once." -ForegroundColor Yellow
}

$kimiArgs = @(
    "--yolo"
)
$displayArgs = if ($args.Count -gt 0) {
    [string]::Format("; extra args: {0}", ($args -join " "))
} else {
    ""
}

Write-Host "[INFO] YOLO: ON; built-in web search: configuration preserved" -ForegroundColor Green
Write-Host "[INFO] Kimi provider, model, agents, and feature settings preserved$displayArgs" -ForegroundColor Green
Write-Host "============================================================" -ForegroundColor Cyan
Write-Host ""

& $kimiCommand.Source @kimiArgs @args
