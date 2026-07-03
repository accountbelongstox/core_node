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
    Extract and print the runtime behavior of a process (read-only forensic view).

.DESCRIPTION
    Resolves one or more processes by name or PID and prints, for each:
    image path + Authenticode signature + signer, command line, parent process,
    start time. With -Modules it lists loaded DLLs and flags non-Microsoft /
    non-Google unsigned modules (possible injection). With -Net it lists the
    process's active TCP connections. -All enables both.

    Pure PowerShell + CIM, no external tool required. Read-only: it never kills,
    suspends or changes anything. Some details (other users' command lines,
    cross-session modules) require an elevated shell.

.EXAMPLE
    procwatch.ps1 chrome
    procwatch.ps1 12345 -All
    procwatch.ps1 chrome -Modules -Net
#>

[CmdletBinding()]
param(
    [Parameter(Position = 0)]
    [string]$Target,
    [switch]$Modules,
    [switch]$Net,
    [switch]$All
)

$ErrorActionPreference = 'Stop'

# --- Configuration (declared at top) ----------------------------------------
$trustedCompanyTokens = @('Microsoft', 'Google', 'Windows')
$showModules = $Modules -or $All
$showNet     = $Net -or $All
$netCmdAvailable = [bool](Get-Command Get-NetTCPConnection -ErrorAction SilentlyContinue)
$targetProcs = @()

function Write-Line {
    param([string]$Message, [string]$Color = 'Gray')
    Write-Host $Message -ForegroundColor $Color
}

function Get-SignatureLabel {
    param([string]$Path)
    if (-not $Path -or -not (Test-Path $Path)) { return 'unknown (no path)' }
    try {
        $sig = Get-AuthenticodeSignature -FilePath $Path -ErrorAction Stop
        $signer = if ($sig.SignerCertificate) { $sig.SignerCertificate.Subject -replace '^CN=([^,]+).*', '$1' } else { 'none' }
        return ("{0} | signer={1}" -f $sig.Status, $signer)
    } catch {
        return 'unverifiable'
    }
}

function Test-TrustedCompany {
    param([string]$Company)
    if (-not $Company) { return $false }
    foreach ($t in $trustedCompanyTokens) { if ($Company -like "*$t*") { return $true } }
    return $false
}

if (-not $Target) {
    Write-Line "Usage: procwatch.ps1 <name|pid> [-Modules] [-Net] [-All]" 'Yellow'
    Write-Line "Example: procwatch.ps1 chrome -All" 'Yellow'
    exit 1
}

# Resolve target processes by PID (all digits) or by name (wildcard, .exe stripped).
if ($Target -match '^\d+$') {
    $proc = Get-Process -Id ([int]$Target) -ErrorAction SilentlyContinue
    if ($proc) { $targetProcs = @($proc) }
} else {
    $namePattern = ($Target -replace '\.exe$', '')
    $targetProcs = @(Get-Process -Name $namePattern -ErrorAction SilentlyContinue)
}

if (-not $targetProcs -or $targetProcs.Count -eq 0) {
    Write-Line "No process matched '$Target'." 'Red'
    exit 1
}

Write-Line ('=' * 78) 'Cyan'
Write-Line ("procwatch | target='{0}' | matches={1} | net={2} | modules={3}" -f $Target, $targetProcs.Count, $showNet, $showModules) 'Cyan'

foreach ($p in $targetProcs) {
    $cim = Get-CimInstance Win32_Process -Filter ("ProcessId={0}" -f $p.Id) -ErrorAction SilentlyContinue
    $imagePath = if ($cim -and $cim.ExecutablePath) { $cim.ExecutablePath } else { $p.Path }
    $cmdLine   = if ($cim) { $cim.CommandLine } else { '(unavailable)' }
    $parentId  = if ($cim) { $cim.ParentProcessId } else { 0 }
    $parentProc = if ($parentId) { Get-Process -Id $parentId -ErrorAction SilentlyContinue } else { $null }
    $parentName = if ($parentProc) { $parentProc.ProcessName } else { '(gone)' }
    $startTime = try { $p.StartTime } catch { $null }

    Write-Line ('-' * 78) 'DarkCyan'
    Write-Line ("[{0}] PID {1}" -f $p.ProcessName, $p.Id) 'White'
    Write-Line ("  image    : {0}" -f $imagePath)
    Write-Line ("  signature: {0}" -f (Get-SignatureLabel $imagePath))
    Write-Line ("  parent   : {0} (PID {1})" -f $parentName, $parentId)
    Write-Line ("  started  : {0}" -f $(if ($startTime) { $startTime } else { '(unavailable)' }))
    Write-Line ("  cmdline  : {0}" -f $cmdLine)

    if ($showModules) {
        Write-Line "  modules (non-Microsoft/Google, flagged if unsigned):" 'Yellow'
        $flagged = 0
        try {
            foreach ($m in $p.Modules) {
                if (Test-TrustedCompany $m.Company) { continue }
                $modSig = Get-SignatureLabel $m.FileName
                $mark = if ($modSig -notlike 'Valid*') { '[!]' } else { '   ' }
                Write-Line ("    {0} {1}  ({2})  {3}" -f $mark, $m.ModuleName, $($m.Company), $modSig)
                $flagged++
            }
        } catch {
            Write-Line "    (module list requires an elevated shell for this process)" 'DarkYellow'
        }
        if ($flagged -eq 0) { Write-Line "    (none - all loaded modules are Microsoft/Google)" 'Green' }
    }

    if ($showNet) {
        Write-Line "  tcp connections:" 'Yellow'
        if ($netCmdAvailable) {
            $conns = @(Get-NetTCPConnection -OwningProcess $p.Id -ErrorAction SilentlyContinue)
            if ($conns.Count -eq 0) {
                Write-Line "    (none)" 'Green'
            } else {
                foreach ($c in $conns) {
                    Write-Line ("    {0}:{1} -> {2}:{3}  {4}" -f $c.LocalAddress, $c.LocalPort, $c.RemoteAddress, $c.RemotePort, $c.State)
                }
            }
        } else {
            Write-Line "    (Get-NetTCPConnection not available on this host)" 'DarkYellow'
        }
    }
}

Write-Line ('=' * 78) 'Cyan'
exit 0
