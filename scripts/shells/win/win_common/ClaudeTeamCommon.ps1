# =============================================================================
# Shared idempotent Claude multi-role team orchestration (Windows / PowerShell)
# =============================================================================
# Used by scripts/winenvs/claudeteamup.ps1 (mode "sessions", lead ct-orchestrator)
# and scripts/winenvs/claudeagents.ps1 (mode "team", lead ca-orchestrator).
# Sessions mode starts independent role sessions; team mode starts only the lead,
# which spawns native teammates on demand. Linux counterpart:
#   scripts/shells/linux/common/claude_team_common.sh
# Roles: .claude/agents/*.md (frontmatter name, model, effort). Catalog
# config/claude_team_roles.json: kickoffs, layout, session_env, remote, and role
# overrides (enabled, remote); an agent file without a catalog row is enabled.
# Layout: one named Windows Terminal window, maximized on the target monitor,
# with the roles packed into tabs of equal split panes sized from a
# Per-Monitor-V2 query (rcWork + DPI). Each pane runs
#   <shell> -NoLogo -NoExit -File scripts/winenvs/claudeteam.ps1 --team-pane <mode> --agent <role> --name <session>
# and claudeteam.ps1 writes %LOCALAPPDATA%\core_node\claude_team\<session>.pid,
# applies session_env and expands the kickoff itself (short wt command lines).
# A live PID, or a live process started with the role's --name, skips its role;
# after launch every PID is verified and a missing role is reopened as its own
# tab (WT silently drops a split without room). A role counts as ready only once
# the Claude session registry (<config>\sessions\*.json) names its session: a
# PID proves the pane shell, not a claude past its setup, login or trust screen.
# While the Claude account is not ready, sessions mode starts only the lead.
# Callers dot-source WindowsPathFunction.ps1 and AiCliProvisionCommon.ps1 first.
# =============================================================================

$ClaudeTeamCommonDir = $PSScriptRoot
$ClaudeTeamWinDir = Split-Path $ClaudeTeamCommonDir -Parent
$ClaudeTeamShellsDir = Split-Path $ClaudeTeamWinDir -Parent
$ClaudeTeamScriptsDir = Split-Path $ClaudeTeamShellsDir -Parent
$ClaudeTeamRootDir = Split-Path $ClaudeTeamScriptsDir -Parent
$ClaudeTeamWinEnvsDir = Join-Path $ClaudeTeamScriptsDir "winenvs"
$ClaudeTeamLauncherPath = Join-Path $ClaudeTeamWinEnvsDir "claudeteam.ps1"
$ClaudeTeamInstallCommonScript = Join-Path $ClaudeTeamCommonDir "ClaudeTeamInstallCommon.ps1"
# ClaudeTeamInstallCommon.ps1 is also dot-sourced standalone (dd.ps1's Step21
# ApplicationsList callback), so it owns the catalog/user-settings paths and the
# state dir; loaded early here so the rest of this file reuses
# $ClaudeTeamInstallCatalogPath / $ClaudeTeamInstallUserClaudeDir instead of
# redeclaring its own copies.
. $ClaudeTeamInstallCommonScript
$ClaudeTeamServiceContractScript = Join-Path $ClaudeTeamCommonDir "ServiceContract.ps1"
. $ClaudeTeamServiceContractScript
$ClaudeTeamStateDir = $ClaudeTeamInstallStateDir
$ClaudeTeamDefaultAgentsDir = Join-Path (Join-Path $ClaudeTeamRootDir ".claude") "agents"
$ClaudeTeamSecretReader = Join-Path (Join-Path $ClaudeTeamScriptsDir "encryption_tools") "secret_crypto.js"
$ClaudeTeamUserTeamsDir = Join-Path $ClaudeTeamInstallUserClaudeDir "teams"
$ClaudeTeamUserTasksDir = Join-Path $ClaudeTeamInstallUserClaudeDir "tasks"
# claude writes sessions/<pid>.json (name, pid) once a session is up (undocumented internal state).
$ClaudeTeamUserSessionsDir = Join-Path $ClaudeTeamInstallUserClaudeDir "sessions"
$ClaudeTeamTotalSteps = 9
$ClaudeTeamPidWaitMilliseconds = 60000
$ClaudeTeamReopenWaitMilliseconds = 20000
$ClaudeTeamPollMilliseconds = 250
$ClaudeTeamReadyWaitMilliseconds = 30000
$ClaudeTeamReadyGraceSeconds = 60
# Row states of a live role session (Set-ClaudeTeamLiveRowState, the other-lead check).
$ClaudeTeamLiveStates = @("running", "running-unverified", "stalled", "other-lead")
$ClaudeTeamShellNames = @("pwsh", "powershell")
$ClaudeTeamClaudeProcessNames = @("claude.exe", "node.exe")
$ClaudeTeamShellProcessNames = @("powershell.exe", "pwsh.exe")
$ClaudeTeamNamedProcessFilter = "Name='claude.exe' OR Name='node.exe' OR Name='powershell.exe' OR Name='pwsh.exe'"
$ClaudeTeamNameFlags = @("--name", "-n")
$ClaudeTeamLeadRole = "orchestrator"
$ClaudeTeamLegacyPidModes = @("team", "sessions")
$ClaudeTeamPaneFlag = "--team-pane"
$ClaudeTeamPaneNoKickoffFlag = "--team-no-kickoff"
$ClaudeTeamPaneRolesFlag = "--team-roles"
$ClaudeTeamSessionMarkerVariable = "CLAUDE_AGENTS_SESSION"
$ClaudeTeamAgentTeamsVariable = "CLAUDE_CODE_EXPERIMENTAL_AGENT_TEAMS"
$ClaudeTeamTaskListVariable = "CLAUDE_CODE_TASK_LIST_ID"
$ClaudeTeamLeadTeammateMode = "in-process"
$ClaudeTeamPermissionMode = "auto"
$ClaudeTeamRemoteLauncherCommand = "claudeteam"
$ClaudeTeamSshOptions = @("-t", "-o", "ServerAliveInterval=$(Get-ServiceContractValue 'ssh_client.server_alive_interval_seconds')", "-o", "ServerAliveCountMax=$(Get-ServiceContractValue 'ssh_client.server_alive_count_max')", "-o", "TCPKeepAlive=$(Get-ServiceContractValue 'ssh_client.tcp_keepalive')", "-o", "StrictHostKeyChecking=accept-new", "-o", "ConnectTimeout=15", "-o", "BatchMode=yes")
$ClaudeTeamEntryCommands = @{ sessions = "claudeteamup"; team = "claudeagents" }
$ClaudeTeamWtCommandLimit = 32767
$ClaudeTeamDefaultWindowName = "core-node-team"
$ClaudeTeamBaseDpi = 96
$ClaudeTeamCellWidthPx = 9
$ClaudeTeamCellHeightPx = 19
$ClaudeTeamWindowChromeHeightPx = 40
$ClaudeTeamPaneChromeWidthPx = 34
$ClaudeTeamPaneChromeHeightPx = 18
$ClaudeTeamDefaultMinLead = @{ cols = 100; rows = 30 }
$ClaudeTeamDefaultMinRole = @{ cols = 60; rows = 15 }
$ClaudeTeamFractionFormat = "0.####"
$ClaudeTeamInvariantCulture = [System.Globalization.CultureInfo]::InvariantCulture
$ClaudeTeamDisplayApiSource = @"
using System;
using System.Collections.Generic;
using System.Runtime.InteropServices;
public class ClaudeTeamMonitorInfo {
    public int Index; public string Device; public bool Primary;
    public int Left; public int Top; public int Right; public int Bottom;
    public int WorkLeft; public int WorkTop; public int WorkRight; public int WorkBottom;
    public uint DpiX; public uint DpiY; public bool DpiOk; public bool PerMonitorV2;
}
public static class ClaudeTeamDisplayApi {
    [StructLayout(LayoutKind.Sequential)]
    public struct RECT { public int Left; public int Top; public int Right; public int Bottom; }
    [StructLayout(LayoutKind.Sequential, CharSet = CharSet.Unicode)]
    public struct MONITORINFOEX {
        public int cbSize; public RECT rcMonitor; public RECT rcWork; public uint dwFlags;
        [MarshalAs(UnmanagedType.ByValTStr, SizeConst = 32)] public string szDevice;
    }
    public delegate bool MonitorEnumProc(IntPtr hMonitor, IntPtr hdc, IntPtr lprcMonitor, IntPtr data);
    [DllImport("user32.dll")] static extern bool EnumDisplayMonitors(IntPtr hdc, IntPtr clip, MonitorEnumProc proc, IntPtr data);
    [DllImport("user32.dll", CharSet = CharSet.Unicode)] static extern bool GetMonitorInfoW(IntPtr hMonitor, ref MONITORINFOEX info);
    [DllImport("user32.dll")] static extern IntPtr SetThreadDpiAwarenessContext(IntPtr context);
    [DllImport("shcore.dll")] static extern int GetDpiForMonitor(IntPtr hMonitor, int dpiType, out uint dpiX, out uint dpiY);
    public static ClaudeTeamMonitorInfo[] GetMonitors() {
        List<ClaudeTeamMonitorInfo> list = new List<ClaudeTeamMonitorInfo>();
        IntPtr previous = IntPtr.Zero;
        bool switched = false;
        try { previous = SetThreadDpiAwarenessContext(new IntPtr(-4)); switched = previous != IntPtr.Zero; } catch (EntryPointNotFoundException) { switched = false; }
        try {
            MonitorEnumProc proc = delegate(IntPtr handle, IntPtr hdc, IntPtr clip, IntPtr data) {
                MONITORINFOEX info = new MONITORINFOEX();
                info.cbSize = Marshal.SizeOf(typeof(MONITORINFOEX));
                if (!GetMonitorInfoW(handle, ref info)) { return true; }
                ClaudeTeamMonitorInfo monitor = new ClaudeTeamMonitorInfo();
                monitor.Device = info.szDevice; monitor.Primary = (info.dwFlags & 1) != 0;
                monitor.Left = info.rcMonitor.Left; monitor.Top = info.rcMonitor.Top; monitor.Right = info.rcMonitor.Right; monitor.Bottom = info.rcMonitor.Bottom;
                monitor.WorkLeft = info.rcWork.Left; monitor.WorkTop = info.rcWork.Top; monitor.WorkRight = info.rcWork.Right; monitor.WorkBottom = info.rcWork.Bottom;
                uint dpiX = 0; uint dpiY = 0; int result = -1;
                try { result = GetDpiForMonitor(handle, 0, out dpiX, out dpiY); } catch (DllNotFoundException) { result = -1; } catch (EntryPointNotFoundException) { result = -1; }
                monitor.DpiX = dpiX; monitor.DpiY = dpiY; monitor.PerMonitorV2 = switched;
                monitor.DpiOk = switched && result == 0 && dpiX > 0;
                monitor.Index = list.Count + 1;
                list.Add(monitor);
                return true;
            };
            EnumDisplayMonitors(IntPtr.Zero, IntPtr.Zero, proc, IntPtr.Zero);
            GC.KeepAlive(proc);
        } finally {
            if (switched) { SetThreadDpiAwarenessContext(previous); }
        }
        return list.ToArray();
    }
}
"@

$script:ClaudeTeamMode = "sessions"
$script:ClaudeTeamOptStatus = $false
$script:ClaudeTeamOptNoWindows = $false
$script:ClaudeTeamOptNoKickoff = $false
$script:ClaudeTeamOptRoles = @()
$script:ClaudeTeamOptSkipAccount = $false
$script:ClaudeTeamAccountHold = ""
$script:ClaudeTeamQuiet = $false
$script:ClaudeTeamCatalog = $null
$script:ClaudeTeamAgentsDir = $ClaudeTeamDefaultAgentsDir
$script:ClaudeTeamRows = @()
$script:ClaudeTeamWtPath = $null
$script:ClaudeTeamShellPath = $null
$script:ClaudeTeamMonitors = @()
$script:ClaudeTeamMonitor = $null
$script:ClaudeTeamBudget = $null
$script:ClaudeTeamTabs = @()
$script:ClaudeTeamWtCalls = @()
$script:ClaudeTeamRemoteAny = $false
$script:ClaudeTeamLaunchTime = Get-Date

function Write-ClaudeTeamStep {
    param([int]$Number, [string]$Title)
    Write-Host ""
    Write-Host ("[STEP {0}/{1}] {2}" -f $Number, $ClaudeTeamTotalSteps, $Title) -ForegroundColor Cyan
}

function Write-ClaudeTeamLog {
    param([string]$Level, [string]$Message)
    $color = "Gray"
    if ($script:ClaudeTeamQuiet -and ($Level -notin @("WARN", "ERROR"))) {
        return
    }
    switch ($Level) {
        { $_ -in @("OK", "SKIP") } { $color = "Green" }
        { $_ -in @("INSTALL", "START", "OPEN", "LINK", "PLAN") } { $color = "Yellow" }
        "WARN" { $color = "Magenta" }
        "ERROR" { $color = "Red" }
    }
    Write-Host ("  [{0}] {1}" -f $Level, $Message) -ForegroundColor $color
}

function ConvertTo-ClaudeTeamBashQuoted {
    param([string]$Text)
    return ("'{0}'" -f $Text.Replace("'", "'\''"))
}

# One token of a wt.exe / CreateProcess command line.
function ConvertTo-ClaudeTeamCommandToken {
    param([string]$Text)
    if ($Text -match "\s") {
        return ('"{0}"' -f $Text)
    }
    return $Text
}

# Windows PowerShell 5.1 (and 7.x legacy mode) passes embedded double quotes of a
# native argument unescaped; escape them so ssh.exe receives the text unchanged.
function ConvertTo-ClaudeTeamNativeArgument {
    param([string]$Text)
    $passing = Get-Variable -Name "PSNativeCommandArgumentPassing" -ValueOnly -ErrorAction SilentlyContinue
    if (($null -ne $passing) -and ([string]$passing -ne "Legacy")) {
        return $Text
    }
    return $Text.Replace('"', '\"')
}

function Format-ClaudeTeamFraction {
    param([double]$Value)
    return $Value.ToString($ClaudeTeamFractionFormat, $ClaudeTeamInvariantCulture)
}

function Get-ClaudeTeamProperty {
    param($Object, [string]$Name, $Default)
    $property = $null
    if ($null -eq $Object) {
        return $Default
    }
    $property = $Object.PSObject.Properties[$Name]
    if ($null -eq $property) {
        return $Default
    }
    return $property.Value
}

function Get-ClaudeTeamRow {
    param([string]$Role)
    return (@($script:ClaudeTeamRows | Where-Object { $_.Role -eq $Role }) | Select-Object -First 1)
}

# First-level scalar keys of the YAML frontmatter block (name, model, effort, ...).
function Read-ClaudeTeamFrontmatter {
    param([string]$Path)
    $values = @{}
    $lines = @(Get-Content -LiteralPath $Path -Encoding UTF8 -ErrorAction SilentlyContinue)
    $index = 0
    $line = ""
    $separator = -1
    $key = ""
    $value = ""
    if (($lines.Count -eq 0) -or ([string]$lines[0]).Trim() -ne "---") {
        return $values
    }
    for ($index = 1; $index -lt $lines.Count; $index++) {
        $line = [string]$lines[$index]
        if ($line.Trim() -eq "---") {
            break
        }
        if (($line.Length -eq 0) -or [char]::IsWhiteSpace($line[0]) -or $line.StartsWith("#")) {
            continue
        }
        $separator = $line.IndexOf(":")
        if ($separator -le 0) {
            continue
        }
        $key = $line.Substring(0, $separator).Trim()
        $value = $line.Substring($separator + 1).Trim()
        if (($value.Length -ge 2) -and (($value.StartsWith('"') -and $value.EndsWith('"')) -or ($value.StartsWith("'") -and $value.EndsWith("'")))) {
            $value = $value.Substring(1, $value.Length - 2)
        }
        if (-not $values.ContainsKey($key)) {
            $values[$key] = $value
        }
    }
    return $values
}

function Get-ClaudeTeamAgentDefinitions {
    param([string]$AgentsDir)
    $definitions = @()
    $file = $null
    $frontmatter = $null
    $name = ""
    foreach ($file in @(Get-ChildItem -LiteralPath $AgentsDir -Filter "*.md" -File -ErrorAction SilentlyContinue | Sort-Object Name)) {
        $frontmatter = Read-ClaudeTeamFrontmatter -Path $file.FullName
        $name = ""
        if ($frontmatter.ContainsKey("name")) {
            $name = [string]$frontmatter["name"]
        }
        if ([string]::IsNullOrWhiteSpace($name)) {
            Write-ClaudeTeamLog "WARN" ("Agent file without a frontmatter name ignored: {0}" -f $file.FullName)
            continue
        }
        if (@($definitions | Where-Object { $_.Name -eq $name }).Count -gt 0) {
            Write-ClaudeTeamLog "WARN" ("Duplicate agent name {0} ignored: {1}" -f $name, $file.FullName)
            continue
        }
        $definitions += [pscustomobject]@{
            Name   = $name
            Model  = $(if ($frontmatter.ContainsKey("model")) { [string]$frontmatter["model"] } else { "" })
            Effort = $(if ($frontmatter.ContainsKey("effort")) { [string]$frontmatter["effort"] } else { "" })
            Path   = $file.FullName
        }
    }
    return $definitions
}

function Get-ClaudeTeamCatalogRole {
    param([string]$Role)
    return (@(Get-ClaudeTeamProperty -Object $script:ClaudeTeamCatalog -Name "roles" -Default @()) | Where-Object { $_.name -eq $Role } | Select-Object -First 1)
}

function Get-ClaudeTeamRemoteConfig {
    param([string]$Role)
    $entry = Get-ClaudeTeamCatalogRole -Role $Role
    $remote = Get-ClaudeTeamProperty -Object $entry -Name "remote" -Default $null
    if ($remote) {
        return $remote
    }
    return $null
}

# A role's catalog "window" flag (default true, schema_version 7 role_source
# .catalog_roles_are): false marks a service role that is a valid row for
# messaging/tasks but gets no packed pane/tab and no session at launcher start.
function Get-ClaudeTeamRoleWindowFlag {
    param([string]$Role)
    return [bool](Get-ClaudeTeamProperty -Object (Get-ClaudeTeamCatalogRole -Role $Role) -Name "window" -Default $true)
}

function Get-ClaudeTeamSessionPrefix {
    return [string](Get-ClaudeTeamProperty -Object (Get-ClaudeTeamProperty -Object $script:ClaudeTeamCatalog -Name "sessions" -Default $null) -Name "session_prefix" -Default "ct-")
}

function Get-ClaudeTeamLeadSessionName {
    param([string]$Mode)
    if ($Mode -eq "team") {
        return [string](Get-ClaudeTeamProperty -Object (Get-ClaudeTeamProperty -Object $script:ClaudeTeamCatalog -Name "team" -Default $null) -Name "session_name" -Default "ca-orchestrator")
    }
    return ("{0}{1}" -f (Get-ClaudeTeamSessionPrefix), $ClaudeTeamLeadRole)
}

function Get-ClaudeTeamSessionName {
    param([string]$Role)
    if ($Role -eq $ClaudeTeamLeadRole) {
        return (Get-ClaudeTeamLeadSessionName -Mode $script:ClaudeTeamMode)
    }
    return ("{0}{1}" -f (Get-ClaudeTeamSessionPrefix), $Role)
}

function Get-ClaudeTeamLayout {
    return (Get-ClaudeTeamProperty -Object $script:ClaudeTeamCatalog -Name "layout" -Default $null)
}

function Get-ClaudeTeamWindowName {
    return [string](Get-ClaudeTeamProperty -Object (Get-ClaudeTeamLayout) -Name "window_name" -Default $ClaudeTeamDefaultWindowName)
}

function Get-ClaudeTeamPidPath {
    param([string]$Session)
    return (Join-Path $ClaudeTeamStateDir ("{0}.pid" -f $Session))
}

# Removes <session>.pid when it still names this process: called after `claude`
# exits in a role pane, so the idle -NoExit shell left behind is not mistaken for
# a running role (DESIGN §3.2). A file already replaced by a newer PID (a rerun
# reopened the role while this shell was still exiting) is left alone.
function Remove-ClaudeTeamPidFile {
    param([string]$Session)
    $path = Get-ClaudeTeamPidPath -Session $Session
    $pidText = $null
    $pidValue = 0
    if (-not (Test-Path -LiteralPath $path -PathType Leaf)) {
        return
    }
    $pidText = (Get-Content -LiteralPath $path -Raw -ErrorAction SilentlyContinue)
    if ([string]::IsNullOrWhiteSpace($pidText) -or (-not [int]::TryParse($pidText.Trim(), [ref]$pidValue)) -or ($pidValue -ne $PID)) {
        return
    }
    Remove-Item -LiteralPath $path -Force -ErrorAction SilentlyContinue
}

# The session PID file first, then the pre-D13 <mode>-<role>.pid files of the
# same session, so roles started by the previous launcher are still skipped.
function Get-ClaudeTeamPidCandidates {
    param([string]$Role, [string]$Session)
    $candidates = @(Get-ClaudeTeamPidPath -Session $Session)
    $legacyMode = $null
    foreach ($legacyMode in $ClaudeTeamLegacyPidModes) {
        if (($Role -eq $ClaudeTeamLeadRole) -and ($Session -ne (Get-ClaudeTeamLeadSessionName -Mode $legacyMode))) {
            continue
        }
        $candidates += (Join-Path $ClaudeTeamStateDir ("{0}-{1}.pid" -f $legacyMode, $Role))
    }
    return $candidates
}

# A role shell writes its own PID right after it starts, so a process that
# started after the PID file was written reuses a stale PID and is not the role.
function Test-ClaudeTeamPidFile {
    param([string]$Path)
    $pidText = $null
    $pidValue = 0
    $pidWrittenAt = $null
    $processStartedAt = $null
    $process = $null
    if (-not (Test-Path -LiteralPath $Path -PathType Leaf)) {
        return $null
    }
    $pidWrittenAt = (Get-Item -LiteralPath $Path).LastWriteTime
    $pidText = (Get-Content -LiteralPath $Path -Raw -ErrorAction SilentlyContinue)
    if ([string]::IsNullOrWhiteSpace($pidText) -or (-not [int]::TryParse($pidText.Trim(), [ref]$pidValue))) {
        return $null
    }
    $process = Get-Process -Id $pidValue -ErrorAction SilentlyContinue
    if (-not $process -or ($ClaudeTeamShellNames -notcontains $process.ProcessName)) {
        return $null
    }
    try {
        $processStartedAt = $process.StartTime
    } catch {
        return $null
    }
    if ($processStartedAt -le $pidWrittenAt.AddSeconds(1)) {
        return $process
    }
    return $null
}

function Get-ClaudeTeamLiveProcess {
    param([string]$Role, [string]$Session)
    $path = $null
    $process = $null
    foreach ($path in @(Get-ClaudeTeamPidCandidates -Role $Role -Session $Session)) {
        $process = Test-ClaudeTeamPidFile -Path $path
        if ($process) {
            return $process
        }
    }
    return $null
}

# A role is alive when a PID file names its live shell, or a claude.exe/node.exe
# process runs with its --name (Get-ClaudeTeamNamedClaudeProcess); $null
# otherwise. A lone powershell.exe/pwsh.exe --name match is the pane's idle
# -NoExit shell after claude already exited (DESIGN §3.2), not a live role.
function Get-ClaudeTeamLivePid {
    param([string]$Role, [string]$Session, [hashtable]$NamedProcesses)
    $process = Get-ClaudeTeamLiveProcess -Role $Role -Session $Session
    $namedProcess = $null
    if ($process) {
        return $process.Id
    }
    $namedProcess = Get-ClaudeTeamNamedClaudeProcess -NamedProcesses $NamedProcesses -Session $Session
    if ($null -ne $namedProcess) {
        return $namedProcess.ProcessId
    }
    return $null
}

# Ordered role groups from layout.tab_groups; known roles missing from every
# listed group are appended to the last group (layout.unlisted_roles). A role
# whose catalog row sets window:false (schema_version 7: a service role, valid
# for messaging/tasks but with no window/session at start) is excluded from
# every group and from the unlisted-roles fallback -- even one a config mistake
# lists explicitly -- so it never gets a packed pane/tab. Import-ClaudeTeamCatalog
# adds it as its own non-packing row instead.
function Get-ClaudeTeamLayoutGroups {
    param([string[]]$KnownRoles)
    $groups = New-Object System.Collections.Generic.List[object]
    $placed = @{}
    $group = $null
    $members = $null
    $name = $null
    $unlisted = @()
    $packableRoles = @($KnownRoles | Where-Object { Get-ClaudeTeamRoleWindowFlag -Role $_ })
    foreach ($group in @(Get-ClaudeTeamProperty -Object (Get-ClaudeTeamLayout) -Name "tab_groups" -Default @())) {
        $members = New-Object System.Collections.Generic.List[string]
        foreach ($name in @($group)) {
            if (($packableRoles -contains [string]$name) -and (-not $placed.ContainsKey([string]$name))) {
                $members.Add([string]$name)
                $placed[[string]$name] = $true
            }
        }
        if ($members.Count -gt 0) {
            $groups.Add($members)
        }
    }
    $unlisted = @($packableRoles | Where-Object { -not $placed.ContainsKey($_) })
    if ($unlisted.Count -gt 0) {
        if ($groups.Count -eq 0) {
            $groups.Add((New-Object System.Collections.Generic.List[string]))
        }
        foreach ($name in $unlisted) {
            $groups[$groups.Count - 1].Add($name)
        }
    }
    return ,$groups
}

# Disabled / not-selected / no-agent-file state for a role, shared by packable
# and window:false rows; logs the reason and returns the state name, or $null
# when none applies (the role is ready to run). The lead role is exempt from
# -Roles filtering in "team" mode, since its pane always starts the window.
function Get-ClaudeTeamRoleBlockedState {
    param([string]$Role, $CatalogRole, $Agent)
    $leadExempt = (($script:ClaudeTeamMode -eq "team") -and ($Role -eq $ClaudeTeamLeadRole))
    if ((Get-ClaudeTeamProperty -Object $CatalogRole -Name "enabled" -Default $true) -eq $false) {
        Write-ClaudeTeamLog "SKIP" ("Role {0} disabled in the catalog" -f $Role)
        return "disabled"
    }
    if (($script:ClaudeTeamOptRoles.Count -gt 0) -and ($script:ClaudeTeamOptRoles -notcontains $Role) -and (-not $leadExempt)) {
        Write-ClaudeTeamLog "SKIP" ("Role {0} not in -Roles" -f $Role)
        return "not-selected"
    }
    if ($null -eq $Agent) {
        Write-ClaudeTeamLog "WARN" ("Role {0} has a catalog row but no agent definition in {1}" -f $Role, $script:ClaudeTeamAgentsDir)
        return "no-agent-file"
    }
    return $null
}

function Get-ClaudeTeamPolicyArguments {
    $catalog = Get-Content -LiteralPath $ClaudeTeamInstallCatalogPath -Raw -Encoding UTF8 | ConvertFrom-Json
    $policy = Get-ClaudeTeamProperty -Object $catalog -Name "session_policy" -Default $null
    $disallowed = [string](Get-ClaudeTeamProperty -Object $policy -Name "disallowed_tools" -Default "")
    $prompt = [string](Get-ClaudeTeamProperty -Object $policy -Name "append_system_prompt" -Default "")
    $policyArgs = @()
    if ($disallowed) {
        $policyArgs += @("--disallowedTools", $disallowed)
    }
    if ($prompt) {
        $policyArgs += @("--append-system-prompt", $prompt)
    }
    Write-Host ("[DEBUG] session policy: disallowedTools={0} append-system-prompt={1} chars (catalog {2})" -f $(if ($disallowed) { $disallowed } else { "<none>" }), $prompt.Length, $ClaudeTeamInstallCatalogPath) -ForegroundColor DarkGray
    return $policyArgs
}

function Import-ClaudeTeamCatalog {
    $agents = @()
    $agentByName = @{}
    $agent = $null
    $knownRoles = @()
    $noWindowRoles = @()
    $groups = $null
    $groupIndex = 0
    $role = $null
    $catalogRole = $null
    $state = $null
    $session = $null
    $remote = $null
    $docRelative = $null
    $docPath = $null
    $unknownRole = $null

    $script:ClaudeTeamCatalog = Get-Content -LiteralPath $ClaudeTeamInstallCatalogPath -Raw -Encoding UTF8 | ConvertFrom-Json
    $script:ClaudeTeamAgentsDir = [System.IO.Path]::GetFullPath((Join-Path $ClaudeTeamRootDir ([string](Get-ClaudeTeamProperty -Object $script:ClaudeTeamCatalog -Name "agents_dir" -Default ".claude/agents"))))
    $script:ClaudeTeamRemoteAny = $false
    Write-ClaudeTeamLog "OK" ("Catalog (launcher data and role overrides): {0}" -f $ClaudeTeamInstallCatalogPath)
    foreach ($docRelative in @(Get-ClaudeTeamProperty -Object $script:ClaudeTeamCatalog -Name "guide_doc" -Default @())) {
        $docPath = Join-Path $ClaudeTeamRootDir $docRelative
        if (Test-Path -LiteralPath $docPath) {
            Write-ClaudeTeamLog "OK" ("Orchestration doc: {0}" -f $docPath)
        } else {
            Write-ClaudeTeamLog "WARN" ("Orchestration doc missing: {0}" -f $docPath)
        }
    }

    $agents = @(Get-ClaudeTeamAgentDefinitions -AgentsDir $script:ClaudeTeamAgentsDir)
    foreach ($agent in $agents) {
        $agentByName[$agent.Name] = $agent
    }
    Write-ClaudeTeamLog "OK" ("Role registry: {0} ({1} agent definitions)" -f $script:ClaudeTeamAgentsDir, $agents.Count)
    $knownRoles = @($agents | ForEach-Object { $_.Name })
    $knownRoles += @(@(Get-ClaudeTeamProperty -Object $script:ClaudeTeamCatalog -Name "roles" -Default @()) | ForEach-Object { [string]$_.name } | Where-Object { $knownRoles -notcontains $_ })
    foreach ($unknownRole in @($script:ClaudeTeamOptRoles | Where-Object { $knownRoles -notcontains $_ })) {
        Write-ClaudeTeamLog "WARN" ("-Roles names an unknown role: {0}" -f $unknownRole)
    }

    # Get-ClaudeTeamLayoutGroups already excludes window:false roles from every
    # group and from the unlisted-roles fallback, so $groups only ever holds
    # packable roles; window:false roles are added below as their own
    # non-packing rows (schema_version 7 role_source.catalog_roles_are).
    $groups = Get-ClaudeTeamLayoutGroups -KnownRoles $knownRoles
    $noWindowRoles = @($knownRoles | Where-Object { -not (Get-ClaudeTeamRoleWindowFlag -Role $_) })
    $script:ClaudeTeamRows = @()
    for ($groupIndex = 0; $groupIndex -lt $groups.Count; $groupIndex++) {
        foreach ($role in $groups[$groupIndex]) {
            $catalogRole = Get-ClaudeTeamCatalogRole -Role $role
            $remote = Get-ClaudeTeamRemoteConfig -Role $role
            $session = Get-ClaudeTeamSessionName -Role $role
            $agent = $null
            if ($agentByName.ContainsKey($role)) {
                $agent = $agentByName[$role]
            }
            $state = Get-ClaudeTeamRoleBlockedState -Role $role -CatalogRole $catalogRole -Agent $agent
            if ($null -eq $state) {
                if (($script:ClaudeTeamMode -eq "team") -and ($role -ne $ClaudeTeamLeadRole)) {
                    $state = "available-teammate"
                    Write-ClaudeTeamLog "OK" ("Agent type {0} available on demand (model {1})" -f $role, $agent.Model)
                } elseif ($null -ne $remote) {
                    $state = "enabled"
                    $script:ClaudeTeamRemoteAny = $true
                    Write-ClaudeTeamLog "OK" ("Remote role {0}: ssh <secret {1}> -> tmux {2} in {3} (model {4}, effort {5}, Remote Control on)" -f $role, [string]$remote.ssh_secret, $session, [string]$remote.root, $agent.Model, $agent.Effort)
                } elseif ((-not [string]::IsNullOrEmpty($script:ClaudeTeamAccountHold)) -and ($role -ne $ClaudeTeamLeadRole)) {
                    $state = "held:{0}" -f $script:ClaudeTeamAccountHold
                    Write-ClaudeTeamLog "SKIP" ("Role {0} held until the Claude account is ready ({1})" -f $role, $script:ClaudeTeamAccountHold)
                } else {
                    $state = "enabled"
                    Write-ClaudeTeamLog "OK" ("Session role {0}: {1} (model {2}, effort {3}, group {4})" -f $role, $session, $agent.Model, $agent.Effort, ($groupIndex + 1))
                }
            }
            $script:ClaudeTeamRows += [pscustomobject]@{
                Role      = $role
                Session   = $session
                Model     = $(if ($agent) { $agent.Model } else { "" })
                Effort    = $(if ($agent) { $agent.Effort } else { "" })
                AgentPath = $(if ($agent) { $agent.Path } else { "" })
                Group     = $groupIndex
                Window    = $true
                IsLead    = ($role -eq $ClaudeTeamLeadRole)
                Remote    = ($null -ne $remote)
                Enabled   = ($state -eq "enabled")
                State     = $state
                Tab       = "-"
                Pane      = "-"
                Pid       = "-"
                Cells     = "-"
            }
        }
    }
    foreach ($role in $noWindowRoles) {
        $catalogRole = Get-ClaudeTeamCatalogRole -Role $role
        $remote = Get-ClaudeTeamRemoteConfig -Role $role
        $session = Get-ClaudeTeamSessionName -Role $role
        $agent = $null
        if ($agentByName.ContainsKey($role)) {
            $agent = $agentByName[$role]
        }
        $state = Get-ClaudeTeamRoleBlockedState -Role $role -CatalogRole $catalogRole -Agent $agent
        if ($null -eq $state) {
            if (($script:ClaudeTeamMode -eq "team") -and ($role -ne $ClaudeTeamLeadRole)) {
                $state = "available-teammate"
                Write-ClaudeTeamLog "OK" ("Agent type {0} available on demand (model {1})" -f $role, $agent.Model)
            } else {
                $state = "no-window"
                Write-ClaudeTeamLog "OK" ("Service role {0}: {1} (model {2}, effort {3}, no window; messaging/tasks only)" -f $role, $session, $agent.Model, $agent.Effort)
            }
        }
        $script:ClaudeTeamRows += [pscustomobject]@{
            Role      = $role
            Session   = $session
            Model     = $(if ($agent) { $agent.Model } else { "" })
            Effort    = $(if ($agent) { $agent.Effort } else { "" })
            AgentPath = $(if ($agent) { $agent.Path } else { "" })
            Group     = -1
            Window    = $false
            IsLead    = ($role -eq $ClaudeTeamLeadRole)
            Remote    = ($null -ne $remote)
            Enabled   = ($state -eq "no-window")
            State     = $state
            Tab       = "-"
            Pane      = "-"
            Pid       = "-"
            Cells     = "-"
        }
    }
}

function Get-ClaudeTeamOtherRoles {
    return ((@($script:ClaudeTeamRows | Where-Object { (-not $_.IsLead) -and (($_.Enabled) -or ($_.State -eq "available-teammate") -or ($_.State -like "held:*")) }) | ForEach-Object { $_.Role }) -join ", ")
}

# session_env blocks merged in order (later blocks win): all, windows, lead, remote.
function Get-ClaudeTeamSessionEnvironment {
    param([string[]]$Kinds)
    $environment = [ordered]@{}
    if ($null -eq $script:ClaudeTeamCatalog) {
        $script:ClaudeTeamCatalog = Get-Content -LiteralPath $ClaudeTeamInstallCatalogPath -Raw -Encoding UTF8 | ConvertFrom-Json
    }
    $sessionEnv = Get-ClaudeTeamProperty -Object $script:ClaudeTeamCatalog -Name "session_env" -Default $null
    $kind = $null
    $block = $null
    $property = $null
    foreach ($kind in $Kinds) {
        $block = Get-ClaudeTeamProperty -Object $sessionEnv -Name $kind -Default $null
        if ($null -eq $block) {
            continue
        }
        foreach ($property in $block.PSObject.Properties) {
            $environment[$property.Name] = [string]$property.Value
        }
    }
    return $environment
}

function Get-ClaudeTeamRoleEnvironmentKinds {
    param($Row)
    if ($Row.Remote) {
        return @("remote")
    }
    if ($Row.IsLead) {
        return @("all", "windows", "lead")
    }
    return @("all", "windows")
}

function Get-ClaudeTeamKickoff {
    param([string]$Role)
    $row = Get-ClaudeTeamRow -Role $Role
    $sessions = Get-ClaudeTeamProperty -Object $script:ClaudeTeamCatalog -Name "sessions" -Default $null
    $text = [string](Get-ClaudeTeamProperty -Object $sessions -Name "kickoff" -Default "")
    $taskList = (Get-ClaudeTeamSessionEnvironment -Kinds @("all"))[$ClaudeTeamTaskListVariable]
    if ($row -and $row.Remote) {
        $text = [string](Get-ClaudeTeamProperty -Object (Get-ClaudeTeamProperty -Object $script:ClaudeTeamCatalog -Name "remote" -Default $null) -Name "kickoff" -Default $text)
    } elseif ($Role -eq $ClaudeTeamLeadRole) {
        if ($script:ClaudeTeamMode -eq "team") {
            $text = [string](Get-ClaudeTeamProperty -Object (Get-ClaudeTeamProperty -Object $script:ClaudeTeamCatalog -Name "team" -Default $null) -Name "kickoff" -Default $text)
        } else {
            $text = [string](Get-ClaudeTeamProperty -Object $sessions -Name "kickoff_lead" -Default $text)
        }
    }
    $text = $text.Replace("{role}", $Role)
    $text = $text.Replace("{session}", (Get-ClaudeTeamSessionName -Role $Role))
    $text = $text.Replace("{guide}", [string](Get-ClaudeTeamProperty -Object $script:ClaudeTeamCatalog -Name "guide_doc" -Default ""))
    $text = $text.Replace("{record}", [string](Get-ClaudeTeamProperty -Object $script:ClaudeTeamCatalog -Name "record_dir" -Default ""))
    $text = $text.Replace("{prefix}", (Get-ClaudeTeamSessionPrefix))
    $text = $text.Replace("{shared}", [string](Get-ClaudeTeamProperty -Object $script:ClaudeTeamCatalog -Name "shared_dir" -Default ""))
    $text = $text.Replace("{agents_dir}", [string](Get-ClaudeTeamProperty -Object $script:ClaudeTeamCatalog -Name "agents_dir" -Default ""))
    $text = $text.Replace("{roles}", (Get-ClaudeTeamOtherRoles))
    $text = $text.Replace("{lead}", (Get-ClaudeTeamSessionName -Role $ClaudeTeamLeadRole))
    $text = $text.Replace("{task_list}", [string]$taskList)
    return $text
}

# claude arguments of a local role session (the kickoff is appended last by the caller).
function Get-ClaudeTeamRoleClaudeArguments {
    param($Row)
    $arguments = @("--agent", $Row.Role, "--name", $Row.Session)
    if ($Row.IsLead -and $script:ClaudeTeamRemoteAny) {
        $arguments += @("--remote-control", $Row.Session)
    }
    if (-not [string]::IsNullOrWhiteSpace($Row.Effort)) {
        $arguments += @("--effort", $Row.Effort)
    }
    $arguments += @("--permission-mode", $ClaudeTeamPermissionMode)
    if ($Row.IsLead) {
        $arguments += @("--teammate-mode", $ClaudeTeamLeadTeammateMode)
    }
    return $arguments
}

# Remote role: bash command line the server runs. It locates core_node through the
# linked claudeteam command (catalog root as the fallback), runs the shared
# idempotent claude_team_install, then attaches or creates (-A) the role's tmux
# session running claudeteam with Remote Control on, --effort and session_env.remote.
# Built with single quotes only, so Windows PowerShell passes it to ssh.exe intact.
function Get-ClaudeTeamRemoteArgument {
    param($Row, $Remote, [switch]$KickoffPlaceholder)
    $root = [string]$Remote.root
    $socket = [string](Get-ClaudeTeamProperty -Object (Get-ClaudeTeamProperty -Object $script:ClaudeTeamCatalog -Name "sessions" -Default $null) -Name "tmux_socket" -Default "claudeteam")
    $environment = Get-ClaudeTeamSessionEnvironment -Kinds @("remote")
    $envFlags = @("-e", (ConvertTo-ClaudeTeamBashQuoted -Text ("{0}=1" -f $ClaudeTeamSessionMarkerVariable)))
    $key = $null
    $innerParts = @()
    $inner = ""
    $locate = ""
    $remoteCommand = ""
    foreach ($key in $environment.Keys) {
        $envFlags += @("-e", (ConvertTo-ClaudeTeamBashQuoted -Text ("{0}={1}" -f $key, $environment[$key])))
    }
    $innerParts = @(
        $ClaudeTeamRemoteLauncherCommand,
        "--agent", (ConvertTo-ClaudeTeamBashQuoted -Text $Row.Role),
        "--name", (ConvertTo-ClaudeTeamBashQuoted -Text $Row.Session),
        "--remote-control", (ConvertTo-ClaudeTeamBashQuoted -Text $Row.Session)
    )
    if (-not [string]::IsNullOrWhiteSpace($Row.Effort)) {
        $innerParts += @("--effort", (ConvertTo-ClaudeTeamBashQuoted -Text $Row.Effort))
    }
    if (-not $script:ClaudeTeamOptNoKickoff) {
        if ($KickoffPlaceholder) {
            $innerParts += (ConvertTo-ClaudeTeamBashQuoted -Text "<kickoff>")
        } else {
            $innerParts += (ConvertTo-ClaudeTeamBashQuoted -Text (Get-ClaudeTeamKickoff -Role $Row.Role))
        }
    }
    $inner = "{0}; exec bash -l" -f ($innerParts -join " ")
    $locate = 'R=$(readlink -f $(command -v claudeteam 2>/dev/null) 2>/dev/null); ROOT={0}; case $R in /*) ROOT=$(cd $(dirname $R)/../.. && pwd) ;; esac;' -f (ConvertTo-ClaudeTeamBashQuoted -Text $root)
    $remoteCommand = '{0} . $ROOT/scripts/ai_shtools/claude_code_install.sh && claude_team_install; tmux -L {1} new-session -A -s {2} -c $ROOT {3} bash -lc {4}' -f `
        $locate, (ConvertTo-ClaudeTeamBashQuoted -Text $socket), (ConvertTo-ClaudeTeamBashQuoted -Text $Row.Session), ($envFlags -join " "), (ConvertTo-ClaudeTeamBashQuoted -Text $inner)
    return ("bash -lc {0}" -f (ConvertTo-ClaudeTeamBashQuoted -Text $remoteCommand))
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
    Write-ClaudeTeamLog "OK" ("Mode: {0} (lead {1}); project root: {2}" -f $script:ClaudeTeamMode, (Get-ClaudeTeamLeadSessionName -Mode $script:ClaudeTeamMode), $ClaudeTeamRootDir)
    Write-ClaudeTeamLog "OK" ("State dir: {0}" -f $ClaudeTeamStateDir)
    Write-ClaudeTeamLog "OK" ("Claude config: {0} (same settings and credentials as this shell)" -f $ClaudeTeamInstallUserClaudeDir)
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
    $wtVersion = $null

    Invoke-ClaudeTeamInstall -CheckOnly:$script:ClaudeTeamOptStatus

    foreach ($shellName in $ClaudeTeamShellNames) {
        $shellCommand = Get-Command ("{0}.exe" -f $shellName) -ErrorAction SilentlyContinue
        if ($shellCommand) {
            $script:ClaudeTeamShellPath = $shellCommand.Source
            break
        }
    }
    $script:ClaudeTeamWtPath = Resolve-ClaudeTeamWindowsTerminal
    if ($script:ClaudeTeamWtPath) {
        $wtVersion = Get-ClaudeTeamWindowsTerminalVersion
    }
    Write-ClaudeTeamLog "OK" ("Role shell: {0}; Windows Terminal: {1}" -f $script:ClaudeTeamShellPath, $(if ($script:ClaudeTeamWtPath) { ("{0} ({1})" -f $script:ClaudeTeamWtPath, $(if ($wtVersion) { $wtVersion } else { "version unknown" })) } else { "none (console fallback)" }))
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
        Write-ClaudeTeamLog "WARN" "claude missing; run the launcher without -Status to install"
    }
    if ($script:ClaudeTeamAccountState -eq "missing") {
        Test-ClaudeTeamAccount
    }
    $script:ClaudeTeamAccountHold = ""
    if ($script:ClaudeTeamAccountState -in @("login", "onboarding", "trust")) {
        if ($script:ClaudeTeamOptSkipAccount) {
            Write-ClaudeTeamLog "WARN" ("-SkipAccountCheck: roles start although the Claude account is not ready ({0})" -f $script:ClaudeTeamAccountState)
        } else {
            $script:ClaudeTeamAccountHold = $script:ClaudeTeamAccountState
            Write-ClaudeTeamLog "WARN" ("Claude account not ready ({0}): only the lead starts; finish the setup screens in its pane, then re-run {1}" -f $script:ClaudeTeamAccountHold, $ClaudeTeamEntryCommands[$script:ClaudeTeamMode])
        }
    }
    Write-ClaudeTeamLog "OK" ("Role launcher: {0} {1} <mode> (session_env, --effort, --permission-mode auto, kickoff from the catalog, git guard on)" -f $ClaudeTeamLauncherPath, $ClaudeTeamPaneFlag)
}

function Initialize-ClaudeTeamDisplayApi {
    if ("ClaudeTeamDisplayApi" -as [type]) {
        return
    }
    Add-Type -TypeDefinition $ClaudeTeamDisplayApiSource
}

# Cell budget of a monitor: the font cell (12pt Cascadia Mono, 9x19 px at 96 DPI)
# and the WT chrome scale with dpi/96; the pane minima come from catalog layout.
function Get-ClaudeTeamBudget {
    param($Monitor)
    $layout = Get-ClaudeTeamLayout
    $minLead = Get-ClaudeTeamProperty -Object $layout -Name "min_lead" -Default $null
    $minRole = Get-ClaudeTeamProperty -Object $layout -Name "min_role" -Default $null
    $dpi = [double]$ClaudeTeamBaseDpi
    $scale = 1.0
    $cellWidth = 0.0
    $cellHeight = 0.0
    $usableWidth = 0.0
    $usableHeight = 0.0
    $paneChromeWidth = 0.0
    $paneChromeHeight = 0.0
    $minLeadCols = [int](Get-ClaudeTeamProperty -Object $minLead -Name "cols" -Default $ClaudeTeamDefaultMinLead["cols"])
    $minLeadRows = [int](Get-ClaudeTeamProperty -Object $minLead -Name "rows" -Default $ClaudeTeamDefaultMinLead["rows"])
    $minRoleCols = [int](Get-ClaudeTeamProperty -Object $minRole -Name "cols" -Default $ClaudeTeamDefaultMinRole["cols"])
    $minRoleRows = [int](Get-ClaudeTeamProperty -Object $minRole -Name "rows" -Default $ClaudeTeamDefaultMinRole["rows"])
    $minRoleWidthPx = 0.0
    $minRoleHeightPx = 0.0
    $minLeadWidthPx = 0.0
    $minLeadHeightPx = 0.0
    if ($Monitor.DpiOk) {
        $dpi = [double]$Monitor.DpiX
    }
    $scale = $dpi / $ClaudeTeamBaseDpi
    $cellWidth = $ClaudeTeamCellWidthPx * $scale
    $cellHeight = $ClaudeTeamCellHeightPx * $scale
    $paneChromeWidth = $ClaudeTeamPaneChromeWidthPx * $scale
    $paneChromeHeight = $ClaudeTeamPaneChromeHeightPx * $scale
    $usableWidth = [double]($Monitor.WorkRight - $Monitor.WorkLeft)
    $usableHeight = [double]($Monitor.WorkBottom - $Monitor.WorkTop) - ($ClaudeTeamWindowChromeHeightPx * $scale)
    $minRoleWidthPx = ($minRoleCols * $cellWidth) + $paneChromeWidth
    $minRoleHeightPx = ($minRoleRows * $cellHeight) + $paneChromeHeight
    $minLeadWidthPx = ($minLeadCols * $cellWidth) + $paneChromeWidth
    $minLeadHeightPx = ($minLeadRows * $cellHeight) + $paneChromeHeight
    return [pscustomobject]@{
        DpiOk           = [bool]$Monitor.DpiOk
        Dpi             = $dpi
        Scale           = $scale
        CellWidth       = $cellWidth
        CellHeight      = $cellHeight
        PaneChromeWidth = $paneChromeWidth
        PaneChromeHeight = $paneChromeHeight
        UsableWidth     = $usableWidth
        UsableHeight    = $usableHeight
        TotalCols       = [int][Math]::Floor(($usableWidth - $paneChromeWidth) / $cellWidth)
        TotalRows       = [int][Math]::Floor(($usableHeight - $paneChromeHeight) / $cellHeight)
        MinLeadCols     = $minLeadCols
        MinLeadRows     = $minLeadRows
        MinRoleCols     = $minRoleCols
        MinRoleRows     = $minRoleRows
        MinRoleWidthPx  = $minRoleWidthPx
        MinRoleHeightPx = $minRoleHeightPx
        MinLeadWidthPx  = $minLeadWidthPx
        MinLeadHeightPx = $minLeadHeightPx
        MaxCols         = [int][Math]::Max(0, [Math]::Floor($usableWidth / $minRoleWidthPx))
        MaxRows         = [int][Math]::Max(0, [Math]::Floor($usableHeight / $minRoleHeightPx))
    }
}

function Get-ClaudeTeamDisplay {
    $monitors = @()
    $monitor = $null
    $workingArea = $null
    $bounds = $null
    $budget = $null
    $tags = @()
    try {
        Initialize-ClaudeTeamDisplayApi
        $monitors = @([ClaudeTeamDisplayApi]::GetMonitors())
    } catch {
        $monitors = @()
        Write-ClaudeTeamLog "WARN" ("Per-Monitor-V2 query failed: {0}" -f $_.Exception.Message)
    }
    if ($monitors.Count -eq 0) {
        Add-Type -AssemblyName System.Windows.Forms
        $workingArea = [System.Windows.Forms.Screen]::PrimaryScreen.WorkingArea
        $bounds = [System.Windows.Forms.Screen]::PrimaryScreen.Bounds
        $monitors = @([pscustomobject]@{
            Index = 1; Device = "primary"; Primary = $true
            Left = $bounds.Left; Top = $bounds.Top; Right = $bounds.Right; Bottom = $bounds.Bottom
            WorkLeft = $workingArea.Left; WorkTop = $workingArea.Top; WorkRight = $workingArea.Right; WorkBottom = $workingArea.Bottom
            DpiX = [uint32]$ClaudeTeamBaseDpi; DpiY = [uint32]$ClaudeTeamBaseDpi; DpiOk = $false; PerMonitorV2 = $false
        })
    }
    $script:ClaudeTeamMonitors = $monitors
    $script:ClaudeTeamMonitor = (@($monitors | Where-Object { $_.Primary }) + @($monitors)) | Select-Object -First 1
    $script:ClaudeTeamBudget = Get-ClaudeTeamBudget -Monitor $script:ClaudeTeamMonitor
    foreach ($monitor in $monitors) {
        $budget = Get-ClaudeTeamBudget -Monitor $monitor
        $tags = @()
        if ($monitor.Primary) {
            $tags += "primary"
        }
        if ($monitor.Index -eq $script:ClaudeTeamMonitor.Index) {
            $tags += "target"
        }
        if (-not $monitor.DpiOk) {
            $tags += "DPI query failed: 1 tab per group"
        }
        Write-ClaudeTeamLog "OK" ("Monitor {0} {1} ({2}): {3}x{4} px, work {5}x{6}+{7}+{8}, DPI {9} ({10}%), cell {11}x{12} px, budget {13}x{14} cells, {15}x{16} role panes of {17}x{18} per tab" -f `
            $monitor.Index, $monitor.Device, ($tags -join ", "), `
            ($monitor.Right - $monitor.Left), ($monitor.Bottom - $monitor.Top), ($monitor.WorkRight - $monitor.WorkLeft), ($monitor.WorkBottom - $monitor.WorkTop), $monitor.WorkLeft, $monitor.WorkTop, `
            $budget.Dpi, [Math]::Round($budget.Scale * 100), `
            [Math]::Round($budget.CellWidth, 1), [Math]::Round($budget.CellHeight, 1), $budget.TotalCols, $budget.TotalRows, $budget.MaxCols, $budget.MaxRows, $budget.MinRoleCols, $budget.MinRoleRows)
    }
    if ($script:ClaudeTeamOptNoWindows) {
        Write-ClaudeTeamLog "SKIP" "-NoWindows: role panes are not opened"
    } elseif ($script:ClaudeTeamWtPath) {
        Write-ClaudeTeamLog "OK" ("Terminal: one Windows Terminal window {0}, maximized (-M) at --pos {1},{2}, equal split fractions (DPI-independent)" -f (Get-ClaudeTeamWindowName), ($script:ClaudeTeamMonitor.WorkLeft + 1), ($script:ClaudeTeamMonitor.WorkTop + 1))
    } else {
        Write-ClaudeTeamLog "WARN" ("Terminal: {0} console, one unpositioned window per role (install Windows Terminal for the packed layout)" -f $script:ClaudeTeamShellPath)
    }
}

# Where the lead goes in its tab: a left column (full height) when a role column
# still fits beside it, otherwise a top row (full width), otherwise alone.
function Get-ClaudeTeamLeadShape {
    $budget = $script:ClaudeTeamBudget
    $leftCols = [int][Math]::Floor(($budget.UsableWidth - $budget.MinLeadWidthPx) / $budget.MinRoleWidthPx)
    $topRows = [int][Math]::Floor(($budget.UsableHeight - $budget.MinLeadHeightPx) / $budget.MinRoleHeightPx)
    if (($leftCols -ge 1) -and ($budget.MaxRows -ge 1) -and ($budget.UsableHeight -ge $budget.MinLeadHeightPx)) {
        return [pscustomobject]@{ Kind = "lead-left"; MaxCols = $leftCols; MaxRows = $budget.MaxRows; Capacity = ($leftCols * $budget.MaxRows) }
    }
    if (($topRows -ge 1) -and ($budget.MaxCols -ge 1)) {
        return [pscustomobject]@{ Kind = "lead-top"; MaxCols = $budget.MaxCols; MaxRows = $topRows; Capacity = ($budget.MaxCols * $topRows) }
    }
    return [pscustomobject]@{ Kind = "lead-only"; MaxCols = 0; MaxRows = 0; Capacity = 0 }
}

# Role panes a tab holds besides the lead; without a DPI reading a tab takes one
# whole group.
function Get-ClaudeTeamTabCapacity {
    param([bool]$HasLead)
    if (-not $script:ClaudeTeamBudget.DpiOk) {
        return [int]::MaxValue
    }
    if ($HasLead) {
        return (Get-ClaudeTeamLeadShape).Capacity
    }
    return [int][Math]::Max(1, $script:ClaudeTeamBudget.MaxCols * $script:ClaudeTeamBudget.MaxRows)
}

# Columns of an equal grid for Count panes: the max-area rule (DESIGN §3.1),
# same score as claude_team_tab_grid on Linux (pane_cols * pane_rows) -- the
# columns count that gives each pane the largest area within the column and row
# limits. Ties (equal area) keep the smaller column count, since columns are
# tried low to high and only a strictly larger score replaces the best one.
function Select-ClaudeTeamGrid {
    param([int]$Count, [double]$RegionWidth, [double]$RegionHeight, [int]$MaxCols, [int]$MaxRows)
    $budget = $script:ClaudeTeamBudget
    $limit = [int][Math]::Max(1, [Math]::Min($Count, $MaxCols))
    $columns = 1
    $rows = 1
    $paneCols = 0.0
    $paneRows = 0.0
    $score = 0.0
    $bestColumns = $limit
    $bestScore = -1.0
    for ($columns = 1; $columns -le $limit; $columns++) {
        $rows = [int][Math]::Ceiling($Count / $columns)
        if ($rows -gt [Math]::Max(1, $MaxRows)) {
            continue
        }
        $paneCols = (($RegionWidth / $columns) - $budget.PaneChromeWidth) / $budget.CellWidth
        $paneRows = (($RegionHeight / $rows) - $budget.PaneChromeHeight) / $budget.CellHeight
        if (($paneCols -le 0) -or ($paneRows -le 0)) {
            continue
        }
        $score = $paneCols * $paneRows
        if ($score -gt $bestScore) {
            $bestScore = $score
            $bestColumns = $columns
        }
    }
    return $bestColumns
}

function New-ClaudeTeamTab {
    param([bool]$HasLead)
    return [pscustomobject]@{
        Index        = 0
        HasLead      = $HasLead
        Capacity     = (Get-ClaudeTeamTabCapacity -HasLead $HasLead)
        Rows         = (New-Object System.Collections.Generic.List[object])
        Kind         = "grid"
        GridCols     = 0
        LeadFraction = 0.0
        Segments     = (New-Object System.Collections.Generic.List[string])
    }
}

function Get-ClaudeTeamTabRoleCount {
    param($Tab)
    if ($Tab.HasLead) {
        return ($Tab.Rows.Count - 1)
    }
    return $Tab.Rows.Count
}

# Packs the roles to start into tabs, group by group: a whole group joins the
# current tab while it fits (merge_groups_when_room), a group that does not fit
# a tab is split over more tabs, and the lead's group always opens the lead tab.
function Invoke-ClaudeTeamPacking {
    param([object[]]$Rows)
    $tabs = New-Object System.Collections.Generic.List[object]
    $current = $null
    $merge = [bool](Get-ClaudeTeamProperty -Object (Get-ClaudeTeamLayout) -Name "merge_groups_when_room" -Default $true)
    $groupIndexes = @($Rows | ForEach-Object { $_.Group } | Sort-Object -Unique)
    $groupIndex = 0
    $pending = $null
    $row = $null
    $tab = $null
    $take = 0
    $index = 0
    $hasLead = $false
    foreach ($groupIndex in $groupIndexes) {
        $pending = New-Object System.Collections.Generic.List[object]
        foreach ($row in @($Rows | Where-Object { ($_.Group -eq $groupIndex) -and $_.IsLead })) {
            $pending.Add($row)
        }
        foreach ($row in @($Rows | Where-Object { ($_.Group -eq $groupIndex) -and (-not $_.IsLead) })) {
            $pending.Add($row)
        }
        $hasLead = [bool]$pending[0].IsLead
        if (-not $script:ClaudeTeamBudget.DpiOk) {
            $tab = New-ClaudeTeamTab -HasLead $hasLead
            foreach ($row in $pending) {
                $tab.Rows.Add($row)
            }
            $tabs.Add($tab)
            $current = $null
            continue
        }
        if ((-not $hasLead) -and ($null -ne $current) -and $merge -and (((Get-ClaudeTeamTabRoleCount -Tab $current) + $pending.Count) -le $current.Capacity)) {
            foreach ($row in $pending) {
                $current.Rows.Add($row)
            }
            continue
        }
        while ($pending.Count -gt 0) {
            $tab = New-ClaudeTeamTab -HasLead ([bool]$pending[0].IsLead)
            if ($tab.HasLead) {
                $take = 1 + [Math]::Min($tab.Capacity, $pending.Count - 1)
            } else {
                $take = [Math]::Min([Math]::Max(1, $tab.Capacity), $pending.Count)
            }
            for ($index = 0; $index -lt $take; $index++) {
                $tab.Rows.Add($pending[0])
                $pending.RemoveAt(0)
            }
            $tabs.Add($tab)
            $current = $tab
        }
    }
    for ($index = 0; $index -lt $tabs.Count; $index++) {
        $tabs[$index].Index = $index + 1
    }
    return $tabs.ToArray()
}

function Get-ClaudeTeamPaneCommand {
    param($Row)
    $parts = @(
        (Split-Path $script:ClaudeTeamShellPath -Leaf), "-NoLogo", "-NoExit", "-File", (ConvertTo-ClaudeTeamCommandToken -Text $ClaudeTeamLauncherPath),
        $ClaudeTeamPaneFlag, $script:ClaudeTeamMode, "--agent", $Row.Role, "--name", $Row.Session
    )
    if ($Row.IsLead -and $script:ClaudeTeamRemoteAny) {
        $parts += @("--remote-control", $Row.Session)
    }
    if ($script:ClaudeTeamOptNoKickoff) {
        $parts += $ClaudeTeamPaneNoKickoffFlag
    }
    if ($Row.IsLead -and ($script:ClaudeTeamOptRoles.Count -gt 0)) {
        $parts += @($ClaudeTeamPaneRolesFlag, ($script:ClaudeTeamOptRoles -join ","))
    }
    return ($parts -join " ")
}

function Get-ClaudeTeamPaneOptions {
    param($Row)
    return ("--title {0} --suppressApplicationTitle -d {1}" -f $Row.Role, (ConvertTo-ClaudeTeamCommandToken -Text $ClaudeTeamRootDir))
}

function Get-ClaudeTeamSplitSegment {
    param([string]$Direction, [double]$Size, $Row)
    return ("split-pane {0} --size {1} {2} {3}" -f $Direction, (Format-ClaudeTeamFraction -Value $Size), (Get-ClaudeTeamPaneOptions -Row $Row), (Get-ClaudeTeamPaneCommand -Row $Row))
}

function Get-ClaudeTeamCellText {
    param([double]$WidthPx, [double]$HeightPx)
    $budget = $script:ClaudeTeamBudget
    return ("{0}x{1}" -f [int][Math]::Floor(($WidthPx - $budget.PaneChromeWidth) / $budget.CellWidth), [int][Math]::Floor(($HeightPx - $budget.PaneChromeHeight) / $budget.CellHeight))
}

# Equal grid of one tab. Build order (pane ids follow it): the tab's first pane
# (the lead, or the grid's top-left role), the lead split, the column heads
# (split-pane -V (c-j)/(c-j+1)), then per column focus-pane -t <head> and its
# rows (split-pane -H (r-i)/(r-i+1)). Roles fill the grid column by column
# (DESIGN §3.1).
function Set-ClaudeTeamTabLayout {
    param($Tab)
    $budget = $script:ClaudeTeamBudget
    $lead = $null
    $gridRows = New-Object System.Collections.Generic.List[object]
    $row = $null
    $count = 0
    $width = $budget.UsableWidth
    $height = $budget.UsableHeight
    $regionWidth = $width
    $regionHeight = $height
    $maxCols = 0
    $maxRows = 0
    $shape = $null
    $columns = 1
    $gridRowCount = 1
    $leadFraction = 0.0
    $columnRows = $null
    $cellMap = @{}
    $index = 0
    $gridRow = 0
    $gridColumn = 0
    $base = 0
    $nextPane = 0
    $firstRow = $null
    $rowCount = 0
    $step = 0
    $perColumn = 0
    $extra = 0
    $take = 0

    foreach ($row in $Tab.Rows) {
        if ($Tab.HasLead -and $row.IsLead -and ($null -eq $lead)) {
            $lead = $row
        } else {
            $gridRows.Add($row)
        }
    }
    $count = $gridRows.Count
    $maxCols = $(if ($budget.DpiOk) { $budget.MaxCols } else { $count })
    $maxRows = $(if ($budget.DpiOk) { $budget.MaxRows } else { $count })
    if ($null -ne $lead) {
        $shape = Get-ClaudeTeamLeadShape
        if (-not $budget.DpiOk) {
            $shape = [pscustomobject]@{ Kind = "lead-left"; MaxCols = $count; MaxRows = $count; Capacity = $count }
        }
        if ($count -eq 0) {
            $Tab.Kind = "lead-only"
        } elseif ($shape.Kind -eq "lead-top") {
            $Tab.Kind = "lead-top"
            $columns = Select-ClaudeTeamGrid -Count $count -RegionWidth $width -RegionHeight ($height - $budget.MinLeadHeightPx) -MaxCols $shape.MaxCols -MaxRows $shape.MaxRows
            $gridRowCount = [int][Math]::Ceiling($count / $columns)
            $leadFraction = [Math]::Round([Math]::Max($budget.MinLeadHeightPx / $height, 1.0 / ($gridRowCount + 1)), 4)
            $regionHeight = $height * (1.0 - $leadFraction)
        } else {
            $Tab.Kind = "lead-left"
            $columns = Select-ClaudeTeamGrid -Count $count -RegionWidth ($width - $budget.MinLeadWidthPx) -RegionHeight $height -MaxCols ([Math]::Max(1, $shape.MaxCols)) -MaxRows ([Math]::Max(1, $shape.MaxRows))
            $leadFraction = [Math]::Round([Math]::Max($budget.MinLeadWidthPx / $width, 1.0 / ($columns + 1)), 4)
            $regionWidth = $width * (1.0 - $leadFraction)
        }
    } else {
        $Tab.Kind = "grid"
        $columns = Select-ClaudeTeamGrid -Count $count -RegionWidth $width -RegionHeight $height -MaxCols $maxCols -MaxRows $maxRows
    }
    $Tab.GridCols = $(if ($count -gt 0) { $columns } else { 0 })
    $Tab.LeadFraction = $leadFraction

    # Column-major fill (DESIGN §3.1): column 0 fills top to bottom before column
    # 1 starts, and the leading columns take the extra pane when the count does
    # not divide evenly -- the same distribution claude_team_tab_grid uses on
    # Linux (per_column, plus one for each of the first `extra` columns).
    $columnRows = New-Object int[] ([Math]::Max(1, $columns))
    if ($count -gt 0) {
        $perColumn = [int][Math]::Floor($count / $columns)
        $extra = $count % $columns
        $index = 0
        for ($gridColumn = 0; $gridColumn -lt $columns; $gridColumn++) {
            $take = $perColumn
            if ($gridColumn -lt $extra) {
                $take = $take + 1
            }
            $columnRows[$gridColumn] = $take
            for ($gridRow = 0; $gridRow -lt $take; $gridRow++) {
                $cellMap[("{0},{1}" -f $gridRow, $gridColumn)] = $gridRows[$index]
                $gridRows[$index].Tab = $Tab.Index
                $gridRows[$index].Cells = Get-ClaudeTeamCellText -WidthPx ($regionWidth / $columns) -HeightPx ($regionHeight / $take)
                $index = $index + 1
            }
        }
    }

    $Tab.Segments.Clear()
    if ($null -ne $lead) {
        $firstRow = $lead
        $base = 1
    } else {
        $firstRow = $cellMap["0,0"]
        $base = 0
    }
    $Tab.Segments.Add(("new-tab {0} {1}" -f (Get-ClaudeTeamPaneOptions -Row $firstRow), (Get-ClaudeTeamPaneCommand -Row $firstRow)))
    if ($null -ne $lead) {
        $lead.Tab = $Tab.Index
        $lead.Pane = 0
        switch ($Tab.Kind) {
            "lead-left" { $lead.Cells = Get-ClaudeTeamCellText -WidthPx ($width * $leadFraction) -HeightPx $height }
            "lead-top" { $lead.Cells = Get-ClaudeTeamCellText -WidthPx $width -HeightPx ($height * $leadFraction) }
            default { $lead.Cells = Get-ClaudeTeamCellText -WidthPx $width -HeightPx $height }
        }
        if ($count -gt 0) {
            $Tab.Segments.Add((Get-ClaudeTeamSplitSegment -Direction $(if ($Tab.Kind -eq "lead-top") { "-H" } else { "-V" }) -Size ([Math]::Round(1.0 - $leadFraction, 4)) -Row $cellMap["0,0"]))
        }
    }
    if ($count -eq 0) {
        return
    }
    $cellMap["0,0"].Pane = $base
    for ($gridColumn = 1; $gridColumn -lt $columns; $gridColumn++) {
        $Tab.Segments.Add((Get-ClaudeTeamSplitSegment -Direction "-V" -Size (($columns - $gridColumn) / ($columns - $gridColumn + 1)) -Row $cellMap[("0,{0}" -f $gridColumn)]))
        $cellMap[("0,{0}" -f $gridColumn)].Pane = $base + $gridColumn
    }
    $nextPane = $base + $columns
    for ($gridColumn = 0; $gridColumn -lt $columns; $gridColumn++) {
        $rowCount = $columnRows[$gridColumn]
        if ($rowCount -le 1) {
            continue
        }
        if ($columns -gt 1) {
            $Tab.Segments.Add(("focus-pane -t {0}" -f ($base + $gridColumn)))
        }
        for ($step = 1; $step -lt $rowCount; $step++) {
            $Tab.Segments.Add((Get-ClaudeTeamSplitSegment -Direction "-H" -Size (($rowCount - $step) / ($rowCount - $step + 1)) -Row $cellMap[("{0},{1}" -f $step, $gridColumn)]))
            $cellMap[("{0},{1}" -f $step, $gridColumn)].Pane = $nextPane
            $nextPane++
        }
    }
}

# One wt.exe call for the whole layout, or one call per tab when it would pass the
# 32,767-character command-line limit. Only the first call carries -M --pos.
function Build-ClaudeTeamWtCalls {
    param([object[]]$Tabs)
    $windowName = Get-ClaudeTeamWindowName
    $firstPrefix = "-w {0} -M --pos {1},{2}" -f $windowName, ($script:ClaudeTeamMonitor.WorkLeft + 1), ($script:ClaudeTeamMonitor.WorkTop + 1)
    $nextPrefix = "-w {0}" -f $windowName
    $tabTexts = @($Tabs | ForEach-Object { ($_.Segments -join " ; ") })
    $allSegments = @($Tabs | ForEach-Object { $_.Segments })
    $allRows = @($Tabs | ForEach-Object { $_.Rows })
    $single = "{0} {1}" -f $firstPrefix, ($tabTexts -join " ; ")
    $maxArguments = $ClaudeTeamWtCommandLimit - ([string]$script:ClaudeTeamWtPath).Length - 3
    $calls = @()
    $index = 0
    $arguments = ""
    if ($single.Length -le $maxArguments) {
        return @([pscustomobject]@{ Prefix = $firstPrefix; Segments = $allSegments; Rows = $allRows; Arguments = $single })
    }
    for ($index = 0; $index -lt $Tabs.Count; $index++) {
        $arguments = "{0} {1}" -f $(if ($index -eq 0) { $firstPrefix } else { $nextPrefix }), $tabTexts[$index]
        if ($arguments.Length -gt $maxArguments) {
            Write-ClaudeTeamLog "WARN" ("wt call for tab {0} has {1} chars (limit {2})" -f $Tabs[$index].Index, $arguments.Length, $maxArguments)
        }
        $calls += [pscustomobject]@{ Prefix = $(if ($index -eq 0) { $firstPrefix } else { $nextPrefix }); Segments = @($Tabs[$index].Segments); Rows = @($Tabs[$index].Rows); Arguments = $arguments }
    }
    return $calls
}

function Get-ClaudeTeamEnvironmentText {
    param($Row)
    $environment = Get-ClaudeTeamSessionEnvironment -Kinds (Get-ClaudeTeamRoleEnvironmentKinds -Row $Row)
    $pairs = @(("{0}=1" -f $ClaudeTeamSessionMarkerVariable))
    $key = $null
    foreach ($key in $environment.Keys) {
        $pairs += ("{0}={1}" -f $key, $environment[$key])
    }
    return ($pairs -join " ")
}

function Show-ClaudeTeamPlan {
    param([object[]]$StartRows)
    $tab = $null
    $call = $null
    $segmentIndex = 0
    $row = $null
    $index = 0
    $kickoffText = ""
    $remote = $null
    $budget = $script:ClaudeTeamBudget
    Write-ClaudeTeamLog "PLAN" ("Window {0} on monitor {1}: work {2}x{3} px at DPI {4}, cell budget {5}x{6}, lead min {7}x{8}, role min {9}x{10}" -f `
        (Get-ClaudeTeamWindowName), $script:ClaudeTeamMonitor.Index, ($script:ClaudeTeamMonitor.WorkRight - $script:ClaudeTeamMonitor.WorkLeft), ($script:ClaudeTeamMonitor.WorkBottom - $script:ClaudeTeamMonitor.WorkTop), `
        $budget.Dpi, $budget.TotalCols, $budget.TotalRows, $budget.MinLeadCols, $budget.MinLeadRows, $budget.MinRoleCols, $budget.MinRoleRows)
    foreach ($tab in $script:ClaudeTeamTabs) {
        Write-ClaudeTeamLog "PLAN" ("Tab {0}: {1}, {2} panes{3}{4}" -f $tab.Index, $tab.Kind, $tab.Rows.Count, $(if ($tab.GridCols -gt 0) { (", grid {0} columns" -f $tab.GridCols) } else { "" }), $(if ($tab.LeadFraction -gt 0) { (", lead fraction {0}" -f (Format-ClaudeTeamFraction -Value $tab.LeadFraction)) } else { "" }))
        foreach ($row in @($tab.Rows | Sort-Object { [int]$_.Pane })) {
            Write-Host ("           pane {0,2}  {1,-20} {2,-22} {3} cells" -f $row.Pane, $row.Role, $row.Session, $row.Cells)
        }
    }
    if ($script:ClaudeTeamWtPath) {
        for ($index = 0; $index -lt $script:ClaudeTeamWtCalls.Count; $index++) {
            $call = $script:ClaudeTeamWtCalls[$index]
            Write-ClaudeTeamLog "PLAN" ("wt call {0}/{1}: {2} chars of {3}" -f ($index + 1), $script:ClaudeTeamWtCalls.Count, ($call.Arguments.Length + ([string]$script:ClaudeTeamWtPath).Length + 3), $ClaudeTeamWtCommandLimit)
            Write-Host ("           {0} {1}" -f (ConvertTo-ClaudeTeamCommandToken -Text $script:ClaudeTeamWtPath), $call.Prefix)
            for ($segmentIndex = 0; $segmentIndex -lt @($call.Segments).Count; $segmentIndex++) {
                Write-Host ("             {0}{1}" -f $(if ($segmentIndex -gt 0) { "; " } else { "" }), @($call.Segments)[$segmentIndex])
            }
        }
    } else {
        foreach ($row in $StartRows) {
            Write-ClaudeTeamLog "PLAN" ("console window: {0}" -f (Get-ClaudeTeamPaneCommand -Row $row))
        }
    }
    Write-ClaudeTeamLog "PLAN" ("Role sessions (claudeteam.ps1 {0} applies these in each pane):" -f $ClaudeTeamPaneFlag)
    foreach ($row in $StartRows) {
        if ($row.Remote) {
            $remote = Get-ClaudeTeamRemoteConfig -Role $row.Role
            Write-Host ("           {0}: ssh.exe {1} <secret {2}> {3}" -f $row.Role, ($ClaudeTeamSshOptions -join " "), [string]$remote.ssh_secret, (Get-ClaudeTeamRemoteArgument -Row $row -Remote $remote -KickoffPlaceholder))
            continue
        }
        $kickoffText = $(if ($script:ClaudeTeamOptNoKickoff) { "" } else { (" <kickoff {0} chars>" -f (Get-ClaudeTeamKickoff -Role $row.Role).Length) })
        Write-Host ("           {0}: env {1}; claude {2}{3}" -f $row.Role, (Get-ClaudeTeamEnvironmentText -Row $row), ((Get-ClaudeTeamRoleClaudeArguments -Row $row) -join " "), $kickoffText)
    }
}

function Wait-ClaudeTeamPids {
    param([object[]]$Rows, [datetime]$LaunchTime, [int]$TimeoutMilliseconds)
    $pending = New-Object System.Collections.Generic.List[object]
    $deadline = (Get-Date).AddMilliseconds($TimeoutMilliseconds)
    $row = $null
    $pidPath = $null
    $process = $null
    $done = @()
    foreach ($row in $Rows) {
        $pending.Add($row)
    }
    while (($pending.Count -gt 0) -and ((Get-Date) -lt $deadline)) {
        $done = @()
        foreach ($row in $pending) {
            $pidPath = Get-ClaudeTeamPidPath -Session $row.Session
            if ((Test-Path -LiteralPath $pidPath) -and ((Get-Item -LiteralPath $pidPath).LastWriteTime -ge $LaunchTime.AddSeconds(-1))) {
                $process = Test-ClaudeTeamPidFile -Path $pidPath
                if ($process) {
                    $row.Pid = $process.Id
                    $done += $row
                }
            }
        }
        foreach ($row in $done) {
            [void]$pending.Remove($row)
        }
        if ($pending.Count -gt 0) {
            Start-Sleep -Milliseconds $ClaudeTeamPollMilliseconds
        }
    }
}

# Session name -> PID of each live claude in the Claude session registry
# (<config>\sessions\<pid>.json with name and pid). A half-written or foreign
# file is skipped. Read only, so -Status uses it too.
function Get-ClaudeTeamSessionRegistry {
    $registry = @{}
    $file = $null
    $entry = $null
    $entryName = ""
    $entryPid = 0
    if (-not (Test-Path -LiteralPath $ClaudeTeamUserSessionsDir -PathType Container)) {
        return $registry
    }
    foreach ($file in @(Get-ChildItem -LiteralPath $ClaudeTeamUserSessionsDir -Filter "*.json" -File -ErrorAction SilentlyContinue)) {
        try {
            $entry = Get-Content -LiteralPath $file.FullName -Raw -Encoding UTF8 -ErrorAction Stop | ConvertFrom-Json -ErrorAction Stop
        } catch {
            continue
        }
        if (($entry -isnot [System.Management.Automation.PSCustomObject]) -or ($null -eq $entry.PSObject.Properties["name"]) -or ($null -eq $entry.PSObject.Properties["pid"])) {
            continue
        }
        $entryName = [string]$entry.PSObject.Properties["name"].Value
        if ([string]::IsNullOrWhiteSpace($entryName) -or (-not [int]::TryParse([string]$entry.PSObject.Properties["pid"].Value, [ref]$entryPid))) {
            continue
        }
        if ($null -ne (Get-Process -Id $entryPid -ErrorAction SilentlyContinue)) {
            $registry[$entryName] = $entryPid
        }
    }
    return $registry
}

# Labels a live role row (Linux claude_team_label_live_role, registry only: WT
# panes cannot be read, so there are no blocked:<screen> labels). running: the
# session is registered, or its PID file is younger than the grace period;
# stalled: a local role whose PID file is older with no registry entry;
# running-unverified: a remote pane (its session registers on the server).
function Set-ClaudeTeamLiveRowState {
    param($Row, [hashtable]$Registry)
    $pidPath = Get-ClaudeTeamPidPath -Session $Row.Session
    if ($Row.Remote) {
        $Row.State = "running-unverified"
        Write-ClaudeTeamLog "SKIP" ("Role {0} ({1}) already running (PID {2}); remote pane, readiness not probed (the session registers on the server)" -f $Row.Role, $Row.Session, $Row.Pid)
        return
    }
    if ((-not $Registry.ContainsKey($Row.Session)) -and (Test-Path -LiteralPath $pidPath -PathType Leaf) -and `
        (((Get-Date) - (Get-Item -LiteralPath $pidPath).LastWriteTime).TotalSeconds -gt $ClaudeTeamReadyGraceSeconds)) {
        $Row.State = "stalled"
        Write-ClaudeTeamLog "WARN" ("Role {0} (PID {1}) never reached its prompt (no session registry entry after {2}s, pane {3}); finish its setup, login or trust screen in that pane, or close the pane and re-run" -f $Row.Role, $Row.Pid, $ClaudeTeamReadyGraceSeconds, $Row.Session)
        return
    }
    $Row.State = "running"
    Write-ClaudeTeamLog "SKIP" ("Role {0} ({1}) already running (PID {2})" -f $Row.Role, $Row.Session, $Row.Pid)
}

# After the launch (Linux claude_team_probe_ready): the started, reopened and
# starting local rows are polled against the session registry for up to
# $ClaudeTeamReadyWaitMilliseconds; registered rows become ready, the rest
# not-ready, since a PID file only proves the pane shell.
function Wait-ClaudeTeamReady {
    param([object[]]$Rows)
    $pending = New-Object System.Collections.Generic.List[object]
    $deadline = (Get-Date).AddMilliseconds($ClaudeTeamReadyWaitMilliseconds)
    $registry = $null
    $row = $null
    $done = @()
    $readyCount = 0
    $accountText = ""
    foreach ($row in $Rows) {
        if ($row.State -notin @("started", "reopened", "starting")) {
            continue
        }
        if ($row.Remote) {
            Write-ClaudeTeamLog "OK" ("Role {0}: remote pane, readiness not probed (the session registers on the server)" -f $row.Role)
            continue
        }
        $pending.Add($row)
    }
    if ($pending.Count -eq 0) {
        return
    }
    while ($pending.Count -gt 0) {
        $registry = Get-ClaudeTeamSessionRegistry
        $done = @($pending | Where-Object { $registry.ContainsKey($_.Session) })
        foreach ($row in $done) {
            $row.State = "ready"
            $readyCount++
            [void]$pending.Remove($row)
        }
        if (($pending.Count -eq 0) -or ((Get-Date) -ge $deadline)) {
            break
        }
        Start-Sleep -Milliseconds $ClaudeTeamPollMilliseconds
    }
    if ((-not [string]::IsNullOrEmpty($script:ClaudeTeamAccountState)) -and ($script:ClaudeTeamAccountState -ne "ready")) {
        $accountText = " (account: {0})" -f $script:ClaudeTeamAccountState
    }
    foreach ($row in $pending) {
        $row.State = "not-ready"
        Write-ClaudeTeamLog "WARN" ("Role {0}: no Claude session registered within {1}s (pane {2}); check that pane for a setup, login, trust or usage-limit screen{3}" -f $row.Role, ($ClaudeTeamReadyWaitMilliseconds / 1000), $row.Session, $accountText)
    }
    Write-ClaudeTeamLog "OK" ("Readiness: {0} ready, {1} not ready" -f $readyCount, $pending.Count)
}

function Start-ClaudeTeamWtCall {
    param([string]$Arguments)
    Start-Process -FilePath $script:ClaudeTeamWtPath -ArgumentList $Arguments | Out-Null
}

# Session name -> live processes started with --name <session> (-n <session>) by
# any launcher in this Windows session (Terminal Services SessionId; DESIGN
# §3.2/blocker 4), whether a role shell of the team window or a claude/node
# process. Several processes can share a --name (the pane shell and its claude
# child both carry it), so every match is kept; Get-ClaudeTeamNamedClaudeProcess
# and Get-ClaudeTeamNamedShellProcess pick the one each caller cares about.
function Get-ClaudeTeamNamedProcessMap {
    $map = @{}
    $process = $null
    $tokens = @()
    $index = 0
    $name = ""
    $sessionId = (Get-Process -Id $PID).SessionId
    $filter = "({0}) AND SessionId={1}" -f $ClaudeTeamNamedProcessFilter, $sessionId
    foreach ($process in @(Get-CimInstance -ClassName Win32_Process -Filter $filter -ErrorAction SilentlyContinue)) {
        $tokens = @(([string]$process.CommandLine).Split(" ") | Where-Object { $_ })
        for ($index = 0; $index -lt ($tokens.Count - 1); $index++) {
            if ($ClaudeTeamNameFlags -notcontains $tokens[$index]) {
                continue
            }
            $name = $tokens[$index + 1].Trim('"', "'")
            if (-not $map.ContainsKey($name)) {
                $map[$name] = New-Object System.Collections.Generic.List[object]
            }
            $map[$name].Add([pscustomobject]@{ ProcessId = $process.ProcessId; ProcessName = $process.Name; CreatedAt = $process.CreationDate })
        }
    }
    return $map
}

# The first claude.exe/node.exe process matching --name <session>: the only
# process kind that counts as an "already running" role (DESIGN §3.2).
function Get-ClaudeTeamNamedClaudeProcess {
    param([hashtable]$NamedProcesses, [string]$Session)
    if (($null -eq $NamedProcesses) -or (-not $NamedProcesses.ContainsKey($Session))) {
        return $null
    }
    return (@($NamedProcesses[$Session] | Where-Object { $ClaudeTeamClaudeProcessNames -contains $_.ProcessName }) | Select-Object -First 1)
}

# The newest pwsh.exe/powershell.exe process matching --name <session> created at
# or after $AfterTime: a pane still starting up, whose PID file is not written
# yet. An older shell match is an idle pane whose claude already exited, so it
# does not count and the role is reopened instead of waited on.
function Get-ClaudeTeamNamedShellProcess {
    param([hashtable]$NamedProcesses, [string]$Session, [datetime]$AfterTime)
    if (($null -eq $NamedProcesses) -or (-not $NamedProcesses.ContainsKey($Session))) {
        return $null
    }
    return (@($NamedProcesses[$Session] | Where-Object { ($ClaudeTeamShellProcessNames -contains $_.ProcessName) -and ($null -ne $_.CreatedAt) -and ($_.CreatedAt -ge $AfterTime.AddSeconds(-1)) }) | Sort-Object CreatedAt -Descending | Select-Object -First 1)
}

# A missing role is reopened as its own tab of the named window (a split without
# room is dropped silently by WT). A role whose session name is alive with a
# claude.exe/node.exe process, or with a shell that started after this launch
# (still starting, PID not written yet), is not reopened, so no session gets a
# duplicate name. An older idle shell (its claude already exited) does not
# count, so the role is reopened.
function Open-ClaudeTeamMissingRoles {
    param([object[]]$Rows)
    $row = $null
    $launchTime = $null
    $paneProcess = $null
    $namedProcesses = Get-ClaudeTeamNamedProcessMap
    foreach ($row in $Rows) {
        $paneProcess = Get-ClaudeTeamNamedClaudeProcess -NamedProcesses $namedProcesses -Session $row.Session
        if ($null -eq $paneProcess) {
            $paneProcess = Get-ClaudeTeamNamedShellProcess -NamedProcesses $namedProcesses -Session $row.Session -AfterTime $script:ClaudeTeamLaunchTime
        }
        if ($null -ne $paneProcess) {
            Wait-ClaudeTeamPids -Rows @($row) -LaunchTime $script:ClaudeTeamLaunchTime -TimeoutMilliseconds $ClaudeTeamReopenWaitMilliseconds
            if ([string]$row.Pid -eq "-") {
                $row.Pid = $paneProcess.ProcessId
                $row.State = "starting"
                Write-ClaudeTeamLog "WARN" ("Role {0}: {1} PID {2} runs with --name {3} but {4} is not written yet; not reopened" -f $row.Role, $paneProcess.ProcessName, $paneProcess.ProcessId, $row.Session, (Get-ClaudeTeamPidPath -Session $row.Session))
            } else {
                $row.State = "started"
                Write-ClaudeTeamLog "OK" ("Role {0} shell PID {1} recorded in {2}" -f $row.Role, $row.Pid, (Get-ClaudeTeamPidPath -Session $row.Session))
            }
            continue
        }
        $launchTime = Get-Date
        if ($script:ClaudeTeamWtPath) {
            Start-ClaudeTeamWtCall -Arguments ("-w {0} new-tab {1} {2}" -f (Get-ClaudeTeamWindowName), (Get-ClaudeTeamPaneOptions -Row $row), (Get-ClaudeTeamPaneCommand -Row $row))
            Write-ClaudeTeamLog "OPEN" ("Role {0} missing after the layout; reopened as its own tab of {1}" -f $row.Role, (Get-ClaudeTeamWindowName))
        } else {
            Start-Process -FilePath $script:ClaudeTeamShellPath -ArgumentList ((Get-ClaudeTeamPaneCommand -Row $row).Split(" ", 2)[1]) | Out-Null
            Write-ClaudeTeamLog "OPEN" ("Role {0} missing; console window reopened" -f $row.Role)
        }
        Wait-ClaudeTeamPids -Rows @($row) -LaunchTime $launchTime -TimeoutMilliseconds $ClaudeTeamReopenWaitMilliseconds
        if ([string]$row.Pid -ne "-") {
            $row.State = "reopened"
            $row.Tab = "new"
            $row.Pane = 0
            Write-ClaudeTeamLog "OK" ("Role {0} shell PID {1} recorded in {2}" -f $row.Role, $row.Pid, (Get-ClaudeTeamPidPath -Session $row.Session))
        } else {
            $row.State = "unconfirmed"
            Write-ClaudeTeamLog "WARN" ("Role {0} PID not recorded within {1} ms" -f $row.Role, $ClaudeTeamReopenWaitMilliseconds)
        }
    }
}

function Start-ClaudeTeamRoles {
    $row = $null
    $namedProcesses = $null
    $livePid = $null
    $otherLeadSession = $null
    $otherLeadPid = $null
    $startRows = @()
    $tab = $null
    $call = $null
    $callIndex = 0
    $launchTime = $null
    $missingRows = @()
    $registry = $null

    $namedProcesses = Get-ClaudeTeamNamedProcessMap
    $registry = Get-ClaudeTeamSessionRegistry
    # Rows held by the account gate are scanned too: a live one gets its live
    # state, a dead one stays held and is not started.
    foreach ($row in @($script:ClaudeTeamRows | Where-Object { $_.Window -and ($_.Enabled -or ($_.State -like "held:*")) })) {
        $livePid = Get-ClaudeTeamLivePid -Role $row.Role -Session $row.Session -NamedProcesses $namedProcesses
        if ($null -ne $livePid) {
            $row.Pid = $livePid
            Set-ClaudeTeamLiveRowState -Row $row -Registry $registry
            continue
        }
        if (-not $row.Enabled) {
            continue
        }
        if ($row.IsLead) {
            $otherLeadSession = Get-ClaudeTeamLeadSessionName -Mode $(if ($script:ClaudeTeamMode -eq "team") { "sessions" } else { "team" })
            $otherLeadPid = Get-ClaudeTeamLivePid -Role $row.Role -Session $otherLeadSession -NamedProcesses $namedProcesses
            if ($null -ne $otherLeadPid) {
                $row.State = "other-lead"
                $row.Pid = $otherLeadPid
                Write-ClaudeTeamLog "WARN" ("Lead {0} not started: lead {1} is running (PID {2}); one lead at a time, stop it to switch launchers" -f $row.Session, $otherLeadSession, $otherLeadPid)
                continue
            }
        }
        $startRows += $row
    }
    Write-ClaudeTeamLog "OK" ("{0} roles to start, {1} already running" -f $startRows.Count, @($script:ClaudeTeamRows | Where-Object { $_.State -in $ClaudeTeamLiveStates }).Count)
    if ($startRows.Count -eq 0) {
        Show-ClaudeTeamRemoteControlHint
        return
    }

    $script:ClaudeTeamTabs = @(Invoke-ClaudeTeamPacking -Rows $startRows)
    foreach ($tab in $script:ClaudeTeamTabs) {
        Set-ClaudeTeamTabLayout -Tab $tab
    }
    $script:ClaudeTeamWtCalls = @()
    if ($script:ClaudeTeamWtPath) {
        $script:ClaudeTeamWtCalls = @(Build-ClaudeTeamWtCalls -Tabs $script:ClaudeTeamTabs)
    }
    Show-ClaudeTeamPlan -StartRows $startRows

    if ($script:ClaudeTeamOptStatus -or $script:ClaudeTeamOptNoWindows) {
        foreach ($row in $startRows) {
            $row.State = "stopped"
        }
        if ($script:ClaudeTeamOptNoWindows) {
            Write-ClaudeTeamLog "SKIP" "-NoWindows: plan only (Windows roles need a pane)"
        } else {
            Write-ClaudeTeamLog "SKIP" "-Status: plan only, nothing opened"
        }
        Show-ClaudeTeamRemoteControlHint
        return
    }

    $launchTime = Get-Date
    $script:ClaudeTeamLaunchTime = $launchTime
    if ($script:ClaudeTeamWtPath) {
        for ($callIndex = 0; $callIndex -lt $script:ClaudeTeamWtCalls.Count; $callIndex++) {
            $call = $script:ClaudeTeamWtCalls[$callIndex]
            Start-ClaudeTeamWtCall -Arguments $call.Arguments
            Write-ClaudeTeamLog "OPEN" ("wt.exe {0} ({1} panes)" -f $call.Prefix, @($call.Rows).Count)
            # Later per-tab calls target the named window, so the first call must
            # have created it: wait for its first pane before the next call.
            if (($callIndex -eq 0) -and ($script:ClaudeTeamWtCalls.Count -gt 1)) {
                Wait-ClaudeTeamPids -Rows @(@($call.Rows)[0]) -LaunchTime $launchTime -TimeoutMilliseconds $ClaudeTeamReopenWaitMilliseconds
            }
        }
    } else {
        foreach ($row in $startRows) {
            Start-Process -FilePath $script:ClaudeTeamShellPath -ArgumentList ((Get-ClaudeTeamPaneCommand -Row $row).Split(" ", 2)[1]) | Out-Null
            Write-ClaudeTeamLog "OPEN" ("Console window {0}" -f $row.Session)
        }
    }
    Wait-ClaudeTeamPids -Rows $startRows -LaunchTime $launchTime -TimeoutMilliseconds $ClaudeTeamPidWaitMilliseconds
    foreach ($row in $startRows) {
        if ([string]$row.Pid -ne "-") {
            $row.State = "started"
            Write-ClaudeTeamLog "OK" ("Role {0} shell PID {1} recorded in {2}" -f $row.Role, $row.Pid, (Get-ClaudeTeamPidPath -Session $row.Session))
        } else {
            $missingRows += $row
        }
    }
    if ($missingRows.Count -gt 0) {
        Open-ClaudeTeamMissingRoles -Rows $missingRows
    }
    Wait-ClaudeTeamReady -Rows $startRows
    Show-ClaudeTeamRemoteControlHint
}

# A remote role reaches the lead only while the lead runs with Remote Control
# (both ends need it). A lead started before any remote role was enabled lacks
# it and needs /remote-control once.
function Show-ClaudeTeamRemoteControlHint {
    $leadRow = @($script:ClaudeTeamRows | Where-Object { $_.IsLead -and ($_.State -in $ClaudeTeamLiveStates) }) | Select-Object -First 1
    $leadProcess = $null
    $commandLine = ""
    $tokens = @()
    $tokenIndex = -1
    $leadScript = ""
    $index = 0

    if ((-not $script:ClaudeTeamRemoteAny) -or ($null -eq $leadRow)) {
        return
    }
    $leadProcess = Get-CimInstance Win32_Process -Filter ("ProcessId={0}" -f $leadRow.Pid) -ErrorAction SilentlyContinue
    if ($null -eq $leadProcess) {
        return
    }
    $commandLine = [string]$leadProcess.CommandLine
    if ($commandLine.Contains("--remote-control")) {
        return
    }
    $tokens = @($commandLine.Split(' ') | Where-Object { $_ })
    for ($index = 0; $index -lt ($tokens.Count - 1); $index++) {
        if ($tokens[$index] -eq "-EncodedCommand") {
            $tokenIndex = $index + 1
        }
    }
    if ($tokenIndex -ge 0) {
        try {
            $leadScript = [System.Text.Encoding]::Unicode.GetString([Convert]::FromBase64String($tokens[$tokenIndex]))
        } catch {
            $leadScript = ""
        }
        if ($leadScript.Contains("--remote-control")) {
            return
        }
    }
    Write-ClaudeTeamLog "WARN" ("Lead PID {0} runs without Remote Control, so remote roles cannot reach it: run /remote-control in the lead once" -f $leadRow.Pid)
}

function Show-ClaudeTeamReport {
    $budget = $script:ClaudeTeamBudget
    $tab = $null
    $paneCount = 0
    $taskList = $null
    $blockedRows = @()
    foreach ($tab in @($script:ClaudeTeamTabs)) {
        $paneCount = $paneCount + $tab.Rows.Count
    }
    Write-Host ""
    $script:ClaudeTeamRows | Format-Table -AutoSize Role, Session, Model, Effort, Tab, Pane, Pid, Cells, State | Out-Host
    $blockedRows = @($script:ClaudeTeamRows | Where-Object { $_.State -in @("stalled", "not-ready") })
    if ($blockedRows.Count -gt 0) {
        Write-ClaudeTeamLog "WARN" ("{0} role(s) cannot take work yet: {1} (a live PID alone does not mean ready)" -f $blockedRows.Count, ((@($blockedRows | ForEach-Object { "{0}:{1}" -f $_.Role, $_.State })) -join ", "))
    }
    Write-ClaudeTeamLog "OK" ("Monitor {0}: {1}x{2} px work area, DPI {3}, cell budget {4}x{5}; {6} tab(s) with {7} pane(s) for the roles started or planned" -f `
        $script:ClaudeTeamMonitor.Index, ($script:ClaudeTeamMonitor.WorkRight - $script:ClaudeTeamMonitor.WorkLeft), ($script:ClaudeTeamMonitor.WorkBottom - $script:ClaudeTeamMonitor.WorkTop), `
        $budget.Dpi, $budget.TotalCols, $budget.TotalRows, @($script:ClaudeTeamTabs).Count, $paneCount)
    Write-ClaudeTeamLog "OK" ("PID files: {0} (<session>.pid)" -f $ClaudeTeamStateDir)
    Write-ClaudeTeamLog "OK" ("Shared project data: {0} (files by path); role memory: {1}" -f (Join-Path $ClaudeTeamRootDir ([string](Get-ClaudeTeamProperty -Object $script:ClaudeTeamCatalog -Name "shared_dir" -Default ""))), (Join-Path (Join-Path $ClaudeTeamRootDir ".claude") "agent-memory"))
    $taskList = (Get-ClaudeTeamSessionEnvironment -Kinds @("all"))[$ClaudeTeamTaskListVariable]
    if (-not [string]::IsNullOrWhiteSpace($taskList)) {
        Write-ClaudeTeamLog "OK" ("Independent-session task list: {0} through {1}" -f $taskList, $ClaudeTeamTaskListVariable)
    }
    Write-ClaudeTeamLog "OK" ("Native agent-team runtime state: {0}, {1}" -f $ClaudeTeamUserTasksDir, $ClaudeTeamUserTeamsDir)
    Write-ClaudeTeamLog "OK" ("Dispatch: type one task in the {0} pane of window {1}" -f (Get-ClaudeTeamLeadSessionName -Mode $script:ClaudeTeamMode), (Get-ClaudeTeamWindowName))
    Write-ClaudeTeamLog "OK" "Git: only version rollback is blocked (reset --hard/<commit>, revert, old-commit checkout/restore, forced push/ref move); allow-rollback grants 120 min, deny-rollback revokes"
    if ($script:ClaudeTeamMode -eq "team") {
        Write-ClaudeTeamLog "OK" "Re-run is idempotent: the live lead is skipped; teammates remain owned by Claude Code"
    } else {
        Write-ClaudeTeamLog "OK" "Re-run is idempotent: roles with a live shell PID or --name session are skipped, missing ones open as new tabs"
    }
}

function Invoke-ClaudeTeamUp {
    param([string]$Mode, [switch]$Status, [switch]$NoWindows, [switch]$NoKickoff, [string[]]$Roles, [switch]$SkipAccountCheck)
    $script:ClaudeTeamMode = $Mode
    $script:ClaudeTeamOptStatus = [bool]$Status
    $script:ClaudeTeamOptNoWindows = [bool]$NoWindows
    $script:ClaudeTeamOptNoKickoff = [bool]$NoKickoff
    $script:ClaudeTeamOptSkipAccount = [bool]$SkipAccountCheck
    $script:ClaudeTeamOptRoles = @($Roles | Where-Object { -not [string]::IsNullOrWhiteSpace($_) })
    $script:ClaudeTeamQuiet = $false

    Write-ClaudeTeamStep -Number 1 -Title "Platform profile"
    Show-ClaudeTeamPlatform
    Write-ClaudeTeamStep -Number 2 -Title "Team setup, item by item (shared Invoke-ClaudeTeamInstall, same as dd.ps1 ClaudeCode callback)"
    Install-ClaudeTeamPrerequisites
    Write-ClaudeTeamStep -Number 3 -Title "Claude Code CLI (shared Invoke-AiCliProvision)"
    Invoke-ClaudeTeamClaudeProvision
    Write-ClaudeTeamStep -Number 4 -Title "Roles (.claude/agents frontmatter) with catalog overrides"
    Import-ClaudeTeamCatalog
    Write-ClaudeTeamStep -Number 5 -Title "Entry command"
    Write-ClaudeTeamLog "OK" ("claudeteamup / claudeagents: {0}" -f $ClaudeTeamWinEnvsDir)
    Write-ClaudeTeamStep -Number 6 -Title "Monitors and cell budget (Per-Monitor-V2 rcWork + DPI)"
    Get-ClaudeTeamDisplay
    Write-ClaudeTeamStep -Number 7 -Title "Role liveness (PID files, Claude session registry)"
    Write-ClaudeTeamLog "OK" ("Checking {0} enabled roles ({1} no-window service roles excluded)" -f @($script:ClaudeTeamRows | Where-Object { $_.Enabled -and $_.Window }).Count, @($script:ClaudeTeamRows | Where-Object { $_.Enabled -and (-not $_.Window) }).Count)
    Write-ClaudeTeamStep -Number 8 -Title ("Layout and panes (mode {0}, window {1})" -f $script:ClaudeTeamMode, (Get-ClaudeTeamWindowName))
    Start-ClaudeTeamRoles
    Write-ClaudeTeamStep -Number 9 -Title "Summary"
    Show-ClaudeTeamReport
}

# ---------------------------------------------------------------------------
# Pane side (claudeteam.ps1 --team-pane <mode> --agent <role> --name <session>)
# ---------------------------------------------------------------------------

# Loads the roles quietly, writes the session PID file first (the launcher
# verifies it), titles the pane and enters the project root. $null when the
# role is not an enabled role of the registry.
function Initialize-ClaudeTeamPane {
    param([string]$Mode, [string]$Role, [bool]$NoKickoff, [string[]]$Roles)
    $row = $null
    $script:ClaudeTeamMode = $Mode
    $script:ClaudeTeamOptNoKickoff = $NoKickoff
    $script:ClaudeTeamOptRoles = @($Roles | Where-Object { -not [string]::IsNullOrWhiteSpace($_) })
    $script:ClaudeTeamQuiet = $true
    Import-ClaudeTeamCatalog
    $script:ClaudeTeamQuiet = $false
    $row = Get-ClaudeTeamRow -Role $Role
    if (($null -eq $row) -or (-not $row.Enabled)) {
        Write-ClaudeTeamLog "WARN" ("Role {0} is not an enabled role of {1}; running without team settings" -f $Role, $script:ClaudeTeamAgentsDir)
        return $null
    }
    if (-not (Test-Path -LiteralPath $ClaudeTeamStateDir)) {
        New-Item -ItemType Directory -Path $ClaudeTeamStateDir -Force | Out-Null
    }
    Set-Content -LiteralPath (Get-ClaudeTeamPidPath -Session $row.Session) -Value $PID -Encoding ascii
    $Host.UI.RawUI.WindowTitle = $row.Session
    Set-Location -LiteralPath $ClaudeTeamRootDir
    return $row
}

# Standalone `claudeteam --agent <role>` (no --team-pane): looks up Role in the
# registry so the session gets that role's env kinds and effort instead of
# always running as the agent-teams lead. Writes no PID file (there is no pane
# to verify). $null when Role is blank or not an enabled registry role, so the
# caller falls back to the plain agent-teams-lead behavior.
function Get-ClaudeTeamStandaloneRow {
    param([string]$Role)
    $row = $null
    if ([string]::IsNullOrWhiteSpace($Role)) {
        return $null
    }
    $script:ClaudeTeamQuiet = $true
    Import-ClaudeTeamCatalog
    $script:ClaudeTeamQuiet = $false
    $row = Get-ClaudeTeamRow -Role $Role
    if (($null -eq $row) -or (-not $row.Enabled)) {
        return $null
    }
    return $row
}

# Applies the session environment before claude starts in the pane: the role
# marker for the project hooks, session_env.all + windows, and session_env.lead
# for the lead only. A non-lead session must not become an agent-teams lead, so
# every key of session_env.lead (not just CLAUDE_CODE_EXPERIMENTAL_AGENT_TEAMS)
# is cleared for it, even one a future catalog edit adds. $null Row = standalone
# claudeteam with no resolved role, which always runs as a lead.
function Set-ClaudeTeamSessionEnvironment {
    param($Row)
    $kinds = @("all", "windows", "lead")
    $environment = $null
    $leadEnvironment = $null
    $key = $null
    [Environment]::SetEnvironmentVariable($ClaudeTeamSessionMarkerVariable, "1", "Process")
    if (($null -ne $Row) -and (-not $Row.IsLead)) {
        $kinds = Get-ClaudeTeamRoleEnvironmentKinds -Row $Row
        $leadEnvironment = Get-ClaudeTeamSessionEnvironment -Kinds @("lead")
        foreach ($key in $leadEnvironment.Keys) {
            [Environment]::SetEnvironmentVariable($key, $null, "Process")
        }
    }
    $environment = Get-ClaudeTeamSessionEnvironment -Kinds $kinds
    foreach ($key in $environment.Keys) {
        [Environment]::SetEnvironmentVariable($key, $environment[$key], "Process")
    }
    return $environment
}

# Remote role pane: resolves the ssh target from the secret store (never printed)
# and keeps an ssh -t connection to the server's tmux session, reconnecting every
# remote.reconnect_seconds.
function Invoke-ClaudeTeamRemoteLoop {
    param($Row)
    $remote = Get-ClaudeTeamRemoteConfig -Role $Row.Role
    $reconnectSeconds = [int](Get-ClaudeTeamProperty -Object (Get-ClaudeTeamProperty -Object $script:ClaudeTeamCatalog -Name "remote" -Default $null) -Name "reconnect_seconds" -Default 5)
    $nodePath = Resolve-ClaudeTeamInstallCommand -Names @("node.exe")
    $sshPath = Resolve-ClaudeTeamInstallCommand -Names @("ssh.exe")
    $sshTarget = $null
    $remoteArgument = $null
    if (-not $nodePath) {
        Write-ClaudeTeamLog "ERROR" "node.exe not found; the ssh target cannot be read from the secret store"
        return
    }
    if (-not $sshPath) {
        Write-ClaudeTeamLog "ERROR" "ssh.exe not found (Windows OpenSSH client)"
        return
    }
    $sshTarget = (& $nodePath $ClaudeTeamSecretReader read ([string]$remote.ssh_secret)) | Select-Object -Last 1
    if ([string]::IsNullOrWhiteSpace($sshTarget)) {
        Write-ClaudeTeamLog "ERROR" ("secret {0} is empty or unreadable" -f [string]$remote.ssh_secret)
        return
    }
    $remoteArgument = ConvertTo-ClaudeTeamNativeArgument -Text (Get-ClaudeTeamRemoteArgument -Row $Row -Remote $remote)
    while ($true) {
        & $sshPath @ClaudeTeamSshOptions $sshTarget $remoteArgument
        Write-Host ("[remote] {0} disconnected; reconnecting in {1}s (Ctrl-C to stop)" -f $Row.Session, $reconnectSeconds)
        Start-Sleep -Seconds $reconnectSeconds
    }
}
