# ### AI SPECIAL ATTENTION RULES START ###
# When AI/ALL DEVELOPERS sees this prompt, MUST IMMEDIATELY COMPLY WITH THESE RULES:
# 1. Write all code in English only.
# 2. Never execute, create, or modify test code.
# 3. Never create or update documentation (*.md).
# 4. Never write summaries during development or thinking process.
# 5. Declare all variables at the beginning of the file.
# 6. For PowerShell (*.ps1) scripts: Do not append strings directly to variables; Do not use relative paths such as "..\..\"; instead resolve absolute paths using parent path parsing (Split-Path, Join-Path, Resolve-Path).
# 7. Do not modify these rules.
# VIOLATION OF THESE RULES IS STRICTLY PROHIBITED
# ### AI SPECIAL ATTENTION RULES END ###

<#
.SYNOPSIS
    Claude AI (Zhipu AI / GLM) Launch Script - v3

.DESCRIPTION
    Launches Claude Code using Zhipu AI (GLM) API
    v3 - simplified, no custom user dir, uses current user directly
#>

Set-StrictMode -Version Latest
$ErrorActionPreference = "Stop"

# Variable declarations
$zhipuBaseUrl = ""
$zhipuApiKey = ""
$zhipuModel = "glm-5.2"

# Ensure DISABLE_AUTOUPDATER is set for Claude Code
$env:DISABLE_AUTOUPDATER = "1"
$env:CLAUDE_CODE_DISABLE_NONESSENTIAL_TRAFFIC = "1"

Write-Host ""
Write-Host "============================================================" -ForegroundColor Cyan
Write-Host "Claude AI (Zhipu AI / GLM) - v3" -ForegroundColor Yellow
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
$zhipuApiKey = Read-SecretFile (Join-Path $secretDir "ZHIPUAI_API_KEY_1")

# Load base URL with fallback to default
$zhipuBaseUrl = Read-SecretFile (Join-Path $secretDir "ZHIPUAI_BASE_URL_1")
if (-not $zhipuBaseUrl) {
    $zhipuBaseUrl = "https://open.bigmodel.cn/api/paas/v4"
}

# Set the Claude Code environment variables
$env:ANTHROPIC_BASE_URL = $zhipuBaseUrl
if ($zhipuApiKey) {
    $env:ANTHROPIC_AUTH_TOKEN = $zhipuApiKey
    $env:ANTHROPIC_API_KEY = $zhipuApiKey
}
$env:ANTHROPIC_MODEL = $zhipuModel

# Configuration summary
Write-Host "API Endpoint: $env:ANTHROPIC_BASE_URL" -ForegroundColor White
Write-Host "Model: $env:ANTHROPIC_MODEL" -ForegroundColor White

if (-not $zhipuApiKey) {
    Write-Host ""
    Write-Host "[ERROR] Zhipu AI API Key not found!" -ForegroundColor Red
    Write-Host ""
    Write-Host "Please set up your credentials using dd.sh:" -ForegroundColor Yellow
    Write-Host "  1. Run sudo $projectRootPath/dd.sh" -ForegroundColor Gray
    Write-Host "  2. Navigate to: Special Software Environment Variables" -ForegroundColor Gray
    Write-Host "  3. Select: Zhipu AI (GLM)" -ForegroundColor Gray
    Write-Host "  4. Set your ZHIPUAI_API_KEY" -ForegroundColor Gray
    Write-Host ""
    Write-Host "Alternatively, create the secret file manually:" -ForegroundColor Yellow
    Write-Host "  $secretDir\ZHIPUAI_API_KEY_1" -ForegroundColor Gray
    Write-Host ""
    $null = Read-Host "Press Enter to exit"
    exit 1
}
else {
    if ($zhipuApiKey.Length -gt 8) {
        $maskedKey = $zhipuApiKey.Substring(0, 4) + "***" + $zhipuApiKey.Substring($zhipuApiKey.Length - 4)
        Write-Host "API Key: $maskedKey (loaded)" -ForegroundColor White
    }
    else {
        Write-Host "API Key: [REDACTED] (loaded)" -ForegroundColor White
    }
}
Write-Host "============================================================" -ForegroundColor Cyan
Write-Host ""

# Build launch command display
$envVarsParts = @()
$envVarsParts += "`$env:ANTHROPIC_BASE_URL='$($env:ANTHROPIC_BASE_URL)'"
$envVarsParts += "`$env:ANTHROPIC_AUTH_TOKEN='[REDACTED]'"
$envVarsParts += "`$env:ANTHROPIC_MODEL='$($env:ANTHROPIC_MODEL)'"

$envVarsCommand = $envVarsParts -join '; '
$fullCommandDisplay = "$envVarsCommand; claude --dangerously-skip-permissions"

# Launch tool
Write-Host "============================================================" -ForegroundColor Cyan
Write-Host "Press Enter to start Claude AI (Zhipu AI / GLM)..." -ForegroundColor Yellow
Write-Host "============================================================" -ForegroundColor Cyan
$null = Read-Host "Press Enter to continue"

Write-Host ""
Write-Host "Executing: claude --dangerously-skip-permissions" -ForegroundColor White
Write-Host ""
Write-Host "Environment: ANTHROPIC_BASE_URL='$($env:ANTHROPIC_BASE_URL)', ANTHROPIC_MODEL='$($env:ANTHROPIC_MODEL)'" -ForegroundColor White
Write-Host ""
Write-Host "Press any key to continue..." -ForegroundColor Yellow
$null = $host.UI.RawUI.ReadKey("NoEcho,IncludeKeyDown")

claude --dangerously-skip-permissions
