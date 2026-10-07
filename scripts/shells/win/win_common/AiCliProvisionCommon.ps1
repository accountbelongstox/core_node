# =============================================================================
# Shared idempotent AI CLI provisioning (Windows / PowerShell)
# =============================================================================
# Single implementation used by every generated launcher (claude/codex/kimi) and
# by the standalone claude* launchers. Linux counterpart:
#   scripts/shells/linux/common/ai_cli_provision_common.sh
#
# Invoke-AiCliProvision -Tool <tool> runs two idempotent steps:
#   1. Install the CLI when it is missing. Claude Code and Codex are native-only
#      (Invoke-AiCliNativeEnsure: the official installer from the catalog's
#      NativeInstallerUrls, npm/pnpm global copies removed, NativeBinDir made the
#      ONLY PATH provider through WindowsPathFunction.ps1). Kimi uses its native
#      installer; other CLIs and a failed Kimi install fall back to pnpm/npm.
#   2. Prompt for an upgrade only when the published version is newer, defaulting
#      to N and auto-skipping after $AiCliUpgradeTimeoutSeconds.
# Both steps are no-ops when the CLI is present and current; the launcher stops
# with an error when the CLI is still missing. For claude, a third idempotent step
# (Invoke-AiCliChromeMcpEnsure) makes sure ~/.claude.json carries the chrome MCP entry.
#
# Get-AiCliUltracodeArgs asks whether to enable Claude Code ultracode, defaulting
# to Y and auto-accepting after $AiCliUltracodeTimeoutSeconds; it returns the
# claude arguments (a temp settings file, since Windows PowerShell 5.1 strips the
# quotes of an inline JSON argument).
# =============================================================================

$AiCliUpgradeTimeoutSeconds = 5
$AiCliUltracodeTimeoutSeconds = 2
$AiCliUltracodeSettingsJson = '{"ultracode":true}'
$AiCliKimiInstallerUrl = "https://code.kimi.com/kimi-code/install.ps1"
$AiCliClaudeLatestUrl = "https://downloads.claude.ai/claude-code-releases/latest"
$AiCliNativeInstallerFileName = "ai-cli-native-install.ps1"
$AiCliNativeFetchTimeoutSeconds = 30
$AiCliNativePollMilliseconds = 1000
$AiCliNativeLogEverySeconds = 5
$AiCliBytesPerMegabyte = 1MB
# Size of a file another process is writing: a zero-access handle ignores the writer's share mode.
$AiCliOpenFileSizeSource = @'
using System;
using System.Runtime.InteropServices;
public static class AiCliOpenFileSize {
    [DllImport("kernel32.dll", CharSet = CharSet.Unicode, SetLastError = true)]
    static extern IntPtr CreateFileW(string name, uint access, uint share, IntPtr security, uint disposition, uint flags, IntPtr template);
    [DllImport("kernel32.dll", SetLastError = true)]
    static extern bool GetFileSizeEx(IntPtr handle, out long size);
    [DllImport("kernel32.dll")]
    static extern bool CloseHandle(IntPtr handle);
    public static long Get(string path) {
        IntPtr handle = CreateFileW(path, 0, 7, IntPtr.Zero, 3, 0x80, IntPtr.Zero);
        if (handle == new IntPtr(-1)) { return 0; }
        long size;
        bool ok = GetFileSizeEx(handle, out size);
        CloseHandle(handle);
        return ok ? size : 0;
    }
}
'@
$AiCliPathFunctionPath = Join-Path $PSScriptRoot "WindowsPathFunction.ps1"
$AiCliGlobalPackageManagers = @("pnpm", "npm")

# Read from the shared AI Tools Catalog (single source of truth for AI CLI
# metadata) instead of duplicating package ids / labels here. PnpmFallbackPackage
# is this file's own fallback path (pnpm add --global) when the native
# installer fails, kept distinct from the catalog's WindowsPackageKey/PackageId
# (which point at the winget/PowerShellCommand-based DEV_SOFTWARE_PACKAGES
# entry the main installer prefers).
if (-not (Get-Command Get-AiTool -ErrorAction SilentlyContinue)) {
    . (Join-Path $PSScriptRoot "AiToolsCatalog.ps1")
}
# CommonFunc owns the shared pnpm build-approval pieces (Invoke-WithPnpmBuildsAllowed,
# $Global:PNPM_ALLOW_ALL_BUILDS_ARG); it self-loads GlobalVars when needed.
if (-not (Get-Command Invoke-WithPnpmBuildsAllowed -ErrorAction SilentlyContinue)) {
    . (Join-Path $PSScriptRoot "CommonFunc.ps1")
}
$AiCliPackages = @{}
$AiCliLabels = @{}
# Missing launcher tools are installed by Step65 (Linux: 99_install_ai_tools.sh), in a child process.
$AiCliStep65Path = Join-Path (Join-Path (Split-Path $PSScriptRoot -Parent) "install_powershells") "Step65_InstallAiTools.ps1"
foreach ($aiCliKey in @("claude", "codex", "kimi", "gemini", "dsh")) {
    $aiCliTool = Get-AiTool -Key $aiCliKey
    if ($null -eq $aiCliTool) { continue }
    $AiCliPackages[$aiCliKey] = [string](Get-AiToolField -Key $aiCliKey -Field "PnpmFallbackPackage")
    $AiCliLabels[$aiCliKey] = [string]$aiCliTool.Name
}

# Masked form of a secret for launcher summaries (at most 4 chars kept per end).
function Get-AiCliMaskedSecret {
    param([string]$Value)

    $length = 0
    $keep = 4

    if ([string]::IsNullOrEmpty($Value)) {
        return "[empty]"
    }
    $length = $Value.Length
    if ($length -le 4) {
        return ("*" * $length)
    }
    if ($length -le 8) {
        $keep = 1
    }
    return ("{0}{1}{2}" -f $Value.Substring(0, $keep), ("*" * ($length - (2 * $keep))), $Value.Substring($length - $keep))
}

function Get-AiCliVersion {
    param([string]$VersionText)

    $versionSeparators = @([char]' ', [char]"`t", [char]"`r", [char]"`n")
    $versionTokens = @()
    $versionToken = $null
    $versionCandidate = $null
    $parsedVersion = $null

    if ([string]::IsNullOrWhiteSpace($VersionText)) {
        return $null
    }
    # The [char[]] cast is required: passing the array uncast makes PowerShell pick
    # the String.Split(String, StringSplitOptions) overload, which never splits and
    # leaves the whole "<version> (<product>)" line as a single token.
    $versionTokens = $VersionText.Split([char[]]$versionSeparators, [System.StringSplitOptions]::RemoveEmptyEntries)
    foreach ($versionToken in $versionTokens) {
        $versionCandidate = $versionToken.Trim()
        if ($versionCandidate.StartsWith("v", [System.StringComparison]::OrdinalIgnoreCase)) {
            $versionCandidate = $versionCandidate.Substring(1)
        }
        if ([System.Version]::TryParse($versionCandidate, [ref]$parsedVersion)) {
            return $parsedVersion
        }
    }
    return $null
}

# =============================================================================
# AI CLI shims in .winenvs: one .cmd per catalog command that prints its target to
# stderr ("[shim] claude -> ...") and forwards every argument to the real binary.
# Idempotent: an identical shim is kept; stale layers of the same command in
# .winenvs (symlinked .exe, .bat, .ps1, an old .cmd) are removed first, so each
# command has exactly ONE layer. Tools whose real binary cannot be found get no
# shim (and any stale layers for them are left untouched for the next provision).
# =============================================================================
$AiCliShimMarker = 'core_node AI CLI shim'
$AiCliShimExtensions = @('.exe', '.cmd', '.bat')

function Get-AiCliWinenvsDir {
    return (Join-Path $Global:LANG_COMPILER_DIR $Global:WINENVS_DIR)
}

# Real binary of <Tool> for the shim: catalog native exe first, then the bun and pnpm
# global bins and ~/.local/bin. Never resolves through PATH (a shim must not point at
# itself or another .winenvs layer).
function Get-AiCliShimTarget {
    param([string]$Tool)

    $execName = [string](Get-AiToolField -Key $Tool -Field "Exec")
    if ([string]::IsNullOrWhiteSpace($execName)) { return $null }
    $baseName = [System.IO.Path]::GetFileNameWithoutExtension($execName)
    $candidateDirs = @()
    $nativeDir = [string](Get-AiToolField -Key $Tool -Field "NativeBinDir")
    if ($nativeDir) { $candidateDirs += $nativeDir }
    $candidateDirs += @(
        $Global:BUN_BIN_DIR,
        (Join-Path (Join-Path $Global:NODE_DIR 'pnpm-global') '.bin'),
        (Join-Path (Join-Path $env:USERPROFILE '.local') 'bin')
    )
    foreach ($candidateDir in $candidateDirs) {
        if ([string]::IsNullOrWhiteSpace([string]$candidateDir) -or -not (Test-Path -LiteralPath $candidateDir)) { continue }
        foreach ($extension in $AiCliShimExtensions) {
            $candidate = Join-Path $candidateDir ($baseName + $extension)
            if (Test-Path -LiteralPath $candidate -PathType Leaf) { return $candidate }
        }
    }
    # Fallback: the general finder (candidate dirs, dot-dirs, PATH), rejecting anything
    # inside .winenvs so a shim never points at itself or another shim layer.
    $winenvsDir = Get-AiCliWinenvsDir
    $found = Find-ExecutableByKeyword -Keywords $execName -AdditionalKeywords @($baseName) -IncludeSystemPaths $true -Recursive $true
    if ($found -and -not ([string]$found).StartsWith($winenvsDir, [System.StringComparison]::OrdinalIgnoreCase) `
        -and [System.IO.Path]::GetExtension([string]$found) -ne '.ps1') {
        return [string]$found
    }
    return $null
}

function Install-AiCliWinenvShims {
    param([string]$LogPrefix = '[ai-shims]')

    $winenvsDir = Get-AiCliWinenvsDir
    $written = 0
    $kept = 0
    $skipped = 0
    if (-not (Test-Path -LiteralPath $winenvsDir)) {
        New-Item -ItemType Directory -Force -Path $winenvsDir | Out-Null
    }
    foreach ($toolKey in $Global:AiToolsCatalogKeys) {
        $execName = [string](Get-AiToolField -Key $toolKey -Field "Exec")
        if ([string]::IsNullOrWhiteSpace($execName)) { continue }
        $baseName = [System.IO.Path]::GetFileNameWithoutExtension($execName)
        $target = Get-AiCliShimTarget -Tool $toolKey
        if (-not $target) {
            Write-Host "$LogPrefix skip ${baseName}: no real binary found" -ForegroundColor DarkGray
            $skipped++
            continue
        }
        $shimPath = Join-Path $winenvsDir ($baseName + '.cmd')
        $shimContent = @(
            '@echo off',
            "rem $AiCliShimMarker (auto-generated by Install-AiCliWinenvShims; edits are overwritten)",
            "echo [shim] $baseName -^> $target 1>&2",
            "`"$target`" %*",
            'exit /b %ERRORLEVEL%'
        ) -join "`r`n"
        # Remove every OTHER layer of this command so the shim is the only resolver.
        foreach ($staleExtension in @('.exe', '.bat', '.ps1')) {
            $stalePath = Join-Path $winenvsDir ($baseName + $staleExtension)
            if (Test-Path -LiteralPath $stalePath) {
                Write-Host "$LogPrefix removing stale layer: $baseName$staleExtension" -ForegroundColor Yellow
                Remove-Item -LiteralPath $stalePath -Force
            }
        }
        if ((Test-Path -LiteralPath $shimPath) -and ((Get-Content -LiteralPath $shimPath -Raw -ErrorAction SilentlyContinue) -eq ($shimContent + "`r`n"))) {
            $kept++
            continue
        }
        Set-Content -LiteralPath $shimPath -Value $shimContent -Encoding Ascii
        Write-Host "$LogPrefix $baseName -> $target" -ForegroundColor Green
        $written++
    }
    Write-Host "$LogPrefix done: $written written, $kept unchanged, $skipped without a binary" -ForegroundColor Cyan
}

# True when the catalog marks <Tool> as native-only (official installer).
function Test-AiCliNativeTool {
    param([string]$Tool)

    return (-not [string]::IsNullOrWhiteSpace([string](Get-AiToolField -Key $Tool -Field "NativeBinDir")))
}

# Native executable of <Tool>: <NativeBinDir>\<Exec>.
function Get-AiCliNativeExe {
    param([string]$Tool)

    return (Join-Path ([string](Get-AiToolField -Key $Tool -Field "NativeBinDir")) ([string](Get-AiToolField -Key $Tool -Field "Exec")))
}

# Expected download size of <Tool>'s native binary (claude: release manifest), or 0 when unknown.
function Get-AiCliNativeDownloadSize {
    param([string]$Tool)

    $releaseBaseUrl = $AiCliClaudeLatestUrl.Substring(0, $AiCliClaudeLatestUrl.LastIndexOf('/'))
    $platform = if ($env:PROCESSOR_ARCHITECTURE -eq "ARM64") { "win32-arm64" } else { "win32-x64" }
    $version = ""
    $manifest = $null

    if ($Tool -ne "claude") {
        return 0
    }
    try {
        $version = ([string](Invoke-RestMethod -Uri $AiCliClaudeLatestUrl -TimeoutSec $AiCliNativeFetchTimeoutSeconds -ErrorAction Stop)).Trim()
        $manifest = Invoke-RestMethod -Uri ("{0}/{1}/manifest.json" -f $releaseBaseUrl, $version) -TimeoutSec $AiCliNativeFetchTimeoutSeconds -ErrorAction Stop
        Write-Host ("[INFO] Latest release: {0} ({1}, {2:N1} MB)" -f $version, $platform, ([double]$manifest.platforms.$platform.size / $AiCliBytesPerMegabyte)) -ForegroundColor Cyan
        return [long]$manifest.platforms.$platform.size
    }
    catch {
        Write-Host "[WARN] Release manifest unavailable ($($_.Exception.Message)); download size unknown" -ForegroundColor Yellow
        return 0
    }
}

# Bytes written to <DownloadDir> since <Since> (largest file), 0 when nothing yet.
# NTFS directory listings lag for files still being written, so the size is read from an open handle.
function Get-AiCliNativeDownloadedBytes {
    param([string]$DownloadDir, [datetime]$Since)

    $file = $null
    $size = [long]0
    $largest = [long]0

    if ([string]::IsNullOrWhiteSpace($DownloadDir) -or -not (Test-Path -LiteralPath $DownloadDir)) {
        return $largest
    }
    if (-not ('AiCliOpenFileSize' -as [type])) {
        Add-Type -TypeDefinition $AiCliOpenFileSizeSource
    }
    foreach ($file in @(Get-ChildItem -LiteralPath $DownloadDir -File -ErrorAction SilentlyContinue | Where-Object { ($_.CreationTime -ge $Since) -or ($_.LastWriteTime -ge $Since) })) {
        $size = [AiCliOpenFileSize]::Get($file.FullName)
        if ($size -gt $largest) { $largest = $size }
    }
    return $largest
}

# Run the installer script in a child PowerShell and report progress until it exits; returns its exit code.
# The official installers hide their own progress, so download bytes, speed and elapsed time are polled here.
function Invoke-AiCliNativeInstallerProcess {
    param([string]$Tool, [string]$InstallerFile)

    $toolInfo = Get-AiTool -Key $Tool
    $powerShellExe = (Get-Process -Id $PID).Path
    $downloadDir = [string](Get-AiToolField -Key $Tool -Field "NativeInstallerDownloadDir")
    $totalBytes = Get-AiCliNativeDownloadSize -Tool $Tool
    $startTime = Get-Date
    $lastLogTime = $startTime
    $process = $null
    $elapsedSeconds = 0.0
    $downloadedBytes = 0
    $speedMbps = 0.0
    $percent = 0
    $status = ""
    $activity = "Installing $($toolInfo.Name)"

    Write-Host "[INFO] Running: $powerShellExe -NoProfile -ExecutionPolicy Bypass -File `"$InstallerFile`"" -ForegroundColor Cyan
    if ($downloadDir) {
        Write-Host "[INFO] Download directory: $downloadDir" -ForegroundColor Cyan
    }
    $process = Start-Process -FilePath $powerShellExe -ArgumentList @("-NoProfile", "-ExecutionPolicy", "Bypass", "-File", "`"$InstallerFile`"") -NoNewWindow -PassThru
    $null = $process.Handle
    while (-not $process.WaitForExit($AiCliNativePollMilliseconds)) {
        $elapsedSeconds = ((Get-Date) - $startTime).TotalSeconds
        $downloadedBytes = Get-AiCliNativeDownloadedBytes -DownloadDir $downloadDir -Since $startTime
        $speedMbps = if ($elapsedSeconds -gt 0) { ($downloadedBytes / $AiCliBytesPerMegabyte) / $elapsedSeconds } else { 0 }
        if ($downloadedBytes -le 0) {
            $status = "connecting / preparing, elapsed {0:N0}s" -f $elapsedSeconds
        }
        elseif ($totalBytes -gt 0) {
            $percent = [Math]::Min(100, [int](($downloadedBytes * 100) / $totalBytes))
            $status = "downloaded {0:N1} / {1:N1} MB ({2}%), {3:N2} MB/s, elapsed {4:N0}s" -f ($downloadedBytes / $AiCliBytesPerMegabyte), ($totalBytes / $AiCliBytesPerMegabyte), $percent, $speedMbps, $elapsedSeconds
        }
        else {
            $status = "downloaded {0:N1} MB, {1:N2} MB/s, elapsed {2:N0}s" -f ($downloadedBytes / $AiCliBytesPerMegabyte), $speedMbps, $elapsedSeconds
        }
        Write-Progress -Activity $activity -Status $status -PercentComplete $percent
        if (((Get-Date) - $lastLogTime).TotalSeconds -ge $AiCliNativeLogEverySeconds) {
            Write-Host "[PROGRESS] $($toolInfo.Name): $status" -ForegroundColor DarkCyan
            $lastLogTime = Get-Date
        }
    }
    Write-Progress -Activity $activity -Completed
    Write-Host ("[INFO] Installer finished in {0:N0}s with exit code {1}" -f ((Get-Date) - $startTime).TotalSeconds, $process.ExitCode) -ForegroundColor Cyan
    return $process.ExitCode
}

# Run the official installer of <Tool> from each catalog URL until one leaves
# the native executable in place. Child process: official installers call
# exit on failure, which would otherwise terminate the caller.
function Invoke-AiCliNativeInstaller {
    param([string]$Tool)

    $toolInfo = Get-AiTool -Key $Tool
    $installerUrl = $null
    $installerContent = $null
    $installerDir = Get-Variable -Name 'DOWNLOADS_DIR' -Scope Global -ValueOnly -ErrorAction SilentlyContinue
    $installerWorkDir = Get-Variable -Name 'WORK_DIR' -Scope Global -ValueOnly -ErrorAction SilentlyContinue
    $installerFile = $null
    $installerExitCode = 1
    $envName = ""
    $savedEnv = @{}
    $installerEnv = @{}

    # Installer scripts land in DOWNLOADS_DIR and the official installers' own TEMP
    # downloads/extraction in WORK_DIR (GlobalVars.ps1), never the shared D: temp.
    if ([string]::IsNullOrWhiteSpace([string]$installerDir)) {
        $installerDir = [System.IO.Path]::GetTempPath()
    }
    if (-not (Test-Path -LiteralPath $installerDir -PathType Container)) {
        New-Item -ItemType Directory -Path $installerDir -Force | Out-Null
    }
    $installerFile = Join-Path $installerDir $AiCliNativeInstallerFileName
    foreach ($envName in @($toolInfo.NativeInstallerEnv.Keys)) {
        $installerEnv[$envName] = [string]$toolInfo.NativeInstallerEnv[$envName]
    }
    if (-not [string]::IsNullOrWhiteSpace([string]$installerWorkDir)) {
        if (-not (Test-Path -LiteralPath $installerWorkDir -PathType Container)) {
            New-Item -ItemType Directory -Path $installerWorkDir -Force | Out-Null
        }
        $installerEnv["TEMP"] = [string]$installerWorkDir
        $installerEnv["TMP"] = [string]$installerWorkDir
    }

    [Net.ServicePointManager]::SecurityProtocol = [Net.ServicePointManager]::SecurityProtocol -bor [Net.SecurityProtocolType]::Tls12
    foreach ($envName in @($installerEnv.Keys)) {
        $savedEnv[$envName] = [Environment]::GetEnvironmentVariable($envName, "Process")
        [Environment]::SetEnvironmentVariable($envName, $installerEnv[$envName], "Process")
    }
    try {
        foreach ($installerUrl in @($toolInfo.NativeInstallerUrls)) {
            try {
                Write-Host "[INSTALL] Fetching official installer for $($toolInfo.Name): $installerUrl (timeout $($AiCliNativeFetchTimeoutSeconds)s)" -ForegroundColor Cyan
                $installerContent = Invoke-RestMethod -Uri $installerUrl -TimeoutSec $AiCliNativeFetchTimeoutSeconds -ErrorAction Stop
                if (($installerContent -isnot [string]) -or ($installerContent -match '<html')) {
                    throw "unexpected installer content"
                }
                Set-Content -LiteralPath $installerFile -Value $installerContent -Encoding UTF8
                Write-Host ("[INFO] Installer script saved: {0} ({1} chars)" -f $installerFile, $installerContent.Length) -ForegroundColor Cyan
                $installerExitCode = Invoke-AiCliNativeInstallerProcess -Tool $Tool -InstallerFile $installerFile
                Remove-Item -LiteralPath $installerFile -Force -ErrorAction SilentlyContinue
                if (($installerExitCode -eq 0) -and (Test-Path -LiteralPath (Get-AiCliNativeExe -Tool $Tool))) {
                    return $true
                }
                Write-Host "[WARN] Official installer failed from $installerUrl (exit code $installerExitCode)" -ForegroundColor Yellow
            }
            catch {
                Write-Host "[WARN] Official installer failed from $installerUrl`: $($_.Exception.Message)" -ForegroundColor Yellow
            }
        }
    }
    finally {
        foreach ($envName in @($savedEnv.Keys)) {
            [Environment]::SetEnvironmentVariable($envName, $savedEnv[$envName], "Process")
        }
    }
    return $false
}

# Uninstall a global pnpm/npm copy of <Package> (a non-recommended install);
# a manager that does not list the package is skipped.
function Remove-AiCliGlobalPackage {
    param([string]$Package)

    $managerName = ""
    $managerCommand = $null
    $listOutput = ""
    $previousPreference = $ErrorActionPreference

    if ([string]::IsNullOrWhiteSpace($Package)) {
        return
    }
    # Package managers print notices on stderr; they must not abort the caller.
    $ErrorActionPreference = "Continue"
    try {
        foreach ($managerName in $AiCliGlobalPackageManagers) {
            $managerCommand = Get-Command $managerName -ErrorAction SilentlyContinue
            if ($null -eq $managerCommand) {
                Write-Host "[SKIP] $managerName not installed" -ForegroundColor DarkGray
                continue
            }
            $listOutput = (& $managerCommand.Source list --global --depth 0 2>&1 | Out-String)
            if ($listOutput -notmatch [regex]::Escape($Package)) {
                Write-Host "[SKIP] $managerName global: $Package not installed" -ForegroundColor Green
                continue
            }
            Write-Host "[REMOVE] $managerName global: $Package (non-recommended copy)" -ForegroundColor Yellow
            if ($managerName -eq "pnpm") {
                & $managerCommand.Source remove --global $Package 2>&1 | ForEach-Object { Write-Host "  $_" }
            }
            else {
                & $managerCommand.Source uninstall --global $Package 2>&1 | ForEach-Object { Write-Host "  $_" }
            }
            Write-Host "[INFO] $managerName exit code: $LASTEXITCODE" -ForegroundColor Cyan
        }
    }
    finally {
        $ErrorActionPreference = $previousPreference
    }
}

# Native-only install of <Tool> (catalog NativeBinDir): the official installer
# runs when the native executable is missing, global npm/pnpm copies
# (NonNativePackage) are removed, and NativeBinDir becomes the ONLY PATH provider
# of the command through the shared PATH library. Idempotent. Every Windows path
# (Step21 package entries, Step65, Invoke-AiCliProvision / claudeteam, launchers)
# calls this one function.
function Invoke-AiCliNativeEnsure {
    param([string]$Tool)

    $toolInfo = Get-AiTool -Key $Tool
    $nativeExe = ""
    $installedOutput = ""
    $previousPreference = $ErrorActionPreference

    if (-not (Test-AiCliNativeTool -Tool $Tool)) {
        Write-Host "[ERROR] $Tool is not a native-only catalog tool." -ForegroundColor Red
        return $false
    }
    $nativeExe = Get-AiCliNativeExe -Tool $Tool
    Write-Host "[INFO] $($toolInfo.Name): official native install only ($nativeExe)" -ForegroundColor Cyan
    if (Test-Path -LiteralPath $nativeExe) {
        $ErrorActionPreference = "Continue"
        $installedOutput = (& $nativeExe --version 2>&1 | Out-String).Trim()
        $ErrorActionPreference = $previousPreference
        Write-Host "[SKIP] Native $($toolInfo.Name) present: $installedOutput" -ForegroundColor Green
    }
    elseif (-not (Invoke-AiCliNativeInstaller -Tool $Tool)) {
        Write-Host "[ERROR] Official installer failed; $($toolInfo.Name) is not installed." -ForegroundColor Red
        return $false
    }
    Remove-AiCliGlobalPackage -Package ([string](Get-AiToolField -Key $Tool -Field "NonNativePackage"))
    & $AiCliPathFunctionPath "unique" ([System.IO.Path]::GetFileNameWithoutExtension([string]$toolInfo.Exec)) ([string]$toolInfo.NativeBinDir)
    return (Test-Path -LiteralPath $nativeExe)
}

function Get-AiCliPublishedVersion {
    param(
        [string]$Tool,
        [string]$Package
    )

    $packageManagerCommand = $null
    $publishedOutput = $null
    $publishedVersion = $null
    $previousPreference = $ErrorActionPreference

    if ($Tool -eq "claude") {
        try {
            $publishedOutput = [string](Invoke-RestMethod -Uri $AiCliClaudeLatestUrl -TimeoutSec 10 -ErrorAction Stop)
            return (Get-AiCliVersion -VersionText $publishedOutput)
        }
        catch {
            return $null
        }
    }
    # Package managers print notices on stderr; they must not abort the caller.
    $ErrorActionPreference = "Continue"
    try {
        $packageManagerCommand = Get-Command pnpm -ErrorAction SilentlyContinue
        if ($null -ne $packageManagerCommand) {
            $publishedOutput = (& $packageManagerCommand.Source view $Package version 2>$null | Out-String).Trim()
            $publishedVersion = Get-AiCliVersion -VersionText $publishedOutput
        }
        if ($null -eq $publishedVersion) {
            $packageManagerCommand = Get-Command npm -ErrorAction SilentlyContinue
            if ($null -ne $packageManagerCommand) {
                $publishedOutput = (& $packageManagerCommand.Source view $Package version 2>$null | Out-String).Trim()
                $publishedVersion = Get-AiCliVersion -VersionText $publishedOutput
            }
        }
    }
    finally {
        $ErrorActionPreference = $previousPreference
    }
    return $publishedVersion
}

function Read-AiCliTimedChoice {
    param([int]$TimeoutSeconds)

    $choiceDeadline = $null
    $choiceKey = $null
    $choiceText = ""

    try {
        $choiceDeadline = (Get-Date).AddSeconds($TimeoutSeconds)
        while ((Get-Date) -lt $choiceDeadline) {
            if ([Console]::KeyAvailable) {
                $choiceKey = [Console]::ReadKey($true)
                if ($choiceKey.Key -ne [ConsoleKey]::Enter) {
                    $choiceText = [string]$choiceKey.KeyChar
                    Write-Host $choiceText
                }
                break
            }
            Start-Sleep -Milliseconds 100
        }
        while ([Console]::KeyAvailable) {
            [Console]::ReadKey($true) | Out-Null
        }
    }
    catch {
        $choiceText = ""
    }
    return $choiceText
}

function Invoke-AiCliPackageManagerInstall {
    param([string]$Package)

    $packageManagerCommand = $null
    $packageSpecifier = ""

    $packageSpecifier = -join @($Package, "@latest")
    # dd.cmd installs every Node-based AI CLI through pnpm (ApplicationsList.ps1
    # InstallType "pnpm" -> "pnpm add --global <package>"); npm is the fallback.
    $packageManagerCommand = Get-Command pnpm -ErrorAction SilentlyContinue
    if ($null -ne $packageManagerCommand) {
        Invoke-WithPnpmBuildsAllowed { & $packageManagerCommand.Source add --global $Global:PNPM_ALLOW_ALL_BUILDS_ARG $packageSpecifier | Out-Host }
        if ($LASTEXITCODE -eq 0) {
            return $true
        }
    }
    $packageManagerCommand = Get-Command npm -ErrorAction SilentlyContinue
    if ($null -ne $packageManagerCommand) {
        & $packageManagerCommand.Source install --global $packageSpecifier | Out-Host
        if ($LASTEXITCODE -eq 0) {
            return $true
        }
    }
    return $false
}

function Invoke-AiCliNativeInstall {
    param([string]$Tool)

    $installerContent = $null

    if (Test-AiCliNativeTool -Tool $Tool) {
        return (Invoke-AiCliNativeInstaller -Tool $Tool)
    }
    if ($Tool -eq "kimi") {
        try {
            $installerContent = Invoke-RestMethod -Uri $AiCliKimiInstallerUrl
            Invoke-Expression $installerContent
            return $true
        }
        catch {
            return $false
        }
    }
    return $false
}

function Invoke-AiCliNativeUpgrade {
    param([string]$Tool)

    $toolCommand = $null
    $autoUpdaterBackup = $null

    if ($Tool -eq "claude") {
        $toolCommand = Get-Command $Tool -ErrorAction SilentlyContinue
        if ($null -eq $toolCommand) {
            return $false
        }
        # Official native updater; DISABLE_AUTOUPDATER only blocks the silent
        # background updater, so it is cleared for this explicit upgrade.
        $autoUpdaterBackup = $env:DISABLE_AUTOUPDATER
        $env:DISABLE_AUTOUPDATER = $null
        & $toolCommand.Source update | Out-Host
        $env:DISABLE_AUTOUPDATER = $autoUpdaterBackup
        if ($LASTEXITCODE -eq 0) {
            return $true
        }
        return $false
    }
    if (($Tool -eq "kimi") -or (Test-AiCliNativeTool -Tool $Tool)) {
        # Codex: the official installer is also its official updater.
        return (Invoke-AiCliNativeInstall -Tool $Tool)
    }
    return $false
}

function Install-AiCliIfMissing {
    param([string]$Tool)

    $toolPackage = ""
    $toolLabel = ""
    $sessionPathSegments = @()

    if (-not $AiCliPackages.ContainsKey($Tool)) {
        return
    }
    if (Test-AiCliNativeTool -Tool $Tool) {
        [void](Invoke-AiCliNativeEnsure -Tool $Tool)
        return
    }
    if ($null -ne (Get-Command $Tool -ErrorAction SilentlyContinue)) {
        return
    }

    $toolPackage = $AiCliPackages[$Tool]
    $toolLabel = $AiCliLabels[$Tool]
    Write-Host "[INFO] $toolLabel is not installed; running Step65 -Only $Tool ..." -ForegroundColor Cyan
    & (Get-Process -Id $PID).Path -NoProfile -ExecutionPolicy Bypass -File $AiCliStep65Path -Only $Tool
    # The child install writes User/Machine PATH; append its new segments to this session.
    $sessionPathSegments = @($env:Path -split ";")
    foreach ($scopePath in @([Environment]::GetEnvironmentVariable("Path", "Machine"), [Environment]::GetEnvironmentVariable("Path", "User"))) {
        foreach ($scopeSegment in @($scopePath -split ";" | Where-Object { $_ -and ($sessionPathSegments -notcontains $_) })) {
            $env:Path = (@($env:Path, $scopeSegment) -join ";")
            $sessionPathSegments += $scopeSegment
        }
    }
    if ($null -ne (Get-Command $Tool -ErrorAction SilentlyContinue)) {
        Write-Host "[INFO] $toolLabel install completed." -ForegroundColor Green
        return
    }
    if (-not (Invoke-AiCliNativeInstall -Tool $Tool)) {
        if (-not (Invoke-AiCliPackageManagerInstall -Package $toolPackage)) {
            Write-Host "[WARN] $toolLabel install failed; run dd.cmd to repair the AI CLI tools." -ForegroundColor Yellow
            return
        }
    }
    if ($null -ne (Get-Command $Tool -ErrorAction SilentlyContinue)) {
        Write-Host "[INFO] $toolLabel install completed." -ForegroundColor Green
    }
    else {
        Write-Host "[WARN] $toolLabel is still unavailable after the install attempt." -ForegroundColor Yellow
    }
}

function Invoke-AiCliUpgradeInstall {
    param(
        [string]$Tool,
        [string]$Package,
        [string]$Label
    )

    Write-Host "[INFO] Upgrading $Label..." -ForegroundColor Cyan
    if (Invoke-AiCliNativeUpgrade -Tool $Tool) {
        Write-Host "[INFO] $Label upgraded with the official native updater." -ForegroundColor Green
        return
    }
    if ([string]::IsNullOrWhiteSpace($Package)) {
        Write-Host "[WARN] $Label upgrade failed; keeping the installed version (native only)." -ForegroundColor Yellow
        return
    }
    Write-Host "[INFO] Falling back to the global package manager for $Label..." -ForegroundColor Cyan
    if (Invoke-AiCliPackageManagerInstall -Package $Package) {
        Write-Host "[INFO] $Label upgraded with the global package manager." -ForegroundColor Green
        return
    }
    Write-Host "[WARN] $Label upgrade failed; keeping the installed version." -ForegroundColor Yellow
}

function Invoke-AiCliUpgradePrompt {
    param([string]$Tool)

    $toolCommand = $null
    $toolPackage = ""
    $toolLabel = ""
    $installedOutput = $null
    $installedVersion = $null
    $publishedVersion = $null
    $upgradeChoice = ""
    $previousPreference = $ErrorActionPreference

    if (-not $AiCliPackages.ContainsKey($Tool)) {
        return
    }
    $toolCommand = Get-Command $Tool -ErrorAction SilentlyContinue
    if ($null -eq $toolCommand) {
        return
    }

    $toolPackage = $AiCliPackages[$Tool]
    $toolLabel = $AiCliLabels[$Tool]
    # Shims print notices on stderr; they must not abort the caller.
    $ErrorActionPreference = "Continue"
    try {
        $installedOutput = (& $toolCommand.Source --version 2>$null | Out-String).Trim()
    }
    finally {
        $ErrorActionPreference = $previousPreference
    }
    $installedVersion = Get-AiCliVersion -VersionText $installedOutput
    # Native-only tools publish the same version as their registry package.
    $publishedVersion = Get-AiCliPublishedVersion -Tool $Tool -Package $(if ([string]::IsNullOrWhiteSpace($toolPackage)) { [string](Get-AiToolField -Key $Tool -Field "NonNativePackage") } else { $toolPackage })

    if (($null -eq $installedVersion) -or ($null -eq $publishedVersion)) {
        return
    }
    if ($publishedVersion -le $installedVersion) {
        return
    }

    Write-Host "Upgrade $toolLabel $installedVersion -> $publishedVersion`? [N/y] (auto-skip in $AiCliUpgradeTimeoutSeconds`s): " -ForegroundColor Yellow -NoNewline
    $upgradeChoice = Read-AiCliTimedChoice -TimeoutSeconds $AiCliUpgradeTimeoutSeconds
    if ([string]::IsNullOrWhiteSpace($upgradeChoice)) {
        Write-Host "N (auto)"
    }

    if (($upgradeChoice -eq "y") -or ($upgradeChoice -eq "Y")) {
        Invoke-AiCliUpgradeInstall -Tool $Tool -Package $toolPackage -Label $toolLabel
    }
    else {
        Write-Host "[INFO] $toolLabel upgrade skipped (default N)." -ForegroundColor DarkGray
    }
}

function Invoke-AiCliProvision {
    param([string]$Tool)

    Install-AiCliIfMissing -Tool $Tool
    if ($AiCliPackages.ContainsKey($Tool) -and ($null -eq (Get-Command $Tool -ErrorAction SilentlyContinue))) {
        Write-Host "[ERROR] $($AiCliLabels[$Tool]) is unavailable; fix the install errors above and re-run." -ForegroundColor Red
        exit 1
    }
    Invoke-AiCliUpgradePrompt -Tool $Tool
    if ($Tool -eq "claude") {
        Invoke-AiCliChromeMcpEnsure
    }
}

# Idempotent "Claude can reach Chrome" step (Linux counterpart: ai_cli_chrome_mcp_ensure).
# Fast path: the ~/.claude.json "chrome" http entry is already correct and the
# mcp-chrome endpoint answers -> one line. Otherwise the chrome entry alone is merged
# through _json_sync_helper.py (the same writer as claude_sync_mcp_servers.ps1), and a
# missing mcp-chrome logon task prints the single install command; the build is never
# run from a launcher.
function Invoke-AiCliChromeMcpEnsure {
    $coreNodePath = Split-Path (Split-Path (Split-Path (Split-Path $PSScriptRoot -Parent) -Parent) -Parent) -Parent
    $serviceContractPath = Join-Path $PSScriptRoot "ServiceContract.ps1"
    $mcpProviderPath = Join-Path $coreNodePath "scripts\ai_ps1tools\mcp_config_provider.ps1"
    $jsonHelperPath = Join-Path $coreNodePath "scripts\ai_ps1tools\_json_sync_helper.py"
    $startScriptPath = Join-Path $coreNodePath "apps\mcp-chrome\scripts\start.ps1"
    $claudeConfigPath = if ($env:CLAUDE_CONFIG_DIR) { Join-Path $env:CLAUDE_CONFIG_DIR ".claude.json" } else { Join-Path $env:USERPROFILE ".claude.json" }
    $entriesPath = Join-Path ([System.IO.Path]::GetTempPath()) ("claude_chrome_mcp_entries_{0}.json" -f $PID)
    $mcpHost = $null
    $mcpPort = 0
    $mcpUrl = $null
    $pycoreDevUrl = $null
    $taskName = $null
    $config = $null
    $chromeEntry = $null
    $pycoreDevEntry = $null
    $entryReady = $false
    $endpointReady = $false
    $tcpClient = $null
    $connectTask = $null
    $pythonExe = $null
    $entriesJson = $null

    if (-not (Test-Path -LiteralPath $startScriptPath)) {
        return
    }
    . $serviceContractPath
    $mcpHost = Get-ServiceContractHost -Name "loopback"
    $mcpPort = Get-ServiceContractPort -Name "mcp_chrome"
    $mcpUrl = New-ServiceContractUrl -Protocol "http" -HostName $mcpHost -Port $mcpPort -Path "mcp"
    $pycoreDevUrl = New-ServiceContractUrl -Protocol "http" -HostName $mcpHost -Port (Get-ServiceContractPort -Name "pycore_backend") -Path (Get-ServiceContractValue -ContractPath "paths.pycore_dev_mcp")
    $taskName = Get-ServiceContractValue -ContractPath "mcp_chrome.windows_task_name"

    if (Test-Path -LiteralPath $claudeConfigPath -PathType Leaf) {
        try {
            $config = Get-Content -Raw -LiteralPath $claudeConfigPath | ConvertFrom-Json
            if ($null -ne $config.PSObject.Properties["mcpServers"] -and $null -ne $config.mcpServers) {
                $chromeEntry = $config.mcpServers.PSObject.Properties["chrome"]
                $pycoreDevEntry = $config.mcpServers.PSObject.Properties["pycore-dev"]
            }
            if ($null -ne $chromeEntry -and $null -ne $chromeEntry.Value -and $null -ne $pycoreDevEntry -and $null -ne $pycoreDevEntry.Value) {
                $entryReady = ($chromeEntry.Value.PSObject.Properties["type"] -and $chromeEntry.Value.type -eq "http" -and
                    $chromeEntry.Value.PSObject.Properties["url"] -and $chromeEntry.Value.url -eq $mcpUrl -and
                    $pycoreDevEntry.Value.PSObject.Properties["type"] -and $pycoreDevEntry.Value.type -eq "http" -and
                    $pycoreDevEntry.Value.PSObject.Properties["url"] -and $pycoreDevEntry.Value.url -eq $pycoreDevUrl)
            }
        } catch {
            $entryReady = $false
        }
    }

    if (-not $entryReady) {
        . $mcpProviderPath
        $pythonExe = Get-MCPPythonExe
        if ([string]::IsNullOrWhiteSpace($pythonExe)) {
            Write-Host "[WARN] Chrome MCP: python not found; cannot write the chrome entry to $claudeConfigPath." -ForegroundColor Yellow
        } else {
            $entriesJson = ConvertTo-Json -InputObject @(@{ name = "chrome"; transport = "http"; url = $mcpUrl }, @{ name = "pycore-dev"; transport = "http"; url = $pycoreDevUrl }) -Depth 5
            [System.IO.File]::WriteAllText($entriesPath, $entriesJson, (New-Object System.Text.UTF8Encoding($false)))
            try {
                & $pythonExe -u $jsonHelperPath $claudeConfigPath $entriesPath "claude" | Out-Null
                $entryReady = ($LASTEXITCODE -eq 0)
            } finally {
                Remove-Item -LiteralPath $entriesPath -ErrorAction SilentlyContinue
            }
            if ($entryReady) {
                Write-Host "[INFO] Chrome MCP entry written to $claudeConfigPath" -ForegroundColor Green
            } else {
                Write-Host "[WARN] Chrome MCP: writing $claudeConfigPath failed." -ForegroundColor Yellow
            }
        }
    }

    $tcpClient = New-Object System.Net.Sockets.TcpClient
    try {
        $connectTask = $tcpClient.ConnectAsync($mcpHost, $mcpPort)
        $endpointReady = $connectTask.Wait(500) -and $tcpClient.Connected
    } catch {
        $endpointReady = $false
    } finally {
        $tcpClient.Dispose()
    }

    if ($entryReady -and $endpointReady) {
        Write-Host "[INFO] Chrome MCP ready: $mcpUrl" -ForegroundColor Green
        return
    }
    if ($null -ne (Get-ScheduledTask -TaskName $taskName -ErrorAction SilentlyContinue)) {
        Write-Host "[WARN] Chrome MCP endpoint $mcpUrl is not answering; start the '$taskName' task or reload the extension." -ForegroundColor Yellow
    } else {
        Write-Host "[INFO] Chrome MCP service is not installed; install it once with:" -ForegroundColor Yellow
        Write-Host "       powershell -NoProfile -ExecutionPolicy Bypass -File `"$startScriptPath`" -Service" -ForegroundColor White
    }
}

# Session-only claude --settings file (Windows PowerShell 5.1 strips the quotes of an
# inline JSON argument). Role windows start about 1 s apart and share this file: it is
# written only when the content differs, with a per-process file when a parallel writer holds it.
function Write-AiCliSessionSettingsFile {
    param([string]$Name, [string]$Json)

    $tempDirectory = [System.IO.Path]::GetTempPath()
    $settingsFile = Join-Path $tempDirectory ("{0}_settings.json" -f $Name)
    $existingSettings = $null

    if (Test-Path -LiteralPath $settingsFile -PathType Leaf) {
        try {
            $existingSettings = [System.IO.File]::ReadAllText($settingsFile)
        } catch [System.IO.IOException] {
            $existingSettings = $null
        }
    }
    if ($existingSettings -ne $Json) {
        try {
            [System.IO.File]::WriteAllText($settingsFile, $Json)
        } catch [System.IO.IOException] {
            $settingsFile = Join-Path $tempDirectory ("{0}_settings_{1}.json" -f $Name, $PID)
            [System.IO.File]::WriteAllText($settingsFile, $Json)
        }
    }
    return $settingsFile
}

function Get-AiCliUltracodeArgs {
    param([string]$SettingsName)

    $ultracodeChoice = ""
    $ultracodeSettingsFile = $null

    Write-Host "Enable ultracode? [Y/n] (auto-Y in $AiCliUltracodeTimeoutSeconds`s): " -ForegroundColor Yellow -NoNewline
    $ultracodeChoice = Read-AiCliTimedChoice -TimeoutSeconds $AiCliUltracodeTimeoutSeconds
    if ([string]::IsNullOrEmpty($ultracodeChoice)) {
        Write-Host "Y (auto)"
    }
    if (($ultracodeChoice -eq 'n') -or ($ultracodeChoice -eq 'N')) {
        Write-Host "[INFO] Ultracode: off" -ForegroundColor Green
        return
    }
    $ultracodeSettingsFile = Write-AiCliSessionSettingsFile -Name ("{0}_ultracode" -f $SettingsName) -Json $AiCliUltracodeSettingsJson
    Write-Host "[INFO] Ultracode: on" -ForegroundColor Green
    return @("--settings", $ultracodeSettingsFile)
}
