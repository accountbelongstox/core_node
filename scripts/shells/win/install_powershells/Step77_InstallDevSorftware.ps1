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

. "$PSScriptRoot\..\win_common\GlobalVars.ps1"
. "$PSScriptRoot\..\win_common\CommanFunc.ps1"

$STEP_NUMBER = 77

function Step77_InstallDevSoftware {
    Write-ColorMessage -Message "[Step $STEP_NUMBER] Development Software Installation..." -Type "Info"
    
    # Display available software packages
    Write-ColorMessage -Message "[Step $STEP_NUMBER] Available development software packages:" -Type "Info"
    foreach ($packageKey in $Global:DEV_SOFTWARE_PACKAGES.Keys) {
        $package = $Global:DEV_SOFTWARE_PACKAGES[$packageKey]
        Write-ColorMessage -Message "  - $($package.Name): $($package.Description)" -Type "Info"
    }
    
    Write-ColorMessage -Message "[Step $STEP_NUMBER] Do you want to install necessary development software?" -Type "Warning"
    Write-ColorMessage -Message "Enter 'yes' to install all packages (Default: no, Timeout: 60 seconds)" -Type "Info"
    
    $response = $null
    $startTime = Get-Date
    $endTime = $startTime.AddSeconds(60)
    
    while ((Get-Date) -lt $endTime) {
        if ([Console]::KeyAvailable) {
            $response = [Console]::ReadLine()
            break
        }
        Start-Sleep -Milliseconds 100
    }
    
    if ([string]::IsNullOrEmpty($response)) {
        $response = "no"
        Write-ColorMessage -Message "No input received, defaulting to 'no'" -Type "Info"
    }
    
    if ($response.ToLower() -eq "yes" -or $response.ToLower() -eq "y") {
        Write-ColorMessage -Message "[Step $STEP_NUMBER] Installing development software packages..." -Type "Info"
        
        $successCount = 0
        $failCount = 0
        
        foreach ($packageKey in $Global:DEV_SOFTWARE_PACKAGES.Keys) {
            $package = $Global:DEV_SOFTWARE_PACKAGES[$packageKey]
            Write-ColorMessage -Message "[Step $STEP_NUMBER] Installing $($package.Name)..." -Type "Info"
            Write-ColorMessage -Message "  Description: $($package.Description)" -Type "Info"

            $result = Invoke-WingetCommand -Id $package.WingetId -AllowTryInstall $true -Keyword $package.ScanKeyword -AdditionalKeywords $package.AdditionalKeywords -ForceInstall $false

            if ($result) {
                Write-ColorMessage -Message "[Step $STEP_NUMBER] Successfully installed $($package.Name)" -Type "Success"
                $successCount++
            } else {
                Write-ColorMessage -Message "[Step $STEP_NUMBER] Failed to install $($package.Name)" -Type "Error"
                $failCount++
            }
        }
        
        Write-ColorMessage -Message "[Step $STEP_NUMBER] Installation Summary:" -Type "Info"
        Write-ColorMessage -Message "  Successfully installed: $successCount packages" -Type "Success"
        Write-ColorMessage -Message "  Failed to install: $failCount packages" -Type "Error"
        
        if ($successCount -gt 0) {
            Write-ColorMessage -Message "[Step $STEP_NUMBER] Development software installation completed with $successCount successful installations" -Type "Success"
        } else {
            Write-ColorMessage -Message "[Step $STEP_NUMBER] No packages were successfully installed" -Type "Warning"
        }
    } else {
        Write-ColorMessage -Message "[Step $STEP_NUMBER] Development software installation skipped" -Type "Info"
    }
    
    Write-ColorMessage -Message "----------------------------------------------------------------" -Type "Info"
}

function Organize-DesktopShortcuts {
    Write-ColorMessage -Message "[Step $STEP_NUMBER] Organizing desktop shortcuts..." -Type "Info"
    
    $desktopPath = [Environment]::GetFolderPath('Desktop')
    $categories = @()
    foreach ($packageKey in $Global:DEV_SOFTWARE_PACKAGES.Keys) {
        $package = $Global:DEV_SOFTWARE_PACKAGES[$packageKey]
        if ($package.DesktopCategory -and $categories -notcontains $package.DesktopCategory) {
            $categories += $package.DesktopCategory
        }
    }

    # Create category folders on desktop
    foreach ($category in $categories) {
        $categoryFolder = Join-Path $desktopPath $category
        if (-not (Test-Path $categoryFolder)) {
            New-Item -ItemType Directory -Path $categoryFolder -Force | Out-Null
            Write-ColorMessage -Message "Created category folder: $category" -Type "Success"
        }
    }

    # Process each software package
    foreach ($packageKey in $Global:DEV_SOFTWARE_PACKAGES.Keys) {
        $package = $Global:DEV_SOFTWARE_PACKAGES[$packageKey]
        $categoryFolder = Join-Path $desktopPath $package.DesktopCategory
        $shortcutName = "$($package.Name).lnk"
        $desktopShortcut = Join-Path $desktopPath $shortcutName
        $categoryShortcut = Join-Path $categoryFolder $shortcutName
        
        Write-ColorMessage -Message "Processing $($package.Name)..." -Type "Info"
        
        # Check if shortcut exists on desktop
        if (Test-Path $desktopShortcut) {
            # Move shortcut from desktop to category folder
            Move-Item -Path $desktopShortcut -Destination $categoryShortcut -Force
            Write-ColorMessage -Message "Moved $($package.Name) shortcut to $($package.DesktopCategory)" -Type "Success"
        }
        elseif (-not (Test-Path $categoryShortcut)) {
            # Shortcut doesn't exist in category folder, try to find executable
            $exePath = Find-ExecutableByKeyword -Keyword $package.ScanKeyword -ScanInstallDir $package.WingetId -ScanDevDir $package.WingetId -AdditionalKeywords $package.AdditionalKeywords
            if ($exePath -and (Test-Path $exePath)) {
                Create-DesktopShortcut -ExePath $exePath -ShortcutName $package.Name -TargetPath $categoryFolder
                Write-ColorMessage -Message "Created $($package.Name) shortcut directly in $($package.DesktopCategory)" -Type "Success"
            }
            else {
                Write-ColorMessage -Message "Could not find executable for $($package.Name)" -Type "Warning"
            }
        }
        else {
            Write-ColorMessage -Message "$($package.Name) shortcut already exists in $($package.DesktopCategory)" -Type "Info"
        }
    }
    
    Write-ColorMessage -Message "[Step $STEP_NUMBER] Desktop shortcuts organization completed" -Type "Success"
}



Step77_InstallDevSoftware
# Organize-DesktopShortcuts