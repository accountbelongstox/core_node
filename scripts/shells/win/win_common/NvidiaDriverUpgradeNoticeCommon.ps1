# Shared NVIDIA driver upgrade notice (evidence-driven, idempotent).
#
# pycore service processes have been hard-killed by nvcuda64.dll access
# violations (WER APPCRASH c0000005): a native crash bypasses Python entirely,
# so the console shows no traceback and no shutdown lines - the service just
# disappears. Code-side isolation (memory_gate nvidia-smi probe, lazy torch)
# bounds the blast radius, but the driver itself still needs a manual upgrade.
#
# Dot-source this file and call Invoke-NvidiaDriverUpgradeNotice from any
# script; it watches Windows Error Reporting for nvcuda*.dll crashes inside a
# recent window and prints upgrade guidance. Idempotency: the notice is
# recorded per (driver version, latest crash timestamp) in a global var, so a
# re-run stays silent until the driver version changes or a NEWER nvcuda
# crash appears. GPU-less hosts are skipped via the shared CUDA policy
# (CudaIndex.ps1 -> Test-NvidiaGpuPresent / Get-CudaRuntimePolicy).
#
# It never installs anything. Manual upgrade: https://www.nvidia.com/Download/index.aspx
# Skip switch: NVIDIA_DRIVER_NOTICE_SKIP=1

. (Join-Path $PSScriptRoot 'GlobalVars.ps1')
. (Join-Path $PSScriptRoot 'CudaIndex.ps1')

$script:NvidiaDriverNoticeVarKey = 'NVIDIA_DRIVER_UPGRADE_NOTICE'
$script:NvidiaDriverNoticeCrashWindowDays = 14
$script:NvidiaDriverNoticeDownloadUrl = 'https://www.nvidia.com/Download/index.aspx'

function Invoke-NvidiaDriverUpgradeNotice {
    param(
        [string]$Prefix = '[nvidia-driver-notice]'
    )

    $gpuPresent     = $false
    $policy         = $null
    $nvidiaSmi      = $null
    $driverOut      = $null
    $driverVersion  = ''
    $werEvents      = @()
    $nvcudaCrashes  = @()
    $werEvent       = $null
    $latestCrash    = $null
    $latestCrashUtc = ''
    $markerStamp    = ''
    $marker         = ''

    if ($env:NVIDIA_DRIVER_NOTICE_SKIP -eq '1') {
        Write-Host "$Prefix [i] NVIDIA_DRIVER_NOTICE_SKIP=1 -> skipping." -ForegroundColor DarkGray
        return $false
    }

    # Shared GPU state from the common CUDA policy library (no private probing).
    $gpuPresent = Test-NvidiaGpuPresent
    if (-not $gpuPresent) {
        Write-Host "$Prefix [i] no NVIDIA GPU (shared CUDA policy) -> skipping." -ForegroundColor DarkGray
        return $false
    }
    $policy = Get-CudaRuntimePolicy

    $nvidiaSmi = Resolve-NvidiaSmiExe
    if ($nvidiaSmi) {
        $driverOut = & $nvidiaSmi --query-gpu=driver_version --format=csv,noheader 2>$null
        $driverVersion = ("$driverOut" -split "`n" | Select-Object -First 1)
        $driverVersion = "$driverVersion".Trim()
    }
    Write-Host ("$Prefix  driver: {0}; CUDA policy: Enabled={1} Tag={2} Reason={3}" -f `
        $(if ($driverVersion) { $driverVersion } else { 'unknown' }), `
        $policy.Enabled, $(if ($policy.Tag) { $policy.Tag } else { '-' }), `
        $(if ($policy.Reason) { $policy.Reason } else { '-' })) -ForegroundColor DarkGray

    # Crash evidence: WER APPCRASH entries whose faulting module is nvcuda*.dll.
    try {
        $werEvents = @(Get-WinEvent -FilterHashtable @{
            LogName      = 'Application'
            ProviderName = 'Windows Error Reporting'
            StartTime    = (Get-Date).AddDays(-$script:NvidiaDriverNoticeCrashWindowDays)
        } -MaxEvents 500 -ErrorAction Stop)
    } catch {
        $werEvents = @()
    }
    foreach ($werEvent in $werEvents) {
        if ("$($werEvent.Message)".IndexOf('nvcuda', [System.StringComparison]::OrdinalIgnoreCase) -ge 0) {
            $nvcudaCrashes += $werEvent
        }
    }

    if ($nvcudaCrashes.Count -eq 0) {
        Write-Host "$Prefix [OK] no nvcuda*.dll crashes in the last $script:NvidiaDriverNoticeCrashWindowDays days; driver looks stable." -ForegroundColor Green
        return $false
    }

    $latestCrash = $nvcudaCrashes | Sort-Object TimeCreated | Select-Object -Last 1
    $latestCrashUtc = $latestCrash.TimeCreated.ToUniversalTime().ToString('o')
    Write-Host ("$Prefix [!] {0} nvcuda*.dll crash(es) in the last {1} days; latest: {2} local" -f `
        $nvcudaCrashes.Count, $script:NvidiaDriverNoticeCrashWindowDays, $latestCrash.TimeCreated) -ForegroundColor Yellow

    # Idempotency marker: one notice per (driver version, latest crash) state.
    $markerStamp = ('driver={0};crash={1}' -f $driverVersion, $latestCrashUtc)
    $marker = Get-GlobalVar -key $script:NvidiaDriverNoticeVarKey -defaultValue ''
    if ($marker -eq $markerStamp) {
        Write-Host "$Prefix [idempotent] notice already shown for this driver/crash state -> skipping." -ForegroundColor DarkGray
        return $false
    }

    Write-Host "$Prefix [!] ACTION: upgrade the NVIDIA driver (current: $(if ($driverVersion) { $driverVersion } else { 'unknown' }))." -ForegroundColor Yellow
    Write-Host "$Prefix     nvcuda64.dll crashes kill python processes without any console message." -ForegroundColor Yellow
    Write-Host "$Prefix     Download: $script:NvidiaDriverNoticeDownloadUrl  (install, reboot, this notice clears itself)" -ForegroundColor Cyan
    Set-GlobalVar -Key $script:NvidiaDriverNoticeVarKey -Value $markerStamp | Out-Null
    return $true
}
