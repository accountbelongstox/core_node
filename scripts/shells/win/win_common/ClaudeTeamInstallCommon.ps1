# =============================================================================
# Shared idempotent Claude team setup (Windows / PowerShell)
# =============================================================================
# One implementation called by dd.ps1 (Step21, ClaudeCode PostInstallCallbacks) and
# by the claudeteamup/claudeagents launchers (ClaudeTeamCommon.ps1) on every run.
# Linux counterpart: claude_team_install in scripts/ai_shtools/claude_code_install.sh
# Each item is checked and repaired on its own: node (project hooks), git (Git
# Bash), Windows Terminal (the named team window; warns below 1.21), python (the
# secret reader of remote roles), the team state/shared/memory
# dirs, the core_node PATH entries, and the catalog user_settings_merge keys in
# the user settings (added only when absent, never overwritten). The Remote
# Control environment check and the Claude account check (sign-in, first-run
# setup, repo trust) only report. -CheckOnly reports [SKIP]/[MISSING] without
# changing anything.
# =============================================================================

$ClaudeTeamInstallWinCommonDir = $PSScriptRoot
$ClaudeTeamInstallWinDir = Split-Path $ClaudeTeamInstallWinCommonDir -Parent
$ClaudeTeamInstallShellsDir = Split-Path $ClaudeTeamInstallWinDir -Parent
$ClaudeTeamInstallScriptsDir = Split-Path $ClaudeTeamInstallShellsDir -Parent
$ClaudeTeamInstallRootDir = Split-Path $ClaudeTeamInstallScriptsDir -Parent
$ClaudeTeamInstallClaudeDir = Join-Path $ClaudeTeamInstallRootDir ".claude"
$ClaudeTeamInstallSharedDir = Join-Path $ClaudeTeamInstallClaudeDir "agents_shared"
$ClaudeTeamInstallConfigDir = Join-Path $ClaudeTeamInstallRootDir "config"
$ClaudeTeamInstallCatalogPath = Join-Path $ClaudeTeamInstallConfigDir "claude_team_roles.json"
$ClaudeTeamInstallStateBaseDir = Join-Path $env:LOCALAPPDATA "core_node"
$ClaudeTeamInstallStateDir = Join-Path $ClaudeTeamInstallStateBaseDir "claude_team"
$ClaudeTeamInstallWinEnvsDir = Join-Path $ClaudeTeamInstallScriptsDir "winenvs"
$ClaudeTeamInstallStoreAliasDir = Join-Path (Join-Path $env:LOCALAPPDATA "Microsoft") "WindowsApps"
$ClaudeTeamInstallBinaries = @(
    @{ Commands = @("node.exe"); WingetId = "OpenJS.NodeJS.LTS"; SkipStoreAlias = $false; Purpose = "project hooks .claude/hooks/*.mjs" },
    @{ Commands = @("git.exe"); WingetId = "Git.Git"; SkipStoreAlias = $false; Purpose = "Git for Windows: official recommendation, enables the Bash tool (Git Bash)" },
    @{ Commands = @("wt.exe"); WingetId = "Microsoft.WindowsTerminal"; SkipStoreAlias = $false; Purpose = "the named team window with packed tabs (console fallback without it)" },
    @{ Commands = @("python.exe", "py.exe"); WingetId = "Python.Python.3.13"; SkipStoreAlias = $true; Purpose = "secret store reader for remote roles (scripts/pytools)" }
)
$ClaudeTeamInstallAgentMemoryDir = Join-Path $ClaudeTeamInstallClaudeDir "agent-memory"
$ClaudeTeamInstallUserClaudeDir = [Environment]::GetEnvironmentVariable("CLAUDE_CONFIG_DIR", "Process")
if ([string]::IsNullOrWhiteSpace($ClaudeTeamInstallUserClaudeDir)) {
    $ClaudeTeamInstallUserClaudeDir = Join-Path $env:USERPROFILE ".claude"
} else {
    $ClaudeTeamInstallUserClaudeDir = [System.IO.Path]::GetFullPath([Environment]::ExpandEnvironmentVariables($ClaudeTeamInstallUserClaudeDir))
}
$ClaudeTeamInstallUserSettingsPath = Join-Path $ClaudeTeamInstallUserClaudeDir "settings.json"
# Global Claude Code state (first-run setup, account, per-project trust); it sits
# next to .claude, not inside it, unless CLAUDE_CONFIG_DIR is set.
$ClaudeTeamInstallGlobalConfigDir = $env:USERPROFILE
if (-not [string]::IsNullOrWhiteSpace([Environment]::GetEnvironmentVariable("CLAUDE_CONFIG_DIR", "Process"))) {
    $ClaudeTeamInstallGlobalConfigDir = $ClaudeTeamInstallUserClaudeDir
}
$ClaudeTeamInstallGlobalConfigPath = Join-Path $ClaudeTeamInstallGlobalConfigDir ".claude.json"
$ClaudeTeamInstallCredentialsPath = Join-Path $ClaudeTeamInstallUserClaudeDir ".credentials.json"
# Environment credentials that replace a claude.ai sign-in (names only, never values).
$ClaudeTeamInstallEnvCredentialNames = @("ANTHROPIC_API_KEY", "ANTHROPIC_AUTH_TOKEN", "CLAUDE_CODE_OAUTH_TOKEN", "CLAUDE_CODE_USE_BEDROCK", "CLAUDE_CODE_USE_VERTEX", "CLAUDE_CODE_USE_FOUNDRY")
# Result of Test-ClaudeTeamAccount: ready|login|onboarding|trust|missing.
$script:ClaudeTeamAccountState = ""
$ClaudeTeamInstallWtPackageName = "Microsoft.WindowsTerminal*"
$ClaudeTeamInstallWtMinVersion = [version]"1.21"
$ClaudeTeamInstallRemoteControlEnvBlockers = @(
    "CLAUDE_CODE_DISABLE_NONESSENTIAL_TRAFFIC",
    "DISABLE_GROWTHBOOK",
    "CLAUDE_CODE_USE_BEDROCK",
    "CLAUDE_CODE_USE_VERTEX",
    "CLAUDE_CODE_USE_FOUNDRY"
)
$ClaudeTeamInstallRemoteControlSettingBlockers = @("isolatePeerMachines", "disableRemoteControl")
$ClaudeTeamInstallOfficialBaseUrl = "https://api.anthropic.com"
$ClaudeTeamInstallJsonIndent = "  "
$ClaudeTeamInstallUtf8NoBom = New-Object System.Text.UTF8Encoding($false)

function Write-ClaudeTeamInstallLog {
    param([string]$Level, [string]$Message)
    $color = "Gray"
    switch ($Level) {
        "SKIP" { $color = "Green" }
        "OK" { $color = "Green" }
        "INSTALL" { $color = "Yellow" }
        "MISSING" { $color = "Magenta" }
        "WARN" { $color = "Magenta" }
    }
    Write-Host ("  [{0}] {1}" -f $Level, $Message) -ForegroundColor $color
}

# First command found on PATH; the Microsoft Store python stubs in WindowsApps
# open the Store instead of running, so they do not count for python.
function Resolve-ClaudeTeamInstallCommand {
    param([string[]]$Names, [switch]$SkipStoreAlias)
    $name = $null
    $command = $null
    $aliasDir = $ClaudeTeamInstallStoreAliasDir.TrimEnd("\")
    foreach ($name in $Names) {
        foreach ($command in @(Get-Command $name -All -CommandType Application -ErrorAction SilentlyContinue)) {
            if ($SkipStoreAlias -and ((Split-Path $command.Source -Parent).TrimEnd("\") -eq $aliasDir)) {
                continue
            }
            return $command.Source
        }
    }
    return $null
}

function Install-ClaudeTeamBinary {
    param([hashtable]$Item, [bool]$CheckOnly)
    $commandPath = Resolve-ClaudeTeamInstallCommand -Names $Item["Commands"] -SkipStoreAlias:([bool]$Item["SkipStoreAlias"])
    $label = $Item["Commands"][0]
    $wingetCommand = $null
    if ($commandPath) {
        Write-ClaudeTeamInstallLog "SKIP" ("{0} present: {1} ({2})" -f $label, $commandPath, $Item["Purpose"])
        return
    }
    if ($CheckOnly) {
        Write-ClaudeTeamInstallLog "MISSING" ("{0} (winget {1}; {2})" -f $label, $Item["WingetId"], $Item["Purpose"])
        return
    }
    $wingetCommand = Get-Command "winget.exe" -ErrorAction SilentlyContinue
    if ($null -eq $wingetCommand) {
        Write-ClaudeTeamInstallLog "WARN" ("{0} missing and winget unavailable; install {1} manually" -f $label, $Item["WingetId"])
        return
    }
    Write-ClaudeTeamInstallLog "INSTALL" ("{0} missing; winget install --id {1} ({2})" -f $label, $Item["WingetId"], $Item["Purpose"])
    & $wingetCommand.Source install --id $Item["WingetId"] --exact --silent --accept-source-agreements --accept-package-agreements | Out-Host
    $commandPath = Resolve-ClaudeTeamInstallCommand -Names $Item["Commands"] -SkipStoreAlias:([bool]$Item["SkipStoreAlias"])
    if ($commandPath) {
        Write-ClaudeTeamInstallLog "OK" ("{0} installed: {1}" -f $label, $commandPath)
    } else {
        Write-ClaudeTeamInstallLog "WARN" ("{0} not on PATH yet; open a new shell after the install" -f $label)
    }
}

# Newest installed Windows Terminal package version, or $null when WT is not an
# Appx install (portable/scoop) or the Appx module is unavailable.
function Get-ClaudeTeamWindowsTerminalVersion {
    $packages = @()
    $package = $null
    $candidate = $null
    $best = $null
    try {
        $packages = @(Get-AppxPackage -Name $ClaudeTeamInstallWtPackageName -ErrorAction Stop)
    } catch {
        return $null
    }
    foreach ($package in $packages) {
        $candidate = $null
        if ([version]::TryParse([string]$package.Version, [ref]$candidate)) {
            if (($null -eq $best) -or ($candidate -gt $best)) {
                $best = $candidate
            }
        }
    }
    return $best
}

function Test-ClaudeTeamWindowsTerminalVersion {
    $wtPath = Resolve-ClaudeTeamInstallCommand -Names @("wt.exe")
    $version = $null
    if (-not $wtPath) {
        return
    }
    $version = Get-ClaudeTeamWindowsTerminalVersion
    if ($null -eq $version) {
        Write-ClaudeTeamInstallLog "WARN" ("Windows Terminal version unknown (not an Appx install); named windows, -M and focus-pane need {0}+" -f $ClaudeTeamInstallWtMinVersion)
    } elseif ($version -lt $ClaudeTeamInstallWtMinVersion) {
        Write-ClaudeTeamInstallLog "WARN" ("Windows Terminal {0} is older than {1}; run winget upgrade --id Microsoft.WindowsTerminal" -f $version, $ClaudeTeamInstallWtMinVersion)
    } else {
        Write-ClaudeTeamInstallLog "SKIP" ("Windows Terminal {0} (>= {1})" -f $version, $ClaudeTeamInstallWtMinVersion)
    }
}

function Install-ClaudeTeamDirectory {
    param([string]$Path, [string]$Purpose, [bool]$CheckOnly)
    if (Test-Path -LiteralPath $Path) {
        Write-ClaudeTeamInstallLog "SKIP" ("dir present: {0} ({1})" -f $Path, $Purpose)
        return
    }
    if ($CheckOnly) {
        Write-ClaudeTeamInstallLog "MISSING" ("dir {0} ({1})" -f $Path, $Purpose)
        return
    }
    New-Item -ItemType Directory -Path $Path -Force | Out-Null
    Write-ClaudeTeamInstallLog "OK" ("dir created: {0} ({1})" -f $Path, $Purpose)
}

function Install-ClaudeTeamPathEntry {
    param([bool]$CheckOnly)
    $pathEntries = @($env:Path -split ";" | Where-Object { $_ } | ForEach-Object { $_.TrimEnd("\") })
    if ($pathEntries -contains $ClaudeTeamInstallWinEnvsDir.TrimEnd("\")) {
        Write-ClaudeTeamInstallLog "SKIP" ("PATH contains {0} (claudeteam, claudeteamup, claudeagents)" -f $ClaudeTeamInstallWinEnvsDir)
        return
    }
    if ($CheckOnly -or ($null -eq (Get-Command "Set-CoreNodePaths" -ErrorAction SilentlyContinue))) {
        Write-ClaudeTeamInstallLog "MISSING" ("PATH entry {0}" -f $ClaudeTeamInstallWinEnvsDir)
        return
    }
    Set-CoreNodePaths
    Write-ClaudeTeamInstallLog "OK" ("PATH ensured for {0}" -f $ClaudeTeamInstallWinEnvsDir)
}

# Parsed JSON object file (the user settings by default): Exists, Text, Settings
# (PSCustomObject or $null), Valid. A locked or unreadable file is Valid false
# with empty Text; a parse failure keeps the Text.
function Read-ClaudeTeamUserSettings {
    param([string]$Path = $ClaudeTeamInstallUserSettingsPath)
    $text = ""
    $settings = $null
    if (-not (Test-Path -LiteralPath $Path -PathType Leaf)) {
        return [pscustomobject]@{ Exists = $false; Text = ""; Settings = $null; Valid = $true }
    }
    try {
        $text = [System.IO.File]::ReadAllText($Path)
        if ([string]::IsNullOrWhiteSpace($text)) {
            return [pscustomobject]@{ Exists = $true; Text = ""; Settings = $null; Valid = $true }
        }
        $settings = $text | ConvertFrom-Json -ErrorAction Stop
    } catch {
        return [pscustomobject]@{ Exists = $true; Text = $text; Settings = $null; Valid = $false }
    }
    if (($null -eq $settings) -or ($settings -isnot [System.Management.Automation.PSCustomObject])) {
        return [pscustomobject]@{ Exists = $true; Text = $text; Settings = $null; Valid = $false }
    }
    return [pscustomobject]@{ Exists = $true; Text = $text; Settings = $settings; Valid = $true }
}

function Test-ClaudeTeamSettingPresent {
    param($Settings, [string]$Key)
    if ($null -eq $Settings) {
        return $false
    }
    return ($null -ne $Settings.PSObject.Properties[$Key])
}

# True only for a JSON true (Linux: `is True`), never a truthy string or number.
function Test-ClaudeTeamSettingTrue {
    param($Settings, [string]$Key)
    $value = $null
    if (($Settings -isnot [System.Management.Automation.PSCustomObject]) -or (-not (Test-ClaudeTeamSettingPresent -Settings $Settings -Key $Key))) {
        return $false
    }
    $value = $Settings.PSObject.Properties[$Key].Value
    return (($value -is [bool]) -and $value)
}

function Get-ClaudeTeamUserSettingsMerge {
    $catalog = $null
    if (-not (Test-Path -LiteralPath $ClaudeTeamInstallCatalogPath -PathType Leaf)) {
        return @()
    }
    $catalog = Get-Content -LiteralPath $ClaudeTeamInstallCatalogPath -Raw -Encoding UTF8 | ConvertFrom-Json
    if ($null -eq $catalog.PSObject.Properties["user_settings_merge"]) {
        return @()
    }
    return @($catalog.user_settings_merge.PSObject.Properties | ForEach-Object { [pscustomobject]@{ Key = $_.Name; Value = $_.Value } })
}

function ConvertTo-ClaudeTeamJsonValue {
    param($Value)
    return (ConvertTo-Json -InputObject $Value -Compress -Depth 20)
}

# The catalog user_settings_merge keys go into the user settings only when a key
# is absent; an existing value is never overwritten. The keys are inserted as
# text after the opening brace, so the rest of the file stays byte-for-byte.
function Install-ClaudeTeamUserSettings {
    param([bool]$CheckOnly)
    $mergeItems = @(Get-ClaudeTeamUserSettingsMerge)
    $current = $null
    $missingItems = @()
    $item = $null
    $wantedJson = ""
    $currentJson = ""
    $entryText = ""
    $openIndex = -1
    $headText = ""
    $tailText = ""
    $newText = ""
    $validated = $null
    $newLine = [Environment]::NewLine

    if ($mergeItems.Count -eq 0) {
        Write-ClaudeTeamInstallLog "SKIP" ("no user_settings_merge keys in {0}" -f $ClaudeTeamInstallCatalogPath)
        return
    }
    $current = Read-ClaudeTeamUserSettings
    if (-not $current.Valid) {
        Write-ClaudeTeamInstallLog "WARN" ("{0} could not be read as a JSON object; user settings not merged" -f $ClaudeTeamInstallUserSettingsPath)
        return
    }
    foreach ($item in $mergeItems) {
        if (-not (Test-ClaudeTeamSettingPresent -Settings $current.Settings -Key $item.Key)) {
            $missingItems += $item
            continue
        }
        $wantedJson = ConvertTo-ClaudeTeamJsonValue -Value $item.Value
        $currentJson = ConvertTo-ClaudeTeamJsonValue -Value $current.Settings.PSObject.Properties[$item.Key].Value
        if ($currentJson -ceq $wantedJson) {
            Write-ClaudeTeamInstallLog "SKIP" ("user setting {0}={1} present" -f $item.Key, $wantedJson)
        } else {
            Write-ClaudeTeamInstallLog "WARN" ("user setting {0}={1} kept (never overwritten); the team expects {2}" -f $item.Key, $currentJson, $wantedJson)
        }
    }
    if ($missingItems.Count -eq 0) {
        return
    }
    if ($CheckOnly) {
        foreach ($item in $missingItems) {
            Write-ClaudeTeamInstallLog "MISSING" ("user setting {0}={1} in {2}" -f $item.Key, (ConvertTo-ClaudeTeamJsonValue -Value $item.Value), $ClaudeTeamInstallUserSettingsPath)
        }
        return
    }
    $entryText = (@($missingItems | ForEach-Object { '{0}"{1}": {2}' -f $ClaudeTeamInstallJsonIndent, $_.Key, (ConvertTo-ClaudeTeamJsonValue -Value $_.Value) })) -join (",{0}" -f $newLine)
    $openIndex = $current.Text.IndexOf("{")
    if (($null -eq $current.Settings) -or ($openIndex -lt 0)) {
        $newText = "{{{0}{1}{0}}}{0}" -f $newLine, $entryText
    } else {
        $headText = $current.Text.Substring(0, $openIndex + 1)
        $tailText = $current.Text.Substring($openIndex + 1)
        if ($tailText.TrimStart().StartsWith("}")) {
            $newText = "{0}{1}{2}{1}{3}" -f $headText, $newLine, $entryText, $tailText.TrimStart()
        } else {
            $newText = "{0}{1}{2},{3}" -f $headText, $newLine, $entryText, $tailText
        }
    }
    try {
        $validated = $newText | ConvertFrom-Json -ErrorAction Stop
    } catch {
        Write-ClaudeTeamInstallLog "WARN" ("merged user settings would not be valid JSON; {0} left unchanged" -f $ClaudeTeamInstallUserSettingsPath)
        return
    }
    if (-not (Test-Path -LiteralPath $ClaudeTeamInstallUserClaudeDir)) {
        New-Item -ItemType Directory -Path $ClaudeTeamInstallUserClaudeDir -Force | Out-Null
    }
    [System.IO.File]::WriteAllText($ClaudeTeamInstallUserSettingsPath, $newText, $ClaudeTeamInstallUtf8NoBom)
    foreach ($item in $missingItems) {
        if (Test-ClaudeTeamSettingPresent -Settings $validated -Key $item.Key) {
            Write-ClaudeTeamInstallLog "OK" ("user setting {0}={1} added to {2}" -f $item.Key, (ConvertTo-ClaudeTeamJsonValue -Value $item.Value), $ClaudeTeamInstallUserSettingsPath)
        }
    }
}

# Report-only mirror of cci_check_remote_control_env (Linux): variables and user
# settings that disable Remote Control, so cross-machine SendMessage cannot work.
function Test-ClaudeTeamRemoteControlEnvironment {
    $blocked = $false
    $name = $null
    $value = $null
    $baseUrl = [Environment]::GetEnvironmentVariable("ANTHROPIC_BASE_URL", "Process")
    $current = Read-ClaudeTeamUserSettings
    $property = $null

    foreach ($name in $ClaudeTeamInstallRemoteControlEnvBlockers) {
        $value = [Environment]::GetEnvironmentVariable($name, "Process")
        if (-not [string]::IsNullOrWhiteSpace($value)) {
            Write-ClaudeTeamInstallLog "WARN" ("{0} is set in this environment: Remote Control (cross-machine messaging) is unavailable" -f $name)
            $blocked = $true
        }
    }
    if ((-not [string]::IsNullOrWhiteSpace($baseUrl)) -and ($baseUrl.TrimEnd("/") -ne $ClaudeTeamInstallOfficialBaseUrl)) {
        Write-ClaudeTeamInstallLog "WARN" "ANTHROPIC_BASE_URL points away from api.anthropic.com: Remote Control is unavailable"
        $blocked = $true
    }
    if ($null -ne $current.Settings) {
        foreach ($name in $ClaudeTeamInstallRemoteControlSettingBlockers) {
            $property = $current.Settings.PSObject.Properties[$name]
            if (($null -ne $property) -and ($property.Value -eq $true)) {
                Write-ClaudeTeamInstallLog "WARN" ("user setting {0}=true in {1} blocks cross-machine role messaging; remove it" -f $name, $ClaudeTeamInstallUserSettingsPath)
                $blocked = $true
            }
        }
    }
    if (-not $blocked) {
        Write-ClaudeTeamInstallLog "SKIP" "no variable or user setting blocks Remote Control"
    }
}

# Fallback reader of a .claude.json that ConvertFrom-Json rejects, such as project
# keys that differ only in case (C:/a and c:/a). It uses a case-sensitive parser
# (ConvertFrom-Json -AsHashtable where the cmdlet has it, otherwise the .NET
# JavaScriptSerializer) and returns only the fields Test-ClaudeTeamAccount reads:
# oauthAccount presence, hasCompletedOnboarding and the trusted project keys.
# $null when the text is not a JSON object for either parser.
function ConvertFrom-ClaudeTeamAccountConfigText {
    param([string]$Text)
    $data = $null
    $serializer = $null
    $projects = $null
    $projectKey = $null
    $projectValue = $null
    $trustedProjects = [pscustomobject]@{}
    $config = [pscustomobject]@{}

    try {
        if ((Get-Command "ConvertFrom-Json").Parameters.ContainsKey("AsHashtable")) {
            $data = ConvertFrom-Json -InputObject $Text -AsHashtable -ErrorAction Stop
        } else {
            Add-Type -AssemblyName "System.Web.Extensions" -ErrorAction Stop
            $serializer = New-Object System.Web.Script.Serialization.JavaScriptSerializer
            $serializer.MaxJsonLength = [int]::MaxValue
            $data = $serializer.DeserializeObject($Text)
        }
    } catch {
        return $null
    }
    if ($data -isnot [System.Collections.IDictionary]) {
        return $null
    }
    if ($data.ContainsKey("oauthAccount")) {
        $config | Add-Member -NotePropertyName "oauthAccount" -NotePropertyValue $true
    }
    if ($data.ContainsKey("hasCompletedOnboarding")) {
        $config | Add-Member -NotePropertyName "hasCompletedOnboarding" -NotePropertyValue $data["hasCompletedOnboarding"]
    }
    if ($data.ContainsKey("projects")) {
        $projects = $data["projects"]
    }
    if ($projects -is [System.Collections.IDictionary]) {
        foreach ($projectKey in @($projects.Keys)) {
            $projectValue = $projects[$projectKey]
            if ((-not [string]::IsNullOrWhiteSpace($projectKey)) -and ($projectValue -is [System.Collections.IDictionary]) -and $projectValue.ContainsKey("hasTrustDialogAccepted") -and ($projectValue["hasTrustDialogAccepted"] -is [bool]) -and $projectValue["hasTrustDialogAccepted"] -and ($null -eq $trustedProjects.PSObject.Properties[$projectKey])) {
                $trustedProjects | Add-Member -NotePropertyName $projectKey -NotePropertyValue ([pscustomobject]@{ hasTrustDialogAccepted = $true })
            }
        }
        $config | Add-Member -NotePropertyName "projects" -NotePropertyValue $trustedProjects
    }
    return $config
}

# Report-only mirror of cci_report_claude_account (Linux): whether a new claude
# session of this user would reach its prompt (sign-in, first-run setup, workspace
# trust of the repo or a parent). claude itself is not run and nothing is written:
# the state is read from its files into $script:ClaudeTeamAccountState. Project
# keys are matched with '/' separators and without case (claude uses C:/... keys).
function Test-ClaudeTeamAccount {
    $user = "{0}\{1}" -f $env:USERDOMAIN, $env:USERNAME
    $name = $null
    $signedIn = $false
    $current = $null
    $config = $null
    $projects = $null
    $property = $null
    $trustedKeys = @{}
    $path = $ClaudeTeamInstallRootDir
    $trusted = $false

    if ($null -eq (Get-Command "claude" -ErrorAction SilentlyContinue)) {
        $script:ClaudeTeamAccountState = "missing"
        Write-ClaudeTeamInstallLog "SKIP" "claude not installed yet; Claude account not checked"
        return
    }
    foreach ($name in $ClaudeTeamInstallEnvCredentialNames) {
        if (-not [string]::IsNullOrWhiteSpace([Environment]::GetEnvironmentVariable($name, "Process"))) {
            $signedIn = $true
        }
    }
    $current = Read-ClaudeTeamUserSettings -Path $ClaudeTeamInstallGlobalConfigPath
    Write-ClaudeTeamInstallLog "OK" ("Claude account: {0}, USERPROFILE={1}, config {2}, credentials dir {3}" -f $user, $env:USERPROFILE, $ClaudeTeamInstallGlobalConfigPath, $ClaudeTeamInstallUserClaudeDir)
    $config = $current.Settings
    if ((-not $current.Valid) -and (-not [string]::IsNullOrEmpty($current.Text))) {
        $config = ConvertFrom-ClaudeTeamAccountConfigText -Text $current.Text
    }
    if ((-not $current.Valid) -and ($null -eq $config)) {
        $script:ClaudeTeamAccountState = "missing"
        Write-ClaudeTeamInstallLog "WARN" ("{0} could not be read as a JSON object (locked, mid-rewrite or invalid); Claude account not checked" -f $ClaudeTeamInstallGlobalConfigPath)
        return
    }
    if ((Test-Path -LiteralPath $ClaudeTeamInstallCredentialsPath -PathType Leaf) -or (Test-ClaudeTeamSettingPresent -Settings $config -Key "oauthAccount")) {
        $signedIn = $true
    }
    if (Test-ClaudeTeamSettingPresent -Settings $config -Key "projects") {
        $projects = $config.PSObject.Properties["projects"].Value
    }
    if ($projects -is [System.Management.Automation.PSCustomObject]) {
        foreach ($property in $projects.PSObject.Properties) {
            if (Test-ClaudeTeamSettingTrue -Settings $property.Value -Key "hasTrustDialogAccepted") {
                $trustedKeys[$property.Name.Replace("\", "/").TrimEnd("/")] = $true
            }
        }
    }
    while ((-not $trusted) -and (-not [string]::IsNullOrEmpty($path))) {
        $trusted = $trustedKeys.ContainsKey($path.Replace("\", "/").TrimEnd("/"))
        $path = Split-Path $path -Parent
    }
    if (-not $signedIn) {
        $script:ClaudeTeamAccountState = "login"
        Write-ClaudeTeamInstallLog "MISSING" ("Claude sign-in for {0}: run 'claude' once in {1} as {0} and sign in" -f $user, $ClaudeTeamInstallRootDir)
    } elseif (-not (Test-ClaudeTeamSettingTrue -Settings $config -Key "hasCompletedOnboarding")) {
        $script:ClaudeTeamAccountState = "onboarding"
        Write-ClaudeTeamInstallLog "MISSING" ("Claude first-run setup in {0}: run 'claude' once as {1} and finish the setup screens (sessions read it only at startup)" -f $ClaudeTeamInstallGlobalConfigPath, $user)
    } elseif (-not $trusted) {
        $script:ClaudeTeamAccountState = "trust"
        Write-ClaudeTeamInstallLog "MISSING" ("Workspace trust for {0}: run 'claude' there once as {1} and accept the trust prompt" -f $ClaudeTeamInstallRootDir, $user)
    } else {
        $script:ClaudeTeamAccountState = "ready"
        Write-ClaudeTeamInstallLog "SKIP" ("Claude account signed in, first-run setup done, {0} trusted" -f $ClaudeTeamInstallRootDir)
    }
}

function Invoke-ClaudeTeamInstall {
    param([switch]$CheckOnly)
    $item = $null
    foreach ($item in $ClaudeTeamInstallBinaries) {
        Install-ClaudeTeamBinary -Item $item -CheckOnly ([bool]$CheckOnly)
    }
    Test-ClaudeTeamWindowsTerminalVersion
    Install-ClaudeTeamDirectory -Path $ClaudeTeamInstallStateDir -Purpose "role PID files" -CheckOnly ([bool]$CheckOnly)
    Install-ClaudeTeamDirectory -Path $ClaudeTeamInstallSharedDir -Purpose "shared data between roles" -CheckOnly ([bool]$CheckOnly)
    Install-ClaudeTeamDirectory -Path $ClaudeTeamInstallAgentMemoryDir -Purpose "per-role agent memory (memory: project)" -CheckOnly ([bool]$CheckOnly)
    Install-ClaudeTeamPathEntry -CheckOnly ([bool]$CheckOnly)
    Install-ClaudeTeamUserSettings -CheckOnly ([bool]$CheckOnly)
    Test-ClaudeTeamRemoteControlEnvironment
    Test-ClaudeTeamAccount
}
