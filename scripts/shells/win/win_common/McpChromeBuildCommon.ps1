# The one way installers build apps/mcp-chrome: its own scripts/start.ps1 -Service compiles the extension
# and native host and registers the ncore-mcp-chrome logon task (callers: Step21_InstallApplications.ps1,
# Step65_InstallAiTools.ps1, menu_itemshells/MCPManagementMenu.ps1). One build per PowerShell process:
# a full installation reaches it from both Step65 and Step21, and the second call is a no-op.
# AI launchers call Invoke-McpChromeServiceEnsure (start.ps1 -Ensure): a running logon task is left
# alone, a stopped one is started, and a missing one is installed with a build only for changed sources.
$script:McpChromeBuildRepoRoot = Split-Path -Parent (Split-Path -Parent (Split-Path -Parent (Split-Path -Parent $PSScriptRoot)))
$script:McpChromeAppDir = Join-Path (Join-Path $script:McpChromeBuildRepoRoot 'apps') 'mcp-chrome'
$script:McpChromeStartScript = Join-Path (Join-Path $script:McpChromeAppDir 'scripts') 'start.ps1'
if ($null -eq (Get-Variable -Name 'McpChromeBuiltThisRun' -Scope Global -ErrorAction SilentlyContinue)) { $Global:McpChromeBuiltThisRun = $false }

function Get-McpChromeStartScript {
    return $script:McpChromeStartScript
}

function Invoke-McpChromeStartScript {
    param(
        [string]$LogPrefix,
        [hashtable]$StartParameters
    )
    $prevPythonExe = $env:PYTHON_EXE
    $prevPath = $env:PATH
    $prevDir = Get-Location
    $pythonScriptsDir = ''
    $succeeded = $false
    $pythonExePath = Get-Variable -Name 'PYTHON_EXE_PATH' -Scope Global -ValueOnly -ErrorAction SilentlyContinue
    $pythonDir = Get-Variable -Name 'PYTHON_DIR' -Scope Global -ValueOnly -ErrorAction SilentlyContinue

    if (-not (Test-Path -LiteralPath $script:McpChromeStartScript)) {
        Write-Host "$LogPrefix start script not found: $($script:McpChromeStartScript)" -ForegroundColor Red
        return $false
    }
    # Force a fresh compile (ignore a stale MCP_SKIP_BUILD) with the dd Python on PATH.
    Remove-Item Env:\MCP_SKIP_BUILD -ErrorAction SilentlyContinue
    if ($pythonExePath -and (Test-Path -LiteralPath $pythonExePath)) {
        $env:PYTHON_EXE = $pythonExePath
        if ($pythonDir -and (Test-Path -LiteralPath $pythonDir)) {
            $pythonScriptsDir = Join-Path $pythonDir 'Scripts'
            $env:PATH = "$pythonDir;$pythonScriptsDir;$env:PATH"
        }
    }
    try {
        Set-Location -LiteralPath $script:McpChromeAppDir
        & $script:McpChromeStartScript @StartParameters | Out-Host
        $succeeded = $true
    }
    catch {
        Write-Host "$LogPrefix build/service reported an error: $($_.Exception.Message)" -ForegroundColor Yellow
    }
    finally {
        Set-Location $prevDir
        if ($null -ne $prevPythonExe) { $env:PYTHON_EXE = $prevPythonExe } else { Remove-Item -Path env:PYTHON_EXE -ErrorAction SilentlyContinue }
        $env:PATH = $prevPath
    }
    return $succeeded
}

function Invoke-McpChromeBuild {
    param(
        [string]$LogPrefix = '[mcp-chrome]',
        [switch]$Force
    )
    if ($Global:McpChromeBuiltThisRun -and -not $Force) {
        Write-Host "$LogPrefix Already built in this run; skipping." -ForegroundColor DarkGray
        return $true
    }
    Write-Host "$LogPrefix Building + registering Chrome MCP via $($script:McpChromeStartScript) -Service ..." -ForegroundColor Cyan
    $Global:McpChromeBuiltThisRun = Invoke-McpChromeStartScript -LogPrefix $LogPrefix -StartParameters @{ Service = $true }
    return $Global:McpChromeBuiltThisRun
}

function Invoke-McpChromeServiceEnsure {
    param([string]$LogPrefix = '[mcp-chrome]')
    return (Invoke-McpChromeStartScript -LogPrefix $LogPrefix -StartParameters @{ Ensure = $true })
}
