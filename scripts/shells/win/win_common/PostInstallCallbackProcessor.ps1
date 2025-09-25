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

# PostInstall Callback Processor with Integrated MCP Configuration Handler
# 
# MAIN FUNCTIONALITY:
# 1. PostInstall Callback Processing - Handles all post-installation operations for packages
#    - File operations: copy, rename, delete files after package installation
#    - Package manager configuration: region-aware setup for pip, npm, java, etc.
#    - MCP (Model Context Protocol) configuration processing
#
# 2. MCP Configuration Management - Specialized JSON manipulation for MCP files
#    - Fuzzy search and replace within JSON quoted strings
#    - Template-based MCP configuration initialization
#    - Configuration file copying and merging operations
#    - Automatic path resolution for MCP server executable paths
#
# 3. Region-Aware Configuration - Supports China vs Global package manager mirrors
#    - Automatically detects SELECTED_REGION global variable
#    - Applies appropriate configuration parameters based on region
#
# 4. Unicode Filename Support - Handles Chinese filenames using Unicode variables
#    - Supports $Global:CHINESE_* variables for cross-platform compatibility
#
# INTEGRATION POINTS:
# - Called from Step12_InstallApplications.ps1 during package installation
# - Uses constants from GlobalVars.ps1 for consistent configuration
# - Integrates with package metadata PostInstallCallbacks array

# Import global variables and common functions
. "$PSScriptRoot\GlobalVars.ps1"
. "$PSScriptRoot\CommanFunc.ps1"

# MCP path constants - Fixed paths for consistent MCP configuration handling
$Global:MCP_CONFIG_PATH = Join-Path $Global:PROJECT_DIR ".prompt\mcp.json"
$Global:MCP_TEMPLATE_PATH = Join-Path $Global:PROJECT_DIR ".prompt\mcpWindowsTemplate.json"
$Global:MCP_DEFAULT_SEARCH_VALUE = "cunzhi-placeholder-path"

<#
.SYNOPSIS
    Comprehensive PostInstall Callback Processor with integrated MCP configuration handling

.DESCRIPTION
    This unified module provides complete post-installation callback processing including:
    
    CALLBACK TYPES SUPPORTED:
    - "copy": Copy files within package directory (SourceFile -> TargetFile)
    - "rename": Move/rename files within package directory (SourceFile -> TargetFile)  
    - "delete": Remove files from package directory (TargetFile)
    - "configurator": Execute package manager configuration commands with region awareness
    - "mcp": Process MCP (Model Context Protocol) configuration files with JSON manipulation
    
    MCP OPERATIONS SUPPORTED:
    - "replace_path": Replace executable paths in MCP JSON using fuzzy search
    - "copy_config": Copy MCP configurations to target directories
    - "merge_servers": Merge MCP server configurations into target JSON files
    
    SPECIAL FEATURES:
    - Region-aware configuration (China vs Global mirrors for package managers)
    - Unicode filename support via $Global:CHINESE_* variables
    - Template-based MCP initialization with automatic fallback
    - Fuzzy JSON string replacement preserving structure
    - Comprehensive error handling and logging

.NOTES
    All file operations are relative to the package executable directory
    MCP operations use predefined constants for consistent path handling
    Configurator operations automatically detect and respect SELECTED_REGION global variable
    JSON manipulation preserves original formatting and structure
#>

# ===== MCP CONFIGURATION FUNCTIONS =====

# Function to perform fuzzy search and replace in JSON content
function Invoke-McpFuzzyReplace {
    param(
        [Parameter(Mandatory = $true)]
        [string]$JsonContent,
        [Parameter(Mandatory = $true)]
        [string]$SearchValue,
        [Parameter(Mandatory = $true)]
        [string]$ReplaceValue,
        [Parameter(Mandatory = $false)]
        [string]$LogPrefix = "[MCP]"
    )
    
    Write-Host "$LogPrefix Performing fuzzy search and replace" -ForegroundColor Cyan
    Write-Host "$LogPrefix Search value: $SearchValue" -ForegroundColor Cyan
    Write-Host "$LogPrefix Replace value: $ReplaceValue" -ForegroundColor Cyan
    
    try {
        # Find the search value in the JSON content
        $searchIndex = $JsonContent.IndexOf($SearchValue)
        if ($searchIndex -eq -1) {
            Write-Host "$LogPrefix Warning: Search value '$SearchValue' not found in JSON content" -ForegroundColor Yellow
            return $JsonContent
        }
        
        # Find the start quote (search backwards from search position)
        $startQuoteIndex = -1
        for ($i = $searchIndex - 1; $i -ge 0; $i--) {
            if ($JsonContent[$i] -eq '"') {
                $startQuoteIndex = $i
                break
            }
        }
        
        if ($startQuoteIndex -eq -1) {
            Write-Host "$LogPrefix Error: Could not find opening quote for search value" -ForegroundColor Red
            return $JsonContent
        }
        
        # Find the end quote (search forwards from search position)
        $endQuoteIndex = -1
        for ($i = $searchIndex + $SearchValue.Length; $i -lt $JsonContent.Length; $i++) {
            if ($JsonContent[$i] -eq '"') {
                $endQuoteIndex = $i
                break
            }
        }
        
        if ($endQuoteIndex -eq -1) {
            Write-Host "$LogPrefix Error: Could not find closing quote for search value" -ForegroundColor Red
            return $JsonContent
        }
        
        # Extract the original quoted string
        $originalString = $JsonContent.Substring($startQuoteIndex + 1, $endQuoteIndex - $startQuoteIndex - 1)
        Write-Host "$LogPrefix Found quoted string: $originalString" -ForegroundColor Green
        
        # Replace the content between quotes
        $newContent = $JsonContent.Substring(0, $startQuoteIndex + 1) + $ReplaceValue + $JsonContent.Substring($endQuoteIndex)
        
        Write-Host "$LogPrefix Successfully replaced: '$originalString' -> '$ReplaceValue'" -ForegroundColor Green
        return $newContent
    }
    catch {
        Write-Host "$LogPrefix Error during fuzzy replace: $($_.Exception.Message)" -ForegroundColor Red
        return $JsonContent
    }
}

# Function to ensure MCP configuration file exists (copy from template if needed)
function Initialize-McpConfiguration {
    param(
        [Parameter(Mandatory = $true)]
        [string]$McpConfigPath,
        [Parameter(Mandatory = $false)]
        [string]$TemplatePath = "",
        [Parameter(Mandatory = $false)]
        [string]$LogPrefix = "[MCP]"
    )
    
    Write-Host "$LogPrefix Initializing MCP configuration at: $McpConfigPath" -ForegroundColor Cyan
    
    # Check if MCP config file exists
    if (Test-Path $McpConfigPath) {
        Write-Host "$LogPrefix MCP configuration file already exists" -ForegroundColor Green
        return $true
    }
    
    # Determine template path
    if ([string]::IsNullOrEmpty($TemplatePath)) {
        $mcpDir = Split-Path $McpConfigPath -Parent
        $TemplatePath = Join-Path $mcpDir "mcpWindowsTemplate.json"
    }
    
    # Check if template exists
    if (-not (Test-Path $TemplatePath)) {
        Write-Host "$LogPrefix Error: Template file not found at: $TemplatePath" -ForegroundColor Red
        return $false
    }
    
    try {
        # Copy template to MCP config location
        Copy-Item -Path $TemplatePath -Destination $McpConfigPath -Force
        Write-Host "$LogPrefix Successfully copied template to MCP configuration" -ForegroundColor Green
        return $true
    }
    catch {
        Write-Host "$LogPrefix Error copying template: $($_.Exception.Message)" -ForegroundColor Red
        return $false
    }
}

# Function to copy MCP configuration to target directory
function Copy-McpConfiguration {
    param(
        [Parameter(Mandatory = $true)]
        [string]$SourcePath,
        [Parameter(Mandatory = $true)]
        [string]$TargetDirectory,
        [Parameter(Mandatory = $false)]
        [string]$TargetFileName = "mcp.json",
        [Parameter(Mandatory = $false)]
        [bool]$OverwriteExisting = $true,
        [Parameter(Mandatory = $false)]
        [string]$LogPrefix = "[MCP]"
    )
    
    Write-Host "$LogPrefix Copying MCP configuration to target directory" -ForegroundColor Cyan
    Write-Host "$LogPrefix Source: $SourcePath" -ForegroundColor Cyan
    Write-Host "$LogPrefix Target Directory: $TargetDirectory" -ForegroundColor Cyan
    
    if (-not (Test-Path $SourcePath)) {
        Write-Host "$LogPrefix Error: Source MCP configuration not found: $SourcePath" -ForegroundColor Red
        return $false
    }
    
    # Ensure target directory exists
    if (-not (Test-Path $TargetDirectory)) {
        try {
            New-Item -ItemType Directory -Path $TargetDirectory -Force | Out-Null
            Write-Host "$LogPrefix Created target directory: $TargetDirectory" -ForegroundColor Green
        }
        catch {
            Write-Host "$LogPrefix Error creating target directory: $($_.Exception.Message)" -ForegroundColor Red
            return $false
        }
    }
    
    $targetPath = Join-Path $TargetDirectory $TargetFileName
    
    # Check if target file exists and handle accordingly
    if ((Test-Path $targetPath) -and -not $OverwriteExisting) {
        Write-Host "$LogPrefix Target file exists and overwrite is disabled: $targetPath" -ForegroundColor Yellow
        return $false
    }
    
    try {
        Copy-Item -Path $SourcePath -Destination $targetPath -Force
        Write-Host "$LogPrefix Successfully copied MCP configuration to: $targetPath" -ForegroundColor Green
        return $true
    }
    catch {
        Write-Host "$LogPrefix Error copying MCP configuration: $($_.Exception.Message)" -ForegroundColor Red
        return $false
    }
}

# Function to merge MCP server configurations
function Merge-McpServerConfiguration {
    param(
        [Parameter(Mandatory = $true)]
        [string]$SourceMcpPath,
        [Parameter(Mandatory = $true)]
        [string]$TargetJsonPath,
        [Parameter(Mandatory = $false)]
        [string]$McpServersKey = "mcpServers",
        [Parameter(Mandatory = $false)]
        [string]$LogPrefix = "[MCP]"
    )
    
    Write-Host "$LogPrefix Merging MCP server configuration" -ForegroundColor Cyan
    Write-Host "$LogPrefix Source MCP: $SourceMcpPath" -ForegroundColor Cyan
    Write-Host "$LogPrefix Target JSON: $TargetJsonPath" -ForegroundColor Cyan
    
    if (-not (Test-Path $SourceMcpPath)) {
        Write-Host "$LogPrefix Error: Source MCP file not found: $SourceMcpPath" -ForegroundColor Red
        return $false
    }
    
    if (-not (Test-Path $TargetJsonPath)) {
        Write-Host "$LogPrefix Error: Target JSON file not found: $TargetJsonPath" -ForegroundColor Red
        return $false
    }
    
    try {
        # Read and parse source MCP configuration
        $sourceMcpContent = Get-Content -Path $SourceMcpPath -Raw -Encoding UTF8
        $sourceMcpJson = $sourceMcpContent | ConvertFrom-Json
        
        # Read and parse target JSON configuration
        $targetJsonContent = Get-Content -Path $TargetJsonPath -Raw -Encoding UTF8
        $targetJson = $targetJsonContent | ConvertFrom-Json
        
        # Ensure target has mcpServers property
        if (-not $targetJson.PSObject.Properties[$McpServersKey]) {
            $targetJson | Add-Member -MemberType NoteProperty -Name $McpServersKey -Value @{}
        }
        
        # Merge MCP servers from source to target
        $mergedCount = 0
        foreach ($property in $sourceMcpJson.PSObject.Properties) {
            $serverName = $property.Name
            $serverConfig = $property.Value
            
            Write-Host "$LogPrefix Merging server configuration: $serverName" -ForegroundColor Cyan
            
            # Add or update server in target
            if ($targetJson.$McpServersKey.PSObject.Properties[$serverName]) {
                Write-Host "$LogPrefix Updating existing server: $serverName" -ForegroundColor Yellow
            } else {
                Write-Host "$LogPrefix Adding new server: $serverName" -ForegroundColor Green
            }
            
            $targetJson.$McpServersKey | Add-Member -MemberType NoteProperty -Name $serverName -Value $serverConfig -Force
            $mergedCount++
        }
        
        # Write back to target file
        $updatedJsonContent = $targetJson | ConvertTo-Json -Depth 10
        # Use UTF8NoBOM to avoid BOM characters that cause JSON parsing errors
        if ($PSVersionTable.PSVersion.Major -ge 6) {
            Set-Content -Path $TargetJsonPath -Value $updatedJsonContent -Encoding UTF8NoBOM
        } else {
            # PowerShell 5.1 workaround for UTF8 without BOM
            [System.IO.File]::WriteAllText($TargetJsonPath, $updatedJsonContent, [System.Text.UTF8Encoding]::new($false))
        }
        
        Write-Host "$LogPrefix Successfully merged $mergedCount MCP server configurations" -ForegroundColor Green
        return $true
    }
    catch {
        Write-Host "$LogPrefix Error during MCP server merge: $($_.Exception.Message)" -ForegroundColor Red
        return $false
    }
}

# Function to integrate MCP configuration with Gemini CLI using Node.js script
function Invoke-GeminiMcpIntegrationNodeJs {
    param(
        [Parameter(Mandatory = $true)]
        [string]$McpConfigPath,
        [Parameter(Mandatory = $false)]
        [string]$LogPrefix = "[GEMINI_MCP_JS]"
    )

    Write-Host "$LogPrefix Starting Gemini MCP integration using Node.js script" -ForegroundColor Cyan

    if (-not (Test-Path $McpConfigPath)) {
        Write-Host "$LogPrefix Error: MCP configuration file not found: $McpConfigPath" -ForegroundColor Red
        return $false
    }

    try {
        # Use Invoke-SmartLoadScript to get the Node.js integration script
        $scriptSubPath = "shells\scripts\gemini_mcp_integration.js"
        $scriptPath = Invoke-SmartLoadScript -SubPath $scriptSubPath -ForceDownload $false

        if (-not $scriptPath -or -not (Test-Path $scriptPath)) {
            Write-Host "$LogPrefix Error: Failed to load Node.js integration script" -ForegroundColor Red
            return $false
        }

        Write-Host "$LogPrefix Using Node.js script: $scriptPath" -ForegroundColor Cyan

        # Execute Node.js script
        $nodeCommand = "node"
        $nodeArgs = @("`"$scriptPath`"", "`"$McpConfigPath`"")

        Write-Host "$LogPrefix Executing: $nodeCommand $($nodeArgs -join ' ')" -ForegroundColor Cyan

        $process = Start-Process -FilePath $nodeCommand -ArgumentList $nodeArgs -Wait -PassThru -NoNewWindow -RedirectStandardOutput "temp_output.txt" -RedirectStandardError "temp_error.txt"

        # Read output and error
        $output = if (Test-Path "temp_output.txt") { Get-Content "temp_output.txt" -Raw } else { "" }
        $errorOutput = if (Test-Path "temp_error.txt") { Get-Content "temp_error.txt" -Raw } else { "" }

        # Clean up temp files
        if (Test-Path "temp_output.txt") { Remove-Item "temp_output.txt" -Force }
        if (Test-Path "temp_error.txt") { Remove-Item "temp_error.txt" -Force }

        if ($process.ExitCode -eq 0) {
            Write-Host "$LogPrefix Node.js integration completed successfully" -ForegroundColor Green
            if ($output) {
                Write-Host "$LogPrefix Output: $output" -ForegroundColor Green
            }
            return $true
        } else {
            Write-Host "$LogPrefix Node.js integration failed with exit code: $($process.ExitCode)" -ForegroundColor Red
            if ($errorOutput) {
                Write-Host "$LogPrefix Error: $errorOutput" -ForegroundColor Red
            }
            if ($output) {
                Write-Host "$LogPrefix Output: $output" -ForegroundColor Yellow
            }
            return $false
        }

    } catch {
        Write-Host "$LogPrefix Error during Gemini MCP integration: $($_.Exception.Message)" -ForegroundColor Red
        return $false
    }
}

# Function to integrate MCP configuration with Gemini CLI
function Invoke-GeminiMcpIntegration {
    param(
        [Parameter(Mandatory = $true)]
        [string]$McpConfigPath,
        [Parameter(Mandatory = $false)]
        [string]$LogPrefix = "[GEMINI_MCP]"
    )

    Write-Host "$LogPrefix Starting Gemini MCP integration" -ForegroundColor Cyan

    if (-not (Test-Path $McpConfigPath)) {
        Write-Host "$LogPrefix Error: MCP configuration file not found: $McpConfigPath" -ForegroundColor Red
        return $false
    }

    try {
        # Read MCP configuration
        $mcpContent = Get-Content -Path $McpConfigPath -Raw -Encoding UTF8
        $mcpJson = $mcpContent | ConvertFrom-Json

        # Determine Gemini CLI settings path
        $geminiSettingsPath = ""
        $possiblePaths = @(
            "$env:APPDATA\Google\Gemini\CLI\settings.json",
            "$env:USERPROFILE\.config\gemini\settings.json",
            "$env:USERPROFILE\.gemini\settings.json"
        )

        foreach ($path in $possiblePaths) {
            if (Test-Path $path) {
                $geminiSettingsPath = $path
                break
            }
        }

        # If no existing settings found, create default path
        if ([string]::IsNullOrEmpty($geminiSettingsPath)) {
            $geminiSettingsPath = "$env:APPDATA\Google\Gemini\CLI\settings.json"
            $geminiDir = Split-Path $geminiSettingsPath -Parent
            if (-not (Test-Path $geminiDir)) {
                New-Item -ItemType Directory -Path $geminiDir -Force | Out-Null
                Write-Host "$LogPrefix Created Gemini CLI directory: $geminiDir" -ForegroundColor Green
            }
        }

        Write-Host "$LogPrefix Target Gemini settings path: $geminiSettingsPath" -ForegroundColor Cyan

        # Read existing Gemini settings or create new
        $geminiSettings = @{}
        if (Test-Path $geminiSettingsPath) {
            $existingContent = Get-Content -Path $geminiSettingsPath -Raw -Encoding UTF8
            $jsonObject = $existingContent | ConvertFrom-Json
            # Convert PSCustomObject to hashtable for compatibility with PowerShell 5.1
            $geminiSettings = @{}
            $jsonObject.PSObject.Properties | ForEach-Object {
                if ($_.Value -is [PSCustomObject]) {
                    $nestedHashtable = @{}
                    $_.Value.PSObject.Properties | ForEach-Object {
                        $nestedHashtable[$_.Name] = $_.Value
                    }
                    $geminiSettings[$_.Name] = $nestedHashtable
                } else {
                    $geminiSettings[$_.Name] = $_.Value
                }
            }
            Write-Host "$LogPrefix Loaded existing Gemini settings" -ForegroundColor Green
        } else {
            Write-Host "$LogPrefix Creating new Gemini settings file" -ForegroundColor Yellow
        }

        # Ensure mcpServers section exists
        if (-not $geminiSettings.ContainsKey("mcpServers")) {
            $geminiSettings["mcpServers"] = @{}
        }

        # Convert and merge MCP servers
        $mergedCount = 0
        foreach ($property in $mcpJson.mcpServers.PSObject.Properties) {
            $serverName = $property.Name
            $serverConfig = $property.Value

            Write-Host "$LogPrefix Processing MCP server: $serverName" -ForegroundColor Cyan

            # Convert server configuration to Gemini format (they are compatible)
            $geminiSettings["mcpServers"][$serverName] = @{}

            # Safely access PSCustomObject properties
            $serverConfig.PSObject.Properties | ForEach-Object {
                $propertyName = $_.Name
                $propertyValue = $_.Value

                switch ($propertyName) {
                    "command" { $geminiSettings["mcpServers"][$serverName]["command"] = $propertyValue }
                    "args" { $geminiSettings["mcpServers"][$serverName]["args"] = $propertyValue }
                    "env" { $geminiSettings["mcpServers"][$serverName]["env"] = $propertyValue }
                    "disabled" { $geminiSettings["mcpServers"][$serverName]["disabled"] = $propertyValue }
                    "autoApprove" { $geminiSettings["mcpServers"][$serverName]["autoApprove"] = $propertyValue }
                    default {
                        # Copy any other properties as-is for forward compatibility
                        $geminiSettings["mcpServers"][$serverName][$propertyName] = $propertyValue
                    }
                }
            }

            $mergedCount++
        }

        # Write updated Gemini settings
        $updatedContent = $geminiSettings | ConvertTo-Json -Depth 10
        # Use UTF8NoBOM to avoid BOM characters that cause JSON parsing errors
        if ($PSVersionTable.PSVersion.Major -ge 6) {
            Set-Content -Path $geminiSettingsPath -Value $updatedContent -Encoding UTF8NoBOM
        } else {
            # PowerShell 5.1 workaround for UTF8 without BOM
            [System.IO.File]::WriteAllText($geminiSettingsPath, $updatedContent, [System.Text.UTF8Encoding]::new($false))
        }

        Write-Host "$LogPrefix Successfully integrated $mergedCount MCP servers into Gemini CLI" -ForegroundColor Green
        Write-Host "$LogPrefix Gemini settings updated at: $geminiSettingsPath" -ForegroundColor Green

        return $true
    }
    catch {
        Write-Host "$LogPrefix Error during Gemini MCP integration: $($_.Exception.Message)" -ForegroundColor Red
        return $false
    }
}

# Main MCP processing function for PostInstallCallbacks
function Invoke-McpProcessor {
    param(
        [Parameter(Mandatory = $true)]
        [hashtable]$McpCallback,
        [Parameter(Mandatory = $true)]
        [string]$PackageName,
        [Parameter(Mandatory = $true)]
        [string]$ExecutablePath,
        [Parameter(Mandatory = $false)]
        [string]$LogPrefix = "[MCP]"
    )
    
    Write-Host "$LogPrefix Processing MCP callback for $PackageName" -ForegroundColor Cyan
    
    $mcpOperation = if ($McpCallback.ContainsKey("Operation")) { $McpCallback.Operation } else { "" }
    
    if ([string]::IsNullOrEmpty($mcpOperation)) {
        Write-Host "$LogPrefix Error: MCP callback missing Operation parameter" -ForegroundColor Red
        return $false
    }
    
    Write-Host "$LogPrefix MCP Operation: $mcpOperation" -ForegroundColor Cyan
    
    switch ($mcpOperation.ToLower()) {
        "replace_path" {
            # Use constants for MCP paths
            $mcpConfigPath = $Global:MCP_CONFIG_PATH
            $searchValue = $Global:MCP_DEFAULT_SEARCH_VALUE
            $templatePath = $Global:MCP_TEMPLATE_PATH

            # Resolve relative path if needed
            if (-not [System.IO.Path]::IsPathRooted($mcpConfigPath)) {
                $baseDir = Split-Path $PSScriptRoot -Parent
                $mcpConfigPath = Join-Path $baseDir $mcpConfigPath
            }

            # Resolve template path
            if (-not [System.IO.Path]::IsPathRooted($templatePath)) {
                $baseDir = Split-Path $PSScriptRoot -Parent
                $templatePath = Join-Path $baseDir $templatePath
            }

            # Initialize MCP configuration if needed (copy from template)
            if (-not (Initialize-McpConfiguration -McpConfigPath $mcpConfigPath -TemplatePath $templatePath -LogPrefix $LogPrefix)) {
                return $false
            }

            # Read MCP configuration
            $mcpContent = Get-Content -Path $mcpConfigPath -Raw -Encoding UTF8

            # Perform fuzzy replace with absolute executable path
            $updatedContent = Invoke-McpFuzzyReplace -JsonContent $mcpContent -SearchValue $searchValue -ReplaceValue $ExecutablePath -LogPrefix $LogPrefix

            # Write back to file
            try {
                # Use UTF8NoBOM to avoid BOM characters that cause JSON parsing errors
                if ($PSVersionTable.PSVersion.Major -ge 6) {
                    Set-Content -Path $mcpConfigPath -Value $updatedContent -Encoding UTF8NoBOM
                } else {
                    # PowerShell 5.1 workaround for UTF8 without BOM
                    [System.IO.File]::WriteAllText($mcpConfigPath, $updatedContent, [System.Text.UTF8Encoding]::new($false))
                }
                Write-Host "$LogPrefix Successfully updated MCP configuration" -ForegroundColor Green
                return $true
            }
            catch {
                Write-Host "$LogPrefix Error writing MCP configuration: $($_.Exception.Message)" -ForegroundColor Red
                return $false
            }
        }
        "copy_config" {
            # Use MCP config path constant if source not specified
            $sourcePath = if ($McpCallback.ContainsKey("SourcePath")) { $McpCallback.SourcePath } else { $Global:MCP_CONFIG_PATH }
            $targetDirectory = if ($McpCallback.ContainsKey("TargetDirectory")) { $McpCallback.TargetDirectory } else { "" }
            $overwrite = if ($McpCallback.ContainsKey("OverwriteExisting")) { $McpCallback.OverwriteExisting } else { $true }
            
            if ([string]::IsNullOrEmpty($targetDirectory)) {
                Write-Host "$LogPrefix Error: copy_config operation missing TargetDirectory parameter" -ForegroundColor Red
                return $false
            }
            
            # Resolve source path if relative
            if (-not [System.IO.Path]::IsPathRooted($sourcePath)) {
                $baseDir = Split-Path $PSScriptRoot -Parent
                $sourcePath = Join-Path $baseDir $sourcePath
            }
            
            # Expand environment variables in target directory
            $expandedTargetDirectory = [System.Environment]::ExpandEnvironmentVariables($targetDirectory)
            
            return Copy-McpConfiguration -SourcePath $sourcePath -TargetDirectory $expandedTargetDirectory -OverwriteExisting $overwrite -LogPrefix $LogPrefix
        }
        "merge_servers" {
            $sourceMcpPath = if ($McpCallback.ContainsKey("SourceMcpPath")) { $McpCallback.SourceMcpPath } else { "" }
            $targetJsonPath = if ($McpCallback.ContainsKey("TargetJsonPath")) { $McpCallback.TargetJsonPath } else { "" }

            if ([string]::IsNullOrEmpty($sourceMcpPath) -or [string]::IsNullOrEmpty($targetJsonPath)) {
                Write-Host "$LogPrefix Error: merge_servers operation missing required parameters" -ForegroundColor Red
                return $false
            }

            return Merge-McpServerConfiguration -SourceMcpPath $sourceMcpPath -TargetJsonPath $targetJsonPath -LogPrefix $LogPrefix
        }
        "gemini_integration" {
            # Gemini MCP integration - convert .prompt\mcp.json to Gemini settings.json format
            $mcpConfigPath = $Global:MCP_CONFIG_PATH

            # Resolve relative path if needed
            if (-not [System.IO.Path]::IsPathRooted($mcpConfigPath)) {
                $baseDir = Split-Path $PSScriptRoot -Parent
                $mcpConfigPath = Join-Path $baseDir $mcpConfigPath
            }

            # Try Node.js version first, fallback to PowerShell version
            $nodeJsResult = Invoke-GeminiMcpIntegrationNodeJs -McpConfigPath $mcpConfigPath -LogPrefix "$LogPrefix[NodeJS]"
            if ($nodeJsResult) {
                return $nodeJsResult
            } else {
                Write-Host "$LogPrefix Node.js integration failed, falling back to PowerShell version" -ForegroundColor Yellow
                return Invoke-GeminiMcpIntegration -McpConfigPath $mcpConfigPath -LogPrefix "$LogPrefix[PS]"
            }
        }
        "npm_global_install" {
            # Handle npm global install for MCP packages
            $packageName = $McpCallback.PackageName
            $serviceName = if ($McpCallback.ContainsKey("ServiceName")) { $McpCallback.ServiceName } else { $packageName }
            
            Write-Host "$LogPrefix Processing npm global install for MCP package: $packageName" -ForegroundColor Cyan
            Write-Host "$LogPrefix Service will be available as: $serviceName" -ForegroundColor Green
            Write-Host "$LogPrefix Note: Package is installed globally via npm and will be managed by AI IDE" -ForegroundColor Yellow
            return $true
        }
        "uvx_install" {
            # Handle uvx install for MCP packages  
            $packageName = $McpCallback.PackageName
            $serviceName = if ($McpCallback.ContainsKey("ServiceName")) { $McpCallback.ServiceName } else { $packageName }
            
            Write-Host "$LogPrefix Processing uvx install for MCP package: $packageName" -ForegroundColor Cyan
            Write-Host "$LogPrefix Service will be available as: $serviceName" -ForegroundColor Green
            Write-Host "$LogPrefix Note: Package is installed via uvx and will be managed by AI IDE" -ForegroundColor Yellow
            return $true
        }
        default {
            Write-Host "$LogPrefix Error: Unknown MCP operation: $mcpOperation" -ForegroundColor Red
            return $false
        }
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
                                if ($LASTEXITCODE -eq 0) {
                                    Write-Host "$LogPrefix Configurator: Successfully executed command" -ForegroundColor Green
                                } else {
                                    Write-Host "$LogPrefix Configurator: Command completed with exit code $LASTEXITCODE" -ForegroundColor Yellow
                                    if ($result) {
                                        Write-Host "$LogPrefix Configurator output: $result" -ForegroundColor Yellow
                                    }
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
                "mcp" {
                    Write-Host "$LogPrefix Processing MCP callback for $PackageName" -ForegroundColor Cyan
                    $success = Invoke-McpProcessor -McpCallback $callback -PackageName $PackageName -ExecutablePath $ExecutablePath -LogPrefix "$LogPrefix [MCP]"
                    if ($success) {
                        Write-Host "$LogPrefix MCP callback completed successfully" -ForegroundColor Green
                    } else {
                        Write-Host "$LogPrefix MCP callback failed" -ForegroundColor Red
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