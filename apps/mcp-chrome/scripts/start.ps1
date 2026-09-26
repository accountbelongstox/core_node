# ### AI SPECIAL ATTENTION RULES START ###
# When AI/ALL DEVELOPERS sees this prompt, MUST IMMEDIATELY COMPLY WITH THESE RULES:
# 1. Write all code in English only.
# 2. Never execute, create, or modify test code.
# 3. Never create or update documentation (*.md).
# 4. Never write summaries during development or thinking process.
# 5. Declare all variables at the beginning of the file.
# 6. For PowerShell (*.ps1) scripts: Do not append strings directly to variables, Do not use relative paths such as "..\..\"; instead resolve absolute paths using Split-Path, Join-Path, or Resolve-Path.
# 7. Do not modify these rules.
# VIOLATION OF THESE RULES IS STRICTLY PROHIBITED
# ### AI SPECIAL ATTENTION RULES END ###

# Chrome MCP Server Startup Script (Windows). Shell owns build/watch orchestration;
# Python is called after builds to recover the MCP connection.

param(
    [switch]$InstallShortcut,
    [switch]$Service,
    [switch]$NoService,
    [switch]$UninstallService,
    [switch]$ServiceRun
)

$ErrorActionPreference = "Stop"
$ScriptDir = $null
$ProjectRoot = $null
$AppsDir = $null
$CoreNodeRoot = $null
$ConfigRoot = $null
$ScriptsRoot = $null
$ShellsRoot = $null
$WindowsShellsRoot = $null
$WindowsCommonRoot = $null
$GlobalVarsPath = $null
$VarManagerPath = $null
$VarKeysPath = $null
$PythonScript = $null
$SupervisorScript = $null
$ExtensionRoot = $null
$LocalesRoot = $null
$EnglishLocalePath = $null
$SelectedLocalePath = $null
$EnglishMessages = $null
$LocalizedMessages = $null
$LanguageCandidate = $null
$NormalizedLanguage = $null
$LocaleName = $null
$PythonExe = $null
$SupervisorArguments = @()
$SupervisorProcess = $null
$InitialDir = Get-Location
$WatchChoice = ""
$WatchMode = "dev"
$projectRootProbe = $null
$uiTitle = $null
$step1 = $null
$step2 = $null
$step3 = $null
$step4 = $null
$step5 = $null
$step6 = $null
$nodeVersion = $null
$bunVersion = $null
$EnsureWinBinScript = $null
$RegisterScript = $null
$extensionPath = $null
$manifestJson = $null
$sharedPath = $null
$nativePathProbe = $null
$manifestContent = $null
$nativePath = $null
$manifestPath = $null
$regKeyPath = $null
$ServiceContractScript = $null
$StartupManagerScript = $null
$NssmServiceManagerScript = $null
$ServiceTaskName = $null
$ServiceDescription = $null
$ServiceChoice = $env:MCP_CHROME_AS_SERVICE
$ServiceMode = "none"
$ServiceExe = $null
$ServiceArguments = $null
$NativeHostName = $null
$DevWatchScript = $null
$ServiceRestartSeconds = 5

function Get-LocalizedMessage {
    param(
        [Parameter(Mandatory=$true)]
        [string]$Key,

        [Parameter(Mandatory=$false)]
        [object[]]$Arguments = @()
    )

    $property = $null
    $fallbackProperty = $null
    $messageEntry = $null
    $placeholderEntry = $null
    $template = $null
    $placeholder = $null
    $placeholderIndex = $null
    $placeholderToken = $null
    $placeholderValue = $null

    $property = $LocalizedMessages.PSObject.Properties[$Key]
    $fallbackProperty = $EnglishMessages.PSObject.Properties[$Key]
    if ($property) {
        $messageEntry = $property.Value
    } elseif ($fallbackProperty) {
        $messageEntry = $fallbackProperty.Value
    } else {
        return $Key
    }

    $template = $messageEntry.message

    if ($Arguments.Count -eq 0) {
        return $template
    }

    $placeholderEntry = $messageEntry.placeholders
    if (-not $placeholderEntry -and $fallbackProperty) {
        $placeholderEntry = $fallbackProperty.Value.placeholders
    }
    foreach ($placeholder in $placeholderEntry.PSObject.Properties) {
        $placeholderIndex = [int]$placeholder.Value.content.Trim('$') - 1
        if ($placeholderIndex -lt 0 -or $placeholderIndex -ge $Arguments.Count) {
            continue
        }

        $placeholderToken = [string]::Concat('$', $placeholder.Name, '$')
        $placeholderValue = [string]$Arguments[$placeholderIndex]
        $template = $template.Replace($placeholderToken, $placeholderValue)
    }

    return $template
}

$ScriptDir = Split-Path -Parent $PSScriptRoot
$ProjectRoot = $ScriptDir
$AppsDir = Split-Path -Parent $ProjectRoot
$CoreNodeRoot = Split-Path -Parent $AppsDir
$ConfigRoot = Join-Path $CoreNodeRoot "config"
$ScriptsRoot = Join-Path $CoreNodeRoot "scripts"
$ShellsRoot = Join-Path $ScriptsRoot "shells"
$WindowsShellsRoot = Join-Path $ShellsRoot "win"
$WindowsCommonRoot = Join-Path $WindowsShellsRoot "win_common"
$GlobalVarsPath = Join-Path $WindowsCommonRoot "GlobalVars.ps1"
$VarManagerPath = Join-Path $PSScriptRoot "VarManager.ps1"
$VarKeysPath = Join-Path $PSScriptRoot "VarKeys.ps1"
$PythonScript = Join-Path $PSScriptRoot "build_orchestrator.py"
$SupervisorScript = Join-Path $PSScriptRoot "service_supervisor.py"
$ExtensionRoot = Join-Path (Join-Path $ProjectRoot "app") "chrome-extension"
$LocalesRoot = Join-Path $ExtensionRoot "_locales"
$EnglishLocalePath = Join-Path (Join-Path $LocalesRoot "en") "messages.json"
$LanguageCandidate = $env:MCP_CHROME_LANGUAGE
if ([string]::IsNullOrWhiteSpace($LanguageCandidate)) {
    $LanguageCandidate = [System.Globalization.CultureInfo]::CurrentUICulture.Name
}
$NormalizedLanguage = $LanguageCandidate.Replace("-", "_").ToLowerInvariant()
$LocaleName = switch -Regex ($NormalizedLanguage) {
    "^de" { "de"; break }
    "^ja" { "ja"; break }
    "^ko" { "ko"; break }
    "^zh_(tw|hk|mo|hant)" { "zh_TW"; break }
    "^zh" { "zh_CN"; break }
    default { "en" }
}
$SelectedLocalePath = Join-Path (Join-Path $LocalesRoot $LocaleName) "messages.json"
$EnglishMessages = Get-Content -LiteralPath $EnglishLocalePath -Raw | ConvertFrom-Json
$LocalizedMessages = Get-Content -LiteralPath $SelectedLocalePath -Raw | ConvertFrom-Json

# WXT imports config/queue_center_contract.json from the repository root
# directly. Do not copy the task contract here; wxt.config.ts explicitly allows
# that root so Laravel, Pycore, both UIs, and mcp-chrome read one source.
Set-Location $ProjectRoot
. $GlobalVarsPath
. $VarKeysPath
Import-Module $VarManagerPath -Force
$PythonExe = (Resolve-Path -LiteralPath $Global:PYTHON_EXE_PATH).Path
$ServiceContractScript = Join-Path $WindowsCommonRoot "ServiceContract.ps1"
$StartupManagerScript = Join-Path $WindowsCommonRoot "StartupManager.ps1"
$NssmServiceManagerScript = Join-Path $WindowsCommonRoot "NssmServiceManager.ps1"
$DevWatchScript = Join-Path $PSScriptRoot "dev-watch.mjs"
. $ServiceContractScript
. $StartupManagerScript
. $NssmServiceManagerScript
$ServiceTaskName = Get-ServiceContractValue -ContractPath "mcp_chrome.windows_task_name"
$ServiceDescription = Get-ServiceContractValue -ContractPath "mcp_chrome.service_description"
$NativeHostName = Get-ServiceContractValue -ContractPath "mcp_chrome.native_host_name"
$SupervisorArguments = @(
    [string]::Concat('"', $SupervisorScript, '"'),
    "--project-root",
    [string]::Concat('"', $ProjectRoot, '"'),
    "--watch-mode",
    "dev",
    "--recover-on-start"
)

# Logon-task run: recovery supervisor plus the WXT/tsup/nodemon watchers; a
# watcher exit restarts the set after a short pause.
if ($ServiceRun) {
    Start-Process -FilePath $PythonExe -ArgumentList $SupervisorArguments -WindowStyle Hidden | Out-Null
    while ($true) {
        & node $DevWatchScript --parent-pid $PID
        Start-Sleep -Seconds $ServiceRestartSeconds
    }
}

if ($UninstallService) {
    [void](Unregister-UserLogonTask -TaskName $ServiceTaskName)
    return
}

Write-Host ""
Write-Host "========================================"
Write-Host (Get-LocalizedMessage -Key "startBannerTitle")
Write-Host "========================================"
Write-Host ""

# Idempotent service choice: an installed logon task is converged without
# asking (and paused while this build writes its folder); otherwise ask once,
# default No. MCP_CHROME_AS_SERVICE / -Service / -NoService pre-answer.
if (Test-UserLogonTask -TaskName $ServiceTaskName) {
    $ServiceMode = "converge"
    Write-Host (Get-LocalizedMessage -Key "startServiceInstalled" -Arguments @($ServiceTaskName)) -ForegroundColor Green
    Stop-UserLogonTask -TaskName $ServiceTaskName
    Start-Sleep -Seconds $ServiceRestartSeconds
} else {
    if ($Service) {
        $ServiceChoice = "yes"
    } elseif ($NoService) {
        $ServiceChoice = "no"
    }
    if ([string]::IsNullOrWhiteSpace($ServiceChoice)) {
        $ServiceChoice = "no"
        if (($env:DD_AUTO_CONTINUE -ne "1") -and ($env:DD_AUTO_CONTINUE -ne "true") -and [Environment]::UserInteractive) {
            if (Read-YesNoDefaultNo (Get-LocalizedMessage -Key "startServicePrompt")) {
                $ServiceChoice = "yes"
            }
        }
    }
    if (@("y", "yes") -contains $ServiceChoice.ToLowerInvariant()) {
        $ServiceMode = "install"
    }
}

$WatchChoice = $env:MCP_CHROME_WATCH_MODE
if ($ServiceMode -ne "none") {
    $WatchChoice = "once"
}
if ($WatchChoice -match "^(n|no|once)$") {
    $WatchMode = "once"
    Write-Host (Get-LocalizedMessage -Key "startWatchOnceSelected") -ForegroundColor Yellow
} else {
    $WatchMode = "dev"
    Write-Host (Get-LocalizedMessage -Key "startWatchDevSelected") -ForegroundColor Green
}
Write-Host ""

Write-Host (Get-LocalizedMessage -Key "startProcessingBuildConfiguration")
Write-Host ""

# Run Python script. Output streams live; we do NOT gate on the exit code.
# Success is judged by whether the build configuration was produced (probed
# right after) and by the build artifacts verified in each step below.
try {
    & $PythonExe $PythonScript
} catch {
    Write-Host (Get-LocalizedMessage -Key "startPythonError" -Arguments @($_)) -ForegroundColor Yellow
}

$projectRootProbe = Get-Var -Key ([VarKeys]::PROJECT_ROOT) -Default ""
if (-not $projectRootProbe) {
    Write-Host ""
    Write-Host (Get-LocalizedMessage -Key "startBuildConfigIncomplete") -ForegroundColor Yellow
}

Write-Host ""

# ======================================
# Step 2: Read variables and execute build commands
# ======================================

# Read UI title
$uiTitle = Get-LocalizedMessage -Key "startSetupTitle"
Write-Host "========================================"
Write-Host "  $uiTitle"
Write-Host "========================================"
Write-Host ""

# Step 1: Check dependencies
$step1 = Get-LocalizedMessage -Key "startCheckingDependencies"
Write-Host "[1/6] $step1"

$nodeVersion = node --version 2>$null
if ($nodeVersion) {
    Write-Host (Get-LocalizedMessage -Key "startNodeVersion" -Arguments @($nodeVersion)) -ForegroundColor Green
} else {
    Write-Host (Get-LocalizedMessage -Key "startNodeMissing") -ForegroundColor Red
    throw (Get-LocalizedMessage -Key "startNodeMissing")
}

$bunVersion = bun --version 2>$null
if ($bunVersion) {
    Write-Host (Get-LocalizedMessage -Key "startBunVersion" -Arguments @($bunVersion)) -ForegroundColor Green
} else {
    Write-Host (Get-LocalizedMessage -Key "startBunMissing") -ForegroundColor Red
    throw (Get-LocalizedMessage -Key "startBunMissing")
}

# Step 2: Install dependencies
Write-Host ""
$step2 = Get-LocalizedMessage -Key "startInstallingDependencies"
Write-Host "[2/6] $step2"

Write-Host (Get-LocalizedMessage -Key "startInstallingDependenciesLive") -ForegroundColor Cyan
& bun install
Write-Host (Get-LocalizedMessage -Key "startDependencyInstallFinished") -ForegroundColor Green

# Ensure Windows .cmd shims exist (bun previously run via bash/WSL loses them).
$EnsureWinBinScript = Join-Path $PSScriptRoot "ensure_win_bin.ps1"
$RegisterScript = Join-Path $PSScriptRoot "register-local-dev.cjs"
Write-Host (Get-LocalizedMessage -Key "startCheckingCmdShims") -ForegroundColor Cyan
& $EnsureWinBinScript -WorkspaceRoot $ProjectRoot

# Quick compile+install: each package build aligns its own output incrementally.
$extensionPath = Get-Var -Key ([VarKeys]::EXTENSION_PATH)
$manifestJson = Join-Path $extensionPath "manifest.json"
Write-Host (Get-LocalizedMessage -Key "startRebuilding") -ForegroundColor Cyan

# Step 3: Build Shared package
    Write-Host ""
    $step3 = Get-LocalizedMessage -Key "startBuildingShared"
    Write-Host "[3/6] $step3"

    Write-Host (Get-LocalizedMessage -Key "startBuildingSharedLive") -ForegroundColor Cyan
    & bun run build:shared

    # Verify by artifact, not exit code (a noisy-but-successful build can return
    # nonzero; a real failure leaves the artifact missing).
    $sharedPath = Get-Var -Key ([VarKeys]::SHARED_PATH)
    if ($sharedPath -and (Test-Path $sharedPath)) {
        Write-Host (Get-LocalizedMessage -Key "startSharedBuilt") -ForegroundColor Green
    } else {
        Write-Host (Get-LocalizedMessage -Key "startSharedMissing" -Arguments @($sharedPath)) -ForegroundColor Yellow
    }

    # Step 4: Build Native Server
    Write-Host ""
    $step4 = Get-LocalizedMessage -Key "startBuildingNative"
    Write-Host "[4/6] $step4"

    Write-Host (Get-LocalizedMessage -Key "startBuildingNativeLive") -ForegroundColor Cyan
    & bun run build:native

    # Verify by artifact, not exit code.
    $nativePathProbe = Get-Var -Key ([VarKeys]::NATIVE_PATH) -Default ""
    if ($nativePathProbe -and (Test-Path $nativePathProbe)) {
        Write-Host (Get-LocalizedMessage -Key "startNativeBuilt") -ForegroundColor Green
    } else {
        Write-Host (Get-LocalizedMessage -Key "startNativeMissing" -Arguments @($nativePathProbe)) -ForegroundColor Yellow
    }

    # Step 5: Build Chrome Extension
    Write-Host ""
    $step5 = Get-LocalizedMessage -Key "startBuildingExtension"
    Write-Host "[5/6] $step5"

    & bun run build:extension

$nativePath = Get-Var -Key ([VarKeys]::NATIVE_PATH)
if (-not $extensionPath) {
    $extensionPath = Get-Var -Key ([VarKeys]::EXTENSION_PATH)
}

# Step 6: Register Native Messaging Host
Write-Host ""
$step6 = Get-LocalizedMessage -Key "startRegisteringNative"
Write-Host "[6/6] $step6"

# Verify extension manifest exists before registration
$extensionPath = Get-Var -Key ([VarKeys]::EXTENSION_PATH)
$manifestJson = Join-Path $extensionPath "manifest.json"

if (-not (Test-Path $manifestJson)) {
    Write-Host (Get-LocalizedMessage -Key "startManifestMissing" -Arguments @($manifestJson)) -ForegroundColor Red
    Write-Host (Get-LocalizedMessage -Key "startCannotRegister") -ForegroundColor Red
    throw (Get-LocalizedMessage -Key "startCannotRegister")
}

# Verify manifest has key field
try {
    $manifestContent = Get-Content $manifestJson -Raw | ConvertFrom-Json
    if (-not $manifestContent.key) {
        Write-Host (Get-LocalizedMessage -Key "startManifestKeyMissing") -ForegroundColor Yellow
        Write-Host (Get-LocalizedMessage -Key "startExtensionIdUncalculated") -ForegroundColor Yellow
        Write-Host (Get-LocalizedMessage -Key "startRegistrationWillProceed") -ForegroundColor Yellow
    }
} catch {
    Write-Host (Get-LocalizedMessage -Key "startManifestVerificationFailed") -ForegroundColor Yellow
}

Write-Host (Get-LocalizedMessage -Key "startRegisteringHost") -ForegroundColor Cyan
& node $RegisterScript

$manifestPath = Get-Var -Key ([VarKeys]::MANIFEST_PATH)
Write-Host ""
Write-Host (Get-LocalizedMessage -Key "startRegistrationVerification")
if (Test-Path $manifestPath) {
    Write-Host (Get-LocalizedMessage -Key "startManifestRegistered") -ForegroundColor Green
    Write-Host (Get-LocalizedMessage -Key "startLocation" -Arguments @($manifestPath)) -ForegroundColor DarkGray
    $manifestContent = Get-Content $manifestPath -Raw
    Write-Host (Get-LocalizedMessage -Key "startManifestContent") -ForegroundColor DarkGray
    Write-Host "  $manifestContent" -ForegroundColor DarkGray
} else {
    Write-Host (Get-LocalizedMessage -Key "startManifestFileMissing" -Arguments @($manifestPath)) -ForegroundColor Yellow
    Write-Host (Get-LocalizedMessage -Key "startHostMayFail") -ForegroundColor Yellow
}

# Verify Windows registry key
$regKeyPath = Join-Path "HKCU:\Software\Google\Chrome\NativeMessagingHosts" $NativeHostName
if (Test-Path $regKeyPath) {
    Write-Host (Get-LocalizedMessage -Key "startRegistryExists") -ForegroundColor Green
} else {
    Write-Host (Get-LocalizedMessage -Key "startRegistryMissing" -Arguments @($regKeyPath)) -ForegroundColor Yellow
    Write-Host (Get-LocalizedMessage -Key "startChromeDiscoveryMayFail") -ForegroundColor Yellow
}

# ======================================
# Success Summary
# ======================================
$extensionPath = Get-Var -Key ([VarKeys]::EXTENSION_PATH)

Write-Host ""
Write-Host "========================================"
Write-Host (Get-LocalizedMessage -Key "startComplete") -ForegroundColor Green
Write-Host "========================================"

Write-Host ""
Write-Host (Get-LocalizedMessage -Key "startImportantPaths" -Arguments @($extensionPath, $nativePath))

Write-Host ""
Write-Host "========================================"
Write-Host (Get-LocalizedMessage -Key "startNextSteps")
Write-Host "========================================"

Write-Host ""
Write-Host (Get-LocalizedMessage -Key "startInstructions" -Arguments @($extensionPath))
Write-Host ""
Write-Host "========================================"
if ($WatchMode -eq "dev") {
    Write-Host (Get-LocalizedMessage -Key "startLaunchingWatch") -ForegroundColor Yellow
    Write-Host (Get-LocalizedMessage -Key "startAutomaticRebuilds")
    Write-Host (Get-LocalizedMessage -Key "startPressStop")
} else {
    Write-Host (Get-LocalizedMessage -Key "startOneTimeComplete") -ForegroundColor Yellow
}
Write-Host "========================================"
Write-Host ""

if ($ServiceMode -ne "none") {
    $ServiceExe = (Get-Command powershell.exe -ErrorAction SilentlyContinue).Source
    if (-not $ServiceExe) {
        $ServiceExe = (Get-Command pwsh.exe -ErrorAction SilentlyContinue).Source
    }
    $ServiceArguments = [string]::Concat('-NoProfile -ExecutionPolicy Bypass -WindowStyle Hidden -File "', $PSCommandPath, '" -ServiceRun')
    [void](Register-UserLogonTask -TaskName $ServiceTaskName -Execute $ServiceExe -Arguments $ServiceArguments -WorkingDirectory $ProjectRoot -Description $ServiceDescription)
    Write-Host (Get-LocalizedMessage -Key "startServiceOwnsWatch" -Arguments @($ServiceTaskName)) -ForegroundColor Green
    Write-Host (Get-LocalizedMessage -Key "startServiceRemoveHint" -Arguments @($PSCommandPath))
    Set-Location $InitialDir
    return
}

# One cross-platform watcher (scripts/dev-watch.mjs) runs WXT dev, tsup and
# nodemon; the extension and native host reload themselves on new builds, and
# the supervisor only reconnects a disconnected extension.
Set-Location $ProjectRoot
try {
    if ($WatchMode -eq "dev") {
        $SupervisorProcess = Start-Process -FilePath $PythonExe -ArgumentList $SupervisorArguments -WindowStyle Hidden -PassThru
        Write-Host (Get-LocalizedMessage -Key "startSupervisorStarted" -Arguments @($SupervisorProcess.Id)) -ForegroundColor Green
        & node $DevWatchScript
    } else {
        & $PythonExe $SupervisorScript --wake
    }
} finally {
    Set-Location $InitialDir
}
