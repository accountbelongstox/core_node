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
    MCP Management Menu
.DESCRIPTION
    Menu for MCP-related actions such as Install Chrome MCP. Output is streamed in real time; no exit code detection.
#>

#region Variable Declarations
$script:PS_CURRENT_DIR = $PSScriptRoot
$script:WIN_DIR = Split-Path $script:PS_CURRENT_DIR -Parent
$script:SHELLS_DIR = Split-Path $script:WIN_DIR -Parent
$script:SCRIPT_DIR = Split-Path $script:SHELLS_DIR -Parent
$script:CORE_NODE_DIR = Split-Path $script:SCRIPT_DIR -Parent
$script:CHROME_MCP_START_PS1 = Join-Path $script:CORE_NODE_DIR "apps\mcp-chrome\scripts\start.ps1"
$script:CONTEXT7_PS1 = Join-Path $script:CORE_NODE_DIR "ncore\mcp_server\auto-context7-mcp\auto_fix_context7.ps1"
$script:WAIT_PLEASE_INSTALL_PS1 = Join-Path $script:CORE_NODE_DIR "ncore\mcp_server\wait_please\install-windows.ps1"
$script:INSTALL_ALL_MCP_PS1 = Join-Path $script:PS_CURRENT_DIR "InstallAllMCPServices.ps1"
$script:WIN_COMMON_DIR = Join-Path $script:WIN_DIR "win_common"
$script:GLOBALVARS_PS1 = Join-Path $script:WIN_COMMON_DIR "GlobalVars.ps1"

$script:COLOR_SUCCESS = "Green"
$script:COLOR_WARNING = "Yellow"
$script:COLOR_ERROR = "Red"
$script:COLOR_INFO = "White"
$script:COLOR_HIGHLIGHT = "Cyan"
#endregion

#region Helper Functions
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

function Invoke-ChromeMCPInstall {
    if (-not (Test-Path -LiteralPath $script:CHROME_MCP_START_PS1)) {
        Write-ColorMessage -Message "Chrome MCP start script not found: $script:CHROME_MCP_START_PS1" -Type "Error"
        Write-Host ""
        Write-Host "Press any key to return to menu..." -ForegroundColor $script:COLOR_HIGHLIGHT
        $null = $Host.UI.RawUI.ReadKey("NoEcho,IncludeKeyDown")
        return
    }
    Write-ColorMessage -Message "Running Chrome MCP install/setup (all output below is real-time)..." -Type "Info"
    Write-Host ""
    $ddPython = Get-DDPythonExePathForChrome
    $prevPythonExe = $env:PYTHON_EXE
    $prevPath = $env:PATH
    if ($ddPython -and $Global:PYTHON_DIR -and (Test-Path -LiteralPath $Global:PYTHON_DIR)) {
        $env:PYTHON_EXE = $ddPython
        $pythonScriptsDir = Join-Path $Global:PYTHON_DIR "Scripts"
        if (Test-Path -LiteralPath $pythonScriptsDir) {
            $env:PATH = "$Global:PYTHON_DIR;$pythonScriptsDir;$env:PATH"
        }
    }
    $prevDir = Get-Location
    try {
        Set-Location (Split-Path -Parent (Split-Path -Parent $script:CHROME_MCP_START_PS1))
        & $script:CHROME_MCP_START_PS1
    }
    finally {
        Set-Location $prevDir
        if ($null -ne $prevPythonExe) { $env:PYTHON_EXE = $prevPythonExe } else { Remove-Item -Path env:PYTHON_EXE -ErrorAction SilentlyContinue }
        $env:PATH = $prevPath
    }
    Write-Host ""
    Write-Host "========================================" -ForegroundColor $script:COLOR_INFO
    Write-ColorMessage -Message "Chrome MCP script finished." -Type "Info"
    Write-Host "========================================" -ForegroundColor $script:COLOR_INFO
    Write-Host ""
    Write-Host "Press any key to return to menu..." -ForegroundColor $script:COLOR_HIGHLIGHT
    $null = $Host.UI.RawUI.ReadKey("NoEcho,IncludeKeyDown")
}

function Invoke-Context7MCPInstall {
    if (-not (Test-Path -LiteralPath $script:CONTEXT7_PS1)) {
        Write-ColorMessage -Message "Context7 script not found: $script:CONTEXT7_PS1" -Type "Error"
        Write-Host ""
        Write-Host "Press any key to return to menu..." -ForegroundColor $script:COLOR_HIGHLIGHT
        $null = $Host.UI.RawUI.ReadKey("NoEcho,IncludeKeyDown")
        return
    }
    Write-ColorMessage -Message "Running Context7 MCP (may start server)..." -Type "Info"
    Write-Host ""
    & $script:CONTEXT7_PS1
    Write-Host ""
    Write-Host "Press any key to return to menu..." -ForegroundColor $script:COLOR_HIGHLIGHT
    $null = $Host.UI.RawUI.ReadKey("NoEcho,IncludeKeyDown")
}

function Invoke-WaitPleaseInstall {
    if (-not (Test-Path -LiteralPath $script:WAIT_PLEASE_INSTALL_PS1)) {
        Write-ColorMessage -Message "Wait Please install script not found: $script:WAIT_PLEASE_INSTALL_PS1" -Type "Error"
        Write-Host ""
        Write-Host "Press any key to return to menu..." -ForegroundColor $script:COLOR_HIGHLIGHT
        $null = $Host.UI.RawUI.ReadKey("NoEcho,IncludeKeyDown")
        return
    }
    Write-ColorMessage -Message "Running built-in MCP (Wait Please) install..." -Type "Info"
    Write-Host ""
    $prevDir = Get-Location
    try {
        Set-Location (Split-Path -Parent $script:WAIT_PLEASE_INSTALL_PS1)
        & $script:WAIT_PLEASE_INSTALL_PS1
    } finally {
        Set-Location $prevDir
    }
    Write-Host ""
    Write-Host "Press any key to return to menu..." -ForegroundColor $script:COLOR_HIGHLIGHT
    $null = $Host.UI.RawUI.ReadKey("NoEcho,IncludeKeyDown")
}

function Invoke-InstallAllMCPServices {
    if (-not (Test-Path -LiteralPath $script:INSTALL_ALL_MCP_PS1)) {
        Write-ColorMessage -Message "Install All script not found: $script:INSTALL_ALL_MCP_PS1" -Type "Error"
        Write-Host "Press any key to return to menu..." -ForegroundColor $script:COLOR_HIGHLIGHT
        $null = $Host.UI.RawUI.ReadKey("NoEcho,IncludeKeyDown")
        return
    }
    Write-ColorMessage -Message "Running Install All MCP Services (Chrome + Context7 + built-in + sync)..." -Type "Info"
    & $script:INSTALL_ALL_MCP_PS1
    Write-Host "Press any key to return to menu..." -ForegroundColor $script:COLOR_HIGHLIGHT
    $null = $Host.UI.RawUI.ReadKey("NoEcho,IncludeKeyDown")
}

#endregion

#region Menu System
function Show-MCPMenu {
    $menuItems = @(
        @{ Text = "-- MCP Management -----------------"; Action = { }; IsHeader = $true },
        @{ Text = "  Install all MCP services"; Action = { Invoke-InstallAllMCPServices }; IsHeader = $false },
        @{ Text = "  Install Chrome MCP"; Action = { Invoke-ChromeMCPInstall }; IsHeader = $false },
        @{ Text = "  Install Context7 MCP"; Action = { Invoke-Context7MCPInstall }; IsHeader = $false },
        @{ Text = "  Install built-in MCP (Wait Please)"; Action = { Invoke-WaitPleaseInstall }; IsHeader = $false },
        @{ Text = "------------------------------------"; Action = { }; IsHeader = $true },
        @{ Text = "Back to main menu"; Action = { return $true }; IsHeader = $false },
        @{ Text = "Exit"; Action = { exit }; IsHeader = $false }
    )

    $selectedIndex = 1
    while ($true) {
        Clear-Host
        Write-ColorMessage -Message "========================================" -Type "Info"
        Write-ColorMessage -Message "       MCP Management Menu" -Type "Info"
        Write-ColorMessage -Message "========================================" -Type "Info"

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
                    $result = & $menuItems[$selectedIndex].Action
                    if ($result -eq $true) { return }
                }
            }
        }
    }
}
#endregion

#region Main Execution
Show-MCPMenu
#endregion
