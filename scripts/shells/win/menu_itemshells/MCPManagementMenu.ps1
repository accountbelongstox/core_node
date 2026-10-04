<#
.SYNOPSIS
    AI Tools & MCP Menu (Windows), parity with the Linux "AI Tools & MCP"
    menu (scripts/shells/linux/menu_itemshells/menu_func/ai_mcp_management_menu.sh).
.DESCRIPTION
    Same core item set as Linux: Ensure ALL AI tools (one click) / install or
    upgrade one AI tool / status table / shared-login setup / mcp-chrome
    (build+service, status, restart, logs) / sync the chrome MCP entry to
    every installed AI tool. Every AI-tool item below calls
    install_powershells/Step65_InstallAiTools.ps1 or win_common/AiToolsCatalog.ps1
    (single source of truth; no duplicated logic here). The pre-existing
    "AI Management" (Claude Code Agent Teams) wizard and the extra MCP
    install/sync entries (per-tool sync, Install-All) are kept below
    as Windows-only sections, since Linux keeps an analogous extra
    "API keys / env setup" section rather than dropping functionality.
    Output is streamed in real time; no exit code detection.
#>

#region Variable Declarations
$script:PS_CURRENT_DIR = $PSScriptRoot
$script:WIN_DIR = Split-Path $script:PS_CURRENT_DIR -Parent
$script:SHELLS_DIR = Split-Path $script:WIN_DIR -Parent
$script:SCRIPT_DIR = Split-Path $script:SHELLS_DIR -Parent
$script:CORE_NODE_DIR = Split-Path $script:SCRIPT_DIR -Parent
$script:CHROME_MCP_START_PS1 = Join-Path $script:CORE_NODE_DIR "apps\mcp-chrome\scripts\start.ps1"
$script:INSTALL_ALL_MCP_PS1 = Join-Path $script:PS_CURRENT_DIR "InstallAllMCPServices.ps1"
$script:AI_PS1TOOLS_DIR = Join-Path $script:CORE_NODE_DIR "scripts\ai_ps1tools"
$script:WIN_COMMON_DIR = Join-Path $script:WIN_DIR "win_common"
$script:GLOBALVARS_PS1 = Join-Path $script:WIN_COMMON_DIR "GlobalVars.ps1"
$script:AI_TOOLS_CATALOG_PS1 = Join-Path $script:WIN_COMMON_DIR "AiToolsCatalog.ps1"
$script:SERVICE_CONTRACT_PS1 = Join-Path $script:WIN_COMMON_DIR "ServiceContract.ps1"
$script:STARTUP_MANAGER_PS1 = Join-Path $script:WIN_COMMON_DIR "StartupManager.ps1"
$script:INSTALL_AI_TOOLS_PS1 = Join-Path (Join-Path $script:WIN_DIR "install_powershells") "Step65_InstallAiTools.ps1"
$script:MCP_STATUS_PS1 = Join-Path $script:CORE_NODE_DIR "scripts\ai_ps1tools\mcp_status.ps1"
$script:AI_ACTIONS_PS1 = Join-Path $script:PS_CURRENT_DIR "claude_assistant\AIManagementActions.ps1"
$script:AI_ACTIONS_AVAILABLE = $false
$script:MCP_CHROME_TASK_NAME = $null

$script:SYNC_SCRIPTS = @(
    "claude_sync_mcp_servers.ps1",
    "cursor_sync_mcp_servers.ps1",
    "codex_sync_mcp_servers.ps1",
    "gemini_sync_mcp_servers.ps1",
    "droid_sync_mcp_servers.ps1",
    "windsurf_sync_mcp_servers.ps1",
    "devin_sync_mcp_servers.ps1",
    "vscode_sync_mcp_servers.ps1"
)

$script:COLOR_SUCCESS = "Green"
$script:COLOR_WARNING = "Yellow"
$script:COLOR_ERROR = "Red"
$script:COLOR_INFO = "White"
$script:COLOR_HIGHLIGHT = "Cyan"
#endregion

#region Load Modules
if (Test-Path -LiteralPath $script:MCP_STATUS_PS1) {
    . $script:MCP_STATUS_PS1
} else {
    Write-Host "[WARNING] mcp_status.ps1 not found: $script:MCP_STATUS_PS1" -ForegroundColor Yellow
}
if (Test-Path -LiteralPath $script:AI_ACTIONS_PS1) {
    . $script:AI_ACTIONS_PS1
    $script:AI_ACTIONS_AVAILABLE = $true
} else {
    Write-Host "[WARNING] AIManagementActions.ps1 not found: $script:AI_ACTIONS_PS1" -ForegroundColor Yellow
}
if (Test-Path -LiteralPath $script:AI_TOOLS_CATALOG_PS1) {
    . $script:AI_TOOLS_CATALOG_PS1
} else {
    Write-Host "[WARNING] AiToolsCatalog.ps1 not found: $script:AI_TOOLS_CATALOG_PS1" -ForegroundColor Yellow
}
#endregion

#region Helper Functions
function Invoke-AIAction {
    param([Parameter(Mandatory=$true)] [scriptblock]$Action)
    if (-not $script:AI_ACTIONS_AVAILABLE) {
        Write-Host "[ERROR] AI Management actions unavailable (ClaudeAssistantEnv/AIManagementActions missing)." -ForegroundColor Red
        Write-Host "Press any key to return to menu..." -ForegroundColor Cyan
        $null = $Host.UI.RawUI.ReadKey("NoEcho,IncludeKeyDown")
        return
    }
    & $Action
}

function Invoke-ShowPlannedServers {
    if (Get-Command Show-MCPPlannedServers -ErrorAction SilentlyContinue) {
        Show-MCPPlannedServers
    } else {
        Write-Host "[ERROR] Status module not loaded; cannot show planned servers." -ForegroundColor Red
    }
    Write-Host ""
    Write-Host "Press any key to return to menu..." -ForegroundColor Cyan
    $null = $Host.UI.RawUI.ReadKey("NoEcho,IncludeKeyDown")
}

function Invoke-RefreshStatus {
    if (Get-Command Initialize-MCPStatusPanel -ErrorAction SilentlyContinue) {
        Write-Host "[INFO] Re-detecting AI tools and reading existing MCP servers..." -ForegroundColor Cyan
        Initialize-MCPStatusPanel
        Write-Host "[INFO] Detection refreshed." -ForegroundColor Green
    } else {
        Write-Host "[ERROR] Status module not loaded; cannot refresh." -ForegroundColor Red
    }
    Start-Sleep -Milliseconds 600
}

function Get-DDPythonExePathForChrome {
    if (-not (Test-Path -LiteralPath $script:GLOBALVARS_PS1)) { return $null }
    try {
        . $script:GLOBALVARS_PS1
        if ($Global:PYTHON_EXE_PATH -and (Test-Path -LiteralPath $Global:PYTHON_EXE_PATH)) {
            return $Global:PYTHON_EXE_PATH
        }
    } catch { }
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

function Wait-MCPMenuKey {
    Write-Host ""
    Write-Host "Press any key to return to menu..." -ForegroundColor $script:COLOR_HIGHLIGHT
    $null = $Host.UI.RawUI.ReadKey("NoEcho,IncludeKeyDown")
}

function Invoke-SyncToAllAITools {
    Write-Host ""
    Write-Host "========================================" -ForegroundColor $script:COLOR_HIGHLIGHT
    Write-ColorMessage -Message "Syncing MCP config to all AI tools..." -Type "Info"
    Write-Host "========================================" -ForegroundColor $script:COLOR_HIGHLIGHT
    if (-not (Test-Path -LiteralPath $script:AI_PS1TOOLS_DIR)) {
        Write-ColorMessage -Message "ai_ps1tools directory not found: $script:AI_PS1TOOLS_DIR" -Type "Error"
        return
    }
    foreach ($syncScript in $script:SYNC_SCRIPTS) {
        $scriptPath = Join-Path $script:AI_PS1TOOLS_DIR $syncScript
        if (-not (Test-Path -LiteralPath $scriptPath)) {
            Write-ColorMessage -Message "Sync script not found, skipping: $syncScript" -Type "Warning"
            continue
        }
        Write-ColorMessage -Message "Running: $syncScript" -Type "Info"
        & $scriptPath
        Write-ColorMessage -Message "Finished: $syncScript" -Type "Info"
        Write-Host ""
    }
    Write-Host "========================================" -ForegroundColor $script:COLOR_HIGHLIGHT
    Write-ColorMessage -Message "Chrome MCP sync complete." -Type "Success"
    Write-Host "========================================" -ForegroundColor $script:COLOR_HIGHLIGHT
}

function Invoke-SyncToSingleTool {
    param(
        [Parameter(Mandatory=$true)] [string]$ToolName
    )
    $scriptFileName = "${ToolName}_sync_mcp_servers.ps1"
    $scriptPath = Join-Path $script:AI_PS1TOOLS_DIR $scriptFileName
    if (-not (Test-Path -LiteralPath $scriptPath)) {
        Write-ColorMessage -Message "Sync script not found: $scriptPath" -Type "Error"
        Wait-MCPMenuKey
        return
    }
    Write-ColorMessage -Message "Syncing MCP config to $ToolName..." -Type "Info"
    & $scriptPath
    Write-Host ""
    Write-ColorMessage -Message "$ToolName sync complete." -Type "Success"
    Wait-MCPMenuKey
}

function Invoke-ChromeMCPBuild {
    if (-not (Test-Path -LiteralPath $script:CHROME_MCP_START_PS1)) {
        Write-ColorMessage -Message "Chrome MCP start script not found: $script:CHROME_MCP_START_PS1" -Type "Error"
        return
    }
    Write-ColorMessage -Message "Running Chrome MCP install/setup (all output below is real-time)..." -Type "Info"
    Write-Host ""
    [void](Get-DDPythonExePathForChrome)
    . (Join-Path $script:WIN_COMMON_DIR "McpChromeBuildCommon.ps1")
    # An explicit menu action always rebuilds, even after an earlier build in this session.
    [void](Invoke-McpChromeBuild -Force)
    Write-Host ""
    Write-ColorMessage -Message "Chrome MCP install finished. Now syncing to all AI tools..." -Type "Info"
    Invoke-SyncToAllAITools
}

function Invoke-InstallAllMCPServices {
    if (-not (Test-Path -LiteralPath $script:INSTALL_ALL_MCP_PS1)) {
        Write-ColorMessage -Message "Install All script not found: $script:INSTALL_ALL_MCP_PS1" -Type "Error"
        Wait-MCPMenuKey
        return
    }
    Write-ColorMessage -Message "Running Install All MCP Services (Chrome + built-in + sync)..." -Type "Info"
    & $script:INSTALL_ALL_MCP_PS1
    Wait-MCPMenuKey
}

function Invoke-SyncAllOnly {
    Invoke-SyncToAllAITools
    Wait-MCPMenuKey
}

# --- AI Tools (Step65_InstallAiTools.ps1 / AiToolsCatalog.ps1) --------------
function Invoke-EnsureAllAiTools {
    if (-not (Test-Path -LiteralPath $script:INSTALL_AI_TOOLS_PS1)) {
        Write-ColorMessage -Message "Step65_InstallAiTools.ps1 not found: $script:INSTALL_AI_TOOLS_PS1" -Type "Error"
        Wait-MCPMenuKey
        return
    }
    Write-ColorMessage -Message "Ensuring every AI tool + mcp-chrome (idempotent; installed tools are skipped)..." -Type "Info"
    & $script:INSTALL_AI_TOOLS_PS1
    Wait-MCPMenuKey
}

function Show-AiToolsStatusTable {
    if (-not (Test-Path -LiteralPath $script:INSTALL_AI_TOOLS_PS1)) {
        Write-ColorMessage -Message "Step65_InstallAiTools.ps1 not found: $script:INSTALL_AI_TOOLS_PS1" -Type "Error"
        Wait-MCPMenuKey
        return
    }
    & $script:INSTALL_AI_TOOLS_PS1 -Status
    Wait-MCPMenuKey
}

function Invoke-AiToolsSharedLoginSetup {
    if (-not (Get-Command Initialize-AiToolSharedLogin -ErrorAction SilentlyContinue)) {
        Write-ColorMessage -Message "AiToolsCatalog.ps1 not loaded; cannot configure shared login." -Type "Error"
        Wait-MCPMenuKey
        return
    }
    Write-ColorMessage -Message "Configuring shared login (Machine-scope config-dir env vars for shareable AI CLIs)..." -Type "Info"
    Initialize-AiToolSharedLogin | Out-Null
    Write-Host ""
    Show-AiToolSharedLoginStatus
    Wait-MCPMenuKey
}

function Show-AiToolPerToolMenu {
    $keys = @(Get-AiToolKeys)
    $selected = 0
    $total = $keys.Count

    while ($true) {
        Clear-Host
        Write-ColorMessage -Message "== Per-tool AI CLI install / upgrade ======================" -Type "Info"
        for ($i = 0; $i -lt $total; $i++) {
            $tool = Get-AiTool -Key $keys[$i]
            $label = "$($keys[$i])  ($($tool.Name))$(if (-not $tool.Supported) { ' [unsupported on Windows]' })"
            if ($i -eq $selected) {
                Write-Host -NoNewline "  > " -ForegroundColor $script:COLOR_HIGHLIGHT
                Write-Host $label -ForegroundColor Black -BackgroundColor White
            } else {
                Write-Host "    $label"
            }
        }
        if ($selected -eq $total) {
            Write-Host -NoNewline "  > " -ForegroundColor $script:COLOR_HIGHLIGHT
            Write-Host "Back" -ForegroundColor Black -BackgroundColor White
        } else {
            Write-Host "    Back"
        }
        Write-Host "Use Up/Down arrows to navigate, Enter to select" -ForegroundColor $script:COLOR_HIGHLIGHT

        $key = $Host.UI.RawUI.ReadKey("NoEcho,IncludeKeyDown")
        switch ($key.VirtualKeyCode) {
            38 { $selected--; if ($selected -lt 0) { $selected = $total } }
            40 { $selected++; if ($selected -gt $total) { $selected = 0 } }
            13 {
                if ($selected -eq $total) { return }
                Clear-Host
                & $script:INSTALL_AI_TOOLS_PS1 -Only $keys[$selected]
                Wait-MCPMenuKey
            }
        }
    }
}

# --- mcp-chrome (ncore-mcp-chrome logon task) submenu -----------------------
function Get-McpChromeTaskName {
    if ($script:MCP_CHROME_TASK_NAME) { return $script:MCP_CHROME_TASK_NAME }
    if ((Test-Path -LiteralPath $script:SERVICE_CONTRACT_PS1) -and (Test-Path -LiteralPath $script:STARTUP_MANAGER_PS1)) {
        try {
            . $script:SERVICE_CONTRACT_PS1
            . $script:STARTUP_MANAGER_PS1
            $script:MCP_CHROME_TASK_NAME = Get-ServiceContractValue -ContractPath "mcp_chrome.windows_task_name"
        } catch { }
    }
    return $script:MCP_CHROME_TASK_NAME
}

function Show-McpChromeStatus {
    $taskName = Get-McpChromeTaskName
    if (-not $taskName) {
        Write-ColorMessage -Message "Could not resolve the mcp-chrome logon task name (ServiceContract.ps1 / StartupManager.ps1 missing?)." -Type "Error"
        return
    }
    $task = Get-ScheduledTask -TaskName $taskName -ErrorAction SilentlyContinue
    if (-not $task) {
        Write-ColorMessage -Message "Logon task '$taskName' is not installed. Use 'Build + install service' first." -Type "Warning"
        return
    }
    $info = Get-ScheduledTaskInfo -TaskName $taskName -ErrorAction SilentlyContinue
    Write-ColorMessage -Message "Task: $taskName" -Type "Info"
    Write-ColorMessage -Message "State: $($task.State)" -Type "Info"
    if ($info) {
        Write-ColorMessage -Message "Last run: $($info.LastRunTime)  (result: $($info.LastTaskResult))" -Type "Info"
        Write-ColorMessage -Message "Next run: $($info.NextRunTime)" -Type "Info"
    }
}

function Restart-McpChromeTask {
    $taskName = Get-McpChromeTaskName
    if (-not $taskName) {
        Write-ColorMessage -Message "Could not resolve the mcp-chrome logon task name." -Type "Error"
        return
    }
    if (-not (Get-ScheduledTask -TaskName $taskName -ErrorAction SilentlyContinue)) {
        Write-ColorMessage -Message "Logon task '$taskName' is not installed. Use 'Build + install service' first." -Type "Warning"
        return
    }
    Write-ColorMessage -Message "Restarting logon task '$taskName'..." -Type "Info"
    Stop-ScheduledTask -TaskName $taskName -ErrorAction SilentlyContinue
    Start-Sleep -Seconds 1
    Start-ScheduledTask -TaskName $taskName
    Write-ColorMessage -Message "Restarted." -Type "Success"
}

function Show-McpChromeLogs {
    # Windows Task Scheduler has no journalctl-style log stream for a plain
    # logon task: this is a known gap versus the Linux systemd unit. Point at
    # the two places that do carry information instead of fabricating a log
    # file that does not exist.
    $taskName = Get-McpChromeTaskName
    Write-ColorMessage -Message "No centralized log file for the '$taskName' logon task yet (gap vs. Linux's journalctl -u ncore-mcp-chrome)." -Type "Warning"
    Write-ColorMessage -Message "Options: Task Scheduler > Task Scheduler Library > $taskName > History tab; or run 'apps\mcp-chrome\scripts\start.ps1' directly in a console for live output." -Type "Info"
}

function Show-McpChromeSubmenu {
    $items = @(
        @{ Text = "Build + install as the ncore-mcp-chrome logon task"; Action = { Invoke-ChromeMCPBuild } },
        @{ Text = "Service status (Get-ScheduledTask)"; Action = { Show-McpChromeStatus } },
        @{ Text = "Restart service"; Action = { Restart-McpChromeTask } },
        @{ Text = "Logs"; Action = { Show-McpChromeLogs } },
        @{ Text = "Back"; Action = $null }
    )
    $selected = 0
    $total = $items.Count

    while ($true) {
        Clear-Host
        Write-ColorMessage -Message "== mcp-chrome =============================================" -Type "Info"
        for ($i = 0; $i -lt $total; $i++) {
            if ($i -eq $selected) {
                Write-Host -NoNewline "  > " -ForegroundColor $script:COLOR_HIGHLIGHT
                Write-Host $items[$i].Text -ForegroundColor Black -BackgroundColor White
            } else {
                Write-Host "    $($items[$i].Text)"
            }
        }
        Write-Host "Use Up/Down arrows to navigate, Enter to select" -ForegroundColor $script:COLOR_HIGHLIGHT

        $key = $Host.UI.RawUI.ReadKey("NoEcho,IncludeKeyDown")
        switch ($key.VirtualKeyCode) {
            38 { $selected--; if ($selected -lt 0) { $selected = $total - 1 } }
            40 { $selected++; if ($selected -ge $total) { $selected = 0 } }
            13 {
                if ($items[$selected].Text -eq "Back") { return }
                Clear-Host
                & $items[$selected].Action
                Wait-MCPMenuKey
            }
        }
    }
}
#endregion

#region Menu System
function Show-MCPMenu {
    $menuItems = @(
        @{ Text = "== AI Tools =============================================="; Action = { }; IsHeader = $true },
        @{ Text = "  Ensure ALL AI tools (one click)"; Action = { Invoke-EnsureAllAiTools }; IsHeader = $false },
        @{ Text = "  Install / upgrade one AI tool"; Action = { Show-AiToolPerToolMenu }; IsHeader = $false },
        @{ Text = "  Status table (installed, version, linked, login shared)"; Action = { Show-AiToolsStatusTable }; IsHeader = $false },
        @{ Text = "  Shared-login setup (config-dir env vars for shareable CLIs)"; Action = { Invoke-AiToolsSharedLoginSetup }; IsHeader = $false },
        @{ Text = "== mcp-chrome (only MCP server) ========================="; Action = { }; IsHeader = $true },
        @{ Text = "  Build + install service / status / restart / logs"; Action = { Show-McpChromeSubmenu }; IsHeader = $false },
        @{ Text = "  Sync chrome MCP to all installed AI tools"; Action = { Invoke-SyncAllOnly }; IsHeader = $false },
        @{ Text = "== AI Management (Claude Code Agent Teams) =============="; Action = { }; IsHeader = $true },
        @{ Text = "  One-click Setup (guided wizard)"; Action = { Invoke-AIAction -Action { Invoke-OneClickSetupWizard } }; IsHeader = $false },
        @{ Text = "  Environment diagnostics"; Action = { Invoke-AIAction -Action { Invoke-EnvironmentDiagnostics } }; IsHeader = $false },
        @{ Text = "  Open Agent Teams docs (browser)"; Action = { Invoke-AIAction -Action { Invoke-OpenAgentTeamsDocumentation } }; IsHeader = $false },
        @{ Text = "== MCP: extra install / sync ============================"; Action = { }; IsHeader = $true },
        @{ Text = "  Install All MCP + Sync to All AI Tools"; Action = { Invoke-InstallAllMCPServices }; IsHeader = $false },
        @{ Text = "  Sync to Claude"; Action = { Invoke-SyncToSingleTool -ToolName "claude" }; IsHeader = $false },
        @{ Text = "  Sync to Cursor (+ Cursor Agent)"; Action = { Invoke-SyncToSingleTool -ToolName "cursor" }; IsHeader = $false },
        @{ Text = "  Sync to Codex"; Action = { Invoke-SyncToSingleTool -ToolName "codex" }; IsHeader = $false },
        @{ Text = "  Sync to Gemini"; Action = { Invoke-SyncToSingleTool -ToolName "gemini" }; IsHeader = $false },
        @{ Text = "  Sync to Droid"; Action = { Invoke-SyncToSingleTool -ToolName "droid" }; IsHeader = $false },
        @{ Text = "  Sync to Windsurf"; Action = { Invoke-SyncToSingleTool -ToolName "windsurf" }; IsHeader = $false },
        @{ Text = "  Sync to Devin"; Action = { Invoke-SyncToSingleTool -ToolName "devin" }; IsHeader = $false },
        @{ Text = "  Sync to VS Code"; Action = { Invoke-SyncToSingleTool -ToolName "vscode" }; IsHeader = $false },
        @{ Text = "========================================================"; Action = { }; IsHeader = $true },
        @{ Text = "Back to main menu"; Action = { return $true }; IsHeader = $false },
        @{ Text = "Exit"; Action = { exit }; IsHeader = $false }
    )

    $selectedIndex = 1
    while ($true) {
        Clear-Host
        Write-ColorMessage -Message "========================================================" -Type "Info"
        Write-ColorMessage -Message "       AI Tools & MCP" -Type "Info"
        Write-ColorMessage -Message "========================================================" -Type "Info"
        Show-MCPStatusPanel

        for ($i = 0; $i -lt $menuItems.Count; $i++) {
            if ($menuItems[$i].IsHeader -eq $true) {
                Write-Host $menuItems[$i].Text -ForegroundColor DarkGray
            }
            elseif ($i -eq $selectedIndex) {
                Write-Host -NoNewline "  > " -ForegroundColor $script:COLOR_HIGHLIGHT
                Write-Host $menuItems[$i].Text -ForegroundColor Black -BackgroundColor White
            }
            else {
                Write-Host "    $($menuItems[$i].Text)"
            }
        }

        Write-ColorMessage -Message "========================================" -Type "Info"
        Write-Host "Use arrow keys to navigate, Enter to select" -ForegroundColor $script:COLOR_HIGHLIGHT

        $key = $Host.UI.RawUI.ReadKey("NoEcho,IncludeKeyDown")
        switch ($key.VirtualKeyCode) {
            38 {
                do {
                    $selectedIndex--
                    if ($selectedIndex -lt 0) { $selectedIndex = $menuItems.Count - 1 }
                } while ($menuItems[$selectedIndex].IsHeader -eq $true)
            }
            40 {
                do {
                    $selectedIndex++
                    if ($selectedIndex -ge $menuItems.Count) { $selectedIndex = 0 }
                } while ($menuItems[$selectedIndex].IsHeader -eq $true)
            }
            13 {
                if ($menuItems[$selectedIndex].IsHeader -ne $true) {
                    if ($menuItems[$selectedIndex].Text -eq 'Back to main menu') { return }
                    & $menuItems[$selectedIndex].Action | Out-Host
                }
            }
        }
    }
}
#endregion

#region Main Execution
Show-MCPMenu
#endregion
