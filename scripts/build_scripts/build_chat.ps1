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

# Set root directory and app name
$programingRootDir = "D:\programing"
$APPNAME = "achat"
$flutterBloomDir = Join-Path $programingRootDir "flutter_bloom"
$privatePublicDir = Join-Path $programingRootDir "private_public"
$coreNodeFlutterDir = Join-Path $programingRootDir "core_node\apps\flutter_bloom"
$copyScript = Join-Path $programingRootDir "core_node\scripts\build_scripts\copy_flutter.py"

# Check if flutter_bloom directory exists
if (Test-Path $flutterBloomDir) {
    Write-Host "Warning: $flutterBloomDir already exists."
    Write-Host "If you want to update the code, please delete the directory and run this script again."
}

# Check private_public directory and its subdirectories
if (-not (Test-Path $privatePublicDir)) {
    Write-Host "Error: $privatePublicDir does not exist. Please create it first."
}

# Check for required asset directories
$launchDir = Join-Path $privatePublicDir "assets\${APPNAME}_launch"
$iconsDir = Join-Path $privatePublicDir "assets\${APPNAME}_icons"

if (-not (Test-Path $launchDir)) {
    Write-Host "Warning: $launchDir does not exist. Please create it."
}

if (-not (Test-Path $iconsDir)) {
    Write-Host "Warning: $iconsDir does not exist. Please create it."
}

# Check if source flutter_bloom exists in core_node and copy if needed
if (Test-Path $coreNodeFlutterDir) {
    Write-Host "Found flutter_bloom in core_node. Using Python script to copy and setup..."
    
    # Call the Python script to handle copying and setup
    python $copyScript $coreNodeFlutterDir $flutterBloomDir
    if ($LASTEXITCODE -eq 0) {
        Write-Host "Successfully copied and set up flutter_bloom"
        
        # Execute build script if it exists
        $buildScript = Join-Path $flutterBloomDir "scripts\build_scripts\build_app.ps1"
        if (Test-Path $buildScript) {
            Write-Host "Executing build script: $buildScript"
            Write-Host "Current directory: $(Get-Location)"
            
            # Execute the build script with the app name parameter
            & powershell -ExecutionPolicy Bypass -File $buildScript -appname $APPNAME
            if ($LASTEXITCODE -ne 0) {
                Write-Host "Error: Build script failed with exit code: $LASTEXITCODE" -ForegroundColor Red
                exit $LASTEXITCODE
            }
        } else {
            Write-Host "Warning: Build script not found at $buildScript" -ForegroundColor Yellow
            Write-Host "Directory contents of $(Split-Path $buildScript):"
            Get-ChildItem -Path (Split-Path $buildScript) -ErrorAction SilentlyContinue | ForEach-Object {
                Write-Host "  $_"
            }
            exit 1
        }
    } else {
        Write-Host "Error: Failed to copy and setup flutter_bloom" -ForegroundColor Red
        exit 1
    }
} else {
    Write-Host "Error: Source flutter_bloom directory not found at $coreNodeFlutterDir" -ForegroundColor Red
    exit 1
}