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
# Shared idempotent Claude multi-role team orchestration (Windows / PowerShell)
# =============================================================================
# Used by scripts/winenvs/claudeteamup.ps1 (mode "sessions": one window per role,
# cross-session messaging) and scripts/winenvs/claudeagents.ps1 (mode "team": one
# lead window in agent-teams mode, in-process teammates). Linux counterpart:
#   scripts/shells/linux/common/claude_team_common.sh
# Catalog: config/claude_team_roles.json. Role prompts: .claude/agents/*.md.
# Each window runs scripts/winenvs/claudeteam.ps1 --agent <role> (auto permission
# mode, git guard); its shell writes its PID to
# %LOCALAPPDATA%\core_node\claude_team\<mode>-<role>.pid and a live PID skips it.
# Callers dot-source WindowsPathFunction.ps1 and AiCliProvisionCommon.ps1 first.
# =============================================================================

$ClaudeTeamCommonDir = $PSScriptRoot
$ClaudeTeamWinDir = Split-Path $ClaudeTeamCommonDir -Parent
$ClaudeTeamShellsDir = Split-Path $ClaudeTeamWinDir -Parent
$ClaudeTeamScriptsDir = Split-Path $ClaudeTeamShellsDir -Parent
$ClaudeTeamRootDir = Split-Path $ClaudeTeamScriptsDir -Parent
$ClaudeTeamConfigDir = Join-Path $ClaudeTeamRootDir "config"
$ClaudeTeamCatalogPath = Join-Path $ClaudeTeamConfigDir "claude_team_roles.json"
$ClaudeTeamWinEnvsDir = Join-Path $ClaudeTeamScriptsDir "winenvs"
$ClaudeTeamLauncherPath = Join-Path $ClaudeTeamWinEnvsDir "claudeteam.ps1"
$ClaudeTeamInstallCommonScript = Join-Path $ClaudeTeamCommonDir "ClaudeTeamInstallCommon.ps1"
$ClaudeTeamTotalSteps = 9
$ClaudeTeamPidWaitMilliseconds = 10000
$ClaudeTeamWindowWaitMilliseconds = 5000
$ClaudeTeamPollMilliseconds = 250
$ClaudeTeamShellNames = @("pwsh", "powershell")
$ClaudeTeamLeadRole = "orchestrator"
$ClaudeTeamUserClaudeDir = Join-Path $env:USERPROFILE ".claude"
$ClaudeTeamUserTeamsDir = Join-Path $ClaudeTeamUserClaudeDir "teams"
$ClaudeTeamUserTasksDir = Join-Path $ClaudeTeamUserClaudeDir "tasks"

. $ClaudeTeamInstallCommonScript
$ClaudeTeamStateDir = $ClaudeTeamInstallStateDir

$script:ClaudeTeamMode = "sessions"
$script:ClaudeTeamOptStatus = $false
$script:ClaudeTeamOptNoWindows = $false
$script:ClaudeTeamOptNoKickoff = $false
$script:ClaudeTeamOptRoles = @()
$script:ClaudeTeamCatalog = $null
$script:ClaudeTeamRows = @()
$script:ClaudeTeamWtPath = $null
$script:ClaudeTeamShellPath = $null
$script:ClaudeTeamScreen = $null

function Write-ClaudeTeamStep {
    param([int]$Number, [string]$Title)
    Write-Host ""
    Write-Host ("[STEP {0}/{1}] {2}" -f $Number, $ClaudeTeamTotalSteps, $Title) -ForegroundColor Cyan
}

function Write-ClaudeTeamLog {
    param([string]$Level, [string]$Message)
    $color = "Gray"
    switch ($Level) {
        { $_ -in @("OK", "SKIP") } { $color = "Green" }
        { $_ -in @("INSTALL", "START", "OPEN", "LINK") } { $color = "Yellow" }
        "WARN" { $color = "Magenta" }
        "ERROR" { $color = "Red" }
    }
    Write-Host ("  [{0}] {1}" -f $Level, $Message) -ForegroundColor $color
}

function ConvertTo-ClaudeTeamQuoted {
    param([string]$Text)
    return ("'{0}'" -f $Text.Replace("'", "''"))
}

function Get-ClaudeTeamSessionName {
    param([string]$Role)
    if ($script:ClaudeTeamMode -eq "team") {
        if ($Role -eq $ClaudeTeamLeadRole) {
            return [string]$script:ClaudeTeamCatalog.team.session_name
        }
        return ("teammate:{0}" -f $Role)
    }
    return ("{0}{1}" -f $script:ClaudeTeamCatalog.sessions.session_prefix, $Role)
}

function Get-ClaudeTeamPidPath {
    param([string]$Role)
    return (Join-Path $ClaudeTeamStateDir ("{0}-{1}.pid" -f $script:ClaudeTeamMode, $Role))
}

function Get-ClaudeTeamOtherRoles {
    return ((@($script:ClaudeTeamRows | Where-Object { ($_.Role -ne $ClaudeTeamLeadRole) -and ($_.State -notin @("disabled", "not-selected", "no-agent-file")) }) | ForEach-Object { $_.Role }) -join ", ")
}

function Show-ClaudeTeamPlatform {
    $osInfo = $null
    $osCaption = "unknown"
    $osBuild = "unknown"
    $osInfo = Get-CimInstance -ClassName Win32_OperatingSystem -ErrorAction SilentlyContinue
    if ($osInfo) {
        $osCaption = $osInfo.Caption
        $osBuild = $osInfo.BuildNumber
    }
    Write-ClaudeTeamLog "OK" ("OS: {0} (build {1}); PowerShell {2}" -f $osCaption, $osBuild, $PSVersionTable.PSVersion)
    Write-ClaudeTeamLog "OK" ("User: {0}\{1}" -f $env:USERDOMAIN, $env:USERNAME)
    Write-ClaudeTeamLog "OK" ("Mode: {0}; project root: {1}" -f $script:ClaudeTeamMode, $ClaudeTeamRootDir)
    Write-ClaudeTeamLog "OK" ("State dir: {0}" -f $ClaudeTeamStateDir)
}

function Resolve-ClaudeTeamWindowsTerminal {
    $wtCommand = Get-Command "wt.exe" -ErrorAction SilentlyContinue
    if ($wtCommand) {
        return $wtCommand.Source
    }
    return $null
}

function Install-ClaudeTeamPrerequisites {
    $shellName = $null
    $shellCommand = $null

    Invoke-ClaudeTeamInstall -CheckOnly:$script:ClaudeTeamOptStatus

    foreach ($shellName in $ClaudeTeamShellNames) {
        $shellCommand = Get-Command ("{0}.exe" -f $shellName) -ErrorAction SilentlyContinue
        if ($shellCommand) {
            $script:ClaudeTeamShellPath = $shellCommand.Source
            break
        }
    }
    $script:ClaudeTeamWtPath = Resolve-ClaudeTeamWindowsTerminal
    Write-ClaudeTeamLog "OK" ("Role shell: {0}; Windows Terminal: {1}" -f $script:ClaudeTeamShellPath, $(if ($script:ClaudeTeamWtPath) { $script:ClaudeTeamWtPath } else { "none (console fallback)" }))
}

function Invoke-ClaudeTeamClaudeProvision {
    $claudeCommand = $null
    if (-not $script:ClaudeTeamOptStatus) {
        Invoke-AiCliProvision -Tool "claude"
    }
    $claudeCommand = Get-Command "claude" -ErrorAction SilentlyContinue
    if ($claudeCommand) {
        Write-ClaudeTeamLog "OK" ("claude: {0} ({1})" -f $claudeCommand.Source, ((& claude --version) | Select-Object -First 1))
    } else {
        Write-ClaudeTeamLog "WARN" "claude missing; run claudeteamup without -Status to install"
    }
    Write-ClaudeTeamLog "OK" ("Role launcher: {0} (--permission-mode auto, in-process teammates, git guard on)" -f $ClaudeTeamLauncherPath)
}

function Import-ClaudeTeamCatalog {
    $docPath = $null
    $docRelative = $null
    $index = 0
    $role = $null
    $agentPath = $null
    $agentsDir = $null
    $state = $null

    $script:ClaudeTeamCatalog = Get-Content -LiteralPath $ClaudeTeamCatalogPath -Raw -Encoding UTF8 | ConvertFrom-Json
    Write-ClaudeTeamLog "OK" ("Catalog: {0} ({1} roles, permission mode {2})" -f $ClaudeTeamCatalogPath, @($script:ClaudeTeamCatalog.roles).Count, $script:ClaudeTeamCatalog.permission_mode)

    foreach ($docRelative in @($script:ClaudeTeamCatalog.requirements_doc, $script:ClaudeTeamCatalog.task_board)) {
        $docPath = Join-Path $ClaudeTeamRootDir $docRelative
        if (Test-Path -LiteralPath $docPath) {
            Write-ClaudeTeamLog "OK" ("Orchestration doc: {0}" -f $docPath)
        } else {
            Write-ClaudeTeamLog "WARN" ("Orchestration doc missing: {0}" -f $docPath)
        }
    }

    $agentsDir = Join-Path $ClaudeTeamRootDir $script:ClaudeTeamCatalog.agents_dir
    $script:ClaudeTeamRows = @()
    foreach ($role in @($script:ClaudeTeamCatalog.roles)) {
        $agentPath = Join-Path $agentsDir ("{0}.md" -f $role.name)
        $state = "enabled"
        if (-not $role.enabled) {
            $state = "disabled"
            Write-ClaudeTeamLog "SKIP" ("Role {0} disabled in catalog" -f $role.name)
        } elseif (($script:ClaudeTeamOptRoles.Count -gt 0) -and ($script:ClaudeTeamOptRoles -notcontains $role.name) -and (($script:ClaudeTeamMode -eq "sessions") -or ($role.name -ne $ClaudeTeamLeadRole))) {
            $state = "not-selected"
            Write-ClaudeTeamLog "SKIP" ("Role {0} not in -Roles" -f $role.name)
        } elseif (-not (Test-Path -LiteralPath $agentPath)) {
            $state = "no-agent-file"
            Write-ClaudeTeamLog "WARN" ("Role {0} disabled: agent file missing {1}" -f $role.name, $agentPath)
        } elseif (($script:ClaudeTeamMode -eq "team") -and ($role.name -ne $ClaudeTeamLeadRole)) {
            $state = "teammate"
            Write-ClaudeTeamLog "OK" ("Teammate type {0} (spawned in-process by the lead on demand): {1}" -f $role.name, $agentPath)
        } else {
            Write-ClaudeTeamLog "OK" ("Session role {0} (slot {1}): {2}" -f $role.name, ($index + 1), $agentPath)
        }
        $script:ClaudeTeamRows += [pscustomobject]@{
            Role    = $role.name
            Slot    = $index
            Session = (Get-ClaudeTeamSessionName -Role $role.name)
            Enabled = ($state -eq "enabled")
            State   = $state
            Window  = "-"
            Pid     = "-"
            Pixels  = "-"
            Term    = "-"
        }
        $index++
    }
}

function Get-ClaudeTeamScreen {
    $workingArea = $null
    Add-Type -AssemblyName System.Windows.Forms
    $workingArea = [System.Windows.Forms.Screen]::PrimaryScreen.WorkingArea
    $script:ClaudeTeamScreen = [pscustomobject]@{
        X = $workingArea.X
        Y = $workingArea.Y
        Width = $workingArea.Width
        Height = $workingArea.Height
    }
    Write-ClaudeTeamLog "OK" ("Screen working area: {0}x{1}+{2}+{3} (primary)" -f $workingArea.Width, $workingArea.Height, $workingArea.X, $workingArea.Y)
    if ($script:ClaudeTeamOptNoWindows) {
        Write-ClaudeTeamLog "SKIP" "-NoWindows: role windows are not opened"
    } elseif ($script:ClaudeTeamWtPath) {
        Write-ClaudeTeamLog "OK" ("Terminal: {0} (positioned via --pos/--size)" -f $script:ClaudeTeamWtPath)
    } else {
        Write-ClaudeTeamLog "WARN" ("Terminal: {0} console (positioned via MoveWindow when the console window is owned by the shell)" -f $script:ClaudeTeamShellPath)
    }
}

function Get-ClaudeTeamCell {
    param([int]$Slot)
    $grid = $script:ClaudeTeamCatalog.grid
    $columns = $grid.columns
    $rows = $grid.rows
    if ($script:ClaudeTeamMode -eq "team") {
        $columns = 1
        $rows = 1
    }
    $column = $Slot % $columns
    $row = [math]::Floor($Slot / $columns) % $rows
    $cellWidth = [math]::Floor($script:ClaudeTeamScreen.Width / $columns)
    $cellHeight = [math]::Floor($script:ClaudeTeamScreen.Height / $rows)
    $termCols = [math]::Max(40, [math]::Floor(($cellWidth - $grid.chrome_width_px) / $grid.char_width_px))
    $termRows = [math]::Max(10, [math]::Floor(($cellHeight - $grid.chrome_height_px) / $grid.char_height_px))
    return [pscustomobject]@{
        X = $script:ClaudeTeamScreen.X + ($column * $cellWidth)
        Y = $script:ClaudeTeamScreen.Y + ($row * $cellHeight)
        Width = $cellWidth
        Height = $cellHeight
        Cols = $termCols
        Rows = $termRows
    }
}

function Get-ClaudeTeamLiveProcess {
    param([string]$Role)
    $pidPath = Get-ClaudeTeamPidPath -Role $Role
    $pidText = $null
    $pidValue = 0
    $process = $null
    if (-not (Test-Path -LiteralPath $pidPath)) {
        return $null
    }
    $pidText = (Get-Content -LiteralPath $pidPath -Raw -ErrorAction SilentlyContinue)
    if ([string]::IsNullOrWhiteSpace($pidText) -or (-not [int]::TryParse($pidText.Trim(), [ref]$pidValue))) {
        return $null
    }
    $process = Get-Process -Id $pidValue -ErrorAction SilentlyContinue
    if ($process -and ($ClaudeTeamShellNames -contains $process.ProcessName)) {
        return $process
    }
    return $null
}

function Get-ClaudeTeamKickoff {
    param([string]$Role)
    $text = [string]$script:ClaudeTeamCatalog.sessions.kickoff
    if ($script:ClaudeTeamMode -eq "team") {
        $text = [string]$script:ClaudeTeamCatalog.team.kickoff
    } elseif ($Role -eq $ClaudeTeamLeadRole) {
        $text = [string]$script:ClaudeTeamCatalog.sessions.kickoff_lead
    }
    $text = $text.Replace("{role}", $Role)
    $text = $text.Replace("{session}", (Get-ClaudeTeamSessionName -Role $Role))
    $text = $text.Replace("{requirements}", [string]$script:ClaudeTeamCatalog.requirements_doc)
    $text = $text.Replace("{board}", [string]$script:ClaudeTeamCatalog.task_board)
    $text = $text.Replace("{prefix}", [string]$script:ClaudeTeamCatalog.sessions.session_prefix)
    $text = $text.Replace("{shared}", [string]$script:ClaudeTeamCatalog.shared_dir)
    $text = $text.Replace("{agents_dir}", [string]$script:ClaudeTeamCatalog.agents_dir)
    $text = $text.Replace("{roles}", (Get-ClaudeTeamOtherRoles))
    return $text
}

function Get-ClaudeTeamEncodedCommand {
    param([string]$Role, [string]$Session)
    $pidPath = Get-ClaudeTeamPidPath -Role $Role
    $kickoffArgument = ""
    $scriptLines = $null
    $scriptText = $null
    if (-not $script:ClaudeTeamOptNoKickoff) {
        $kickoffArgument = (" {0}" -f (ConvertTo-ClaudeTeamQuoted -Text (Get-ClaudeTeamKickoff -Role $Role)))
    }
    $scriptLines = @(
        '$ErrorActionPreference = ''Continue'''
        ('Set-Content -LiteralPath {0} -Value $PID -Encoding ascii' -f (ConvertTo-ClaudeTeamQuoted -Text $pidPath))
        '$env:CLAUDE_CODE_EXPERIMENTAL_AGENT_TEAMS = ''1'''
        ('$Host.UI.RawUI.WindowTitle = {0}' -f (ConvertTo-ClaudeTeamQuoted -Text $Session))
        ('Set-Location -LiteralPath {0}' -f (ConvertTo-ClaudeTeamQuoted -Text $ClaudeTeamRootDir))
        ('& {0} --agent {1} --name {2}{3}' -f (ConvertTo-ClaudeTeamQuoted -Text $ClaudeTeamLauncherPath), (ConvertTo-ClaudeTeamQuoted -Text $Role), (ConvertTo-ClaudeTeamQuoted -Text $Session), $kickoffArgument)
    )
    $scriptText = $scriptLines -join [Environment]::NewLine
    return [Convert]::ToBase64String([System.Text.Encoding]::Unicode.GetBytes($scriptText))
}

function Initialize-ClaudeTeamWin32 {
    if ("ClaudeTeamWin32" -as [type]) {
        return
    }
    Add-Type @"
using System;
using System.Runtime.InteropServices;
public static class ClaudeTeamWin32 {
    [DllImport("user32.dll")]
    public static extern bool MoveWindow(IntPtr hWnd, int X, int Y, int nWidth, int nHeight, bool bRepaint);
}
"@
}

function Wait-ClaudeTeamPid {
    param([string]$Role, [datetime]$LaunchTime)
    $pidPath = Get-ClaudeTeamPidPath -Role $Role
    $deadline = (Get-Date).AddMilliseconds($ClaudeTeamPidWaitMilliseconds)
    $process = $null
    while ((Get-Date) -lt $deadline) {
        if ((Test-Path -LiteralPath $pidPath) -and ((Get-Item -LiteralPath $pidPath).LastWriteTime -ge $LaunchTime.AddSeconds(-1))) {
            $process = Get-ClaudeTeamLiveProcess -Role $Role
            if ($process) {
                return $process
            }
        }
        Start-Sleep -Milliseconds $ClaudeTeamPollMilliseconds
    }
    return $null
}

function Start-ClaudeTeamRoleWindow {
    param($Row, $Cell)
    $encodedCommand = Get-ClaudeTeamEncodedCommand -Role $Row.Role -Session $Row.Session
    $launchTime = Get-Date
    $wtArguments = $null
    $shellProcess = $null
    $deadline = $null
    $process = $null

    if ($script:ClaudeTeamWtPath) {
        $wtArguments = @(
            "-w", "new",
            "--pos", ("{0},{1}" -f $Cell.X, $Cell.Y),
            "--size", ("{0},{1}" -f $Cell.Cols, $Cell.Rows),
            "new-tab", "--title", $Row.Session, "--suppressApplicationTitle",
            ('"{0}"' -f $script:ClaudeTeamShellPath), "-NoLogo", "-NoExit", "-EncodedCommand", $encodedCommand
        )
        Start-Process -FilePath $script:ClaudeTeamWtPath -ArgumentList $wtArguments | Out-Null
        Write-ClaudeTeamLog "OPEN" ("Window {0}: wt.exe -w new --pos {1},{2} --size {3},{4} new-tab --title {0} {5} -NoExit -EncodedCommand <claudeteam.ps1 --agent {6}>" -f $Row.Session, $Cell.X, $Cell.Y, $Cell.Cols, $Cell.Rows, $script:ClaudeTeamShellPath, $Row.Role)
    } else {
        $shellProcess = Start-Process -FilePath $script:ClaudeTeamShellPath -ArgumentList @("-NoLogo", "-NoExit", "-EncodedCommand", $encodedCommand) -PassThru
        Write-ClaudeTeamLog "OPEN" ("Window {0}: {1} -NoExit -EncodedCommand <claudeteam.ps1 --agent {2}>" -f $Row.Session, $script:ClaudeTeamShellPath, $Row.Role)
        $deadline = (Get-Date).AddMilliseconds($ClaudeTeamWindowWaitMilliseconds)
        while (((Get-Date) -lt $deadline) -and ($shellProcess.MainWindowHandle -eq [IntPtr]::Zero)) {
            Start-Sleep -Milliseconds $ClaudeTeamPollMilliseconds
            $shellProcess.Refresh()
        }
        if ($shellProcess.MainWindowHandle -ne [IntPtr]::Zero) {
            Initialize-ClaudeTeamWin32
            [ClaudeTeamWin32]::MoveWindow($shellProcess.MainWindowHandle, $Cell.X, $Cell.Y, $Cell.Width, $Cell.Height, $true) | Out-Null
            Write-ClaudeTeamLog "OK" ("Window {0} moved to {1},{2} size {3}x{4} px" -f $Row.Session, $Cell.X, $Cell.Y, $Cell.Width, $Cell.Height)
        } else {
            Write-ClaudeTeamLog "WARN" ("Window {0} is hosted by another terminal; left unpositioned" -f $Row.Session)
        }
    }

    $process = Wait-ClaudeTeamPid -Role $Row.Role -LaunchTime $launchTime
    if ($process) {
        $Row.Window = "opened"
        $Row.Pid = $process.Id
        Write-ClaudeTeamLog "OK" ("Role {0} shell PID {1} recorded in {2}" -f $Row.Role, $process.Id, (Get-ClaudeTeamPidPath -Role $Row.Role))
    } else {
        $Row.Window = "unconfirmed"
        Write-ClaudeTeamLog "WARN" ("Role {0} PID not recorded within {1} ms" -f $Row.Role, $ClaudeTeamPidWaitMilliseconds)
    }
}

function Start-ClaudeTeamRoles {
    $row = $null
    $cell = $null
    $process = $null
    foreach ($row in $script:ClaudeTeamRows) {
        if (-not $row.Enabled) {
            continue
        }
        $cell = Get-ClaudeTeamCell -Slot $row.Slot
        $row.Pixels = ("{0}x{1}+{2}+{3}" -f $cell.Width, $cell.Height, $cell.X, $cell.Y)
        $row.Term = ("{0}x{1}" -f $cell.Cols, $cell.Rows)
        $process = Get-ClaudeTeamLiveProcess -Role $row.Role
        if ($process) {
            $row.State = "running"
            $row.Window = "open"
            $row.Pid = $process.Id
            Write-ClaudeTeamLog "SKIP" ("Role {0} already running (PID {1})" -f $row.Role, $process.Id)
            continue
        }
        if ($script:ClaudeTeamOptStatus) {
            $row.State = "stopped"
            continue
        }
        if ($script:ClaudeTeamOptNoWindows) {
            $row.State = "stopped"
            Write-ClaudeTeamLog "SKIP" ("Role {0}: -NoWindows (Windows roles need a window)" -f $row.Role)
            continue
        }
        $row.State = "started"
        Write-ClaudeTeamLog "START" ("Role {0}: claudeteam.ps1 --agent {0} --name {1}{2}" -f $row.Role, $row.Session, $(if ($script:ClaudeTeamOptNoKickoff) { "" } else { " <kickoff>" }))
        Start-ClaudeTeamRoleWindow -Row $row -Cell $cell
    }
}

function Show-ClaudeTeamReport {
    Write-Host ""
    $script:ClaudeTeamRows | Format-Table -AutoSize Role, Session, State, Window, Pid, Pixels, Term | Out-Host
    Write-ClaudeTeamLog "OK" ("PID files: {0}" -f $ClaudeTeamStateDir)
    Write-ClaudeTeamLog "OK" ("Shared project data: {0} (files by path; git grant file git_grant.json)" -f (Join-Path $ClaudeTeamRootDir $script:ClaudeTeamCatalog.shared_dir))
    Write-ClaudeTeamLog "OK" ("Durable task record: {0}" -f (Join-Path $ClaudeTeamRootDir $script:ClaudeTeamCatalog.task_board))
    if ($script:ClaudeTeamMode -eq "team") {
        Write-ClaudeTeamLog "OK" ("Agent-team task lists: {0}\<team>; mailboxes and members: {1}\<team>\inboxes, config.json" -f $ClaudeTeamUserTasksDir, $ClaudeTeamUserTeamsDir)
        Write-ClaudeTeamLog "OK" ("Dispatch: type one task in the {0} window; teammates run in-process (Up/Down in the agent panel, Enter to view)" -f $script:ClaudeTeamCatalog.team.session_name)
    } else {
        Write-ClaudeTeamLog "OK" "Messaging: sessions discover each other with ListAgents and talk with SendMessage by --name (/list-agents shows the roster)"
        Write-ClaudeTeamLog "OK" ("Dispatch: type one task in the {0}orchestrator window" -f $script:ClaudeTeamCatalog.sessions.session_prefix)
    }
    Write-ClaudeTeamLog "OK" "Git: blocked for every role; a user prompt containing allow-git (or 允许git) grants it for 120 min, deny-git revokes"
    Write-ClaudeTeamLog "OK" "Re-run is idempotent: roles with a live shell PID are skipped"
}

function Invoke-ClaudeTeamUp {
    param([string]$Mode, [switch]$Status, [switch]$NoWindows, [switch]$NoKickoff, [string[]]$Roles)
    $script:ClaudeTeamMode = $Mode
    $script:ClaudeTeamOptStatus = [bool]$Status
    $script:ClaudeTeamOptNoWindows = [bool]$NoWindows
    $script:ClaudeTeamOptNoKickoff = [bool]$NoKickoff
    $script:ClaudeTeamOptRoles = @($Roles | Where-Object { -not [string]::IsNullOrWhiteSpace($_) })

    Write-ClaudeTeamStep -Number 1 -Title "Platform profile"
    Show-ClaudeTeamPlatform
    Write-ClaudeTeamStep -Number 2 -Title "Team setup, item by item (shared Invoke-ClaudeTeamInstall, same as dd.ps1 ClaudeCode callback)"
    Install-ClaudeTeamPrerequisites
    Write-ClaudeTeamStep -Number 3 -Title "Claude Code CLI (shared Invoke-AiCliProvision)"
    Invoke-ClaudeTeamClaudeProvision
    Write-ClaudeTeamStep -Number 4 -Title "Role catalog, agent files, orchestration docs"
    Import-ClaudeTeamCatalog
    Write-ClaudeTeamStep -Number 5 -Title "Entry command"
    Write-ClaudeTeamLog "OK" ("claudeteamup / claudeagents: {0}" -f $ClaudeTeamWinEnvsDir)
    Write-ClaudeTeamStep -Number 6 -Title "Screen and terminal"
    Get-ClaudeTeamScreen
    Write-ClaudeTeamStep -Number 7 -Title "Role liveness (PID files)"
    Write-ClaudeTeamLog "OK" ("Checking {0} roles" -f @($script:ClaudeTeamRows | Where-Object { $_.Enabled }).Count)
    Write-ClaudeTeamStep -Number 8 -Title ("Windows (mode {0})" -f $script:ClaudeTeamMode)
    Start-ClaudeTeamRoles
    Write-ClaudeTeamStep -Number 9 -Title "Summary"
    Show-ClaudeTeamReport
}
