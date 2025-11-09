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

# Interactive Menu with Arrow Key Navigation

$VK_UP = 0x26
$VK_DOWN = 0x28
$VK_LEFT = 0x25
$VK_RIGHT = 0x27
$VK_RETURN = 0x0D
$VK_ESCAPE = 0x1B

Add-Type -TypeDefinition @"
    using System;
    using System.Runtime.InteropServices;
    public class KeyboardUtil {
        [DllImport("user32.dll")]
        public static extern short GetAsyncKeyState(int vKey);
    }
"@

function Show-InteractiveMenu {
    param(
        [Parameter(Mandatory = $true)]
        [array]$MenuItems,
        [Parameter(Mandatory = $false)]
        [int]$InitialIndex = 0,
        [Parameter(Mandatory = $false)]
        [string]$InitialMode = "debug",
        [Parameter(Mandatory = $false)]
        [scriptblock]$OnStateChange = $null
    )

    $modeOptions = @("debug", "build")
    $selectedIndex = $InitialIndex
    $mode = if ($modeOptions -contains $InitialMode) { $InitialMode } else { "debug" }
    $running = $true

    if ($selectedIndex -ge $MenuItems.Count) {
        $selectedIndex = 0
    }

    function Get-ModeLabel {
        param([string]$ModeValue)
        switch ($ModeValue) {
            "debug" { return "Debug" }
            "build" { return "Build" }
            default { return $ModeValue }
        }
    }

    function Draw-Menu {
        Clear-Host
        Write-Host ""
        Write-Host "=== Nuxt Main Application Launcher ===" -ForegroundColor Cyan
        Write-Host ""
        Write-Host "Use Arrow Keys: Up/Down to select app, Left/Right to toggle mode" -ForegroundColor Gray
        Write-Host "Press Enter to start, ESC to exit" -ForegroundColor Gray
        Write-Host ""

        for ($i = 0; $i -lt $MenuItems.Count; $i++) {
            $item = $MenuItems[$i]
            $isSelected = ($i -eq $selectedIndex)

            $prefix = if ($isSelected) { ">" } else { " " }
            $modeText = if ($isSelected) {
                "[" + (Get-ModeLabel -ModeValue $mode) + "]"
            } else {
                "           "
            }

            if ($isSelected) {
                Write-Host "$prefix $($item.DisplayName) $modeText" -ForegroundColor Green -BackgroundColor DarkGray
            }
            else {
                Write-Host "$prefix $($item.DisplayName)" -ForegroundColor White
            }
        }

        Write-Host ""
        $selectedApp = $MenuItems[$selectedIndex]
        Write-Host "Selected: $($selectedApp.DisplayName) - Port: $($selectedApp.Port) - Mode: $(Get-ModeLabel -ModeValue $mode)" -ForegroundColor Yellow
    }

    function Invoke-StateChange {
        if ($null -ne $OnStateChange) {
            & $OnStateChange $selectedIndex $mode
        }
    }

    Draw-Menu

    while ($running) {
        Start-Sleep -Milliseconds 50

        if ([KeyboardUtil]::GetAsyncKeyState($VK_UP) -band 0x8000) {
            $selectedIndex = ($selectedIndex - 1 + $MenuItems.Count) % $MenuItems.Count
            Draw-Menu
            Invoke-StateChange
            Start-Sleep -Milliseconds 150
        }
        elseif ([KeyboardUtil]::GetAsyncKeyState($VK_DOWN) -band 0x8000) {
            $selectedIndex = ($selectedIndex + 1) % $MenuItems.Count
            Draw-Menu
            Invoke-StateChange
            Start-Sleep -Milliseconds 150
        }
        elseif ([KeyboardUtil]::GetAsyncKeyState($VK_LEFT) -band 0x8000) {
            $currentIndex = $modeOptions.IndexOf($mode)
            if ($currentIndex -lt 0) { $currentIndex = 0 }
            $mode = $modeOptions[($currentIndex - 1 + $modeOptions.Count) % $modeOptions.Count]
            Draw-Menu
            Invoke-StateChange
            Start-Sleep -Milliseconds 150
        }
        elseif ([KeyboardUtil]::GetAsyncKeyState($VK_RIGHT) -band 0x8000) {
            $currentIndex = $modeOptions.IndexOf($mode)
            if ($currentIndex -lt 0) { $currentIndex = 0 }
            $mode = $modeOptions[($currentIndex + 1) % $modeOptions.Count]
            Draw-Menu
            Invoke-StateChange
            Start-Sleep -Milliseconds 150
        }
        elseif ([KeyboardUtil]::GetAsyncKeyState($VK_RETURN) -band 0x8000) {
            $running = $false
            Start-Sleep -Milliseconds 150
        }
        elseif ([KeyboardUtil]::GetAsyncKeyState($VK_ESCAPE) -band 0x8000) {
            Write-Host ""
            Write-Host "Cancelled by user" -ForegroundColor Yellow
            exit 0
        }
    }

    return @{
        SelectedIndex = $selectedIndex
        SelectedApp = $MenuItems[$selectedIndex]
        Mode = $mode
    }
}
