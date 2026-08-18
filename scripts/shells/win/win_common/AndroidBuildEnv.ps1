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

# Central Android build environment library (single source of truth) for the
# Capacitor/AGP toolchain. Dot-source AFTER GlobalVars.ps1. Consumers:
#   install_powershells/Step62_InstallAndroidSdkPackages.ps1 (dd idempotent step)
#   poly_apps/pycore_laravel_wordnew_ui/scripts/start_build.ps1 (build entry)
# All detection is by BINARY EXISTENCE; all shared state lives in $Global: scope so
# functions never depend on caller scope chains. Toolchain versions follow
# Capacitor 8 / AGP 8.13 (compile/targetSdk 36, build-tools 36.0.0, JDK 21).

if (-not $Global:CORE_NODE_CACHE_DIR) {
    $androidBuildLibError = "AndroidBuildEnv.ps1 requires GlobalVars.ps1 to be dot-sourced first (CORE_NODE_CACHE_DIR missing)."
    throw $androidBuildLibError
}

# ---------- Central toolchain constants ----------
$Global:ANDROID_BUILD_REQUIRED_JAVA_MAJOR = 21
$Global:ANDROID_BUILD_API = 36
$Global:ANDROID_BUILD_TOOLS = "36.0.0"
$Global:ANDROID_BUILD_CMDLINE_TOOLS_URL = "https://dl.google.com/android/repository/commandlinetools-win-14742923_latest.zip"
$Global:ANDROID_BUILD_SDK_CACHE_ROOT = Join-Path (Join-Path $Global:CORE_NODE_CACHE_DIR "pycore") "android-build\android-sdk"
$Global:ANDROID_BUILD_JDK_REGISTRY_KEYS = @(
    "HKLM:\SOFTWARE\Eclipse Adoptium\JDK",
    "HKLM:\SOFTWARE\JavaSoft\JDK"
)
$Global:ANDROID_BUILD_JDK_VENDOR_ROOTS = @(
    (Join-Path $Env:ProgramFiles "Eclipse Adoptium"),
    (Join-Path $Env:ProgramFiles "Java"),
    (Join-Path $Env:ProgramFiles "Oracle")
)

# ---------- Central shared state (filled by Resolve-* detectors) ----------
$Global:ANDROID_BUILD_JAVA_HOME = $null
$Global:ANDROID_BUILD_SDK_ROOT = $null

# ---------- Detectors (pure; read/write only $Global: state or params) ----------

function Get-AndroidBuildJavaMajor {
    param([string]$JavaExe)
    try {
        $versionLine = (& $JavaExe -version 2>&1 | Select-Object -First 1) -join ""
        if ($versionLine -match 'version "(\d+)(?:\.(\d+))?') {
            if ($Matches[1] -eq "1" -and $Matches[2]) { return [int]$Matches[2] }
            return [int]$Matches[1]
        }
    } catch { }
    return 0
}

function Test-AndroidBuildJavaHome {
    param([string]$HomeDir)
    if (-not $HomeDir) { return $false }
    return (Test-Path -LiteralPath (Join-Path $HomeDir "bin\java.exe"))
}

# Fill $Global:ANDROID_BUILD_JAVA_HOME by BINARY EXISTENCE: env JAVA_HOME ->
# registry JavaHome (Temurin MSI / JavaSoft) -> PATH java -> vendor dirs
# (recursive) -> Android Studio jbr (dd constant).
function Resolve-AndroidBuildJavaHome {
    $candidates = @()
    if ($env:JAVA_HOME) { $candidates += $env:JAVA_HOME }
    $candidates += [System.Environment]::GetEnvironmentVariable("JAVA_HOME", "Machine")
    foreach ($registryKey in $Global:ANDROID_BUILD_JDK_REGISTRY_KEYS) {
        if (-not (Test-Path -LiteralPath $registryKey)) { continue }
        foreach ($registryNode in (Get-ChildItem -LiteralPath $registryKey -Recurse -Depth 2 -ErrorAction SilentlyContinue)) {
            # Property-index access: safe under ErrorActionPreference=Stop when the
            # key exists but has no JavaHome value (e.g. Oracle JavaSoft subkeys).
            $registryProps = Get-ItemProperty -LiteralPath $registryNode.PSPath -ErrorAction SilentlyContinue
            if ($null -eq $registryProps) { continue }
            $javaHomeProperty = $registryProps.PSObject.Properties["JavaHome"]
            if ($javaHomeProperty -and $javaHomeProperty.Value) { $candidates += $javaHomeProperty.Value }
        }
    }
    $javaOnPath = Get-Command java -ErrorAction SilentlyContinue
    if ($javaOnPath) {
        $javaBinDir = Split-Path -Parent $javaOnPath.Source
        $candidates += (Split-Path -Parent $javaBinDir)
    }
    foreach ($vendorRoot in $Global:ANDROID_BUILD_JDK_VENDOR_ROOTS) {
        if (-not (Test-Path -LiteralPath $vendorRoot)) { continue }
        $candidates += (Get-ChildItem -LiteralPath $vendorRoot -Recurse -Depth 2 -Directory -Filter "jdk*" -ErrorAction SilentlyContinue | Select-Object -ExpandProperty FullName)
    }
    $studioJbr = Join-Path $Global:ANDROID_STUDIO_DIR "jbr"
    $candidates += $studioJbr
    foreach ($candidate in $candidates) {
        if (-not (Test-AndroidBuildJavaHome -HomeDir $candidate)) { continue }
        $candidateJava = Join-Path $candidate "bin\java.exe"
        if ((Get-AndroidBuildJavaMajor -JavaExe $candidateJava) -ge $Global:ANDROID_BUILD_REQUIRED_JAVA_MAJOR) {
            $Global:ANDROID_BUILD_JAVA_HOME = $candidate
            return
        }
    }
    $Global:ANDROID_BUILD_JAVA_HOME = $null
}

# True when a JDK home is resolved AND its java.exe exists AND major >= required.
function Test-AndroidBuildJavaReady {
    if (-not (Test-AndroidBuildJavaHome -HomeDir $Global:ANDROID_BUILD_JAVA_HOME)) { return $false }
    $resolvedJava = Join-Path $Global:ANDROID_BUILD_JAVA_HOME "bin\java.exe"
    return ((Get-AndroidBuildJavaMajor -JavaExe $resolvedJava) -ge $Global:ANDROID_BUILD_REQUIRED_JAVA_MAJOR)
}

# True when an SDK root contains a usable sdkmanager or adb (binary existence).
function Test-AndroidBuildSdkRoot {
    param([string]$RootDir)
    if (-not $RootDir) { return $false }
    $managerLatest = Join-Path $RootDir "cmdline-tools\latest\bin\sdkmanager.bat"
    $managerLegacy = Join-Path $RootDir "cmdline-tools\bin\sdkmanager.bat"
    $adb = Join-Path $RootDir "platform-tools\adb.exe"
    if (Test-Path -LiteralPath $managerLatest) { return $true }
    if (Test-Path -LiteralPath $managerLegacy) { return $true }
    return (Test-Path -LiteralPath $adb)
}

# Fill $Global:ANDROID_BUILD_SDK_ROOT by BINARY EXISTENCE: env -> dd canonical
# constant -> per-user default -> cache-constant fallback.
function Resolve-AndroidBuildSdkRoot {
    $candidates = @(
        $env:ANDROID_HOME,
        $env:ANDROID_SDK_ROOT,
        $Global:ANDROID_SDK_DIR,
        (Join-Path $env:LOCALAPPDATA "Android\Sdk"),
        $Global:ANDROID_BUILD_SDK_CACHE_ROOT
    )
    foreach ($candidate in $candidates) {
        if (-not $candidate) { continue }
        if (Test-AndroidBuildSdkRoot -RootDir $candidate) {
            $Global:ANDROID_BUILD_SDK_ROOT = $candidate
            return
        }
    }
    $Global:ANDROID_BUILD_SDK_ROOT = $Global:ANDROID_BUILD_SDK_CACHE_ROOT
}

function Get-AndroidBuildSdkManagerPath {
    param([string]$RootDir)
    if (-not $RootDir) { return $null }
    $managerLatest = Join-Path $RootDir "cmdline-tools\latest\bin\sdkmanager.bat"
    if (Test-Path -LiteralPath $managerLatest) { return $managerLatest }
    $managerLegacy = Join-Path $RootDir "cmdline-tools\bin\sdkmanager.bat"
    if (Test-Path -LiteralPath $managerLegacy) { return $managerLegacy }
    return $null
}

# True when sdkmanager.bat + adb.exe + platform android.jar + build-tools all exist.
function Test-AndroidBuildSdkReady {
    $root = $Global:ANDROID_BUILD_SDK_ROOT
    if (-not $root) { return $false }
    if (-not (Get-AndroidBuildSdkManagerPath -RootDir $root)) { return $false }
    $adbPath = Join-Path $root "platform-tools\adb.exe"
    $platformJar = Join-Path $root ("platforms\android-$($Global:ANDROID_BUILD_API)\android.jar")
    $buildToolsDir = Join-Path $root ("build-tools\$($Global:ANDROID_BUILD_TOOLS)")
    return ((Test-Path -LiteralPath $adbPath) -and (Test-Path -LiteralPath $platformJar) -and (Test-Path -LiteralPath $buildToolsDir))
}

# Official Java proxy passthrough: HTTPS_PROXY/HTTP_PROXY -> JAVA_TOOL_OPTIONS,
# inherited by sdkmanager AND gradle (dependency downloads).
function Set-AndroidBuildJavaProxy {
    $proxyUrl = $env:HTTPS_PROXY
    if (-not $proxyUrl) { $proxyUrl = $env:https_proxy }
    if (-not $proxyUrl) { $proxyUrl = $env:HTTP_PROXY }
    if (-not $proxyUrl) { $proxyUrl = $env:http_proxy }
    if (-not $proxyUrl) { return $false }
    if ($proxyUrl -match '^(https?://)?([^:/]+):(\d+)') {
        $env:JAVA_TOOL_OPTIONS = "-Dhttps.proxyHost=$($Matches[2]) -Dhttps.proxyPort=$($Matches[3]) -Dhttp.proxyHost=$($Matches[2]) -Dhttp.proxyPort=$($Matches[3])"
        return $true
    }
    return $false
}
