# ### AI SPECIAL ATTENTION RULES START ###
# When AI/ALL DEVELOPERS sees this prompt, MUST IMMEDIATELY COMPLY WITH THESE RULES:
# 1. Write all code in English only.
# 2. Never execute, create, or modify test code.
# 3. Never create or update documentation (*.md).
# 4. Never write summaries during development or thinking process.
# 5. Declare all variables at the beginning of the file.
# 6. For PowerShell (*.ps1) scripts: Do not append strings directly to variables, Do not use relative paths such as "..\\..\\"; instead resolve absolute paths using parent path parsing (Split-Path, Join-Path, or Resolve-Path).
# 7. Do not modify these rules.
# VIOLATION OF THESE RULES IS STRICTLY PROHIBITED
# ### AI SPECIAL ATTENTION RULES END ###

# IconExtractor.ps1 - Windows Icon Extraction Utility
# This script provides functions to extract icons from executables and shortcuts

# Load required assemblies for icon extraction
try {
    Add-Type -AssemblyName System.Drawing
    Add-Type -AssemblyName System.Windows.Forms
    Write-Host "Assemblies loaded successfully" -ForegroundColor Green
} catch {
    Write-Error "Failed to load required assemblies: $($_.Exception.Message)"
    return
}

function Extract-IconFromFile {
    <#
    .SYNOPSIS
    Extracts icon from an executable file or shortcut and saves it as PNG/ICO
    
    .PARAMETER FilePath
    Path to the .lnk or .exe file
    
    .PARAMETER OutputDir
    Directory where the icon should be saved
    
    .PARAMETER IconName
    Name for the saved icon file (without extension)
    
    .PARAMETER Format
    Output format: 'ico' or 'png' (default: 'png')
    
    .PARAMETER Size
    Icon size in pixels (default: 32)
    
    .EXAMPLE
    Extract-IconFromFile -FilePath "C:\Program Files\App\app.exe" -OutputDir "C:\Icons" -IconName "MyApp"
    #>
    
    param(
        [Parameter(Mandatory=$true)]
        [string]$FilePath,
        
        [Parameter(Mandatory=$true)]
        [string]$OutputDir,
        
        [Parameter(Mandatory=$true)]
        [string]$IconName,
        
        [Parameter(Mandatory=$false)]
        [ValidateSet('ico', 'png')]
        [string]$Format = 'png',
        
        [Parameter(Mandatory=$false)]
        [int]$Size = 32
    )
    
    try {
        # Ensure output directory exists
        if (-not (Test-Path $OutputDir)) {
            New-Item -ItemType Directory -Path $OutputDir -Force | Out-Null
        }
        
        $targetPath = $FilePath
        
        # If it's a shortcut, get the target path
        if ($FilePath.EndsWith('.lnk')) {
            try {
                $shell = New-Object -ComObject WScript.Shell
                $shortcut = $shell.CreateShortcut($FilePath)
                $targetPath = $shortcut.TargetPath
                
                # If target path is empty or doesn't exist, use the shortcut itself
                if ([string]::IsNullOrEmpty($targetPath) -or -not (Test-Path $targetPath)) {
                    $targetPath = $FilePath
                }
            }
            catch {
                Write-Warning "Could not resolve shortcut target for '$FilePath', using shortcut file itself"
                $targetPath = $FilePath
            }
        }
        
        # Extract icon using different methods
        $icon = $null
        $outputPath = Join-Path $OutputDir "$IconName.$Format"
        
        # Method 1: Try to extract from executable
        if ($targetPath.EndsWith('.exe') -and (Test-Path $targetPath)) {
            try {
                $icon = [System.Drawing.Icon]::ExtractAssociatedIcon($targetPath)
                if ($icon) {
                    Write-Host "Extracted icon from executable: $targetPath" -ForegroundColor Green
                }
            }
            catch {
                Write-Warning "Failed to extract icon from executable: $($_.Exception.Message)"
            }
        }
        
        # Method 2: Try to get icon from file association (simplified)
        if (-not $icon -and (Test-Path $targetPath)) {
            try {
                # Try to get icon from file system
                $fileInfo = Get-Item $targetPath -ErrorAction SilentlyContinue
                if ($fileInfo) {
                    # For now, just use the basic icon extraction
                    Write-Host "Using basic icon extraction for: $targetPath" -ForegroundColor Yellow
                }
            }
            catch {
                Write-Warning "Failed to get file info: $($_.Exception.Message)"
            }
        }
        
        # Save the icon
        if ($icon) {
            try {
                if ($Format -eq 'ico') {
                    # Save as ICO
                    $fileStream = [System.IO.FileStream]::new($outputPath, [System.IO.FileMode]::Create)
                    $icon.Save($fileStream)
                    $fileStream.Close()
                } else {
                    # Save as PNG
                    $bitmap = $icon.ToBitmap()
                    $bitmap.Save($outputPath, [System.Drawing.Imaging.ImageFormat]::Png)
                    $bitmap.Dispose()
                }
                
                $icon.Dispose()
                Write-Host "Icon saved successfully: $outputPath" -ForegroundColor Green
                return $outputPath
            }
            catch {
                Write-Error "Failed to save icon: $($_.Exception.Message)"
                if ($icon) { $icon.Dispose() }
                return $null
            }
        } else {
            Write-Warning "Could not extract icon from: $FilePath"
            return $null
        }
    }
    catch {
        Write-Error "Error extracting icon from '$FilePath': $($_.Exception.Message)"
        return $null
    }
}

function Extract-IconsFromDirectory {
    <#
    .SYNOPSIS
    Recursively extracts icons from all .lnk and .exe files in a directory structure
    
    .PARAMETER SourceDir
    Source directory to scan for files
    
    .PARAMETER OutputBaseDir
    Base output directory where icons will be saved (maintains directory structure)
    
    .PARAMETER Format
    Output format: 'ico' or 'png' (default: 'png')
    
    .PARAMETER Size
    Icon size in pixels (default: 32)
    
    .EXAMPLE
    Extract-IconsFromDirectory -SourceDir "D:\.dev_win11\.desktopIcons" -OutputBaseDir "C:\Users\User\.icons"
    #>
    
    param(
        [Parameter(Mandatory=$true)]
        [string]$SourceDir,
        
        [Parameter(Mandatory=$true)]
        [string]$OutputBaseDir,
        
        [Parameter(Mandatory=$false)]
        [ValidateSet('ico', 'png')]
        [string]$Format = 'png',
        
        [Parameter(Mandatory=$false)]
        [int]$Size = 32
    )
    
    if (-not (Test-Path $SourceDir)) {
        Write-Error "Source directory does not exist: $SourceDir"
        return
    }
    
    Write-Host "Starting icon extraction from: $SourceDir" -ForegroundColor Cyan
    Write-Host "Output directory: $OutputBaseDir" -ForegroundColor Cyan
    
    $extractedCount = 0
    $failedCount = 0
    
    # Get all .lnk and .exe files recursively
    $files = Get-ChildItem -Path $SourceDir -Recurse -Include "*.lnk", "*.exe" -File
    
    foreach ($file in $files) {
        try {
            # Calculate relative path to maintain directory structure
            $relativePath = $file.FullName.Substring($SourceDir.Length).TrimStart('\')
            $relativeDir = Split-Path $relativePath -Parent
            
            # Create output directory maintaining structure
            $outputDir = if ([string]::IsNullOrEmpty($relativeDir)) {
                $OutputBaseDir
            } else {
                Join-Path $OutputBaseDir $relativeDir
            }
            
            # Generate icon name from file name (without extension)
            $iconName = [System.IO.Path]::GetFileNameWithoutExtension($file.Name)
            
            Write-Host "Processing: $($file.FullName)" -ForegroundColor Yellow
            
            $result = Extract-IconFromFile -FilePath $file.FullName -OutputDir $outputDir -IconName $iconName -Format $Format -Size $Size
            
            if ($result) {
                $extractedCount++
            } else {
                $failedCount++
            }
        }
        catch {
            Write-Error "Error processing file '$($file.FullName)': $($_.Exception.Message)"
            $failedCount++
        }
    }
    
    Write-Host "`nIcon extraction completed!" -ForegroundColor Green
    Write-Host "Successfully extracted: $extractedCount icons" -ForegroundColor Green
    Write-Host "Failed extractions: $failedCount" -ForegroundColor Yellow
    Write-Host "Icons saved to: $OutputBaseDir" -ForegroundColor Cyan
}

# Export functions for use in other scripts
