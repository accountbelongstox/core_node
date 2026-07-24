# Unified CUDA runtime policy (Windows). Mirrors linux/common/base_libs/cuda_index.sh.

$pythonRuntimePath = Join-Path $PSScriptRoot 'PythonRuntimeCommon.ps1'
$pythonRuntimeLoaded = Get-Variable -Name 'PycorePythonRuntimeCommonLoaded' -Scope Script -ErrorAction SilentlyContinue
if ($null -eq $pythonRuntimeLoaded -or -not [bool]$pythonRuntimeLoaded.Value) {
    . $pythonRuntimePath
    Set-Variable -Name 'PycorePythonRuntimeCommonLoaded' -Scope Script -Value $true
}
. (Join-Path $PSScriptRoot 'AiRuntimePolicy.ps1')

function Resolve-CudaIndexNvidiaSmiExe {
    param([string]$SmiPath = 'nvidia-smi')
    $candidate = if ([string]::IsNullOrWhiteSpace($SmiPath)) { 'nvidia-smi' } else { $SmiPath }

    if (Test-Path -LiteralPath $candidate) {
        return (Resolve-Path -LiteralPath $candidate).Path
    }

    $cmd = Get-Command $candidate -ErrorAction SilentlyContinue
    if ($cmd -and $cmd.Source -and (Test-Path -LiteralPath $cmd.Source)) {
        return $cmd.Source
    }

    return Resolve-NvidiaSmiExe
}

function Get-NvidiaSmiOutputText {
    param([string]$SmiPath = 'nvidia-smi')
    $exe = Resolve-CudaIndexNvidiaSmiExe -SmiPath $SmiPath
    $output = $null
    if (-not $exe) { return '' }
    $output = & $exe 2>&1
    $text = ("$output").Trim()
    if (-not $text.Contains('NVIDIA-SMI') -and
        -not $text.Contains('CUDA Version:') -and
        -not $text.Contains('CUDA UMD Version:')) { return '' }
    return $text
}

function Get-NvidiaSmiCudaVersionString {
    param([string]$Text)
    $markers = @('CUDA UMD Version:', 'CUDA Version:')
    $markerIndex = -1
    $tail = ''
    $value = ''
    foreach ($marker in $markers) {
        $markerIndex = ([string]$Text).IndexOf($marker, [System.StringComparison]::OrdinalIgnoreCase)
        if ($markerIndex -lt 0) { continue }
        $tail = ([string]$Text).Substring($markerIndex + $marker.Length).TrimStart()
        $value = ($tail.Split([char[]]" `t`r`n|", [System.StringSplitOptions]::RemoveEmptyEntries) | Select-Object -First 1)
        if ($value) { return ([string]$value).Trim() }
    }
    return ''
}

function Get-NvidiaDriverCudaVersionLine {
    param([string]$SmiPath = 'nvidia-smi')
    $text = Get-NvidiaSmiOutputText -SmiPath $SmiPath
    $ver = Get-NvidiaSmiCudaVersionString -Text $text
    if ($ver) {
        return "CUDA Version: $ver"
    }
    return ''
}

function Get-NvidiaSmiFirstGpuLine {
    param([string]$SmiPath = 'nvidia-smi')
    $exe = Resolve-CudaIndexNvidiaSmiExe -SmiPath $SmiPath
    $output = $null
    $line = $null
    if (-not $exe) { return '' }
    $output = & $exe -L 2>&1
    $line = ("$output" -split "`n" | Where-Object { -not [string]::IsNullOrWhiteSpace($_) } | Select-Object -First 1)
    if ($null -eq $line) { return '' }
    $line = ([string]$line).Trim()
    if (-not $line.StartsWith('GPU ', [System.StringComparison]::OrdinalIgnoreCase) -or -not $line.Contains(':')) { return '' }
    return $line
}

function Get-CudaDriverCv {
    $text = Get-NvidiaSmiOutputText
    $major = 0
    $minor = 0
    $parts = @()
    $ver = ''
    if (-not $text) { return $null }
    $ver = Get-NvidiaSmiCudaVersionString -Text $text
    if (-not $ver) { return $null }
    $parts = $ver.Split('.')
    if (-not [int]::TryParse($parts[0], [ref]$major)) { return $null }
    if ($parts.Length -gt 1 -and -not [int]::TryParse($parts[1], [ref]$minor)) { return $null }
    return ($major * 100 + $minor)
}

function Get-CudaTagFromIndexUrl {
    param([string]$Url)
    $normalizedUrl = ([string]$Url).ToLowerInvariant()
    $markerIndex = $normalizedUrl.IndexOf('/cu', [System.StringComparison]::Ordinal)
    $numericTag = 0
    $tag = ''
    if ($markerIndex -ge 0 -and $normalizedUrl.Length -ge ($markerIndex + 6)) {
        $tag = $normalizedUrl.Substring($markerIndex + 1, 5)
        if ([int]::TryParse($tag.Substring(2), [ref]$numericTag)) {
            return $tag
        }
    }
    return ''
}

function Get-CudaRuntimePolicy {
    $driverCv = Get-CudaDriverCv
    $gpuPresent = Test-NvidiaGpuPresent
    $requestedTag = ([string]$env:CORE_CUDA_TAG).Trim().ToLowerInvariant()
    $torchOverrideTag = Get-CudaTagFromIndexUrl -Url $env:PYTORCH_CUDA_INDEX_URL
    $paddleOverrideTag = Get-CudaTagFromIndexUrl -Url $env:PADDLE_CUDA_INDEX_URL
    $overrideConflict = $false
    $tier = $null
    $reason = ''
    $torchPackageKey = 'AI_TORCH_PACKAGES'
    $torchPackages = @()

    if (-not $requestedTag) {
        if ($torchOverrideTag -and $paddleOverrideTag -and $torchOverrideTag -ne $paddleOverrideTag) {
            $overrideConflict = $true
        } elseif ($torchOverrideTag) {
            $requestedTag = $torchOverrideTag
        } elseif ($paddleOverrideTag) {
            $requestedTag = $paddleOverrideTag
        }
    }

    if (-not $gpuPresent) {
        $reason = 'No NVIDIA GPU detected.'
    } elseif ($null -eq $driverCv) {
        $reason = 'NVIDIA GPU detected but the driver CUDA version is unavailable.'
    } elseif ($requestedTag) {
        $requestedTier = Get-AiCudaTierByTag -Tag $requestedTag
        if ($requestedTier -and $driverCv -ge $requestedTier.MinimumDriverCv) {
            $tier = $requestedTier
        } else {
            $reason = "Requested CUDA tag '$requestedTag' is unsupported by the current policy or driver; using the canonical tier."
        }
    }
    if (-not $tier -and $null -ne $driverCv) {
        $tier = Get-AiCudaTierForDriver -DriverCv $driverCv
    }
    if (-not $tier -and -not $reason) {
        $reason = 'No common PyTorch/Paddle CUDA tier supports this driver; CPU builds are required.'
    }

    $enabled = [bool]($gpuPresent -and $null -ne $driverCv -and $tier)
    $torchBase = Get-AiRuntimePolicyValue -Name 'AI_TORCH_INDEX_BASE' -Default 'https://download.pytorch.org/whl'
    $paddleBase = Get-AiRuntimePolicyValue -Name 'AI_PADDLE_INDEX_BASE' -Default 'https://www.paddlepaddle.org.cn/packages/stable'
    $torchCpu = Get-AiRuntimePolicyValue -Name 'AI_TORCH_CPU_INDEX' -Default 'https://download.pytorch.org/whl/cpu'
    $paddleCpu = Get-AiRuntimePolicyValue -Name 'AI_PADDLE_CPU_INDEX' -Default 'https://www.paddlepaddle.org.cn/packages/stable/cpu/'
    $torchUrl = if ($enabled) { "$torchBase/$($tier.Tag)" } else { $torchCpu }
    $paddleUrl = if ($enabled) { "$paddleBase/$($tier.Tag)/" } else { $paddleCpu }
    if ($enabled -and $torchOverrideTag -eq $tier.Tag) { $torchUrl = $env:PYTORCH_CUDA_INDEX_URL }
    if ($enabled -and $paddleOverrideTag -eq $tier.Tag) { $paddleUrl = $env:PADDLE_CUDA_INDEX_URL }
    if ($enabled) { $torchPackageKey = "AI_TORCH_PACKAGES_$($tier.Tag.ToUpperInvariant())" }
    $torchPackages = @(Get-AiRuntimePolicyList -Name $torchPackageKey)
    if ($torchPackages.Count -eq 0) {
        $torchPackages = @(Get-AiRuntimePolicyList -Name 'AI_TORCH_PACKAGES')
    }

    return [PSCustomObject]@{
        Enabled          = $enabled
        GpuPresent       = $gpuPresent
        DriverCv         = $driverCv
        Tag              = if ($tier) { $tier.Tag } else { '' }
        Major            = if ($tier) { $tier.Major } else { 0 }
        ToolkitVersion   = if ($tier) { $tier.ToolkitVersion } else { '' }
        ToolkitDriver    = if ($tier) { $tier.ToolkitDriver } else { '' }
        TorchPackages    = $torchPackages
        TorchIndexUrl    = $torchUrl
        PaddleIndexUrl   = $paddleUrl
        OverrideConflict = $overrideConflict
        Reason           = $reason
    }
}

function Get-CanonicalTorchPackageSpecs {
    return @((Get-CudaRuntimePolicy).TorchPackages)
}

function Get-TorchCudaIndexUrl {
    return (Get-CudaRuntimePolicy).TorchIndexUrl
}

function Get-PaddleCudaIndexUrl {
    return (Get-CudaRuntimePolicy).PaddleIndexUrl
}
