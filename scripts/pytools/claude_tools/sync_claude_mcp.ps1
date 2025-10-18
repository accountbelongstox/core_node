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

<#
.SYNOPSIS
    Claude MCP Configuration Sync Tool - PowerShell Wrapper

.DESCRIPTION
    Synchronizes MCP server configurations from project template to user's Claude config.
    Provides enhanced error handling and user-friendly output.

.EXAMPLE
    .\sync_claude_mcp.ps1

.EXAMPLE
    .\sync_claude_mcp.ps1 -Verbose
#>

param(
    [Parameter(Mandatory=$false)]
    [switch]$Verbose
)

$script:ScriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
$script:PythonScript = Join-Path $script:ScriptDir "sync_mcp_servers.py"

function Write-ColorMessage {
    param(
        [Parameter(Mandatory=$true)]
        [string]$Message,

        [Parameter(Mandatory=$false)]
        [ValidateSet("Success", "Warning", "Error", "Info")]
        [string]$Type = "Info"
    )

    $color = switch ($Type) {
        "Success" { "Green" }
        "Warning" { "Yellow" }
        "Error"   { "Red" }
        "Info"    { "White" }
    }

    $prefix = switch ($Type) {
        "Success" { "[OK] " }
        "Warning" { "[!] " }
        "Error"   { "[X] " }
        "Info"    { "[*] " }
    }

    Write-Host -ForegroundColor $color "$prefix$Message"
}

function Test-PythonAvailable {
    try {
        $pythonVersion = python --version 2>&1
        if ($LASTEXITCODE -eq 0) {
            Write-ColorMessage -Message "Python found: $pythonVersion" -Type "Success"
            return $true
        }
    } catch {
        return $false
    }
    return $false
}

function Invoke-SyncScript {
    Write-Host ""
    Write-Host "=" * 80 -ForegroundColor Cyan
    Write-Host "Claude MCP Configuration Sync Tool" -ForegroundColor Cyan
    Write-Host "=" * 80 -ForegroundColor Cyan
    Write-Host ""

    Write-ColorMessage -Message "Script directory: $script:ScriptDir" -Type "Info"
    Write-ColorMessage -Message "Python script: $script:PythonScript" -Type "Info"
    Write-Host ""

    if (-not (Test-Path $script:PythonScript)) {
        Write-ColorMessage -Message "Python script not found: $script:PythonScript" -Type "Error"
        return 1
    }

    if (-not (Test-PythonAvailable)) {
        Write-ColorMessage -Message "Python is not available or not in PATH" -Type "Error"
        Write-ColorMessage -Message "Please install Python 3.6 or higher" -Type "Warning"
        return 1
    }

    Write-ColorMessage -Message "Starting MCP configuration sync..." -Type "Info"
    Write-Host ""

    try {
        if ($Verbose) {
            python $script:PythonScript
        } else {
            python $script:PythonScript 2>&1 | Out-Host
        }

        $exitCode = $LASTEXITCODE

        Write-Host ""
        Write-Host "=" * 80 -ForegroundColor Cyan
        if ($exitCode -eq 0) {
            Write-ColorMessage -Message "Sync completed successfully" -Type "Success"
        } else {
            Write-ColorMessage -Message "Sync failed with exit code: $exitCode" -Type "Error"
        }
        Write-Host "=" * 80 -ForegroundColor Cyan
        Write-Host ""

        return $exitCode

    } catch {
        Write-ColorMessage -Message "Error executing Python script: $_" -Type "Error"
        return 1
    }
}

$result = Invoke-SyncScript

Write-Host "Press any key to exit..."
$null = $Host.UI.RawUI.ReadKey("NoEcho,IncludeKeyDown")

exit $result
