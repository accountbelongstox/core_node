<#
.SYNOPSIS
    Prerequisite installer for the Books / document ingest pipeline (Windows).

.DESCRIPTION
    Invoked sequentially by PreparePycorePrerequisites.ps1 (pyservice; Step scripts never call siblings).
    Installs the libraries pycore uses to extract
    plain text from arbitrary document formats for the Books "sentence source"
    feature (pycore.callmodule.services.processors.book_processor):

        pdfplumber     -> .pdf
        python-docx    -> .docx
        beautifulsoup4 -> .html/.htm/.epub  (lxml speeds it up)
        ebooklib       -> .epub   (optional; stdlib zip fallback exists)
        striprtf       -> .rtf    (optional; regex fallback exists)

    Legacy binary .doc is read at run time via Word COM automation when Microsoft
    Word + pywin32 are present (pywin32 already ships in this env); no install is
    needed here and .doc is simply skipped when Word is unavailable.

    These python libs are also auto-installable lazily by third_party.py, but
    installing them up front means the FIRST analyze/sync does not stall on pip.
    The book processor degrades gracefully when a backend is absent, so this
    script is NON-FATAL: a missing optional package only disables that one format.

    IDEMPOTENT: each package is skipped when it already imports.

.PARAMETER Python
    Path to the python.exe to install into. Default: 'python' on PATH.

.PARAMETER Force
    Reinstall even if the packages already import.
#>
[CmdletBinding()]
param(
    [string]$Python = 'python',
    [switch]$Force
)

$ErrorActionPreference = 'Stop'

$winCommonDir = Join-Path (Split-Path $PSScriptRoot -Parent) 'win_common'
. (Join-Path $winCommonDir 'GlobalVars.ps1')
$Python = $Global:PYTHON_EXE_PATH

# import-name -> pip package (import name may differ from the PyPI name).
$Packages = @(
    @{ Module = 'pdfplumber'; Pip = 'pdfplumber' },
    @{ Module = 'docx';       Pip = 'python-docx' },
    @{ Module = 'bs4';        Pip = 'beautifulsoup4' },
    @{ Module = 'lxml';       Pip = 'lxml' },
    @{ Module = 'ebooklib';   Pip = 'ebooklib' },
    @{ Module = 'striprtf';   Pip = 'striprtf' },
    @{ Module = 'multipart';  Pip = 'python-multipart' }
)

function Test-PyModule {
    param([string]$Py, [string]$Module)
    $code = "import importlib.util`ntry:`n    ok = importlib.util.find_spec('$Module') is not None`nexcept Exception:`n    ok = False`nprint('__FOUND__' if ok else '__MISSING__')"
    $prevEap = $ErrorActionPreference
    $ErrorActionPreference = 'Continue'
    $out = (& $Py -c $code 2>$null) -join ''
    $ErrorActionPreference = $prevEap
    return ($out -match '__FOUND__')
}

function Invoke-Pip {
    # Detection of whether the package actually installed is done by the caller
    # via Test-PyModule (module import check), not by the pip exit code.
    param([string[]]$PipArgs)
    try {
        & $Global:PIP_EXE_PATH install @PipArgs
        return $true
    } catch {
        Write-Host ("[!] pip threw: {0}" -f $_.Exception.Message) -ForegroundColor DarkYellow
        return $false
    }
}

Write-Host '============================================================' -ForegroundColor Cyan
Write-Host ' Installing document-parsing libraries (Books ingest)' -ForegroundColor Cyan
Write-Host '============================================================' -ForegroundColor Cyan
Write-Host ("  python : {0}" -f $Python) -ForegroundColor DarkGray

foreach ($pkg in $Packages) {
    if ((Test-PyModule -Py $Python -Module $pkg.Module) -and -not $Force) {
        Write-Host ("[OK] {0} already installed; skipping." -f $pkg.Pip) -ForegroundColor Green
        continue
    }
    Write-Host ("[..] pip install {0} ..." -f $pkg.Pip) -ForegroundColor Yellow
    $ok = Invoke-Pip -PipArgs @($pkg.Pip)
    if ($ok -and (Test-PyModule -Py $Python -Module $pkg.Module)) {
        Write-Host ("[OK] {0} installed." -f $pkg.Pip) -ForegroundColor Green
    } else {
        Write-Host ("[!] {0} install failed (optional); that format degrades to a fallback." -f $pkg.Pip) -ForegroundColor DarkYellow
    }
}

# Non-fatal by design: a degraded format set still lets the service run.
Write-Host '[OK] document-parsing prerequisites complete.' -ForegroundColor Green
exit 0
