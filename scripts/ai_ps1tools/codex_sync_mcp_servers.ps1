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
    Codex MCP Servers Configuration (PowerShell version)
.DESCRIPTION
    Configures MCP servers for Codex using 'codex mcp add' CLI commands.
    HTTP uses --url flag. All commands execute directly with real-time output.
#>

#region Variable Declarations
$script:PS_CURRENT_DIR = $PSScriptRoot
$script:CONFIG_PROVIDER_PS1 = Join-Path $script:PS_CURRENT_DIR "mcp_config_provider.ps1"
#endregion

#region Load Config Provider
. $script:CONFIG_PROVIDER_PS1
#endregion

#region Codex Config Helpers
# Per the official Codex docs, `codex mcp add` only supports stdio servers; remote
# HTTP/streamable-HTTP servers have NO CLI command and must be written directly to
# ~/.codex/config.toml as [mcp_servers.<Name>] with `url` (+ optional `http_headers`).
# The functions below own the config.toml editing for HTTP servers.
$script:CODEX_CONFIG_PATH = Join-Path $env:USERPROFILE ".codex\config.toml"

function Initialize-CodexConfig {
    $parentDir = Split-Path $script:CODEX_CONFIG_PATH -Parent
    if (-not (Test-Path -LiteralPath $parentDir)) {
        New-Item -ItemType Directory -Path $parentDir -Force | Out-Null
    }
    if (-not (Test-Path -LiteralPath $script:CODEX_CONFIG_PATH)) {
        Set-Content -LiteralPath $script:CODEX_CONFIG_PATH -Value @() -Encoding UTF8
    }
}

function Remove-CodexServerSection {
    # Strip an existing [mcp_servers.<Name>] table and ALL of its subtables
    # ([mcp_servers.<Name>.http_headers], etc.) so re-runs are idempotent.
    param(
        [Parameter(Mandatory=$true)] [string]$Name
    )
    if (-not (Test-Path -LiteralPath $script:CODEX_CONFIG_PATH)) { return }
    $lines = @(Get-Content -LiteralPath $script:CODEX_CONFIG_PATH -Encoding UTF8)
    $kept = New-Object System.Collections.Generic.List[string]
    $base = "[mcp_servers.$Name]"
    $subPrefix = "[mcp_servers.$Name."
    $skipping = $false
    foreach ($line in $lines) {
        $trimmed = $line.Trim()
        if ($trimmed -eq $base -or $trimmed.StartsWith($subPrefix)) {
            $skipping = $true
            continue
        }
        if ($skipping) {
            if ($trimmed.StartsWith("[")) {
                $skipping = $false   # a different table starts; keep it (fall through)
            } else {
                continue              # still inside our table body; drop the line
            }
        }
        $kept.Add($line)
    }
    Set-Content -LiteralPath $script:CODEX_CONFIG_PATH -Value $kept -Encoding UTF8
}

function Set-CodexHttpServer {
    # Write a remote HTTP server as [mcp_servers.<Name>] url = "..." plus an
    # [mcp_servers.<Name>.http_headers] table for any custom headers.
    param(
        [Parameter(Mandatory=$true)] [string]$Name,
        [Parameter(Mandatory=$true)] [string]$Url,
        [Parameter()] [hashtable]$Headers = @{}
    )
    Initialize-CodexConfig
    Remove-CodexServerSection -Name $Name
    $urlEsc = ($Url -replace '\\', '\\') -replace '"', '\"'
    $out = New-Object System.Collections.Generic.List[string]
    foreach ($line in @(Get-Content -LiteralPath $script:CODEX_CONFIG_PATH -Encoding UTF8)) {
        $out.Add($line)
    }
    $out.Add("")
    $out.Add("[mcp_servers.$Name]")
    $out.Add("url = `"$urlEsc`"")
    if ($Headers -and $Headers.Count -gt 0) {
        $out.Add("")
        $out.Add("[mcp_servers.$Name.http_headers]")
        foreach ($hKey in $Headers.Keys) {
            $hVal = ($Headers[$hKey] -replace '\\', '\\') -replace '"', '\"'
            $out.Add("$hKey = `"$hVal`"")
        }
    }
    Set-Content -LiteralPath $script:CODEX_CONFIG_PATH -Value $out -Encoding UTF8
    Write-Host "[OK] Wrote [mcp_servers.$Name] (url + http_headers) to codex config.toml"
}
#endregion

#region Main Logic
Write-Host "================================================================================"
Write-Host "[CODEX] Configuring MCP servers using 'codex mcp add' commands"
Write-Host "================================================================================"
Write-Host ""

Write-Host "[INFO] Checking Codex CLI availability..."
codex --version
Write-Host ""

$configs = Get-AllMCPConfigs -Target "codex"
if ($configs.Count -eq 0) {
    Write-Host "[WARNING] No MCP servers to configure"
    return
}

Write-Host "================================================================================"
Write-Host ""

$idx = 0
foreach ($config in $configs) {
    $idx++
    $name = $config.Name
    $transport = $config.TransportType
    Write-Host "[$idx/$($configs.Count)] Executing: $name ($transport)"

    if ($transport -eq "http") {
        # codex mcp add is stdio-only; HTTP servers are written straight to
        # config.toml. Set-CodexHttpServer clears any prior table first, so this
        # is idempotent without needing the CLI 'remove'.
        Write-Host "[CONFIG] Writing HTTP server '$name' directly to config.toml (no --url CLI flag exists)"
        Set-CodexHttpServer -Name $name -Url $config.Url -Headers $config.Headers
    }
    else {
        # Remove any existing stdio entry first so re-runs always apply the latest
        # config (codex add on an existing name can fail or leave stale values).
        Write-Host "[CLEAN] codex mcp remove $name"
        codex mcp remove $name 2>$null
        $fullArgs = @("mcp", "add", $name)
        foreach ($eKey in $config.Env.Keys) {
            $eVal = $config.Env[$eKey]
            $fullArgs += "--env"
            $fullArgs += "${eKey}=${eVal}"
        }
        $fullArgs += "--"
        $fullArgs += $config.Command
        foreach ($a in $config.CmdArgs) {
            $fullArgs += $a
        }
        Write-Host "[CMD] codex $($fullArgs -join ' ')"
        & codex $fullArgs
    }
    Write-Host ""

    Write-Host "[VERIFY] codex mcp list"
    codex mcp list
    Write-Host ""
}

Write-Host "================================================================================"
Write-Host "[SUMMARY] Codex MCP Configuration Complete"
Write-Host "================================================================================"
#endregion
