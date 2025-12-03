# Fix JAVA_HOME Environment Variable
# This script helps fix JAVA_HOME configuration for React Native development

Write-Host "========================================" -ForegroundColor Cyan
Write-Host "   Java Environment Fixer" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""

$currentJavaHome = $env:JAVA_HOME
if ($currentJavaHome) {
    Write-Host "Current JAVA_HOME: $currentJavaHome" -ForegroundColor Yellow
    
    # Check if it ends with \bin (incorrect)
    if ($currentJavaHome.EndsWith("\bin")) {
        $corrected = $currentJavaHome.Substring(0, $currentJavaHome.Length - 4)
        Write-Host "JAVA_HOME incorrectly points to bin directory!" -ForegroundColor Red
        Write-Host "Corrected path: $corrected" -ForegroundColor Green
        
        # Test if corrected path is valid
        if (Test-Path (Join-Path $corrected "bin\java.exe")) {
            Write-Host ""
            Write-Host "To fix permanently, run this command:" -ForegroundColor Yellow
            Write-Host "[System.Environment]::SetEnvironmentVariable('JAVA_HOME', '$corrected', 'User')" -ForegroundColor Cyan
            Write-Host ""
            Write-Host "Or set it for this session:" -ForegroundColor Yellow
            Write-Host "`$env:JAVA_HOME = '$corrected'" -ForegroundColor Cyan
            Write-Host ""
            
            $setNow = Read-Host "Set JAVA_HOME for this session now? (y/n)"
            if ($setNow -eq "y" -or $setNow -eq "Y") {
                $env:JAVA_HOME = $corrected
                Write-Host "JAVA_HOME set to: $env:JAVA_HOME" -ForegroundColor Green
            }
        } else {
            Write-Host "Corrected path is also invalid. Searching for Java..." -ForegroundColor Yellow
            $currentJavaHome = $null
        }
    } else {
        # Check if current JAVA_HOME is valid
        if (Test-Path (Join-Path $currentJavaHome "bin\java.exe")) {
            Write-Host "JAVA_HOME is correctly configured!" -ForegroundColor Green
            exit 0
        } else {
            Write-Host "JAVA_HOME path is invalid. Searching for Java..." -ForegroundColor Yellow
            $currentJavaHome = $null
        }
    }
}

# Search for Java installations
if (-not $currentJavaHome) {
    Write-Host ""
    Write-Host "Searching for Java installations..." -ForegroundColor Yellow
    
    $javaPaths = @(
        "${env:ProgramFiles}\Java",
        "${env:ProgramFiles(x86)}\Java",
        "C:\Program Files\Java",
        "C:\Program Files (x86)\Java",
        "${env:LOCALAPPDATA}\Programs\Android\Android Studio\jbr",
        "${env:ProgramFiles}\Android\Android Studio\jbr",
        "C:\Program Files\Android\Android Studio\jbr"
    )
    
    $foundJavas = @()
    foreach ($basePath in $javaPaths) {
        if (Test-Path $basePath) {
            $jdkDirs = Get-ChildItem -Path $basePath -Directory -ErrorAction SilentlyContinue | 
                Where-Object { $_.Name -like "jdk*" -or $_.Name -like "jbr*" }
            
            foreach ($jdkDir in $jdkDirs) {
                $javaExe = Join-Path $jdkDir.FullName "bin\java.exe"
                if (Test-Path $javaExe) {
                    $version = & $javaExe -version 2>&1 | Select-Object -First 1
                    $foundJavas += [PSCustomObject]@{
                        Path = $jdkDir.FullName
                        Name = $jdkDir.Name
                        Version = $version
                    }
                }
            }
        }
    }
    
    if ($foundJavas.Count -eq 0) {
        Write-Host ""
        Write-Host "No Java installations found!" -ForegroundColor Red
        Write-Host ""
        Write-Host "Please install Java JDK:" -ForegroundColor Yellow
        Write-Host "1. Download from: https://adoptium.net/" -ForegroundColor Cyan
        Write-Host "2. Or use Android Studio's bundled JDK" -ForegroundColor Cyan
        Write-Host ""
        exit 1
    }
    
    Write-Host ""
    Write-Host "Found Java installations:" -ForegroundColor Green
    for ($i = 0; $i -lt $foundJavas.Count; $i++) {
        Write-Host "$($i + 1). $($foundJavas[$i].Path) - $($foundJavas[$i].Version)" -ForegroundColor White
    }
    Write-Host ""
    
    if ($foundJavas.Count -eq 1) {
        $selected = $foundJavas[0]
        Write-Host "Using: $($selected.Path)" -ForegroundColor Green
    } else {
        $choice = Read-Host "Select Java installation (1-$($foundJavas.Count))"
        $index = [int]$choice - 1
        if ($index -ge 0 -and $index -lt $foundJavas.Count) {
            $selected = $foundJavas[$index]
        } else {
            Write-Host "Invalid selection!" -ForegroundColor Red
            exit 1
        }
    }
    
    Write-Host ""
    Write-Host "To set JAVA_HOME permanently (User level):" -ForegroundColor Yellow
    Write-Host "[System.Environment]::SetEnvironmentVariable('JAVA_HOME', '$($selected.Path)', 'User')" -ForegroundColor Cyan
    Write-Host ""
    Write-Host "To set JAVA_HOME for this session:" -ForegroundColor Yellow
    Write-Host "`$env:JAVA_HOME = '$($selected.Path)'" -ForegroundColor Cyan
    Write-Host ""
    
    $setNow = Read-Host "Set JAVA_HOME for this session now? (y/n)"
    if ($setNow -eq "y" -or $setNow -eq "Y") {
        $env:JAVA_HOME = $selected.Path
        Write-Host "JAVA_HOME set to: $env:JAVA_HOME" -ForegroundColor Green
        Write-Host ""
        Write-Host "Verifying..." -ForegroundColor Yellow
        & (Join-Path $env:JAVA_HOME "bin\java.exe") -version
    }
}

Write-Host ""
Write-Host "Done!" -ForegroundColor Green

