
# List of packages to uninstall (format: @{"Name"="Package Name"; "ID"="com.example.package"})
$packages = @(
    @{Name="Quick Search Box"; ID="com.android.quicksearchbox"},
    @{Name="Voice Assist"; ID="com.miui.voiceassist"},
    @{Name="Xiaomi AI Service"; ID="com.xiaomi.aiasst.service"},
    @{Name="AI Reco"; ID="com.xiaomi.aireco"},
    @{Name="Baidu Input MI"; ID="com.baidu.input_mi"},
    @{Name="Xiaomi AICR"; ID="com.xiaomi.aicr"},
    @{Name="Browser"; ID="com.android.browser"},
    @{Name="Mi Service"; ID="com.miui.miservice"},
    @{Name="Hybrid Service"; ID="com.miui.hybrid"},
    @{Name="Xiaomi Service Framework"; ID="com.xiaomi.xmsf"},
    @{Name="Personal Assistant"; ID="com.miui.personalassistant"},
    @{Name="Barrage Notifications"; ID="com.xiaomi.barrage"},
    @{Name="Basic Dreams Screensaver"; ID="com.android.dreams.basic"},
    @{Name="Emergency Info"; ID="com.android.emergency"},
    @{Name="Mi Share Connectivity"; ID="com.miui.mishare.connectivity"},
    @{Name="Mi Connect Service"; ID="com.xiaomi.mi_connect_service"},
    @{Name="NextPay Web Component"; ID="com.miui.nextpay"},
    @{Name="Bug Report"; ID="com.miui.bugreport"},
    @{Name="Game Center SDK Service"; ID="com.xiaomi.gamecenter.sdk.service"},
    @{Name="Mi Game Service"; ID="com.xiaomi.migameservice"},
    @{Name="Macro Service"; ID="com.xiaomi.macro"}
)

# Initialize counters
$total = $packages.Count
$success = 0
$already_uninstalled = 0
$failed = 0

# Process each package
foreach ($pkg in $packages) {
    Write-Host "Processing: $($pkg.Name) ($($pkg.ID))" -ForegroundColor Cyan

    # Execute ADB uninstall command
    $result = adb shell pm uninstall --user 0 $pkg.ID

    # Parse and display result
    if ($result -eq "Success") {
        Write-Host "Status: Successfully uninstalled" -ForegroundColor Green
        $success++
    } elseif ($result -like "*not installed for 0*") {
        Write-Host "Status: Already uninstalled" -ForegroundColor Yellow
        $already_uninstalled++
    } else {
        Write-Host "Status: Failed ($result)" -ForegroundColor Red
        $failed++
    }

    Write-Host "----------------------------------------"
}

# Display summary
Write-Host "`nUninstallation Summary:" -ForegroundColor Magenta
Write-Host "Total packages processed: $total"
Write-Host "Successfully uninstalled: $success" -ForegroundColor Green
Write-Host "Already uninstalled: $already_uninstalled" -ForegroundColor Yellow
Write-Host "Failed attempts: $failed" -ForegroundColor Red