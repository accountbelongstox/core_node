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

$winCommonDir        = $null
$installerListPath   = $null
$remoteBaseUrl       = $null
$installDir          = $null
$discoveredScripts   = $null
$resolvedPython      = $null
$selectedRegion      = $null
$preSelectedStep     = $null
$userInput           = $null
$inputIndex          = $null
$pattern             = $null
$selectedScript      = $null

$winCommonDir = Join-Path (Split-Path -Parent $PSScriptRoot) 'win_common'
. (Join-Path $winCommonDir 'GlobalVars.ps1')
. (Join-Path $winCommonDir 'CommonFunc.ps1')

$remoteBaseUrl = Get-RegionRemoteBaseUrl
$installDir = Join-Path (Split-Path -Parent $PSScriptRoot) 'install_powershells'

$installerListPath = Join-Path $winCommonDir 'InstallerScriptsList.ps1'
if (-not (Test-Path -LiteralPath $installerListPath)) {
    $remoteListUrl = Get-RegionInstallerScriptsListUrl
    Write-ColorMessage -Message "Downloading InstallerScriptsList: $remoteListUrl" -Type 'Info'
    Invoke-WebRequest -Uri $remoteListUrl -OutFile $installerListPath -UseBasicParsing
}
. $installerListPath

$resolvedPython = Resolve-InstallerStepPythonExe
$selectedRegion = Get-GlobalVar -Key 'SELECTED_REGION'
if ([string]::IsNullOrWhiteSpace($selectedRegion)) {
    $selectedRegion = 'Global'
}

Clear-Host

$preSelectedStep = $env:SELECTED_STEP_NUMBER
if ($preSelectedStep) {
    Write-ColorMessage -Message "Pre-selected step from menu: Step$preSelectedStep" -Type 'Info'
    $userInput = $preSelectedStep
    $env:SELECTED_STEP_NUMBER = $null
} else {
    $discoveredScripts = Get-DiscoveredInstallerStepScripts
    Write-ColorMessage -Message 'Select a step by index (e.g., 52 for Step52_... ) or choose menu option:' -Type 'Info'
    if ($resolvedPython) {
        Write-Host ("Python (absolute): {0}" -f $resolvedPython) -ForegroundColor DarkGray
    } else {
        Write-ColorMessage -Message 'Python (absolute): not found yet — run Step8_InstallPython first for Python-dependent steps.' -Type 'Warning'
    }
    Write-Host ''

    foreach ($scriptName in $discoveredScripts) {
        if ($scriptName -match '^Step(\d+)_') {
            Write-Host ("  {0,-5} {1}" -f $Matches[1], $scriptName)
        } else {
            Write-Host ("        {0}" -f $scriptName)
        }
    }

    Write-Host ''
    Write-Host '  [M] Return to main menu'
    Write-Host '  [Q] Quit'
    Write-Host ''

    $userInput = (Read-Host 'Enter step index or menu option').Trim()
    if ([string]::IsNullOrWhiteSpace($userInput)) { return }
}

if ($userInput -eq 'M' -or $userInput -eq 'm') {
    Write-ColorMessage -Message 'Returning to main menu...' -Type 'Info'
    return
}

if ($userInput -eq 'Q' -or $userInput -eq 'q') {
    Write-ColorMessage -Message 'Exiting...' -Type 'Info'
    exit
}

$inputIndex = $userInput
if (-not ($inputIndex -match '^\d+$')) {
    Write-ColorMessage -Message 'Invalid input. Please enter a number for step index or M/Q for menu options.' -Type 'Error'
    Start-Sleep -Seconds 2
    return
}

if (-not $discoveredScripts) {
    $discoveredScripts = Get-DiscoveredInstallerStepScripts
}

$pattern = "^Step$inputIndex`_"
$selectedScript = ($discoveredScripts | Where-Object { $_ -match $pattern } | Select-Object -First 1)
if (-not $selectedScript) {
    Write-ColorMessage -Message "No step script matched index: $inputIndex" -Type 'Error'
    Start-Sleep -Seconds 2
    return
}

Write-ColorMessage -Message ("Running step: {0}" -f $selectedScript) -Type 'Info'
if ($resolvedPython) {
    Write-Host ("Using Python: {0}" -f $resolvedPython) -ForegroundColor DarkGray
}

function Install-Script {
    param([string]$ScriptName)

    $localPath = Join-Path $installDir $ScriptName
    $remoteUrl = "$remoteBaseUrl/$ScriptName"
    if (-not (Test-Path -LiteralPath $installDir)) {
        New-Item -ItemType Directory -Path $installDir -Force | Out-Null
    }
    if (-not (Test-Path -LiteralPath $localPath)) {
        Write-ColorMessage -Message "Downloading: $remoteUrl" -Type 'Info'
        try {
            Invoke-WebRequest -Uri $remoteUrl -OutFile $localPath -UseBasicParsing -ErrorAction Stop
        } catch {
            Write-ColorMessage -Message "Download failed: $($_.Exception.Message)" -Type 'Error'
            return
        }
    }

    $ok = Invoke-InstallerStepScript -ScriptName $ScriptName -Region $selectedRegion -PythonExe $resolvedPython
    if (-not $ok) {
        Write-ColorMessage -Message "Execution failed for '$ScriptName'." -Type 'Error'
    }

    Write-Host ''
    Write-ColorMessage -Message "Script execution completed. Press 'Y' to return to menu, or any other key to continue..." -Type 'Info'
    $pauseInput = Read-Host
    if ($pauseInput -eq 'Y' -or $pauseInput -eq 'y') {
        Write-ColorMessage -Message 'Returning to menu...' -Type 'Info'
        Start-Sleep -Seconds 1
    }
}

Install-Script -ScriptName $selectedScript
