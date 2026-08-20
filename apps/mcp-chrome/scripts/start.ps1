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
    [switch]$InstallShortcut
)

$ErrorActionPreference = "Stop"
$ScriptDir = $null
$ProjectRoot = $null
$AppsDir = $null
$CoreNodeRoot = $null
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
$pnpmVersion = $null
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
$WatchRoots = @()
$IgnoredWatchRoots = @()
$IgnoredWatchFilePatterns = @("tsup.config.bundled_*.mjs")
$WatchedFileExtensions = @(".cjs", ".css", ".html", ".js", ".json", ".mjs", ".png", ".svg", ".ts", ".tsx", ".vue", ".wasm")
$FileWatchers = [System.Collections.Generic.List[System.IO.FileSystemWatcher]]::new()
$WatchSubscriptions = [System.Collections.Generic.List[object]]::new()
$WatchSubscription = $null
$WatchRoot = $null
$IgnoredWatchRoot = $null
$Watcher = $null
$WatchEventName = $null
$WatchSourceIdentifier = $null
$WatchSourcePrefix = "McpChromeDevelopmentWatch"
$WatchIndex = 0
$WatchDebounceMilliseconds = 750
$ChangedPaths = @()

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

function Test-DevelopmentWatchPath {
    param(
        [Parameter(Mandatory=$true)]
        [string]$Path,

        [Parameter(Mandatory=$true)]
        [string[]]$IgnoredRoots,

        [Parameter(Mandatory=$true)]
        [string[]]$IgnoredFilePatterns,

        [Parameter(Mandatory=$true)]
        [string[]]$WatchedExtensions
    )

    $ignoredRoot = $null
    $ignoredPrefix = $null
    $ignoredFilePattern = $null
    $fileName = $null
    $extension = $null

    foreach ($ignoredRoot in $IgnoredRoots) {
        $ignoredPrefix = [string]::Concat($ignoredRoot, [System.IO.Path]::DirectorySeparatorChar)
        if ($Path.Equals($ignoredRoot, [System.StringComparison]::OrdinalIgnoreCase) -or
            $Path.StartsWith($ignoredPrefix, [System.StringComparison]::OrdinalIgnoreCase)) {
            return $false
        }
    }

    $fileName = [System.IO.Path]::GetFileName($Path)
    foreach ($ignoredFilePattern in $IgnoredFilePatterns) {
        if ($fileName -like $ignoredFilePattern) {
            return $false
        }
    }

    $extension = [System.IO.Path]::GetExtension($Path)
    return $WatchedExtensions -contains $extension
}

function Wait-DevelopmentChangeBatch {
    param(
        [Parameter(Mandatory=$true)]
        [string]$SourcePrefix,

        [Parameter(Mandatory=$true)]
        [string[]]$IgnoredRoots,

        [Parameter(Mandatory=$true)]
        [string[]]$IgnoredFilePatterns,

        [Parameter(Mandatory=$true)]
        [string[]]$WatchedExtensions,

        [Parameter(Mandatory=$true)]
        [int]$DebounceMilliseconds
    )

    $changeEvent = $null
    $eventPath = $null
    $deadline = $null
    $isWatchedPath = $false
    $changedPathSet = [System.Collections.Generic.HashSet[string]]::new([System.StringComparer]::OrdinalIgnoreCase)

    while ($true) {
        $changeEvent = Wait-Event
        $eventPath = [string]$changeEvent.SourceEventArgs.FullPath
        Remove-Event -EventIdentifier $changeEvent.EventIdentifier -ErrorAction SilentlyContinue
        if (-not $changeEvent.SourceIdentifier.StartsWith($SourcePrefix, [System.StringComparison]::Ordinal)) {
            continue
        }

        $isWatchedPath = Test-DevelopmentWatchPath -Path $eventPath -IgnoredRoots $IgnoredRoots -IgnoredFilePatterns $IgnoredFilePatterns -WatchedExtensions $WatchedExtensions
        if ($isWatchedPath) {
            [void]$changedPathSet.Add($eventPath)
            break
        }
    }

    $deadline = [DateTime]::UtcNow.AddMilliseconds($DebounceMilliseconds)
    while ([DateTime]::UtcNow -lt $deadline) {
        $changeEvent = Wait-Event -Timeout 1
        if (-not $changeEvent) {
            continue
        }

        $eventPath = [string]$changeEvent.SourceEventArgs.FullPath
        Remove-Event -EventIdentifier $changeEvent.EventIdentifier -ErrorAction SilentlyContinue
        if (-not $changeEvent.SourceIdentifier.StartsWith($SourcePrefix, [System.StringComparison]::Ordinal)) {
            continue
        }

        $isWatchedPath = Test-DevelopmentWatchPath -Path $eventPath -IgnoredRoots $IgnoredRoots -IgnoredFilePatterns $IgnoredFilePatterns -WatchedExtensions $WatchedExtensions
        if ($isWatchedPath) {
            [void]$changedPathSet.Add($eventPath)
            $deadline = [DateTime]::UtcNow.AddMilliseconds($DebounceMilliseconds)
        }
    }

    return @($changedPathSet)
}

$ScriptDir = Split-Path -Parent $PSScriptRoot
$ProjectRoot = $ScriptDir
$AppsDir = Split-Path -Parent $ProjectRoot
$CoreNodeRoot = Split-Path -Parent $AppsDir
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

Write-Host ""
Write-Host "========================================"
Write-Host (Get-LocalizedMessage -Key "startBannerTitle")
Write-Host "========================================"
Write-Host ""

$WatchChoice = $env:MCP_CHROME_WATCH_MODE
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
    exit 1
}

$pnpmVersion = pnpm --version 2>$null
if ($pnpmVersion) {
    Write-Host (Get-LocalizedMessage -Key "startPnpmVersion" -Arguments @($pnpmVersion)) -ForegroundColor Green
} else {
    Write-Host (Get-LocalizedMessage -Key "startPnpmMissing") -ForegroundColor Red
    exit 1
}

# Step 2: Install dependencies
Write-Host ""
$step2 = Get-LocalizedMessage -Key "startInstallingDependencies"
Write-Host "[2/6] $step2"

Write-Host (Get-LocalizedMessage -Key "startInstallingDependenciesLive") -ForegroundColor Cyan
& pnpm install
Write-Host (Get-LocalizedMessage -Key "startDependencyInstallFinished") -ForegroundColor Green

# Ensure Windows .cmd shims exist (pnpm previously run via bash/WSL loses them).
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
    & pnpm run build:shared

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
    & pnpm run build:native

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

    & pnpm run build:extension

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
    exit 1
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
$regKeyPath = "HKCU:\Software\Google\Chrome\NativeMessagingHosts\com.chromemcp.nativehost"
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

# Shell owns source watching and runs one complete build batch per change.
# Python wakes the extension/native MCP connection after the batch, then exits.
Set-Location $ProjectRoot
try {
    if ($WatchMode -eq "dev") {
        $WatchRoots = @(
            (Join-Path (Join-Path $ProjectRoot "packages") "shared"),
            (Join-Path (Join-Path $ProjectRoot "app") "native-server"),
            (Join-Path (Join-Path $ProjectRoot "app") "chrome-extension")
        )
        $IgnoredWatchRoots = @(
            (Join-Path $WatchRoots[0] "dist"),
            (Join-Path $WatchRoots[0] "node_modules"),
            (Join-Path $WatchRoots[1] "dist"),
            (Join-Path $WatchRoots[1] "node_modules"),
            (Join-Path $WatchRoots[2] ".wxt"),
            (Join-Path $WatchRoots[2] "node_modules")
        )

        foreach ($WatchRoot in $WatchRoots) {
            $Watcher = [System.IO.FileSystemWatcher]::new($WatchRoot)
            $Watcher.IncludeSubdirectories = $true
            $Watcher.NotifyFilter = [System.IO.NotifyFilters]::FileName -bor [System.IO.NotifyFilters]::DirectoryName -bor [System.IO.NotifyFilters]::LastWrite
            $Watcher.InternalBufferSize = 65536
            foreach ($WatchEventName in @("Changed", "Created", "Deleted", "Renamed")) {
                $WatchSourceIdentifier = [string]::Concat($WatchSourcePrefix, "-", $WatchIndex, "-", $WatchEventName)
                $WatchSubscriptions.Add(
                    (Register-ObjectEvent -InputObject $Watcher -EventName $WatchEventName -SourceIdentifier $WatchSourceIdentifier)
                )
            }
            $Watcher.EnableRaisingEvents = $true
            $FileWatchers.Add($Watcher)
            $WatchIndex = $WatchIndex + 1
        }

        & $PythonExe $SupervisorScript --wake
        while ($true) {
            $ChangedPaths = @(Wait-DevelopmentChangeBatch -SourcePrefix $WatchSourcePrefix -IgnoredRoots $IgnoredWatchRoots -IgnoredFilePatterns $IgnoredWatchFilePatterns -WatchedExtensions $WatchedFileExtensions -DebounceMilliseconds $WatchDebounceMilliseconds)
            Write-Host ([string]::Join(", ", $ChangedPaths)) -ForegroundColor DarkGray
            & pnpm run build:shared
            & pnpm run build:native
            & pnpm run build:extension
            & $PythonExe $SupervisorScript --wake
        }
    } else {
        & $PythonExe $SupervisorScript --wake
    }
} finally {
    foreach ($WatchSubscription in $WatchSubscriptions) {
        Unregister-Event -SubscriptionId $WatchSubscription.SubscriptionId -ErrorAction SilentlyContinue
    }
    foreach ($Watcher in $FileWatchers) {
        $Watcher.Dispose()
    }
    Set-Location $InitialDir
}
