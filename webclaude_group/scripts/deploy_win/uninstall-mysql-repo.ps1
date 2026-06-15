#Requires -Version 5.1
#Requires -RunAsAdministrator
<#
.SYNOPSIS
    Removes MySQL wrongly installed under the repository (repo\mysql), not D:\.dev_win10\mysql.

.EXAMPLE
    .\uninstall-mysql-repo.ps1
#>

param([string]$RepoRoot = "")

Set-StrictMode -Version Latest

$SERVICE_NAME = "MySQL"
$ScriptDir = Split-Path -Parent $MyInvocation.MyCommand.Definition
if (-not $RepoRoot) { $RepoRoot = $env:WEBCLAUDE_SERVICE_ROOT }
if (-not $RepoRoot -or -not (Test-Path -LiteralPath $RepoRoot)) {
    Write-Host "  [FAIL] Pass -RepoRoot <service-repo> or set WEBCLAUDE_SERVICE_ROOT." -ForegroundColor Red
    exit 1
}
$RepoRoot = (Resolve-Path -LiteralPath $RepoRoot).Path
$RepoMysql = Join-Path $RepoRoot "mysql"
$MysqldExe = Join-Path $RepoMysql "bin\mysqld.exe"

function Write-Ok([string]$t) { Write-Host "  [OK]   $t" -ForegroundColor Green }
function Write-Info([string]$t) { Write-Host "  [INFO] $t" -ForegroundColor Yellow }
function Write-Warn([string]$t) { Write-Host "  [WARN] $t" -ForegroundColor DarkYellow }
function Write-Fail([string]$t) { Write-Host "  [FAIL] $t" -ForegroundColor Red }

function Get-MySQLServiceImagePath {
    $w = Get-WmiObject Win32_Service -Filter "Name='$SERVICE_NAME'" -ErrorAction SilentlyContinue
    if (-not $w) { return "" }
    $p = $w.PathName.Trim()
    if ($p.Length -ge 2 -and $p[0] -eq [char]34) {
        $end = $p.IndexOf([char]34, 1)
        if ($end -gt 1) { return $p.Substring(1, $end - 1) }
    }
    $ix = $p.IndexOf(".exe", [System.StringComparison]::OrdinalIgnoreCase)
    if ($ix -ge 0) { return $p.Substring(0, $ix + 4).Trim() }
    return $p
}

Write-Host ""
Write-Host "  Uninstall MySQL under repository (wrong path)" -ForegroundColor Magenta
Write-Host "  Target folder: $RepoMysql" -ForegroundColor Gray
Write-Host ""

if (-not (Test-Path $RepoMysql)) {
    Write-Info "Folder does not exist, nothing to do."
    Write-Host ""
    return
}

if (-not (Test-Path $MysqldExe)) {
    Write-Warn "No bin\mysqld.exe under repo mysql - removing folder only."
    $yn = Read-Host "Delete entire folder? [Y/n]"
    if ($yn -ne "" -and $yn -notmatch "^[Yy]") {
        Write-Info "Cancelled."
        Write-Host ""
        return
    }
    Remove-Item -LiteralPath $RepoMysql -Recurse -Force -ErrorAction SilentlyContinue
    if (Test-Path $RepoMysql) { Write-Fail "Could not remove (files in use?)." } else { Write-Ok "Folder removed." }
    Write-Host ""
    return
}

$yn2 = Read-Host "Stop/remove Windows service if it uses this mysqld, then delete repo\mysql? [Y/n]"
if ($yn2 -ne "" -and $yn2 -notmatch "^[Yy]") {
    Write-Info "Cancelled."
    Write-Host ""
    return
}

$repoNorm = [System.IO.Path]::GetFullPath($RepoMysql)
$binNorm = [System.IO.Path]::GetFullPath((Join-Path $RepoMysql "bin"))
$img = Get-MySQLServiceImagePath
$svc = Get-Service -Name $SERVICE_NAME -ErrorAction SilentlyContinue

if ($img -ne "" -and $svc) {
    $imgNorm = [System.IO.Path]::GetFullPath($img)
    $imgBin = [System.IO.Path]::GetFullPath((Split-Path $imgNorm -Parent))
    if ($imgBin -ieq $binNorm) {
        if ($svc.Status -eq "Running") {
            Write-Info "Stopping service '$SERVICE_NAME' ..."
            Stop-Service -Name $SERVICE_NAME -Force -ErrorAction SilentlyContinue
            Start-Sleep -Seconds 2
        }
        Write-Info "Removing service via: $MysqldExe --remove $SERVICE_NAME"
        & $MysqldExe --remove $SERVICE_NAME 2>&1 | ForEach-Object { Write-Host "    $_" -ForegroundColor DarkGray }
        Start-Sleep -Seconds 2
        Write-Ok "Service removed."
    } else {
        Write-Warn "Service '$SERVICE_NAME' uses another binary: $imgNorm"
        Write-Warn "Not calling --remove on repo mysqld (would be wrong instance)."
    }
} elseif ($svc -and $img -eq "") {
    Write-Warn "Service exists but could not read image path; stopping service if running."
    if ($svc.Status -eq "Running") {
        Stop-Service -Name $SERVICE_NAME -Force -ErrorAction SilentlyContinue
        Start-Sleep -Seconds 2
    }
}

Write-Info "Removing folder: $RepoMysql"
Remove-Item -LiteralPath $RepoMysql -Recurse -Force -ErrorAction SilentlyContinue
if (Test-Path $RepoMysql) {
    Write-Fail "Could not remove folder (files in use?). Close clients and retry."
} else {
    Write-Ok "Repository mysql folder removed."
    Write-Info "Install MySQL to the fixed path with: .\install-mysql.ps1 -RepoRoot <service-repo>"
}
Write-Host ""
