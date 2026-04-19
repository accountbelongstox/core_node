# ### AI SPECIAL ATTENTION RULES START ###
# When AI/ALL DEVELOPERS sees this prompt, MUST IMMEDIATELY COMPLY WITH THESE rules:
# 1. Write all code in English only.
# 2. Never execute, create, or modify test code.
# 3. Never create or update documentation (*.md).
# 4. Never write summaries during development or thinking process.
# 5. Declare all variables at the beginning of the file.
# 6. For PowerShell (*.ps1) scripts: Do not append strings directly to variables, Do not use relative paths such as "..\\..\\"; instead resolve absolute paths using parent path parsing (Split-Path, Join-Path, or Resolve-Path).
# 7. Do not modify these rules.
# ### AI SPECIAL ATTENTION RULES END ###

#region Variable Declarations
$script:CLAUDE_ASSISTANT_ROOT = $PSScriptRoot
$script:CLAUDE_JSON_MERGE_PY = Join-Path $script:CLAUDE_ASSISTANT_ROOT "claude_json_merge.py"
$script:AGENT_TEAMS_DOC_URL = "https://docs.anthropic.com/en/docs/claude-code/agent-teams"
#endregion

#region Path Helpers
function Get-ClaudeUserConfigDirectory {
    return (Join-Path $env:USERPROFILE ".claude")
}

function Get-ClaudeUserSettingsJsonPath {
    $dir = Get-ClaudeUserConfigDirectory
    $primary = Join-Path $dir "settings.json"
    $local = Join-Path $dir "settings.local.json"
    if (Test-Path -LiteralPath $local) {
        return $local
    }
    return $primary
}

function Get-ClaudeGlobalJsonPath {
    return (Join-Path $env:USERPROFILE ".claude.json")
}
#endregion

#region Python Resolution
function Get-ClaudeAssistantPythonExecutable {
    $winDir = Split-Path (Split-Path $script:CLAUDE_ASSISTANT_ROOT -Parent) -Parent
    $globalVarsPath = Join-Path $winDir "win_common\GlobalVars.ps1"
    if (Test-Path -LiteralPath $globalVarsPath) {
        try {
            . $globalVarsPath
            if ($Global:PYTHON_EXE_PATH -and (Test-Path -LiteralPath $Global:PYTHON_EXE_PATH)) {
                return $Global:PYTHON_EXE_PATH
            }
        }
        catch {
        }
    }
    $candidates = @("py", "python", "python3")
    foreach ($name in $candidates) {
        $cmd = Get-Command $name -ErrorAction SilentlyContinue
        if ($null -ne $cmd) {
            return $cmd.Source
        }
    }
    return $null
}

function Invoke-ClaudeJsonMerge {
    param(
        [Parameter(Mandatory = $true)]
        [string[]]$Arguments
    )
    $py = Get-ClaudeAssistantPythonExecutable
    if ($null -eq $py) {
        Write-Host "[X] Python not found. Install Python or configure GlobalVars PYTHON_EXE_PATH." -ForegroundColor Red
        return 1
    }
    if (-not (Test-Path -LiteralPath $script:CLAUDE_JSON_MERGE_PY)) {
        Write-Host "[X] Missing script: $($script:CLAUDE_JSON_MERGE_PY)" -ForegroundColor Red
        return 1
    }
    $allArgs = @($script:CLAUDE_JSON_MERGE_PY) + $Arguments
    & $py $allArgs
    return $LASTEXITCODE
}
#endregion

#region Idempotent Environment Checks
function Test-ClaudeCodeCliAvailable {
    $cmd = Get-Command "claude" -ErrorAction SilentlyContinue
    return ($null -ne $cmd)
}

function Get-ClaudeCodeVersionString {
    if (-not (Test-ClaudeCodeCliAvailable)) {
        return ""
    }
    try {
        $out = & claude --version 2>&1
        return ($out | Out-String).Trim()
    }
    catch {
        return ""
    }
}

function Test-WslAvailable {
    $cmd = Get-Command "wsl" -ErrorAction SilentlyContinue
    return ($null -ne $cmd)
}

function Test-TmuxInDefaultWsl {
    if (-not (Test-WslAvailable)) {
        return $false
    }
    try {
        $r = & wsl -e bash -lc "command -v tmux >/dev/null 2>&1 && echo ok" 2>&1
        return (($r | Out-String).Trim() -eq "ok")
    }
    catch {
        return $false
    }
}

function Test-TmuxOnWindowsPath {
    $cmd = Get-Command "tmux" -ErrorAction SilentlyContinue
    return ($null -ne $cmd)
}

function Get-RecommendedTeammateMode {
    <#
    Default automatic value is in-process. Official docs: split-pane teammate UI needs tmux or iTerm2;
    Windows Terminal / VS Code terminals do not support split panes for agent teams.
    Only suggest tmux when this process is already running inside tmux (TMUX env is set).
    #>
    if (-not [string]::IsNullOrEmpty($env:TMUX)) {
        return "tmux"
    }
    return "in-process"
}

function Show-ClaudeAssistantEnvironmentReport {
    Write-Host ""
    Write-Host "=== Claude assistant environment (idempotent check) ===" -ForegroundColor Cyan
    $cc = Test-ClaudeCodeCliAvailable
    Write-Host ("Claude CLI: " + $(if ($cc) { "found" } else { "not found" }))
    if ($cc) {
        Write-Host ("Version: " + (Get-ClaudeCodeVersionString))
    }
    Write-Host ("WSL: " + $(if (Test-WslAvailable) { "available" } else { "not found" }))
    Write-Host ("tmux (Windows PATH): " + $(if (Test-TmuxOnWindowsPath) { "yes" } else { "no" }))
    Write-Host ("tmux (default WSL): " + $(if (Test-TmuxInDefaultWsl) { "yes" } else { "no" }))
    $py = Get-ClaudeAssistantPythonExecutable
    Write-Host ("Python for JSON helper: " + $(if ($py) { $py } else { "not found" }))
    Write-Host ("Automatic teammateMode (written by one-click): " + (Get-RecommendedTeammateMode))
    Write-Host "Default is in-process on Windows unless TMUX is set (session inside tmux)."
    Write-Host "Split-pane UI: tmux or iTerm2 per Anthropic docs; Windows Terminal uses in-process."
    Write-Host "========================================================" -ForegroundColor Cyan
    Write-Host ""
}
#endregion

#region Optional Software Hints
function Start-AgentTeamsDocumentationInBrowser {
    Start-Process $script:AGENT_TEAMS_DOC_URL
}
#endregion
