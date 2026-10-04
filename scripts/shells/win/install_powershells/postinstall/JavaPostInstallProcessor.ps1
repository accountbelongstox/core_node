# Java Post-Installation Processor
# Handles Java/JDK configuration, Maven setup, and development environment optimization

# Import required modules
$parentDir = Split-Path (Split-Path $PSScriptRoot -Parent) -Parent
. (Join-Path (Join-Path $parentDir "win_common") "GlobalVars.ps1")
. (Join-Path (Join-Path $parentDir "win_common") "CommonFunc.ps1")

# Note: Environment variables (JAVA_HOME, JDK_HOME, PATH) are handled by
# Set-MultipleEnvironmentVariablesForPackage in Step21_InstallApplications.ps1

function Configure-MavenSettings {
    param (
        [Parameter(Mandatory = $true)]
        [string]$JavaPath,
        [Parameter(Mandatory = $true)]
        [string]$InstallDir,
        [hashtable]$JavaCallback = @{},
        [string]$LogPrefix = "[Java-Maven]"
    )
    
    Write-Host "$LogPrefix Configuring Maven settings..." -ForegroundColor Cyan
    
    # Create .m2 directory if it doesn't exist
    $m2Dir = Join-Path $env:USERPROFILE ".m2"
    if (-not (Test-Path $m2Dir)) {
        New-Item -ItemType Directory -Path $m2Dir -Force | Out-Null
        Write-Host "$LogPrefix Created Maven directory: $m2Dir" -ForegroundColor Green
    }
    
    # Create settings.xml for Maven configuration; an existing (user-owned) settings.xml is kept as it is
    $settingsXmlPath = Join-Path $m2Dir "settings.xml"
    if (Test-Path -LiteralPath $settingsXmlPath) {
        Write-Host "$LogPrefix Maven settings.xml already exists, keeping it: $settingsXmlPath" -ForegroundColor Cyan
        return $true
    }

    # Check if we should configure mirrors based on region
    $shouldConfigureMirrors = -not $Global:RegionIsGlobal
    $mirrorUrl = "https://repo1.maven.org/maven2"
    $mirrorName = "central"

    # Use region-specific mirror for non-global regions
    if ($shouldConfigureMirrors) {
        $mirrorUrl = "https://maven.aliyun.com/repository/public"
        $mirrorName = "aliyun-central"
        Write-Host "$LogPrefix Using region-specific Maven mirror: $mirrorUrl" -ForegroundColor Yellow
    } else {
        Write-Host "$LogPrefix Using default Maven repository (Global region)" -ForegroundColor Cyan
    }
    
    # Create settings.xml content
    $settingsXmlContent = @"
<?xml version="1.0" encoding="UTF-8"?>
<settings xmlns="http://maven.apache.org/SETTINGS/1.0.0"
          xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance"
          xsi:schemaLocation="http://maven.apache.org/SETTINGS/1.0.0 
          http://maven.apache.org/xsd/settings-1.0.0.xsd">
  
  <localRepository>$($m2Dir -replace '\\', '/')/repository</localRepository>
  
"@
    
    if ($shouldConfigureMirrors) {
        $settingsXmlContent += @"
  <mirrors>
    <mirror>
      <id>$mirrorName</id>
      <mirrorOf>central</mirrorOf>
      <name>$mirrorName</name>
      <url>$mirrorUrl</url>
    </mirror>
  </mirrors>
  
"@
    }
    
    $settingsXmlContent += @"
  <profiles>
    <profile>
      <id>default</id>
      <properties>
        <maven.compiler.source>17</maven.compiler.source>
        <maven.compiler.target>17</maven.compiler.target>
        <project.build.sourceEncoding>UTF-8</project.build.sourceEncoding>
      </properties>
    </profile>
  </profiles>
  
  <activeProfiles>
    <activeProfile>default</activeProfile>
  </activeProfiles>
  
</settings>
"@
    
    # Write settings.xml
    try {
        Set-Content -Path $settingsXmlPath -Value $settingsXmlContent -Encoding UTF8
        Write-Host "$LogPrefix Created Maven settings.xml: $settingsXmlPath" -ForegroundColor Green
        
        if ($shouldConfigureMirrors) {
            Write-Host "$LogPrefix Configured Maven mirror for faster downloads" -ForegroundColor Green
        }
        
        return $true
    }
    catch {
        Write-Host "$LogPrefix Failed to create Maven settings.xml: $($_.Exception.Message)" -ForegroundColor Red
        return $false
    }
}

function Test-JavaInstallation {
    param (
        [Parameter(Mandatory = $true)]
        [string]$JavaPath,
        [string]$LogPrefix = "[Java-Test]"
    )
    
    Write-Host "$LogPrefix Testing Java installation..." -ForegroundColor Cyan

    $prevErrorPreference = $ErrorActionPreference
    try {
        # java/javac print the version banner to stderr; under 'Stop' the 2>&1 ErrorRecords would throw in PS 5.1
        $ErrorActionPreference = 'Continue'
        # Test Java version
        $javaVersion = & $JavaPath -version 2>&1
        if (("$javaVersion").Contains('version')) {
            Write-Host "$LogPrefix Java version check passed" -ForegroundColor Green
            $versionLine = ($javaVersion | Select-Object -First 1).ToString()
            Write-Host "$LogPrefix $versionLine" -ForegroundColor Cyan
        } else {
            Write-Host "$LogPrefix Java version check failed" -ForegroundColor Red
            return $false
        }
        
        # Test javac (compiler)
        $javacPath = Join-Path (Split-Path $JavaPath -Parent) "javac.exe"
        if (Test-Path $javacPath) {
            $javacVersion = & $javacPath -version 2>&1
            if (("$javacVersion").Contains('javac')) {
                Write-Host "$LogPrefix Java compiler check passed" -ForegroundColor Green
            } else {
                Write-Host "$LogPrefix Java compiler check failed" -ForegroundColor Yellow
            }
        } else {
            Write-Host "$LogPrefix Java compiler not found (JRE installation?)" -ForegroundColor Yellow
        }
        
        return $true
    }
    catch {
        Write-Host "$LogPrefix Java installation test failed: $($_.Exception.Message)" -ForegroundColor Red
        return $false
    }
    finally {
        $ErrorActionPreference = $prevErrorPreference
    }
}

function Invoke-JavaPostInstallProcessor {
    param(
        [Parameter(Mandatory = $true)]
        [hashtable]$JavaCallback,
        [Parameter(Mandatory = $true)]
        [string]$PackageName,
        [Parameter(Mandatory = $true)]
        [string]$ExecutablePath,
        [Parameter(Mandatory = $true)]
        [string]$InstallDir,
        [Parameter(Mandatory = $false)]
        [string]$LogPrefix = "[Java-PostInstall]"
    )
    
    Write-Host "$LogPrefix Processing Java post-installation for $PackageName" -ForegroundColor Cyan
    
    $javaOperation = if ($JavaCallback.ContainsKey("Operation")) { $JavaCallback.Operation } else { "full_setup" }
    
    Write-Host "$LogPrefix Java Operation: $javaOperation" -ForegroundColor Cyan
    
    $success = $false
    
    switch ($javaOperation.ToLower()) {
        "configure_maven" {
            Write-Host "$LogPrefix Configuring Maven..." -ForegroundColor Yellow
            $success = Configure-MavenSettings -JavaPath $ExecutablePath -InstallDir $InstallDir -JavaCallback $JavaCallback -LogPrefix $LogPrefix
        }
        "full_setup" {
            Write-Host "$LogPrefix Performing Java configuration (Maven + Test)..." -ForegroundColor Yellow
            Write-Host "$LogPrefix Note: Environment variables handled by Step21_InstallApplications.ps1" -ForegroundColor Cyan

            # Step 1: Configure Maven
            $mavenSuccess = Configure-MavenSettings -JavaPath $ExecutablePath -InstallDir $InstallDir -JavaCallback $JavaCallback -LogPrefix $LogPrefix

            # Step 2: Test installation
            $testSuccess = Test-JavaInstallation -JavaPath $ExecutablePath -LogPrefix $LogPrefix
            if (-not $testSuccess) {
                Write-Host "$LogPrefix Warning: Java installation test failed, but configuration completed" -ForegroundColor Yellow
            }

            $success = $mavenSuccess
        }
        default {
            Write-Host "$LogPrefix Error: Unknown Java operation: $javaOperation" -ForegroundColor Red
            return $false
        }
    }
    
    if ($success) {
        Write-Host "$LogPrefix Java post-installation completed successfully" -ForegroundColor Green
    } else {
        Write-Host "$LogPrefix Java post-installation failed" -ForegroundColor Red
    }
    
    return $success
}
