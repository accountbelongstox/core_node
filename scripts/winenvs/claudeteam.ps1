<#
.SYNOPSIS
    Launches Claude Code with multiple roles (experimental agent teams) always on,
    or runs one role pane of the claudeagents / claudeteamup team window.

.DESCRIPTION
    Standalone with --agent <role> naming an enabled registry role: applies that
    role's session_env kinds (session_env.lead only for the lead role) and
    --effort, and writes no PID file (there is no pane to verify).

    Standalone otherwise (bare, or --agent names no enabled role): sets
    CLAUDE_CODE_EXPERIMENTAL_AGENT_TEAMS=1 and the catalog session_env (all,
    windows, lead) for the current session, then runs claude with
    --teammate-mode in-process --permission-mode auto. Any script arguments are
    appended to the command line.

    Role pane (started by claudeagents.ps1 / claudeteamup.ps1):
        claudeteam.ps1 --team-pane <sessions|team> --agent <role> --name <session>
    writes %LOCALAPPDATA%\core_node\claude_team\<session>.pid first, then runs
    claude --agent <role> --name <session> --effort <frontmatter effort>
    --permission-mode auto <kickoff> with session_env.all + windows (+ lead for the
    orchestrator, with --remote-control when a remote role is enabled). The
    kickoff is expanded here from config/claude_team_roles.json, so the wt
    command lines stay short. A remote role pane keeps the ssh loop to its server
    tmux session instead. --team-no-kickoff and --team-roles <csv> are launcher
    options and are not passed to claude.

    Cross-device slot: claudeteam.ps1 --device-slot <n> picks the role for slot
    <n> of this device's profile (gpu | desktop, config device_profiles), names
    the session <device>-<role>-<abbr> (Tailscale device name) and adds
    --remote-control, or prints the manual /remote-control line. No role =
    plain claude.

.EXAMPLE
    .\claudeteam.ps1
    .\claudeteam.ps1 -xx
    .\claudeteam.ps1 --resume session-id
    .\claudeteam.ps1 --team-pane sessions --agent reviewer --name ct-reviewer
#>

Set-StrictMode -Version Latest
$ErrorActionPreference = "Stop"

$scriptPath = $null
$scriptsDirPath = $null
$shellsWinPath = $null
$winCommonDirPath = $null
$aiCliProvisionCommonScript = $null
$windowsPathFunctionScript = $null
$claudeTeamCommonScript = $null
$claudeDeviceProfileCommonScript = $null
$deviceSlot = 0
$deviceProfile = ""
$deviceRole = ""
$deviceSession = ""
$deviceRemoteHint = ""
$claudeArgs = @()
$claudeDisplayArgs = @()
$forwardArgs = @()
$paneExtraArgs = @()
$argumentIndex = 0
$argumentText = ""
$hasValue = $false
$paneMode = $null
$paneRole = ""
$paneNoKickoff = $false
$paneRoles = @()
$paneRow = $null
$standaloneRow = $null
$kickoff = ""
$kickoffDisplay = ""
$sessionEnvironment = $null
$exitCode = 0

$scriptPath = $PSScriptRoot
if ([string]::IsNullOrWhiteSpace($scriptPath)) {
    $scriptPath = Split-Path -Parent $MyInvocation.MyCommand.Path
}
$scriptsDirPath = Split-Path $scriptPath -Parent
$shellsWinPath = Join-Path $scriptsDirPath "shells"
$shellsWinPath = Join-Path $shellsWinPath "win"
$winCommonDirPath = Join-Path $shellsWinPath "win_common"
$windowsPathFunctionScript = Join-Path $winCommonDirPath "WindowsPathFunction.ps1"
$aiCliProvisionCommonScript = Join-Path $winCommonDirPath "AiCliProvisionCommon.ps1"
$claudeTeamCommonScript = Join-Path $winCommonDirPath "ClaudeTeamCommon.ps1"
$claudeDeviceProfileCommonScript = Join-Path $winCommonDirPath "ClaudeDeviceProfileCommon.ps1"
. $claudeTeamCommonScript

# Launcher-only pane options are consumed here; in a role pane --agent, --name and
# --remote-control are rebuilt from the role registry, every other token is
# forwarded to claude unchanged.
for ($argumentIndex = 0; $argumentIndex -lt $args.Count; $argumentIndex++) {
    $argumentText = [string]$args[$argumentIndex]
    $hasValue = (($argumentIndex + 1) -lt $args.Count)
    if (($argumentText -eq $ClaudeTeamPaneFlag) -and $hasValue) {
        $paneMode = [string]$args[$argumentIndex + 1]
        $argumentIndex++
        continue
    }
    if (($argumentText -eq "--device-slot") -and $hasValue) {
        $deviceSlot = [int]$args[$argumentIndex + 1]
        $argumentIndex++
        continue
    }
    if ($argumentText -eq $ClaudeTeamPaneNoKickoffFlag) {
        $paneNoKickoff = $true
        continue
    }
    if (($argumentText -eq $ClaudeTeamPaneRolesFlag) -and $hasValue) {
        $paneRoles = @(([string]$args[$argumentIndex + 1]).Split(",") | ForEach-Object { $_.Trim() } | Where-Object { $_ })
        $argumentIndex++
        continue
    }
    $forwardArgs += $args[$argumentIndex]
    if (($argumentText -in @("--agent", "--name", "-n", "--remote-control")) -and $hasValue) {
        if ($argumentText -eq "--agent") {
            $paneRole = [string]$args[$argumentIndex + 1]
        }
        $forwardArgs += $args[$argumentIndex + 1]
        $argumentIndex++
        continue
    }
    $paneExtraArgs += $args[$argumentIndex]
}

# Cross-device slot: resolve the role and session name for this device.
if ($deviceSlot -gt 0) {
    . $claudeDeviceProfileCommonScript
    $deviceProfile = Get-ClaudeDeviceProfile
    $deviceRole = Get-ClaudeDeviceSlotRole -DeviceProfile $deviceProfile -Slot $deviceSlot
    Write-Host ("[INFO] Device {0} ({1}), profile {2}, slot {3}: {4}" -f (Get-ClaudeDeviceName), (Get-ClaudeDeviceIpv4), $deviceProfile, $deviceSlot, $(if ($deviceRole) { $deviceRole } else { "plain Claude Code" })) -ForegroundColor Green
    if ($deviceRole) {
        $paneRole = $deviceRole
        $deviceSession = Get-ClaudeDeviceSessionName -Role $deviceRole
        $forwardArgs = @("--agent", $deviceRole, "--name", $deviceSession) + $forwardArgs
    }
}

if ($paneMode) {
    $paneRow = Initialize-ClaudeTeamPane -Mode $paneMode -Role $paneRole -NoKickoff $paneNoKickoff -Roles $paneRoles
}

# The pane body (the remote ssh loop, or the local claude invocation) runs
# inside try/finally so <session>.pid is dropped as soon as the role stops
# running -- on a normal return, a terminating error, or Ctrl-C -- including
# for a remote pane, whose loop has no other path back to the end of this
# script (a missing python/ssh.exe/secret returns early, and its documented
# stop is Ctrl-C). A role pane keeps its shell (-NoExit) open afterward, but
# the role itself is no longer running, so a rerun must see it as idle and
# restart it (DESIGN §3.2).
try {
    if (($null -ne $paneRow) -and $paneRow.Remote) {
        Invoke-ClaudeTeamRemoteLoop -Row $paneRow
    } else {
        . $windowsPathFunctionScript
        Set-CoreNodePaths

        # Idempotent AI CLI provisioning: install Claude Code with the official native
        # installer when the command is missing, then offer an upgrade (default N,
        # auto-skip after 5 seconds) only when a newer version is published.
        . $aiCliProvisionCommonScript
        Invoke-AiCliProvision -Tool "claude"

        if ($deviceRole) {
            if (Test-ClaudeDeviceRemoteControlSupported) {
                $forwardArgs += @("--remote-control", $deviceSession)
            } else {
                $deviceRemoteHint = ("[ACTION] Remote Control cannot be added at launch: type /remote-control {0} in this session" -f $deviceSession)
            }
        }

        # Apply only the team-specific variables on top of the caller's Claude
        # authentication context.
        if (($deviceSlot -gt 0) -and (-not $deviceRole)) {
            $sessionEnvironment = @{}
            $claudeArgs = $forwardArgs
            $claudeDisplayArgs = $claudeArgs
        } elseif ($null -ne $paneRow) {
            $sessionEnvironment = Set-ClaudeTeamSessionEnvironment -Row $paneRow
            $claudeArgs = @(Get-ClaudeTeamRoleClaudeArguments -Row $paneRow)
            $claudeArgs += $paneExtraArgs
            $claudeDisplayArgs = $claudeArgs
            if (-not $paneNoKickoff) {
                $kickoff = Get-ClaudeTeamKickoff -Role $paneRow.Role
                $claudeArgs += $kickoff
                $kickoffDisplay = (" <kickoff {0} chars>" -f $kickoff.Length)
            }
        } else {
            # A named role (--agent <role>) that resolves to an enabled registry role
            # runs as that role -- its own env kinds and effort, not the agent-teams
            # lead -- so a standalone `claudeteam --agent <role>` matches the pane
            # behavior instead of always becoming a second lead (DESIGN §3.2).
            $standaloneRow = Get-ClaudeTeamStandaloneRow -Role $paneRole
            if ($null -ne $standaloneRow) {
                $sessionEnvironment = Set-ClaudeTeamSessionEnvironment -Row $standaloneRow
                $claudeArgs = @()
                if ((-not [string]::IsNullOrWhiteSpace($standaloneRow.Effort)) -and ($forwardArgs -notcontains "--effort")) {
                    $claudeArgs += @("--effort", $standaloneRow.Effort)
                }
                $claudeArgs += @("--permission-mode", $ClaudeTeamPermissionMode)
                if ($standaloneRow.IsLead) {
                    $claudeArgs += @("--teammate-mode", $ClaudeTeamLeadTeammateMode)
                }
                $claudeArgs += $forwardArgs
                $claudeDisplayArgs = $claudeArgs
            } else {
                $env:CLAUDE_CODE_EXPERIMENTAL_AGENT_TEAMS = "1"
                $sessionEnvironment = Set-ClaudeTeamSessionEnvironment -Row $null
                $claudeArgs = @("--teammate-mode", $ClaudeTeamLeadTeammateMode, "--permission-mode", $ClaudeTeamPermissionMode)
                $claudeArgs += $forwardArgs
                $claudeDisplayArgs = $claudeArgs
            }
        }

        Write-Host ""
        Write-Host "============================================================" -ForegroundColor Cyan
        Write-Host "claudeteam.ps1" -ForegroundColor Yellow
        Write-Host "============================================================" -ForegroundColor Cyan
        if ($null -ne $paneRow) {
            Write-Host ("[INFO] Role pane {0} ({1}), launcher mode {2}, model {3} (agent definition), effort {4}" -f $paneRow.Role, $paneRow.Session, $paneMode, $paneRow.Model, $paneRow.Effort) -ForegroundColor Green
        } elseif ($null -ne $standaloneRow) {
            Write-Host ("[INFO] Standalone role {0} ({1}), model {2} (agent definition), effort {3}" -f $standaloneRow.Role, $standaloneRow.Session, $standaloneRow.Model, $standaloneRow.Effort) -ForegroundColor Green
        } else {
            Write-Host ("[INFO] {0}=1 (session, multiple roles); teammate mode {1} (Windows default)" -f $ClaudeTeamAgentTeamsVariable, $ClaudeTeamLeadTeammateMode) -ForegroundColor Green
        }
        Write-Host ("[INFO] Session env: {0}=1 {1}" -f $ClaudeTeamSessionMarkerVariable, ((@($sessionEnvironment.Keys) | ForEach-Object { "{0}={1}" -f $_, $sessionEnvironment[$_] }) -join " ")) -ForegroundColor Green
        Write-Host ("[INFO] Invoking: claude {0}{1}" -f ($claudeDisplayArgs -join " "), $kickoffDisplay) -ForegroundColor Green
        if ($deviceRemoteHint) {
            Write-Host $deviceRemoteHint -ForegroundColor Yellow
        }
        Write-Host "============================================================" -ForegroundColor Cyan
        Write-Host ""

        # Keep every grid/team window on the same claude build: a background
        # auto-update re-triggers the version-gated onboarding/login screens in
        # each window. Upgrades stay manual through the provisioning step.
        $env:DISABLE_AUTOUPDATER = "1"
        & claude @claudeArgs
        $exitCode = $LASTEXITCODE
        if ($null -eq $exitCode) {
            $exitCode = 0
        }
    }
} finally {
    if ($null -ne $paneRow) {
        Remove-ClaudeTeamPidFile -Session $paneRow.Session
    }
}

if ($null -ne $paneRow) {
    return
}
exit $exitCode
