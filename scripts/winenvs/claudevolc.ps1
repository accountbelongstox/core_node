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

<#
.SYNOPSIS
    Claude AI (Volcano Ark / Doubao) Launch Script - v4

.DESCRIPTION
    Launches Claude Code via Volcano Ark (Doubao) coding endpoint with the model
    forced to glm-5.2 everywhere, experimental agent teams force-enabled,
    and ultracode opt-in (default No).
    API key is read from .secret_keys/.secret_ignore/ARK_API_KEY_1 (written by
    the Special Software Environment Variables Manager, dd.sh / dd.cmd).
    Volcano Ark /api/coding is the Anthropic-compatible endpoint and serves
    glm-5.2 (model is glm-5.2, NOT doubao).
#>

Set-StrictMode -Version Latest
$ErrorActionPreference = "Stop"

# Variable declarations
$volcBaseUrl = ""
$volcApiKey = ""
$volcModel = "glm-5.2"
$ultraSettingsJson = $null
$ultraSettingsFile = $null
$claudeArgs = $null
$teammateMode = $null
$exitCode = 0
$scriptActualPath = $null
$item = $null
$scriptCurrentPath = $null
$scriptsDirPath = $null
$projectRootPath = $null
$secretDir = $null
$maskedKey = $null
$shellsWinPath = $null
$winCommonDirPath = $null
$windowsPathFunctionScript = $null
$claudeLaunchCommonScript = $null
$claudeExecutable = $null
$ultraChoice = $null
$enableUltra = $false

# Ensure DISABLE_AUTOUPDATER is set for Claude Code
$env:DISABLE_AUTOUPDATER = "1"
$env:CLAUDE_CODE_DISABLE_NONESSENTIAL_TRAFFIC = "1"

# Force-enable experimental agent teams (like claudeteam).
$env:CLAUDE_CODE_EXPERIMENTAL_AGENT_TEAMS = "1"

# Windows default: run experimental agent teams in-process (like claudeteam).
$teammateMode = 'in-process'

# Ultracode via temp settings FILE when opted in (Windows PowerShell 5.1 strips
# double quotes when handing a JSON literal to a native exe).
$ultraSettingsJson = '{"ultracode":true}'
$ultraSettingsFile = Join-Path $env:TEMP "claudevolc_ultracode_settings.json"

Write-Host ""
Write-Host "============================================================" -ForegroundColor Cyan
Write-Host "Claude AI (Volcano Ark / Doubao) - v4 [glm-5.2 + team + opt-in ultracode]" -ForegroundColor Yellow
Write-Host "============================================================" -ForegroundColor Cyan
Write-Host ""

# Initialize path variables
$scriptActualPath = $PSCommandPath
$item = Get-Item -LiteralPath $PSCommandPath
if ($item -and $item -is [System.IO.FileInfo] -and $item.LinkType) {
    $scriptActualPath = $item.Target
}
$scriptCurrentPath = Split-Path $scriptActualPath -Parent
if (-not $scriptCurrentPath) {
    $scriptCurrentPath = $PSScriptRoot
    if (-not $scriptCurrentPath) {
        $scriptCurrentPath = Split-Path -Parent $MyInvocation.MyCommand.Path
    }
}
$scriptsDirPath = Split-Path $scriptCurrentPath -Parent
$projectRootPath = Split-Path $scriptsDirPath -Parent

# Ensure PATH is prepared via WindowsPathFunction (same as claudeteam.ps1).
$shellsWinPath = Join-Path $scriptsDirPath "shells"
$shellsWinPath = Join-Path $shellsWinPath "win"
$winCommonDirPath = Join-Path $shellsWinPath "win_common"
$windowsPathFunctionScript = Join-Path $winCommonDirPath "WindowsPathFunction.ps1"
$claudeLaunchCommonScript = Join-Path $winCommonDirPath "ClaudeLaunchCommon.ps1"
. $windowsPathFunctionScript
Set-CoreNodePaths
. $claudeLaunchCommonScript

# Load environment variables from secret files
$secretDir = Join-Path $projectRootPath ".secret_keys\.secret_ignore"

function Read-SecretFile {
    param([string]$FilePath)
    $value = ""
    if (Test-Path $FilePath) {
        try {
            $bytes = [System.IO.File]::ReadAllBytes($FilePath)
            if ($bytes.Length -ge 3 -and $bytes[0] -eq 0xEF -and $bytes[1] -eq 0xBB -and $bytes[2] -eq 0xBF) {
                $bytes = $bytes[3..($bytes.Length - 1)]
            }
            $content = [System.Text.Encoding]::UTF8.GetString($bytes)
            $lines = $content -split "`r?`n"
            foreach ($line in $lines) {
                $trimmedLine = $line.Trim()
                if ($trimmedLine) {
                    $value = $trimmedLine
                    break
                }
            }
        }
        catch {
            $value = ""
        }
    }
    return $value
}

# Load API key
$volcApiKey = Read-SecretFile (Join-Path $secretDir "ARK_API_KEY_1")

# Load base URL with fallback to default
$volcBaseUrl = Read-SecretFile (Join-Path $secretDir "ARK_BASE_URL_1")
if (-not $volcBaseUrl) {
    $volcBaseUrl = "https://ark.cn-beijing.volces.com/api/coding"
}

# Set the Claude Code environment variables (gateway + glm-5.2 forced everywhere).
$env:ANTHROPIC_BASE_URL = $volcBaseUrl
if ($volcApiKey) {
    $env:ANTHROPIC_AUTH_TOKEN = $volcApiKey
}
$env:ANTHROPIC_MODEL = $volcModel
# Force glm-5.2 into every slot so agent-teams / subagents / background tasks
# also run through the Coding Plan gateway (official model ID: glm-5.2).
$env:CLAUDE_CODE_SUBAGENT_MODEL = $volcModel
$env:ANTHROPIC_DEFAULT_HAIKU_MODEL = $volcModel
$env:ANTHROPIC_DEFAULT_SONNET_MODEL = $volcModel

# Configuration summary
Write-Host "API Endpoint: $env:ANTHROPIC_BASE_URL" -ForegroundColor White
Write-Host "Model: $volcModel (forced: main + subagents + background)" -ForegroundColor White
Write-Host "Agent Teams: CLAUDE_CODE_EXPERIMENTAL_AGENT_TEAMS=1 (force-enabled)" -ForegroundColor White

if (-not $volcApiKey) {
    Write-Host ""
    Write-Host "[ERROR] Volcano Ark API Key not found!" -ForegroundColor Red
    Write-Host ""
    Write-Host "Please set up your credentials using dd.sh:" -ForegroundColor Yellow
    Write-Host "  1. Run sudo $projectRootPath/dd.sh" -ForegroundColor Gray
    Write-Host "  2. Navigate to: Special Software Environment Variables" -ForegroundColor Gray
    Write-Host "  3. Select: Volcano Ark (Doubao)" -ForegroundColor Gray
    Write-Host "  4. Set your ARK_API_KEY" -ForegroundColor Gray
    Write-Host ""
    Write-Host "Alternatively, create the secret file manually:" -ForegroundColor Yellow
    Write-Host "  $secretDir\ARK_API_KEY_1" -ForegroundColor Gray
    Write-Host ""
    $null = Read-Host "Press Enter to exit"
    if ($enableUltra -and (-not [string]::IsNullOrWhiteSpace($ultraSettingsFile)) -and (Test-Path $ultraSettingsFile)) {
        Remove-Item $ultraSettingsFile -Force -ErrorAction SilentlyContinue
    }
    exit 1
}
else {
    Write-Host "API Key: $volcApiKey (loaded)" -ForegroundColor White
}
Write-Host "============================================================" -ForegroundColor Cyan
Write-Host ""

# Build claude args: glm-5.2 always on; teammate-mode in-process;
# skip-permissions (Windows default, like claudeteam); ultracode opt-in.
$claudeArgs = @("--model", $volcModel, "--teammate-mode", $teammateMode, "--permission-mode", "bypassPermissions", "--dangerously-skip-permissions")

# Ultracode: opt-in prompt (default Yes).
$ultraChoice = Read-Host "Enable ultracode? [Y/n]"
if ($ultraChoice -ne 'n' -and $ultraChoice -ne 'N') {
    $enableUltra = $true
    [System.IO.File]::WriteAllText($ultraSettingsFile, $ultraSettingsJson)
    $claudeArgs += @("--settings", $ultraSettingsFile)
}

if ($enableUltra) {
    Write-Host "Ultracode: enabled (--settings via $ultraSettingsFile)" -ForegroundColor White
} else {
    Write-Host "Ultracode: off (opted out)" -ForegroundColor White
}

# Launch tool (info already shown above; start Claude directly).
$claudeExecutable = Resolve-ClaudeCodeExecutable
if (-not $claudeExecutable) {
    Write-Host ""
    Write-Host "[ERROR] Claude Code executable not found." -ForegroundColor Red
    Write-Host "Install via: npm install -g @anthropic-ai/claude-code" -ForegroundColor Yellow
    Write-Host "Or ensure $env:USERPROFILE\.local\bin\claude.exe exists." -ForegroundColor Yellow
    Write-Host ""
    if ($enableUltra -and (-not [string]::IsNullOrWhiteSpace($ultraSettingsFile)) -and (Test-Path $ultraSettingsFile)) {
        Remove-Item $ultraSettingsFile -Force -ErrorAction SilentlyContinue
    }
    exit 1
}

Write-Host ""
Write-Host "Executing: $claudeExecutable $($claudeArgs -join ' ')" -ForegroundColor White
Write-Host ""
Write-Host "Environment: ANTHROPIC_BASE_URL='$($env:ANTHROPIC_BASE_URL)', ANTHROPIC_MODEL='$volcModel'" -ForegroundColor White
Write-Host ""

& $claudeExecutable @claudeArgs @args
$exitCode = $LASTEXITCODE
if ($null -eq $exitCode) {
    $exitCode = 0
}

# Remove the temp settings file (claude reads it only at startup).
if ($enableUltra -and (-not [string]::IsNullOrWhiteSpace($ultraSettingsFile)) -and (Test-Path $ultraSettingsFile)) {
    Remove-Item $ultraSettingsFile -Force -ErrorAction SilentlyContinue
}

exit $exitCode
