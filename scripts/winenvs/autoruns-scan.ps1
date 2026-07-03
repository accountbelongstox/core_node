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
    Audit autostart / persistence entries with Sysinternals autorunsc and print
    the third-party (non-Microsoft) ones, with signature status.

.DESCRIPTION
    Headless wrapper around autorunsc (installed by Step32_InstallSecurityTools).
    By default it hides verified Microsoft entries and verifies signatures, so the
    output focuses on the autostart hooks a PUP/malware would actually use (Run
    keys, services, scheduled tasks, image-hijacks, etc.). Use -AllEntries to
    include Microsoft entries. Read-only: it only reports, never changes autostarts.

.EXAMPLE
    autoruns-scan.ps1
    autoruns-scan.ps1 -AllEntries
    autoruns-scan.ps1 -OutCsv D:\.tmp\autoruns.csv
#>

[CmdletBinding()]
param(
    [string]$OutCsv,
    [switch]$AllEntries
)

$ErrorActionPreference = 'Stop'

# --- Configuration (declared at top) ----------------------------------------
$autorunscName = 'autorunsc.exe'
$candidateDirs = @(
    (Join-Path $env:SystemDrive '.dev_win10\Sysinternals'),
    'D:\.dev_win10\Sysinternals',
    'D:\.dev_win11\Sysinternals',
    'C:\.dev_win10\Sysinternals'
)
$eulaKey      = 'HKCU:\Software\Sysinternals\Autoruns'
$autorunscExe = $null
$autorunArgs  = @('-accepteula', '-nobanner', '-a', '*', '-s', '-h', '-c')

function Write-Line {
    param([string]$Message, [string]$Color = 'Gray')
    Write-Host $Message -ForegroundColor $Color
}

function Resolve-Autorunsc {
    $cmd = Get-Command $autorunscName -ErrorAction SilentlyContinue
    if ($cmd) { return $cmd.Source }
    foreach ($dir in $candidateDirs) {
        $candidate = Join-Path $dir $autorunscName
        if (Test-Path $candidate) { return $candidate }
    }
    return $null
}

$autorunscExe = Resolve-Autorunsc
if (-not $autorunscExe) {
    Write-Line "autorunsc not found. Run the installer (Step32_InstallSecurityTools) first." 'Red'
    exit 1
}

# Pre-accept EULA so the GUI dialog never blocks the scan.
if (-not (Test-Path $eulaKey)) { New-Item -Path $eulaKey -Force | Out-Null }
Set-ItemProperty -Path $eulaKey -Name 'EulaAccepted' -Value 1 -Type DWord

# -m hides verified Microsoft entries (default focus on third-party autostarts).
if (-not $AllEntries) { $autorunArgs += '-m' }

Write-Line ('=' * 78) 'Cyan'
Write-Line ("autoruns-scan | tool='{0}' | scope={1}" -f $autorunscExe, $(if ($AllEntries) { 'all' } else { 'non-Microsoft' })) 'Cyan'
Write-Line "Scanning autostart locations (this can take a minute)..." 'Yellow'

# autorunsc emits CSV on stdout; capture it.
$csvText = & $autorunscExe @autorunArgs 2>$null

if ($OutCsv) {
    Set-Content -Path $OutCsv -Value $csvText -Encoding UTF8
    Write-Line ("CSV written: {0}" -f $OutCsv) 'Green'
}

try {
    $rows = $csvText | ConvertFrom-Csv -ErrorAction Stop
    Write-Line ('-' * 78) 'DarkCyan'
    Write-Line ("Entries: {0}" -f $rows.Count) 'White'
    foreach ($r in $rows) {
        $entry  = $r.'Entry'
        $img    = $r.'Image Path'
        $signer = $r.'Signer'
        $cat    = $r.'Category'
        $mark   = if ($signer -and ($signer -like '*(Verified)*')) { '   ' } else { '[!]' }
        Write-Line ("  {0} [{1}] {2}" -f $mark, $cat, $entry) 'White'
        if ($img)    { Write-Line ("        image : {0}" -f $img) }
        if ($signer) { Write-Line ("        signer: {0}" -f $signer) }
    }
    Write-Line ('-' * 78) 'DarkCyan'
    Write-Line "[!] = unsigned or unverified publisher (review first)." 'Yellow'
} catch {
    Write-Line "Could not parse autorunsc output; raw text follows:" 'DarkYellow'
    Write-Host $csvText
}

Write-Line ('=' * 78) 'Cyan'
exit 0
