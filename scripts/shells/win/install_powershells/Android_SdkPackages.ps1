# Android SDK build packages for Capacitor/AGP builds (headless, no Android Studio
# required). IDEMPOTENT PER DETAIL - every component is gated by BINARY EXISTENCE
# and repaired only when missing:
#   1. SDK root      : reuse first valid existing root, else create canonical root
#   2. cmdline-tools : <root>\cmdline-tools\latest\bin\sdkmanager.bat
#   3. licenses      : <root>\licenses\android-sdk-license (sdkmanager --licenses)
#   4-6. packages    : platform-tools (adb.exe), platforms;android-36 (android.jar),
#                      build-tools;36.0.0 (aapt2.exe) - each valid only when its dir has
#                      package.xml AND its binary exists (sdkmanager-recognized);
#                      only unrecognized packages are reinstalled (platform-tools-2 is
#                      folded back into platform-tools)
# -Check reports every detail and changes nothing (Linux: 187_install_android_sdk.sh --check).
# Constants and detectors are CENTRALIZED in win_common/AndroidBuildEnv.ps1
# (shared with start_build.ps1). Requires a JDK 21
# (Step21_InstallApplications.ps1 -ExactPackageName Java, or the JDK bundled with
# Android Studio).

param(
    [switch]$Check
)

. (Join-Path (Join-Path (Split-Path $PSScriptRoot -Parent) "win_common") "GlobalVars.ps1")
. (Join-Path (Join-Path (Split-Path $PSScriptRoot -Parent) "win_common") "CommonFunc.ps1")
. (Join-Path (Join-Path (Split-Path $PSScriptRoot -Parent) "win_common") "AndroidBuildEnv.ps1")

$windowsPathFunctionPath = Join-Path (Split-Path $PSScriptRoot -Parent) "win_common\WindowsPathFunction.ps1"

$COMPONENT_ID = 'Android_SdkPackages'

# Step-local working state (all cross-function data flows via parameters)
$SdkRoot = $null
$SdkManager = $null
$LatestDir = $null
$YesFile = $null
$ZipPath = $null
$ExtractDir = $null
$StagingDir = $null
$YesDir = $null
$YesContent = @()
$SdkCmdLine = ""
$LicenseFile = $null
$MissingDetails = @()

# Report one detail of the -Check pass.
function Write-StepCheckDetail {
    param([string]$Detail, [bool]$Ready, [string]$Evidence)
    if ($Ready) {
        Write-ColorMessage -Message "[$COMPONENT_ID] check: $Detail ready: $Evidence" -Type "Success"
    } else {
        Write-ColorMessage -Message "[$COMPONENT_ID] check: $Detail missing: $Evidence" -Type "Warning"
    }
}

# Report-only pass: evaluates the same binary gates as the install pass and
# changes nothing (no download, no sdkmanager, no environment write).
function Test-AndroidSdkBuildPackages {
    Write-ColorMessage -Message "[$COMPONENT_ID] Android SDK build packages check (report only)..." -Type "Info"
    $MissingDetails = @()

    Resolve-AndroidBuildJavaHome
    if (Test-AndroidBuildJavaReady) {
        Write-StepCheckDetail -Detail "JDK $($Global:ANDROID_BUILD_REQUIRED_JAVA_MAJOR)+" -Ready $true -Evidence $Global:ANDROID_BUILD_JAVA_HOME
    } else {
        Write-StepCheckDetail -Detail "JDK $($Global:ANDROID_BUILD_REQUIRED_JAVA_MAJOR)+" -Ready $false -Evidence "install it with Step21_InstallApplications.ps1 -ExactPackageName Java"
        $MissingDetails += "jdk"
    }

    Resolve-AndroidBuildSdkRoot
    $SdkRoot = $Global:ANDROID_BUILD_SDK_ROOT
    Write-ColorMessage -Message "[$COMPONENT_ID] check: SDK root: $SdkRoot" -Type "Info"

    $SdkManager = Get-AndroidBuildSdkManagerPath -RootDir $SdkRoot
    Write-StepCheckDetail -Detail "cmdline-tools" -Ready ([bool]$SdkManager) -Evidence (Join-Path $SdkRoot "cmdline-tools\latest\bin\sdkmanager.bat")
    if (-not $SdkManager) { $MissingDetails += "cmdline-tools" }

    $LicenseFile = Join-Path $SdkRoot $Global:ANDROID_BUILD_LICENSE_FILE
    Write-StepCheckDetail -Detail "licenses" -Ready (Test-AndroidBuildSdkLicensesReady) -Evidence $LicenseFile
    if (-not (Test-AndroidBuildSdkLicensesReady)) { $MissingDetails += "licenses" }

    $UnrecognizedPackages = @(Get-AndroidBuildMissingPackages -RootDir $SdkRoot)
    foreach ($PackageId in (Get-AndroidBuildRequiredPackages)) {
        $PackageReady = ($UnrecognizedPackages -notcontains $PackageId)
        Write-StepCheckDetail -Detail "package $PackageId" -Ready $PackageReady -Evidence (Get-AndroidBuildPackageMarker -RootDir $SdkRoot -PackageId $PackageId)
        if (-not $PackageReady) { $MissingDetails += $PackageId }
    }

    Write-StepCheckDetail -Detail "ANDROID_HOME" -Ready ($env:ANDROID_HOME -eq $SdkRoot) -Evidence "ANDROID_HOME=$($env:ANDROID_HOME)"
    if ($env:ANDROID_HOME -ne $SdkRoot) { $MissingDetails += "env" }

    if ($MissingDetails.Count -eq 0) {
        Write-ColorMessage -Message "[$COMPONENT_ID] check: all details ready." -Type "Success"
    } else {
        Write-ColorMessage -Message "[$COMPONENT_ID] check: missing: $($MissingDetails -join ','). Run without -Check to repair them." -Type "Warning"
    }
    Write-ColorMessage -Message "----------------------------------------------------------------" -Type "Info"
}

# Run sdkmanager with a stdin "yes" stream (license prompts). All inputs are
# parameters - no caller-scope dependencies.
function Invoke-StepSdkManager {
    param([string]$ManagerPath, [string]$RootDir, [string]$YesFilePath, [string]$ArgumentsLine)
    $SdkCmdLine = "`"$ManagerPath`" --sdk_root=`"$RootDir`" $ArgumentsLine < `"$YesFilePath`""
    cmd /c $SdkCmdLine
}

function Android_SdkPackages {
    Write-ColorMessage -Message "[$COMPONENT_ID] Android SDK build packages (per-detail idempotent)..." -Type "Info"

    Resolve-AndroidBuildJavaHome
    if (-not (Test-AndroidBuildJavaReady)) {
        Write-ColorMessage -Message "[$COMPONENT_ID] JDK $($Global:ANDROID_BUILD_REQUIRED_JAVA_MAJOR)+ not found. Run Step21_InstallApplications.ps1 -ExactPackageName Java first." -Type "Error"
        return
    }
    $env:JAVA_HOME = $Global:ANDROID_BUILD_JAVA_HOME
    $env:Path = "$(Join-Path $Global:ANDROID_BUILD_JAVA_HOME 'bin');$env:Path"
    Write-ColorMessage -Message "[$COMPONENT_ID] Using JDK: $($Global:ANDROID_BUILD_JAVA_HOME)" -Type "Success"
    [void](Set-AndroidBuildJavaProxy)

    Resolve-AndroidBuildSdkRoot
    $SdkRoot = $Global:ANDROID_BUILD_SDK_ROOT
    Write-ColorMessage -Message "[$COMPONENT_ID] SDK root: $SdkRoot" -Type "Info"

    # --- Detail: cmdline-tools (binary gate: sdkmanager.bat) ---
    $LatestDir = Join-Path $SdkRoot "cmdline-tools\latest"
    $SdkManager = Get-AndroidBuildSdkManagerPath -RootDir $SdkRoot
    if (-not $SdkManager) {
        Write-ColorMessage -Message "[$COMPONENT_ID] cmdline-tools missing -> downloading official cmdline-tools..." -Type "Warning"
        $ZipPath = Join-Path $Global:DOWNLOADS_DIR "commandlinetools-win.zip"
        [void](Get-FileWithSizeCheck -localPath $ZipPath -remoteUrl $Global:ANDROID_BUILD_CMDLINE_TOOLS_URL -description "Android cmdline-tools")
        if (-not (Test-Path -LiteralPath $ZipPath)) {
            Write-ColorMessage -Message "[$COMPONENT_ID] cmdline-tools download failed." -Type "Error"
            return
        }
        $ExtractDir = Join-Path $Global:DOWNLOADS_DIR "cmdline-tools-extract"
        if (Test-Path -LiteralPath $ExtractDir) { Remove-Item -LiteralPath $ExtractDir -Recurse -Force }
        Expand-Archive -LiteralPath $ZipPath -DestinationPath $ExtractDir -Force
        $StagingDir = Join-Path $Global:DOWNLOADS_DIR "cmdline-tools-staging"
        if (Test-Path -LiteralPath $StagingDir) { Remove-Item -LiteralPath $StagingDir -Recurse -Force }
        Move-Item -LiteralPath (Join-Path $ExtractDir "cmdline-tools") -Destination $StagingDir
        New-Item -ItemType Directory -Force -Path (Split-Path -Parent $LatestDir) | Out-Null
        if (Test-Path -LiteralPath $LatestDir) { Remove-Item -LiteralPath $LatestDir -Recurse -Force }
        Move-Item -LiteralPath $StagingDir -Destination $LatestDir
        Remove-Item -LiteralPath $ExtractDir -Recurse -Force -ErrorAction SilentlyContinue
        $SdkManager = Get-AndroidBuildSdkManagerPath -RootDir $SdkRoot
    }
    if (-not $SdkManager) {
        Write-ColorMessage -Message "[$COMPONENT_ID] sdkmanager not available under: $SdkRoot" -Type "Error"
        return
    }
    Write-ColorMessage -Message "[$COMPONENT_ID] cmdline-tools ready: $SdkManager" -Type "Success"

    # stdin "yes" stream for license prompts
    $YesDir = Join-Path $Global:DOWNLOADS_DIR "android-sdk-step62"
    if (-not (Test-Path -LiteralPath $YesDir)) { New-Item -ItemType Directory -Path $YesDir -Force | Out-Null }
    $YesFile = Join-Path $YesDir "licenses-yes.txt"
    $YesContent = @("y") * 20
    $YesContent | Set-Content -LiteralPath $YesFile -Encoding ascii

    # --- Detail: licenses (file gate: licenses\android-sdk-license; package installs below also accept inline) ---
    if (Test-AndroidBuildSdkLicensesReady) {
        Write-ColorMessage -Message "[$COMPONENT_ID] Android SDK licenses already accepted." -Type "Success"
    } else {
        Write-ColorMessage -Message "[$COMPONENT_ID] Accepting Android SDK licenses..." -Type "Info"
        [void](Invoke-StepSdkManager -ManagerPath $SdkManager -RootDir $SdkRoot -YesFilePath $YesFile -ArgumentsLine "--licenses")
    }

    # --- Detail: platform-tools (recognized = package.xml + adb.exe) ---
    $PlatformToolsDir = Join-Path $SdkRoot "platform-tools"
    $PlatformToolsAltDir = Join-Path $SdkRoot "platform-tools-2"
    if (Test-AndroidBuildPackageManaged -RootDir $SdkRoot -PackageId "platform-tools") {
        Write-ColorMessage -Message "[$COMPONENT_ID] platform-tools recognized by the SDK manager." -Type "Success"
    } else {
        Write-ColorMessage -Message "[$COMPONENT_ID] platform-tools not SDK-managed -> repairing..." -Type "Warning"
        Get-Process -Name adb -ErrorAction SilentlyContinue | Stop-Process -Force -ErrorAction SilentlyContinue
        if ((Test-Path -LiteralPath (Join-Path $PlatformToolsAltDir "package.xml")) -and (Test-Path -LiteralPath (Join-Path $PlatformToolsAltDir "adb.exe"))) {
            Remove-Item -LiteralPath $PlatformToolsDir -Recurse -Force -ErrorAction SilentlyContinue
            Move-Item -LiteralPath $PlatformToolsAltDir -Destination $PlatformToolsDir
        } else {
            Remove-Item -LiteralPath $PlatformToolsDir -Recurse -Force -ErrorAction SilentlyContinue
            [void](Invoke-StepSdkManager -ManagerPath $SdkManager -RootDir $SdkRoot -YesFilePath $YesFile -ArgumentsLine "platform-tools")
        }
    }
    if ((Test-AndroidBuildPackageManaged -RootDir $SdkRoot -PackageId "platform-tools") -and (Test-Path -LiteralPath $PlatformToolsAltDir)) {
        Remove-Item -LiteralPath $PlatformToolsAltDir -Recurse -Force -ErrorAction SilentlyContinue
    }

    # --- Details: platforms and build-tools (reinstall exactly the unrecognized packages) ---
    foreach ($PackageId in @(Get-AndroidBuildMissingPackages -RootDir $SdkRoot)) {
        if ($PackageId -eq "platform-tools") { continue }
        Write-ColorMessage -Message "[$COMPONENT_ID] Installing $PackageId..." -Type "Warning"
        Remove-Item -LiteralPath (Get-AndroidBuildPackageDir -RootDir $SdkRoot -PackageId $PackageId) -Recurse -Force -ErrorAction SilentlyContinue
        [void](Invoke-StepSdkManager -ManagerPath $SdkManager -RootDir $SdkRoot -YesFilePath $YesFile -ArgumentsLine "`"$PackageId`"")
    }

    # --- Detail: environment variables (idempotent setvar/PATH add) ---
    [void](& $windowsPathFunctionPath "setvar" "ANDROID_HOME" $SdkRoot)
    [void](& $windowsPathFunctionPath "setvar" "ANDROID_SDK_ROOT" $SdkRoot)
    [void](& $windowsPathFunctionPath "add" (Join-Path $SdkRoot "platform-tools"))
    [void](& $windowsPathFunctionPath "add" (Join-Path $LatestDir "bin"))
    Write-ColorMessage -Message "[$COMPONENT_ID] ANDROID_HOME/ANDROID_SDK_ROOT/PATH wired to: $SdkRoot" -Type "Success"

    $env:ANDROID_HOME = $SdkRoot
    $env:ANDROID_SDK_ROOT = $SdkRoot
    Write-ColorMessage -Message "[$COMPONENT_ID] Android SDK build packages step completed" -Type "Success"
    Write-ColorMessage -Message "----------------------------------------------------------------" -Type "Info"
}

if ($Check) {
    Test-AndroidSdkBuildPackages
} else {
    Android_SdkPackages
}
