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

# =============================================================================
# Shared idempotent AI CLI provisioning (Windows / PowerShell)
# =============================================================================
# Single implementation used by every generated launcher (claude/codex/kimi) and
# by the standalone claude* launchers. Linux counterpart:
#   scripts/shells/linux/common/ai_cli_provision_common.sh
#
# Invoke-AiCliProvision -Tool <tool> runs two idempotent steps:
#   1. Install the CLI when it is missing. Claude Code and Kimi use their official
#      native installers (Claude: claude.ai/install.ps1, falling back to its
#      official CDN target when the claude.ai front door refuses the request);
#      Claude's %USERPROFILE%\.local\bin is repaired into the user PATH. Other CLIs
#      and failed native installs fall back to pnpm/npm.
#   2. Prompt for an upgrade only when the published version is newer, defaulting
#      to N and auto-skipping after $AiCliUpgradeTimeoutSeconds.
# Both steps are no-ops when the CLI is present and current; the launcher stops
# with an error when the CLI is still missing.
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
$AiCliClaudeInstallerUrls = @(
    "https://claude.ai/install.ps1",
    "https://downloads.claude.ai/claude-code-releases/bootstrap.ps1"
)
$AiCliClaudeLatestUrl = "https://downloads.claude.ai/claude-code-releases/latest"
$AiCliClaudeBinDir = Join-Path (Join-Path $env:USERPROFILE ".local") "bin"
$AiCliClaudeExe = Join-Path $AiCliClaudeBinDir "claude.exe"
$AiCliClaudeInstallerFile = Join-Path ([System.IO.Path]::GetTempPath()) "claude-code-install.ps1"
$AiCliPackages = @{
    "claude" = "@anthropic-ai/claude-code"
    "codex"  = "@openai/codex"
    "kimi"   = "@moonshot-ai/kimi-code"
}
$AiCliLabels = @{
    "claude" = "Claude Code"
    "codex"  = "Codex CLI"
    "kimi"   = "Kimi Code CLI"
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

# Tells running programs (Explorer, new terminals) that the environment changed.
function Send-AiCliEnvironmentChange {
    $result = [IntPtr]::Zero

    if (-not ("AiCliEnvironmentBroadcast" -as [type])) {
        Add-Type -TypeDefinition @"
using System;
using System.Runtime.InteropServices;
public static class AiCliEnvironmentBroadcast {
    [DllImport("user32.dll", SetLastError = true, CharSet = CharSet.Unicode)]
    public static extern IntPtr SendMessageTimeout(IntPtr hWnd, uint msg, IntPtr wParam, string lParam, uint flags, uint timeout, out IntPtr result);
}
"@
    }
    [void][AiCliEnvironmentBroadcast]::SendMessageTimeout([IntPtr]0xffff, 0x001A, [IntPtr]::Zero, "Environment", 0x0002, 5000, [ref]$result)
}

# The user PATH is read and written unexpanded as REG_EXPAND_SZ, so entries such
# as %USERPROFILE%\... or %JAVA_HOME%\bin keep following their variables.
function Add-AiCliUserPath {
    param([string]$Directory)

    $environmentKey = $null
    $userPath = ""
    $userEntries = @()
    $processEntries = @()

    if (-not (Test-Path -LiteralPath $Directory -PathType Container)) {
        return
    }
    $environmentKey = [Microsoft.Win32.Registry]::CurrentUser.OpenSubKey("Environment", $true)
    try {
        $userPath = [string]$environmentKey.GetValue("Path", "", [Microsoft.Win32.RegistryValueOptions]::DoNotExpandEnvironmentNames)
        $userEntries = @(($userPath -split ';') | Where-Object { -not [string]::IsNullOrWhiteSpace($_) })
        if ($userEntries -notcontains $Directory) {
            $environmentKey.SetValue("Path", ((@($Directory) + $userEntries) -join ';'), [Microsoft.Win32.RegistryValueKind]::ExpandString)
            Send-AiCliEnvironmentChange
            Write-Host "[PATH] Added $Directory to the user PATH." -ForegroundColor Green
        }
    } finally {
        $environmentKey.Close()
    }
    $processEntries = @(($env:Path -split ';') | Where-Object { -not [string]::IsNullOrWhiteSpace($_) })
    if ($processEntries -notcontains $Directory) {
        $env:Path = (@($Directory) + $processEntries) -join ';'
    }
}

function Invoke-AiCliClaudeNativeInstall {
    $installerUrl = $null
    $installerContent = $null
    $powerShellExe = $null
    $installerExitCode = 1

    $powerShellExe = (Get-Process -Id $PID).Path
    [Net.ServicePointManager]::SecurityProtocol = [Net.ServicePointManager]::SecurityProtocol -bor [Net.SecurityProtocolType]::Tls12
    foreach ($installerUrl in $AiCliClaudeInstallerUrls) {
        try {
            Write-Host "[INSTALL] Fetching official native installer: $installerUrl" -ForegroundColor Cyan
            $installerContent = Invoke-RestMethod -Uri $installerUrl -ErrorAction Stop
            if (($installerContent -isnot [string]) -or ($installerContent -match '<html')) {
                throw "unexpected installer content"
            }
            Set-Content -LiteralPath $AiCliClaudeInstallerFile -Value $installerContent -Encoding UTF8
            # Child process: the official installer calls exit on failure, which would
            # otherwise terminate the calling launcher.
            & $powerShellExe -NoProfile -ExecutionPolicy Bypass -File $AiCliClaudeInstallerFile
            $installerExitCode = $LASTEXITCODE
            Remove-Item -LiteralPath $AiCliClaudeInstallerFile -Force -ErrorAction SilentlyContinue
            Add-AiCliUserPath -Directory $AiCliClaudeBinDir
            if (($installerExitCode -eq 0) -and (Test-Path -LiteralPath $AiCliClaudeExe)) {
                return $true
            }
            Write-Host "[WARN] Official native installer failed from $installerUrl (exit code $installerExitCode)" -ForegroundColor Yellow
        }
        catch {
            Write-Host "[WARN] Official native installer failed from $installerUrl`: $($_.Exception.Message)" -ForegroundColor Yellow
        }
    }
    return $false
}

function Get-AiCliPublishedVersion {
    param(
        [string]$Tool,
        [string]$Package
    )

    $packageManagerCommand = $null
    $publishedOutput = $null
    $publishedVersion = $null

    if ($Tool -eq "claude") {
        try {
            $publishedOutput = [string](Invoke-RestMethod -Uri $AiCliClaudeLatestUrl -TimeoutSec 10 -ErrorAction Stop)
            return (Get-AiCliVersion -VersionText $publishedOutput)
        }
        catch {
            return $null
        }
    }
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
        & $packageManagerCommand.Source add --global $packageSpecifier
        if ($LASTEXITCODE -eq 0) {
            return $true
        }
    }
    $packageManagerCommand = Get-Command npm -ErrorAction SilentlyContinue
    if ($null -ne $packageManagerCommand) {
        & $packageManagerCommand.Source install --global $packageSpecifier
        if ($LASTEXITCODE -eq 0) {
            return $true
        }
    }
    return $false
}

function Invoke-AiCliNativeInstall {
    param([string]$Tool)

    $installerContent = $null

    if ($Tool -eq "claude") {
        return (Invoke-AiCliClaudeNativeInstall)
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
        & $toolCommand.Source update
        $env:DISABLE_AUTOUPDATER = $autoUpdaterBackup
        if ($LASTEXITCODE -eq 0) {
            return $true
        }
        return $false
    }
    if ($Tool -eq "kimi") {
        return (Invoke-AiCliNativeInstall -Tool $Tool)
    }
    return $false
}

function Install-AiCliIfMissing {
    param([string]$Tool)

    $toolPackage = ""
    $toolLabel = ""

    if (-not $AiCliPackages.ContainsKey($Tool)) {
        return
    }
    if ($Tool -eq "claude") {
        Add-AiCliUserPath -Directory $AiCliClaudeBinDir
    }
    if ($null -ne (Get-Command $Tool -ErrorAction SilentlyContinue)) {
        return
    }

    $toolPackage = $AiCliPackages[$Tool]
    $toolLabel = $AiCliLabels[$Tool]
    Write-Host "[INFO] $toolLabel is not installed; running the idempotent install..." -ForegroundColor Cyan
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

    if (-not $AiCliPackages.ContainsKey($Tool)) {
        return
    }
    $toolCommand = Get-Command $Tool -ErrorAction SilentlyContinue
    if ($null -eq $toolCommand) {
        return
    }

    $toolPackage = $AiCliPackages[$Tool]
    $toolLabel = $AiCliLabels[$Tool]
    $installedOutput = (& $toolCommand.Source --version 2>$null | Out-String).Trim()
    $installedVersion = Get-AiCliVersion -VersionText $installedOutput
    $publishedVersion = Get-AiCliPublishedVersion -Tool $Tool -Package $toolPackage

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
}

function Get-AiCliUltracodeArgs {
    param([string]$SettingsName)

    $ultracodeChoice = ""
    $ultracodeSettingsFile = $null
    $existingSettings = $null
    $tempDirectory = [System.IO.Path]::GetTempPath()

    Write-Host "Enable ultracode? [Y/n] (auto-Y in $AiCliUltracodeTimeoutSeconds`s): " -ForegroundColor Yellow -NoNewline
    $ultracodeChoice = Read-AiCliTimedChoice -TimeoutSeconds $AiCliUltracodeTimeoutSeconds
    if ([string]::IsNullOrEmpty($ultracodeChoice)) {
        Write-Host "Y (auto)"
    }
    if (($ultracodeChoice -eq 'n') -or ($ultracodeChoice -eq 'N')) {
        Write-Host "[INFO] Ultracode: off" -ForegroundColor Green
        return
    }
    # Role windows start about 1 s apart and share this file: write only when the
    # content differs, and fall back to a per-process file when a parallel
    # writer holds it.
    $ultracodeSettingsFile = Join-Path $tempDirectory ("{0}_ultracode_settings.json" -f $SettingsName)
    if (Test-Path -LiteralPath $ultracodeSettingsFile -PathType Leaf) {
        try {
            $existingSettings = [System.IO.File]::ReadAllText($ultracodeSettingsFile)
        } catch [System.IO.IOException] {
            $existingSettings = $null
        }
    }
    if ($existingSettings -ne $AiCliUltracodeSettingsJson) {
        try {
            [System.IO.File]::WriteAllText($ultracodeSettingsFile, $AiCliUltracodeSettingsJson)
        } catch [System.IO.IOException] {
            $ultracodeSettingsFile = Join-Path $tempDirectory ("{0}_ultracode_settings_{1}.json" -f $SettingsName, $PID)
            [System.IO.File]::WriteAllText($ultracodeSettingsFile, $AiCliUltracodeSettingsJson)
        }
    }
    Write-Host "[INFO] Ultracode: on" -ForegroundColor Green
    return @("--settings", $ultracodeSettingsFile)
}
