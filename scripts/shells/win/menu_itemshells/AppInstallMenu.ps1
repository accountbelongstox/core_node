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
$script:APPLICATIONS_SCRIPT = Join-Path $script:INSTALL_POWERSHELLS_DIR "Step21_InstallApplications.ps1"

# Script-based installs: Key must start with "script:" then filename; Display = menu text
$script:SCRIPT_INSTALL_ENTRIES = @(
    @{ Key = "script:Node_Runtime.ps1"; Display = "Node.js" },
    @{ Key = "script:Python_Default.ps1"; Display = "Python" },
    @{ Key = "script:Python_Isolated310.ps1"; Display = "Python 3.10 / 3.12 (isolated model runtimes)" },
    @{ Key = "script:Python_Isolated312.ps1"; Display = "Python 3.12 (isolated model runtime)" },
    @{ Key = "script:Web_Php.ps1"; Display = "PHP" },
    @{ Key = "script:Git_Install.ps1"; Display = "Git" },
    @{ Key = "script:Step22_InstallChrome.ps1"; Display = "Chrome (script)" },
    @{ Key = "script:Database_Redis.ps1"; Display = "Redis" },
    @{ Key = "script:Android_Studio.ps1"; Display = "Android Studio" },
    @{ Key = "script:Android_PlatformTools.ps1"; Display = "Android Platform Tools" },
    @{ Key = "script:Step28_InstallFlutter.ps1"; Display = "Flutter" },
    @{ Key = "script:Android_ApkTool.ps1"; Display = "ApkTool" },
    @{ Key = "script:Node_PuppeteerPlugins.ps1"; Display = "Puppeteer Plugins" },
    @{ Key = "script:BaseTools_7Zip.ps1"; Display = "7-Zip Base" },
    @{ Key = "script:Step14_InstallScoopWithChinaMirror.ps1"; Display = "Scoop" },
    @{ Key = "script:Wsl_Install.ps1"; Display = "WSL" },
    @{ Key = "script:Wsl_Debian13.ps1"; Display = "WSL Debian 13" },
    @{ Key = "script:Wsl_RootLogin.ps1"; Display = "WSL Root Login" },
    @{ Key = "script:Step32_InstallVisualStudio.ps1"; Display = "Visual Studio" },
    @{ Key = "script:Qt_BuildTools.ps1"; Display = "Qt Build Tools" },
    @{ Key = "script:Qt_Install.ps1"; Display = "Qt" },
    @{ Key = "script:Qt_Official.ps1"; Display = "Qt Official" },
    @{ Key = "script:Model_DeepSeek.ps1"; Display = "DeepSeek" },
    @{ Key = "script:Model_DeepSeekOCR.ps1"; Display = "DeepSeek OCR" },
    @{ Key = "script:Model_Qwen25.ps1"; Display = "Qwen 2.5" },
    @{ Key = "script:Model_NLLB200.ps1"; Display = "NLLB 200" }
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
            if (-not (Test-Path $script:APPLICATIONS_SCRIPT)) {
                Write-Host "Applications script not found: $script:APPLICATIONS_SCRIPT" -ForegroundColor Red
                Read-Host "Press Enter to continue"
                continue
            }
            Write-Host ""
            Write-Host "Running Step16 for package: $displayName ($packageKey)..." -ForegroundColor Cyan
            Write-Host ""
            & $script:APPLICATIONS_SCRIPT -ExactPackageName $packageKey
        }

        Write-Host ""
        Read-Host "Press Enter to return to APP Install Menu"
    }
}

Show-AppInstallMenu
