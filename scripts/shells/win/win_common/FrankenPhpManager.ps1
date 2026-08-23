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

$script:FrankenPhpCommonDirectory = Split-Path -Parent $PSCommandPath
$script:FrankenPhpWinDirectory = Split-Path -Parent $script:FrankenPhpCommonDirectory
$script:FrankenPhpShellsDirectory = Split-Path -Parent $script:FrankenPhpWinDirectory
$script:FrankenPhpScriptsDirectory = Split-Path -Parent $script:FrankenPhpShellsDirectory
$script:FrankenPhpGlobalVarsPath = Join-Path $script:FrankenPhpCommonDirectory 'GlobalVars.ps1'
$script:FrankenPhpServiceContractPath = Join-Path $script:FrankenPhpCommonDirectory 'ServiceContract.ps1'
$script:FrankenPhpWindowsPathPath = Join-Path $script:FrankenPhpCommonDirectory 'WindowsPathFunction.ps1'
$script:FrankenPhpWinswManagerPath = Join-Path $script:FrankenPhpCommonDirectory 'WinswServiceManager.ps1'
. $script:FrankenPhpGlobalVarsPath
. $script:FrankenPhpServiceContractPath

$script:FrankenPhpRepositoryRoot = [System.IO.Path]::GetFullPath([string]$Global:PROJECT_DIR)
$script:FrankenPhpWebRoot = 'D:\www'
$script:FrankenPhpRootSubpath = [string](Get-ServiceContractValue -ContractPath 'paths.frankenphp_root_windows_subpath')
$script:FrankenPhpRoot = Join-Path $script:FrankenPhpWebRoot $script:FrankenPhpRootSubpath
$script:FrankenPhpBinDirectory = Join-Path $script:FrankenPhpRoot 'bin'
$script:FrankenPhpBinaryPath = Join-Path $script:FrankenPhpBinDirectory 'frankenphp.exe'
$script:FrankenPhpPhpPath = Join-Path $script:FrankenPhpBinDirectory 'php.exe'
$script:FrankenPhpConfigDirectory = Join-Path $script:FrankenPhpRoot 'php-conf.d'
$script:FrankenPhpPhpIniPath = Join-Path $script:FrankenPhpConfigDirectory '99-core-node.ini'
$script:FrankenPhpDataDirectory = Join-Path $script:FrankenPhpRoot 'data'
$script:FrankenPhpCaddyConfigDirectory = Join-Path $script:FrankenPhpRoot 'config'
$script:FrankenPhpCertificateDirectory = Join-Path $script:FrankenPhpRoot 'certs'
$script:FrankenPhpLogDirectory = Join-Path $script:FrankenPhpRoot 'logs'
$script:FrankenPhpServiceDirectory = Join-Path $script:FrankenPhpRoot 'service'
$script:FrankenPhpCacheDirectory = Join-Path $Global:USER_CACHE_DIR 'frankenphp'
$script:FrankenPhpVersion = [string](Get-ServiceContractValue -ContractPath 'versions.frankenphp')
$script:FrankenPhpArchiveName = 'frankenphp-windows-x86_64.zip'
$script:FrankenPhpArchivePath = Join-Path $script:FrankenPhpCacheDirectory $script:FrankenPhpArchiveName
$script:FrankenPhpReleaseUrl = 'https://github.com/php/frankenphp/releases/download/{0}/{1}' -f $script:FrankenPhpVersion, $script:FrankenPhpArchiveName
$script:FrankenPhpLaravelDirectory = Join-Path (Join-Path $script:FrankenPhpRepositoryRoot 'poly_apps') 'laravel_main'
$script:FrankenPhpLaravelPublicDirectory = Join-Path $script:FrankenPhpLaravelDirectory 'public'
$script:FrankenPhpLaravelStorageDirectory = Join-Path $script:FrankenPhpLaravelDirectory 'storage'
$script:FrankenPhpLaravelConfigDirectory = Join-Path $script:FrankenPhpLaravelStorageDirectory 'frankenphp'
$script:FrankenPhpLaravelRoutesDirectory = Join-Path $script:FrankenPhpLaravelConfigDirectory 'routes'
$script:FrankenPhpCaddyfilePath = Join-Path $script:FrankenPhpLaravelConfigDirectory 'Caddyfile'
$script:FrankenPhpLaravelDataDirectory = Join-Path (Join-Path $script:FrankenPhpWebRoot 'wwwroot') 'laravel_db'
$script:FrankenPhpRuntimeSecretDirectory = Join-Path $script:FrankenPhpLaravelDataDirectory '.core_node_secrets'
$script:FrankenPhpSecretDirectory = Join-Path (Join-Path $script:FrankenPhpRepositoryRoot '.secret_keys') '.secret_ignore'
$script:FrankenPhpGlobalVarDirectory = Join-Path (Join-Path $script:FrankenPhpWebRoot 'var\_core_node') 'global_var'
$script:FrankenPhpWebAccessFileName = [string](Get-ServiceContractValue -ContractPath 'files.web_access_config')
$script:FrankenPhpWebAccessPath = Join-Path $script:FrankenPhpGlobalVarDirectory $script:FrankenPhpWebAccessFileName
$script:FrankenPhpServiceName = 'ncore-laravel-frankenphp'
$script:FrankenPhpDisplayName = 'core_node Laravel FrankenPHP'
$script:FrankenPhpDescription = 'Native FrankenPHP worker runtime for core_node Laravel'
$script:FrankenPhpComposerPath = Join-Path $script:FrankenPhpBinDirectory 'composer.bat'
$script:FrankenPhpPublisherKeyName = 'MERCURE_PUBLISHER_JWT'
$script:FrankenPhpSubscriberKeyName = 'MERCURE_SUBSCRIBER_JWT'

function Write-FrankenPhpLog {
    param(
        [Parameter(Mandatory = $true)][string]$Message,
        [ValidateSet('Info', 'Success', 'Warning', 'Error')][string]$Type = 'Info'
    )

    $color = switch ($Type) {
        'Success' { 'Green' }
        'Warning' { 'Yellow' }
        'Error' { 'Red' }
        default { 'Cyan' }
    }
    Write-Host "[FrankenPHP] $Message" -ForegroundColor $color
}

function Get-FrankenPhpRoot {
    return $script:FrankenPhpRoot
}

function Get-FrankenPhpBinaryPath {
    return $script:FrankenPhpBinaryPath
}

function Get-FrankenPhpPhpPath {
    return $script:FrankenPhpPhpPath
}

function Get-FrankenPhpComposerPath {
    return $script:FrankenPhpComposerPath
}

function Get-FrankenPhpCaddyfilePath {
    return $script:FrankenPhpCaddyfilePath
}

function Get-FrankenPhpPhpIniPath {
    return $script:FrankenPhpPhpIniPath
}

function Get-FrankenPhpServiceName {
    return $script:FrankenPhpServiceName
}

function Get-FrankenPhpCertificateRoot {
    return $script:FrankenPhpCertificateDirectory
}

function Get-FrankenPhpLaravelDirectory {
    return $script:FrankenPhpLaravelDirectory
}

function Get-FrankenPhpSecretDirectory {
    return $script:FrankenPhpSecretDirectory
}

function Ensure-FrankenPhpDirectory {
    param([Parameter(Mandatory = $true)][string]$Path)

    if (-not (Test-Path -LiteralPath $Path -PathType Container)) {
        New-Item -ItemType Directory -Path $Path -Force | Out-Null
    }
    return (Test-Path -LiteralPath $Path -PathType Container)
}

function Ensure-FrankenPhpDirectories {
    $directories = @(
        $script:FrankenPhpRoot,
        $script:FrankenPhpBinDirectory,
        $script:FrankenPhpConfigDirectory,
        $script:FrankenPhpDataDirectory,
        $script:FrankenPhpCaddyConfigDirectory,
        $script:FrankenPhpCertificateDirectory,
        $script:FrankenPhpLogDirectory,
        $script:FrankenPhpServiceDirectory,
        $script:FrankenPhpCacheDirectory,
        $script:FrankenPhpLaravelConfigDirectory,
        $script:FrankenPhpLaravelRoutesDirectory,
        $script:FrankenPhpRuntimeSecretDirectory
    )
    $ready = $true
    $directory = ''

    foreach ($directory in $directories) {
        Ensure-FrankenPhpDirectory -Path $directory | Out-Null
        if (-not (Test-Path -LiteralPath $directory -PathType Container)) {
            $ready = $false
            Write-FrankenPhpLog -Message "Directory postcondition failed: $directory" -Type 'Error'
        }
    }
    return $ready
}

function Test-FrankenPhpNativePayload {
    return (Test-Path -LiteralPath $script:FrankenPhpBinaryPath -PathType Leaf) -and
        (Test-Path -LiteralPath $script:FrankenPhpPhpPath -PathType Leaf)
}

function Ensure-FrankenPhpArchive {
    if (-not (Test-Path -LiteralPath $script:FrankenPhpArchivePath -PathType Leaf)) {
        Write-FrankenPhpLog -Message "Downloading official Windows archive: $script:FrankenPhpReleaseUrl"
        Invoke-WebRequest -Uri $script:FrankenPhpReleaseUrl -OutFile $script:FrankenPhpArchivePath -UseBasicParsing
    }
    if (-not (Test-Path -LiteralPath $script:FrankenPhpArchivePath -PathType Leaf)) {
        Write-FrankenPhpLog -Message "Archive postcondition failed: $script:FrankenPhpArchivePath" -Type 'Error'
        return $false
    }
    return ((Get-Item -LiteralPath $script:FrankenPhpArchivePath).Length -gt 0)
}

function Install-FrankenPhpArchivePayload {
    $stagingName = 'extract-{0}' -f ([Guid]::NewGuid().ToString('N'))
    $stagingDirectory = Join-Path $script:FrankenPhpCacheDirectory $stagingName
    $sourceFiles = @()
    $relativePath = ''
    $destinationPath = ''
    $sourceFile = $null

    Ensure-FrankenPhpDirectory -Path $stagingDirectory | Out-Null
    try {
        Expand-Archive -LiteralPath $script:FrankenPhpArchivePath -DestinationPath $stagingDirectory -Force
        $sourceFiles = @(Get-ChildItem -LiteralPath $stagingDirectory -File -Recurse)
        foreach ($sourceFile in $sourceFiles) {
            $relativePath = $sourceFile.FullName.Substring($stagingDirectory.Length).TrimStart('\')
            $destinationPath = Join-Path $script:FrankenPhpBinDirectory $relativePath
            Ensure-FrankenPhpDirectory -Path (Split-Path -Parent $destinationPath) | Out-Null
            if (-not (Test-Path -LiteralPath $destinationPath -PathType Leaf)) {
                Copy-Item -LiteralPath $sourceFile.FullName -Destination $destinationPath
            }
        }
    }
    finally {
        if (Test-Path -LiteralPath $stagingDirectory -PathType Container) {
            Remove-Item -LiteralPath $stagingDirectory -Recurse -Force
        }
    }

    return (Test-FrankenPhpNativePayload)
}

function Ensure-FrankenPhpNativeInstall {
    Ensure-FrankenPhpDirectories | Out-Null
    if (-not (Test-Path -LiteralPath $script:FrankenPhpBinaryPath -PathType Leaf) -or
        -not (Test-Path -LiteralPath $script:FrankenPhpPhpPath -PathType Leaf)) {
        Ensure-FrankenPhpArchive | Out-Null
        if (Test-Path -LiteralPath $script:FrankenPhpArchivePath -PathType Leaf) {
            Install-FrankenPhpArchivePayload | Out-Null
        }
    }

    if (-not (Test-FrankenPhpNativePayload)) {
        Write-FrankenPhpLog -Message 'Native binary postcondition failed.' -Type 'Error'
        return $false
    }

    & $script:FrankenPhpWindowsPathPath 'add' $script:FrankenPhpBinDirectory
    $registeredPath = [Environment]::GetEnvironmentVariable('Path', 'User')
    $pathEntries = @([string]$registeredPath -split ';')
    if ($pathEntries -notcontains $script:FrankenPhpBinDirectory) {
        Write-FrankenPhpLog -Message "PATH postcondition is incomplete: $script:FrankenPhpBinDirectory" -Type 'Warning'
    }
    $env:Path = '{0};{1}' -f $script:FrankenPhpBinDirectory, $env:Path
    Write-FrankenPhpLog -Message "Native runtime ready: $script:FrankenPhpBinaryPath" -Type 'Success'
    return $true
}

function Set-FrankenPhpFileContent {
    param(
        [Parameter(Mandatory = $true)][string]$Path,
        [Parameter(Mandatory = $true)][string]$Content
    )

    $directory = Split-Path -Parent $Path
    $existing = $null

    Ensure-FrankenPhpDirectory -Path $directory | Out-Null
    if (Test-Path -LiteralPath $Path -PathType Leaf) {
        $existing = Get-Content -LiteralPath $Path -Raw
    }
    if ($existing -cne $Content) {
        [System.IO.File]::WriteAllText($Path, $Content, [System.Text.UTF8Encoding]::new($false))
    }
    if (-not (Test-Path -LiteralPath $Path -PathType Leaf)) {
        return $false
    }
    return ((Get-Content -LiteralPath $Path -Raw) -ceq $Content)
}

function Ensure-FrankenPhpPhpConfiguration {
    $uploadSize = [string](Get-ServiceContractValue -ContractPath 'php_runtime.upload_max_filesize')
    $postSize = [string](Get-ServiceContractValue -ContractPath 'php_runtime.post_max_size')
    $executionTime = [int](Get-ServiceContractValue -ContractPath 'php_runtime.max_execution_time_seconds')
    $inputTime = [int](Get-ServiceContractValue -ContractPath 'php_runtime.max_input_time_seconds')
    $content = @"
; Managed by core_node FrankenPhpManager.ps1
memory_limit = 512M
upload_max_filesize = $uploadSize
post_max_size = $postSize
max_execution_time = $executionTime
max_input_time = $inputTime
variables_order = EGPCS
"@

    Ensure-FrankenPhpDirectory -Path $script:FrankenPhpConfigDirectory | Out-Null
    Set-FrankenPhpFileContent -Path $script:FrankenPhpPhpIniPath -Content $content | Out-Null
    if (-not (Test-Path -LiteralPath $script:FrankenPhpPhpIniPath -PathType Leaf)) {
        Write-FrankenPhpLog -Message "PHP configuration postcondition failed: $script:FrankenPhpPhpIniPath" -Type 'Error'
        return $false
    }
    Write-FrankenPhpLog -Message "Embedded PHP configuration ready: $script:FrankenPhpPhpIniPath" -Type 'Success'
    return $true
}

function Get-FrankenPhpSecretValue {
    param([Parameter(Mandatory = $true)][string]$Name)

    $path = Join-Path $script:FrankenPhpSecretDirectory $Name
    $value = ''

    if (Test-Path -LiteralPath $path -PathType Leaf) {
        $value = [string](Get-Content -LiteralPath $path -Raw)
    }
    return $value.Trim()
}

function Ensure-FrankenPhpRuntimeSecret {
    param([Parameter(Mandatory = $true)][string]$Name)

    $path = Join-Path $script:FrankenPhpRuntimeSecretDirectory $Name
    $bytes = New-Object byte[] 48
    $value = ''
    $randomGenerator = $null

    Ensure-FrankenPhpDirectory -Path $script:FrankenPhpRuntimeSecretDirectory | Out-Null
    if (-not (Test-Path -LiteralPath $path -PathType Leaf)) {
        $randomGenerator = [System.Security.Cryptography.RandomNumberGenerator]::Create()
        try {
            $randomGenerator.GetBytes($bytes)
            $value = [Convert]::ToBase64String($bytes)
            [System.IO.File]::WriteAllText($path, $value, [System.Text.UTF8Encoding]::new($false))
        }
        finally {
            $randomGenerator.Dispose()
        }
    }
    return (Get-FrankenPhpRuntimeSecret -Name $Name)
}

function Get-FrankenPhpRuntimeSecret {
    param([Parameter(Mandatory = $true)][string]$Name)

    $path = Join-Path $script:FrankenPhpRuntimeSecretDirectory $Name
    $value = ''

    if (Test-Path -LiteralPath $path -PathType Leaf) {
        $value = [string](Get-Content -LiteralPath $path -Raw)
    }
    if ([string]::IsNullOrWhiteSpace($value)) {
        return $null
    }
    return $value.Trim()
}

function Get-FrankenPhpAccessConfiguration {
    $document = $null
    $prefix = [string](Get-ServiceContractValue -ContractPath 'access.default_api_region_prefix')
    $domains = @((Get-ServiceContractValue -ContractPath 'access.root_domains') | ForEach-Object { [string]$_ })
    $corsOrigins = @('http://localhost', 'https://localhost')
    $domain = ''
    $domainOrigins = @()
    $domainValue = $null

    if (Test-Path -LiteralPath $script:FrankenPhpWebAccessPath -PathType Leaf) {
        try {
            $document = Get-Content -LiteralPath $script:FrankenPhpWebAccessPath -Raw | ConvertFrom-Json
            if (-not [string]::IsNullOrWhiteSpace([string]$document.apiRegionPrefix)) {
                $prefix = [string]$document.apiRegionPrefix
            }
            if ($document.domains -and @($document.domains).Count -gt 0) {
                $domains = @($document.domains | ForEach-Object { [string]$_ })
            }
            if ($document.corsOrigins -and @($document.corsOrigins).Count -gt 0) {
                $corsOrigins = @($document.corsOrigins | ForEach-Object { [string]$_ })
            }
        }
        catch {
            Write-FrankenPhpLog -Message "Web access configuration is invalid; service contract defaults will be used: $script:FrankenPhpWebAccessPath" -Type 'Warning'
        }
    }

    if ($corsOrigins.Count -eq 2) {
        foreach ($domainValue in $domains) {
            $domain = [string]$domainValue
            $domainOrigins = @(
                "http://$domain",
                "https://$domain",
                "http://www.$domain",
                "https://www.$domain",
                "http://$prefix.$domain",
                "https://$prefix.$domain",
                "http://www.$prefix.$domain",
                "https://www.$prefix.$domain",
                "http://api.$prefix.$domain",
                "https://api.$prefix.$domain"
            )
            $corsOrigins = @($corsOrigins) + @($domainOrigins)
        }
    }
    return @{ Prefix = $prefix; Domains = $domains; CorsOrigins = @($corsOrigins | Select-Object -Unique) }
}

function Ensure-FrankenPhpWebAccessConfiguration {
    $contract = Get-ServiceContractDocument
    $prefix = [string](Get-ServiceContractValue -ContractPath 'access.default_api_region_prefix')
    $domains = @((Get-ServiceContractValue -ContractPath 'access.root_domains') | ForEach-Object { [string]$_ })
    $serviceHostKeys = [ordered]@{}
    $allowedHosts = @()
    $corsOrigins = @()
    $uiPort = Get-ServiceContractPort -Name 'nexus_dash_frontend'
    $existingDocument = $null
    $groupProperty = $null
    $hostKey = ''
    $hostValue = ''
    $domain = ''
    $domainHosts = @()
    $document = $null
    $content = ''
    $domainValue = $null

    if (Test-Path -LiteralPath $script:FrankenPhpWebAccessPath -PathType Leaf) {
        try {
            $existingDocument = Get-Content -LiteralPath $script:FrankenPhpWebAccessPath -Raw | ConvertFrom-Json
            if ([string]$existingDocument.apiRegionPrefix -match '^[a-z0-9][a-z0-9-]{0,30}$') {
                $prefix = [string]$existingDocument.apiRegionPrefix
            }
        }
        catch {
            $existingDocument = $null
        }
    }

    foreach ($groupProperty in $contract.access.service_host_keys.PSObject.Properties) {
        $serviceHostKeys[$groupProperty.Name] = @($groupProperty.Value | ForEach-Object { [string]$_ })
        foreach ($hostKey in @($groupProperty.Value)) {
            $hostValue = [string]$contract.hosts.PSObject.Properties[[string]$hostKey].Value
            if (-not [string]::IsNullOrWhiteSpace($hostValue)) {
                $allowedHosts = @($allowedHosts) + @($hostValue)
                if ($groupProperty.Name -eq 'browserAccess') {
                    $corsOrigins = @($corsOrigins) + @(
                        ("http://{0}:{1}" -f $hostValue, $uiPort),
                        ("http://{0}" -f $hostValue),
                        ("https://{0}" -f $hostValue)
                    )
                }
            }
        }
    }
    foreach ($domainValue in $domains) {
        $domain = [string]$domainValue
        $domainHosts = @($domain, "www.$domain", "$prefix.$domain", "www.$prefix.$domain", "api.$prefix.$domain")
        $allowedHosts = @($allowedHosts) + @($domainHosts)
        foreach ($hostValue in $domainHosts) {
            $corsOrigins = @($corsOrigins) + @("http://$hostValue", "https://$hostValue")
        }
    }

    $document = [ordered]@{
        apiRegionPrefix = $prefix
        domains = $domains
        hosts = @($allowedHosts | Select-Object -Unique)
        serviceHostKeys = $serviceHostKeys
        allowedHosts = @($allowedHosts | Select-Object -Unique)
        corsOrigins = @($corsOrigins | Select-Object -Unique)
    }
    $content = $document | ConvertTo-Json -Depth 8
    Set-FrankenPhpFileContent -Path $script:FrankenPhpWebAccessPath -Content $content | Out-Null
    return (Test-Path -LiteralPath $script:FrankenPhpWebAccessPath -PathType Leaf)
}

function ConvertTo-FrankenPhpCaddyPath {
    param([Parameter(Mandatory = $true)][string]$Path)
    return ([System.IO.Path]::GetFullPath($Path)).Replace('\', '/')
}

function Get-FrankenPhpReverseProxyHandlers {
    param(
        [Parameter(Mandatory = $true)][string]$Upstream,
        [Parameter(Mandatory = $true)][string]$EarlyHintsLink
    )

    return @"
	route {
		@early_hints header Accept *text/html*
		header @early_hints Link "$EarlyHintsLink"
		respond @early_hints 103
		reverse_proxy $Upstream
	}
"@
}

function Get-FrankenPhpExpectedRoutePaths {
    $access = Get-FrankenPhpAccessConfiguration
    $paths = @()
    $domain = ''

    foreach ($domain in @($access.Domains)) {
        $domain = ([string]$domain).Trim().ToLowerInvariant()
        if (-not [string]::IsNullOrWhiteSpace($domain)) {
            $paths = @($paths) + @(Join-Path $script:FrankenPhpLaravelRoutesDirectory ("{0}.caddy" -f $domain))
        }
    }
    return $paths
}

function Remove-FrankenPhpStaleDomainRoutes {
    $expectedPaths = @(Get-FrankenPhpExpectedRoutePaths)
    $routeFiles = @(Get-ChildItem -LiteralPath $script:FrankenPhpLaravelRoutesDirectory -Filter '*.caddy' -File -ErrorAction SilentlyContinue)
    $routeFile = $null
    $firstLine = ''

    foreach ($routeFile in $routeFiles) {
        if ($expectedPaths -contains $routeFile.FullName) {
            continue
        }
        $firstLine = [string](Get-Content -LiteralPath $routeFile.FullName -TotalCount 1)
        if ($firstLine -like '# managed-by: frankenphp_domain_common *') {
            Remove-Item -LiteralPath $routeFile.FullName -Force
        }
    }
}

function Test-FrankenPhpDomainRoutesReady {
    $expectedPaths = @(Get-FrankenPhpExpectedRoutePaths)
    $routeFiles = @(Get-ChildItem -LiteralPath $script:FrankenPhpLaravelRoutesDirectory -Filter '*.caddy' -File -ErrorAction SilentlyContinue)
    $expectedPath = ''
    $routeFile = $null
    $firstLine = ''

    foreach ($expectedPath in $expectedPaths) {
        if (-not (Test-Path -LiteralPath $expectedPath -PathType Leaf)) {
            return $false
        }
    }
    foreach ($routeFile in $routeFiles) {
        $firstLine = [string](Get-Content -LiteralPath $routeFile.FullName -TotalCount 1)
        if ($firstLine -like '# managed-by: frankenphp_domain_common *' -and
            $expectedPaths -notcontains $routeFile.FullName) {
            return $false
        }
    }
    return $true
}

function Ensure-FrankenPhpDomainRoutes {
    $access = Get-FrankenPhpAccessConfiguration
    $prefix = [string]$access.Prefix
    $domains = @($access.Domains)
    $httpsPort = Get-ServiceContractPort -Name 'frankenphp_https'
    $httpPort = Get-ServiceContractPort -Name 'frankenphp_http'
    $apiPort = Get-ServiceContractPort -Name 'laravel_api_backend'
    $uiPort = Get-ServiceContractPort -Name 'nexus_dash_frontend'
    $loopback = Get-ServiceContractHost -Name 'loopback'
    $apiHints = [string](Get-ServiceContractValue -ContractPath 'http.api_early_hints_link')
    $uiHints = [string](Get-ServiceContractValue -ContractPath 'http.ui_early_hints_link')
    $apiHandlers = Get-FrankenPhpReverseProxyHandlers -Upstream ("http://{0}:{1}" -f $loopback, $apiPort) -EarlyHintsLink $apiHints
    $uiHandlers = Get-FrankenPhpReverseProxyHandlers -Upstream ("http://{0}:{1}" -f $loopback, $uiPort) -EarlyHintsLink $uiHints
    $domain = ''
    $apiHost = ''
    $certificateDirectory = ''
    $certificatePath = ''
    $keyPath = ''
    $tlsLine = ''
    $content = ''
    $routePath = ''
    $ready = $true
    $domainValue = $null

    Ensure-FrankenPhpDirectory -Path $script:FrankenPhpLaravelRoutesDirectory | Out-Null
    foreach ($domainValue in $domains) {
        $domain = ([string]$domainValue).Trim().ToLowerInvariant()
        if ([string]::IsNullOrWhiteSpace($domain)) {
            continue
        }
        $apiHost = 'api.{0}.{1}' -f $prefix, $domain
        $certificateDirectory = Join-Path $script:FrankenPhpCertificateDirectory $domain
        $certificatePath = Join-Path $certificateDirectory 'fullchain.pem'
        $keyPath = Join-Path $certificateDirectory 'key.pem'
        $tlsLine = ''
        if ((Test-Path -LiteralPath $certificatePath -PathType Leaf) -and (Test-Path -LiteralPath $keyPath -PathType Leaf)) {
            $tlsLine = "`ttls {0} {1}`n" -f (ConvertTo-FrankenPhpCaddyPath -Path $certificatePath), (ConvertTo-FrankenPhpCaddyPath -Path $keyPath)
        }
        $content = @"
# managed-by: frankenphp_domain_common domain=$domain prefix=$prefix

$apiHost`:$httpsPort {
$tlsLine$apiHandlers}

$domain`:$httpsPort, www.$domain`:$httpsPort, $prefix.$domain`:$httpsPort, www.$prefix.$domain`:$httpsPort {
$tlsLine$uiHandlers}

http://$apiHost`:$httpPort {
	redir https://$apiHost{uri} permanent
}

http://$domain`:$httpPort, http://www.$domain`:$httpPort, http://$prefix.$domain`:$httpPort, http://www.$prefix.$domain`:$httpPort {
	redir https://{host}{uri} permanent
}
"@
        $routePath = Join-Path $script:FrankenPhpLaravelRoutesDirectory ("{0}.caddy" -f $domain)
        Set-FrankenPhpFileContent -Path $routePath -Content $content | Out-Null
        if (-not (Test-Path -LiteralPath $routePath -PathType Leaf)) {
            $ready = $false
        }
    }
    Remove-FrankenPhpStaleDomainRoutes
    if (-not (Test-FrankenPhpDomainRoutesReady)) {
        $ready = $false
    }
    return $ready
}

function Ensure-FrankenPhpCaddyfile {
    Ensure-FrankenPhpWebAccessConfiguration | Out-Null
    $access = Get-FrankenPhpAccessConfiguration
    Ensure-FrankenPhpRuntimeSecret -Name $script:FrankenPhpPublisherKeyName | Out-Null
    Ensure-FrankenPhpRuntimeSecret -Name $script:FrankenPhpSubscriberKeyName | Out-Null
    $publisherKey = Get-FrankenPhpRuntimeSecret -Name $script:FrankenPhpPublisherKeyName
    $subscriberKey = Get-FrankenPhpRuntimeSecret -Name $script:FrankenPhpSubscriberKeyName
    $httpsPort = Get-ServiceContractPort -Name 'frankenphp_https'
    $adminPort = Get-ServiceContractPort -Name 'frankenphp_admin'
    $backendPort = Get-ServiceContractPort -Name 'laravel_api_backend'
    $loopback = Get-ServiceContractHost -Name 'loopback'
    $internalTlsHost = Get-ServiceContractHost -Name 'localhost'
    $anyHost = Get-ServiceContractHost -Name 'any'
    $requestTimeout = [string](Get-ServiceContractValue -ContractPath 'php_runtime.request_body_timeout')
    $mercureTransport = [string](Get-ServiceContractValue -ContractPath 'realtime.mercure_transport')
    $mercureCookie = [string](Get-ServiceContractValue -ContractPath 'realtime.mercure_cookie')
    $publicPath = ConvertTo-FrankenPhpCaddyPath -Path $script:FrankenPhpLaravelPublicDirectory
    $routesPath = ConvertTo-FrankenPhpCaddyPath -Path $script:FrankenPhpLaravelRoutesDirectory
    $routeFiles = @(Get-ChildItem -LiteralPath $script:FrankenPhpLaravelRoutesDirectory -Filter '*.caddy' -File -ErrorAction SilentlyContinue)
    $importLine = if ($routeFiles.Count -gt 0) {
        "`n# Per-domain route files (managed by fm_domain_ensure_route_file)`nimport $routesPath/*.caddy"
    } else {
        ''
    }
    $corsOrigins = @($access.CorsOrigins) -join ' '
    $content = ''

    if ([string]::IsNullOrWhiteSpace([string]$publisherKey) -or [string]::IsNullOrWhiteSpace([string]$subscriberKey)) {
        Write-FrankenPhpLog -Message 'Mercure secret postcondition failed.' -Type 'Error'
        return $false
    }

    $content = @"
# Managed by core_node FrankenPHP Caddyfile contract
{
	admin localhost:$adminPort
	auto_https disable_redirects
	grace_period 10s
	default_bind $anyHost
	servers $anyHost`:$backendPort {
		protocols h1
	}
	servers $anyHost`:$httpsPort {
		protocols h1 h2 h3
	}

	frankenphp {
		worker {
			file "$publicPath/frankenphp-worker.php"
			{`$CADDY_SERVER_WORKER_DIRECTIVE}
			{`$CADDY_SERVER_WATCH_DIRECTIVES}
		}
	}
}

https://$internalTlsHost`:$httpsPort {
	root * $publicPath
	encode zstd gzip

	route {
		@mercure path /.well-known/mercure*
		reverse_proxy @mercure http://$loopback`:$backendPort
		php_server {
			index frankenphp-worker.php
			try_files {path} frankenphp-worker.php
			request_body_timeout $requestTimeout
			resolve_root_symlink
		}
	}
}

# Direct HTTP catch-all backend (LAN and local machine clients)
:$backendPort {
	root * $publicPath
	encode zstd gzip
	mercure {
		transport $mercureTransport
		publisher_jwt $publisherKey HS256
		subscriber_jwt $subscriberKey HS256
		cors_origins $corsOrigins
		cookie_name $mercureCookie
	}
	php_server {
		index frankenphp-worker.php
		try_files {path} frankenphp-worker.php
		request_body_timeout $requestTimeout
		resolve_root_symlink
	}
}
$importLine
"@

    Set-FrankenPhpFileContent -Path $script:FrankenPhpCaddyfilePath -Content $content | Out-Null
    if (-not (Test-Path -LiteralPath $script:FrankenPhpCaddyfilePath -PathType Leaf)) {
        Write-FrankenPhpLog -Message "Caddyfile postcondition failed: $script:FrankenPhpCaddyfilePath" -Type 'Error'
        return $false
    }
    Write-FrankenPhpLog -Message "Caddyfile ready: $script:FrankenPhpCaddyfilePath" -Type 'Success'
    return $true
}

function Ensure-FrankenPhpWindowsService {
    $winswPath = $null
    $arguments = 'run --config "{0}" --adapter caddyfile' -f $script:FrankenPhpCaddyfilePath
    $stdoutPath = Join-Path $script:FrankenPhpLogDirectory 'stdout.log'
    $stderrPath = Join-Path $script:FrankenPhpLogDirectory 'stderr.log'
    $environment = @(
        ('PHP_INI_SCAN_DIR={0}' -f $script:FrankenPhpConfigDirectory),
        ('XDG_DATA_HOME={0}' -f $script:FrankenPhpDataDirectory),
        ('XDG_CONFIG_HOME={0}' -f $script:FrankenPhpCaddyConfigDirectory),
        ('CORE_NODE_DATA_DIR={0}' -f (Split-Path -Parent $script:FrankenPhpGlobalVarDirectory)),
        ('FRANKENPHP_BINARY_PATH={0}' -f $script:FrankenPhpBinaryPath),
        'FRANKENPHP_VARIANT=windows-native',
        'FRANKENPHP_DNS01_MODE=external',
        'CADDY_SERVER_WORKER_DIRECTIVE=',
        'CADDY_SERVER_WATCH_DIRECTIVES='
    )
    $service = $null

    . $script:FrankenPhpWinswManagerPath
    Ensure-Winsw -RepoRootDir $script:FrankenPhpRepositoryRoot | Out-Null
    $winswPath = Find-WinswExe -RepoRootDir $script:FrankenPhpRepositoryRoot
    if ([string]::IsNullOrWhiteSpace([string]$winswPath) -or
        -not (Test-Path -LiteralPath $winswPath -PathType Leaf)) {
        Write-FrankenPhpLog -Message 'WinSW binary postcondition failed.' -Type 'Error'
        return $false
    }

    Register-WinswService -WinswExePath $winswPath -ServiceName $script:FrankenPhpServiceName `
        -DisplayName $script:FrankenPhpDisplayName -Description $script:FrankenPhpDescription `
        -ExePath $script:FrankenPhpBinaryPath -Arguments $arguments `
        -WorkingDirectory $script:FrankenPhpLaravelDirectory -EnvironmentExtra $environment `
        -StdoutLog $stdoutPath -StderrLog $stderrPath `
        -ServiceDirectory $script:FrankenPhpServiceDirectory | Out-Null

    $service = Get-Service -Name $script:FrankenPhpServiceName -ErrorAction SilentlyContinue
    if ($null -eq $service) {
        Write-FrankenPhpLog -Message "Service registration postcondition failed: $script:FrankenPhpServiceName" -Type 'Error'
        return $false
    }
    $service.Refresh()
    if ($service.Status -ne 'Running') {
        Write-FrankenPhpLog -Message "Service start postcondition is incomplete: $($service.Status)" -Type 'Warning'
        return $false
    }
    Write-FrankenPhpLog -Message "Windows service running: $script:FrankenPhpServiceName" -Type 'Success'
    return $true
}

function Invoke-FrankenPhpReload {
    $service = Get-Service -Name $script:FrankenPhpServiceName -ErrorAction SilentlyContinue
    $adminPort = Get-ServiceContractPort -Name 'frankenphp_admin'
    $adminUrl = 'http://{0}:{1}/config/apps/http/' -f (Get-ServiceContractHost -Name 'loopback'), $adminPort

    if ($null -eq $service -or $service.Status -ne 'Running') {
        return $false
    }
    & $script:FrankenPhpBinaryPath reload --config $script:FrankenPhpCaddyfilePath --adapter caddyfile
    try {
        Invoke-WebRequest -Uri $adminUrl -UseBasicParsing -TimeoutSec 5 | Out-Null
    }
    catch {
        Write-FrankenPhpLog -Message 'Caddy admin reload postcondition is incomplete.' -Type 'Warning'
    }
    try {
        Invoke-WebRequest -Uri $adminUrl -UseBasicParsing -TimeoutSec 5 | Out-Null
        return $true
    }
    catch {
        return $false
    }
}
