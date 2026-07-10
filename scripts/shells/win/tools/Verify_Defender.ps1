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
    Verify the effective Microsoft Defender state written by Step19_DV.ps1.
    Reads the LIVE registry policy values + Defender runtime status (NOT the
    gpedit.msc store, which would falsely show "Not Configured" for keys set
    directly in the registry). Pops up a grid UI by default; -NoGui prints a table.
#>

param(
    [switch]$NoGui
)

# =============================================================================
# VARIABLES (declared at the beginning of the file)
# =============================================================================
$GP_DEFENDER    = "HKLM:\SOFTWARE\Policies\Microsoft\Windows Defender"
$GP_RTP         = Join-Path $GP_DEFENDER "Real-Time Protection"
$GP_SPYNET      = Join-Path $GP_DEFENDER "Spynet"
$GP_REPORTING   = Join-Path $GP_DEFENDER "Reporting"
$GP_MPENGINE    = Join-Path $GP_DEFENDER "MpEngine"
$GP_NETPROTECT  = Join-Path $GP_DEFENDER "Windows Defender Exploit Guard\Network Protection"
$GP_SYSTEM      = "HKLM:\SOFTWARE\Policies\Microsoft\Windows\System"
$GP_MRT         = "HKLM:\SOFTWARE\Policies\Microsoft\MRT"
$SvcRoot        = "HKLM:\SYSTEM\CurrentControlSet\Services"
$DefenderTaskPath = "\Microsoft\Windows\Windows Defender\"

$DefenderModuleOk = [bool](Get-Command Get-MpPreference -ErrorAction SilentlyContinue)
$Results          = New-Object System.Collections.Generic.List[object]
$compStatus       = $null
$prefStatus       = $null

# Expected policy values (must match Step19_DV.ps1).
$ExpectedPolicies = @(
    [pscustomobject]@{ Path = $GP_DEFENDER;   Name = "DisableAntiSpyware";           Expected = 1; Setting = "Turn off Defender Antivirus" }
    [pscustomobject]@{ Path = $GP_DEFENDER;   Name = "DisableAntiVirus";             Expected = 1; Setting = "Turn off antivirus engine" }
    [pscustomobject]@{ Path = $GP_DEFENDER;   Name = "DisableRoutinelyTakingAction"; Expected = 1; Setting = "Turn off routine remediation" }
    [pscustomobject]@{ Path = $GP_DEFENDER;   Name = "PUAProtection";                Expected = 0; Setting = "PUA protection off" }
    [pscustomobject]@{ Path = $GP_RTP;        Name = "DisableRealtimeMonitoring";    Expected = 1; Setting = "Real-time protection off" }
    [pscustomobject]@{ Path = $GP_RTP;        Name = "DisableBehaviorMonitoring";    Expected = 1; Setting = "Behavior monitoring off" }
    [pscustomobject]@{ Path = $GP_RTP;        Name = "DisableOnAccessProtection";    Expected = 1; Setting = "On-access protection off" }
    [pscustomobject]@{ Path = $GP_RTP;        Name = "DisableScanOnRealtimeEnable";  Expected = 1; Setting = "Process scan on RTP off" }
    [pscustomobject]@{ Path = $GP_RTP;        Name = "DisableIOAVProtection";        Expected = 1; Setting = "Downloaded-file scan off" }
    [pscustomobject]@{ Path = $GP_RTP;        Name = "DisableRawWriteNotification";  Expected = 1; Setting = "Raw write notifications off" }
    [pscustomobject]@{ Path = $GP_RTP;        Name = "DisableScriptScanning";        Expected = 1; Setting = "Script scanning off" }
    [pscustomobject]@{ Path = $GP_SPYNET;     Name = "SpyNetReporting";              Expected = 0; Setting = "MAPS/cloud reporting off" }
    [pscustomobject]@{ Path = $GP_SPYNET;     Name = "SubmitSamplesConsent";         Expected = 2; Setting = "Never send samples" }
    [pscustomobject]@{ Path = $GP_SPYNET;     Name = "DisableBlockAtFirstSeen";      Expected = 1; Setting = "Block-at-first-seen off" }
    [pscustomobject]@{ Path = $GP_REPORTING;  Name = "DisableEnhancedNotifications"; Expected = 1; Setting = "Enhanced notifications off" }
    [pscustomobject]@{ Path = $GP_MPENGINE;   Name = "MpEnablePus";                  Expected = 0; Setting = "Engine PUA blocking off" }
    [pscustomobject]@{ Path = $GP_NETPROTECT; Name = "EnableNetworkProtection";      Expected = 0; Setting = "Network protection off" }
    [pscustomobject]@{ Path = $GP_SYSTEM;     Name = "EnableSmartScreen";            Expected = 0; Setting = "SmartScreen off" }
    [pscustomobject]@{ Path = $GP_MRT;        Name = "DontOfferThroughWUAU";         Expected = 1; Setting = "MRT not offered" }
)

# Runtime status checks: each must read FALSE for Defender to be effectively off.
$ExpectedRuntime = @(
    [pscustomobject]@{ Prop = "RealTimeProtectionEnabled"; Setting = "Real-time protection (runtime)" }
    [pscustomobject]@{ Prop = "AntivirusEnabled";          Setting = "Antivirus engine (runtime)" }
    [pscustomobject]@{ Prop = "AMServiceEnabled";          Setting = "Antimalware service (runtime)" }
    [pscustomobject]@{ Prop = "BehaviorMonitorEnabled";    Setting = "Behavior monitor (runtime)" }
    [pscustomobject]@{ Prop = "OnAccessProtectionEnabled"; Setting = "On-access protection (runtime)" }
    [pscustomobject]@{ Prop = "IoavProtectionEnabled";     Setting = "Downloaded-file scan (runtime)" }
)

$DefenderServices = @("WinDefend", "WdNisSvc", "Sense", "WdFilter", "WdNisDrv", "WdBoot")
$DefenderTasks    = @(
    "Windows Defender Cache Maintenance",
    "Windows Defender Cleanup",
    "Windows Defender Scheduled Scan",
    "Windows Defender Verification"
)

# =============================================================================
# HELPERS
# =============================================================================
function Get-RegValue {
    param([string]$Path, [string]$Name)
    try {
        return (Get-ItemProperty -Path $Path -Name $Name -ErrorAction Stop).$Name
    } catch {
        return $null
    }
}

function Add-Result {
    param([string]$Category, [string]$Setting, $Expected, $Actual, [string]$Result)
    $Results.Add([pscustomobject]@{
        Category = $Category
        Setting  = $Setting
        Expected = "$Expected"
        Actual   = "$Actual"
        Result   = $Result
    })
}

# =============================================================================
# GATHER
# =============================================================================
# 1. Group Policy registry values (the effective policy store).
foreach ($p in $ExpectedPolicies) {
    $actual = Get-RegValue -Path $p.Path -Name $p.Name
    if ($null -eq $actual) {
        Add-Result "GroupPolicy" $p.Setting $p.Expected "<not set>" "MISSING"
    } elseif ([int]$actual -eq [int]$p.Expected) {
        Add-Result "GroupPolicy" $p.Setting $p.Expected $actual "PASS"
    } else {
        Add-Result "GroupPolicy" $p.Setting $p.Expected $actual "MISMATCH"
    }
}

# 2. Defender runtime status + Tamper Protection (the real effect).
if ($DefenderModuleOk) {
    try { $compStatus = Get-MpComputerStatus -ErrorAction Stop } catch { $compStatus = $null }
    try { $prefStatus = Get-MpPreference -ErrorAction Stop } catch { $prefStatus = $null }
}
if ($null -ne $compStatus) {
    $tamper = [bool]$compStatus.IsTamperProtected
    Add-Result "TamperProtection" "Tamper Protection (must be OFF)" "False" $tamper $(if ($tamper) { "BLOCKING" } else { "OK" })
    foreach ($r in $ExpectedRuntime) {
        $val = $compStatus.$($r.Prop)
        Add-Result "Runtime" $r.Setting "False" $val $(if ("$val" -eq "False") { "PASS" } else { "STILL ON" })
    }
} else {
    Add-Result "Runtime" "Get-MpComputerStatus" "available" "unavailable" "N/A"
}

# 3. Live preferences (reflect Set-MpPreference; reverted to False if Tamper on).
if ($null -ne $prefStatus) {
    Add-Result "MpPreference" "DisableRealtimeMonitoring" "True" $prefStatus.DisableRealtimeMonitoring $(if ($prefStatus.DisableRealtimeMonitoring) { "PASS" } else { "REVERTED" })
    Add-Result "MpPreference" "DisableScriptScanning"    "True" $prefStatus.DisableScriptScanning    $(if ($prefStatus.DisableScriptScanning) { "PASS" } else { "REVERTED" })
    Add-Result "MpPreference" "MAPSReporting"            "Disabled"  $prefStatus.MAPSReporting        $(if ("$($prefStatus.MAPSReporting)" -eq "Disabled" -or "$($prefStatus.MAPSReporting)" -eq "0") { "PASS" } else { "REVERTED" })
    Add-Result "MpPreference" "SubmitSamplesConsent"     "NeverSend" $prefStatus.SubmitSamplesConsent $(if ("$($prefStatus.SubmitSamplesConsent)" -eq "NeverSend" -or "$($prefStatus.SubmitSamplesConsent)" -eq "2") { "PASS" } else { "REVERTED" })
    $exclusions = @($prefStatus.ExclusionPath)
    Add-Result "MpPreference" "Exclusion paths" ">=1" $exclusions.Count $(if ($exclusions.Count -ge 1) { "PASS" } else { "NONE" })
}

# 4. Service start type (4 = Disabled; protected services may stay at 2/3).
foreach ($svc in $DefenderServices) {
    $svcKey = Join-Path $SvcRoot $svc
    if (-not (Test-Path $svcKey)) {
        Add-Result "Service" $svc "4 (Disabled)" "<absent>" "N/A"
        continue
    }
    $start = Get-RegValue -Path $svcKey -Name "Start"
    Add-Result "Service" $svc "4 (Disabled)" $start $(if ("$start" -eq "4") { "PASS" } else { "PROTECTED" })
}

# 5. Scheduled task state.
foreach ($taskName in $DefenderTasks) {
    try {
        $task = Get-ScheduledTask -TaskPath $DefenderTaskPath -TaskName $taskName -ErrorAction Stop
        Add-Result "ScheduledTask" $taskName "Disabled" $task.State $(if ("$($task.State)" -eq "Disabled") { "PASS" } else { "ENABLED" })
    } catch {
        Add-Result "ScheduledTask" $taskName "Disabled" "<not found>" "N/A"
    }
}

# =============================================================================
# REPORT
# =============================================================================
$passCount = @($Results | Where-Object { $_.Result -eq "PASS" -or $_.Result -eq "OK" }).Count
$totalCount = $Results.Count
$title = "Defender Verification  -  $passCount/$totalCount OK"

Write-Host "================================================================" -ForegroundColor White
Write-Host " Microsoft Defender - Effective State Verification" -ForegroundColor White
Write-Host "================================================================" -ForegroundColor White
foreach ($row in $Results) {
    $color = switch ($row.Result) {
        "PASS"      { "Green" }
        "OK"        { "Green" }
        "MISMATCH"  { "Red" }
        "STILL ON"  { "Red" }
        "ENABLED"   { "Red" }
        "BLOCKING"  { "Red" }
        "REVERTED"  { "Yellow" }
        "PROTECTED" { "Yellow" }
        "MISSING"   { "Yellow" }
        default     { "Gray" }
    }
    Write-Host ("  [{0,-9}] {1,-34} expect={2,-10} actual={3,-10} {4}" -f $row.Category, $row.Setting, $row.Expected, $row.Actual, $row.Result) -ForegroundColor $color
}
Write-Host "----------------------------------------------------------------" -ForegroundColor White
Write-Host (" Summary: {0}/{1} OK" -f $passCount, $totalCount) -ForegroundColor White
if ($null -ne $compStatus -and $compStatus.IsTamperProtected) {
    Write-Host " NOTE: Tamper Protection is ON - runtime items stay enabled until you turn it OFF." -ForegroundColor Yellow
}
Write-Host " NOTE: gpedit.msc will show these as 'Not Configured' - it reads Registry.pol, not the live registry." -ForegroundColor Yellow

# Pop up the grid UI (default) unless -NoGui or Out-GridView is unavailable.
if (-not $NoGui) {
    if (Get-Command Out-GridView -ErrorAction SilentlyContinue) {
        $Results | Out-GridView -Title $title -Wait
    } else {
        Write-Host " Out-GridView unavailable on this host; table shown above." -ForegroundColor Yellow
    }
}
