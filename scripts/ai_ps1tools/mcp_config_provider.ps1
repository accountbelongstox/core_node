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
    Common MCP Configuration Provider (PowerShell version)
.DESCRIPTION
    Provides unified MCP server configurations and secret reading for all AI tools.
    Pure PowerShell - no Python dependency. Dot-source this file to use.
#>

#region Variable Declarations
$script:MCP_PROVIDER_DIR = $PSScriptRoot
$script:MCP_PROVIDER_SCRIPTS_DIR = Split-Path $script:MCP_PROVIDER_DIR -Parent
$script:MCP_PROJECT_ROOT = Split-Path $script:MCP_PROVIDER_SCRIPTS_DIR -Parent
$script:MCP_SECRET_KEYS_DIR = Join-Path $script:MCP_PROJECT_ROOT ".secret_keys"
$script:MCP_SECRET_RAW_DIR = Join-Path $script:MCP_SECRET_KEYS_DIR ".secret_ignore"
$script:MCP_PYMAIN_PATH = Join-Path $script:MCP_PROJECT_ROOT "pymain.py"
#endregion

#region Secret Manager
function Get-SecretKey {
    param(
        [Parameter(Mandatory=$true)]
        [string]$KeyName
    )
    $rawFile = Join-Path $script:MCP_SECRET_RAW_DIR $KeyName
    if (-not (Test-Path -LiteralPath $rawFile)) {
        return ""
    }
    $content = Get-Content -LiteralPath $rawFile -Raw -Encoding UTF8 -ErrorAction SilentlyContinue
    if (-not $content) { return "" }
    # Remove BOM if present (use Ordinal comparison to avoid culture-sensitive
    # matching where .NET treats U+FEFF as invisible and StartsWith returns
    # True even when the string does NOT actually begin with a BOM character,
    # causing Substring(1) to incorrectly strip the first visible character)
    if ($content.Length -gt 0 -and [int]$content[0] -eq 0xFEFF) {
        $content = $content.Substring(1)
    }
    foreach ($line in $content -split "`r?`n") {
        $trimmed = $line.Trim()
        if ($trimmed.Length -gt 0) {
            return $trimmed
        }
    }
    return ""
}
#endregion

#region MCP Config Classes (hashtable-based)
function New-MCPConfig {
    param(
        [string]$Name,
        [string]$TransportType = "stdio",
        [string]$Command = "",
        [string[]]$CmdArgs = @(),
        [string]$Url = "",
        [hashtable]$Headers = @{},
        [hashtable]$Env = @{}
    )
    return @{
        Name          = $Name
        TransportType = $TransportType
        Command       = $Command
        CmdArgs       = $CmdArgs
        Url           = $Url
        Headers       = $Headers
        Env           = $Env
    }
}

function Get-Context7Config {
    $apiKey = Get-SecretKey -KeyName "CONTEXT7_API_KEY_1"
    if (-not $apiKey) {
        Write-Host "[ERROR] CONTEXT7_API_KEY not found in secret manager."
        Write-Host "[HINT] Please add CONTEXT7_API_KEY_1 to: $script:MCP_SECRET_RAW_DIR"
        return $null
    }
    Write-Host "[INFO] Context7 API key loaded successfully"
    return (New-MCPConfig -Name "context7" -TransportType "http" `
        -Url "https://mcp.context7.com/mcp" `
        -Headers @{
            "CONTEXT7_API_KEY" = $apiKey
            "Accept"          = "application/json, text/event-stream"
        })
}

function Get-UnifiedServerConfig {
    $pythonExe = "python"
    if ($Global:PYTHON_EXE_PATH -and (Test-Path -LiteralPath $Global:PYTHON_EXE_PATH)) {
        $pythonExe = $Global:PYTHON_EXE_PATH
    }
    $pymainAbsolute = $script:MCP_PYMAIN_PATH
    return (New-MCPConfig -Name "unified" -TransportType "stdio" `
        -Command $pythonExe `
        -CmdArgs @($pymainAbsolute, "app=mcp") `
        -Env @{ "MCP_ALLOW_ALL_PATHS" = "true" })
}

function Get-ChromeMCPConfig {
    return (New-MCPConfig -Name "chrome" -TransportType "http" `
        -Url "http://127.0.0.1:12306/mcp")
}

function Get-AllMCPConfigs {
    param(
        [string]$Target = "claude"
    )
    $configs = @()
    Write-Host "[INFO] Loading MCP configurations for $Target..."
    Write-Host ""

    $context7Config = Get-Context7Config
    if ($context7Config) {
        $configs += $context7Config
    }

    $unifiedConfig = Get-UnifiedServerConfig
    $configs += $unifiedConfig

    $chromeConfig = Get-ChromeMCPConfig
    $configs += $chromeConfig

    Write-Host ""
    Write-Host "[INFO] Loaded $($configs.Count) MCP configuration(s):"
    foreach ($cfg in $configs) {
        Write-Host "  - $($cfg.Name) ($($cfg.TransportType))"
    }
    Write-Host ""

    return $configs
}

function Get-MCPProjectRoot {
    return $script:MCP_PROJECT_ROOT
}

function Set-ClaudeGitBashEnv {
    # Claude Code on Windows requires CLAUDE_CODE_GIT_BASH_PATH
    if ($env:CLAUDE_CODE_GIT_BASH_PATH -and (Test-Path -LiteralPath $env:CLAUDE_CODE_GIT_BASH_PATH)) {
        return
    }
    $searchPaths = @(
        "D:\applications\Git\bin\bash.exe",
        "C:\Program Files\Git\bin\bash.exe",
        "C:\Program Files (x86)\Git\bin\bash.exe",
        "D:\Git\bin\bash.exe",
        "C:\Git\bin\bash.exe"
    )
    foreach ($p in $searchPaths) {
        if (Test-Path -LiteralPath $p) {
            $env:CLAUDE_CODE_GIT_BASH_PATH = $p
            Write-Host "[INFO] Set CLAUDE_CODE_GIT_BASH_PATH=$p"
            return
        }
    }
    # Try finding via git command
    $gitCmd = Get-Command git -ErrorAction SilentlyContinue
    if ($gitCmd -and $gitCmd.Source) {
        $gitBinDir = Split-Path (Split-Path $gitCmd.Source -Parent) -Parent
        $bashPath = Join-Path $gitBinDir "bin\bash.exe"
        if (Test-Path -LiteralPath $bashPath) {
            $env:CLAUDE_CODE_GIT_BASH_PATH = $bashPath
            Write-Host "[INFO] Set CLAUDE_CODE_GIT_BASH_PATH=$bashPath"
            return
        }
    }
    Write-Host "[WARNING] Could not find git-bash. Claude mcp commands may fail on Windows."
}

function Get-MCPPythonExe {
    # Priority 1: GlobalVars PYTHON_EXE_PATH (from DD)
    if ($Global:PYTHON_EXE_PATH -and (Test-Path -LiteralPath $Global:PYTHON_EXE_PATH)) {
        return $Global:PYTHON_EXE_PATH
    }
    # Priority 2: Detect DD Python via D:\.dev_${systemName}\python311\python.exe
    $systemNames = @("win10", "win11", "win", "win_8", "win_7")
    foreach ($sn in $systemNames) {
        $ddPyPath = Join-Path "D:\.dev_$sn" "python311\python.exe"
        if (Test-Path -LiteralPath $ddPyPath) { return $ddPyPath }
    }
    # Priority 3: System python3/python (skip Windows Store alias)
    $py3 = Get-Command python3 -ErrorAction SilentlyContinue
    if ($py3 -and $py3.Source -and (-not ($py3.Source -like "*WindowsApps*"))) {
        return $py3.Source
    }
    $py = Get-Command python -ErrorAction SilentlyContinue
    if ($py -and $py.Source -and (-not ($py.Source -like "*WindowsApps*"))) {
        return $py.Source
    }
    return $null
}
#endregion
