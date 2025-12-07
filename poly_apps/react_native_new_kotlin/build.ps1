param(
    [switch]$Clean,
    [ValidateSet("Debug", "Release")]
    [string]$Configuration = "Debug",
    [ValidateSet("android", "iosSimulatorArm64", "iosArm64")]
    [string]$Platform = "android"
)

$projectDir = Split-Path -Parent $MyInvocation.MyCommand.Path
Set-Location $projectDir

$gradleWrapper = Join-Path $projectDir "gradlew.bat"

function Get-AdbPath {
    $cmd = Get-Command adb -ErrorAction SilentlyContinue
    if ($cmd) {
        return $cmd.Source
    }

    $candidates = @()
    if ($env:ANDROID_HOME) {
        $candidates += (Join-Path $env:ANDROID_HOME "platform-tools\adb.exe")
    }
    if ($env:ANDROID_SDK_ROOT) {
        $candidates += (Join-Path $env:ANDROID_SDK_ROOT "platform-tools\adb.exe")
    }
    $candidates += "C:\Users\accou\AppData\Local\Android\Sdk\platform-tools\adb.exe"

    foreach ($candidate in $candidates) {
        if ($candidate -and (Test-Path $candidate)) {
            return $candidate
        }
    }

    return $null
}

function Ensure-GradleWrapper {
    param(
        [string]$WrapperPath
    )

    if (Test-Path $WrapperPath) {
        return
    }

    Write-Host "Gradle wrapper not found. Attempting to bootstrap..."

    $toolsDir = Join-Path $projectDir "..\\..\\tools"
    $gradleHome = Join-Path $toolsDir "gradle-8.9"
    if (-not (Test-Path $gradleHome)) {
        Write-Host "Downloading Gradle 8.9 to $gradleHome"
        $zipPath = Join-Path $env:TEMP "gradle-8.9-bin.zip"
        Invoke-WebRequest -Uri "https://services.gradle.org/distributions/gradle-8.9-bin.zip" -OutFile $zipPath
        Expand-Archive -Path $zipPath -DestinationPath $toolsDir -Force
        Remove-Item $zipPath -Force
    }

    $gradleExe = Join-Path $gradleHome "bin\\gradle.bat"
    if (-not (Test-Path $gradleExe)) {
        throw "Unable to locate Gradle executable at $gradleExe"
    }

    & $gradleExe wrapper
    if ($LASTEXITCODE -ne 0) {
        throw "Failed to generate Gradle wrapper."
    }
}

Ensure-GradleWrapper -WrapperPath $gradleWrapper

$tasks = @()
if ($Clean) {
    $tasks += "clean"
}

$task = switch ($Platform) {
    "android" {
        if ($Configuration -eq "Release") { "composeApp:assembleRelease" } else { "composeApp:assembleDebug" }
    }
    "iosSimulatorArm64" {
        if ($Configuration -eq "Release") { "composeApp:linkReleaseFrameworkIosSimulatorArm64" } else { "composeApp:linkDebugFrameworkIosSimulatorArm64" }
    }
    "iosArm64" {
        if ($Configuration -eq "Release") { "composeApp:linkReleaseFrameworkIosArm64" } else { "composeApp:linkDebugFrameworkIosArm64" }
    }
    default { throw "Unsupported platform $Platform" }
}
$tasks += $task

Write-Host ">>> Running tasks: $($tasks -join ', ')"
$gradleDisplay = "& `"$gradleWrapper`" $($tasks -join ' ')"
Write-Host ">>> Command: $gradleDisplay"
& $gradleWrapper @tasks
if ($LASTEXITCODE -ne 0) {
    Write-Error "Gradle build failed."
    exit $LASTEXITCODE
}

Write-Host "Build completed."

if ($Platform -ne "android") {
    Write-Host "Non-Android target selected; skipping adb push."
    exit 0
}

$apkDir = Join-Path $projectDir "composeApp/build/outputs/apk/$($Configuration.ToLower())"
if (-not (Test-Path $apkDir)) {
    Write-Warning "APK output directory '$apkDir' not found."
    exit 0
}

$apk = Get-ChildItem -Path $apkDir -Filter "*.apk" | Sort-Object LastWriteTime -Descending | Select-Object -First 1
if (-not $apk) {
    Write-Warning "No APK found under $apkDir."
    exit 0
}

$adbPath = Get-AdbPath
if (-not $adbPath) {
    Write-Warning "ADB not found. Please ensure Android platform-tools are installed and in PATH."
    exit 0
}

Write-Host ">>> Installing $($apk.Name) to connected Android device..."
$adbDisplay = "`"$adbPath`" install -r `"$($apk.FullName)`""
Write-Host ">>> Command: $adbDisplay"
& $adbPath install -r $apk.FullName
if ($LASTEXITCODE -ne 0) {
    Write-Warning "adb install failed."
    exit 0
}

Write-Host "adb install complete."
