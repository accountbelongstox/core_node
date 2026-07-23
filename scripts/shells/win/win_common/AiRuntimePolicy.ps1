# Cross-platform AI runtime policy reader for Windows installers.

$script:AiRuntimePolicyPath = Join-Path (Split-Path (Split-Path $PSScriptRoot -Parent) -Parent) 'ai_runtime_policy.env'
$script:AiRuntimePolicyData = $null

function Import-AiRuntimePolicyData {
    $data = @{}
    if (-not (Test-Path -LiteralPath $script:AiRuntimePolicyPath)) {
        throw "AI runtime policy not found: $script:AiRuntimePolicyPath"
    }
    foreach ($line in (Get-Content -LiteralPath $script:AiRuntimePolicyPath)) {
        $text = ([string]$line).Trim()
        if (-not $text -or $text.StartsWith('#')) { continue }
        if ($text -notmatch '^([A-Z0-9_]+)=(.*)$') { continue }
        $name = $Matches[1]
        $value = $Matches[2].Trim()
        if ($value.Length -ge 2) {
            $first = $value.Substring(0, 1)
            $last = $value.Substring($value.Length - 1, 1)
            if (($first -eq "'") -and ($last -eq "'")) {
                $value = $value.Substring(1, $value.Length - 2)
            }
        }
        $data[$name] = $value
    }
    return $data
}

function Get-AiRuntimePolicyValue {
    param(
        [Parameter(Mandatory = $true)][string]$Name,
        [string]$Default = ''
    )
    if ($script:AiRuntimePolicyData.ContainsKey($Name)) {
        return [string]$script:AiRuntimePolicyData[$Name]
    }
    return $Default
}

function Get-AiRuntimePolicyList {
    param([Parameter(Mandatory = $true)][string]$Name)
    $value = Get-AiRuntimePolicyValue -Name $Name
    if (-not $value) { return @() }
    return @($value.Split(',') | ForEach-Object { $_.Trim() } | Where-Object { $_ })
}

function Get-AiCudaTiers {
    $tiers = @()
    $rows = Get-AiRuntimePolicyList -Name 'AI_CUDA_TIERS'
    foreach ($row in $rows) {
        $parts = $row.Split(':')
        if ($parts.Count -ne 6) { continue }
        $tiers += [PSCustomObject]@{
            Tag             = $parts[0]
            MinimumDriverCv = [int]$parts[1]
            Major           = [int]$parts[2]
            ToolkitVersion  = $parts[3]
            ToolkitDriver   = $parts[4]
            PaddleVersion   = $parts[5]
            DisplayVersion  = $parts[0].Substring(2).Insert($parts[0].Length - 3, '.')
        }
    }
    return @($tiers | Sort-Object -Property MinimumDriverCv -Descending)
}

function Get-AiCudaTierByTag {
    param([string]$Tag)
    $normalized = ([string]$Tag).Trim().ToLowerInvariant()
    return Get-AiCudaTiers | Where-Object { $_.Tag -eq $normalized } | Select-Object -First 1
}

function Get-AiCudaTierForDriver {
    param([Nullable[int]]$DriverCv)
    if ($null -eq $DriverCv) { return $null }
    return Get-AiCudaTiers | Where-Object { $DriverCv -ge $_.MinimumDriverCv } | Select-Object -First 1
}

$script:AiRuntimePolicyData = Import-AiRuntimePolicyData
