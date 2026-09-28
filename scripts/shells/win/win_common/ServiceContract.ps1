$script:ServiceContractScriptDirectory = Split-Path -Parent $MyInvocation.MyCommand.Path
$script:ServiceContractWinDirectory = Split-Path -Parent $script:ServiceContractScriptDirectory
$script:ServiceContractShellsDirectory = Split-Path -Parent $script:ServiceContractWinDirectory
$script:ServiceContractScriptsDirectory = Split-Path -Parent $script:ServiceContractShellsDirectory
$script:ServiceContractRepositoryRoot = Split-Path -Parent $script:ServiceContractScriptsDirectory
$script:ServiceContractConfigDirectory = Join-Path $script:ServiceContractRepositoryRoot "config"
$script:ServiceContractPath = Join-Path $script:ServiceContractConfigDirectory "service_contract.json"
$script:ServiceContractDocument = Get-Content -Raw -LiteralPath $script:ServiceContractPath | ConvertFrom-Json

function Get-ServiceContractDocument {
    return $script:ServiceContractDocument
}

function Get-ServiceContractValue {
    param(
        [Parameter(Mandatory = $true)]
        [string]$ContractPath
    )

    $segments = $ContractPath.Split('.')
    $resolvedValue = $script:ServiceContractDocument
    $property = $null

    foreach ($segment in $segments) {
        $property = $resolvedValue.PSObject.Properties[$segment]
        if ($null -eq $property) {
            throw "Unknown service contract value: $ContractPath"
        }
        $resolvedValue = $property.Value
    }

    return $resolvedValue
}

function Get-ServiceContractHost {
    param(
        [Parameter(Mandatory = $true)]
        [string]$Name
    )

    $contractPath = "{0}.{1}" -f "hosts", $Name

    return [string](Get-ServiceContractValue -ContractPath $contractPath)
}

function Get-ServiceContractPort {
    param(
        [Parameter(Mandatory = $true)]
        [string]$Name
    )

    $contractPath = "{0}.{1}" -f "ports", $Name

    return [int](Get-ServiceContractValue -ContractPath $contractPath)
}

function New-ServiceContractUrl {
    param(
        [Parameter(Mandatory = $true)]
        [string]$Protocol,
        [Parameter(Mandatory = $true)]
        [string]$HostName,
        [int]$Port = 0,
        [string]$Path = ""
    )

    $baseUrl = if ($Port -gt 0) { "{0}://{1}:{2}" -f $Protocol, $HostName, $Port } else { "{0}://{1}" -f $Protocol, $HostName }
    $resolvedPath = $Path.TrimStart('/')

    if ($resolvedPath.Length -eq 0) {
        return $baseUrl
    }

    return "{0}/{1}" -f $baseUrl, $resolvedPath
}
