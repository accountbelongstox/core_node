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

param(
    [string]$appname
)

# If appname is provided, print it
if ($appname) {
    Write-Host "prebuild_app.ps1 received appname: $appname" -ForegroundColor Cyan
}

# Prebuild App Selector Script
# Import shared variables from win_common
$scriptPath = Split-Path -Parent $MyInvocation.MyCommand.Path
$WIN_COMMON_DIR = Join-Path (Split-Path -Parent $scriptPath) "win_common"
. (Join-Path $WIN_COMMON_DIR "FlutterGlobalVar.ps1")

# Enable UTF-8 encoding for proper character display
[Console]::OutputEncoding = [System.Text.Encoding]::UTF8
$OutputEncoding = [System.Text.Encoding]::UTF8

# Scan FlutterLibDir for items starting with 'app_'
$appItems = Get-ChildItem -Path $Global:FlutterLibDir -Directory | Where-Object { $_.Name -like 'app_*' }

# Build a hashtable: key = name without 'app_', value = original name
$appTable = @{}
foreach ($item in $appItems) {
    $key = $item.Name -replace '^app_', ''
    $appTable[$key] = $item.Name
}

# Check if provided appname exists in appTable
if ($appname -and -not $appTable.ContainsKey($appname)) {
    $firstKey = $appTable.Keys | Select-Object -First 1
    Write-Host "Warning: Provided appname '$appname' not found in available apps. Using default: $firstKey" -ForegroundColor Yellow
    $appname = $firstKey
}

# If appname is provided and valid, use it directly
if ($appname -and $appTable.ContainsKey($appname)) {
    $selectedKey = $appname
}
else {
    # Present the key list to the user for selection
    $keys = $appTable.Keys | Sort-Object
    Write-Host "Select an app module (use arrow keys and Enter):"

    # Use Out-GridView if available for interactive selection, otherwise fallback to a simple menu
    if (Get-Command Out-GridView -ErrorAction SilentlyContinue) {
        $selectedKey = $keys | Out-GridView -Title "Select an app module" -PassThru
    }
    else {
        # Simple terminal menu
        for ($i = 0; $i -lt $keys.Count; $i++) {
            Write-Host ("[$i] $($keys[$i])")
        }
        $selection = Read-Host "Enter the number of your selection"
        $selectedKey = $keys[$selection]
    }
}

if ($selectedKey) {
    $selectedValue = $appTable[$selectedKey]
    Write-Host "You selected: $selectedKey ($selectedValue)"
    
    # Call replace_icon_android.py with the selected key
    $pythonScript = Join-Path $scriptPath "backup_icon_android.py"
    & python $pythonScript $selectedKey
    $replaceIconsAndroidPyScript = Join-Path $scriptPath "replace_icons_android.py"
    & python $replaceIconsAndroidPyScript $selectedKey
}
else {
    Write-Host "No selection made."
    exit 1
}
