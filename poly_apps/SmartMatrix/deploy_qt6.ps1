# Qt6 Deployment Script for QtScrcpy
# This script deploys Qt6 DLLs and dependencies to make the application runnable

param(
    [string]$BuildType = "RelWithDebInfo",
    [string]$Architecture = "x64",
    [string]$QtPath = "",
    [switch]$Force = $false
)

Write-Host "=== Qt6 Deployment Script for QtScrcpy ===" -ForegroundColor Green

# Set error action preference
$ErrorActionPreference = "Stop"

# Get script directory
$ScriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
$OutputDir = Join-Path $ScriptDir "output\$Architecture\$BuildType"
$PublishDir = Join-Path $ScriptDir "publish_$Architecture"

Write-Host "Script Directory: $ScriptDir" -ForegroundColor Yellow
Write-Host "Output Directory: $OutputDir" -ForegroundColor Yellow
Write-Host "Publish Directory: $PublishDir" -ForegroundColor Yellow

# Check if output directory exists
if (-not (Test-Path $OutputDir)) {
    Write-Error "Output directory not found: $OutputDir"
    Write-Host "Please build the project first using build.ps1" -ForegroundColor Yellow
    exit 1
}

# Check if QtScrcpy.exe exists
$ExePath = Join-Path $OutputDir "QtScrcpy.exe"
if (-not (Test-Path $ExePath)) {
    Write-Error "QtScrcpy.exe not found: $ExePath"
    Write-Host "Please build the project first using build.ps1" -ForegroundColor Yellow
    exit 1
}

Write-Host "Found executable: $ExePath" -ForegroundColor Green

# Find Qt installation
function Find-QtInstallation {
    param([string]$CustomPath)
    
    if ($CustomPath -and (Test-Path $CustomPath)) {
        return $CustomPath
    }
    
    # Try to find Qt in system dev directory
    $DevDir = "D:\.dev_win11"
    if (Test-Path $DevDir) {
        $QtDirs = Get-ChildItem $DevDir -Directory -ErrorAction SilentlyContinue | Where-Object { $_.Name -match '(qt|Qt)' }
        
        foreach ($QtDir in $QtDirs) {
            $VersionDirs = Get-ChildItem $QtDir.FullName -Directory -ErrorAction SilentlyContinue | Where-Object { $_.Name -match '^\d+\.\d+(\.\d+)?$' }
            
            foreach ($VersionDir in $VersionDirs) {
                $MsvcDir = Join-Path $VersionDir.FullName "msvc2022_64"
                if (Test-Path $MsvcDir) {
                    $WindeployqtPath = Join-Path $MsvcDir "bin\windeployqt6.exe"
                    if (Test-Path $WindeployqtPath) {
                        Write-Host "Found Qt installation: $MsvcDir" -ForegroundColor Green
                        return $MsvcDir
                    }
                }
            }
        }
    }
    
    # Try standard paths
    $StandardPaths = @(
        "C:\Qt\6.9.3\msvc2022_64",
        "C:\Qt\6.8.0\msvc2022_64",
        "C:\Qt\6.7.0\msvc2022_64"
    )
    
    foreach ($Path in $StandardPaths) {
        if (Test-Path $Path) {
            $WindeployqtPath = Join-Path $Path "bin\windeployqt6.exe"
            if (Test-Path $WindeployqtPath) {
                Write-Host "Found Qt installation: $Path" -ForegroundColor Green
                return $Path
            }
        }
    }
    
    return $null
}

# Find Qt installation
$QtInstallPath = Find-QtInstallation -CustomPath $QtPath
if (-not $QtInstallPath) {
    Write-Error "Qt 6.x MSVC installation not found"
    Write-Host "Please install Qt 6.x with MSVC 2022 64-bit support" -ForegroundColor Yellow
    Write-Host "Expected paths:" -ForegroundColor Yellow
    Write-Host "  - D:\.dev_win11\Qt\6.9.3\msvc2022_64" -ForegroundColor Cyan
    Write-Host "  - C:\Qt\6.x.x\msvc2022_64" -ForegroundColor Cyan
    exit 1
}

Write-Host "Using Qt installation: $QtInstallPath" -ForegroundColor Green

# Get windeployqt path
$WindeployqtPath = Join-Path $QtInstallPath "bin\windeployqt6.exe"
if (-not (Test-Path $WindeployqtPath)) {
    Write-Error "windeployqt6.exe not found: $WindeployqtPath"
    exit 1
}

Write-Host "Found windeployqt6.exe: $WindeployqtPath" -ForegroundColor Green

# Create publish directory
if ($Force -and (Test-Path $PublishDir)) {
    Remove-Item $PublishDir -Recurse -Force
    Write-Host "Cleaned existing publish directory" -ForegroundColor Yellow
}

if (-not (Test-Path $PublishDir)) {
    New-Item -ItemType Directory -Path $PublishDir -Force | Out-Null
    Write-Host "Created publish directory: $PublishDir" -ForegroundColor Green
}

# Copy all files from output to publish directory
Write-Host "Copying files from output to publish directory..." -ForegroundColor Yellow
Copy-Item "$OutputDir\*" -Destination $PublishDir -Recurse -Force

# Copy additional dependencies
Write-Host "Copying additional dependencies..." -ForegroundColor Yellow

# Copy keymap files
$KeymapSource = Join-Path $ScriptDir "keymap"
$KeymapDest = Join-Path $PublishDir "keymap"
if (Test-Path $KeymapSource) {
    Copy-Item $KeymapSource -Destination $KeymapDest -Recurse -Force
    Write-Host "  Copied keymap files" -ForegroundColor Gray
}

# Copy config files
$ConfigSource = Join-Path $ScriptDir "config"
$ConfigDest = Join-Path $PublishDir "config"
if (Test-Path $ConfigSource) {
    Copy-Item $ConfigSource -Destination $ConfigDest -Recurse -Force
    Write-Host "  Copied config files" -ForegroundColor Gray
}

# Copy translation files
$I18nSource = Join-Path $ScriptDir "QtScrcpy\res\i18n"
$I18nDest = Join-Path $PublishDir "translations"
if (Test-Path $I18nSource) {
    New-Item -ItemType Directory -Path $I18nDest -Force | Out-Null
    $QmFiles = Get-ChildItem -Path $I18nSource -Filter "*.qm" -File
    foreach ($QmFile in $QmFiles) {
        Copy-Item $QmFile.FullName -Destination $I18nDest -Force
        Write-Host "  Copied translation: $($QmFile.Name)" -ForegroundColor Gray
    }
}

# Run windeployqt6
Write-Host "Running windeployqt6 to deploy Qt6 dependencies..." -ForegroundColor Yellow
$PublishExePath = Join-Path $PublishDir "QtScrcpy.exe"

# Set up environment
$env:Path = "$(Join-Path $QtInstallPath 'bin');$env:Path"

try {
    # Run windeployqt6 with verbose output
    $WindeployqtArgs = @(
        "--verbose",
        "--no-translations",  # We handle translations manually
        "--no-system-d3d-compiler",
        "--no-opengl-sw",
        $PublishExePath
    )
    
    Write-Host "Command: $WindeployqtPath $($WindeployqtArgs -join ' ')" -ForegroundColor Cyan
    
    & $WindeployqtPath @WindeployqtArgs
    
    if ($LASTEXITCODE -ne 0) {
        throw "windeployqt6 failed with exit code: $LASTEXITCODE"
    }
    
    Write-Host "windeployqt6 completed successfully!" -ForegroundColor Green
    
} catch {
    Write-Error "windeployqt6 failed: $_"
    exit 1
}

# Verify deployment
Write-Host "Verifying deployment..." -ForegroundColor Yellow

# Check for required Qt6 DLLs
$RequiredDlls = @(
    "Qt6Core.dll",
    "Qt6Gui.dll", 
    "Qt6Widgets.dll",
    "Qt6Network.dll",
    "Qt6Multimedia.dll",
    "Qt6OpenGL.dll",
    "Qt6OpenGLWidgets.dll"
)

$MissingDlls = @()
foreach ($Dll in $RequiredDlls) {
    $DllPath = Join-Path $PublishDir $Dll
    if (Test-Path $DllPath) {
        Write-Host "  [OK] $Dll" -ForegroundColor Green
    } else {
        Write-Host "  [MISSING] $Dll" -ForegroundColor Red
        $MissingDlls += $Dll
    }
}

# List all Qt6 DLLs in publish directory
Write-Host "`nAll Qt6 DLLs in publish directory:" -ForegroundColor Yellow
$Qt6Dlls = Get-ChildItem $PublishDir -Filter "Qt6*.dll" | Sort-Object Name
foreach ($Dll in $Qt6Dlls) {
    Write-Host "  - $($Dll.Name)" -ForegroundColor Cyan
}

# Test the executable
Write-Host "`nTesting executable..." -ForegroundColor Yellow
try {
    # Try to get version info without actually running the GUI
    $ProcessInfo = New-Object System.Diagnostics.ProcessStartInfo
    $ProcessInfo.FileName = $PublishExePath
    $ProcessInfo.Arguments = "--version"
    $ProcessInfo.UseShellExecute = $false
    $ProcessInfo.RedirectStandardOutput = $true
    $ProcessInfo.RedirectStandardError = $true
    $ProcessInfo.CreateNoWindow = $true
    
    $Process = New-Object System.Diagnostics.Process
    $Process.StartInfo = $ProcessInfo
    $Process.Start() | Out-Null
    $Process.WaitForExit(5000)  # Wait max 5 seconds
    
    if ($Process.ExitCode -eq 0) {
        Write-Host "  [OK] Executable runs successfully" -ForegroundColor Green
    } else {
        Write-Host "  [WARNING] Executable returned exit code: $($Process.ExitCode)" -ForegroundColor Yellow
    }
} catch {
    Write-Host "  [WARNING] Could not test executable: $_" -ForegroundColor Yellow
}

# Summary
Write-Host "`n=== Deployment Summary ===" -ForegroundColor Green
Write-Host "Publish Directory: $PublishDir" -ForegroundColor Yellow
Write-Host "Executable: $PublishExePath" -ForegroundColor Yellow

if ($MissingDlls.Count -eq 0) {
    Write-Host "`n[SUCCESS] All required Qt6 DLLs are present!" -ForegroundColor Green
    Write-Host "The application should now run without DLL errors." -ForegroundColor Green
} else {
    Write-Host "`n[WARNING] Missing DLLs: $($MissingDlls -join ', ')" -ForegroundColor Yellow
    Write-Host "The application may still have runtime issues." -ForegroundColor Yellow
}

Write-Host "`nTo run the application:" -ForegroundColor Cyan
Write-Host "  cd `"$PublishDir`"" -ForegroundColor Cyan
Write-Host "  .\QtScrcpy.exe" -ForegroundColor Cyan

Write-Host "`n=== Deployment completed! ===" -ForegroundColor Green
