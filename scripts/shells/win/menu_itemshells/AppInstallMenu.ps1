# ### AI SPECIAL ATTENTION RULES START ###
# When AI/ALL DEVELOPERS sees this prompt, MUST IMMEDIATELY COMPLY WITH THESE RULES:
# 1. Write all code in English only.
# 2. Never execute, create, or modify test code.
# 3. Never create or update documentation (*.md).
# 4. Never write summaries during development or thinking process.
# 5. Declare all variables at the beginning of the file.
# 6. For PowerShell (*.ps1) scripts: Do not append strings directly to variables, Do not use relative paths such as "..\..\"; instead resolve absolute paths using parent path parsing (Split-Path, Join-Path, or Resolve-Path).
# 7. Do not modify these rules.
# VIOLATION OF THESE RULES IS STRICTLY FORBIDDEN
# ### AI SPECIAL ATTENTION RULES END ###

<#
.SYNOPSIS
    APP Install Menu - Step16 package list plus install_powershells script-based installs.
.DESCRIPTION
    Displays packages from ApplicationsList (Step16 -ExactPackageName) then script-based
    installs (run Step*.ps1). User enters number; script entries run the Step script directly.
#>

$script:PS_CURRENT_DIR = $PSScriptRoot
$script:WIN_COMMON_DIR = Join-Path (Split-Path $script:PS_CURRENT_DIR -Parent) "win_common"
$script:INSTALL_POWERSHELLS_DIR = Join-Path (Split-Path $script:PS_CURRENT_DIR -Parent) "install_powershells"
$script:STEP16_SCRIPT = Join-Path $script:INSTALL_POWERSHELLS_DIR "Step16_InstallApplications.ps1"

# Script-based installs: Key must start with "script:" then filename; Display = menu text
$script:SCRIPT_INSTALL_ENTRIES = @(
    @{ Key = "script:Step4_InstallNodeJS.ps1"; Display = "Node.js" },
    @{ Key = "script:Step9_InstallPython.ps1"; Display = "Python" },
    @{ Key = "script:Step12_InstallPHP.ps1"; Display = "PHP" },
    @{ Key = "script:Step6_InstallGit.ps1"; Display = "Git" },
    @{ Key = "script:Step30_InstallChrome.ps1"; Display = "Chrome (script)" },
    @{ Key = "script:Step40_InstallRedis.ps1"; Display = "Redis" },
    @{ Key = "script:Step60_InstallAndroidStudio.ps1"; Display = "Android Studio" },
    @{ Key = "script:Step61_InstallAndroidPlatformTools.ps1"; Display = "Android Platform Tools" },
    @{ Key = "script:Step70_InstallFlutter.ps1"; Display = "Flutter" },
    @{ Key = "script:Step51_InstallApkTool.ps1"; Display = "ApkTool" },
    @{ Key = "script:Step31_InstallPuppeteerPlugins.ps1"; Display = "Puppeteer Plugins" },
    @{ Key = "script:Step15_Install7ipBase.ps1"; Display = "7-Zip Base" },
    @{ Key = "script:Step10_InstallScoopWithChinaMirror.ps1"; Display = "Scoop" },
    @{ Key = "script:Step84_InstallWSL.ps1"; Display = "WSL" },
    @{ Key = "script:Step85_InstallWSLUbuntu24.ps1"; Display = "WSL Ubuntu 24" },
    @{ Key = "script:Step86_SetRootLoginWSLUbuntuDebian.ps1"; Display = "WSL Root Login" },
    @{ Key = "script:Step87_InstallVisualStudio.ps1"; Display = "Visual Studio" },
    @{ Key = "script:Step88_InstallQtBuildTools.ps1"; Display = "Qt Build Tools" },
    @{ Key = "script:Step89_InstallQt.ps1"; Display = "Qt" },
    @{ Key = "script:Step94_InstallQtOfficial.ps1"; Display = "Qt Official" },
    @{ Key = "script:Step99_InstallDeepSeek.ps1"; Display = "DeepSeek" },
    @{ Key = "script:Step100_InstallDeepSeekOCR.ps1"; Display = "DeepSeek OCR" },
    @{ Key = "script:Step101_InstallQwen25.ps1"; Display = "Qwen 2.5" },
    @{ Key = "script:Step102_InstallNLLB200.ps1"; Display = "NLLB 200" }
)

. (Join-Path $script:WIN_COMMON_DIR "GlobalVars.ps1")
. (Join-Path $script:WIN_COMMON_DIR "ApplicationsList.ps1")

function Get-AllPackagesFlatList {
    $list = @()
    # WINDOWS_10_ESSENTIAL_PATCHES only on Windows 10; do not show on Win11
    if ($Global:isWin10 -eq $true -and $null -ne $Global:WINDOWS_10_ESSENTIAL_PATCHES) {
        foreach ($key in $Global:WINDOWS_10_ESSENTIAL_PATCHES.Keys) {
            $meta = $Global:WINDOWS_10_ESSENTIAL_PATCHES[$key]
            $baseDisplay = if ($meta.Name) { $meta.Name } else { $key }
            $display = "{0} (Win10)" -f $baseDisplay
            $list += @{ Key = $key; Display = $display }
        }
    }
    if ($Global:BasePackages) {
        foreach ($key in $Global:BasePackages.Keys) {
            $meta = $Global:BasePackages[$key]
            $display = if ($meta.Name) { $meta.Name } else { $key }
            $list += @{ Key = $key; Display = $display }
        }
    }
    if ($Global:APPLICATIONS_PACKAGES) {
        foreach ($key in $Global:APPLICATIONS_PACKAGES.Keys) {
            $meta = $Global:APPLICATIONS_PACKAGES[$key]
            $display = if ($meta.Name) { $meta.Name } else { $key }
            $list += @{ Key = $key; Display = $display }
        }
    }
    if ($Global:COMMON_SOFTWARE_PACKAGES) {
        foreach ($key in $Global:COMMON_SOFTWARE_PACKAGES.Keys) {
            $meta = $Global:COMMON_SOFTWARE_PACKAGES[$key]
            $display = if ($meta.Name) { $meta.Name } else { $key }
            $list += @{ Key = $key; Display = $display }
        }
    }
    if ($Global:MCP_SERVICES_PACKAGES) {
        foreach ($key in $Global:MCP_SERVICES_PACKAGES.Keys) {
            $meta = $Global:MCP_SERVICES_PACKAGES[$key]
            $display = if ($meta.Name) { $meta.Name } else { $key }
            $list += @{ Key = $key; Display = $display }
        }
    }
    if ($Global:DEV_SOFTWARE_PACKAGES) {
        foreach ($key in $Global:DEV_SOFTWARE_PACKAGES.Keys) {
            $meta = $Global:DEV_SOFTWARE_PACKAGES[$key]
            $display = if ($meta.Name) { $meta.Name } else { $key }
            $list += @{ Key = $key; Display = $display }
        }
    }
    foreach ($scriptEntry in $script:SCRIPT_INSTALL_ENTRIES) {
        $list += @{ Key = $scriptEntry.Key; Display = $scriptEntry.Display }
    }
    return ($list | Sort-Object { $_.Display.ToLowerInvariant() })
}

function Show-AppInstallMenu {
    $flatList = Get-AllPackagesFlatList
    $count = if ($flatList) { $flatList.Count } else { 0 }

    while ($true) {
        Clear-Host
        Write-Host "================================================================================" -ForegroundColor Cyan
        Write-Host "APP Install Menu - Select a package to install (Step16 single-package run)" -ForegroundColor Cyan
        Write-Host "================================================================================" -ForegroundColor Cyan
        Write-Host ""

        if ($count -eq 0) {
            Write-Host "No packages defined in ApplicationsList.ps1." -ForegroundColor Yellow
            Read-Host "Press Enter to go back"
            return
        }

        for ($i = 0; $i -lt $count; $i++) {
            $num = $i + 1
            $entry = $flatList[$i]
            Write-Host ("  {0,3}. {1}" -f $num, $entry.Display)
        }
        Write-Host ""
        Write-Host "  0. Back" -ForegroundColor Gray
        Write-Host ""

        $inputLine = Read-Host "Enter number (0 = Back)"
        $inputTrim = if ($inputLine) { $inputLine.Trim() } else { "" }
        if ($inputTrim -eq "0" -or $inputTrim -eq "" -or $inputTrim -eq "q" -or $inputTrim -eq "Q") {
            return
        }

        $numVal = 0
        $isNum = [int]::TryParse($inputTrim, [ref]$numVal)
        if (-not $isNum -or $numVal -lt 1 -or $numVal -gt $count) {
            Write-Host "Invalid input. Enter a number between 1 and $count, or 0 to go back." -ForegroundColor Yellow
            Read-Host "Press Enter to continue"
            continue
        }

        $entry = $flatList[$numVal - 1]
        $packageKey = $entry.Key
        $displayName = $entry.Display

        if ($packageKey.StartsWith("script:")) {
            $scriptFileName = $packageKey.Substring(7)
            $scriptPath = Join-Path $script:INSTALL_POWERSHELLS_DIR $scriptFileName
            if (-not (Test-Path $scriptPath)) {
                Write-Host "Script not found: $scriptPath" -ForegroundColor Red
                Read-Host "Press Enter to continue"
                continue
            }
            Write-Host ""
            Write-Host "Running script: $displayName ($scriptFileName)..." -ForegroundColor Cyan
            Write-Host ""
            & $scriptPath
        }
        else {
            if (-not (Test-Path $script:STEP16_SCRIPT)) {
                Write-Host "Step16 script not found: $script:STEP16_SCRIPT" -ForegroundColor Red
                Read-Host "Press Enter to continue"
                continue
            }
            Write-Host ""
            Write-Host "Running Step16 for package: $displayName ($packageKey)..." -ForegroundColor Cyan
            Write-Host ""
            & $script:STEP16_SCRIPT -ExactPackageName $packageKey
        }

        Write-Host ""
        Read-Host "Press Enter to return to APP Install Menu"
    }
}

Show-AppInstallMenu
