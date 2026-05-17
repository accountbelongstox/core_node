# ### AI SPECIAL ATTENTION RULES START ###
# When AI/ALL DEVELOPERS sees this prompt, MUST IMMEDIATELY COMPLY WITH THESE RULES:
# 1. Write all code in English only.
# 2. Never execute, create, or modify test code.
# 3. Never create or update documentation (*.md).
# 4. Never write summaries during development or thinking process.
# 5. Declare all variables at the beginning of the file.
# 6. For PowerShell (*.ps1) scripts: Do not append strings directly to variables, Do not use relative paths such as "..\..\"; instead resolve absolute paths using Split-Path, Join-Path, or Resolve-Path.
# 7. Do not modify these rules.
# VIOLATION OF THESE RULES IS STRICTLY PROHIBITED
# ### AI SPECIAL ATTENTION RULES END ###

<#
.SYNOPSIS
    One-shot installer for all MCP services: Chrome MCP, Context7, built-in (Wait Please), and sync to Claude/Codex/Gemini.
.DESCRIPTION
    Orchestrates: 1) Chrome MCP (apps/mcp-chrome), 2) Context7 MCP (npx @upstash/context7-mcp),
    3) Built-in MCP (ncore/mcp_server/wait_please), 4) Sync MCP config to Claude/Codex/Gemini via scripts/pytools/ai_tools.
#>

#region Variable Declarations
$script:PS_CURRENT_DIR = $PSScriptRoot
$script:WIN_DIR = Split-Path $script:PS_CURRENT_DIR -Parent
$script:SHELLS_DIR = Split-Path $script:WIN_DIR -Parent
$script:SCRIPT_DIR = Split-Path $script:SHELLS_DIR -Parent
$script:CORE_NODE_DIR = Split-Path $script:SCRIPT_DIR -Parent
$script:WIN_COMMON_DIR = Join-Path $script:WIN_DIR "win_common"
$script:GLOBALVARS_PS1 = Join-Path $script:WIN_COMMON_DIR "GlobalVars.ps1"
$script:AI_TOOLS_DIR = Join-Path $script:CORE_NODE_DIR "scripts\pytools\ai_tools"
$script:AI_PS1TOOLS_DIR = Join-Path $script:CORE_NODE_DIR "scripts\ai_ps1tools"
$script:CHROME_MCP_START_PS1 = Join-Path $script:CORE_NODE_DIR "apps\mcp-chrome\scripts\start.ps1"
$script:WAIT_PLEASE_INSTALL_PS1 = Join-Path $script:CORE_NODE_DIR "ncore\mcp_server\wait_please\install-windows.ps1"

$script:COLOR_SUCCESS = "Green"
$script:COLOR_WARNING = "Yellow"
$script:COLOR_ERROR = "Red"
$script:COLOR_INFO = "White"
$script:COLOR_HIGHLIGHT = "Cyan"

$script:ResolvedPythonExe = $null
$script:PythonScriptsDir = $null
if (Test-Path -LiteralPath $script:GLOBALVARS_PS1) {
    try {
        . $script:GLOBALVARS_PS1
        if ($Global:PYTHON_EXE_PATH -and (Test-Path -LiteralPath $Global:PYTHON_EXE_PATH)) {
            $script:ResolvedPythonExe = $Global:PYTHON_EXE_PATH
        }
        if ($Global:PYTHON_DIR -and (Test-Path -LiteralPath $Global:PYTHON_DIR)) {
            $script:PythonScriptsDir = Join-Path $Global:PYTHON_DIR "Scripts"
        }
    } catch {
        $script:ResolvedPythonExe = $null
        $script:PythonScriptsDir = $null
    }
}
#endregion

#region Helper Functions
function Get-DDPythonExePath {
    if ($script:ResolvedPythonExe) { return $script:ResolvedPythonExe }
    return $null
}

function Write-ColorMessage {
    param(
        [Parameter(Mandatory=$true)] [string]$Message,
        [Parameter()] [string]$Type = "Info"
    )
    $color = $script:COLOR_INFO
    $prefix = "[*] "
    if ($Type -eq "Success") { $color = $script:COLOR_SUCCESS; $prefix = "[+] " }
    elseif ($Type -eq "Warning") { $color = $script:COLOR_WARNING; $prefix = "[!] " }
    elseif ($Type -eq "Error") { $color = $script:COLOR_ERROR; $prefix = "[X] " }
    Write-Host -ForegroundColor $color "$prefix$Message"
}

function Invoke-Step {
    param([string]$Title, [scriptblock]$Action)
    Write-Host "========================================" -ForegroundColor $script:COLOR_HIGHLIGHT
    Write-ColorMessage -Message $Title -Type "Info"
    Write-Host "========================================" -ForegroundColor $script:COLOR_HIGHLIGHT
    try {
        & $Action
    } catch {
        Write-ColorMessage -Message "Step failed: $_" -Type "Warning"
    }
}

function Test-CommandExists {
    param([string]$Command)
    $null = Get-Command $Command -ErrorAction SilentlyContinue
    return $?
}
#endregion

#region Install Steps
function Invoke-ChromeMCPStep {
    if (-not (Test-Path -LiteralPath $script:CHROME_MCP_START_PS1)) {
        Write-ColorMessage -Message "Chrome MCP script not found; skipping." -Type "Warning"
        return
    }
    $ddPython = Get-DDPythonExePath
    $prevPythonExe = $env:PYTHON_EXE
    $prevPath = $env:PATH
    try {
        if ($ddPython) {
            $env:PYTHON_EXE = $ddPython
            if ($script:PythonScriptsDir -and (Test-Path -LiteralPath $script:PythonScriptsDir)) {
                $pythonDir = Split-Path -Parent $ddPython
                $env:PATH = "$pythonDir;$script:PythonScriptsDir;$env:PATH"
            }
        }
        $prevDir = Get-Location
        try {
            Set-Location (Split-Path -Parent (Split-Path -Parent $script:CHROME_MCP_START_PS1))
            & $script:CHROME_MCP_START_PS1
        } finally {
            Set-Location $prevDir
        }
    } finally {
        if ($null -ne $prevPythonExe) { $env:PYTHON_EXE = $prevPythonExe } else { Remove-Item -Path env:PYTHON_EXE -ErrorAction SilentlyContinue }
        $env:PATH = $prevPath
    }
}

function Invoke-Context7Step {
    Write-ColorMessage -Message "Checking Context7 package (npx @upstash/context7-mcp)..." -Type "Info"
    $checkOutput = npx -y @upstash/context7-mcp --version 2>&1
    foreach ($line in $checkOutput) { Write-Host $line }
    $checkText = ($checkOutput | Out-String).Trim()
    if ($checkText -match "\d+\.\d+") {
        Write-ColorMessage -Message "Context7 package already available (version found in output)." -Type "Success"
        return
    }
    Write-ColorMessage -Message "Ensuring Context7 package (npx @upstash/context7-mcp@latest)..." -Type "Info"
    $installOutput = npx -y @upstash/context7-mcp@latest --version 2>&1
    foreach ($line in $installOutput) { Write-Host $line }
    $installText = ($installOutput | Out-String).Trim()
    if ($installText -match "\d+\.\d+") {
        Write-ColorMessage -Message "Context7 package ready (version found in output)." -Type "Success"
    } else {
        Write-ColorMessage -Message "Context7 version not detected in output; sync may still add it if CONTEXT7_API_KEY is set." -Type "Warning"
    }
}

function Invoke-WaitPleaseStep {
    if (-not (Test-Path -LiteralPath $script:WAIT_PLEASE_INSTALL_PS1)) {
        Write-ColorMessage -Message "Wait Please install script not found; skipping." -Type "Warning"
        return
    }
    & $script:WAIT_PLEASE_INSTALL_PS1
}

function Invoke-SyncToToolsStep {
    if (-not (Test-Path -LiteralPath $script:AI_PS1TOOLS_DIR)) {
        Write-ColorMessage -Message "ai_ps1tools directory not found; skipping sync." -Type "Warning"
        return
    }
    $syncScripts = @(
        "cursor_sync_mcp_servers.ps1",
        "claude_sync_mcp_servers.ps1",
        "codex_sync_mcp_servers.ps1",
        "gemini_sync_mcp_servers.ps1",
        "droid_sync_mcp_servers.ps1"
    )
    foreach ($scriptName in $syncScripts) {
        $scriptPath = Join-Path $script:AI_PS1TOOLS_DIR $scriptName
        if (-not (Test-Path -LiteralPath $scriptPath)) { continue }
        Write-ColorMessage -Message "Syncing MCP for: $scriptName" -Type "Info"
        & $scriptPath
        Write-ColorMessage -Message "Sync finished for $scriptName (see live output above)." -Type "Info"
    }
}
#endregion

#region Main
Clear-Host
Write-ColorMessage -Message "========================================" -Type "Info"
Write-ColorMessage -Message "   Install All MCP Services" -Type "Info"
Write-ColorMessage -Message "========================================" -Type "Info"

Invoke-Step -Title "Step 1/4: Chrome MCP (build + register)" -Action { Invoke-ChromeMCPStep }
Invoke-Step -Title "Step 2/4: Context7 MCP (npx @upstash/context7-mcp)" -Action { Invoke-Context7Step }
Invoke-Step -Title "Step 3/4: Built-in MCP (Wait Please)" -Action { Invoke-WaitPleaseStep }
Invoke-Step -Title "Step 4/4: Sync MCP config to Cursor/Claude/Codex/Gemini/Droid" -Action { Invoke-SyncToToolsStep }

Write-ColorMessage -Message "Install All MCP Services finished." -Type "Success"
#endregion
