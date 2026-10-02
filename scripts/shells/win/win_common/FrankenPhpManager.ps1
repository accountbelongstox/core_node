$script:FrankenPhpCommonDirectory = Split-Path -Parent $PSCommandPath
$script:FrankenPhpWinDirectory = Split-Path -Parent $script:FrankenPhpCommonDirectory
$script:FrankenPhpShellsDirectory = Split-Path -Parent $script:FrankenPhpWinDirectory
$script:FrankenPhpScriptsDirectory = Split-Path -Parent $script:FrankenPhpShellsDirectory
$script:FrankenPhpGlobalVarsPath = Join-Path $script:FrankenPhpCommonDirectory 'GlobalVars.ps1'
$script:FrankenPhpServiceContractPath = Join-Path $script:FrankenPhpCommonDirectory 'ServiceContract.ps1'
$script:FrankenPhpWindowsPathPath = Join-Path $script:FrankenPhpCommonDirectory 'WindowsPathFunction.ps1'
$script:FrankenPhpWinswManagerPath = Join-Path $script:FrankenPhpCommonDirectory 'WinswServiceManager.ps1'
# Tailscale exe/service detection and status --json parsing are centralized in
# TailscaleCommon.ps1 (Find-TailscaleExecutable, Get-TailscaleStatusJson,
# Get-TailscaleJsonProperty); this file reuses them instead of keeping its own
# copies. Dot-sourcing it is safe: its trailing dispatcher only acts on a
# non-empty -Action, which is never passed here.
$script:FrankenPhpTailscaleCommonPath = Join-Path $script:FrankenPhpCommonDirectory 'TailscaleCommon.ps1'
. $script:FrankenPhpGlobalVarsPath
. $script:FrankenPhpServiceContractPath
. $script:FrankenPhpTailscaleCommonPath

$script:FrankenPhpRepositoryRoot = [System.IO.Path]::GetFullPath([string]$Global:PROJECT_DIR)
$script:FrankenPhpWebRoot = 'D:\www'
$script:FrankenPhpRootSubpath = [string](Get-ServiceContractValue -ContractPath 'paths.frankenphp_root_windows_subpath')
$script:FrankenPhpRoot = Join-Path $script:FrankenPhpWebRoot $script:FrankenPhpRootSubpath
$script:FrankenPhpBinDirectory = Join-Path $script:FrankenPhpRoot 'bin'
$script:FrankenPhpBinaryPath = Join-Path $script:FrankenPhpBinDirectory 'frankenphp.exe'
$script:FrankenPhpPhpPath = Join-Path $script:FrankenPhpBinDirectory 'php.exe'
$script:FrankenPhpExtensionDirectory = Join-Path $script:FrankenPhpBinDirectory 'ext'
$script:FrankenPhpConfigDirectory = Join-Path $script:FrankenPhpRoot 'php-conf.d'
$script:FrankenPhpPhpIniPath = Join-Path $script:FrankenPhpConfigDirectory '99-core-node.ini'
# Extensions Laravel needs from the embedded PHP payload (the archive ships no php.ini, so
# none load by default). One definition, filtered below to whatever php_<name>.dll the
# payload actually shipped (e.g. bcmath is compiled in, so it never has a DLL here and is
# skipped automatically).
$script:FrankenPhpRequiredExtensions = @(
    'pdo_pgsql', 'pgsql', 'mbstring', 'openssl', 'intl', 'gd', 'zip', 'bcmath', 'curl', 'fileinfo', 'sodium'
)
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
$script:FrankenPhpGlobalVarDirectory = Join-Path (Join-Path $script:FrankenPhpWebRoot 'core_node') 'global_var'
$script:FrankenPhpWebAccessFileName = [string](Get-ServiceContractValue -ContractPath 'files.web_access_config')
$script:FrankenPhpWebAccessPath = Join-Path $script:FrankenPhpGlobalVarDirectory $script:FrankenPhpWebAccessFileName
$script:FrankenPhpServiceName = 'ncore-laravel-frankenphp'
$script:FrankenPhpDisplayName = 'core_node Laravel FrankenPHP'
$script:FrankenPhpDescription = 'Native FrankenPHP worker runtime for core_node Laravel'
$script:FrankenPhpComposerPath = Join-Path $script:FrankenPhpBinDirectory 'composer.bat'
$script:FrankenPhpPublisherKeyName = 'MERCURE_PUBLISHER_JWT'
$script:FrankenPhpSubscriberKeyName = 'MERCURE_SUBSCRIBER_JWT'
# LAN local certificate contract (mirrors domain_setup_common.sh on Linux):
# certs live in the USER DATA tree D:\www\core_node\certs\local
# (the SAME physical directory a dual-boot Debian resolves as
# /www/www/core_node/certs/local through the NTFS mount), never in the repo.
$script:FrankenPhpLanRoutePath = Join-Path $script:FrankenPhpLaravelRoutesDirectory 'local_lan.caddy'
$script:FrankenPhpMkcertVersion = 'v1.4.4'
$script:FrankenPhpMkcertArchiveName = 'mkcert-{0}-windows-amd64.exe' -f $script:FrankenPhpMkcertVersion
$script:FrankenPhpMkcertDownloadUrl = 'https://github.com/FiloSottile/mkcert/releases/latest/download/{0}' -f $script:FrankenPhpMkcertArchiveName
$script:FrankenPhpMkcertToolPath = Join-Path $script:FrankenPhpBinDirectory 'mkcert.exe'
$script:FrankenPhpTailscaleDomainSecretName = 'TAILSCALE_DOMAIN_1'
# Tailscale exe detection: reuses TailscaleCommon.ps1's Find-TailscaleExecutable
# and its $script:TailscaleDefaultExePath constant (no local copy here).

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

function Get-FrankenPhpWebAccessConfigurationPath {
    return $script:FrankenPhpWebAccessPath
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

function Get-FrankenPhpLaravelDataDirectory {
    return $script:FrankenPhpLaravelDataDirectory
}

function Ensure-LaravelBookSeedExtracted {
    # sys:init reads the extracted book seed only; this prerequisite owns the extraction.
    # Names come from the contract key book_seed (an xz tar disguised as .js, extracted to
    # <laravel_db>\<target_subpath>\<top_dir>\*.json).
    # Idempotent: skipped when the target directory holds a *.json. Extracted into a temp
    # directory and moved into place, so a partial extraction never passes the check.
    $seedContract = Get-ServiceContractValue -ContractPath 'book_seed'
    $seedArchiveName = [string]$seedContract.archive_name
    $seedTopDirectory = [string]$seedContract.top_dir
    $archiveSource = Join-Path (Join-Path (Get-FrankenPhpLaravelDirectory) ([string]$seedContract.archive_subpath)) $seedArchiveName
    $booksDirectory = Join-Path (Get-FrankenPhpLaravelDataDirectory) ([string]$seedContract.target_subpath)
    $targetDirectory = Join-Path $booksDirectory $seedTopDirectory
    $workDirectory = Join-Path $booksDirectory '.extract_work'
    $tarArchive = Join-Path $workDirectory 'bible-corpus.unique.tar.xz'
    $extractDirectory = Join-Path $workDirectory 'out'
    $tarExe = Join-Path (Join-Path $env:SystemRoot 'System32') 'tar.exe'
    $sevenZip = $null
    $sevenZipCommand = $null
    $tarFile = $null
    $extractedTop = Join-Path $extractDirectory $seedTopDirectory

    if ((Test-Path -LiteralPath $targetDirectory -PathType Container) -and
        @(Get-ChildItem -LiteralPath $targetDirectory -Filter '*.json' -File -ErrorAction SilentlyContinue).Count -gt 0) {
        Write-FrankenPhpLog -Message "Book seed already extracted: $targetDirectory"
        return $true
    }
    if (-not (Test-Path -LiteralPath $archiveSource -PathType Leaf)) {
        Write-FrankenPhpLog -Message "Book seed archive missing: $archiveSource" -Type 'Error'
        return $false
    }

    if (Test-Path -LiteralPath $workDirectory) { Remove-Item -LiteralPath $workDirectory -Recurse -Force }
    New-Item -ItemType Directory -Force -Path $extractDirectory | Out-Null
    Copy-Item -LiteralPath $archiveSource -Destination $tarArchive -Force

    if (Test-Path -LiteralPath $tarExe -PathType Leaf) {
        & $tarExe -xJf $tarArchive -C $extractDirectory
        if ($LASTEXITCODE -ne 0) { Write-FrankenPhpLog -Message "tar.exe failed to extract the book seed (exit $LASTEXITCODE)." -Type 'Error' }
    } else {
        $sevenZipCommand = Get-Command 7z -ErrorAction SilentlyContinue
        $sevenZip = if ($sevenZipCommand) { $sevenZipCommand.Source } else { Join-Path (Join-Path $env:ProgramFiles '7-Zip') '7z.exe' }
        if (-not (Test-Path -LiteralPath $sevenZip -PathType Leaf)) {
            Write-FrankenPhpLog -Message 'Neither the Windows tar.exe nor 7z is available to extract the book seed.' -Type 'Error'
            return $false
        }
        & $sevenZip x -y "-o$workDirectory" $tarArchive
        $tarFile = Join-Path $workDirectory 'bible-corpus.unique.tar'
        if ($LASTEXITCODE -eq 0 -and (Test-Path -LiteralPath $tarFile -PathType Leaf)) {
            & $sevenZip x -y "-o$extractDirectory" $tarFile
        }
        if ($LASTEXITCODE -ne 0) { Write-FrankenPhpLog -Message "7z failed to extract the book seed (exit $LASTEXITCODE)." -Type 'Error' }
    }

    if (-not ((Test-Path -LiteralPath $extractedTop -PathType Container) -and
        @(Get-ChildItem -LiteralPath $extractedTop -Filter '*.json' -File -ErrorAction SilentlyContinue).Count -gt 0)) {
        Write-FrankenPhpLog -Message "Book seed extraction produced no $seedTopDirectory\*.json; nothing was moved into place." -Type 'Error'
        Remove-Item -LiteralPath $workDirectory -Recurse -Force
        return $false
    }
    if (Test-Path -LiteralPath $targetDirectory) { Remove-Item -LiteralPath $targetDirectory -Recurse -Force }
    Move-Item -LiteralPath $extractedTop -Destination $targetDirectory
    Remove-Item -LiteralPath $workDirectory -Recurse -Force
    Write-FrankenPhpLog -Message "Book seed extracted: $targetDirectory"
    return $true
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
    $extensionDirLine = ''
    $extensionLines = @()
    $extensionName = ''
    $extensionDllPath = ''
    $content = ''

    if (Test-Path -LiteralPath $script:FrankenPhpExtensionDirectory -PathType Container) {
        $extensionDirLine = 'extension_dir = "{0}"' -f $script:FrankenPhpExtensionDirectory
        foreach ($extensionName in $script:FrankenPhpRequiredExtensions) {
            $extensionDllPath = Join-Path $script:FrankenPhpExtensionDirectory ('php_{0}.dll' -f $extensionName)
            if (Test-Path -LiteralPath $extensionDllPath -PathType Leaf) {
                $extensionLines = @($extensionLines) + @('extension={0}' -f $extensionName)
            }
        }
    }
    $content = @"
; Managed by core_node FrankenPhpManager.ps1
memory_limit = 512M
upload_max_filesize = $uploadSize
post_max_size = $postSize
max_execution_time = $executionTime
max_input_time = $inputTime
variables_order = EGPCS
$extensionDirLine
$($extensionLines -join "`n")
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

# This machine's own identity (computer name, MagicDNS full and short name,
# Tailscale IPv4) - the Linux twin is web_access_local_hosts: the host a
# browser uses to reach THIS machine is never a static contract entry.
function Get-FrankenPhpLocalAccessHosts {
    $localHosts = @()
    $tailscaleExe = ''
    $status = $null
    $selfNode = $null
    $dnsName = ''
    $address = ''

    if (-not [string]::IsNullOrWhiteSpace($env:COMPUTERNAME)) {
        $localHosts = @($localHosts) + @($env:COMPUTERNAME.ToLower())
    }
    $tailscaleExe = [string](Find-TailscaleExecutable)
    if (-not [string]::IsNullOrWhiteSpace($tailscaleExe)) {
        $status = Get-TailscaleStatusJson -TailscaleExe $tailscaleExe
        $selfNode = Get-TailscaleJsonProperty -Object $status -Name 'Self' -Default $null
        $dnsName = ([string](Get-TailscaleJsonProperty -Object $selfNode -Name 'DNSName' -Default '')).TrimEnd('.').ToLower()
        if (-not [string]::IsNullOrWhiteSpace($dnsName)) {
            $localHosts = @($localHosts) + @($dnsName, $dnsName.Split('.')[0])
        }
        foreach ($address in @(Get-TailscaleJsonProperty -Object $selfNode -Name 'TailscaleIPs' -Default @())) {
            if ([string]$address -match '^\d+\.\d+\.\d+\.\d+$') {
                $localHosts = @($localHosts) + @([string]$address)
            }
        }
    }
    return @($localHosts | Where-Object { -not [string]::IsNullOrWhiteSpace($_) } | Select-Object -Unique)
}

function Ensure-FrankenPhpWebAccessConfiguration {
    $contract = Get-ServiceContractDocument
    $prefix = [string](Get-ServiceContractValue -ContractPath 'access.default_api_region_prefix')
    $domains = @((Get-ServiceContractValue -ContractPath 'access.root_domains') | ForEach-Object { [string]$_ })
    $serviceHostKeys = [ordered]@{}
    $hosts = [ordered]@{}
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
    $localHost = ''

    foreach ($localHost in @(Get-FrankenPhpLocalAccessHosts)) {
        $allowedHosts = @($allowedHosts) + @($localHost)
        $corsOrigins = @($corsOrigins) + @(
            ("http://{0}:{1}" -f $localHost, $uiPort),
            ("http://{0}" -f $localHost),
            ("https://{0}" -f $localHost)
        )
    }

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
                $hosts[[string]$hostKey] = $hostValue
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
        hosts = $hosts
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
    $streamCloseDelay = [string](Get-ServiceContractValue -ContractPath 'realtime.mercure_proxy_close_delay')

    return @"
	route {
		@early_hints header Accept *text/html*
		header @early_hints Link "$EarlyHintsLink"
		respond @early_hints 103
		reverse_proxy $Upstream {
			stream_close_delay $streamCloseDelay
		}
	}
"@
}

# Mount an upstream under a path prefix inside a site (Linux twin:
# fm_caddy_path_mount_render): handle_path strips the prefix and
# X-Forwarded-Prefix hands it to Laravel; root-relative sub-requests of a
# mounted page (Referer under the prefix) reach the same upstream unstripped;
# other paths fall through to `handle`.
function Get-FrankenPhpPathMountHandlers {
    param(
        [Parameter(Mandatory = $true)][string]$PathPrefix,
        [Parameter(Mandatory = $true)][string]$Upstream
    )
    $streamCloseDelay = [string](Get-ServiceContractValue -ContractPath 'realtime.mercure_proxy_close_delay')

    return @"
	redir $PathPrefix $PathPrefix/ 308
	handle_path $PathPrefix/* {
		reverse_proxy $Upstream {
			header_up X-Forwarded-Prefix $PathPrefix
			stream_close_delay $streamCloseDelay
		}
	}
	@path_mount_referer header_regexp Referer ^https?://[^/]+$PathPrefix(/|$)
	handle @path_mount_referer {
		reverse_proxy $Upstream {
			header_up X-Forwarded-Prefix $PathPrefix
			stream_close_delay $streamCloseDelay
		}
	}
"@
}

# Mount the loopback-only pycore under a tailnet site path (Linux twin:
# fm_caddy_tailnet_pycore_mount_render): only tailnet/loopback source
# addresses pass, only this machine's own tailnet and loopback page origins
# (including the app shell's https:// / capacitor://localhost) pass (with CORS), and pycore sees a loopback-local request (loopback Host,
# no Origin, no X-Forwarded-For that uvicorn would trust as the client).
# Pooled upstream connections idle out at half of pycore's keep-alive so Caddy
# never reuses a socket uvicorn is closing (a non-retried POST would 502).
function Get-FrankenPhpTailnetPycoreMountHandlers {
    param(
        [Parameter(Mandatory = $true)][string]$PathPrefix,
        [Parameter(Mandatory = $true)][string]$Upstream,
        [Parameter(Mandatory = $true)][string]$TailnetDomain
    )
    $streamCloseDelay = [string](Get-ServiceContractValue -ContractPath 'realtime.mercure_proxy_close_delay')
    $upstreamKeepalive = '{0}s' -f [int]([math]::Floor([int](Get-ServiceContractValue -ContractPath 'http.pycore_keep_alive_seconds') / 2))
    $sourceRanges = (@(Get-ServiceContractValue -ContractPath 'access.tailnet.source_ranges') | ForEach-Object { [string]$_ }) -join ' '
    $tailnetPattern = [regex]::Escape($TailnetDomain)
    $originPattern = '^(https?://[a-z0-9-]+\.{0}(:[0-9]+)?|(https?|capacitor)://(localhost|127\.0\.0\.1|\[::1\])(:[0-9]+)?)$' -f $tailnetPattern

    return @"
	redir $PathPrefix $PathPrefix/ 308
	handle_path $PathPrefix/* {
		@pycore_offnet not remote_ip $sourceRanges
		@pycore_cors header_regexp Origin $originPattern
		@pycore_foreign {
			header Origin *
			not header_regexp Origin $originPattern
		}
		@pycore_preflight {
			method OPTIONS
			header_regexp Origin $originPattern
		}
		header @pycore_cors Access-Control-Allow-Origin {http.request.header.Origin}
		header @pycore_cors Access-Control-Allow-Credentials true
		header @pycore_cors Vary Origin
		header @pycore_preflight Access-Control-Allow-Methods "GET, POST, PUT, PATCH, DELETE, OPTIONS"
		header @pycore_preflight Access-Control-Allow-Headers {http.request.header.Access-Control-Request-Headers}
		header @pycore_preflight Access-Control-Max-Age 600
		respond @pycore_offnet 403
		respond @pycore_foreign 403
		respond @pycore_preflight 204
		reverse_proxy $Upstream {
			header_up Host {upstream_hostport}
			header_up -Origin
			header_up -X-Forwarded-For
			header_up X-Forwarded-Prefix $PathPrefix
			header_down -Access-Control-Allow-Origin
			header_down -Access-Control-Allow-Credentials
			stream_close_delay $streamCloseDelay
			transport http {
				keepalive $upstreamKeepalive
			}
		}
	}
"@
}

function Get-FrankenPhpLanCertificateDirectory {
    $dataRoot = [string]$env:CORE_NODE_DATA_DIR
    if ([string]::IsNullOrWhiteSpace($dataRoot)) {
        $dataRoot = Join-Path $script:FrankenPhpWebRoot 'core_node'
    }
    return (Join-Path $dataRoot 'certs\local')
}

function Test-FrankenPhpPrivateIp {
    param([Parameter(Mandatory = $true)][string]$Address)
    return ($Address -match '^(10\.|127\.|0\.|192\.168\.|169\.254\.|172\.(1[6-9]|2[0-9]|3[01])\.|100\.(6[4-9]|[7-9][0-9]|1[01][0-9]|12[0-7])\.)')
}

# LAN/desktop = no public IP bound to a local adapter (mirrors
# network_detect_common.sh::net_env_detect on Linux).
function Test-FrankenPhpLanOnlyHost {
    $publicIp = ''
    $localAddresses = @()
    $address = ''

    try {
        $publicIp = ([string](Invoke-RestMethod -Uri 'https://api.ipify.org' -TimeoutSec 4)).Trim()
    }
    catch {
        $publicIp = ''
    }
    $localAddresses = @(Get-NetIPAddress -AddressFamily IPv4 -ErrorAction SilentlyContinue |
        Where-Object { $_.IPAddress -notlike '127.*' -and $_.IPAddress -notlike '0.*' } |
        ForEach-Object { $_.IPAddress })
    if (-not [string]::IsNullOrWhiteSpace($publicIp) -and ($localAddresses -contains $publicIp)) {
        return $false
    }
    foreach ($address in $localAddresses) {
        if (-not (Test-FrankenPhpPrivateIp -Address $address)) {
            return $false
        }
    }
    return $true
}

function Get-FrankenPhpTailscaleDomainConstant {
    $secretPath = Join-Path $script:FrankenPhpSecretDirectory $script:FrankenPhpTailscaleDomainSecretName
    $line = ''

    if (-not (Test-Path -LiteralPath $secretPath -PathType Leaf)) {
        return ''
    }
    foreach ($line in @(Get-Content -LiteralPath $secretPath -ErrorAction SilentlyContinue)) {
        $line = ([string]$line).Trim()
        if (-not [string]::IsNullOrWhiteSpace($line)) {
            return $line
        }
    }
    return ''
}

function Get-FrankenPhpTailscaleDnsName {
    param(
        [string]$TailscaleExe = '',
        [string]$TailnetDomain = ''
    )
    $dnsName = ''
    $status = $null
    $selfNode = $null

    if ([string]::IsNullOrWhiteSpace($TailscaleExe)) {
        return ''
    }
    # Reuses TailscaleCommon.ps1's Get-TailscaleStatusJson (never throws) and
    # Get-TailscaleJsonProperty (strict-mode-safe) instead of a second
    # `status --json` parse.
    $status = Get-TailscaleStatusJson -TailscaleExe $TailscaleExe
    $selfNode = Get-TailscaleJsonProperty -Object $status -Name 'Self' -Default $null
    $dnsName = ([string](Get-TailscaleJsonProperty -Object $selfNode -Name 'DNSName' -Default '')).TrimEnd('.')
    if (-not [string]::IsNullOrWhiteSpace($dnsName) -and -not [string]::IsNullOrWhiteSpace($TailnetDomain)) {
        if (-not ($dnsName.EndsWith('.' + $TailnetDomain) -or $dnsName -eq $TailnetDomain)) {
            Write-FrankenPhpLog -Message "Machine DNS name '$dnsName' is outside the configured tailnet '$TailnetDomain'; refusing it" -Type 'Warning'
            $dnsName = ''
        }
    }
    return $dnsName
}

# Resolve the LAN certificate material already on disk (the cert directory is
# shared with a dual-boot Linux, so discovery is file-based and never depends
# on the local mkcert/tailscale tooling).
function Get-FrankenPhpLanCertificateMaterial {
    $certDir = Get-FrankenPhpLanCertificateDirectory
    $material = @{ TsDnsName = ''; TsCert = ''; TsKey = ''; MkcertPem = ''; MkcertKey = ''; TsApiDnsName = ''; TsApiCert = ''; TsApiKey = '' }
    $apiLabel = [string](Get-ServiceContractValue -ContractPath 'access.tailnet.api_label')
    $apiPemPath = ''
    $apiKeyPath = ''
    $pemFile = $null
    $keyFile = $null
    $crtFile = $null
    $tsKeyPath = ''

    if (Test-Path -LiteralPath $certDir -PathType Container) {
        $pemFile = Get-ChildItem -LiteralPath $certDir -Filter '127.0.0.1+*.pem' -File -ErrorAction SilentlyContinue |
            Where-Object { $_.Name -notlike '*-key.pem' } | Select-Object -First 1
        $keyFile = Get-ChildItem -LiteralPath $certDir -Filter '127.0.0.1+*-key.pem' -File -ErrorAction SilentlyContinue |
            Select-Object -First 1
        if ($null -ne $pemFile -and $null -ne $keyFile) {
            $material.MkcertPem = $pemFile.FullName
            $material.MkcertKey = $keyFile.FullName
        }
        $currentDnsName = ''
        $currentTailscaleExe = [string](Find-TailscaleExecutable)
        if (-not [string]::IsNullOrWhiteSpace($currentTailscaleExe)) {
            $currentDnsName = [string](Get-FrankenPhpTailscaleDnsName -TailscaleExe $currentTailscaleExe -TailnetDomain (Get-FrankenPhpTailscaleDomainConstant))
        }
        if (-not [string]::IsNullOrWhiteSpace($currentDnsName)) {
            $crtFile = Get-ChildItem -LiteralPath $certDir -Filter ('{0}.crt' -f $currentDnsName) -File -ErrorAction SilentlyContinue |
                Select-Object -First 1
        }
        if ($null -eq $crtFile) {
            $crtFile = Get-ChildItem -LiteralPath $certDir -Filter '*.crt' -File -ErrorAction SilentlyContinue |
                Sort-Object LastWriteTime -Descending | Select-Object -First 1
        }
        if ($null -ne $crtFile) {
            $tsKeyPath = Join-Path $certDir ([System.IO.Path]::GetFileNameWithoutExtension($crtFile.Name) + '.key')
            if (Test-Path -LiteralPath $tsKeyPath -PathType Leaf) {
                $material.TsDnsName = [System.IO.Path]::GetFileNameWithoutExtension($crtFile.Name)
                $material.TsCert = $crtFile.FullName
                $material.TsKey = $tsKeyPath
            }
        }
        if (-not [string]::IsNullOrWhiteSpace([string]$material.TsDnsName) -and -not [string]::IsNullOrWhiteSpace($apiLabel)) {
            $material.TsApiDnsName = '{0}.{1}' -f $apiLabel, $material.TsDnsName
            $apiPemPath = Join-Path $certDir ('{0}.pem' -f $material.TsApiDnsName)
            $apiKeyPath = Join-Path $certDir ('{0}-key.pem' -f $material.TsApiDnsName)
            if ((Test-Path -LiteralPath $apiPemPath -PathType Leaf) -and (Test-Path -LiteralPath $apiKeyPath -PathType Leaf)) {
                $material.TsApiCert = $apiPemPath
                $material.TsApiKey = $apiKeyPath
            }
        }
    }
    return $material
}

# Tailnet member = Tailscale installed and connected. Such a host gets the
# tailnet sites additively, public servers included (Linux twin:
# fm_domain_tailnet_certificates_ensure).
function Test-FrankenPhpTailnetConnected {
    $tailscaleExe = [string](Find-TailscaleExecutable)
    if ([string]::IsNullOrWhiteSpace($tailscaleExe)) {
        return $false
    }
    & $tailscaleExe status 2>&1 | Out-Null
    return ($LASTEXITCODE -eq 0)
}

function Test-FrankenPhpLanLocalRouteMaterial {
    $material = Get-FrankenPhpLanCertificateMaterial
    return ((-not [string]::IsNullOrWhiteSpace([string]$material.TsCert)) -or
        (-not [string]::IsNullOrWhiteSpace([string]$material.MkcertPem)))
}

function Find-FrankenPhpMkcert {
    $command = Get-Command mkcert -ErrorAction SilentlyContinue
    if ($null -ne $command) {
        return [string]$command.Source
    }
    if (Test-Path -LiteralPath $script:FrankenPhpMkcertToolPath -PathType Leaf) {
        return $script:FrankenPhpMkcertToolPath
    }
    return ''
}

# Best-effort mkcert provisioning: PATH/package managers first, then the
# official GitHub release binary, then a source clone + go build. Downloads
# and the clone cache live under the constant-centre cache directory
# ($Global:USER_CACHE_DIR\mkcert), never in the repo.
function Ensure-FrankenPhpMkcert {
    $mkcertPath = Find-FrankenPhpMkcert
    $downloadDir = Join-Path $Global:USER_CACHE_DIR 'mkcert'
    $downloadExe = Join-Path $downloadDir $script:FrankenPhpMkcertArchiveName
    $sourceDir = Join-Path $downloadDir 'src'

    if (-not [string]::IsNullOrWhiteSpace($mkcertPath)) {
        return $mkcertPath
    }
    Write-FrankenPhpLog -Message 'mkcert not found; attempting automatic installation...'
    if ($null -ne (Get-Command choco -ErrorAction SilentlyContinue)) {
        & choco install mkcert -y --no-progress 2>&1 | Out-Null
    }
    if ([string]::IsNullOrWhiteSpace((Find-FrankenPhpMkcert)) -and
        $null -ne (Get-Command scoop -ErrorAction SilentlyContinue)) {
        & scoop install mkcert 2>&1 | Out-Null
    }
    $mkcertPath = Find-FrankenPhpMkcert
    if (-not [string]::IsNullOrWhiteSpace($mkcertPath)) {
        Write-FrankenPhpLog -Message 'mkcert installed via the system package manager' -Type 'Success'
        return $mkcertPath
    }

    Ensure-FrankenPhpDirectory -Path $downloadDir | Out-Null
    if (-not (Test-Path -LiteralPath $downloadExe -PathType Leaf)) {
        Write-FrankenPhpLog -Message "Downloading mkcert: $script:FrankenPhpMkcertDownloadUrl"
        try {
            Invoke-WebRequest -Uri $script:FrankenPhpMkcertDownloadUrl -OutFile $downloadExe -UseBasicParsing -TimeoutSec 120
        }
        catch {
            Write-FrankenPhpLog -Message "mkcert download failed: $($_.Exception.Message)" -Type 'Warning'
        }
    }
    if (Test-Path -LiteralPath $downloadExe -PathType Leaf) {
        Copy-Item -LiteralPath $downloadExe -Destination $script:FrankenPhpMkcertToolPath -Force
    }
    $mkcertPath = Find-FrankenPhpMkcert
    if (-not [string]::IsNullOrWhiteSpace($mkcertPath)) {
        Write-FrankenPhpLog -Message "mkcert installed to $script:FrankenPhpMkcertToolPath (download cache: $downloadExe)" -Type 'Success'
        return $mkcertPath
    }

    # Last automatic path: clone the project and build from source (git + Go).
    if ($null -ne (Get-Command git -ErrorAction SilentlyContinue) -and
        $null -ne (Get-Command go -ErrorAction SilentlyContinue)) {
        if (-not (Test-Path -LiteralPath (Join-Path $sourceDir '.git') -PathType Container)) {
            Write-FrankenPhpLog -Message "Cloning mkcert: https://github.com/FiloSottile/mkcert -> $sourceDir"
            & git clone --depth 1 https://github.com/FiloSottile/mkcert $sourceDir 2>&1 | Out-Null
        }
        if (Test-Path -LiteralPath $sourceDir -PathType Container) {
            Write-FrankenPhpLog -Message 'Building mkcert from source (go build)...'
            Push-Location $sourceDir
            try {
                & go build -o $downloadExe . 2>&1 | Out-Null
            }
            finally {
                Pop-Location
            }
            if (Test-Path -LiteralPath $downloadExe -PathType Leaf) {
                Copy-Item -LiteralPath $downloadExe -Destination $script:FrankenPhpMkcertToolPath -Force
            }
        }
        $mkcertPath = Find-FrankenPhpMkcert
        if (-not [string]::IsNullOrWhiteSpace($mkcertPath)) {
            Write-FrankenPhpLog -Message 'mkcert built from source and installed' -Type 'Success'
            return $mkcertPath
        }
    }
    Write-FrankenPhpLog -Message 'Automatic mkcert installation failed' -Type 'Warning'
    return ''
}

# LAN-mode local certificates: 127.0.0.1 through mkcert plus the Tailscale
# ts.net certificate. Direct issuance where the tooling exists; printed
# manual steps where it does not (mirrors domain_setup_lan_certificates).
# Trust the mkcert root CA machine-wide (Cert:\LocalMachine\Root covers every
# account; `mkcert -install` alone reaches only the current user). Idempotent:
# an already-present thumbprint is kept. Linux twin:
# domain_setup_mkcert_trust_all_users (LINUX_SHELL_RULES.md section 3).
function Ensure-FrankenPhpMkcertMachineTrust {
    param([Parameter(Mandatory = $true)][string]$MkcertPath)
    $caRoot = ''
    $caFile = ''
    $caCert = $null

    $caRoot = [string](& $MkcertPath -CAROOT 2>$null)
    if ([string]::IsNullOrWhiteSpace($caRoot)) {
        return
    }
    $caFile = Join-Path $caRoot.Trim() 'rootCA.pem'
    if (-not (Test-Path -LiteralPath $caFile -PathType Leaf)) {
        return
    }
    $caCert = New-Object System.Security.Cryptography.X509Certificates.X509Certificate2 $caFile
    if (Test-Path -LiteralPath (Join-Path 'Cert:\LocalMachine\Root' $caCert.Thumbprint)) {
        return
    }
    try {
        Import-Certificate -FilePath $caFile -CertStoreLocation 'Cert:\LocalMachine\Root' | Out-Null
        Write-FrankenPhpLog -Message "mkcert root CA trusted machine-wide (LocalMachine\Root): $($caCert.Subject)" -Type 'Success'
    }
    catch {
        Write-FrankenPhpLog -Message "Could not import the mkcert root CA into LocalMachine\Root (run elevated): $_" -Type 'Warning'
    }
}

function Ensure-FrankenPhpLanLocalCertificates {
    $certDir = Get-FrankenPhpLanCertificateDirectory
    $mkcertPath = ''
    $tailscaleExe = ''
    $tailnetDomain = ''
    $dnsName = ''
    $apiDnsName = ''
    $apiPemPath = ''
    $apiKeyPath = ''
    # Function-scoped: mkcert/tailscale report progress on stderr, which a
    # caller's 'Stop' preference would turn into a terminating error in PS 5.1.
    $ErrorActionPreference = 'Continue'

    Ensure-FrankenPhpDirectory -Path $certDir | Out-Null

    $mkcertPath = Ensure-FrankenPhpMkcert
    if (-not [string]::IsNullOrWhiteSpace($mkcertPath)) {
        Write-FrankenPhpLog -Message "mkcert present; ensuring the local CA and the 127.0.0.1 certificate in $certDir ..."
        Push-Location $certDir
        try {
            & $mkcertPath -install
            & $mkcertPath 127.0.0.1 localhost ::1
            Ensure-FrankenPhpMkcertMachineTrust -MkcertPath $mkcertPath
        }
        finally {
            Pop-Location
        }
    }
    else {
        Write-FrankenPhpLog -Message '[MANUAL] mkcert unavailable; install it (choco install mkcert / scoop install mkcert / GitHub release), then run: mkcert -install; mkcert 127.0.0.1 localhost ::1' -Type 'Warning'
    }

    # Reuses TailscaleCommon.ps1's Find-TailscaleExecutable (documented default
    # install dir -> PATH -> the Tailscale service's own binary directory)
    # instead of a second, differently-ordered detection here.
    $tailscaleExe = [string](Find-TailscaleExecutable)
    $tailnetDomain = Get-FrankenPhpTailscaleDomainConstant

    if ([string]::IsNullOrWhiteSpace($tailscaleExe)) {
        Write-FrankenPhpLog -Message '[MANUAL] tailscale not installed; install Tailscale, run it, enable MagicDNS + HTTPS in the web admin console (https://login.tailscale.com/admin -> Settings -> HTTPS), then: tailscale cert <machine>.<tailnet>.ts.net' -Type 'Warning'
        return $false
    }
    & $tailscaleExe status 2>&1 | Out-Null
    if ($LASTEXITCODE -ne 0) {
        Write-FrankenPhpLog -Message '[MANUAL] tailscale is installed but not connected; start Tailscale, enable HTTPS in the web admin console, then: tailscale cert <machine>.<tailnet>.ts.net' -Type 'Warning'
        return $false
    }

    Write-FrankenPhpLog -Message 'tailscaled is up (LAN-only host). Prerequisite in the WEB admin console: MagicDNS + HTTPS enabled (https://login.tailscale.com/admin -> Settings -> HTTPS).'
    $dnsName = Get-FrankenPhpTailscaleDnsName -TailscaleExe $tailscaleExe -TailnetDomain $tailnetDomain
    if ([string]::IsNullOrWhiteSpace($dnsName)) {
        Write-FrankenPhpLog -Message '[MANUAL] Could not resolve this machine''s ts.net DNS name; find it with ''tailscale status'', then: tailscale cert <machine>.<tailnet>.ts.net' -Type 'Warning'
        return $false
    }
    Write-FrankenPhpLog -Message "Requesting the Tailscale certificate for $dnsName ..."
    Push-Location $certDir
    try {
        & $tailscaleExe cert $dnsName
    }
    finally {
        Pop-Location
    }
    if ($LASTEXITCODE -ne 0) {
        Write-FrankenPhpLog -Message "[MANUAL] tailscale cert failed for $dnsName; enable HTTPS in the web admin console (Settings -> HTTPS, requires MagicDNS) and re-run" -Type 'Warning'
        return $false
    }
    Write-FrankenPhpLog -Message "Tailscale certificate ready for $dnsName (globally trusted, Let's Encrypt)" -Type 'Success'

    # api.<machine>.<tailnet>.ts.net: tailscale cert never issues subdomains,
    # so this name carries a mkcert local-CA certificate (kept when present).
    $apiDnsName = '{0}.{1}' -f ([string](Get-ServiceContractValue -ContractPath 'access.tailnet.api_label')), $dnsName
    $apiPemPath = Join-Path $certDir ('{0}.pem' -f $apiDnsName)
    $apiKeyPath = Join-Path $certDir ('{0}-key.pem' -f $apiDnsName)
    if ((Test-Path -LiteralPath $apiPemPath -PathType Leaf) -and (Test-Path -LiteralPath $apiKeyPath -PathType Leaf)) {
        Write-FrankenPhpLog -Message "Tailnet API certificate present: $apiPemPath"
    }
    elseif (-not [string]::IsNullOrWhiteSpace($mkcertPath)) {
        Push-Location $certDir
        try {
            & $mkcertPath -cert-file $apiPemPath -key-file $apiKeyPath $apiDnsName
        }
        finally {
            Pop-Location
        }
        if (Test-Path -LiteralPath $apiPemPath -PathType Leaf) {
            Write-FrankenPhpLog -Message "Tailnet API certificate ready (mkcert local CA): $apiPemPath; the name resolves after the tailnet policy grants nodeAttrs dns-subdomain-resolve" -Type 'Success'
        }
    }
    else {
        Write-FrankenPhpLog -Message "[MANUAL] mkcert missing; cannot create the $apiDnsName certificate" -Type 'Warning'
    }
    return $true
}

# Ensure the LAN-mode route file (content-hash idempotent): one HTTPS site
# per available local certificate (Tailscale ts.net cert and/or the mkcert
# 127.0.0.1 cert) proxying to the canonical Laravel backend. Drops the
# managed file when no local certificate material exists. Mirrors
# fm_domain_lan_site_ensure on Linux.
function Ensure-FrankenPhpLanLocalRoute {
    $httpsPort = Get-ServiceContractPort -Name 'frankenphp_https'
    $httpPort = Get-ServiceContractPort -Name 'frankenphp_http'
    $apiPort = Get-ServiceContractPort -Name 'laravel_api_backend'
    $loopback = Get-ServiceContractHost -Name 'loopback'
    $apiHints = [string](Get-ServiceContractValue -ContractPath 'http.api_early_hints_link')
    $apiHandlers = Get-FrankenPhpReverseProxyHandlers -Upstream ("http://{0}:{1}" -f $loopback, $apiPort) -EarlyHintsLink $apiHints
    $uiPort = Get-ServiceContractPort -Name 'nexus_dash_frontend'
    $uiHints = [string](Get-ServiceContractValue -ContractPath 'http.ui_early_hints_link')
    $uiHandlers = Get-FrankenPhpReverseProxyHandlers -Upstream ("http://{0}:{1}" -f $loopback, $uiPort) -EarlyHintsLink $uiHints
    $pycorePort = Get-ServiceContractPort -Name 'pycore_backend'
    $tailnetPycorePath = [string](Get-ServiceContractValue -ContractPath 'access.tailnet.pycore_path')
    $apiMount = ''
    $pycoreMount = ''
    $material = Get-FrankenPhpLanCertificateMaterial
    $tsDnsName = [string]$material.TsDnsName
    $tsApiDnsName = [string]$material.TsApiDnsName
    $tailnetApiPath = [string](Get-ServiceContractValue -ContractPath 'access.tailnet.api_path')
    $tsApiTlsLine = ''
    $tsTlsLine = ''
    $mkcertTlsLine = ''
    $blocks = @()
    $content = ''

    if (-not [string]::IsNullOrWhiteSpace([string]$material.TsCert)) {
        $tsTlsLine = "`ttls {0} {1}`n" -f (ConvertTo-FrankenPhpCaddyPath -Path ([string]$material.TsCert)), (ConvertTo-FrankenPhpCaddyPath -Path ([string]$material.TsKey))
    }
    $apiMount = Get-FrankenPhpPathMountHandlers -PathPrefix $tailnetApiPath -Upstream ("http://{0}:{1}" -f $loopback, $apiPort)
    if (-not [string]::IsNullOrWhiteSpace($tsDnsName)) {
        $pycoreMount = Get-FrankenPhpTailnetPycoreMountHandlers -PathPrefix $tailnetPycorePath -Upstream ("http://{0}:{1}" -f $loopback, $pycorePort) -TailnetDomain ($tsDnsName.Substring($tsDnsName.IndexOf('.') + 1))
    }
    if (-not [string]::IsNullOrWhiteSpace([string]$material.TsApiCert)) {
        $tsApiTlsLine = "`ttls {0} {1}`n" -f (ConvertTo-FrankenPhpCaddyPath -Path ([string]$material.TsApiCert)), (ConvertTo-FrankenPhpCaddyPath -Path ([string]$material.TsApiKey))
    }
    if (-not [string]::IsNullOrWhiteSpace([string]$material.MkcertPem)) {
        $mkcertTlsLine = "`ttls {0} {1}`n" -f (ConvertTo-FrankenPhpCaddyPath -Path ([string]$material.MkcertPem)), (ConvertTo-FrankenPhpCaddyPath -Path ([string]$material.MkcertKey))
    }
    if ([string]::IsNullOrWhiteSpace($tsTlsLine) -and [string]::IsNullOrWhiteSpace($mkcertTlsLine)) {
        if ((Test-Path -LiteralPath $script:FrankenPhpLanRoutePath -PathType Leaf) -and
            ([string](Get-Content -LiteralPath $script:FrankenPhpLanRoutePath -TotalCount 1)) -like '# managed-by: frankenphp_domain_common *') {
            Remove-Item -LiteralPath $script:FrankenPhpLanRoutePath -Force
            Write-FrankenPhpLog -Message "Removed LAN route (no local certificates present): $script:FrankenPhpLanRoutePath"
        }
        Write-FrankenPhpLog -Message 'LAN site skipped: no Tailscale/mkcert certificate files in the LAN certificate directory' -Type 'Warning'
        return $false
    }

    if (-not [string]::IsNullOrWhiteSpace($tsTlsLine)) {
        $blocks = @($blocks) + @(@"

https://$tsDnsName`:$httpsPort {
$tsTlsLine$pycoreMount
$apiMount
	handle {
$uiHandlers
	}
}

http://$tsDnsName`:$httpPort {
	redir https://$tsDnsName{uri} permanent
}
"@)
    }
    if (-not [string]::IsNullOrWhiteSpace($tsApiTlsLine)) {
        $blocks = @($blocks) + @(@"

https://$tsApiDnsName`:$httpsPort {
$tsApiTlsLine$apiHandlers
}

http://$tsApiDnsName`:$httpPort {
	redir https://$tsApiDnsName{uri} permanent
}
"@)
    }
    if (-not [string]::IsNullOrWhiteSpace($mkcertTlsLine)) {
        $blocks = @($blocks) + @(@"

https://127.0.0.1`:$httpsPort {
$mkcertTlsLine$apiHandlers
}
"@)
    }
    $content = "# managed-by: frankenphp_domain_common lan=local_lan ts=$(if ([string]::IsNullOrWhiteSpace($tsDnsName)) { 'none' } else { $tsDnsName })" + ($blocks -join '')

    Ensure-FrankenPhpDirectory -Path $script:FrankenPhpLaravelRoutesDirectory | Out-Null
    Set-FrankenPhpFileContent -Path $script:FrankenPhpLanRoutePath -Content $content | Out-Null
    if (-not (Test-Path -LiteralPath $script:FrankenPhpLanRoutePath -PathType Leaf)) {
        Write-FrankenPhpLog -Message "LAN route file postcondition failed: $script:FrankenPhpLanRoutePath" -Type 'Error'
        return $false
    }
    if (-not [string]::IsNullOrWhiteSpace($tsTlsLine)) {
        Write-FrankenPhpLog -Message "LAN site: https://${tsDnsName}:$httpsPort -> http://${loopback}:$uiPort (tls: tailscale cert)" -Type 'Success'
        Write-FrankenPhpLog -Message "LAN site: https://${tsDnsName}$tailnetApiPath/ -> http://${loopback}:$apiPort (tls: tailscale cert)" -Type 'Success'
        Write-FrankenPhpLog -Message "LAN site: https://${tsDnsName}$tailnetPycorePath/ -> http://${loopback}:$pycorePort (tls: tailscale cert, tailnet sources only)" -Type 'Success'
    }
    if (-not [string]::IsNullOrWhiteSpace($tsApiTlsLine)) {
        Write-FrankenPhpLog -Message "LAN site: https://${tsApiDnsName}:$httpsPort -> http://${loopback}:$apiPort (tls: mkcert local CA)" -Type 'Success'
    }
    if (-not [string]::IsNullOrWhiteSpace($mkcertTlsLine)) {
        Write-FrankenPhpLog -Message "LAN site: https://127.0.0.1:$httpsPort -> http://${loopback}:$apiPort (tls: mkcert local CA)" -Type 'Success'
    }
    return $true
}

function Get-FrankenPhpExpectedRoutePaths {
    $access = Get-FrankenPhpAccessConfiguration
    $paths = @()
    $domain = ''

    # Per-domain (production) routes are expected only on the production host;
    # a LAN/desktop host has no certificate for the public domains and would
    # otherwise sit there triggering failing ACME attempts (see
    # Ensure-FrankenPhpDomainRoutes). The stale-route sweep removes any
    # leftover domain file when a host stops being production.
    if (-not (Test-FrankenPhpLanOnlyHost)) {
        foreach ($domain in @($access.Domains)) {
            $domain = ([string]$domain).Trim().ToLowerInvariant()
            if (-not [string]::IsNullOrWhiteSpace($domain)) {
                $paths = @($paths) + @(Join-Path $script:FrankenPhpLaravelRoutesDirectory ("{0}.caddy" -f $domain))
            }
        }
    }
    # The LAN local route is expected exactly when local certificate material
    # exists; otherwise the stale-route sweep removes the managed file.
    if (Test-FrankenPhpLanLocalRouteMaterial) {
        $paths = @($paths) + @($script:FrankenPhpLanRoutePath)
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
    # Production public domains (12gm.com, gm15.com, ...) only ever have a
    # real certificate on the production host. On a LAN/desktop host, skip
    # generating these routes entirely (reusing the same host/role detection
    # Step175 already uses for LAN certificate provisioning): a route with no
    # tls line falls back to Caddy's automatic HTTPS, which keeps retrying
    # (and failing) ACME issuance for domains this host cannot prove control
    # of. LAN/desktop access already has its own site: Ensure-FrankenPhpLanLocalRoute.
    $isLanOnlyHost = Test-FrankenPhpLanOnlyHost

    Ensure-FrankenPhpDirectory -Path $script:FrankenPhpLaravelRoutesDirectory | Out-Null
    if (-not $isLanOnlyHost) {
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
$tlsLine$apiHandlers
}

$domain`:$httpsPort, www.$domain`:$httpsPort, $prefix.$domain`:$httpsPort, www.$prefix.$domain`:$httpsPort {
$tlsLine$uiHandlers
}

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
    $maxExecutionTime = [int](Get-ServiceContractValue -ContractPath 'php_runtime.max_execution_time_seconds')
    $maxInputTime = [int](Get-ServiceContractValue -ContractPath 'php_runtime.max_input_time_seconds')
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
	skip_install_trust
	grace_period 10s
	default_bind $anyHost
	servers $anyHost`:$backendPort {
		protocols h1
	}
	servers $anyHost`:$httpsPort {
		protocols h1 h2
	}

	frankenphp {
		php_ini max_execution_time $maxExecutionTime
		php_ini max_input_time $maxInputTime
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
    # Function-scoped: frankenphp logs its JSON info lines on stderr.
    $ErrorActionPreference = 'Continue'

    if ($null -eq $service -or $service.Status -ne 'Running') {
        return $false
    }
    & $script:FrankenPhpBinaryPath reload --config $script:FrankenPhpCaddyfilePath --adapter caddyfile 2>&1 | ForEach-Object { Write-Host "$_" }
    if ($LASTEXITCODE -ne 0) {
        Write-FrankenPhpLog -Message "frankenphp reload exited with code $LASTEXITCODE" -Type 'Warning'
    }
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
