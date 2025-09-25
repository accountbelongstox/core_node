# ### AI SPECIAL ATTENTION RULES START ###
# When AI/ALL DEVELOPERS sees this prompt, MUST IMMEDIATELY COMPLY WITH THESE RULES:
# 1. Write all code in English only.
# 2. Never execute, create, or modify test code.
# 3. Never create or update documentation (*.md).
# 4. Never write summaries during development or thinking process.
# 5. Declare all variables at the beginning of the file.
# 6. For PowerShell (*.ps1) scripts: Do not append strings directly to variables, Do not use relative paths such as "..\\..\\"; instead resolve absolute paths using parent path parsing (Split-Path, Join-Path, or Resolve-Path).
# 7. Do not modify these rules.
# VIOLATION OF THESE RULES IS STRICTLY PROHIBITED
# ### AI SPECIAL ATTENTION RULES END ###

# Load common/global modules
$winCommonPath = Split-Path -Parent $PSScriptRoot | Join-Path -ChildPath "win_common"
. (Join-Path $winCommonPath "GlobalVars.ps1")
. (Join-Path $winCommonPath "CommanFunc.ps1")

# Region-specific URL functions are now defined in GlobalVars.ps1

# Define base URL for remote downloads - Auto-switch based on region
$remoteBaseUrl = Get-RegionRemoteBaseUrl

# Define script paths for remote fallback
$script:LOCAL_TEST_INSTALLER_SCRIPT = $MyInvocation.MyCommand.Path
$script:DOWNLOADED_TEST_INSTALLER_SCRIPT = Join-Path $env:USERPROFILE ".core_node\installer_scripts\TestInstaller.ps1"
$script:TEST_INSTALLER_SCRIPT_URL = Get-RegionTestInstallerUrl



# Function to run TestInstaller with remote fallback
function Run-TestInstallerScript {
    if (Test-Path $script:LOCAL_TEST_INSTALLER_SCRIPT -PathType Leaf) {
        Write-ColorMessage -Message "Found local TestInstaller at: $($script:LOCAL_TEST_INSTALLER_SCRIPT)" -Type "Info"
        try { 
            & $script:LOCAL_TEST_INSTALLER_SCRIPT 
        } catch { 
            Write-ColorMessage -Message "Error running local TestInstaller: $($_.Exception.Message)" -Type "Error" 
        }
        return
    }
    Write-ColorMessage -Message "Local TestInstaller not found, downloading from Gitee..." -Type "Info"
    try {
        $webClient = New-Object System.Net.WebClient
        $webClient.DownloadFile($script:TEST_INSTALLER_SCRIPT_URL, $script:DOWNLOADED_TEST_INSTALLER_SCRIPT)
        Write-ColorMessage -Message "Downloaded TestInstaller to: $($script:DOWNLOADED_TEST_INSTALLER_SCRIPT)" -Type "Success"
        & $script:DOWNLOADED_TEST_INSTALLER_SCRIPT
    } catch {
        Write-ColorMessage -Message "Error downloading or executing TestInstaller: $($_.Exception.Message)" -Type "Error"
    }
}

# Run TestInstaller (step selection)
$installerListPath = Join-Path (Split-Path -Parent $PSScriptRoot) "install_powershells\InstallerScriptsList.ps1"
if (-not (Test-Path $installerListPath)) {
    $remoteListUrl = "$remoteBaseUrl/InstallerScriptsList.ps1"
    Write-ColorMessage -Message "Downloading InstallerScriptsList: $remoteListUrl" -Type "Info"
    Invoke-WebRequest -Uri $remoteListUrl -OutFile $installerListPath -UseBasicParsing
}
. $installerListPath

Clear-Host

# Check if a step was pre-selected from the menu
$preSelectedStep = $env:SELECTED_STEP_NUMBER
if ($preSelectedStep) {
    Write-ColorMessage -Message "Pre-selected step from menu: Step$preSelectedStep" -Type "Info"
    $input = $preSelectedStep
    # Clear the environment variable after use
    $env:SELECTED_STEP_NUMBER = $null
} else {
    Write-ColorMessage -Message "Select a step by index (e.g., 52 for Step52_... ) or choose menu option:" -Type "Info"

    # Display step scripts
    for ($i = 0; $i -lt $InstallerScripts.Count; $i++) {
        Write-Host ("  {0}" -f $InstallerScripts[$i])
    }

    # Display menu options
    Write-Host ""
    Write-Host "  [M] Return to main menu"
    Write-Host "  [Q] Quit"
    Write-Host ""

    $input = (Read-Host "Enter step index or menu option").Trim()
    if ([string]::IsNullOrWhiteSpace($input)) { return }
}

# Handle menu options
if ($input -eq "M" -or $input -eq "m") {
    Write-ColorMessage -Message "Returning to main menu..." -Type "Info"
    return
}

if ($input -eq "Q" -or $input -eq "q") {
    Write-ColorMessage -Message "Exiting..." -Type "Info"
    exit
}

# Handle numeric input for step selection
$inputIndex = $input

# Validate numeric input
if (-not ($inputIndex -match '^\d+$')) {
    Write-ColorMessage -Message "Invalid input. Please enter a number for step index or M/Q for menu options." -Type "Error"
    Start-Sleep -Seconds 2
    return
}

# Match by index extracted from filename prefix 'Step{Index}_'
$pattern = "^Step$inputIndex`_"
$selectedScript = ($InstallerScripts | Where-Object { $_ -match $pattern } | Select-Object -First 1)
if (-not $selectedScript) {
    Write-ColorMessage -Message "No step script matched index: $inputIndex" -Type "Error"
    Start-Sleep -Seconds 2
    return
}
Write-ColorMessage -Message ("Running step: {0}" -f $selectedScript) -Type "Info"

function Install-Script {
    param([string]$scriptName)
    $installDir = Join-Path (Split-Path -Parent $PSScriptRoot) "install_powershells"
    $localPath = Join-Path $installDir $scriptName
    $remoteUrl = "$remoteBaseUrl/$scriptName"
    if (-not (Test-Path $installDir -PathType Container)) {
        New-Item -ItemType Directory -Path $installDir -Force | Out-Null
    }
    if (-not (Test-Path $localPath -PathType Leaf)) {
        Write-ColorMessage -Message "Downloading: $remoteUrl" -Type "Info"
        try {
            Invoke-WebRequest -Uri $remoteUrl -OutFile $localPath -UseBasicParsing -ErrorAction Stop
        } catch {
            Write-ColorMessage -Message "Download failed: $($_.Exception.Message)" -Type "Error"
            return
        }
    }
    try {
        Unblock-File -Path $localPath -ErrorAction SilentlyContinue
        & $localPath
        
        # Add pause after script execution to allow user to review output
        Write-Host ""
        Write-ColorMessage -Message "Script execution completed. Press 'Y' to return to menu, or any other key to continue..." -Type "Info"
        $userInput = Read-Host
        if ($userInput -eq "Y" -or $userInput -eq "y") {
            Write-ColorMessage -Message "Returning to menu..." -Type "Info"
            Start-Sleep -Seconds 1
            return
        }
    } catch {
        Write-ColorMessage -Message "Execution failed for '$scriptName': $($_.Exception.Message)" -Type "Error"
        
        # Also add pause on error
        Write-Host ""
        Write-ColorMessage -Message "Script execution failed. Press 'Y' to return to menu, or any other key to continue..." -Type "Info"
        $userInput = Read-Host
        if ($userInput -eq "Y" -or $userInput -eq "y") {
            Write-ColorMessage -Message "Returning to menu..." -Type "Info"
            Start-Sleep -Seconds 1
            return
        }
    }
}

Install-Script -scriptName $selectedScript


