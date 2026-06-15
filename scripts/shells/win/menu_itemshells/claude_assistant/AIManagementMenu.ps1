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
$script:AI_ACTIONS_PS1 = Join-Path $script:PS_CURRENT_DIR "AIManagementActions.ps1"
$script:COLOR_SUCCESS = "Green"
$script:COLOR_WARNING = "Yellow"
$script:COLOR_ERROR = "Red"
$script:COLOR_INFO = "White"
$script:COLOR_HIGHLIGHT = "Cyan"
#endregion

#region Imports
# All AI Management actions live in AIManagementActions.ps1 so the unified
# AI & MCP menu can reuse them without duplicating the wizard.
if (-not (Test-Path -LiteralPath $script:AI_ACTIONS_PS1)) {
    Write-Host "[X] AIManagementActions.ps1 not found." -ForegroundColor $script:COLOR_ERROR
    exit 1
}
. $script:AI_ACTIONS_PS1
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
