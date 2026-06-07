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
function Set-CodexHttpHeaders {
    # 'codex mcp add --url' has no flag for custom HTTP headers, so context7's
    # CONTEXT7_API_KEY header cannot be set via the CLI. This appends an
    # [mcp_servers.<Name>.http_headers] table to ~/.codex/config.toml so the
    # key is sent. Existing header tables for the server are replaced.
    param(
        [Parameter(Mandatory=$true)] [string]$Name,
        [Parameter(Mandatory=$true)] [hashtable]$Headers
    )
    if ($Headers.Count -eq 0) { return }
    $codexConfig = Join-Path $env:USERPROFILE ".codex\config.toml"
    if (-not (Test-Path -LiteralPath $codexConfig)) {
        Write-Host "[WARNING] codex config.toml not found at $codexConfig; cannot set headers for $Name"
        return
    }
    $sectionHeader = "[mcp_servers.$Name.http_headers]"
    $lines = Get-Content -LiteralPath $codexConfig -Encoding UTF8
    $kept = New-Object System.Collections.Generic.List[string]
    $skipping = $false
    foreach ($line in $lines) {
        $trimmed = $line.Trim()
        if ($trimmed -eq $sectionHeader) { $skipping = $true; continue }
        if ($skipping) {
            if ($trimmed.StartsWith("[")) { $skipping = $false } else { continue }
        }
        $kept.Add($line)
    }
    $kept.Add("")
    $kept.Add($sectionHeader)
    foreach ($hKey in $Headers.Keys) {
        $hVal = ($Headers[$hKey] -replace '\\', '\\') -replace '"', '\"'
        $kept.Add("$hKey = `"$hVal`"")
    }
    Set-Content -LiteralPath $codexConfig -Value $kept -Encoding UTF8
    Write-Host "[OK] Wrote http_headers for $Name to codex config.toml"
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

    # Remove any existing entry first so re-runs always apply the latest config
    # (codex add on an existing name can fail or leave stale values). Non-fatal.
    Write-Host "[CLEAN] codex mcp remove $name"
    codex mcp remove $name 2>$null
    if ($transport -eq "http") {
        $fullArgs = @("mcp", "add", $name, "--url", $config.Url)
        Write-Host "[CMD] codex $($fullArgs -join ' ')"
        & codex $fullArgs
        if ($config.Headers -and $config.Headers.Count -gt 0) {
            Set-CodexHttpHeaders -Name $name -Headers $config.Headers
        }
    }
    else {
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
