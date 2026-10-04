<#
.SYNOPSIS
    AI Tools installer (Windows) - single step that owns every AI CLI install,
    parity with scripts/shells/linux/debian/install_shells/99_install_ai_tools.sh.

.DESCRIPTION
    Catalog: win_common/AiToolsCatalog.ps1 (same 17 keys as the Linux catalog,
    plus the pseudo-key mcp_chrome). Install mechanics are NOT duplicated here:
    every key with a Windows build delegates to the existing generic installer
    (Step21_InstallApplications.ps1 -ExactPackageName <DEV_SOFTWARE_PACKAGES key>,
    already used by the APP Install menu and idempotent on its own); bun/pi/omp
    delegate to the existing AiTools_PiHarness.ps1 (installs all three
    together); codex also runs AiTools_CodexMultiDevice.ps1; mcp_chrome delegates to apps/mcp-chrome/scripts/start.ps1 plus
    the existing scripts/ai_ps1tools/*_sync_mcp_servers.ps1 sync scripts. Keys
    with Supported = $false (auggie: no official Windows build found) are
    skipped with a message instead of inventing an installer.

.PARAMETER Only
    Comma-separated catalog keys to install/verify (default: every catalog key
    + mcp_chrome). "mcp_chrome" may be included/excluded like any other key.

.PARAMETER List
    Print the catalog (key, exec, Windows package key, supported) and exit.
    No changes.

.PARAMETER Status
    Print install/version/shared-login status for every catalog key and exit.
    No changes.

.EXAMPLE
    Step65_InstallAiTools.ps1                       # Ensure every AI tool + mcp_chrome
    Step65_InstallAiTools.ps1 -Only claude,codex     # Ensure only these two
    Step65_InstallAiTools.ps1 -List
    Step65_InstallAiTools.ps1 -Status
#>
param(
    [string]$Only = "",
    [switch]$List,
    [switch]$Status
)

$stepNumber = 65
$scriptIndex = "[Step $stepNumber]"
$installPowerShellsDir = $PSScriptRoot
$winShellsDir = Split-Path $installPowerShellsDir -Parent
$winCommonDir = Join-Path $winShellsDir "win_common"
$globalVarsPath = Join-Path $winCommonDir "GlobalVars.ps1"
$aiToolsCatalogPath = Join-Path $winCommonDir "AiToolsCatalog.ps1"
$aiCliProvisionPath = Join-Path $winCommonDir "AiCliProvisionCommon.ps1"
$nodeRuntimePath = Join-Path $installPowerShellsDir "Node_Runtime.ps1"
$pythonDefaultPath = Join-Path $installPowerShellsDir "Python_Default.ps1"
$step22Path = Join-Path $installPowerShellsDir "Step22_InstallChrome.ps1"
$aiToolsPiHarnessPath = Join-Path $installPowerShellsDir "AiTools_PiHarness.ps1"
# Codex multi-device collaboration stack: part of the codex tool, run from this single AI-tools step.
$aiToolsCodexMultiDevicePath = Join-Path $installPowerShellsDir "AiTools_CodexMultiDevice.ps1"
$codexCatalogKey = "codex"
$step21Path = Join-Path $installPowerShellsDir "Step21_InstallApplications.ps1"
$pathFunctionPath = Join-Path $winCommonDir "WindowsPathFunction.ps1"
$ai65LogPrefix = "ai_tools_install"
$ai65NodeToolchainCommands = @("node", "npm")
# Step-only installers already run in this invocation (bun/pi/omp share Step41).
$ai65StepOnlyResults = @{}
$ai65LogFile = $null
$ai65LatestLog = $null
$aiPs1ToolsDir = $null
$requestedKeys = @()
$includeMcpChrome = $true
$failedKeys = @()
$mcpChromeCatalogKey = "mcp_chrome"

. $globalVarsPath
. $aiToolsCatalogPath
. $aiCliProvisionPath

$aiPs1ToolsDir = Join-Path $Global:CORE_NODE_DIR (Join-Path "scripts" "ai_ps1tools")

function Write-Ai65Log {
    param([string]$Message, [string]$Type = "Info")
    $color = "White"
    if ($Type -eq "Success") { $color = "Green" }
    elseif ($Type -eq "Warning") { $color = "Yellow" }
    elseif ($Type -eq "Error") { $color = "Red" }
    Write-Host "$scriptIndex $Message" -ForegroundColor $color
}

# --- Argument parsing -------------------------------------------------------
if (-not [string]::IsNullOrWhiteSpace($Only)) {
    $includeMcpChrome = $false
    foreach ($rawKey in ($Only -split ",")) {
        $trimmedKey = $rawKey.Trim()
        if ([string]::IsNullOrWhiteSpace($trimmedKey)) { continue }
        if ($trimmedKey -eq $mcpChromeCatalogKey) {
            $includeMcpChrome = $true
        } else {
            $requestedKeys += $trimmedKey
        }
    }
} else {
    $requestedKeys = @(Get-AiToolKeys)
}

# --- --list / --status --------------------------------------------------------
function Show-Ai65List {
    Write-Host ("{0,-14} {1,-14} {2,-20} {3,-10}" -f "KEY", "EXEC", "WINDOWS PACKAGE", "SUPPORTED")
    foreach ($key in (Get-AiToolKeys)) {
        $tool = Get-AiTool -Key $key
        Write-Host ("{0,-14} {1,-14} {2,-20} {3,-10}" -f $key, $tool.Exec, $(if ($tool.WindowsPackageKey) { $tool.WindowsPackageKey } elseif ($tool.StepOnly) { $tool.StepOnly } else { "-" }), $(if ($tool.Supported) { "yes" } else { "no" }))
    }
    Write-Host ""
    Write-Host "Plus: $mcpChromeCatalogKey (apps/mcp-chrome, built + registered as the ncore-mcp-chrome logon task)"
}

function Show-Ai65Status {
    Write-Host ("{0,-14} {1,-11} {2,-16} {3}" -f "KEY", "INSTALLED", "VERSION", "LOGIN SHARED")
    foreach ($key in (Get-AiToolKeys)) {
        $tool = Get-AiTool -Key $key
        $installed = "no"
        $version = "-"
        if (-not $tool.Supported) {
            $installed = "unsupported"
        } elseif (-not [string]::IsNullOrWhiteSpace($tool.Exec)) {
            $command = Get-Command $tool.Exec -ErrorAction SilentlyContinue
            if ($command) {
                $installed = "yes"
                if (-not [string]::IsNullOrWhiteSpace($tool.VerifyArg)) {
                    try {
                        $rawVersion = (& $command.Source $tool.VerifyArg 2>$null | Select-Object -First 1 | Out-String).Trim()
                        if ($rawVersion -match '\d+\.\d+\.\d+') { $version = $Matches[0] }
                    } catch { }
                }
            }
        } elseif ($key -eq "zhipuai") {
            $pythonExe = $Global:PYTHON_EXE_PATH
            if ($pythonExe -and (Test-Path -LiteralPath $pythonExe)) {
                & $pythonExe -m pip show zhipuai *> $null
                if ($LASTEXITCODE -eq 0) { $installed = "yes" }
            }
        }
        $shareable = [string]$tool.Shareable
        if ([string]::IsNullOrWhiteSpace($shareable)) { $shareable = "no" }
        Write-Host ("{0,-14} {1,-11} {2,-16} {3}" -f $key, $installed, $version, $shareable)
    }
    Write-Host ""
    Write-Host "-- Shared login matrix -----------------------------------------------"
    Show-AiToolSharedLoginStatus
}

if ($List) { Show-Ai65List; return }
if ($Status) { Show-Ai65Status; return }

# --- Prerequisites (idempotent: detect readiness, only run what's missing) -
function Invoke-Ai65PrereqIfMissing {
    param([scriptblock]$ReadyCheck, [string]$ScriptPath, [string]$Label)
    if (& $ReadyCheck) { return }
    if (-not (Test-Path -LiteralPath $ScriptPath)) {
        Write-Ai65Log "Prerequisite '$Label' missing and $ScriptPath not found; continuing anyway." "Warning"
        return
    }
    Write-Ai65Log "Prerequisite '$Label' not ready; running $(Split-Path -Leaf $ScriptPath) ..."
    try { & $ScriptPath } catch { Write-Ai65Log "$(Split-Path -Leaf $ScriptPath) reported errors (continuing): $($_.Exception.Message)" "Warning" }
}

function Invoke-Ai65EnsurePrerequisites {
    Invoke-Ai65PrereqIfMissing -ReadyCheck {
        (Test-Path -LiteralPath $Global:NODE_EXE_PATH) -and (Test-Path -LiteralPath $Global:NPM_EXE_PATH) -and (Test-Path -LiteralPath $Global:PNPM_EXE_PATH)
    } -ScriptPath $nodeRuntimePath -Label "Node/npm/pnpm toolchain"
    Write-Ai65ToolchainVersions
    Invoke-Ai65PrereqIfMissing -ReadyCheck { Test-Path -LiteralPath $Global:PYTHON_EXE_PATH } -ScriptPath $pythonDefaultPath -Label "Python"
    if ($includeMcpChrome) {
        Invoke-Ai65PrereqIfMissing -ReadyCheck {
            (Get-Command "chrome" -ErrorAction SilentlyContinue) -or
            (Test-Path -LiteralPath (Join-Path $env:ProgramFiles "Google\Chrome\Application\chrome.exe")) -or
            (Test-Path -LiteralPath (Join-Path ${env:ProgramFiles(x86)} "Google\Chrome\Application\chrome.exe"))
        } -ScriptPath $step22Path -Label "Chrome"
    }
    # No dedicated Windows "uv" step exists yet (unlike Linux's 25_install_uv.sh);
    # the only catalog tool that uses InstallType "uv" (SuperClaude) is installed
    # by Step21's generic engine, which already resolves/bootstraps uv itself.
}

# Versions and resolved paths of the Node toolchain (printed only, never compared).
function Write-Ai65ToolchainVersions {
    $toolchainExe = ""
    $versionText = ""
    foreach ($toolchainExe in @($Global:NODE_EXE_PATH, $Global:NPM_EXE_PATH, $Global:PNPM_EXE_PATH)) {
        if (-not (Test-Path -LiteralPath $toolchainExe)) {
            Write-Ai65Log "  missing: $toolchainExe" "Warning"
            continue
        }
        try {
            $versionText = (& $toolchainExe --version 2>&1 | Out-String).Trim()
        } catch {
            $versionText = "error: $($_.Exception.Message)"
        }
        Write-Ai65Log "  $toolchainExe --version -> $versionText"
    }
}

# PATH hygiene through the shared PATH library (WindowsPathFunction.ps1):
# unique Machine/User segments, then one PATH directory per tool (replacement,
# never a second entry): node and npm from NODE_DIR, every native-only catalog
# tool from its NativeBinDir.
function Invoke-Ai65PathHygiene {
    $toolKey = ""
    $tool = $null
    $toolchainName = ""
    if (-not (Test-Path -LiteralPath $pathFunctionPath)) {
        Write-Ai65Log "PATH library not found: $pathFunctionPath" "Error"
        return
    }
    Write-Ai65Log "PATH hygiene: dedupe Machine/User PATH ..."
    & $pathFunctionPath "dedupe"
    foreach ($toolchainName in $ai65NodeToolchainCommands) {
        Write-Ai65Log "PATH hygiene: '$toolchainName' only from $Global:NODE_DIR ..."
        & $pathFunctionPath "unique" $toolchainName $Global:NODE_DIR
    }
    foreach ($toolKey in (Get-AiToolKeys)) {
        if (-not (Test-AiCliNativeTool -Tool $toolKey)) { continue }
        $tool = Get-AiTool -Key $toolKey
        Write-Ai65Log "PATH hygiene: '$([System.IO.Path]::GetFileNameWithoutExtension([string]$tool.Exec))' only from $($tool.NativeBinDir) ..."
        & $pathFunctionPath "unique" ([System.IO.Path]::GetFileNameWithoutExtension([string]$tool.Exec)) ([string]$tool.NativeBinDir)
    }
}

# --- Per-tool dispatch --------------------------------------------------------
function Invoke-Ai65EnsureStepOnlyGroup {
    param([string]$StepFileName)
    $stepPath = Join-Path $installPowerShellsDir $StepFileName
    if ($ai65StepOnlyResults.ContainsKey($StepFileName)) {
        Write-Ai65Log "[SKIP] $StepFileName already ran in this invocation." "Success"
        return $ai65StepOnlyResults[$StepFileName]
    }
    if (-not (Test-Path -LiteralPath $stepPath)) {
        Write-Ai65Log "Step-only installer not found: $stepPath" "Error"
        return $false
    }
    Write-Ai65Log "Running $StepFileName (installs bun + pi + omp together) ..."
    try { & $stepPath | Out-Host; $ai65StepOnlyResults[$StepFileName] = $true } catch {
        Write-Ai65Log "$StepFileName reported errors: $($_.Exception.Message)" "Warning"
        $ai65StepOnlyResults[$StepFileName] = $false
    }
    return $ai65StepOnlyResults[$StepFileName]
}

function Invoke-Ai65EnsureTool {
    param([string]$Key)

    if (-not (Test-AiToolExists -Key $Key)) {
        Write-Ai65Log "Unknown AI tool key '$Key' (see -List); skipping." "Warning"
        return $false
    }
    $tool = Get-AiTool -Key $Key
    if (-not $tool.Supported) {
        Write-Ai65Log "[SKIP] $($tool.Name) ($Key): no official Windows build found; not installed." "Warning"
        return $true
    }
    if (Test-AiCliNativeTool -Tool $Key) {
        Write-Ai65Log "Ensuring $($tool.Name) via the shared Invoke-AiCliNativeEnsure (official installer only) ..."
        return [bool](Invoke-AiCliNativeEnsure -Tool $Key)
    }
    if (-not [string]::IsNullOrWhiteSpace([string]$tool.StepOnly)) {
        $stepOnlyOk = [bool](Invoke-Ai65EnsureStepOnlyGroup -StepFileName ([string]$tool.StepOnly))
        if ($stepOnlyOk -and -not [string]::IsNullOrWhiteSpace([string]$tool.Exec)) {
            $stepOnlyOk = [bool](Get-Command ([string]$tool.Exec) -ErrorAction SilentlyContinue)
        }
        return $stepOnlyOk
    }
    if ([string]::IsNullOrWhiteSpace([string]$tool.WindowsPackageKey)) {
        Write-Ai65Log "[SKIP] $($tool.Name) ($Key): no install method resolved." "Warning"
        return $false
    }

    if (-not [string]::IsNullOrWhiteSpace($tool.Exec) -and (Get-Command $tool.Exec -ErrorAction SilentlyContinue)) {
        Write-Ai65Log "[SKIP] $($tool.Name) already installed and linked." "Success"
        return $true
    }

    Write-Ai65Log "Installing $($tool.Name) via Step21 (-ExactPackageName $($tool.WindowsPackageKey)) ..."
    if (-not (Test-Path -LiteralPath $step21Path)) {
        Write-Ai65Log "Step21_InstallApplications.ps1 not found: $step21Path" "Error"
        return $false
    }
    try {
        & $step21Path -ExactPackageName ([string]$tool.WindowsPackageKey)
    } catch {
        Write-Ai65Log "$($tool.Name) install reported an error: $($_.Exception.Message)" "Warning"
    }
    if ([string]::IsNullOrWhiteSpace($tool.Exec) -or (Get-Command $tool.Exec -ErrorAction SilentlyContinue)) {
        Write-Ai65Log "[OK] $($tool.Name) ready." "Success"
        return $true
    }
    Write-Ai65Log "$($tool.Name) still unavailable after the install attempt." "Warning"
    return $false
}

# --- mcp-chrome ---------------------------------------------------------------
function Invoke-Ai65EnsureMcpChrome {
    . (Join-Path $winCommonDir "McpChromeBuildCommon.ps1")
    $mcpChromeBuilt = [bool](Invoke-McpChromeBuild -LogPrefix "[$ai65LogPrefix][mcp-chrome]" | Select-Object -Last 1)
    if (-not $mcpChromeBuilt) {
        Write-Ai65Log "mcp-chrome build/service reported an error" "Warning"
    }

    Write-Ai65Log "Syncing the chrome MCP entry to every installed AI tool ..."
    Invoke-Ai65SyncAllAiTools
    return $mcpChromeBuilt
}

function Invoke-Ai65SyncAllAiTools {
    $syncScripts = @(
        "claude_sync_mcp_servers.ps1", "cursor_sync_mcp_servers.ps1", "codex_sync_mcp_servers.ps1",
        "gemini_sync_mcp_servers.ps1", "droid_sync_mcp_servers.ps1", "windsurf_sync_mcp_servers.ps1",
        "devin_sync_mcp_servers.ps1", "vscode_sync_mcp_servers.ps1"
    )
    if (-not (Test-Path -LiteralPath $aiPs1ToolsDir)) {
        Write-Ai65Log "ai_ps1tools directory not found: $aiPs1ToolsDir" "Error"
        return
    }
    foreach ($syncScript in $syncScripts) {
        $scriptPath = Join-Path $aiPs1ToolsDir $syncScript
        if (-not (Test-Path -LiteralPath $scriptPath)) { continue }
        try { & $scriptPath } catch { Write-Ai65Log "$syncScript reported an error: $($_.Exception.Message)" "Warning" }
    }
}

# --- Main ---------------------------------------------------------------------
if (-not (Test-Path -LiteralPath $Global:LOGS_DIR)) { New-Item -ItemType Directory -Path $Global:LOGS_DIR -Force | Out-Null }
$ai65LogFile = Join-Path $Global:LOGS_DIR ("{0}_{1}.log" -f $ai65LogPrefix, (Get-Date -Format "yyyyMMdd_HHmmss"))
$ai65LatestLog = Join-Path $Global:LOGS_DIR ("{0}_latest.log" -f $ai65LogPrefix)
Start-Transcript -LiteralPath $ai65LogFile -Force | Out-Null
try {
Write-Ai65Log "============================================================"
Write-Ai65Log "AI Tools install: $($requestedKeys -join ', ')$(if ($includeMcpChrome) { ' + mcp_chrome' })"
Write-Ai65Log "============================================================"

Invoke-Ai65EnsurePrerequisites

foreach ($requestedKey in $requestedKeys) {
    if (-not (Invoke-Ai65EnsureTool -Key $requestedKey)) {
        $failedKeys += $requestedKey
    }
}

if ($requestedKeys -contains $codexCatalogKey -and $failedKeys -notcontains $codexCatalogKey) {
    Write-Ai65Log "Ensuring the Codex multi-device stack ($(Split-Path -Leaf $aiToolsCodexMultiDevicePath)) ..."
    try { & $aiToolsCodexMultiDevicePath } catch { Write-Ai65Log "$(Split-Path -Leaf $aiToolsCodexMultiDevicePath) reported errors (continuing): $($_.Exception.Message)" "Warning" }
}

if ($includeMcpChrome) {
    if (-not (Invoke-Ai65EnsureMcpChrome)) {
        $failedKeys += $mcpChromeCatalogKey
    }
}

Invoke-Ai65PathHygiene

Write-Ai65Log "Configuring shared login for shareable AI CLI config dirs ..."
try { Initialize-AiToolSharedLogin | Out-Null } catch { Write-Ai65Log "Shared-login setup reported an error: $($_.Exception.Message)" "Warning" }

Write-Ai65Log "============================================================"
if ($failedKeys.Count -eq 0) {
    Write-Ai65Log "AI Tools install completed: all requested tools ready." "Success"
} else {
    Write-Ai65Log "AI Tools install completed with warnings: $($failedKeys -join ', ')" "Warning"
}
Write-Ai65Log "============================================================"
} finally {
    Stop-Transcript | Out-Null
    Copy-Item -LiteralPath $ai65LogFile -Destination $ai65LatestLog -Force
    Write-Ai65Log "Full log: $ai65LogFile (latest copy: $ai65LatestLog)" "Success"
}
