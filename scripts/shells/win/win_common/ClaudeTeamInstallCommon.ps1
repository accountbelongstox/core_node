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
# Shared idempotent Claude team setup (Windows / PowerShell)
# =============================================================================
# One implementation called by dd.ps1 (Step21, ClaudeCode PostInstallCallbacks) and
# by the claudeteamup/claudeagents launchers (ClaudeTeamCommon.ps1) on every run.
# Linux counterpart: claude_team_install in scripts/ai_shtools/claude_code_install.sh
# Each item is checked and repaired on its own: node (git guard hook), Windows
# Terminal (positioned role windows), the team state dir, the shared data dir, and
# the core_node PATH entries (winenvs makes claudeteam/claudeteamup/claudeagents
# commands). -CheckOnly reports [SKIP]/[MISSING] without changing anything.
# =============================================================================

$ClaudeTeamInstallWinCommonDir = $PSScriptRoot
$ClaudeTeamInstallWinDir = Split-Path $ClaudeTeamInstallWinCommonDir -Parent
$ClaudeTeamInstallShellsDir = Split-Path $ClaudeTeamInstallWinDir -Parent
$ClaudeTeamInstallScriptsDir = Split-Path $ClaudeTeamInstallShellsDir -Parent
$ClaudeTeamInstallRootDir = Split-Path $ClaudeTeamInstallScriptsDir -Parent
$ClaudeTeamInstallClaudeDir = Join-Path $ClaudeTeamInstallRootDir ".claude"
$ClaudeTeamInstallSharedDir = Join-Path $ClaudeTeamInstallClaudeDir "agents_shared"
$ClaudeTeamInstallStateBaseDir = Join-Path $env:LOCALAPPDATA "core_node"
$ClaudeTeamInstallStateDir = Join-Path $ClaudeTeamInstallStateBaseDir "claude_team"
$ClaudeTeamInstallWinEnvsDir = Join-Path $ClaudeTeamInstallScriptsDir "winenvs"
$ClaudeTeamInstallBinaries = @(
    @{ Command = "node.exe"; WingetId = "OpenJS.NodeJS.LTS"; Purpose = "project hooks .claude/hooks/*.mjs" },
    @{ Command = "git.exe"; WingetId = "Git.Git"; Purpose = "Git for Windows: official recommendation, enables the Bash tool (Git Bash)" },
    @{ Command = "wt.exe"; WingetId = "Microsoft.WindowsTerminal"; Purpose = "positioned role windows (console fallback without it)" }
)
$ClaudeTeamInstallAgentMemoryDir = Join-Path $ClaudeTeamInstallClaudeDir "agent-memory"
$ClaudeTeamInstallReportsDir = Join-Path $ClaudeTeamInstallSharedDir "reports"
$ClaudeTeamInstallReviewsDir = Join-Path $ClaudeTeamInstallSharedDir "reviews"

function Write-ClaudeTeamInstallLog {
    param([string]$Level, [string]$Message)
    $color = "Gray"
    switch ($Level) {
        "SKIP" { $color = "Green" }
        "OK" { $color = "Green" }
        "INSTALL" { $color = "Yellow" }
        "MISSING" { $color = "Magenta" }
        "WARN" { $color = "Magenta" }
    }
    Write-Host ("  [{0}] {1}" -f $Level, $Message) -ForegroundColor $color
}

function Install-ClaudeTeamBinary {
    param([hashtable]$Item, [bool]$CheckOnly)
    $command = Get-Command $Item.Command -ErrorAction SilentlyContinue
    $wingetCommand = $null
    if ($command) {
        Write-ClaudeTeamInstallLog "SKIP" ("{0} present: {1} ({2})" -f $Item.Command, $command.Source, $Item.Purpose)
        return
    }
    if ($CheckOnly) {
        Write-ClaudeTeamInstallLog "MISSING" ("{0} (winget {1}; {2})" -f $Item.Command, $Item.WingetId, $Item.Purpose)
        return
    }
    $wingetCommand = Get-Command "winget.exe" -ErrorAction SilentlyContinue
    if ($null -eq $wingetCommand) {
        Write-ClaudeTeamInstallLog "WARN" ("{0} missing and winget unavailable; install {1} manually" -f $Item.Command, $Item.WingetId)
        return
    }
    Write-ClaudeTeamInstallLog "INSTALL" ("{0} missing; winget install --id {1} ({2})" -f $Item.Command, $Item.WingetId, $Item.Purpose)
    & $wingetCommand.Source install --id $Item.WingetId --exact --silent --accept-source-agreements --accept-package-agreements | Out-Host
    $command = Get-Command $Item.Command -ErrorAction SilentlyContinue
    if ($command) {
        Write-ClaudeTeamInstallLog "OK" ("{0} installed: {1}" -f $Item.Command, $command.Source)
    } else {
        Write-ClaudeTeamInstallLog "WARN" ("{0} not on PATH yet; open a new shell after the install" -f $Item.Command)
    }
}

function Install-ClaudeTeamDirectory {
    param([string]$Path, [string]$Purpose, [bool]$CheckOnly)
    if (Test-Path -LiteralPath $Path) {
        Write-ClaudeTeamInstallLog "SKIP" ("dir present: {0} ({1})" -f $Path, $Purpose)
        return
    }
    if ($CheckOnly) {
        Write-ClaudeTeamInstallLog "MISSING" ("dir {0} ({1})" -f $Path, $Purpose)
        return
    }
    New-Item -ItemType Directory -Path $Path -Force | Out-Null
    Write-ClaudeTeamInstallLog "OK" ("dir created: {0} ({1})" -f $Path, $Purpose)
}

function Install-ClaudeTeamPathEntry {
    param([bool]$CheckOnly)
    $pathEntries = @($env:Path -split ";" | Where-Object { $_ } | ForEach-Object { $_.TrimEnd("\") })
    if ($pathEntries -contains $ClaudeTeamInstallWinEnvsDir.TrimEnd("\")) {
        Write-ClaudeTeamInstallLog "SKIP" ("PATH contains {0} (claudeteam, claudeteamup, claudeagents)" -f $ClaudeTeamInstallWinEnvsDir)
        return
    }
    if ($CheckOnly -or ($null -eq (Get-Command "Set-CoreNodePaths" -ErrorAction SilentlyContinue))) {
        Write-ClaudeTeamInstallLog "MISSING" ("PATH entry {0}" -f $ClaudeTeamInstallWinEnvsDir)
        return
    }
    Set-CoreNodePaths
    Write-ClaudeTeamInstallLog "OK" ("PATH ensured for {0}" -f $ClaudeTeamInstallWinEnvsDir)
}

function Invoke-ClaudeTeamInstall {
    param([switch]$CheckOnly)
    $item = $null
    foreach ($item in $ClaudeTeamInstallBinaries) {
        Install-ClaudeTeamBinary -Item $item -CheckOnly ([bool]$CheckOnly)
    }
    Install-ClaudeTeamDirectory -Path $ClaudeTeamInstallStateDir -Purpose "role PID files" -CheckOnly ([bool]$CheckOnly)
    Install-ClaudeTeamDirectory -Path $ClaudeTeamInstallSharedDir -Purpose "shared data between roles" -CheckOnly ([bool]$CheckOnly)
    Install-ClaudeTeamDirectory -Path $ClaudeTeamInstallReportsDir -Purpose "role handoff reports (TeammateIdle gate)" -CheckOnly ([bool]$CheckOnly)
    Install-ClaudeTeamDirectory -Path $ClaudeTeamInstallReviewsDir -Purpose "reviewer verdicts (TaskCompleted gate)" -CheckOnly ([bool]$CheckOnly)
    Install-ClaudeTeamDirectory -Path $ClaudeTeamInstallAgentMemoryDir -Purpose "per-role agent memory (memory: project)" -CheckOnly ([bool]$CheckOnly)
    Install-ClaudeTeamPathEntry -CheckOnly ([bool]$CheckOnly)
}
