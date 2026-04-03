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

<#
.SYNOPSIS
    AI Management: Claude Code Agent Teams and settings helpers for dd.cmd.
#>

#region Variable Declarations
$script:PS_CURRENT_DIR = $PSScriptRoot
$script:CLAUDE_ENV_PS1 = Join-Path $script:PS_CURRENT_DIR "ClaudeAssistantEnv.ps1"
$script:COLOR_SUCCESS = "Green"
$script:COLOR_WARNING = "Yellow"
$script:COLOR_ERROR = "Red"
$script:COLOR_INFO = "White"
$script:COLOR_HIGHLIGHT = "Cyan"
#endregion

#region Imports
if (-not (Test-Path -LiteralPath $script:CLAUDE_ENV_PS1)) {
    Write-Host "[X] ClaudeAssistantEnv.ps1 not found." -ForegroundColor $script:COLOR_ERROR
    exit 1
}
. $script:CLAUDE_ENV_PS1
#endregion

#region UI
function Write-AIMessage {
    param(
        [Parameter(Mandatory = $true)] [string]$Message,
        [Parameter()] [string]$Type = "Info"
    )
    $color = $script:COLOR_INFO
    $prefix = "[*] "
    if ($Type -eq "Success") { $color = $script:COLOR_SUCCESS; $prefix = "[+] " }
    elseif ($Type -eq "Warning") { $color = $script:COLOR_WARNING; $prefix = "[!] " }
    elseif ($Type -eq "Error") { $color = $script:COLOR_ERROR; $prefix = "[X] " }
    Write-Host -ForegroundColor $color "$prefix$Message"
}
#endregion

#region Inline Selector
function Read-InlineChoice {
    <#
    .SYNOPSIS
        Show a numbered list and return the selected value. Returns $null on invalid input.
    #>
    param(
        [Parameter(Mandatory = $true)] [string]$Prompt,
        [Parameter(Mandatory = $true)] [string[]]$Options,
        [Parameter()] [int]$Default = 0
    )
    Write-Host ""
    Write-Host $Prompt -ForegroundColor $script:COLOR_HIGHLIGHT
    for ($i = 0; $i -lt $Options.Count; $i++) {
        $marker = if ($i -eq $Default) { " (default)" } else { "" }
        Write-Host "  [$($i + 1)] $($Options[$i])$marker"
    }
    $raw = Read-Host "Choose [1-$($Options.Count)]"
    if ([string]::IsNullOrWhiteSpace($raw)) {
        return $Default
    }
    $parsed = 0
    if ([int]::TryParse($raw.Trim(), [ref]$parsed) -and $parsed -ge 1 -and $parsed -le $Options.Count) {
        return ($parsed - 1)
    }
    return $Default
}
#endregion

#region Actions
function Invoke-OneClickSetupWizard {
    <#
    .SYNOPSIS
        Guided one-click wizard: environment check -> runtime choice -> teammateMode -> merge all settings.
    #>

    # Step 1: Environment scan
    Write-Host ""
    Write-AIMessage -Message "Step 1/4: Environment scan" -Type "Info"
    Show-ClaudeAssistantEnvironmentReport

    # Step 2: Runtime selection (Windows native vs WSL)
    $runtimeOptions = @("Windows native (Git Bash) - default, no WSL needed", "WSL (Linux subsystem)")
    $wslAvailable = Test-WslAvailable
    $runtimeDefault = 0
    if (-not $wslAvailable) {
        Write-AIMessage -Message "WSL not detected. Using Windows native mode." -Type "Info"
        $runtimeIdx = 0
    }
    else {
        $runtimeIdx = Read-InlineChoice -Prompt "Step 2/4: Runtime environment" -Options $runtimeOptions -Default $runtimeDefault
    }
    $useWsl = ($runtimeIdx -eq 1)

    # Step 3: teammateMode selection
    $modeOptions = @("in-process (run in main terminal, Shift+Down to cycle)", "tmux (split-pane UI, requires tmux)", "auto (tmux if available, otherwise in-process)")
    $modeDefault = 0
    if ($useWsl) {
        $hasTmux = Test-TmuxInDefaultWsl
        if ($hasTmux) {
            $modeDefault = 1
        }
    }
    elseif (-not [string]::IsNullOrEmpty($env:TMUX)) {
        $modeDefault = 1
    }
    $modeIdx = Read-InlineChoice -Prompt "Step 3/4: teammateMode" -Options $modeOptions -Default $modeDefault
    $modeValues = @("in-process", "tmux", "auto")
    $mode = $modeValues[$modeIdx]

    # If WSL + tmux chosen but tmux not installed, offer to install
    if ($useWsl -and ($mode -eq "tmux" -or $mode -eq "auto")) {
        if (-not (Test-TmuxInDefaultWsl)) {
            Write-AIMessage -Message "tmux not found in WSL." -Type "Warning"
            $installChoice = Read-Host "Install tmux in WSL now? (Y/n)"
            if ($installChoice -ne "n") {
                Write-AIMessage -Message "Running: sudo apt-get update && sudo apt-get install -y tmux ..." -Type "Info"
                $bashCmd = "sudo apt-get update -y && sudo apt-get install -y tmux"
                & wsl -e bash -lc $bashCmd
                if (Test-TmuxInDefaultWsl) {
                    Write-AIMessage -Message "tmux installed successfully." -Type "Success"
                }
                else {
                    Write-AIMessage -Message "tmux install may have failed. Falling back to in-process." -Type "Warning"
                    $mode = "in-process"
                }
            }
        }
    }

    # Step 4: Apply all settings
    Write-Host ""
    Write-AIMessage -Message "Step 4/4: Applying settings (Agent Teams env + teammateMode='$mode') ..." -Type "Info"
    $userPath = Get-ClaudeUserSettingsJsonPath
    $globalPath = Get-ClaudeGlobalJsonPath
    $exitCode = Invoke-ClaudeJsonMerge -Arguments @(
        "merge-full",
        "--user-settings-path", $userPath,
        "--claude-json-path", $globalPath,
        "--teammate-mode", $mode
    )
    if ($exitCode -ne 0) {
        Write-AIMessage -Message "Setup failed (exit $exitCode)." -Type "Error"
    }
    else {
        Write-Host ""
        Write-AIMessage -Message "All done! Restart Claude Code sessions to pick up changes." -Type "Success"
        Write-AIMessage -Message "  Settings: $userPath" -Type "Info"
        Write-AIMessage -Message "  Config:   $globalPath" -Type "Info"
        Write-AIMessage -Message "  Mode:     $mode" -Type "Info"
        if ($useWsl) {
            Write-AIMessage -Message "  Runtime:  WSL" -Type "Info"
        }
        else {
            Write-AIMessage -Message "  Runtime:  Windows native (Git Bash)" -Type "Info"
        }
    }

    # Optional: also merge project settings
    Write-Host ""
    $projChoice = Read-Host "Also apply Agent Teams to a project folder? (y/N)"
    if ($projChoice -eq "y") {
        $def = (Get-Location).Path
        $line = Read-Host "Project root [$def]"
        $proj = if ([string]::IsNullOrWhiteSpace($line)) { $def } else { $line.Trim() }
        if (Test-Path -LiteralPath $proj) {
            $pExit = Invoke-ClaudeJsonMerge -Arguments @("merge-project", "--project-dir", $proj)
            if ($pExit -eq 0) {
                Write-AIMessage -Message "Project settings merged: $proj" -Type "Success"
            }
            else {
                Write-AIMessage -Message "Project merge failed." -Type "Error"
            }
        }
        else {
            Write-AIMessage -Message "Path not found: $proj" -Type "Error"
        }
    }

    Write-Host ""
    Write-Host "Press any key..." -ForegroundColor $script:COLOR_HIGHLIGHT
    $null = $Host.UI.RawUI.ReadKey("NoEcho,IncludeKeyDown")
}

function Invoke-EnvironmentDiagnostics {
    Show-ClaudeAssistantEnvironmentReport
    Write-Host "Press any key..." -ForegroundColor $script:COLOR_HIGHLIGHT
    $null = $Host.UI.RawUI.ReadKey("NoEcho,IncludeKeyDown")
}

function Invoke-OpenAgentTeamsDocumentation {
    try {
        Start-AgentTeamsDocumentationInBrowser
        Write-AIMessage -Message "Opened Agent Teams documentation in the default browser." -Type "Success"
    }
    catch {
        Write-AIMessage -Message "Could not open browser: $_" -Type "Warning"
    }
    Write-Host "Press any key..." -ForegroundColor $script:COLOR_HIGHLIGHT
    $null = $Host.UI.RawUI.ReadKey("NoEcho,IncludeKeyDown")
}
#endregion

#region Menu
function Show-AIManagementMenu {
    $menuItems = @(
        @{ Text = "-- AI Management (Claude Code) --------"; Action = { }; IsHeader = $true },
        @{ Text = "  One-click Setup (guided wizard)"; Action = { Invoke-OneClickSetupWizard }; IsHeader = $false },
        @{ Text = "  Environment diagnostics"; Action = { Invoke-EnvironmentDiagnostics }; IsHeader = $false },
        @{ Text = "  Open Agent Teams docs (browser)"; Action = { Invoke-OpenAgentTeamsDocumentation }; IsHeader = $false },
        @{ Text = "----------------------------------------"; Action = { }; IsHeader = $true },
        @{ Text = "Back to main menu"; Action = { return $true }; IsHeader = $false },
        @{ Text = "Exit"; Action = { exit }; IsHeader = $false }
    )

    $selectedIndex = 1
    while ($true) {
        Clear-Host
        Write-AIMessage -Message "========================================" -Type "Info"
        Write-AIMessage -Message "       AI Management" -Type "Info"
        Write-AIMessage -Message "========================================" -Type "Info"

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

        Write-AIMessage -Message "========================================" -Type "Info"
        Write-Host "Arrow keys: move | Enter: select" -ForegroundColor $script:COLOR_HIGHLIGHT

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
                    $result = & $menuItems[$selectedIndex].Action
                    if ($result -eq $true) { return }
                }
            }
        }
    }
}
#endregion

#region Main
Show-AIManagementMenu
#endregion
