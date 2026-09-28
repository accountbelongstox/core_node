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

    Packages come from the central Python package policy and install before startup.
    The book processor degrades gracefully when a backend is absent, so this
    script is NON-FATAL: a missing optional package only disables that one format.

    IDEMPOTENT: one pip metadata snapshot installs only the missing set.

.PARAMETER Python
    Path to the python.exe to install into. Default: 'python' on PATH.

.PARAMETER Force
    Accepted for compatibility; installed packages are preserved.
#>
[CmdletBinding()]
param(
    [string]$Python = 'python',
    [switch]$Force
)

$ErrorActionPreference = 'Stop'

$winCommonDir = Join-Path (Split-Path $PSScriptRoot -Parent) 'win_common'
. (Join-Path $winCommonDir 'GlobalVars.ps1')
. (Join-Path $winCommonDir 'PythonDependencyMapInstallCommon.ps1')
$Python = $Global:PYTHON_EXE_PATH

Write-Host '============================================================' -ForegroundColor Cyan
Write-Host ' Installing document-parsing libraries (Books ingest)' -ForegroundColor Cyan
Write-Host '============================================================' -ForegroundColor Cyan
Write-Host ("  python : {0}" -f $Python) -ForegroundColor DarkGray

Install-PycorePolicySet -Set 'document' -PythonExe $Python -PipExe $Global:PIP_EXE_PATH -LogPrefix '[document-parsing]'

# Non-fatal by design: a degraded format set still lets the service run.
Write-Host '[OK] document-parsing prerequisites complete.' -ForegroundColor Green
