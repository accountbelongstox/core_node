#Requires -Version 5.1
#Requires -RunAsAdministrator
<#
.SYNOPSIS
    Removes Redis installed under the repository (repo\redis). Use before installing to a fixed path.

.EXAMPLE
    .\uninstall-redis-repo.ps1
#>

param([string]$RepoRoot = "")

Set-StrictMode -Version Latest

$SERVICE_NAME = "Redis"
$ScriptDir = Split-Path -Parent $MyInvocation.MyCommand.Definition
if (-not $RepoRoot) { $RepoRoot = $env:WEBCLAUDE_SERVICE_ROOT }
if (-not $RepoRoot -or -not (Test-Path -LiteralPath $RepoRoot)) {
    Write-Host "  [FAIL] Pass -RepoRoot <service-repo> or set WEBCLAUDE_SERVICE_ROOT." -ForegroundColor Red
    exit 1
}
$RepoRoot = (Resolve-Path -LiteralPath $RepoRoot).Path
$RepoRedis = Join-Path $RepoRoot "redis"
$RedisServerExe = Join-Path $RepoRedis "redis-server.exe"

function Write-Ok([string]$t) { Write-Host "  [OK]   $t" -ForegroundColor Green }
function Write-Info([string]$t) { Write-Host "  [INFO] $t" -ForegroundColor Yellow }
function Write-Warn([string]$t) { Write-Host "  [WARN] $t" -ForegroundColor DarkYellow }
function Write-Fail([string]$t) { Write-Host "  [FAIL] $t" -ForegroundColor Red }

function Get-RedisServiceImagePath {
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

function Remove-RepoRedisFromMachinePath {
    $dirNorm = [System.IO.Path]::GetFullPath($RepoRedis).TrimEnd('\')
    $cur = [System.Environment]::GetEnvironmentVariable("Path", "Machine")
    if ([string]::IsNullOrEmpty($cur)) { return }
    $keep = New-Object System.Collections.Generic.List[string]
    foreach ($seg in ($cur -split ';')) {
        if ([string]::IsNullOrWhiteSpace($seg)) { continue }
        try {
            $n = [System.IO.Path]::GetFullPath($seg.Trim()).TrimEnd('\')
            if ($n -ieq $dirNorm) { continue }
        } catch { }
        [void]$keep.Add($seg.Trim())
    }
    $newPath = [string]::Join(';', $keep)
    [System.Environment]::SetEnvironmentVariable("Path", $newPath, "Machine")
    $env:Path = [System.Environment]::GetEnvironmentVariable("Path", "Machine") + ";" + [System.Environment]::GetEnvironmentVariable("Path", "User")
    Write-Info "Removed repo redis from Machine PATH (if present)."
}

Write-Host ""
Write-Host "  Uninstall Redis under repository (repo\redis)" -ForegroundColor Magenta
Write-Host "  Target folder: $RepoRedis" -ForegroundColor Gray
Write-Host ""

if (-not (Test-Path $RepoRedis)) {
    Write-Info "Folder does not exist, nothing to do."
    Write-Host ""
    return
}

if (-not (Test-Path $RedisServerExe)) {
    Write-Warn "No redis-server.exe in repo redis - removing folder only."
    $yn = Read-Host "Delete entire folder? [Y/n]"
    if ($yn -ne "" -and $yn -notmatch "^[Yy]") {
        Write-Info "Cancelled."
        Write-Host ""
        return
    }
    Remove-RepoRedisFromMachinePath
    Remove-Item -LiteralPath $RepoRedis -Recurse -Force -ErrorAction SilentlyContinue
    if (Test-Path $RepoRedis) { Write-Fail "Could not remove (files in use?)." } else { Write-Ok "Folder removed." }
    Write-Host ""
    return
}

$yn2 = Read-Host "Stop/uninstall Windows service if it uses this redis-server.exe, remove PATH entry, then delete repo\redis? [Y/n]"
if ($yn2 -ne "" -and $yn2 -notmatch "^[Yy]") {
    Write-Info "Cancelled."
    Write-Host ""
    return
}

$repoNorm = [System.IO.Path]::GetFullPath($RepoRedis)
$img = Get-RedisServiceImagePath
$svc = Get-Service -Name $SERVICE_NAME -ErrorAction SilentlyContinue

if ($img -ne "" -and $svc) {
    $imgNorm = [System.IO.Path]::GetFullPath($img)
    $exeNorm = [System.IO.Path]::GetFullPath($RedisServerExe)
    if ($imgNorm -ieq $exeNorm) {
        if ($svc.Status -eq "Running") {
            Write-Info "Stopping service '$SERVICE_NAME' ..."
            & $RedisServerExe --service-stop --service-name $SERVICE_NAME 2>&1 | ForEach-Object { Write-Host "    $_" -ForegroundColor DarkGray }
            Start-Sleep -Seconds 2
        }
        Write-Info "Uninstalling service: $RedisServerExe --service-uninstall --service-name $SERVICE_NAME"
        & $RedisServerExe --service-uninstall --service-name $SERVICE_NAME 2>&1 | ForEach-Object { Write-Host "    $_" -ForegroundColor DarkGray }
        Start-Sleep -Seconds 2
        Write-Ok "Service uninstalled."
    } else {
        Write-Warn "Service '$SERVICE_NAME' uses another binary: $imgNorm"
        Write-Warn "Not calling --service-uninstall on repo redis-server (wrong instance)."
    }
} elseif ($svc -and $img -eq "") {
    Write-Warn "Service exists but image path unknown; stopping if running."
    if ($svc.Status -eq "Running") {
        Stop-Service -Name $SERVICE_NAME -Force -ErrorAction SilentlyContinue
        Start-Sleep -Seconds 2
    }
}

Remove-RepoRedisFromMachinePath

Write-Info "Removing folder: $RepoRedis"
Remove-Item -LiteralPath $RepoRedis -Recurse -Force -ErrorAction SilentlyContinue
if (Test-Path $RepoRedis) {
    Write-Fail "Could not remove folder (files in use?). Close clients and retry."
} else {
    Write-Ok "Repository redis folder removed."
    Write-Info "Install Redis to the desired path with: .\install-redis.ps1 -RepoRoot <service-repo>"
}
Write-Host ""
