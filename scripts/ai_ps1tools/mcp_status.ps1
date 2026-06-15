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
    MCP status / detection helpers for the MCP Management Menu.
.DESCRIPTION
    Detects which AI tools are installed, reads each tool's already-configured MCP
    servers, and reports key availability for key-requiring servers (e.g. Context7).
    Pure display / detection logic - no return codes are relied upon, everything is
    printed in real time. Dot-source this file to use.
#>

#region Variable Declarations
$script:MCP_STATUS_DIR = $PSScriptRoot
$script:MCP_STATUS_PROVIDER_PS1 = Join-Path $script:MCP_STATUS_DIR "mcp_config_provider.ps1"
$script:MCP_STATUS_LINES = @()
#endregion

. $script:MCP_STATUS_PROVIDER_PS1

#region Registry
function Get-MCPToolRegistry {
    # Single source of truth for every supported AI tool: how to detect it, where
    # its config lives, and how its MCP servers are stored. Detection is by CLI
    # command presence and/or config file/dir presence (a tool may exist without a
    # CLI on PATH). "ExtraCmds" are sibling CLIs that share the same config file.
    $homeDir = [System.Environment]::GetFolderPath("UserProfile")
    $appData = $env:APPDATA
    $registry = @()

    $registry += @{
        Key = "claude"; Display = "Claude Code"; DetectCmds = @("claude"); ExtraCmds = @()
        Kind = "json"; TopKey = "mcpServers"; SyncVia = "cli (claude mcp add)"
        ConfigPaths = @((Join-Path $homeDir ".claude.json"))
    }
    $registry += @{
        Key = "cursor"; Display = "Cursor"; DetectCmds = @("cursor"); ExtraCmds = @("cursor-agent")
        Kind = "json"; TopKey = "mcpServers"; SyncVia = "file (~/.cursor/mcp.json, shared with cursor-agent)"
        ConfigPaths = @((Join-Path $homeDir ".cursor\mcp.json"))
    }
    $registry += @{
        Key = "codex"; Display = "Codex"; DetectCmds = @("codex"); ExtraCmds = @()
        Kind = "toml"; TopKey = ""; SyncVia = "cli (stdio) + config.toml (http)"
        ConfigPaths = @((Join-Path $homeDir ".codex\config.toml"))
    }
    $registry += @{
        Key = "gemini"; Display = "Gemini CLI"; DetectCmds = @("gemini"); ExtraCmds = @()
        Kind = "json"; TopKey = "mcpServers"; SyncVia = "file (~/.gemini/settings.json, httpUrl)"
        ConfigPaths = @((Join-Path $homeDir ".gemini\settings.json"))
    }
    $registry += @{
        Key = "droid"; Display = "Droid (Factory)"; DetectCmds = @("droid"); ExtraCmds = @()
        Kind = "json"; TopKey = "mcpServers"; SyncVia = "file (~/.factory/mcp.json, type:http)"
        ConfigPaths = @((Join-Path $homeDir ".factory\mcp.json"))
    }
    $registry += @{
        Key = "windsurf"; Display = "Windsurf"; DetectCmds = @("windsurf"); ExtraCmds = @()
        Kind = "json"; TopKey = "mcpServers"; SyncVia = "file (~/.codeium/windsurf/mcp_config.json, serverUrl)"
        ConfigPaths = @((Join-Path $homeDir ".codeium\windsurf\mcp_config.json"))
    }
    $registry += @{
        Key = "devin"; Display = "Devin CLI"; DetectCmds = @("devin"); ExtraCmds = @()
        Kind = "json"; TopKey = "mcpServers"; SyncVia = "file (%APPDATA%\devin\config.json, transport)"
        ConfigPaths = @()
    }
    if ($appData) {
        $registry[$registry.Count - 1].ConfigPaths = @((Join-Path $appData "devin\config.json"), (Join-Path $homeDir ".config\devin\config.json"))
    } else {
        $registry[$registry.Count - 1].ConfigPaths = @((Join-Path $homeDir ".config\devin\config.json"))
    }
    $registry += @{
        Key = "vscode"; Display = "VS Code"; DetectCmds = @("code"); ExtraCmds = @("code-insiders")
        Kind = "json"; TopKey = "servers"; SyncVia = "file (%APPDATA%\Code\User\mcp.json, top-level servers)"
        ConfigPaths = @()
    }
    if ($appData) {
        $registry[$registry.Count - 1].ConfigPaths = @(
            (Join-Path $appData "Code\User\mcp.json"),
            (Join-Path $appData "Code - Insiders\User\mcp.json"),
            (Join-Path $appData "VSCodium\User\mcp.json")
        )
    } else {
        $registry[$registry.Count - 1].ConfigPaths = @((Join-Path $homeDir ".config\Code\User\mcp.json"))
    }

    return $registry
}
#endregion

#region Detection helpers
function Test-MCPCommand {
    param([Parameter(Mandatory = $true)] [string]$Name)
    $cmd = Get-Command $Name -ErrorAction SilentlyContinue
    if ($cmd -and $cmd.Source -and ($cmd.Source -like "*WindowsApps*")) { return $false }
    return [bool]$cmd
}

function Get-MCPExistingFromJson {
    param(
        [Parameter(Mandatory = $true)] [string]$Path,
        [Parameter(Mandatory = $true)] [string]$TopKey
    )
    $names = @()
    if (-not (Test-Path -LiteralPath $Path)) { return $names }
    $raw = Get-Content -LiteralPath $Path -Raw -Encoding UTF8 -ErrorAction SilentlyContinue
    if (-not $raw) { return $names }
    try {
        $json = $raw | ConvertFrom-Json -ErrorAction Stop
    } catch {
        return $names
    }
    if (-not $json) { return $names }
    $node = $json.PSObject.Properties[$TopKey]
    if (-not $node -or -not $node.Value) { return $names }
    foreach ($prop in $node.Value.PSObject.Properties) {
        $names += $prop.Name
    }
    return $names
}

function Get-MCPExistingFromToml {
    param([Parameter(Mandatory = $true)] [string]$Path)
    $names = @()
    if (-not (Test-Path -LiteralPath $Path)) { return $names }
    $lines = @(Get-Content -LiteralPath $Path -Encoding UTF8 -ErrorAction SilentlyContinue)
    foreach ($line in $lines) {
        $trimmed = $line.Trim()
        # Match a top-level [mcp_servers.NAME] table, but not subtables like
        # [mcp_servers.NAME.http_headers] (those contain a second dot).
        $m = [regex]::Match($trimmed, '^\[mcp_servers\.([^.\]]+)\]$')
        if ($m.Success) { $names += $m.Groups[1].Value }
    }
    return $names
}

function Get-MCPExistingServers {
    param([Parameter(Mandatory = $true)] [hashtable]$Tool)
    $result = @{ Names = @(); Path = $null }
    foreach ($path in $Tool.ConfigPaths) {
        if (Test-Path -LiteralPath $path) {
            $result.Path = $path
            if ($Tool.Kind -eq "toml") {
                $result.Names = @(Get-MCPExistingFromToml -Path $path)
            } else {
                $result.Names = @(Get-MCPExistingFromJson -Path $path -TopKey $Tool.TopKey)
            }
            return $result
        }
    }
    return $result
}

function Get-MCPToolStatus {
    param([Parameter(Mandatory = $true)] [hashtable]$Tool)
    $status = @{
        Key = $Tool.Key; Display = $Tool.Display; SyncVia = $Tool.SyncVia
        CliAvailable = $false; ConfigAvailable = $false; Available = $false
        ExtraCli = @(); Existing = @(); ConfigPath = $null
    }
    foreach ($c in $Tool.DetectCmds) {
        if (Test-MCPCommand -Name $c) { $status.CliAvailable = $true; break }
    }
    foreach ($c in $Tool.ExtraCmds) {
        if (Test-MCPCommand -Name $c) { $status.ExtraCli += $c }
    }
    $existing = Get-MCPExistingServers -Tool $Tool
    $status.Existing = $existing.Names
    $status.ConfigPath = $existing.Path
    if ($existing.Path) { $status.ConfigAvailable = $true }
    $status.Available = ($status.CliAvailable -or $status.ConfigAvailable)
    return $status
}
#endregion

#region Key status
function Get-MCPMaskedSecret {
    param([string]$Value)
    if ([string]::IsNullOrEmpty($Value)) { return "" }
    if ($Value.Length -le 4) { return ("*" * $Value.Length) }
    $tail = $Value.Substring($Value.Length - 4)
    return ("****" + $tail)
}

function Get-MCPKeyStatuses {
    # Servers that require a secret key. Extend this list as new key-gated servers
    # are added to mcp_config_provider.ps1.
    $defs = @(
        @{ Server = "context7"; KeyName = "CONTEXT7_API_KEY_1"; Label = "CONTEXT7_API_KEY" }
    )
    $out = @()
    foreach ($d in $defs) {
        $val = Get-SecretKey -KeyName $d.KeyName
        $out += @{
            Server = $d.Server; Label = $d.Label; KeyName = $d.KeyName
            Loaded = [bool]$val; Masked = (Get-MCPMaskedSecret -Value $val)
        }
    }
    return $out
}
#endregion

#region Panel rendering
function Initialize-MCPStatusPanel {
    # Computes the compact status panel ONCE (detection touches the filesystem and
    # PATH) and caches the formatted lines so the menu can redraw cheaply on every
    # keystroke. Call again to refresh after an install/sync.
    $lines = New-Object System.Collections.Generic.List[string]
    $registry = Get-MCPToolRegistry

    $lines.Add("-- Detected AI tools / existing MCP ----------------------")
    foreach ($tool in $registry) {
        $st = Get-MCPToolStatus -Tool $tool
        $mark = if ($st.Available) { "[OK]" } else { "[--]" }
        $name = $st.Display.PadRight(16)
        $existingText = if ($st.Existing.Count -gt 0) { ($st.Existing -join ", ") } else { "(none)" }
        $line = "  $mark $name mcp: $existingText"
        if (-not $st.Available) { $line = "  $mark $name not detected" }
        if ($st.ExtraCli.Count -gt 0) { $line = "$line  (+$($st.ExtraCli -join ', '))" }
        $lines.Add($line)
    }

    $lines.Add("-- Keys (for key-gated servers) --------------------------")
    foreach ($k in (Get-MCPKeyStatuses)) {
        if ($k.Loaded) {
            $lines.Add("  [OK] $($k.Label) -> loaded ($($k.Masked))  [server: $($k.Server)]")
        } else {
            $lines.Add("  [--] $($k.Label) -> MISSING  [server: $($k.Server)] add $($k.KeyName) to .secret_ignore")
        }
    }

    $script:MCP_STATUS_LINES = $lines.ToArray()
}

function Show-MCPStatusPanel {
    if (-not $script:MCP_STATUS_LINES -or $script:MCP_STATUS_LINES.Count -eq 0) {
        Initialize-MCPStatusPanel
    }
    foreach ($line in $script:MCP_STATUS_LINES) {
        if ($line -like "*[OK]*") {
            Write-Host $line -ForegroundColor Green
        } elseif ($line -like "*[--]*") {
            Write-Host $line -ForegroundColor DarkGray
        } else {
            Write-Host $line -ForegroundColor Cyan
        }
    }
}
#endregion

#region Dry-run planned servers (command details + key check)
function Show-MCPPlannedServers {
    # Prints exactly what WOULD be configured: each server's resolved transport,
    # command/args/url, env and headers (secret values masked), plus whether the
    # required key was actually read. Get-AllMCPConfigs already prints the live
    # "[INFO] Context7 API key loaded" / "[ERROR] ... not found" line.
    $configs = $null
    $idx = 0

    Write-Host ""
    Write-Host "========================================================" -ForegroundColor Cyan
    Write-Host " Planned MCP servers (dry-run, no changes written)" -ForegroundColor Cyan
    Write-Host "========================================================" -ForegroundColor Cyan
    Write-Host ""

    $configs = Get-AllMCPConfigs -Target "dry-run"
    if (-not $configs -or $configs.Count -eq 0) {
        Write-Host "[WARNING] No MCP servers resolved"
        return
    }

    foreach ($config in $configs) {
        $idx++
        Write-Host "[$idx] $($config.Name)  ($($config.TransportType))" -ForegroundColor White
        if ($config.TransportType -eq "http") {
            Write-Host "     url     : $($config.Url)"
            if ($config.Headers -and $config.Headers.Count -gt 0) {
                foreach ($hk in $config.Headers.Keys) {
                    $hv = $config.Headers[$hk]
                    # Mask anything that looks like a credential header
                    if ($hk -match "(?i)key|token|secret|auth") {
                        Write-Host "     header  : $hk = $(Get-MCPMaskedSecret -Value $hv)"
                    } else {
                        Write-Host "     header  : $hk = $hv"
                    }
                }
            }
        } else {
            Write-Host "     command : $($config.Command)"
            Write-Host "     args    : $($config.CmdArgs -join ' ')"
            if ($config.Env -and $config.Env.Count -gt 0) {
                foreach ($ek in $config.Env.Keys) {
                    Write-Host "     env     : $ek = $($config.Env[$ek])"
                }
            }
        }
        Write-Host ""
    }

    Write-Host "-- Key check --------------------------------------------" -ForegroundColor Cyan
    foreach ($k in (Get-MCPKeyStatuses)) {
        if ($k.Loaded) {
            Write-Host "  [OK] $($k.Label) for '$($k.Server)' -> loaded ($($k.Masked))" -ForegroundColor Green
        } else {
            Write-Host "  [--] $($k.Label) for '$($k.Server)' -> MISSING" -ForegroundColor Yellow
        }
    }
    Write-Host ""
}
#endregion
