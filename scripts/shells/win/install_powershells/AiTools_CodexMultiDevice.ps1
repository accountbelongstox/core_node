param(
    [string]$Region = '',
    [string]$Python = ''
)

# Installs and configures the local side of the Codex multi-device same-task collaboration stack
# (official: https://developers.openai.com/codex/remote-connections): local Codex CLI, SSH key and
# ~/.ssh/config aliases for the ssh{index} hosts. Remote hosts are never contacted: each one installs
# Codex independently on the host itself.
# Idempotent: safe to re-run; missing pieces are installed, existing pieces are kept.

$winShellsDir = Split-Path $PSScriptRoot -Parent
$shellsDir = Split-Path $winShellsDir -Parent
$scriptsDirPath = Split-Path $shellsDir -Parent
$projectRootPath = Split-Path $scriptsDirPath -Parent
$winCommonDir = Join-Path $winShellsDir 'win_common'
$globalVarsPath = Join-Path $winCommonDir 'GlobalVars.ps1'
$windowsPathFunctionPath = Join-Path $winCommonDir 'WindowsPathFunction.ps1'
$aiCliProvisionPath = Join-Path $winCommonDir 'AiCliProvisionCommon.ps1'
$secretManagerPath = Join-Path $winCommonDir 'SecretManager.ps1'
$COMPONENT_ID = 'AiTools_CodexMultiDevice'
$scriptIndex = "[$COMPONENT_ID]"
$winenvsDirPath = Join-Path $scriptsDirPath 'winenvs'
$linuxenvsDirPath = Join-Path $scriptsDirPath 'linuxenvs'
$sshWinScriptFilter = 'ssh*.ps1'
$sshWinScriptNamePattern = '^ssh(\d+)$'
$sshSecretKeyPrefix = 'SSH_CONNECTION_'
$sshPasswordKeyPrefix = 'SSH_PASSWORD_'
$sshDir = Join-Path $env:USERPROFILE '.ssh'
$sshKeyPath = Join-Path $sshDir 'id_ed25519'
$sshConfigPath = Join-Path $sshDir 'config'
$sshConfigBlockStart = '# >>> core_node codex multi-device hosts (managed by Step63) >>>'
$sshConfigBlockEnd = '# <<< core_node codex multi-device hosts (managed by Step63) <<<'
$sshHostAliasPrefix = 'corenode-ssh'
$sshConnectionPattern = '^(?:(?<user>[^@]+)@)?(?<host>[^:\s]+)(?::(?<port>\d+))?$'
$sshConfigManagedMarker = 'Special Software Environment Manager'
$sshConfigManagedMarkersPs1 = @($sshConfigManagedMarker, 'Get-SSHSecret', 'WindowsPathFunction.ps1')
$sshConfigManagedMarkersSh = @($sshConfigManagedMarker, 'get_secret_value')
$envManagerLauncherHint = 'dd menu -> Set Special Software Environment Variables (like AI)  (scripts/shells/win/menu_itemshells/SpecialSoftwareEnvManager.ps1)'
$globalVarMapKey = 'CODEX_REMOTE_HOST_MAP'
$officialRemoteDocsUrl = 'https://developers.openai.com/codex/remote-connections'
$officialCliDocsUrl = 'https://developers.openai.com/codex/cli/reference'
$sshScriptFiles = @()
$sshScriptCandidates = @()
$sshCandidateEntry = $null
$sshWinConformantCount = 0
$sshHostEntries = @()
$hostMapEntries = @()
$hostEntry = $null
$entry = $null
$fileIndex = $null
$sshConfigContent = $null
$sshConfigManagedBlock = $null
$hostMapJson = $null
$utf8NoBomEncoding = New-Object System.Text.UTF8Encoding $false
$sshClientCommand = $null
$sshExePath = $null
$gitClientCommand = $null
$secretPasswordValue = $null
$connectionMatch = $null
$sshConnectionUser = ''
$sshConnectionHost = ''
$sshConnectionPort = ''
$hostAlias = $null
$linuxScriptPath = $null
$linuxScriptExists = $false
$winScriptConformant = $false
$linuxScriptConformant = $false
$conformanceFailures = 0
$scriptFile = $null
$scriptContent = $null
$markerMissing = $false
$marker = $null
$authExitCode = $null
$configBlockLines = @()
$secretResult = $null
$connectionValue = $null
$codexCommand = $null

. $globalVarsPath
. $windowsPathFunctionPath -SkipInit
. $secretManagerPath
. $aiCliProvisionPath
Set-StrictMode -Off
$ErrorActionPreference = 'Continue'


function Get-SSHSecretValue {
    param([Parameter(Mandatory = $true)][string]$KeyName)

    $secretResult = $null
    try {
        $secretResult = Get-SecretKey -KeyName $KeyName
    } catch {
        Write-Host "$scriptIndex Secret '$KeyName' is unavailable: $($_.Exception.Message)" -ForegroundColor Yellow
        $secretResult = $null
    }
    return $secretResult
}

function Test-ScriptConformance {
    param(
        [Parameter(Mandatory = $true)][string]$ScriptPath,
        [Parameter(Mandatory = $true)][int]$FileIndex,
        [Parameter(Mandatory = $true)][string[]]$Markers
    )

    $script:markerMissing = $false
    $script:scriptContent = Get-Content -LiteralPath $ScriptPath -Raw -ErrorAction SilentlyContinue
    if (-not $script:scriptContent) {
        return $false
    }
    foreach ($script:marker in $Markers) {
        if ($script:scriptContent -notlike "*$script:marker*") {
            Write-Host "$scriptIndex ssh$FileIndex script is missing standard marker '$script:marker': $ScriptPath" -ForegroundColor Yellow
            $script:markerMissing = $true
        }
    }
    return (-not $script:markerMissing)
}

function Write-SSHConfigManagedBlock {
    param([Parameter(Mandatory = $true)][string[]]$BlockLines)

    if (-not (Test-Path -LiteralPath $sshDir -PathType Container)) {
        New-Item -ItemType Directory -Path $sshDir -Force | Out-Null
    }
    $script:sshConfigContent = ''
    if (Test-Path -LiteralPath $sshConfigPath -PathType Leaf) {
        $script:sshConfigContent = Get-Content -LiteralPath $sshConfigPath -Raw -ErrorAction SilentlyContinue
    }
    if ($null -eq $script:sshConfigContent) {
        $script:sshConfigContent = ''
    }
    $blockPattern = '(?s)\r?\n?' + [regex]::Escape($sshConfigBlockStart) + '.*?' + [regex]::Escape($sshConfigBlockEnd) + '\r?\n?'
    $script:sshConfigContent = [regex]::Replace($script:sshConfigContent, $blockPattern, '').TrimEnd()
    $script:sshConfigManagedBlock = ($BlockLines -join "`r`n")
    if ($script:sshConfigContent.Length -gt 0) {
        $script:sshConfigContent = $script:sshConfigContent + "`r`n`r`n" + $script:sshConfigManagedBlock + "`r`n"
    } else {
        $script:sshConfigContent = $script:sshConfigManagedBlock + "`r`n"
    }
    [System.IO.File]::WriteAllText($sshConfigPath, $script:sshConfigContent, $utf8NoBomEncoding)
    Write-Host "$scriptIndex Managed Codex host aliases written to $sshConfigPath" -ForegroundColor Green
}

Write-Host "$scriptIndex Installing Codex multi-device same-task collaboration stack..." -ForegroundColor Cyan

# ---------------------------------------------------------------------------
# 1. Prerequisite suites (idempotent repairs)
# ---------------------------------------------------------------------------
$sshClientCommand = Get-Command ssh.exe -ErrorAction SilentlyContinue
if ($sshClientCommand) {
    Write-Host "$scriptIndex OpenSSH client is already available: $($sshClientCommand.Source)" -ForegroundColor Green
} else {
    Write-Host "$scriptIndex OpenSSH client is missing; run Git_SshKeys first." -ForegroundColor Yellow
}
$sshExePath = if ($sshClientCommand) { $sshClientCommand.Source } else { 'ssh.exe' }

$gitClientCommand = Get-Command git -ErrorAction SilentlyContinue
if ($gitClientCommand) {
    Write-Host "$scriptIndex Git is already available (required for chat handoff worktrees)." -ForegroundColor Green
} else {
    Write-Host "$scriptIndex Git is missing; run Git_Install first for chat handoff support." -ForegroundColor Yellow
}

# Official installer only, shared with every Windows entry point (idempotent).
[void](Invoke-AiCliNativeEnsure -Tool "codex")
$script:codexCommand = (Get-Command codex -ErrorAction SilentlyContinue | Select-Object -First 1 -ExpandProperty Source)
if ($codexCommand) {
    Write-Host "$scriptIndex Codex CLI ready: $codexCommand" -ForegroundColor Green
} else {
    Write-Host "$scriptIndex Codex CLI is still missing; installation will retry next run." -ForegroundColor Yellow
}

if ($codexCommand) {
    & $codexCommand login status *> $null
    $script:authExitCode = $LASTEXITCODE
    if ($script:authExitCode -eq 0) {
        Write-Host "$scriptIndex Codex credentials are present on this host." -ForegroundColor Green
    } else {
        Write-Host "$scriptIndex Codex is not authenticated on this host. Run interactively: codex login" -ForegroundColor Yellow
    }
}

# ---------------------------------------------------------------------------
# 2. Discover dynamic ssh{index} scripts (generated by Special Software Env Manager)
# ---------------------------------------------------------------------------
$sshScriptFiles = @(Get-ChildItem -LiteralPath $winenvsDirPath -Filter $sshWinScriptFilter -File -ErrorAction SilentlyContinue)
foreach ($scriptFile in $sshScriptFiles) {
    if ($scriptFile.BaseName -match $sshWinScriptNamePattern) {
        $sshScriptCandidates += ,@([int]$Matches[1], $scriptFile)
    }
}
$sshScriptCandidates = @($sshScriptCandidates | Sort-Object { $_[0] })
if ($sshScriptCandidates.Count -eq 0) {
    Write-Host "$scriptIndex No ssh{index} scripts found in $winenvsDirPath. Create SSH connections via: $envManagerLauncherHint" -ForegroundColor Yellow
} else {
    Write-Host "$scriptIndex Discovered $($sshScriptCandidates.Count) configured remote Linux endpoint script(s)." -ForegroundColor Green
}

foreach ($sshCandidateEntry in $sshScriptCandidates) {
    $fileIndex = $sshCandidateEntry[0]
    $scriptFile = $sshCandidateEntry[1]
    $linuxScriptPath = Join-Path $linuxenvsDirPath "$($scriptFile.BaseName).sh"
    $script:linuxScriptExists = Test-Path -LiteralPath $linuxScriptPath -PathType Leaf

    $script:winScriptConformant = Test-ScriptConformance -ScriptPath $scriptFile.FullName -FileIndex $fileIndex -Markers $sshConfigManagedMarkersPs1
    if ($script:winScriptConformant) { $sshWinConformantCount++ }
    $script:linuxScriptConformant = $true
    if ($script:linuxScriptExists) {
        $script:linuxScriptConformant = Test-ScriptConformance -ScriptPath $linuxScriptPath -FileIndex $fileIndex -Markers $sshConfigManagedMarkersSh
    }
    if (-not ($script:winScriptConformant -and $script:linuxScriptConformant)) {
        $conformanceFailures++
        Write-Host "$scriptIndex ssh$($fileIndex) does not match the generator standard; regenerate via: $envManagerLauncherHint" -ForegroundColor Yellow
        continue
    }

    $script:connectionValue = Get-SSHSecretValue -KeyName "$sshSecretKeyPrefix$fileIndex"
    if ([string]::IsNullOrWhiteSpace($script:connectionValue)) {
        Write-Host "$scriptIndex ssh$($fileIndex): secret $sshSecretKeyPrefix$fileIndex is empty; skipping this host." -ForegroundColor Yellow
        continue
    }
    $script:secretPasswordValue = Get-SSHSecretValue -KeyName "$sshPasswordKeyPrefix$fileIndex"

    $script:connectionMatch = [regex]::Match($script:connectionValue, $sshConnectionPattern)
    if (-not $script:connectionMatch.Success) {
        Write-Host "$scriptIndex ssh$($fileIndex): cannot parse connection '$($script:connectionValue -replace '^(.+@)?.+$', '<redacted>')'; expected user@host[:port]." -ForegroundColor Yellow
        continue
    }
    $script:sshConnectionUser = $script:connectionMatch.Groups['user'].Value
    $script:sshConnectionHost = $script:connectionMatch.Groups['host'].Value
    $script:sshConnectionPort = $script:connectionMatch.Groups['port'].Value
    $hostAlias = "$sshHostAliasPrefix$fileIndex"

    $script:hostEntry = [ordered]@{
        Index = $fileIndex
        Alias = $hostAlias
        Connection = $script:connectionValue
        ConnectionUser = $script:sshConnectionUser
        ConnectionHost = $script:sshConnectionHost
        ConnectionPort = $script:sshConnectionPort
        WindowsScript = $scriptFile.FullName
        LinuxScript = $linuxScriptPath
        HasPasswordSecret = [bool]$script:secretPasswordValue
        Status = ''
    }
    $sshHostEntries += $script:hostEntry
}

# ---------------------------------------------------------------------------
# 3. Local SSH key + managed ~/.ssh/config aliases (Codex auto-discovers them)
# ---------------------------------------------------------------------------
if (-not (Test-Path -LiteralPath $sshKeyPath -PathType Leaf)) {
    if (-not (Test-Path -LiteralPath $sshDir -PathType Container)) {
        New-Item -ItemType Directory -Path $sshDir -Force | Out-Null
    }
    Write-Host "$scriptIndex Generating local SSH key: $sshKeyPath" -ForegroundColor Cyan
    & ssh-keygen -t ed25519 -f $sshKeyPath -N '""' | Out-Null
} else {
    Write-Host "$scriptIndex SSH key already exists: $sshKeyPath" -ForegroundColor Green
}

$configBlockLines = @($sshConfigBlockStart)
foreach ($hostEntry in $sshHostEntries) {
    $entry = $hostEntry
    $configBlockLines += "# $sshHostAliasPrefix$($entry.Index) (from $sshSecretKeyPrefix$($entry.Index) / $($entry.WindowsScript))"
    $configBlockLines += "Host $($entry.Alias)"
    $configBlockLines += "    HostName $($entry.ConnectionHost)"
    if ($entry.ConnectionUser) {
        $configBlockLines += "    User $($entry.ConnectionUser)"
    }
    if ($entry.ConnectionPort) {
        $configBlockLines += "    Port $($entry.ConnectionPort)"
    }
    $configBlockLines += "    IdentityFile $sshKeyPath"
    $configBlockLines += "    StrictHostKeyChecking accept-new"
    $configBlockLines += "    ServerAliveInterval 60"
}
$configBlockLines += $sshConfigBlockEnd
if ($sshHostEntries.Count -gt 0) {
    Write-SSHConfigManagedBlock -BlockLines $configBlockLines
}

# ---------------------------------------------------------------------------
# 4. Association map (local only: remote hosts are not contacted or configured)
# ---------------------------------------------------------------------------
foreach ($hostEntry in $sshHostEntries) {
    $hostEntry.Status = 'SSH alias configured locally'
    $hostMapEntries += $hostEntry
}

if ($hostMapEntries.Count -gt 0) {
    $script:hostMapJson = ConvertTo-Json -InputObject @($hostMapEntries) -Compress -Depth 4
    Set-GlobalVar -key $globalVarMapKey -value $script:hostMapJson
    Write-Host ""
    Write-Host "$scriptIndex Codex remote host map saved to global var '$globalVarMapKey':" -ForegroundColor Green
    foreach ($entry in $hostMapEntries) {
        Write-Host "  $($entry.Alias)  <-  ssh$($entry.Index).ps1 / ssh$($entry.Index).sh  [$($entry.ConnectionHost)]  $($entry.Status)" -ForegroundColor White
    }
}

# ---------------------------------------------------------------------------
# 5. Usage summary (official multi-device same-task workflow)
# ---------------------------------------------------------------------------
Write-Host ""
Write-Host "$scriptIndex Codex multi-device same-task collaboration summary:" -ForegroundColor Cyan
Write-Host "  - Local Codex CLI : $(if ($codexCommand) { $codexCommand } else { 'not installed yet (retry next run)' })" -ForegroundColor White
Write-Host "  - SSH aliases     : $(if ($sshHostEntries.Count -gt 0) { ($sshHostEntries | ForEach-Object { $_.Alias }) -join ', ' } else { 'none discovered' })" -ForegroundColor White
Write-Host "  - ssh scripts     : $sshWinConformantCount/$($sshScriptCandidates.Count) conform to the generator standard (failures: $conformanceFailures)" -ForegroundColor White
Write-Host "  - Same task across devices (official):" -ForegroundColor White
Write-Host "      1. ChatGPT desktop app -> Settings > Connections auto-discovers the aliases above as SSH hosts." -ForegroundColor DarkGray
Write-Host "      2. Phone -> ChatGPT app 'Remote' to start/steer/approve tasks on this host or SSH hosts." -ForegroundColor DarkGray
Write-Host "      3. Remote CLI daemon: codex remote-control start ; codex remote-control pair" -ForegroundColor DarkGray
Write-Host "      4. Cross-machine attach: remote 'codex app-server --listen ws://0.0.0.0:8787' then local 'codex --remote ws://<remote-ip>:8787'" -ForegroundColor DarkGray
Write-Host "      5. Diagnostics: codex doctor" -ForegroundColor DarkGray
Write-Host "  - Docs: $officialRemoteDocsUrl | $officialCliDocsUrl" -ForegroundColor White
if ($conformanceFailures -gt 0) {
    Write-Host "$scriptIndex Regenerate non-conforming ssh scripts via: $envManagerLauncherHint" -ForegroundColor Yellow
}
Write-Host "$scriptIndex Codex multi-device installation step completed." -ForegroundColor Green
