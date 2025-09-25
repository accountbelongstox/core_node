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

# SimpleIconExtractor.ps1 - Simplified Windows Icon Extraction Utility

function Extract-IconFromFile {
    param(
        [Parameter(Mandatory=$true)]
        [string]$FilePath,
        
        [Parameter(Mandatory=$true)]
        [string]$OutputDir,
        
        [Parameter(Mandatory=$true)]
        [string]$IconName,
        
        [Parameter(Mandatory=$false)]
        [ValidateSet('ico', 'png')]
        [string]$Format = 'png'
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
                if ($shortcut.TargetPath -and (Test-Path $shortcut.TargetPath)) {
                    $targetPath = $shortcut.TargetPath
                }
            }
            catch {
                Write-Warning "Could not resolve shortcut target for '$FilePath'"
            }
        }
        
        $outputPath = Join-Path $OutputDir "$IconName.$Format"
        
        # Try to extract icon using .NET
        try {
            Add-Type -AssemblyName System.Drawing
            
            if ($targetPath.EndsWith('.exe') -and (Test-Path $targetPath)) {
                $icon = [System.Drawing.Icon]::ExtractAssociatedIcon($targetPath)
                if ($icon) {
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
                    Write-Host "Icon extracted: $outputPath" -ForegroundColor Green
                    return $outputPath
                }
            }
        }
        catch {
            Write-Warning "Failed to extract icon from '$FilePath': $($_.Exception.Message)"
        }
        
        return $null
    }
    catch {
        Write-Error "Error processing '$FilePath': $($_.Exception.Message)"
        return $null
    }
}

function Extract-IconsFromDirectory {
    param(
        [Parameter(Mandatory=$true)]
        [string]$SourceDir,
        
        [Parameter(Mandatory=$true)]
        [string]$OutputBaseDir,
        
        [Parameter(Mandatory=$false)]
        [ValidateSet('ico', 'png')]
        [string]$Format = 'png'
    )
    
    if (-not (Test-Path $SourceDir)) {
        Write-Error "Source directory does not exist: $SourceDir"
        return
    }
    
    Write-Host "Starting icon extraction from: $SourceDir" -ForegroundColor Cyan
    Write-Host "Output directory: $OutputBaseDir" -ForegroundColor Cyan
    
    $extractedCount = 0
    $failedCount = 0
    
    # Get all .lnk files recursively
    $files = Get-ChildItem -Path $SourceDir -Recurse -Include "*.lnk" -File
    
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
            
            Write-Host "Processing: $($file.Name)" -ForegroundColor Yellow
            
            $result = Extract-IconFromFile -FilePath $file.FullName -OutputDir $outputDir -IconName $iconName -Format $Format
            
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
