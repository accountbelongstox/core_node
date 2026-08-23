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

$script:FrankenPhpCertificateCommonDirectory = Split-Path -Parent $PSCommandPath
$script:FrankenPhpManagerPath = Join-Path $script:FrankenPhpCertificateCommonDirectory 'FrankenPhpManager.ps1'
. $script:FrankenPhpManagerPath

$script:FrankenPhpCertificateModuleName = 'Posh-ACME'
$script:FrankenPhpCertificateModuleDirectory = Join-Path (Get-FrankenPhpRoot) 'modules'
$script:FrankenPhpCertificateProfileDirectory = Join-Path (Get-FrankenPhpRoot) 'posh-acme'
$script:FrankenPhpCertificateRenewTaskName = 'ncore-frankenphp-certificate-renewal'
$script:FrankenPhpCertificateRenewHour = 3
$script:FrankenPhpCertificateRenewMinute = 17
$script:FrankenPhpCertificateMinimumDays = 30
$script:FrankenPhpCertificateDnsPlugin = 'DNSPod'
$script:FrankenPhpCertificateDnsApiRoot = 'https://dnsapi.cn'
$script:FrankenPhpCertificateStepPath = Join-Path (Join-Path (Split-Path -Parent $script:FrankenPhpCertificateCommonDirectory) 'install_powershells') 'Step175_LaravelMainStart.ps1'

function Ensure-FrankenPhpCertificateModule {
    $moduleParentDirectory = Join-Path $script:FrankenPhpCertificateModuleDirectory $script:FrankenPhpCertificateModuleName
    $moduleManifest = Get-ChildItem -LiteralPath $moduleParentDirectory -Filter 'Posh-ACME.psd1' -File -Recurse -ErrorAction SilentlyContinue | Select-Object -First 1

    Ensure-FrankenPhpDirectory -Path $script:FrankenPhpCertificateModuleDirectory | Out-Null
    if ($null -eq $moduleManifest) {
        Write-FrankenPhpLog -Message 'Installing the native Posh-ACME certificate client.'
        Save-Module -Name $script:FrankenPhpCertificateModuleName -Path $script:FrankenPhpCertificateModuleDirectory -Force
    }
    $moduleManifest = Get-ChildItem -LiteralPath $moduleParentDirectory -Filter 'Posh-ACME.psd1' -File -Recurse -ErrorAction SilentlyContinue | Select-Object -First 1
    if ($null -eq $moduleManifest) {
        Write-FrankenPhpLog -Message 'Posh-ACME module postcondition failed.' -Type 'Error'
        return $false
    }

    Ensure-FrankenPhpDirectory -Path $script:FrankenPhpCertificateProfileDirectory | Out-Null
    $env:POSHACME_HOME = $script:FrankenPhpCertificateProfileDirectory
    Import-Module $moduleManifest.FullName -Force
    return ($null -ne (Get-Command New-PACertificate -ErrorAction SilentlyContinue))
}

function Ensure-FrankenPhpCertificateAccount {
    param([Parameter(Mandatory = $true)][hashtable]$Credential)

    $account = Get-PAAccount -ErrorAction SilentlyContinue

    if ($null -eq $account) {
        if ([string]::IsNullOrWhiteSpace($Credential.Email)) {
            New-PAAccount -AcceptTOS -UseAltPluginEncryption | Out-Null
        }
        else {
            New-PAAccount -AcceptTOS -Contact $Credential.Email -UseAltPluginEncryption | Out-Null
        }
    }
    else {
        Set-PAAccount -UseAltPluginEncryption | Out-Null
    }
    $account = Get-PAAccount -ErrorAction SilentlyContinue
    return $null -ne $account
}

function Get-FrankenPhpCertificateCredential {
    $tokenValue = Get-FrankenPhpSecretValue -Name 'DNS_DNSPOD_API_TOKENS'
    $email = Get-FrankenPhpSecretValue -Name 'DNSPOD_EMAILS'
    $separatorIndex = $tokenValue.IndexOf(',')
    $keyId = ''
    $keyToken = ''

    if ($separatorIndex -gt 0 -and $separatorIndex -lt ($tokenValue.Length - 1)) {
        $keyId = $tokenValue.Substring(0, $separatorIndex).Trim()
        $keyToken = $tokenValue.Substring($separatorIndex + 1).Trim()
    }
    return @{ KeyId = $keyId; KeyToken = $keyToken; Email = $email.Trim() }
}

function Get-FrankenPhpCertificatePaths {
    param([Parameter(Mandatory = $true)][string]$Domain)

    $directory = Join-Path (Get-FrankenPhpCertificateRoot) $Domain.ToLowerInvariant()
    return @{
        Directory = $directory
        FullChain = Join-Path $directory 'fullchain.pem'
        Key = Join-Path $directory 'key.pem'
    }
}

function Test-FrankenPhpCertificateReady {
    param(
        [Parameter(Mandatory = $true)][string]$Domain,
        [string]$Prefix = '',
        [int]$MinimumDays = $script:FrankenPhpCertificateMinimumDays
    )

    $paths = Get-FrankenPhpCertificatePaths -Domain $Domain
    $certificate = $null
    $minimumDate = (Get-Date).AddDays($MinimumDays)
    $access = $null
    $expectedNames = @()
    $sanExtension = $null
    $sanText = ''
    $expectedName = ''

    if (-not (Test-Path -LiteralPath $paths.FullChain -PathType Leaf) -or
        -not (Test-Path -LiteralPath $paths.Key -PathType Leaf)) {
        return $false
    }
    try {
        $certificate = New-Object System.Security.Cryptography.X509Certificates.X509Certificate2 -ArgumentList $paths.FullChain
        if ([string]::IsNullOrWhiteSpace($Prefix)) {
            $access = Get-FrankenPhpAccessConfiguration
            $Prefix = [string]$access.Prefix
        }
        $expectedNames = @($Domain, "*.$Domain", "*.$Prefix.$Domain")
        $sanExtension = $certificate.Extensions | Where-Object { $_.Oid.Value -eq '2.5.29.17' } | Select-Object -First 1
        if ($null -ne $sanExtension) {
            $sanText = $sanExtension.Format($false)
        }
        if ($certificate.NotAfter -le $minimumDate -or $certificate.NotBefore -gt (Get-Date)) {
            return $false
        }
        foreach ($expectedName in $expectedNames) {
            if ($sanText -notlike ("*{0}*" -f [System.Management.Automation.WildcardPattern]::Escape($expectedName))) {
                return $false
            }
        }
        return $true
    }
    catch {
        return $false
    }
    finally {
        if ($null -ne $certificate) {
            $certificate.Dispose()
        }
    }
}

function Copy-FrankenPhpCertificateFile {
    param(
        [Parameter(Mandatory = $true)][string]$SourcePath,
        [Parameter(Mandatory = $true)][string]$DestinationPath
    )

    $destinationDirectory = Split-Path -Parent $DestinationPath
    $temporaryName = '{0}.{1}.new' -f (Split-Path -Leaf $DestinationPath), ([Guid]::NewGuid().ToString('N'))
    $temporaryPath = Join-Path $destinationDirectory $temporaryName
    $sourceHash = ''
    $destinationHash = ''

    if (-not (Test-Path -LiteralPath $SourcePath -PathType Leaf)) {
        return $false
    }
    Ensure-FrankenPhpDirectory -Path $destinationDirectory | Out-Null
    Copy-Item -LiteralPath $SourcePath -Destination $temporaryPath
    if (Test-Path -LiteralPath $temporaryPath -PathType Leaf) {
        Move-Item -LiteralPath $temporaryPath -Destination $DestinationPath -Force
    }
    if (-not (Test-Path -LiteralPath $DestinationPath -PathType Leaf)) {
        return $false
    }
    $sourceHash = (Get-FileHash -LiteralPath $SourcePath -Algorithm SHA256).Hash
    $destinationHash = (Get-FileHash -LiteralPath $DestinationPath -Algorithm SHA256).Hash
    return $sourceHash -eq $destinationHash
}

function Publish-FrankenPhpCertificate {
    param(
        [Parameter(Mandatory = $true)][string]$Domain,
        [Parameter(Mandatory = $true)]$Certificate
    )

    $paths = Get-FrankenPhpCertificatePaths -Domain $Domain
    $fullChainFile = [string]$Certificate.FullChainFile
    $keyFile = [string]$Certificate.KeyFile

    Copy-FrankenPhpCertificateFile -SourcePath $fullChainFile -DestinationPath $paths.FullChain | Out-Null
    Copy-FrankenPhpCertificateFile -SourcePath $keyFile -DestinationPath $paths.Key | Out-Null
    return (Test-FrankenPhpCertificateReady -Domain $Domain -MinimumDays 1)
}

function Ensure-FrankenPhpCertificate {
    param(
        [Parameter(Mandatory = $true)][string]$Domain,
        [Parameter(Mandatory = $true)][string]$Prefix,
        [Parameter(Mandatory = $true)][hashtable]$Credential
    )

    $normalizedDomain = $Domain.Trim().ToLowerInvariant()
    $domains = @($normalizedDomain, "*.$normalizedDomain", "*.$Prefix.$normalizedDomain")
    $secureToken = $null
    $pluginArguments = @{}
    $certificate = $null

    if (Test-FrankenPhpCertificateReady -Domain $normalizedDomain -Prefix $Prefix) {
        Write-FrankenPhpLog -Message "Certificate already ready: $normalizedDomain" -Type 'Success'
        return $true
    }
    if ([string]::IsNullOrWhiteSpace($Credential.KeyId) -or [string]::IsNullOrWhiteSpace($Credential.KeyToken)) {
        Write-FrankenPhpLog -Message "DNSPod credential is unavailable; certificate deferred: $normalizedDomain" -Type 'Warning'
        return $false
    }

    $secureToken = ConvertTo-SecureString $Credential.KeyToken -AsPlainText -Force
    $pluginArguments = @{
        DNSPodKeyID = $Credential.KeyId
        DNSPodKeyToken = $secureToken
        DNSPodApiRoot = $script:FrankenPhpCertificateDnsApiRoot
    }
    if ([string]::IsNullOrWhiteSpace($Credential.Email)) {
        New-PACertificate -Domain $domains -Name $normalizedDomain `
            -Plugin $script:FrankenPhpCertificateDnsPlugin -PluginArgs $pluginArguments `
            -DirectoryUrl 'LE_PROD' -CertKeyLength 'ec-256' -AcceptTOS -ErrorAction Continue | Out-Null
    }
    else {
        New-PACertificate -Domain $domains -Name $normalizedDomain `
            -Plugin $script:FrankenPhpCertificateDnsPlugin -PluginArgs $pluginArguments `
            -DirectoryUrl 'LE_PROD' -CertKeyLength 'ec-256' -AcceptTOS `
            -Contact $Credential.Email -ErrorAction Continue | Out-Null
    }
    $certificate = Get-PACertificate -MainDomain $normalizedDomain -Name $normalizedDomain
    if ($null -ne $certificate) {
        Publish-FrankenPhpCertificate -Domain $normalizedDomain -Certificate $certificate | Out-Null
    }

    if (-not (Test-FrankenPhpCertificateReady -Domain $normalizedDomain -Prefix $Prefix -MinimumDays 1)) {
        Write-FrankenPhpLog -Message "Certificate postcondition failed: $normalizedDomain" -Type 'Warning'
        return $false
    }
    Write-FrankenPhpLog -Message "DNS-01 certificate ready: $normalizedDomain" -Type 'Success'
    return $true
}

function Ensure-FrankenPhpCertificates {
    $moduleReady = $false
    $access = Get-FrankenPhpAccessConfiguration
    $credential = Get-FrankenPhpCertificateCredential
    $ready = $true
    $domain = ''
    $account = $null

    Ensure-FrankenPhpCertificateModule | Out-Null
    $moduleReady = $null -ne (Get-Command New-PACertificate -ErrorAction SilentlyContinue)
    if (-not $moduleReady) {
        return $false
    }
    Ensure-FrankenPhpCertificateAccount -Credential $credential | Out-Null
    $account = Get-PAAccount -ErrorAction SilentlyContinue
    if ($null -eq $account) {
        Write-FrankenPhpLog -Message 'ACME account postcondition failed.' -Type 'Warning'
        return $false
    }
    foreach ($domain in @($access.Domains)) {
        Ensure-FrankenPhpCertificate -Domain ([string]$domain) -Prefix ([string]$access.Prefix) -Credential $credential | Out-Null
        if (-not (Test-FrankenPhpCertificateReady -Domain ([string]$domain) -Prefix ([string]$access.Prefix) -MinimumDays 1)) {
            $ready = $false
        }
    }
    return $ready
}

function Invoke-FrankenPhpCertificateRenewal {
    $moduleReady = $false
    $credential = Get-FrankenPhpCertificateCredential
    $account = $null
    $certificates = @()
    $mainDomain = ''
    $certificate = $null
    $access = $null
    $ready = $false
    $domain = ''

    Ensure-FrankenPhpCertificateModule | Out-Null
    $moduleReady = $null -ne (Get-Command Submit-Renewal -ErrorAction SilentlyContinue)
    if (-not $moduleReady) {
        return $false
    }
    Ensure-FrankenPhpCertificateAccount -Credential $credential | Out-Null
    $account = Get-PAAccount -ErrorAction SilentlyContinue
    if ($null -eq $account) {
        Write-FrankenPhpLog -Message 'ACME account postcondition failed.' -Type 'Warning'
        return $false
    }
    Submit-Renewal -AllOrders -ErrorAction Continue | Out-Null
    $certificates = @(Get-PACertificate -List)
    foreach ($certificate in $certificates) {
        $mainDomain = [string]$certificate.MainDomain
        if (-not [string]::IsNullOrWhiteSpace($mainDomain)) {
            Publish-FrankenPhpCertificate -Domain $mainDomain -Certificate $certificate | Out-Null
        }
    }
    Ensure-FrankenPhpCertificates | Out-Null
    $access = Get-FrankenPhpAccessConfiguration
    $ready = $true
    foreach ($domain in @($access.Domains)) {
        if (-not (Test-FrankenPhpCertificateReady -Domain ([string]$domain) `
            -Prefix ([string]$access.Prefix) -MinimumDays 1)) {
            $ready = $false
        }
    }
    return $ready
}

function Ensure-FrankenPhpCertificateRenewalTask {
    $powerShellPath = Join-Path $PSHOME 'powershell.exe'
    $arguments = '-NoProfile -ExecutionPolicy Bypass -File "{0}" -CertificatesOnly' -f $script:FrankenPhpCertificateStepPath
    $action = New-ScheduledTaskAction -Execute $powerShellPath -Argument $arguments
    $triggerTime = Get-Date -Hour $script:FrankenPhpCertificateRenewHour -Minute $script:FrankenPhpCertificateRenewMinute -Second 0
    $trigger = New-ScheduledTaskTrigger -Daily -At $triggerTime
    $principal = New-ScheduledTaskPrincipal -UserId 'SYSTEM' -LogonType ServiceAccount -RunLevel Highest
    $settings = New-ScheduledTaskSettingsSet -StartWhenAvailable
    $existingTask = Get-ScheduledTask -TaskName $script:FrankenPhpCertificateRenewTaskName -ErrorAction SilentlyContinue
    $existingAction = $null
    $existingTrigger = $null
    $existingTriggerTime = $null
    $configurationChanged = $false

    if ($null -eq $existingTask) {
        Register-ScheduledTask -TaskName $script:FrankenPhpCertificateRenewTaskName -Action $action `
            -Trigger $trigger -Principal $principal -Settings $settings | Out-Null
    }
    else {
        $existingAction = @($existingTask.Actions) | Select-Object -First 1
        $existingTrigger = @($existingTask.Triggers) | Select-Object -First 1
        if ($null -ne $existingTrigger -and -not [string]::IsNullOrWhiteSpace([string]$existingTrigger.StartBoundary)) {
            try {
                $existingTriggerTime = [DateTime]::Parse([string]$existingTrigger.StartBoundary)
            }
            catch {
                $existingTriggerTime = $null
            }
        }
        $configurationChanged = (
            $null -eq $existingAction -or
            $null -eq $existingTrigger -or
            [string]$existingAction.Execute -ine $powerShellPath -or
            [string]$existingAction.Arguments -cne $arguments -or
            $null -eq $existingTriggerTime -or
            $existingTriggerTime.Hour -ne $script:FrankenPhpCertificateRenewHour -or
            $existingTriggerTime.Minute -ne $script:FrankenPhpCertificateRenewMinute -or
            [int]$existingTrigger.DaysInterval -ne 1 -or
            [string]$existingTask.Principal.UserId -ine 'SYSTEM' -or
            [string]$existingTask.Principal.RunLevel -ine 'Highest' -or
            [string]$existingTask.Principal.LogonType -ine 'ServiceAccount' -or
            -not [bool]$existingTask.Settings.StartWhenAvailable
        )
        if ($configurationChanged) {
            Set-ScheduledTask -TaskName $script:FrankenPhpCertificateRenewTaskName -Action $action `
                -Trigger $trigger -Principal $principal -Settings $settings | Out-Null
        }
    }
    $existingTask = Get-ScheduledTask -TaskName $script:FrankenPhpCertificateRenewTaskName -ErrorAction SilentlyContinue
    if ($null -eq $existingTask) {
        Write-FrankenPhpLog -Message 'Certificate renewal task postcondition failed.' -Type 'Warning'
        return $false
    }
    Write-FrankenPhpLog -Message "Certificate renewal task ready: $script:FrankenPhpCertificateRenewTaskName" -Type 'Success'
    return $true
}
