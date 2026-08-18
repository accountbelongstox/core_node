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

# Android SDK build packages for Capacitor/AGP builds (headless, no Android Studio
# required). IDEMPOTENT PER DETAIL - every component is gated by BINARY EXISTENCE
# and repaired only when missing:
#   1. SDK root      : reuse first valid existing root, else create canonical root
#   2. cmdline-tools : <root>\cmdline-tools\latest\bin\sdkmanager.bat
#   3. licenses      : accepted via sdkmanager --licenses
#   4. platform-tools: <root>\platform-tools\adb.exe
#   5. platform      : <root>\platforms\android-36\android.jar
#   6. build-tools   : <root>\build-tools\36.0.0
# Constants and detectors are CENTRALIZED in win_common/AndroidBuildEnv.ps1
# (shared with start_build.ps1). Requires a JDK 21
# (Step21_InstallApplications.ps1 -ExactPackageName Java, or the JDK bundled with
# Android Studio).

. "$PSScriptRoot\..\win_common\GlobalVars.ps1"
. "$PSScriptRoot\..\win_common\CommonFunc.ps1"
. "$PSScriptRoot\..\win_common\AndroidBuildEnv.ps1"

$windowsPathFunctionPath = Join-Path (Split-Path $PSScriptRoot -Parent) "win_common\WindowsPathFunction.ps1"

$STEP_NUMBER = 62

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
$PlatformJar = $null
$BuildToolsDir = $null

# Run sdkmanager with a stdin "yes" stream (license prompts). All inputs are
# parameters - no caller-scope dependencies.
function Invoke-StepSdkManager {
    param([string]$ManagerPath, [string]$RootDir, [string]$YesFilePath, [string]$ArgumentsLine)
    $SdkCmdLine = "`"$ManagerPath`" --sdk_root=`"$RootDir`" $ArgumentsLine < `"$YesFilePath`""
    cmd /c $SdkCmdLine
}

function Step62_InstallAndroidSdkPackages {
    Write-ColorMessage -Message "[Step $STEP_NUMBER] Android SDK build packages (per-detail idempotent)..." -Type "Info"

    Resolve-AndroidBuildJavaHome
    if (-not (Test-AndroidBuildJavaReady)) {
        Write-ColorMessage -Message "[Step $STEP_NUMBER] JDK $($Global:ANDROID_BUILD_REQUIRED_JAVA_MAJOR)+ not found. Run Step21_InstallApplications.ps1 -ExactPackageName Java first." -Type "Error"
        return
    }
    $env:JAVA_HOME = $Global:ANDROID_BUILD_JAVA_HOME
    $env:Path = "$(Join-Path $Global:ANDROID_BUILD_JAVA_HOME 'bin');$env:Path"
    Write-ColorMessage -Message "[Step $STEP_NUMBER] Using JDK: $($Global:ANDROID_BUILD_JAVA_HOME)" -Type "Success"
    [void](Set-AndroidBuildJavaProxy)

    Resolve-AndroidBuildSdkRoot
    $SdkRoot = $Global:ANDROID_BUILD_SDK_ROOT
    Write-ColorMessage -Message "[Step $STEP_NUMBER] SDK root: $SdkRoot" -Type "Info"

    # --- Detail: cmdline-tools (binary gate: sdkmanager.bat) ---
    $LatestDir = Join-Path $SdkRoot "cmdline-tools\latest"
    $SdkManager = Get-AndroidBuildSdkManagerPath -RootDir $SdkRoot
    if (-not $SdkManager) {
        Write-ColorMessage -Message "[Step $STEP_NUMBER] cmdline-tools missing -> downloading official cmdline-tools..." -Type "Warning"
        $ZipPath = Join-Path $Global:DOWNLOADS_DIR "commandlinetools-win.zip"
        [void](Get-FileWithSizeCheck -localPath $ZipPath -remoteUrl $Global:ANDROID_BUILD_CMDLINE_TOOLS_URL -description "Android cmdline-tools")
        if (-not (Test-Path -LiteralPath $ZipPath)) {
            Write-ColorMessage -Message "[Step $STEP_NUMBER] cmdline-tools download failed." -Type "Error"
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
        Write-ColorMessage -Message "[Step $STEP_NUMBER] sdkmanager not available under: $SdkRoot" -Type "Error"
        return
    }
    Write-ColorMessage -Message "[Step $STEP_NUMBER] cmdline-tools ready: $SdkManager" -Type "Success"

    # stdin "yes" stream for license prompts
    $YesDir = Join-Path $Global:DOWNLOADS_DIR "android-sdk-step62"
    if (-not (Test-Path -LiteralPath $YesDir)) { New-Item -ItemType Directory -Path $YesDir -Force | Out-Null }
    $YesFile = Join-Path $YesDir "licenses-yes.txt"
    $YesContent = @("y") * 20
    $YesContent | Set-Content -LiteralPath $YesFile -Encoding ascii

    # --- Detail: licenses (cheap, always accepted; sdkmanager keeps them recorded) ---
    Write-ColorMessage -Message "[Step $STEP_NUMBER] Accepting Android SDK licenses..." -Type "Info"
    [void](Invoke-StepSdkManager -ManagerPath $SdkManager -RootDir $SdkRoot -YesFilePath $YesFile -ArgumentsLine "--licenses")

    # --- Detail: platform-tools (binary gate: adb.exe) ---
    if (Test-Path -LiteralPath (Join-Path $SdkRoot "platform-tools\adb.exe")) {
        Write-ColorMessage -Message "[Step $STEP_NUMBER] platform-tools already present." -Type "Success"
    } else {
        Write-ColorMessage -Message "[Step $STEP_NUMBER] Installing platform-tools..." -Type "Warning"
        [void](Invoke-StepSdkManager -ManagerPath $SdkManager -RootDir $SdkRoot -YesFilePath $YesFile -ArgumentsLine "platform-tools")
    }

    # --- Detail: platform android-36 (binary gate: android.jar) ---
    $PlatformJar = Join-Path $SdkRoot ("platforms\android-$($Global:ANDROID_BUILD_API)\android.jar")
    if (Test-Path -LiteralPath $PlatformJar) {
        Write-ColorMessage -Message "[Step $STEP_NUMBER] platform android-$($Global:ANDROID_BUILD_API) already present." -Type "Success"
    } else {
        Write-ColorMessage -Message "[Step $STEP_NUMBER] Installing platforms;android-$($Global:ANDROID_BUILD_API)..." -Type "Warning"
        [void](Invoke-StepSdkManager -ManagerPath $SdkManager -RootDir $SdkRoot -YesFilePath $YesFile -ArgumentsLine "`"platforms;android-$($Global:ANDROID_BUILD_API)`"")
    }

    # --- Detail: build-tools 36.0.0 (binary gate: build-tools dir) ---
    $BuildToolsDir = Join-Path $SdkRoot ("build-tools\$($Global:ANDROID_BUILD_TOOLS)")
    if (Test-Path -LiteralPath $BuildToolsDir) {
        Write-ColorMessage -Message "[Step $STEP_NUMBER] build-tools $($Global:ANDROID_BUILD_TOOLS) already present." -Type "Success"
    } else {
        Write-ColorMessage -Message "[Step $STEP_NUMBER] Installing build-tools;$($Global:ANDROID_BUILD_TOOLS)..." -Type "Warning"
        [void](Invoke-StepSdkManager -ManagerPath $SdkManager -RootDir $SdkRoot -YesFilePath $YesFile -ArgumentsLine "`"build-tools;$($Global:ANDROID_BUILD_TOOLS)`"")
    }

    # --- Detail: environment variables (idempotent setvar/PATH add) ---
    [void](& $windowsPathFunctionPath "setvar" "ANDROID_HOME" $SdkRoot)
    [void](& $windowsPathFunctionPath "setvar" "ANDROID_SDK_ROOT" $SdkRoot)
    [void](& $windowsPathFunctionPath "add" (Join-Path $SdkRoot "platform-tools"))
    [void](& $windowsPathFunctionPath "add" (Join-Path $LatestDir "bin"))
    Write-ColorMessage -Message "[Step $STEP_NUMBER] ANDROID_HOME/ANDROID_SDK_ROOT/PATH wired to: $SdkRoot" -Type "Success"

    $env:ANDROID_HOME = $SdkRoot
    $env:ANDROID_SDK_ROOT = $SdkRoot
    Write-ColorMessage -Message "[Step $STEP_NUMBER] Android SDK build packages step completed" -Type "Success"
    Write-ColorMessage -Message "----------------------------------------------------------------" -Type "Info"
}

Step62_InstallAndroidSdkPackages
