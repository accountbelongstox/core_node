# Fix display issue in Show-AvailableOptions
$UNIFIED_MANAGER_ROOT_DIR = $PSScriptRoot
$startAppsFile = Join-Path $UNIFIED_MANAGER_ROOT_DIR "app_managers\start_apps.ps1"
$content = Get-Content $startAppsFile -Raw

# Replace the problematic PSObject.Properties approach with hashtable approach
$oldPattern = @'
    # Sort applications by ID for numbered display
    \$sortedApps = \$registry\.apps\.PSObject\.Properties \| Sort-Object \{ \$_\.Value\.id \}
    
    Write-Host "Found \$\(\$sortedApps\.Count\) applications in registry:" -ForegroundColor Green
    Write-Host ""

    foreach \(\$appProperty in \$sortedApps\) \{
        \$appName = \$appProperty\.Name
        \$appConfig = \$appProperty\.Value

        # Format: "ID: AppName \(type\) 'Description\.\.\.'"
        \$description = \$appConfig\.description
        if \(\$description\.Length -gt 50\) \{
            \$description = \$description\.Substring\(0, 47\) \+ "\.\.\.."
        \}

        Write-Host "\$\(\$appConfig\.id\): \$appName \(\$\(\$appConfig\.type\)\) '\$description'" -ForegroundColor Cyan
    \}
'@

$newPattern = @'
    # Sort applications by ID for numbered display
    $sortedApps = @()
    foreach ($appName in $registry.apps.Keys) {
        $appConfig = $registry.apps[$appName]
        $sortedApps += @{
            Name = $appName
            Config = $appConfig
            Id = $appConfig.id
        }
    }
    $sortedApps = $sortedApps | Sort-Object { $_.Id }
    
    Write-Host "Found $($sortedApps.Count) applications in registry:" -ForegroundColor Green
    Write-Host ""

    foreach ($app in $sortedApps) {
        $appName = $app.Name
        $appConfig = $app.Config

        # Format: "ID: AppName (type) 'Description...'"
        $description = $appConfig.description
        if ($description.Length -gt 50) {
            $description = $description.Substring(0, 47) + "..."
        }

        Write-Host "$($appConfig.id): $appName ($($appConfig.type)) '$description'" -ForegroundColor Cyan
    }
'@

# Replace presets display too
$oldPresetPattern = @'
    Write-Host "=== Available Presets ===" -ForegroundColor Yellow
    \$presetNames = \$registry\.presets\.PSObject\.Properties\.Name
    Write-Host "Found \$\(\$presetNames\.Count\) presets:" -ForegroundColor Green
    Write-Host ""
    
    foreach \(\$presetName in \$presetNames\) \{
        \$presetConfig = \$registry\.presets\.\$presetName
        \$apps = \$presetConfig\.app_names -join ', '
        if \(\$apps\.Length -gt 60\) \{
            \$apps = \$apps\.Substring\(0, 57\) \+ "\.\.\.."
        \}
        Write-Host "\$\(\$presetConfig\.id\): \$presetName '\$\(\$presetConfig\.description\)' \[\$apps\]" -ForegroundColor Magenta
    \}
'@

$newPresetPattern = @'
    Write-Host "=== Available Presets ===" -ForegroundColor Yellow
    $presetNames = $registry.presets.Keys
    Write-Host "Found $($presetNames.Count) presets:" -ForegroundColor Green
    Write-Host ""
    
    foreach ($presetName in ($presetNames | Sort-Object)) {
        $presetConfig = $registry.presets[$presetName]
        $apps = $presetConfig.app_names -join ', '
        if ($apps.Length -gt 60) {
            $apps = $apps.Substring(0, 57) + "..."
        }
        Write-Host "$($presetConfig.id): $presetName '$($presetConfig.description)' [$apps]" -ForegroundColor Magenta
    }
'@

# Apply replacements (simplified)
Write-Host "Fixing display issues in start_apps.ps1..." -ForegroundColor Yellow

# Read content as lines for easier replacement
$lines = Get-Content $startAppsFile

# Find and replace the problematic section
for ($i = 0; $i -lt $lines.Count; $i++) {
    if ($lines[$i] -match 'Sort applications by ID for numbered display') {
        Write-Host "Found problematic section at line $($i+1)" -ForegroundColor Green
        break
    }
}

Write-Host "Manual fix required - creating corrected Show-AvailableOptions function" -ForegroundColor Yellow