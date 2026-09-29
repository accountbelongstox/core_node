<#
.SYNOPSIS
    AI Tools Catalog (Windows) - single source of truth, parity with
    scripts/shells/linux/common/ai_tools_catalog.sh.

.DESCRIPTION
    One entry per AI CLI / helper binary, using the SAME 17 keys as the Linux
    catalog (claude, codex, gemini, qwen, cursor_agent, kimi, cline, arkcli,
    superclaude, opencode, auggie, droid, zhipuai, bun, pi, omp, agy) plus the
    pseudo-key "mcp_chrome" (metadata only; install mechanics stay in
    apps/mcp-chrome/scripts/start.ps1, per the AI_TOOLS_CATALOG_KEYS design).

    Install mechanics (PackageId / InstallType / PowerShellCommand) are NOT
    duplicated here: for every key with a Windows build, WindowsPackageKey
    cross-references the existing $Global:DEV_SOFTWARE_PACKAGES entry in
    ApplicationsList.ps1 (the generic winget/pnpm/npm/pip/uv/powershell install
    engine already used by Step21_InstallApplications.ps1 and the APP Install
    menu). Get-AiToolInstallSpec resolves that entry lazily. Keys with no
    Windows build (auggie: no official Windows installer found) are marked
    Supported = $false rather than inventing an installer. bun/pi/omp have no
    DEV_SOFTWARE_PACKAGES entry -- they are installed as a group by the
    existing Step41_InstallPiHarness.ps1 (kept as-is; StepOnly points at it).

    Consumers (must read this file instead of keeping their own AI package
    table):
      - install_powershells/Step65_InstallAiTools.ps1  (the step that owns
        every AI CLI install/verify/status for -Only/-List/-Status)
      - win_common/AiCliProvisionCommon.ps1            (launcher-time lazy
        install/upgrade for claude/codex/kimi)
      - menu_itemshells/MCPManagementMenu.ps1           ("AI Tools & MCP" menu)

    Shared-login research (same official docs as the Linux catalog; verified
    2026-09-28):
      Claude Code : CLAUDE_CONFIG_DIR   - https://code.claude.com/docs/en/env-vars
      Codex       : CODEX_HOME          - https://developers.openai.com/codex/environment-variables
      Kimi Code   : KIMI_CODE_HOME      - https://www.kimi.com/code/docs/en/kimi-code-cli/configuration/env-vars.html
      Cline       : CLINE_DATA_DIR      - https://docs.cline.bot/getting-started/config
      Cursor CLI  : CURSOR_CONFIG_DIR   - https://cursor.com/docs/cli/reference/configuration
      opencode    : OPENCODE_CONFIG_DIR (partial: agents/commands/modes/plugins
                    only, not the full opencode.json) - https://opencode.ai/docs/config/
      gemini, qwen, droid, arkcli, superclaude, auggie, zhipuai, pi, omp, bun,
      agy: no documented config-dir environment variable found -> not shareable
      (same conclusion as the Linux catalog; re-check upstream docs before
      relying on this).

    Shared login on Windows (see Set-AiToolSharedLoginMachineEnv below): unlike
    Linux (root vs. the real desktop user via sudo), a normal elevated
    PowerShell (UAC "Run as administrator") still runs as the SAME user
    account, so it already sees the same %USERPROFILE% as the interactive
    session -- no split to bridge there. The split that DOES exist on Windows
    is a background context running as a DIFFERENT account (a service, a
    scheduled/logon task under SYSTEM or another account, e.g. the
    ncore-mcp-chrome logon task or an NSSM service): those get their own
    profile. For that case this script writes the documented config-dir
    variables at Machine scope (visible to every account, services included)
    pointing at the INTERACTIVE user's config directories, so a background
    context reads/writes the same shared config instead of creating its own
    under a service profile. Run Initialize-AiToolSharedLogin interactively as
    the normal desktop user (not from a SYSTEM-context service) so
    $env:USERPROFILE resolves to the right directories.
#>

$script:AiToolsCatalogDir = $PSScriptRoot
$script:AiToolsApplicationsListPath = Join-Path $script:AiToolsCatalogDir "ApplicationsList.ps1"
$script:AiToolsMachineEnvNote = "Managed by win_common/AiToolsCatalog.ps1 (Initialize-AiToolSharedLogin) - safe to delete; it is regenerated on the next run."

# Ordered key list (same order/semantics as AI_TOOLS_CATALOG_KEYS on Linux):
# native/step-owned tools first, dependency helpers (bun before omp) last.
$Global:AiToolsCatalogKeys = @(
    "claude", "codex", "gemini", "qwen", "cursor_agent", "kimi", "cline",
    "arkcli", "superclaude", "opencode", "auggie", "droid", "zhipuai",
    "bun", "pi", "omp", "agy"
)

# One entry per key. WindowsPackageKey cross-references
# $Global:DEV_SOFTWARE_PACKAGES (ApplicationsList.ps1); $null means "no single
# DEV_SOFTWARE_PACKAGES entry" (bun/pi/omp are installed together by
# Step41Script, auggie has no Windows build at all).
$Global:AiToolsCatalog = @{
    claude = @{
        Name = "Anthropic Claude Code"
        Exec = "claude.exe"
        # Official native install only (Invoke-AiCliNativeEnsure): this directory is
        # the ONLY PATH provider of claude; NonNativePackage copies are removed.
        NativeBinDir = (Join-Path (Join-Path $env:USERPROFILE ".local") "bin")
        NativeInstallerUrls = @("https://claude.ai/install.ps1", "https://downloads.claude.ai/claude-code-releases/bootstrap.ps1")
        NativeInstallerEnv = @{}
        NonNativePackage = "@anthropic-ai/claude-code"
        WindowsPackageKey = "ClaudeCode"
        StepOnly = $null
        Supported = $true
        VerifyArg = "--version"
        ConfigEnv = "CLAUDE_CONFIG_DIR"
        ConfigDirRelative = ".claude"
        ConfigDocUrl = "https://code.claude.com/docs/en/env-vars"
        Shareable = "yes"
    }
    codex = @{
        Name = "OpenAI Codex"
        Exec = "codex.exe"
        # Official standalone installer (chatgpt.com/codex/install.ps1, no Node.js);
        # same native-only contract as claude.
        NativeBinDir = (Join-Path (Join-Path (Join-Path (Join-Path $env:LOCALAPPDATA "Programs") "OpenAI") "Codex") "bin")
        NativeInstallerUrls = @("https://chatgpt.com/codex/install.ps1")
        NativeInstallerEnv = @{ CODEX_NON_INTERACTIVE = "1" }
        NonNativePackage = "@openai/codex"
        WindowsPackageKey = "OpenAICodex"
        StepOnly = $null
        Supported = $true
        VerifyArg = "--version"
        ConfigEnv = "CODEX_HOME"
        ConfigDirRelative = ".codex"
        ConfigDocUrl = "https://developers.openai.com/codex/environment-variables"
        Shareable = "yes"
    }
    gemini = @{
        Name = "Google Gemini CLI"
        Exec = "gemini"
        WindowsPackageKey = "GeminiCli"
        PnpmFallbackPackage = "@google/gemini-cli"
        StepOnly = $null
        Supported = $true
        VerifyArg = "--version"
        ConfigEnv = ""
        ConfigDirRelative = ".gemini"
        ConfigDocUrl = "https://github.com/google-gemini/gemini-cli/issues/2815"
        Shareable = "no"
    }
    qwen = @{
        Name = "Qwen Code"
        Exec = "qwen"
        WindowsPackageKey = "QwenCode"
        PnpmFallbackPackage = "@qwen-code/qwen-code"
        StepOnly = $null
        Supported = $true
        VerifyArg = "--version"
        ConfigEnv = ""
        ConfigDirRelative = ".qwen"
        ConfigDocUrl = "https://qwenlm.github.io/qwen-code-docs/en/users/configuration/settings/"
        Shareable = "no"
    }
    cursor_agent = @{
        Name = "Cursor Agent"
        Exec = "agent.exe"
        WindowsPackageKey = "CursorAgent"
        PnpmFallbackPackage = ""
        StepOnly = $null
        Supported = $true
        VerifyArg = "--version"
        ConfigEnv = "CURSOR_CONFIG_DIR"
        ConfigDirRelative = ".cursor"
        ConfigDocUrl = "https://cursor.com/docs/cli/reference/configuration"
        Shareable = "yes"
    }
    kimi = @{
        Name = "Kimi Code CLI"
        Exec = "kimi.exe"
        WindowsPackageKey = "KimiCode"
        PnpmFallbackPackage = "@moonshot-ai/kimi-code"
        StepOnly = $null
        Supported = $true
        VerifyArg = "--version"
        ConfigEnv = "KIMI_CODE_HOME"
        ConfigDirRelative = ".kimi-code"
        ConfigDocUrl = "https://www.kimi.com/code/docs/en/kimi-code-cli/configuration/env-vars.html"
        Shareable = "yes"
    }
    cline = @{
        Name = "Cline CLI"
        Exec = "cline"
        WindowsPackageKey = "ClineCLI"
        PnpmFallbackPackage = "cline"
        StepOnly = $null
        Supported = $true
        VerifyArg = "--version"
        ConfigEnv = "CLINE_DATA_DIR"
        ConfigDirRelative = Join-Path ".cline" "data"
        ConfigDocUrl = "https://docs.cline.bot/getting-started/config"
        Shareable = "yes"
    }
    arkcli = @{
        Name = "Volcano Ark CLI"
        Exec = "arkcli"
        WindowsPackageKey = "ArkCli"
        PnpmFallbackPackage = "@volcengine/ark-cli"
        StepOnly = $null
        Supported = $true
        VerifyArg = "--version"
        ConfigEnv = ""
        ConfigDirRelative = ""
        ConfigDocUrl = ""
        Shareable = "no"
    }
    superclaude = @{
        Name = "SuperClaude Framework"
        Exec = "superclaude.exe"
        WindowsPackageKey = "SuperClaude"
        PnpmFallbackPackage = ""
        StepOnly = $null
        Supported = $true
        VerifyArg = "--version"
        ConfigEnv = ""
        ConfigDirRelative = ""
        ConfigDocUrl = ""
        Shareable = "no"
    }
    opencode = @{
        Name = "OpenCode AI"
        Exec = "opencode.exe"
        WindowsPackageKey = "OpenCode"
        PnpmFallbackPackage = ""
        StepOnly = $null
        Supported = $true
        VerifyArg = "--version"
        ConfigEnv = "OPENCODE_CONFIG_DIR"
        ConfigDirRelative = Join-Path ".config" "opencode"
        ConfigDocUrl = "https://opencode.ai/docs/config/"
        Shareable = "partial"
    }
    auggie = @{
        Name = "Augment Code Auggie"
        Exec = "auggie"
        WindowsPackageKey = $null
        PnpmFallbackPackage = ""
        StepOnly = $null
        # No official Windows installer/build found for Auggie (Linux/macOS only
        # at the time of this catalog); left unsupported rather than guessing.
        Supported = $false
        VerifyArg = "--version"
        ConfigEnv = ""
        ConfigDirRelative = ""
        ConfigDocUrl = ""
        Shareable = "no"
    }
    droid = @{
        Name = "Droid AI Assistant"
        Exec = "droid.exe"
        WindowsPackageKey = "Droid"
        PnpmFallbackPackage = ""
        StepOnly = $null
        Supported = $true
        VerifyArg = "--version"
        ConfigEnv = ""
        ConfigDirRelative = ".factory"
        ConfigDocUrl = "https://docs.factory.ai/droid-cli/settings"
        Shareable = "no"
    }
    zhipuai = @{
        Name = "Zhipu AI SDK"
        Exec = ""
        WindowsPackageKey = "ZhipuAI"
        PnpmFallbackPackage = ""
        StepOnly = $null
        Supported = $true
        VerifyArg = ""
        ConfigEnv = ""
        ConfigDirRelative = ""
        ConfigDocUrl = ""
        Shareable = "no"
    }
    bun = @{
        Name = "Bun"
        Exec = "bun.exe"
        WindowsPackageKey = $null
        PnpmFallbackPackage = ""
        StepOnly = "Step41_InstallPiHarness.ps1"
        Supported = $true
        VerifyArg = "--version"
        ConfigEnv = ""
        ConfigDirRelative = ""
        ConfigDocUrl = ""
        Shareable = "no"
    }
    pi = @{
        Name = "Pi Coding Agent"
        Exec = "pi"
        WindowsPackageKey = $null
        PnpmFallbackPackage = "@earendil-works/pi-coding-agent"
        StepOnly = "Step41_InstallPiHarness.ps1"
        Supported = $true
        VerifyArg = "--version"
        ConfigEnv = ""
        ConfigDirRelative = ""
        ConfigDocUrl = ""
        Shareable = "no"
    }
    omp = @{
        Name = "OMP"
        Exec = "omp.exe"
        WindowsPackageKey = $null
        PnpmFallbackPackage = ""
        StepOnly = "Step41_InstallPiHarness.ps1"
        Supported = $true
        VerifyArg = "--version"
        ConfigEnv = ""
        ConfigDirRelative = ""
        ConfigDocUrl = ""
        Shareable = "no"
    }
    agy = @{
        Name = "Antigravity CLI"
        Exec = "agy.exe"
        WindowsPackageKey = "AntigravityCli"
        PnpmFallbackPackage = ""
        StepOnly = $null
        Supported = $true
        VerifyArg = "--help"
        ConfigEnv = ""
        ConfigDirRelative = ""
        ConfigDocUrl = ""
        Shareable = "no"
    }
}

# mcp_chrome is a pseudo-key: metadata only, install mechanics stay in
# apps/mcp-chrome/scripts/start.ps1 (build + -Service registers the
# ncore-mcp-chrome logon task, hot reload via its own dev-watch).
$Global:AiToolsCatalogMcpChromeKey = "mcp_chrome"

# ai_catalog_get equivalent: returns $null when the key or field is unknown.
function Get-AiTool {
    param([Parameter(Mandatory = $true)][string]$Key)
    if ($Global:AiToolsCatalog.ContainsKey($Key)) {
        return $Global:AiToolsCatalog[$Key]
    }
    return $null
}

# Optional catalog field of <Key>; $null when the tool or the field is absent
# (StrictMode throws on a missing hashtable key read as a property).
function Get-AiToolField {
    param(
        [Parameter(Mandatory = $true)][string]$Key,
        [Parameter(Mandatory = $true)][string]$Field
    )
    $tool = Get-AiTool -Key $Key
    if (($null -eq $tool) -or (-not $tool.ContainsKey($Field))) {
        return $null
    }
    return $tool[$Field]
}

function Test-AiToolExists {
    param([Parameter(Mandatory = $true)][string]$Key)
    return $Global:AiToolsCatalog.ContainsKey($Key)
}

function Get-AiToolKeys {
    return $Global:AiToolsCatalogKeys
}

# Resolves the DEV_SOFTWARE_PACKAGES entry (PackageId/InstallType/
# PowerShellCommand/EnvVars/...) for a catalog key -- the install mechanics
# live only in ApplicationsList.ps1, never duplicated here. Dot-sources
# ApplicationsList.ps1 lazily (only when a caller actually needs install
# specs), not at catalog-load time, so callers that only need Name/Exec/
# config-dir metadata (e.g. every launcher via AiCliProvisionCommon.ps1) stay
# cheap.
function Get-AiToolInstallSpec {
    param([Parameter(Mandatory = $true)][string]$Key)

    $tool = Get-AiTool -Key $Key
    if ($null -eq $tool -or [string]::IsNullOrWhiteSpace([string]$tool.WindowsPackageKey)) {
        return $null
    }
    if (-not (Get-Variable -Name "DEV_SOFTWARE_PACKAGES" -Scope Global -ErrorAction SilentlyContinue)) {
        if (Test-Path -LiteralPath $script:AiToolsApplicationsListPath) {
            . $script:AiToolsApplicationsListPath
        }
    }
    if ($null -eq $Global:DEV_SOFTWARE_PACKAGES -or -not $Global:DEV_SOFTWARE_PACKAGES.ContainsKey([string]$tool.WindowsPackageKey)) {
        return $null
    }
    return $Global:DEV_SOFTWARE_PACKAGES[[string]$tool.WindowsPackageKey]
}

# Full path under the current user's profile, or $null when the tool has no
# documented config dir.
function Get-AiToolConfigDir {
    param([Parameter(Mandatory = $true)][string]$Key)

    $tool = Get-AiTool -Key $Key
    if ($null -eq $tool -or [string]::IsNullOrWhiteSpace([string]$tool.ConfigDirRelative)) {
        return $null
    }
    return (Join-Path $env:USERPROFILE ([string]$tool.ConfigDirRelative))
}

# Keys whose shared-login variable is documented (shareable = yes/partial).
function Get-AiToolShareableKeys {
    $result = @()
    foreach ($key in $Global:AiToolsCatalogKeys) {
        $tool = Get-AiTool -Key $key
        if ($null -eq $tool) { continue }
        if ([string]::IsNullOrWhiteSpace([string]$tool.ConfigEnv)) { continue }
        if (([string]$tool.Shareable) -eq "yes" -or ([string]$tool.Shareable) -eq "partial") {
            $result += $key
        }
    }
    return $result
}

# See the shared-login note in the file header: writes the documented
# config-dir variables at Machine scope (visible to services / scheduled
# tasks running as a different account) pointing at THIS interactive user's
# config directories, and ensures each directory exists. Run interactively as
# the normal desktop user. Idempotent: safe to re-run; only changed values are
# written.
function Initialize-AiToolSharedLogin {
    $shareableKeys = @(Get-AiToolShareableKeys)
    $configuredVars = @()

    if ($shareableKeys.Count -eq 0) {
        Write-Host "[AI Tools] No shareable AI CLI config-dir variables to configure." -ForegroundColor Yellow
        return $configuredVars
    }

    foreach ($key in $shareableKeys) {
        $tool = Get-AiTool -Key $key
        $envVar = [string]$tool.ConfigEnv
        $configDir = Get-AiToolConfigDir -Key $key
        if ([string]::IsNullOrWhiteSpace($configDir)) { continue }

        if (-not (Test-Path -LiteralPath $configDir)) {
            New-Item -ItemType Directory -Path $configDir -Force | Out-Null
        }

        $currentMachineValue = [System.Environment]::GetEnvironmentVariable($envVar, "Machine")
        if ($currentMachineValue -ne $configDir) {
            [System.Environment]::SetEnvironmentVariable($envVar, $configDir, "Machine")
            Write-Host "[AI Tools] Set $envVar=$configDir at Machine scope (shared with services/scheduled tasks)." -ForegroundColor Green
        } else {
            Write-Host "[AI Tools] $envVar already set at Machine scope: $configDir" -ForegroundColor DarkGray
        }
        Set-Item -Path "Env:$envVar" -Value $configDir
        $configuredVars += $envVar
    }

    Write-Host "[AI Tools] $script:AiToolsMachineEnvNote" -ForegroundColor DarkGray
    return $configuredVars
}

# Status matrix: tool | shareable | env var | config dir | machine-scope value.
function Show-AiToolSharedLoginStatus {
    Write-Host ("{0,-14} {1,-9} {2,-20} {3,-40} {4}" -f "TOOL", "SHAREABLE", "ENV VAR", "CONFIG DIR", "MACHINE VALUE")
    foreach ($key in $Global:AiToolsCatalogKeys) {
        $tool = Get-AiTool -Key $key
        if ($null -eq $tool) { continue }
        $envVar = [string]$tool.ConfigEnv
        $shareable = [string]$tool.Shareable
        if ($shareable -eq "no" -and [string]::IsNullOrWhiteSpace($envVar)) { continue }
        $configDir = Get-AiToolConfigDir -Key $key
        $machineValue = ""
        if (-not [string]::IsNullOrWhiteSpace($envVar)) {
            $machineValue = [System.Environment]::GetEnvironmentVariable($envVar, "Machine")
        }
        Write-Host ("{0,-14} {1,-9} {2,-20} {3,-40} {4}" -f $key, $shareable, $(if ($envVar) { $envVar } else { "(none)" }), $(if ($configDir) { $configDir } else { "-" }), $(if ($machineValue) { $machineValue } else { "not set" }))
    }
}
