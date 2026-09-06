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

param(
    [string]$Region = '',
    [string]$Python = ''
)

# Installs and configures the Codex multi-device same-task collaboration stack
# (official: https://developers.openai.com/codex/remote-connections).
# Idempotent: safe to re-run; missing pieces are installed, existing pieces are kept.

$winShellsDir = Split-Path $PSScriptRoot -Parent
$shellsDir = Split-Path $winShellsDir -Parent
$scriptsDirPath = Split-Path $shellsDir -Parent
$projectRootPath = Split-Path $scriptsDirPath -Parent
$winCommonDir = Join-Path $winShellsDir 'win_common'
$globalVarsPath = Join-Path $winCommonDir 'GlobalVars.ps1'
$windowsPathFunctionPath = Join-Path $winCommonDir 'WindowsPathFunction.ps1'
$secretManagerPath = Join-Path $winCommonDir 'SecretManager.ps1'
$stepNumber = 63
$scriptIndex = "[Step $stepNumber]"
$codexNpmPackage = '@openai/codex'
$codexNodeMajorMin = 22
$winenvsDirPath = Join-Path $scriptsDirPath 'winenvs'
$linuxenvsDirPath = Join-Path $scriptsDirPath 'linuxenvs'
$sshWinScriptFilter = 'ssh*.ps1'
$sshWinScriptNamePattern = '^ssh(\d+)$'
$sshSecretKeyPrefix = 'SSH_CONNECTION_'
$sshPasswordKeyPrefix = 'SSH_PASSWORD_'
$sshDir = Join-Path $env:USERPROFILE '.ssh'
$sshKeyPath = Join-Path $sshDir 'id_ed25519'
$sshPubKeyPath = "$sshKeyPath.pub"
$sshConfigPath = Join-Path $sshDir 'config'
$sshConfigBlockStart = '# >>> core_node codex multi-device hosts (managed by Step63) >>>'
$sshConfigBlockEnd = '# <<< core_node codex multi-device hosts (managed by Step63) <<<'
$sshHostAliasPrefix = 'corenode-ssh'
$sshConnectTimeoutSeconds = 8
$sshProbeToken = 'corenode-codex-remote-probe-ok'
$sshConnectionPattern = '^(?:(?<user>[^@]+)@)?(?<host>[^:\s]+)(?::(?<port>\d+))?$'
$sshConfigManagedMarker = 'Special Software Environment Manager'
$sshConfigManagedMarkersPs1 = @($sshConfigManagedMarker, 'Get-SSHSecret', 'WindowsPathFunction.ps1')
$sshConfigManagedMarkersSh = @($sshConfigManagedMarker, 'get_secret_value')
$envManagerLauncherHint = 'dd menu -> Set Special Software Environment Variables (like AI)  (scripts/shells/win/menu_itemshells/SpecialSoftwareEnvManager.ps1)'
$globalVarMapKey = 'CODEX_REMOTE_HOST_MAP'
$officialRemoteDocsUrl = 'https://developers.openai.com/codex/remote-connections'
$officialCliDocsUrl = 'https://developers.openai.com/codex/cli/reference'
$remoteSetupScriptTemplate = @'
set -e
have() { command -v "$1" >/dev/null 2>&1; }
run_root() { if [ "$(id -u)" = "0" ]; then "$@"; elif have sudo && sudo -n true 2>/dev/null; then sudo -n "$@"; else "$@"; fi; }

NODE_MAJOR=0
if have node; then NODE_MAJOR=$(node -v 2>/dev/null | sed 's/^v//' | cut -d. -f1); fi
if ! have node || [ "$NODE_MAJOR" -lt "__NODE_MAJOR_MIN__" ]; then
    echo "[INFO] Installing Node.js __NODE_MAJOR_MIN__.x (Codex CLI requirement)..."
    if have apt-get; then
        export DEBIAN_FRONTEND=noninteractive
        run_root apt-get update -y || true
        run_root apt-get install -y curl ca-certificates gnupg || true
        curl -fsSL https://deb.nodesource.com/setup___NODE_MAJOR_MIN__.x | run_root bash -
        run_root apt-get install -y nodejs
    elif have dnf; then
        curl -fsSL https://rpm.nodesource.com/setup___NODE_MAJOR_MIN__.x | run_root bash -
        run_root dnf install -y nodejs
    elif have yum; then
        curl -fsSL https://rpm.nodesource.com/setup___NODE_MAJOR_MIN__.x | run_root bash -
        run_root yum install -y nodejs
    else
        echo "[ERROR] No supported package manager found for Node.js __NODE_MAJOR_MIN__.x installation."
        exit 3
    fi
fi

if ! have npm; then
    echo "[ERROR] npm is still missing after Node.js setup; setup will retry next run."
    exit 3
fi

if ! have codex; then
    echo "[INFO] Installing Codex CLI via npm global..."
    run_root npm install -g __CODEX_PACKAGE__
fi

if have codex; then
    echo "[SUCCESS] Codex CLI ready on remote host: $(codex --version 2>/dev/null || echo 'version check failed')"
    if codex login status >/dev/null 2>&1; then
        echo "[SUCCESS] Codex credentials are present on remote host."
    else
        echo "[INFO] Codex is not authenticated on remote host. Run interactively on the host: codex login"
    fi
else
    echo "[ERROR] Codex CLI is still missing; setup will retry next run."
    exit 4
fi
'@
$sshScriptFiles = @()
$sshWinConformantCount = 0
$sshHostEntries = @()
$hostMapEntries = @()
$hostEntry = $null
$sshConfigContent = $null
$sshConfigManagedBlock = $null
$sshConfigParentDir = $null
$remoteSetupScript = $null
$remoteScriptB64 = $null
$remoteProbeOutput = $null
$remoteSetupOutput = $null
$hostMapJson = $null
$publisherDir = $null
$remoteHostMap = $null
$pipelineOutput = $null
$pnpmExePath = $null
$codexCommand = $null
$resolvedCommand = $null
$commandInfo = $null
$candidatePath = $null
$codexCandidates = @()
$sshClientCommand = $null
$sshExePath = $null
$gitClientCommand = $null
$secretValue = $null
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

. $globalVarsPath
. $windowsPathFunctionPath -SkipInit
. $secretManagerPath
Set-StrictMode -Off
$ErrorActionPreference = 'Continue'

$pnpmExePath = $Global:PNPM_EXE_PATH
$codexCandidates = @(
    (Join-Path $Global:PNPM_GLOBAL_BIN_DIR 'codex.cmd'),
    (Join-Path $Global:NODE_DIR 'codex.cmd'),
    (Join-Path $Global:NODE_DIR 'codex.exe')
)

function Find-InstalledCommand {
    param(
        [Parameter(Mandatory = $true)][string]$Name,
        [string[]]$CandidatePaths = @()
    )

    $script:resolvedCommand = $null
    $script:commandInfo = Get-Command $Name -ErrorAction SilentlyContinue
    if ($script:commandInfo) {
        $script:resolvedCommand = $script:commandInfo.Source
    }
    foreach ($script:candidatePath in $CandidatePaths) {
        if (-not $script:resolvedCommand -and $script:candidatePath -and (Test-Path -LiteralPath $script:candidatePath -PathType Leaf)) {
            $script:resolvedCommand = (Resolve-Path -LiteralPath $script:candidatePath).Path
        }
    }
}

function Get-SSHSecretValue {
    param([Parameter(Mandatory = $true)][string]$KeyName)

    $script:secretValue = $null
    try {
        $script:secretValue = Get-SecretKey -KeyName $KeyName
    } catch {
        Write-Host "$scriptIndex Secret '$KeyName' is unavailable: $($_.Exception.Message)" -ForegroundColor Yellow
        $script:secretValue = $null
    }
    return $script:secretValue
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

function Test-PasswordlessSSH {
    param([Parameter(Mandatory = $true)][string]$Alias)

    $script:remoteProbeOutput = & $sshExePath -o BatchMode=yes -o ConnectTimeout=$sshConnectTimeoutSeconds -o StrictHostKeyChecking=accept-new $Alias "echo $sshProbeToken" 2>&1
    return (($LASTEXITCODE -eq 0) -and ("$script:remoteProbeOutput" -match [regex]::Escape($sshProbeToken)))
}

function Invoke-RemoteCodexSetup {
    param([Parameter(Mandatory = $true)][string]$Alias)

    $script:remoteSetupScript = $remoteSetupScriptTemplate.Replace('__NODE_MAJOR_MIN__', "$codexNodeMajorMin").Replace('__CODEX_PACKAGE__', $codexNpmPackage)
    $script:remoteScriptB64 = [Convert]::ToBase64String([Text.Encoding]::UTF8.GetBytes($script:remoteSetupScript))
    $script:remoteSetupOutput = & $sshExePath -o BatchMode=yes -o ConnectTimeout=$sshConnectTimeoutSeconds -o StrictHostKeyChecking=accept-new $Alias "echo $script:remoteScriptB64 | base64 -d | bash -s" 2>&1
    $script:pipelineOutput = @($script:remoteSetupOutput)
    foreach ($line in $script:pipelineOutput) {
        Write-Host "$scriptIndex [remote] $line" -ForegroundColor DarkGray
    }
    return ($LASTEXITCODE -eq 0)
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
    Set-Content -LiteralPath $sshConfigPath -Value $script:sshConfigContent -Encoding ASCII
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
    Write-Host "$scriptIndex OpenSSH client is missing; run Step5_InstallGitSSH first." -ForegroundColor Yellow
}
$sshExePath = if ($sshClientCommand) { $sshClientCommand.Source } else { 'ssh.exe' }

$gitClientCommand = Get-Command git -ErrorAction SilentlyContinue
if ($gitClientCommand) {
    Write-Host "$scriptIndex Git is already available (required for chat handoff worktrees)." -ForegroundColor Green
} else {
    Write-Host "$scriptIndex Git is missing; run Step6_InstallGit first for chat handoff support." -ForegroundColor Yellow
}

Find-InstalledCommand -Name 'codex' -CandidatePaths $codexCandidates
$script:codexCommand = $resolvedCommand
if ($codexCommand) {
    Add-Path -newPath $Global:PNPM_GLOBAL_BIN_DIR
    Write-Host "$scriptIndex Codex CLI is already installed: $codexCommand" -ForegroundColor Green
} elseif (-not (Test-Path -LiteralPath $pnpmExePath -PathType Leaf)) {
    Write-Host "$scriptIndex pnpm is unavailable. Run Step4_InstallNodeJS first." -ForegroundColor Yellow
} else {
    Write-Host "$scriptIndex Installing Codex CLI ($codexNpmPackage) with pnpm from the official package..." -ForegroundColor Cyan
    & $pnpmExePath add --global $codexNpmPackage
    Find-InstalledCommand -Name 'codex' -CandidatePaths $codexCandidates
    $script:codexCommand = $resolvedCommand
    if ($codexCommand) {
        Add-Path -newPath $Global:PNPM_GLOBAL_BIN_DIR
        Write-Host "$scriptIndex Codex CLI installed: $codexCommand" -ForegroundColor Green
    } else {
        Write-Host "$scriptIndex Codex CLI is still missing; installation will retry next run." -ForegroundColor Yellow
    }
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
$sshScriptFiles = @(Get-ChildItem -LiteralPath $winenvsDirPath -Filter $sshWinScriptFilter -File -ErrorAction SilentlyContinue | Where-Object { $_.BaseName -match $sshWinScriptNamePattern } | Sort-Object { [int]$Matches[1] })
if ($sshScriptFiles.Count -eq 0) {
    Write-Host "$scriptIndex No ssh{index} scripts found in $winenvsDirPath. Create SSH connections via: $envManagerLauncherHint" -ForegroundColor Yellow
} else {
    Write-Host "$scriptIndex Discovered $($sshScriptFiles.Count) configured remote Linux endpoint script(s)." -ForegroundColor Green
}

foreach ($scriptFile in $sshScriptFiles) {
    if ($scriptFile.BaseName -notmatch $sshWinScriptNamePattern) { continue }
    $fileIndex = [int]$Matches[1]
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

    $script:secretValue = Get-SSHSecretValue -KeyName "$sshSecretKeyPrefix$fileIndex"
    if ([string]::IsNullOrWhiteSpace($script:secretValue)) {
        Write-Host "$scriptIndex ssh$($fileIndex): secret $sshSecretKeyPrefix$fileIndex is empty; skipping this host." -ForegroundColor Yellow
        continue
    }
    $script:secretPasswordValue = Get-SSHSecretValue -KeyName "$sshPasswordKeyPrefix$fileIndex"

    $script:connectionMatch = [regex]::Match($script:secretValue, $sshConnectionPattern)
    if (-not $script:connectionMatch.Success) {
        Write-Host "$scriptIndex ssh$($fileIndex): cannot parse connection '$($script:secretValue -replace '^(.+@)?.+$', '<redacted>')'; expected user@host[:port]." -ForegroundColor Yellow
        continue
    }
    $script:sshConnectionUser = $script:connectionMatch.Groups['user'].Value
    $script:sshConnectionHost = $script:connectionMatch.Groups['host'].Value
    $script:sshConnectionPort = $script:connectionMatch.Groups['port'].Value
    $hostAlias = "$sshHostAliasPrefix$fileIndex"

    $script:hostEntry = [ordered]@{
        Index = $fileIndex
        Alias = $hostAlias
        Connection = $script:secretValue
        WindowsScript = $scriptFile.FullName
        LinuxScript = $linuxScriptPath
        HasPasswordSecret = [bool]$script:secretPasswordValue
    }
    $sshHostEntries += ,@($script:hostEntry)
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
    $entry = $hostEntry[0]
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
# 4. Per-host idempotent remote setup (Node.js + Codex CLI) and association map
# ---------------------------------------------------------------------------
foreach ($hostEntry in $sshHostEntries) {
    $entry = $hostEntry[0]
    Write-Host ""
    Write-Host "$scriptIndex Configuring remote host $($entry.Alias) ($($entry.ConnectionHost))..." -ForegroundColor Cyan

    if (-not $sshClientCommand) {
        $entry.Status = 'Skipped: OpenSSH client missing (run Step5_InstallGitSSH)'
    } elseif (Test-PasswordlessSSH -Alias $entry.Alias) {
        $entry.Status = 'Passwordless SSH OK'
        if (Invoke-RemoteCodexSetup -Alias $entry.Alias) {
            $entry.RemoteSetup = 'Codex CLI ready on remote host'
        } else {
            $entry.RemoteSetup = 'Remote setup incomplete; will retry next run'
        }
    } elseif ($entry.HasPasswordSecret) {
        $entry.Status = 'Password auth required: run ssh1-style script once to finish key setup, then re-run this step'
        Write-Host "$scriptIndex $($entry.Alias): passwordless SSH is not ready yet. Run '$($entry.WindowsScript)' once to log in and follow its key setup guide, then re-run this step." -ForegroundColor Yellow
    } else {
        $entry.Status = 'Unreachable via passwordless SSH'
        Write-Host "$scriptIndex $($entry.Alias): unreachable via BatchMode SSH; check host availability." -ForegroundColor Yellow
    }
    $hostMapEntries += $entry
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
Write-Host "  - SSH aliases     : $(if ($sshHostEntries.Count -gt 0) { ($sshHostEntries | ForEach-Object { $_[0].Alias }) -join ', ' } else { 'none discovered' })" -ForegroundColor White
Write-Host "  - ssh scripts     : $sshWinConformantCount/$($sshScriptFiles.Count) conform to the generator standard (failures: $conformanceFailures)" -ForegroundColor White
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
