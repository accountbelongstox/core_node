# PostInstall Callback Processor
# 
# MAIN FUNCTIONALITY:
# 1. PostInstall Callback Processing - Handles all post-installation operations for packages
#    - File operations: copy, rename, delete files after package installation
#    - Package manager configuration: region-aware setup for pip, npm, java, etc.
#
# 2. Region-Aware Configuration - Supports China vs Global package manager mirrors
#    - Automatically detects SELECTED_REGION global variable
#    - Applies appropriate configuration parameters based on region
#
# 3. Unicode Filename Support - Handles Chinese filenames using Unicode variables
#    - Supports $Global:CHINESE_* variables for cross-platform compatibility
#
# INTEGRATION POINTS:
# - Called from Step21_InstallApplications.ps1 during package installation
# - Uses constants from GlobalVars.ps1 for consistent configuration
# - Integrates with package metadata PostInstallCallbacks array

# Import global variables and common functions
. (Join-Path $PSScriptRoot "GlobalVars.ps1")
. (Join-Path $PSScriptRoot "CommonFunc.ps1")
. (Join-Path $PSScriptRoot "StringEscapeUtils.ps1")

<#
.SYNOPSIS
    Comprehensive PostInstall Callback Processor

.DESCRIPTION
    This unified module provides complete post-installation callback processing including:
    
    CALLBACK TYPES SUPPORTED:
    - "copy": Copy files within package directory (SourceFile -> TargetFile)
    - "rename": Move/rename files within package directory (SourceFile -> TargetFile)  
    - "delete": Remove files from package directory (TargetFile)
    - "configurator": Execute package manager configuration commands with region awareness
    - "registry_template": Apply Windows registry templates with placeholder replacement
    
    SPECIAL FEATURES:
    - Region-aware configuration (China vs Global mirrors for package managers)
    - Unicode filename support via $Global:CHINESE_* variables
    - Comprehensive error handling and logging

.NOTES
    All file operations are relative to the package executable directory
    Configurator operations automatically detect and respect SELECTED_REGION global variable
#>

# ===== REGISTRY TEMPLATE FUNCTIONS =====

# Generic function to process registry templates
function Invoke-RegistryTemplateApplier {
    param(
        [Parameter(Mandatory = $true)]
        [string]$TemplateName,
        [Parameter(Mandatory = $true)]
        [hashtable]$Replacements,
        [Parameter(Mandatory = $true)]
        [string]$LogPrefix,
        [Parameter(Mandatory = $false)]
        [string]$RegFileName = ""
    )
    
    # Load template
    $templatePath = Join-Path $PSScriptRoot "registry_templates\$TemplateName"
    if (-not (Test-Path $templatePath)) {
        Write-Warning "$LogPrefix Template file not found: $templatePath"
        return $false
    }

    $templateContent = Get-Content -Path $templatePath -Raw

    # Apply all replacements
    $regContent = $templateContent
    foreach ($key in $Replacements.Keys) {
        $value = $Replacements[$key]
        # Escape backslashes for registry paths
        # OPERATION should already be properly escaped by caller using Escape-ForRegistryValue
        # Only escape EXECUTABLE_PATH and ICON_PATH (pure paths without quotes)
        if ($key -match "EXECUTABLE_PATH|ICON_PATH") {
            $value = $value -replace "\\", "\\"
        }
        # OPERATION and other complex command strings should be pre-escaped
        $regContent = $regContent -replace [regex]::Escape($key), $value
    }

    # Generate temporary reg file
    if ([string]::IsNullOrEmpty($RegFileName)) {
        $RegFileName = "$($TemplateName -replace '\.reg$', '')_$(Get-Date -Format 'yyyyMMdd_HHmmss').reg"
    }
    $regFilePath = Join-Path $Global:TEMP_DIR $RegFileName
    
    # Write reg file
    $regContent | Out-File -FilePath $regFilePath -Encoding ASCII
    Write-Host "$LogPrefix Generated reg file: $regFilePath" -ForegroundColor Cyan
    Write-Host "$LogPrefix Registry content:" -ForegroundColor Magenta
    Write-Host "$regContent" -ForegroundColor Gray
    
    # Import reg file
    try {
        $null = Start-Process -FilePath "reg.exe" -ArgumentList "import", "`"$regFilePath`"" -Wait -NoNewWindow
        Write-Host "$LogPrefix Successfully imported reg file" -ForegroundColor Green
        
        # Clean up temporary reg file
        Remove-Item -Path $regFilePath -Force -ErrorAction SilentlyContinue
        Write-Host "$LogPrefix Cleaned up temporary reg file" -ForegroundColor Cyan
        
        # Force Windows to refresh context menu cache
        Write-Host "$LogPrefix Refreshing Windows context menu cache..." -ForegroundColor Cyan
        try {
            # Send WM_SETTINGCHANGE message to refresh shell
            Add-Type -TypeDefinition @"
using System;
using System.Runtime.InteropServices;
public class Win32 {
    [DllImport("user32.dll", SetLastError = true)]
    public static extern IntPtr SendMessageTimeout(IntPtr hWnd, uint Msg, IntPtr wParam, string lParam, uint fuFlags, uint uTimeout, out IntPtr lpdwResult);
}
"@
            $HWND_BROADCAST = [IntPtr]0xffff
            $WM_SETTINGCHANGE = 0x001A
            $SMTO_ABORTIFHUNG = 0x0002
            $result = [IntPtr]::Zero
            [Win32]::SendMessageTimeout($HWND_BROADCAST, $WM_SETTINGCHANGE, [IntPtr]::Zero, "Environment", $SMTO_ABORTIFHUNG, 5000, [ref]$result)
            Write-Host "$LogPrefix Context menu cache refreshed successfully" -ForegroundColor Green
        } catch {
            Write-Host "$LogPrefix Warning: Could not refresh context menu cache: $($_.Exception.Message)" -ForegroundColor Yellow
        }
        
        return $true
    } catch {
        Write-Warning "$LogPrefix Error importing reg file: $($_.Exception.Message)"
        return $false
    }
}

# Function to process context menu callbacks
function Invoke-ContextMenuProcessor {
    param(
        [Parameter(Mandatory = $true)]
        [hashtable]$ContextMenuCallback,
        [Parameter(Mandatory = $true)]
        [string]$PackageName,
        [Parameter(Mandatory = $true)]
        [string]$ExecutablePath,
        [Parameter(Mandatory = $true)]
        [string]$InstallDir,
        [Parameter(Mandatory = $false)]
        [string]$LogPrefix = "[CONTEXT_MENU]"
    )

    # Validate required parameters
    if (-not $ContextMenuCallback.ContainsKey("Operation")) {
        Write-Warning "$LogPrefix Context menu callback missing 'Operation' parameter for $PackageName"
        return $false
    }

    # Debug: Check ExecutablePath
    Write-Host "$LogPrefix DEBUG: ExecutablePath = '$ExecutablePath'" -ForegroundColor Magenta
    Write-Host "$LogPrefix DEBUG: InstallDir = '$InstallDir'" -ForegroundColor Magenta
    
    if (-not $ExecutablePath -or -not (Test-Path $ExecutablePath)) {
        Write-Warning "$LogPrefix ERROR: ExecutablePath is invalid or file not found: '$ExecutablePath'"
        return $false
    }

    $operation = $ContextMenuCallback["Operation"]
    Write-Host "$LogPrefix Processing context menu operation: $operation for $PackageName" -ForegroundColor Cyan

    switch ($operation.ToLower()) {
            "add_file_context" {
                $fileExtensions = $ContextMenuCallback["FileExtensions"]
                $menuText = $ContextMenuCallback["MenuText"]
                $iconPath = $ContextMenuCallback["IconPath"]

                if (-not $fileExtensions -or -not $menuText) {
                    Write-Warning "$LogPrefix Missing required parameters for add_file_context operation"
                    return $false
                }

                # Check if wildcard pattern is used
                if ($fileExtensions -contains "*") {
                    Write-Host "$LogPrefix Detected wildcard pattern, using all_files_context template" -ForegroundColor Cyan
                    $actualIconPath = if ($iconPath) { $iconPath -replace "{{EXECUTABLE_PATH}}", $ExecutablePath } else { $ExecutablePath }

                    $replacements = @{
                        "{{MENU_TEXT}}" = $menuText
                        "{{ICON_PATH}}" = $actualIconPath
                        "{{EXECUTABLE_PATH}}" = $ExecutablePath
                    }

                    $result = Invoke-RegistryTemplateApplier -TemplateName "all_files_context.reg" -Replacements $replacements -LogPrefix "$LogPrefix [WILDCARD]"
                    if (-not $result) { return $false }

                    Write-Host "$LogPrefix Successfully processed wildcard file context" -ForegroundColor Green
                    return $true
                }

                # Process each file extension
                foreach ($extension in $fileExtensions) {
                    $extension = $extension.TrimStart('.')
                    $actualIconPath = if ($iconPath) { $iconPath -replace "{{EXECUTABLE_PATH}}", $ExecutablePath } else { $ExecutablePath }

                    $replacements = @{
                        "{{EXTENSION}}" = $extension
                        "{{MENU_TEXT}}" = $menuText
                        "{{ICON_PATH}}" = $actualIconPath
                        "{{EXECUTABLE_PATH}}" = $ExecutablePath
                    }

                    $result = Invoke-RegistryTemplateApplier -TemplateName "file_context.reg" -Replacements $replacements -LogPrefix "$LogPrefix [EXT:$extension]"
                    if (-not $result) { return $false }
                }

                Write-Host "$LogPrefix Successfully processed all file extensions: $($fileExtensions -join ', ')" -ForegroundColor Green
            }
            
            "add_all_files_context" {
                $menuText = $ContextMenuCallback["MenuText"]
                $iconPath = if ($ContextMenuCallback.ContainsKey("IconPath")) { $ContextMenuCallback["IconPath"] } else { $ExecutablePath }
                
                if (-not $menuText) {
                    Write-Warning "$LogPrefix Missing required parameters for add_all_files_context operation"
                    return $false
                }

                $replacements = @{
                    "{{MENU_TEXT}}" = $menuText
                    "{{ICON_PATH}}" = $iconPath
                    "{{EXECUTABLE_PATH}}" = $ExecutablePath
                }
                
                return Invoke-RegistryTemplateApplier -TemplateName "all_files_context.reg" -Replacements $replacements -LogPrefix $LogPrefix
            }
            
            "add_folder_context" {
                $menuText = $ContextMenuCallback["MenuText"]
                $iconPath = if ($ContextMenuCallback.ContainsKey("IconPath")) { $ContextMenuCallback["IconPath"] } else { $ExecutablePath }
                $command = if ($ContextMenuCallback.ContainsKey("Command")) { $ContextMenuCallback["Command"] } else { "" }

                if (-not $menuText) {
                    Write-Warning "$LogPrefix Missing required parameters for add_folder_context operation"
                    return $false
                }

                # If Command contains template placeholders, replace them and then escape for registry
                if ($command -and $command -match "{{.*}}") {
                    $command = $command -replace "{{EXECUTABLE_PATH}}", $ExecutablePath
                    # After template replacement, escape for registry format
                    $command = Escape-ForRegistryValue -InputString $command
                }

                $replacements = @{
                    "{{MENU_TEXT}}" = $menuText
                    "{{ICON_PATH}}" = $iconPath
                    "{{EXECUTABLE_PATH}}" = $ExecutablePath
                }

                # Add COMMAND to replacements if provided
                if ($command) {
                    $replacements["{{COMMAND}}"] = $command
                }

                return Invoke-RegistryTemplateApplier -TemplateName "folder_context.reg" -Replacements $replacements -LogPrefix $LogPrefix
            }
            
            "add_new_document" {
                $fileExtension = $ContextMenuCallback["FileExtension"]
                $menuText = $ContextMenuCallback["MenuText"]
                $iconPath = $ContextMenuCallback["IconPath"]
                
                if (-not $fileExtension -or -not $menuText) {
                    Write-Warning "$LogPrefix Missing required parameters for add_new_document operation"
                    return $false
                }

                $fileExtension = $fileExtension.TrimStart('.')

                $replacements = @{
                    "{{EXTENSION}}" = $fileExtension
                    "{{EXECUTABLE_PATH}}" = $ExecutablePath
                }
                
                return Invoke-RegistryTemplateApplier -TemplateName "new_document.reg" -Replacements $replacements -LogPrefix $LogPrefix
            }
            
            "add_7zip_context" {
                $menuText = $ContextMenuCallback["MenuText"]
                $iconPath = if ($ContextMenuCallback.ContainsKey("IconPath")) { $ContextMenuCallback["IconPath"] } else { $ExecutablePath }
                $command = $ContextMenuCallback["Command"]
                
                if (-not $menuText -or -not $command) {
                    Write-Warning "$LogPrefix Missing required parameters for add_7zip_context operation"
                    return $false
                }

                $replacements = @{
                    "{{MENU_TEXT}}" = $menuText
                    "{{ICON_PATH}}" = $iconPath
                    "{{EXECUTABLE_PATH}}" = $ExecutablePath
                    "{{OPERATION}}" = $command
                }
                
                return Invoke-RegistryTemplateApplier -TemplateName "7zip_context.reg" -Replacements $replacements -LogPrefix $LogPrefix
            }
            
            "add_7zip_folder_context" {
                $menuText = $ContextMenuCallback["MenuText"]
                $iconPath = if ($ContextMenuCallback.ContainsKey("IconPath")) { $ContextMenuCallback["IconPath"] } else { $ExecutablePath }
                $command = $ContextMenuCallback["Command"]
                
                if (-not $menuText -or -not $command) {
                    Write-Warning "$LogPrefix Missing required parameters for add_7zip_folder_context operation"
                    return $false
                }

                $replacements = @{
                    "{{MENU_TEXT}}" = $menuText
                    "{{ICON_PATH}}" = $iconPath
                    "{{EXECUTABLE_PATH}}" = $ExecutablePath
                    "{{OPERATION}}" = $command
                }
                
                return Invoke-RegistryTemplateApplier -TemplateName "7zip_folder_context.reg" -Replacements $replacements -LogPrefix $LogPrefix
            }
            
            default {
                Write-Warning "$LogPrefix Unknown context menu operation: $operation"
                return $false
            }
        }
        
        Write-Host "$LogPrefix Context menu operation completed successfully for $PackageName" -ForegroundColor Green
        return $true
}
# Function to process registry template callbacks
function Invoke-RegistryTemplateProcessor {
    param(
        [Parameter(Mandatory = $true)]
        [hashtable]$RegistryCallback,
        [Parameter(Mandatory = $true)]
        [string]$PackageName,
        [Parameter(Mandatory = $true)]
        [string]$ExecutablePath,
        [Parameter(Mandatory = $true)]
        [string]$InstallDir,
        [Parameter(Mandatory = $false)]
        [string]$LogPrefix = "[REGISTRY_TEMPLATE]"
    )

    # Validate required parameters
    if (-not $RegistryCallback.ContainsKey("TemplateFile")) {
        Write-Host "$LogPrefix Error: TemplateFile not specified in callback" -ForegroundColor Red
        return $false
    }

    if (-not $RegistryCallback.ContainsKey("Replacements")) {
        Write-Host "$LogPrefix Error: Replacements not specified in callback" -ForegroundColor Red
        return $false
    }

    $templateFile = $RegistryCallback.TemplateFile
    $replacements = $RegistryCallback.Replacements
    $description = if ($RegistryCallback.ContainsKey("Description")) { $RegistryCallback.Description } else { "Registry template processing" }
    $requiresAdmin = if ($RegistryCallback.ContainsKey("RequiresAdmin")) { $RegistryCallback.RequiresAdmin } else { $true }

    Write-Host "$LogPrefix Description: $description" -ForegroundColor Cyan
    Write-Host "$LogPrefix Template file: $templateFile" -ForegroundColor Cyan
    Write-Host "$LogPrefix Requires admin: $requiresAdmin" -ForegroundColor Cyan

    # Check admin privileges if required
    if ($requiresAdmin -and -not $Global:IS_RUN_ADMIN) {
        Write-Host "$LogPrefix Warning: Admin privileges required but not available. Registry changes may fail." -ForegroundColor Yellow
        Write-Host "$LogPrefix Continuing anyway - some registry operations may work without admin privileges" -ForegroundColor Yellow
    }

    try {
        # Resolve template file path
        $templatePath = Join-Path $Global:CORE_NODE_SCRIPTS_DIR $templateFile
        
        if (-not (Test-Path $templatePath)) {
            Write-Host "$LogPrefix Error: Template file not found: $templatePath" -ForegroundColor Red
            return $false
        }

        Write-Host "$LogPrefix Loading template from: $templatePath" -ForegroundColor Cyan

        # Read template content
        $templateContent = Get-Content -Path $templatePath -Raw -Encoding UTF8

        if ([string]::IsNullOrWhiteSpace($templateContent)) {
            Write-Host "$LogPrefix Error: Template file is empty or could not be read" -ForegroundColor Red
            return $false
        }

        # Process replacements
        $processedContent = $templateContent
        foreach ($placeholder in $replacements.Keys) {
            $replacementValue = $replacements[$placeholder]
            
            # Handle special replacement values
            if ($replacementValue -eq "EXECUTABLE_PATH") {
                $replacementValue = $ExecutablePath.Replace('\', '\\')
                Write-Host "$LogPrefix Replacing '$placeholder' with executable path: $ExecutablePath" -ForegroundColor Cyan
            }
            elseif ($replacementValue -eq "INSTALL_DIR") {
                $replacementValue = $InstallDir.Replace('\', '\\')
                Write-Host "$LogPrefix Replacing '$placeholder' with install directory: $InstallDir" -ForegroundColor Cyan
            }
            elseif ($replacementValue -eq "ICON_PATH") {
                # Generate icon path based on executable path
                $executableDir = Split-Path $ExecutablePath -Parent
                $iconPath = Join-Path $executableDir "terminal.ico"
                
                # Check if terminal.ico exists, if not use cmd.exe as fallback
                if (Test-Path $iconPath) {
                    $replacementValue = $iconPath.Replace('\', '\\')
                    Write-Host "$LogPrefix Replacing '$placeholder' with icon path: $iconPath" -ForegroundColor Cyan
                }
                else {
                    # Use cmd.exe as fallback icon (always available on Windows)
                    $cmdPath = Join-Path $env:SystemRoot "System32\cmd.exe"
                    $replacementValue = $cmdPath.Replace('\', '\\')
                    Write-Host "$LogPrefix Icon file not found, using cmd.exe as icon: $cmdPath" -ForegroundColor Cyan
                }
            }
            else {
                # Escape backslashes for registry format
                $replacementValue = $replacementValue.Replace('\', '\\')
                Write-Host "$LogPrefix Replacing '$placeholder' with: $replacementValue" -ForegroundColor Cyan
            }
            
            $processedContent = $processedContent.Replace($placeholder, $replacementValue)
        }

        # Create temporary registry file
        $tempRegFile = Join-Path $Global:TEMP_DIR "temp_registry_$PackageName.reg"
        
        # Ensure temp directory exists
        if (-not (Test-Path $Global:TEMP_DIR)) {
            New-Item -ItemType Directory -Path $Global:TEMP_DIR -Force | Out-Null
        }

        # Write processed content to temporary file
        Set-Content -Path $tempRegFile -Value $processedContent -Encoding UTF8
        Write-Host "$LogPrefix Created temporary registry file: $tempRegFile" -ForegroundColor Cyan

        # Apply registry changes
        Write-Host "$LogPrefix Applying registry changes..." -ForegroundColor Cyan
        
        try {
            # Try reg.exe first
            $null = Start-Process -FilePath "reg.exe" -ArgumentList "import", "`"$tempRegFile`"" -Wait -WindowStyle Hidden
            Write-Host "$LogPrefix Registry changes applied successfully using reg.exe" -ForegroundColor Green
            $success = $true
        }
        catch {
            Write-Host "$LogPrefix reg.exe failed, trying regedit.exe..." -ForegroundColor Yellow
            try {
                $null = Start-Process -FilePath "regedit.exe" -ArgumentList "/s", "`"$tempRegFile`"" -Wait -WindowStyle Hidden
                Write-Host "$LogPrefix Registry changes applied successfully using regedit.exe" -ForegroundColor Green
                $success = $true
            }
            catch {
                Write-Host "$LogPrefix Error: Both reg.exe and regedit.exe failed to apply registry changes" -ForegroundColor Red
                Write-Host "$LogPrefix Error: $($_.Exception.Message)" -ForegroundColor Red
                $success = $false
            }
        }

        # Clean up temporary file
        try {
            if (Test-Path $tempRegFile) {
                Remove-Item -Path $tempRegFile -Force
                Write-Host "$LogPrefix Cleaned up temporary registry file" -ForegroundColor Cyan
            }
        }
        catch {
            Write-Host "$LogPrefix Warning: Could not clean up temporary file: $tempRegFile" -ForegroundColor Yellow
        }

        return $success
    }
    catch {
        Write-Host "$LogPrefix Error processing registry template: $($_.Exception.Message)" -ForegroundColor Red
        return $false
    }
}

# ===== MAIN POSTINSTALL CALLBACK PROCESSOR =====

# Function to process post-installation callbacks for packages
function Invoke-PostInstallCallbacks {
    param(
        [string]$PackageName,
        [hashtable]$PackageMeta,
        [string]$ExecutablePath,
        [string]$InstallDir,
        [string]$LogPrefix = "[PostInstall]"
    )
    
    if (-not $PackageMeta.ContainsKey("PostInstallCallbacks") -or -not $PackageMeta.PostInstallCallbacks) {
        return
    }
    
    Write-Host "$LogPrefix Processing PostInstallCallbacks for $PackageName..." -ForegroundColor Cyan
    
    foreach ($callback in $PackageMeta.PostInstallCallbacks) {
        $callbackType = if ($callback.ContainsKey("Type")) { $callback.Type } else { "" }
        
        if (-not $callbackType) {
            Write-Host "$LogPrefix Warning: Invalid callback configuration - Type missing" -ForegroundColor Yellow
            continue
        }
        
        Write-Host "$LogPrefix Executing callback: $callbackType" -ForegroundColor Cyan
        
        try {
            switch ($callbackType.ToLower()) {
                "copy" {
                    $sourceFile = if ($callback.ContainsKey("SourceFile")) { $callback.SourceFile } else { "" }
                    $targetFile = if ($callback.ContainsKey("TargetFile")) { $callback.TargetFile } else { "" }
                    
                    if (-not $sourceFile -or -not $targetFile) {
                        Write-Host "$LogPrefix Error: Copy callback missing SourceFile or TargetFile" -ForegroundColor Red
                        continue
                    }
                    
                    # Determine source and target paths
                    $sourcePath = Join-Path (Split-Path $ExecutablePath -Parent) $sourceFile
                    $targetPath = Join-Path (Split-Path $ExecutablePath -Parent) $targetFile
                    
                    if (Test-Path $sourcePath) {
                        Copy-Item -Path $sourcePath -Destination $targetPath -Force
                        Write-Host "$LogPrefix Successfully copied: $sourceFile -> $targetFile" -ForegroundColor Green
                    } else {
                        Write-Host "$LogPrefix Warning: Source file not found: $sourcePath" -ForegroundColor Yellow
                    }
                }
                "rename" {
                    $sourceFile = if ($callback.ContainsKey("SourceFile")) { $callback.SourceFile } else { "" }
                    $targetFile = if ($callback.ContainsKey("TargetFile")) { $callback.TargetFile } else { "" }
                    
                    if (-not $sourceFile -or -not $targetFile) {
                        Write-Host "$LogPrefix Error: Rename callback missing SourceFile or TargetFile" -ForegroundColor Red
                        continue
                    }
                    
                    $sourcePath = Join-Path (Split-Path $ExecutablePath -Parent) $sourceFile
                    $targetPath = Join-Path (Split-Path $ExecutablePath -Parent) $targetFile
                    
                    if (Test-Path $sourcePath) {
                        Move-Item -Path $sourcePath -Destination $targetPath -Force
                        Write-Host "$LogPrefix Successfully renamed: $sourceFile -> $targetFile" -ForegroundColor Green
                    } else {
                        Write-Host "$LogPrefix Warning: Source file not found for rename: $sourcePath" -ForegroundColor Yellow
                    }
                }
                "delete" {
                    $targetFile = if ($callback.ContainsKey("TargetFile")) { $callback.TargetFile } else { "" }
                    
                    if (-not $targetFile) {
                        Write-Host "$LogPrefix Error: Delete callback missing TargetFile" -ForegroundColor Red
                        continue
                    }
                    
                    $targetPath = Join-Path (Split-Path $ExecutablePath -Parent) $targetFile
                    
                    if (Test-Path $targetPath) {
                        Remove-Item -Path $targetPath -Force
                        Write-Host "$LogPrefix Successfully deleted: $targetFile" -ForegroundColor Green
                    } else {
                        Write-Host "$LogPrefix Warning: Target file not found for deletion: $targetPath" -ForegroundColor Yellow
                    }
                }
                "configurator" {
                    $executable = if ($callback.ContainsKey("Executable")) { $callback.Executable } else { "" }
                    $globalParams = if ($callback.ContainsKey("GlobalParameters")) { $callback.GlobalParameters } else { @() }
                    $nonGlobalParams = if ($callback.ContainsKey("NonGlobalParameters")) { $callback.NonGlobalParameters } else { @() }
                    $configNote = if ($callback.ContainsKey("ConfigNote")) { $callback.ConfigNote } else { "Package manager configuration" }
                    
                    if (-not $executable) {
                        Write-Host "$LogPrefix Error: Configurator callback missing Executable" -ForegroundColor Red
                        continue
                    }
                    
                    # Get current region setting from global variables
                    $selectedRegion = Get-GlobalVar -key "SELECTED_REGION" -defaultValue "Global"
                    Write-Host "$LogPrefix Configurator: Current region is '$selectedRegion'" -ForegroundColor Cyan
                    Write-Host "$LogPrefix Configurator: $configNote" -ForegroundColor Cyan
                    
                    # Determine which parameters to use based on region
                    $parametersToUse = @()
                    if ($selectedRegion -eq "China") {
                        $parametersToUse = if ($nonGlobalParams -is [array]) { $nonGlobalParams } else { @($nonGlobalParams) }
                        Write-Host "$LogPrefix Configurator: Using China region settings" -ForegroundColor Cyan
                    } else {
                        $parametersToUse = if ($globalParams -is [array]) { $globalParams } else { @($globalParams) }
                        Write-Host "$LogPrefix Configurator: Using Global region settings" -ForegroundColor Cyan
                    }

                    # Ensure parametersToUse is an array and check count safely
                    if (-not $parametersToUse -or ($parametersToUse -is [array] -and $parametersToUse.Count -eq 0) -or ($parametersToUse -isnot [array] -and -not $parametersToUse)) {
                        Write-Host "$LogPrefix Configurator: No configuration needed for region '$selectedRegion'" -ForegroundColor Yellow
                        continue
                    }
                    
                    # Construct executable path
                    $executablePath = Join-Path (Split-Path $ExecutablePath -Parent) $executable
                    
                    if (-not (Test-Path $executablePath)) {
                        Write-Host "$LogPrefix Warning: Configurator executable not found: $executablePath" -ForegroundColor Yellow
                        continue
                    }
                    
                    # Execute each configuration command
                    # Ensure parametersToUse is treated as array
                    $paramArray = if ($parametersToUse -is [array]) { $parametersToUse } else { @($parametersToUse) }

                    foreach ($paramSet in $paramArray) {
                        if ($paramSet -and ($paramSet -is [array] -and $paramSet.Count -gt 0)) {
                            $argumentList = $paramSet -join " "
                            Write-Host "$LogPrefix Configurator: Executing '$executable $argumentList'" -ForegroundColor Cyan

                            try {
                                $result = & $executablePath @paramSet 2>&1
                                Write-Host "$LogPrefix Configurator: Successfully executed command" -ForegroundColor Green
                                if ($result) {
                                    Write-Host "$LogPrefix Configurator output: $result" -ForegroundColor Green
                                }
                            }
                            catch {
                                Write-Host "$LogPrefix Configurator: Error executing command: $($_.Exception.Message)" -ForegroundColor Red
                            }
                        } elseif ($paramSet) {
                            Write-Host "$LogPrefix Configurator: Skipping invalid parameter set: $paramSet" -ForegroundColor Yellow
                        }
                    }
                }
                "context_menu" {
                    Write-Host "$LogPrefix Processing context menu callback for $PackageName" -ForegroundColor Cyan
                    $success = Invoke-ContextMenuProcessor -ContextMenuCallback $callback -PackageName $PackageName -ExecutablePath $ExecutablePath -InstallDir $InstallDir -LogPrefix "$LogPrefix [CONTEXT_MENU]"
                    if ($success) {
                        Write-Host "$LogPrefix Context menu callback completed successfully" -ForegroundColor Green
                    } else {
                        Write-Host "$LogPrefix Context menu callback failed" -ForegroundColor Red
                    }
                }
                "command" {
                    $command = if ($callback.ContainsKey("Command")) { $callback.Command } else { "" }
                    $workingDirectory = if ($callback.ContainsKey("WorkingDirectory")) { $callback.WorkingDirectory } else { $null }
                    $description = if ($callback.ContainsKey("Description")) { $callback.Description } else { "Run post-install command" }
                    if (-not $command) {
                        Write-Host "$LogPrefix Error: Command callback missing Command" -ForegroundColor Red
                        continue
                    }
                    Write-Host "$LogPrefix $description" -ForegroundColor Cyan
                    try {
                        if ($workingDirectory -and (Test-Path $workingDirectory)) {
                            Push-Location $workingDirectory
                        }
                        try {
                            Invoke-Expression -Command $command
                            Write-Host "$LogPrefix Command completed" -ForegroundColor Green
                        }
                        finally {
                            if ($workingDirectory -and (Test-Path $workingDirectory)) {
                                Pop-Location
                            }
                        }
                    }
                    catch {
                        Write-Host "$LogPrefix Command failed: $($_.Exception.Message)" -ForegroundColor Red
                    }
                }
                "pnpm_config_separator" {
                    Write-Host "$LogPrefix Processing pnpm config separator callback for $PackageName" -ForegroundColor Cyan
                    $description = if ($callback.ContainsKey("Description")) { $callback.Description } else { "Create .pnpmrc to separate pnpm from npm configuration" }
                    Write-Host "$LogPrefix $description" -ForegroundColor Cyan

                    # Create .pnpmrc in the project root to separate pnpm-specific configuration from npm
                    # This prevents npm from showing warnings about unknown pnpm configuration options
                    $projectRoot = $Global:PROJECT_DIR
                    if (-not [string]::IsNullOrWhiteSpace($projectRoot) -and (Test-Path $projectRoot)) {
                        $pnpmrcPath = Join-Path $projectRoot ".pnpmrc"

                        # Create .pnpmrc with pnpm-specific configuration
                        $pnpmrcContent = @"
# pnpm configuration for Electron project

# Use hoisted node_modules structure (better for Electron)
node-linker=hoisted

# Auto install peer dependencies
auto-install-peers=true

# Hoist Electron and native modules to root
public-hoist-pattern[]=*electron*
public-hoist-pattern[]=*sqlite3*
public-hoist-pattern[]=*better-sqlite3*
public-hoist-pattern[]=*puppeteer*
public-hoist-pattern[]=@electron/*

# Ignore workspace (we don't use workspace mode)
# This ensures pnpm only manages root project
recursive-install=false
"@

                        try {
                            # Write the .pnpmrc file
                            $pnpmrcContent | Out-File -FilePath $pnpmrcPath -Encoding UTF8 -Force
                            Write-Host "$LogPrefix Successfully created .pnpmrc at: $pnpmrcPath" -ForegroundColor Green

                            # Also ensure .npmrc contains only npm-specific settings
                            $npmrcPath = Join-Path $projectRoot ".npmrc"
                            $npmrcContent = @"
# npm configuration for Node.js packages

# Auto install peer dependencies
auto-install-peers=true
"@

                            $npmrcContent | Out-File -FilePath $npmrcPath -Encoding UTF8 -Force
                            Write-Host "$LogPrefix Successfully updated .npmrc at: $npmrcPath" -ForegroundColor Green
                            Write-Host "$LogPrefix Configuration separation completed - npm will no longer warn about pnpm settings" -ForegroundColor Green
                        }
                        catch {
                            Write-Host "$LogPrefix Error creating .pnpmrc: $($_.Exception.Message)" -ForegroundColor Red
                        }
                    } else {
                        Write-Host "$LogPrefix Error: PROJECT_DIR not set or does not exist" -ForegroundColor Red
                    }
                }
                default {
                    # Generic processor lookup mechanism
                    Write-Host "$LogPrefix Processing $callbackType callback for $PackageName" -ForegroundColor Cyan

                    # Look for processor in postinstall directory
                    $postInstallDir = Join-Path (Split-Path $PSScriptRoot -Parent) "install_powershells\postinstall"
                    $processorName = "${callbackType}PostInstallProcessor.ps1"
                    $processorPath = Join-Path $postInstallDir $processorName

                    if (Test-Path $processorPath) {
                        Write-Host "$LogPrefix Found processor: $processorName" -ForegroundColor Cyan
                        try {
                            # Import the processor script
                            . $processorPath

                            # Construct the function name based on callback type
                            $functionName = "Invoke-${callbackType}PostInstallProcessor"

                            # Check if the function exists
                            if (Get-Command $functionName -ErrorAction SilentlyContinue) {
                                Write-Host "$LogPrefix Calling function: $functionName" -ForegroundColor Yellow

                                # Call the processor function with standard parameters
                                $processorParams = @{
                                    "${callbackType}Callback" = $callback
                                    PackageName = $PackageName
                                    ExecutablePath = $ExecutablePath
                                    InstallDir = $InstallDir
                                    LogPrefix = "$LogPrefix [$($callbackType.ToUpper())]"
                                }

                                $success = & $functionName @processorParams

                                if ($success) {
                                    Write-Host "$LogPrefix $callbackType callback completed successfully" -ForegroundColor Green
                                } else {
                                    Write-Host "$LogPrefix $callbackType callback failed" -ForegroundColor Red
                                }
                            } else {
                                Write-Host "$LogPrefix Error: Function $functionName not found in processor" -ForegroundColor Red
                            }
                        }
                        catch {
                            Write-Host "$LogPrefix Error processing $callbackType callback: $($_.Exception.Message)" -ForegroundColor Red
                        }
                    } else {
                        Write-Host "$LogPrefix Warning: No processor found for callback type '$callbackType'" -ForegroundColor Yellow
                        Write-Host "$LogPrefix Expected processor: $processorPath" -ForegroundColor Gray
                        Write-Host "$LogPrefix Skipping callback..." -ForegroundColor Gray
                    }
                }
            }
        }
        catch {
            Write-Host "$LogPrefix Error executing callback $callbackType`: $($_.Exception.Message)" -ForegroundColor Red
        }
    }
    
    Write-Host "$LogPrefix PostInstallCallbacks processing completed for $PackageName" -ForegroundColor Green
}