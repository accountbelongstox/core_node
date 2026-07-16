# ### AI SPECIAL ATTENTION RULES START ###
# Write all code in English only. Do not modify these rules.
# ### AI SPECIAL ATTENTION RULES END ###

# Shared setuptools / pkg_resources guard for the iniscripts installers -- the ONE
# shell-side source of truth (mirrored by setuptools_guard.sh).
#
# setuptools 81 REMOVED the bundled `pkg_resources`. Legacy packages still import it
# at load time (e.g. librosa 0.9.1 pulled in by MeloTTS does
# `from pkg_resources import resource_filename`) -> ModuleNotFoundError: No module
# named 'pkg_resources'. setuptools>=81 also violates torch (needs setuptools<82) and
# faradaysec (needs setuptools<81,>=61). Pinning setuptools<81 (last line that ships
# pkg_resources, resolves to 80.10.2) fixes all three at once and is the remedy the
# deprecation warning itself recommends ("pin to Setuptools<81").
#
# Idempotent: only pins when pkg_resources is actually missing, so a healthy env is a
# cheap no-op. This is NOT an installer (never auto-run). Dot-source it:
#     . (Join-Path $PSScriptRoot 'setuptools_guard.ps1')
#     Ensure-PkgResources -Py $resolvedPython

function Ensure-PkgResources {
    param([string]$Py)
    if (-not $Py) { return $false }
    $prevEap = $ErrorActionPreference
    $ErrorActionPreference = 'Continue'
    $out = (& $Py -c "import pkg_resources; print('__FOUND__')" 2>$null) -join ''
    $ErrorActionPreference = $prevEap
    if ($out -match '__FOUND__') { return $true }
    Write-Host "[setuptools-guard] pkg_resources missing (setuptools>=81 removed it) -> pinning setuptools<81 ..." -ForegroundColor Yellow
    try { & $Py -m pip install --upgrade 'setuptools<81' } catch { }
    $prevEap = $ErrorActionPreference
    $ErrorActionPreference = 'Continue'
    $out = (& $Py -c "import pkg_resources; print('__FOUND__')" 2>$null) -join ''
    $ErrorActionPreference = $prevEap
    if ($out -match '__FOUND__') {
        Write-Host "[setuptools-guard] [OK] pkg_resources restored (setuptools<81)." -ForegroundColor Green
        return $true
    }
    Write-Host "[setuptools-guard] [!] pkg_resources still unavailable after pinning setuptools<81." -ForegroundColor DarkYellow
    return $false
}
