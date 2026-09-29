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
$AiCliClaudeLatestUrl = "https://downloads.claude.ai/claude-code-releases/latest"
$AiCliNativeInstallerFileName = "ai-cli-native-install.ps1"
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
$AiCliPackages = @{}
$AiCliLabels = @{}
foreach ($aiCliKey in @("claude", "codex", "kimi")) {
    $aiCliTool = Get-AiTool -Key $aiCliKey
    if ($null -eq $aiCliTool) { continue }
    $AiCliPackages[$aiCliKey] = [string]$aiCliTool.PnpmFallbackPackage
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

# True when the catalog marks <Tool> as native-only (official installer).
function Test-AiCliNativeTool {
    param([string]$Tool)

    $tool = Get-AiTool -Key $Tool
    return (($null -ne $tool) -and (-not [string]::IsNullOrWhiteSpace([string]$tool.NativeBinDir)))
}

# Native executable of <Tool>: <NativeBinDir>\<Exec>.
function Get-AiCliNativeExe {
    param([string]$Tool)

    $tool = Get-AiTool -Key $Tool
    return (Join-Path ([string]$tool.NativeBinDir) ([string]$tool.Exec))
}

# Run the official installer of <Tool> from each catalog URL until one leaves
# the native executable in place. Child process: official installers call
# exit on failure, which would otherwise terminate the caller.
function Invoke-AiCliNativeInstaller {
    param([string]$Tool)

    $tool = Get-AiTool -Key $Tool
    $installerUrl = $null
    $installerContent = $null
    $installerFile = Join-Path ([System.IO.Path]::GetTempPath()) $AiCliNativeInstallerFileName
    $powerShellExe = (Get-Process -Id $PID).Path
    $installerExitCode = 1
    $envName = ""
    $savedEnv = @{}

    [Net.ServicePointManager]::SecurityProtocol = [Net.ServicePointManager]::SecurityProtocol -bor [Net.SecurityProtocolType]::Tls12
    foreach ($envName in @($tool.NativeInstallerEnv.Keys)) {
        $savedEnv[$envName] = [Environment]::GetEnvironmentVariable($envName, "Process")
        [Environment]::SetEnvironmentVariable($envName, [string]$tool.NativeInstallerEnv[$envName], "Process")
    }
    try {
        foreach ($installerUrl in @($tool.NativeInstallerUrls)) {
            try {
                Write-Host "[INSTALL] Fetching official installer for $($tool.Name): $installerUrl" -ForegroundColor Cyan
                $installerContent = Invoke-RestMethod -Uri $installerUrl -ErrorAction Stop
                if (($installerContent -isnot [string]) -or ($installerContent -match '<html')) {
                    throw "unexpected installer content"
                }
                Set-Content -LiteralPath $installerFile -Value $installerContent -Encoding UTF8
                & $powerShellExe -NoProfile -ExecutionPolicy Bypass -File $installerFile
                $installerExitCode = $LASTEXITCODE
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

    $tool = Get-AiTool -Key $Tool
    $nativeExe = ""
    $installedOutput = ""
    $previousPreference = $ErrorActionPreference

    if (-not (Test-AiCliNativeTool -Tool $Tool)) {
        Write-Host "[ERROR] $Tool is not a native-only catalog tool." -ForegroundColor Red
        return $false
    }
    $nativeExe = Get-AiCliNativeExe -Tool $Tool
    Write-Host "[INFO] $($tool.Name): official native install only ($nativeExe)" -ForegroundColor Cyan
    if (Test-Path -LiteralPath $nativeExe) {
        $ErrorActionPreference = "Continue"
        $installedOutput = (& $nativeExe --version 2>&1 | Out-String).Trim()
        $ErrorActionPreference = $previousPreference
        Write-Host "[SKIP] Native $($tool.Name) present: $installedOutput" -ForegroundColor Green
    }
    elseif (-not (Invoke-AiCliNativeInstaller -Tool $Tool)) {
        Write-Host "[ERROR] Official installer failed; $($tool.Name) is not installed." -ForegroundColor Red
        return $false
    }
    Remove-AiCliGlobalPackage -Package ([string]$tool.NonNativePackage)
    & $AiCliPathFunctionPath "unique" ([System.IO.Path]::GetFileNameWithoutExtension([string]$tool.Exec)) ([string]$tool.NativeBinDir)
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
        & $toolCommand.Source update
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
    # Native-only tools publish the same version as their registry package.
    $publishedVersion = Get-AiCliPublishedVersion -Tool $Tool -Package $(if ([string]::IsNullOrWhiteSpace($toolPackage)) { [string](Get-AiTool -Key $Tool).NonNativePackage } else { $toolPackage })

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
