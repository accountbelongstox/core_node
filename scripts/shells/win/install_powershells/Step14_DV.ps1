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

# Import required modules
. "$PSScriptRoot\..\win_common\GlobalVars.ps1"
. "$PSScriptRoot\..\win_common\CommonFunc.ps1"

# =============================================================================
# VARIABLES (declared at the beginning of the file)
# =============================================================================
$STEP_NUMBER       = 14
$ScriptPath        = $MyInvocation.MyCommand.Path
$ProjectRoot       = if ($Global:CORE_NODE_DIR) { $Global:CORE_NODE_DIR } else { Split-Path (Split-Path (Split-Path (Split-Path $PSScriptRoot -Parent) -Parent) -Parent) -Parent }
$DefenderModuleOk  = [bool](Get-Command Get-MpPreference -ErrorAction SilentlyContinue)
$TamperProtected   = $false
$VerifierPath      = Join-Path (Split-Path $PSScriptRoot -Parent) "tools\Verify_Defender.ps1"

# Group Policy registry roots (the real keys behind the gpedit.msc settings).
$GP_DEFENDER       = "HKLM:\SOFTWARE\Policies\Microsoft\Windows Defender"
$GP_RTP            = Join-Path $GP_DEFENDER "Real-Time Protection"
$GP_SPYNET         = Join-Path $GP_DEFENDER "Spynet"
$GP_REPORTING      = Join-Path $GP_DEFENDER "Reporting"
$GP_MPENGINE       = Join-Path $GP_DEFENDER "MpEngine"
$GP_NETPROTECT     = Join-Path $GP_DEFENDER "Windows Defender Exploit Guard\Network Protection"
$GP_SYSTEM         = "HKLM:\SOFTWARE\Policies\Microsoft\Windows\System"
$GP_MRT            = "HKLM:\SOFTWARE\Policies\Microsoft\MRT"

# Each policy = one gpedit.msc toggle, applied idempotently as a DWORD.
$GpPolicies = @(
    [pscustomobject]@{ Path = $GP_DEFENDER;   Name = "DisableAntiSpyware";              Value = 1; Desc = "Turn off Microsoft Defender Antivirus" }
    [pscustomobject]@{ Path = $GP_DEFENDER;   Name = "DisableAntiVirus";                Value = 1; Desc = "Turn off antivirus engine" }
    [pscustomobject]@{ Path = $GP_DEFENDER;   Name = "DisableRoutinelyTakingAction";    Value = 1; Desc = "Turn off routine remediation" }
    [pscustomobject]@{ Path = $GP_DEFENDER;   Name = "PUAProtection";                   Value = 0; Desc = "Disable potentially-unwanted-app protection" }
    [pscustomobject]@{ Path = $GP_DEFENDER;   Name = "ServiceKeepAlive";                Value = 0; Desc = "Do not keep the antimalware service alive" }
    [pscustomobject]@{ Path = $GP_RTP;        Name = "DisableRealtimeMonitoring";       Value = 1; Desc = "Turn off real-time protection" }
    [pscustomobject]@{ Path = $GP_RTP;        Name = "DisableBehaviorMonitoring";       Value = 1; Desc = "Turn off behavior monitoring" }
    [pscustomobject]@{ Path = $GP_RTP;        Name = "DisableOnAccessProtection";       Value = 1; Desc = "Turn off on-access (file/program) monitoring" }
    [pscustomobject]@{ Path = $GP_RTP;        Name = "DisableScanOnRealtimeEnable";     Value = 1; Desc = "Turn off process scanning on RTP enable" }
    [pscustomobject]@{ Path = $GP_RTP;        Name = "DisableIOAVProtection";           Value = 1; Desc = "Do not scan downloaded files and attachments" }
    [pscustomobject]@{ Path = $GP_RTP;        Name = "DisableRawWriteNotification";     Value = 1; Desc = "Turn off raw volume write notifications" }
    [pscustomobject]@{ Path = $GP_RTP;        Name = "DisableScriptScanning";           Value = 1; Desc = "Turn off script scanning" }
    [pscustomobject]@{ Path = $GP_SPYNET;     Name = "SpyNetReporting";                 Value = 0; Desc = "Disable MAPS / cloud reporting" }
    [pscustomobject]@{ Path = $GP_SPYNET;     Name = "SubmitSamplesConsent";            Value = 2; Desc = "Never send samples" }
    [pscustomobject]@{ Path = $GP_SPYNET;     Name = "DisableBlockAtFirstSeen";         Value = 1; Desc = "Disable block-at-first-seen" }
    [pscustomobject]@{ Path = $GP_REPORTING;  Name = "DisableEnhancedNotifications";    Value = 1; Desc = "Disable enhanced notifications" }
    [pscustomobject]@{ Path = $GP_MPENGINE;   Name = "MpEnablePus";                     Value = 0; Desc = "Disable PUA blocking in engine" }
    [pscustomobject]@{ Path = $GP_NETPROTECT; Name = "EnableNetworkProtection";         Value = 0; Desc = "Allow access to flagged websites (network protection off)" }
    [pscustomobject]@{ Path = $GP_SYSTEM;     Name = "EnableSmartScreen";               Value = 0; Desc = "Turn off SmartScreen" }
    [pscustomobject]@{ Path = $GP_MRT;        Name = "DontOfferThroughWUAU";            Value = 1; Desc = "Do not offer the Malicious Software Removal Tool" }
)

# Live Defender preferences (apply immediately when Tamper Protection is OFF).
$MpSettings = @(
    [pscustomobject]@{ Param = "DisableRealtimeMonitoring";  Value = $true;        Desc = "Real-time monitoring" }
    [pscustomobject]@{ Param = "DisableBehaviorMonitoring";  Value = $true;        Desc = "Behavior monitoring" }
    [pscustomobject]@{ Param = "DisableScriptScanning";      Value = $true;        Desc = "Script scanning" }
    [pscustomobject]@{ Param = "DisableIOAVProtection";      Value = $true;        Desc = "Downloaded-file scanning" }
    [pscustomobject]@{ Param = "DisableArchiveScanning";     Value = $true;        Desc = "Archive scanning" }
    [pscustomobject]@{ Param = "DisableBlockAtFirstSeen";    Value = $true;        Desc = "Block at first seen" }
    [pscustomobject]@{ Param = "DisableCatchupFullScan";     Value = $true;        Desc = "Catch-up full scan" }
    [pscustomobject]@{ Param = "DisableCatchupQuickScan";    Value = $true;        Desc = "Catch-up quick scan" }
    [pscustomobject]@{ Param = "MAPSReporting";              Value = "Disabled";   Desc = "Cloud (MAPS) reporting" }
    [pscustomobject]@{ Param = "SubmitSamplesConsent";       Value = "NeverSend";  Desc = "Sample submission" }
)

# Folders excluded from any residual scanning (dev tree + the Chrome under audit).
$ExclusionPaths = @(
    $ProjectRoot
    "D:\applications\Chrome\Chrome"
    (Join-Path $ProjectRoot "scripts\chromefix")
)

# Defender services and scheduled tasks (best-effort; several are OS-protected).
$DefenderServices = @("WinDefend", "WdNisSvc", "Sense", "WdFilter", "WdNisDrv", "WdBoot")
$DefenderTasks    = @(
    "Windows Defender Cache Maintenance",
    "Windows Defender Cleanup",
    "Windows Defender Scheduled Scan",
    "Windows Defender Verification"
)
$DefenderTaskPath = "\Microsoft\Windows\Windows Defender\"

# Idempotency counters.
$Stats = @{ already = 0; changed = 0; blocked = 0; failed = 0 }

# =============================================================================
# IDEMPOTENCY GUARD
# =============================================================================
if (Test-Path $Global:STEP8_DV_INSTALLED_FLAG) {
    Write-ColorMessage "[Step ${STEP_NUMBER}] Already configured (idempotent). Skipping in 5s. Press 'Y' to re-apply..." -Type "Warning"
    $reconfigureKey = $null
    $deadline = (Get-Date).AddSeconds(5)
    while ((Get-Date) -lt $deadline) {
        if ([Console]::KeyAvailable) {
            $reconfigureKey = [Console]::ReadKey($true).KeyChar
            break
        }
        Start-Sleep -Milliseconds 100
    }
    if ($null -eq $reconfigureKey -or $reconfigureKey.ToString().ToUpper() -ne 'Y') {
        Write-ColorMessage "[Step ${STEP_NUMBER}] Skipping (already disabled)." -Type "Info"
        return
    }
    Write-ColorMessage "[Step ${STEP_NUMBER}] Re-applying (will report each setting as already-set or changed)..." -Type "Info"
}

# =============================================================================
# HELPERS
# =============================================================================
function Set-PolicyDword {
    # Idempotently write one Group Policy DWORD; reports already-set vs changed.
    param([string]$Path, [string]$Name, [int]$Value, [string]$Desc)
    $existing = $null
    try {
        if (-not (Test-Path $Path)) { New-Item -Path $Path -Force | Out-Null }
        $prop = Get-ItemProperty -Path $Path -Name $Name -ErrorAction SilentlyContinue
        if ($null -ne $prop) { $existing = $prop.$Name }
        if ($null -ne $existing -and [int]$existing -eq $Value) {
            Write-ColorMessage "  [GP] ${Desc}: already $Value (idempotent)" -Type "Success"
            $Stats.already++
            return
        }
        New-ItemProperty -Path $Path -Name $Name -Value $Value -PropertyType DWord -Force | Out-Null
        Write-ColorMessage "  [GP] ${Desc}: set to $Value" -Type "Info"
        $Stats.changed++
    } catch {
        Write-ColorMessage "  [GP] ${Desc}: FAILED - $($_.Exception.Message)" -Type "Error"
        $Stats.failed++
    }
}

function Set-MpFlag {
    # Idempotently apply one Set-MpPreference value; Tamper Protection may block it.
    param([string]$Param, $Value, [string]$Desc, $Current)
    $now = "$($Current.$Param)"
    if ($now -eq "$Value") {
        Write-ColorMessage "  [Mp] ${Desc}: already '$Value' (idempotent)" -Type "Success"
        $Stats.already++
        return
    }
    try {
        $splat = @{ $Param = $Value }
        Set-MpPreference @splat -ErrorAction Stop
        Write-ColorMessage "  [Mp] ${Desc}: set to '$Value'" -Type "Info"
        $Stats.changed++
    } catch {
        Write-ColorMessage "  [Mp] ${Desc}: BLOCKED (Tamper Protection?) - $($_.Exception.Message)" -Type "Warning"
        $Stats.blocked++
    }
}

# =============================================================================
# MAIN
# =============================================================================
Write-ColorMessage "Step ${STEP_NUMBER}: Disable Microsoft Defender (Group Policy + live preferences)" -Type "Info"
Write-ColorMessage "----------------------------------------------------------------" -Type "Info"

# 1. Require elevation (HKLM policies + Set-MpPreference need Administrator).
if (-not $Global:IS_RUN_ADMIN) {
    Write-ColorMessage "[Step ${STEP_NUMBER}] Administrator rights required - relaunching elevated..." -Type "Warning"
    try {
        Start-Process -FilePath "powershell" -Verb RunAs -ArgumentList @(
            "-NoProfile", "-ExecutionPolicy", "Bypass", "-File", $ScriptPath
        ) | Out-Null
        Write-ColorMessage "[Step ${STEP_NUMBER}] Elevated window launched; continuing there." -Type "Info"
    } catch {
        Write-ColorMessage "[Step ${STEP_NUMBER}] Elevation declined/failed. Re-run dd as Administrator." -Type "Error"
    }
    return
}

# 2. Confirm intent (defaults to Yes so an unattended dd chain proceeds).
$proceed = Invoke-TimeoutPrompt -Message "Completely disable Windows Defender now? (Y/N)" -DefaultValue "Y" -TimeoutSeconds 10
if ($proceed.ToString().ToUpper() -ne "Y") {
    Write-ColorMessage "[Step ${STEP_NUMBER}] Skipped by user." -Type "Warning"
    return
}

# 3. Tamper Protection: Microsoft reverts ALL programmatic disabling while it is on.
if ($DefenderModuleOk) {
    try {
        $TamperProtected = [bool](Get-MpComputerStatus -ErrorAction Stop).IsTamperProtected
    } catch {
        $TamperProtected = $false
    }
}
if ($TamperProtected) {
    Write-ColorMessage "Tamper Protection is ON. Windows will REVERT live changes until you turn it OFF." -Type "Warning"
    Write-ColorMessage "Opening Windows Security so you can disable Tamper Protection (Virus & threat protection > Manage settings)." -Type "Info"
    Start-Process "windowsdefender://threatsettings" | Out-Null
    Write-ColorMessage "After turning Tamper Protection OFF, press any key to continue (registry policies are written regardless)..." -Type "Warning"
    $null = $host.UI.RawUI.ReadKey("NoEcho,IncludeKeyDown")
}

# 4. Apply Group Policy registry keys (persist and apply even when set ahead of time).
Write-ColorMessage "Applying Group Policy registry settings..." -Type "Info"
foreach ($p in $GpPolicies) {
    Set-PolicyDword -Path $p.Path -Name $p.Name -Value $p.Value -Desc $p.Desc
}

# 5. Apply live Defender preferences + exclusions (effective once Tamper Protection is off).
if ($DefenderModuleOk) {
    Write-ColorMessage "Applying live Defender preferences..." -Type "Info"
    $currentPref = Get-MpPreference
    foreach ($s in $MpSettings) {
        Set-MpFlag -Param $s.Param -Value $s.Value -Desc $s.Desc -Current $currentPref
    }

    Write-ColorMessage "Ensuring scan exclusions for the dev tree..." -Type "Info"
    $currentExclusions = @((Get-MpPreference).ExclusionPath)
    foreach ($path in $ExclusionPaths) {
        if ($currentExclusions -contains $path) {
            Write-ColorMessage "  [Excl] ${path}: already excluded (idempotent)" -Type "Success"
            $Stats.already++
        } else {
            try {
                Add-MpPreference -ExclusionPath $path -ErrorAction Stop
                Write-ColorMessage "  [Excl] ${path}: added" -Type "Info"
                $Stats.changed++
            } catch {
                Write-ColorMessage "  [Excl] ${path}: BLOCKED - $($_.Exception.Message)" -Type "Warning"
                $Stats.blocked++
            }
        }
    }
} else {
    Write-ColorMessage "Defender PowerShell module not present - registry policies applied, live preferences skipped." -Type "Warning"
}

# 6. Disable Defender scheduled tasks (idempotent; usually permitted).
Write-ColorMessage "Disabling Defender scheduled tasks..." -Type "Info"
foreach ($taskName in $DefenderTasks) {
    try {
        $task = Get-ScheduledTask -TaskPath $DefenderTaskPath -TaskName $taskName -ErrorAction Stop
        if ($task.State -eq "Disabled") {
            Write-ColorMessage "  [Task] ${taskName}: already disabled (idempotent)" -Type "Success"
            $Stats.already++
        } else {
            Disable-ScheduledTask -TaskPath $DefenderTaskPath -TaskName $taskName -ErrorAction Stop | Out-Null
            Write-ColorMessage "  [Task] ${taskName}: disabled" -Type "Info"
            $Stats.changed++
        }
    } catch {
        Write-ColorMessage "  [Task] ${taskName}: not present/blocked" -Type "Warning"
        $Stats.blocked++
    }
}

# 7. Disable Defender services via Start type (WinDefend/WdFilter are OS-protected; best-effort).
Write-ColorMessage "Setting Defender services to Disabled (protected services may refuse)..." -Type "Info"
foreach ($svc in $DefenderServices) {
    $svcKey = Join-Path "HKLM:\SYSTEM\CurrentControlSet\Services" $svc
    if (-not (Test-Path $svcKey)) {
        Write-ColorMessage "  [Svc] ${svc}: not present" -Type "Info"
        continue
    }
    try {
        $startVal = (Get-ItemProperty -Path $svcKey -Name "Start" -ErrorAction SilentlyContinue).Start
        if ($startVal -eq 4) {
            Write-ColorMessage "  [Svc] ${svc}: already disabled (idempotent)" -Type "Success"
            $Stats.already++
        } else {
            Set-ItemProperty -Path $svcKey -Name "Start" -Value 4 -ErrorAction Stop
            Write-ColorMessage "  [Svc] ${svc}: set to Disabled (effective after reboot)" -Type "Info"
            $Stats.changed++
        }
    } catch {
        Write-ColorMessage "  [Svc] ${svc}: BLOCKED (OS-protected) - $($_.Exception.Message)" -Type "Warning"
        $Stats.blocked++
    }
}

# 8. Summary + persist the idempotency flag automatically.
Write-ColorMessage "----------------------------------------------------------------" -Type "Info"
Write-ColorMessage ("[Step ${STEP_NUMBER}] Summary: {0} already-set, {1} changed, {2} blocked, {3} failed." -f $Stats.already, $Stats.changed, $Stats.blocked, $Stats.failed) -Type "Info"
if ($Stats.blocked -gt 0) {
    Write-ColorMessage "[Step ${STEP_NUMBER}] Some items were blocked. If Tamper Protection was ON, turn it OFF and re-run this step." -Type "Warning"
}
Write-ColorMessage "[Step ${STEP_NUMBER}] A reboot (or 'gpupdate /force') finalizes the Group Policy + service changes." -Type "Info"

New-Item -ItemType File -Path $Global:STEP8_DV_INSTALLED_FLAG -Force | Out-Null
Write-ColorMessage "[Step ${STEP_NUMBER}] Idempotency flag written. Step complete." -Type "Success"

# Pop up the verification UI so the result can be confirmed by hand (non-blocking).
if (Test-Path $VerifierPath) {
    Write-ColorMessage "[Step ${STEP_NUMBER}] Opening verification UI for manual check..." -Type "Info"
    Start-Process -FilePath "powershell" -ArgumentList @(
        "-NoProfile", "-ExecutionPolicy", "Bypass", "-File", $VerifierPath
    ) | Out-Null
} else {
    Write-ColorMessage "[Step ${STEP_NUMBER}] Verifier not found at $VerifierPath" -Type "Warning"
}
