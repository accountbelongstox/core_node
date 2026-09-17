<#
.SYNOPSIS
    Per-engine install-method selection (native/docker) for Windows TTS installers.

.DESCRIPTION
    Contract (plan steps 16-17), mirrored from linux/common/install_method_common.sh:
      * Idempotency per minimal operation: a saved valid choice is reused verbatim
        with NO countdown and NO rewrite; only the first selection or an explicit
        -Reselect shows the 20s timed prompt; a timeout commits exactly the
        displayed default; B/Q cancels without writing.
      * Per-engine keys (one global backend never overrides all engines):
          TTS_<ENGINE>_INSTALL_METHOD          native|docker
          TTS_<ENGINE>_INSTALL_METHOD_SOURCE   explicit|timeout_default
          TTS_<ENGINE>_INSTALL_METHOD_BACKENDS supported-set snapshot
          TTS_<ENGINE>_BACKEND                 backend actually used by the install
      * State flows only through the file-backed global var store
        (Set-GlobalVar/Get-GlobalVar), never through transient env vars.

    The prompt is console-based: 20s monotonic countdown (Stopwatch), Enter
    confirms the highlighted item, arrows/digits/N/D switch, B/Q cancel.
#>

$script:INSTALL_METHOD_CONFIG_VERSION = '1'
$script:INSTALL_METHOD_TIMEOUT_SEC = 20

if (-not (Get-Command Set-GlobalVar -ErrorAction SilentlyContinue)) {
    . (Join-Path $PSScriptRoot 'GlobalVarStoreCommon.ps1')
}

function script:Set-InstallMethodVarIfChanged {
    param([string]$Key, [string]$Value)
    $current = Get-GlobalVar -key $Key -defaultValue ''
    if ("$current" -ceq $Value) { return }
    Set-GlobalVar -key $Key -value $Value
}

function script:Save-TtsInstallMethodChoice {
    param(
        [string]$Engine,
        [string]$Method,
        [string]$Source,
        [string[]]$SupportedBackends
    )
    $upper = $Engine.ToUpperInvariant()
    Set-InstallMethodVarIfChanged -Key "TTS_${upper}_INSTALL_METHOD" -Value $Method
    Set-InstallMethodVarIfChanged -Key "TTS_${upper}_INSTALL_METHOD_SOURCE" -Value $Source
    Set-InstallMethodVarIfChanged -Key "TTS_${upper}_INSTALL_METHOD_BACKENDS" -Value ("v{0}:{1}" -f $script:INSTALL_METHOD_CONFIG_VERSION, ($SupportedBackends -join ' '))
}

function Save-TtsInstallBackend {
    param([string]$Engine, [string]$Backend)
    $upper = $Engine.ToUpperInvariant()
    Set-InstallMethodVarIfChanged -Key "TTS_${upper}_BACKEND" -Value $Backend
}

function script:Show-TtsInstallMethodMenu {
    param(
        [string]$Engine,
        [string[]]$Options,
        [int]$DefaultIndex,
        [string]$RecommendedBackend,
        [string]$RecommendationSource
    )
    Write-Host ''
    Write-Host '============================================================' -ForegroundColor Cyan
    Write-Host (" Install method for engine: {0} (platform: windows)" -f $Engine) -ForegroundColor Cyan
    Write-Host '============================================================' -ForegroundColor Cyan
    if ($RecommendedBackend -and $RecommendationSource) {
        Write-Host (" Recommendation: {0}" -f $RecommendedBackend) -ForegroundColor Yellow
        Write-Host ("   source: {0}" -f $RecommendationSource) -ForegroundColor DarkGray
    }
    for ($i = 0; $i -lt $Options.Count; $i++) {
        $tags = @()
        if ($Options[$i] -eq $RecommendedBackend) { $tags += 'recommended' }
        if ($i -eq $DefaultIndex) { $tags += 'default' }
        $tagText = if ($tags.Count -gt 0) { ' (' + ($tags -join ', ') + ')' } else { '' }
        Write-Host ("   [{0}] {1}{2}" -f ($i + 1), $Options[$i], $tagText)
    }
    Write-Host ' Keys: number/N/D/arrows = switch, Enter = confirm highlighted, B/Q = cancel (no write)' -ForegroundColor DarkGray
}

function script:Read-TtsInstallMethodChoice {
    param([string[]]$Options, [int]$DefaultIndex)
    $selected = $DefaultIndex
    $stopwatch = [System.Diagnostics.Stopwatch]::StartNew()
    while ($true) {
        $remaining = [int]($script:INSTALL_METHOD_TIMEOUT_SEC - $stopwatch.Elapsed.TotalSeconds)
        if ($remaining -lt 0) { $remaining = 0 }
        Write-Host ("`r Select [{0}] {1} -> auto-confirm in {2,2}s (Enter = confirm)   " -f ($selected + 1), $Options[$selected], $remaining) -NoNewline
        if ($remaining -le 0) { break }
        if (-not [Console]::KeyAvailable) { Start-Sleep -Milliseconds 200; continue }
        $keyInfo = [Console]::ReadKey($true)
        switch ($keyInfo.Key) {
            'Enter'     { Write-Host ''; return $selected }
            'LeftArrow' { $selected = if ($selected -gt 0) { $selected - 1 } else { $Options.Count - 1 } }
            'UpArrow'   { $selected = if ($selected -gt 0) { $selected - 1 } else { $Options.Count - 1 } }
            'RightArrow'{ $selected = ($selected + 1) % $Options.Count }
            'DownArrow' { $selected = ($selected + 1) % $Options.Count }
            default {
                $ch = [char]::ToLowerInvariant($keyInfo.KeyChar)
                if ($ch -eq 'b' -or $ch -eq 'q') {
                    Write-Host ''
                    Write-Host ' Cancelled; no install method was written.' -ForegroundColor DarkYellow
                    return -1
                }
                if ($ch -eq 'n' -or $ch -eq 'd') {
                    $want = if ($ch -eq 'n') { 'native' } else { 'docker' }
                    for ($i = 0; $i -lt $Options.Count; $i++) { if ($Options[$i] -eq $want) { $selected = $i } }
                }
                if ($ch -ge '1' -and $ch -le '9') {
                    $idx = [int]$ch - [int]'1'
                    if ($idx -ge 0 -and $idx -lt $Options.Count) { $selected = $idx }
                }
            }
        }
    }
    Write-Host ''
    return $selected
}

function Select-TtsInstallMethod {
    param(
        [Parameter(Mandatory = $true)][string]$Engine,
        [string[]]$SupportedBackends = @('native'),
        [string]$RecommendedBackend = '',
        [string]$RecommendationSource = '',
        [string]$DefaultBackend = 'native',
        [string]$Method = '',
        [switch]$Reselect
    )
    $upper = $Engine.ToUpperInvariant()
    if ($SupportedBackends -notcontains $DefaultBackend) {
        Write-Host ("[install-method] default '{0}' is not in the supported set for {1}" -f $DefaultBackend, $Engine) -ForegroundColor Red
        return $null
    }

    # 1) Explicit caller choice: validate, persist, return (no countdown).
    if ($Method) {
        if ($SupportedBackends -notcontains $Method) {
            Write-Host ("[install-method] explicit method '{0}' is not supported for {1} ({2})" -f $Method, $Engine, ($SupportedBackends -join ' ')) -ForegroundColor Red
            return $null
        }
        Save-TtsInstallMethodChoice -Engine $Engine -Method $Method -Source 'explicit' -SupportedBackends $SupportedBackends
        return $Method
    }

    # 2) Saved valid choice: reuse verbatim; never re-prompt, never rewrite.
    $saved = Get-GlobalVar -key "TTS_${upper}_INSTALL_METHOD" -defaultValue ''
    if (-not $Reselect -and $saved) {
        if ($SupportedBackends -contains "$saved") { return "$saved" }
        Write-Host ("[install-method] saved method '{0}' for {1} is no longer supported; re-selecting." -f $saved, $Engine) -ForegroundColor DarkYellow
    }

    # 2b) Single-option engines: no meaningful choice exists, so the only
    # supported backend is persisted directly (no countdown noise); mirrors
    # linux/common/install_method_common.sh branch 2b.
    if (-not $Reselect -and $SupportedBackends.Count -eq 1) {
        Save-TtsInstallMethodChoice -Engine $Engine -Method $DefaultBackend -Source 'timeout_default' -SupportedBackends $SupportedBackends
        return $DefaultBackend
    }

    # 3) First selection (or reselect): 20s monotonic countdown.
    if ([Console]::IsInputRedirected) {
        # No console input exists: apply the same 20s auto-default rule without
        # blocking forever and without consuming an upper menu's input.
        Write-Host ("[install-method] no interactive console; auto-selecting default '{0}' for {1} (20s rule, non-interactive)." -f $DefaultBackend, $Engine) -ForegroundColor DarkGray
        Save-TtsInstallMethodChoice -Engine $Engine -Method $DefaultBackend -Source 'timeout_default' -SupportedBackends $SupportedBackends
        return $DefaultBackend
    }

    $defaultIndex = [Array]::IndexOf($SupportedBackends, $DefaultBackend)
    if ($defaultIndex -lt 0) { $defaultIndex = 0 }
    Show-TtsInstallMethodMenu -Engine $Engine -Options $SupportedBackends -DefaultIndex $defaultIndex -RecommendedBackend $RecommendedBackend -RecommendationSource $RecommendationSource
    $chosenIndex = Read-TtsInstallMethodChoice -Options $SupportedBackends -DefaultIndex $defaultIndex
    if ($chosenIndex -lt 0) { return $null }
    $chosen = $SupportedBackends[$chosenIndex]
    $source = if ($chosen -eq $DefaultBackend) { 'timeout_default' } else { 'explicit' }
    Save-TtsInstallMethodChoice -Engine $Engine -Method $chosen -Source $source -SupportedBackends $SupportedBackends
    return $chosen
}
