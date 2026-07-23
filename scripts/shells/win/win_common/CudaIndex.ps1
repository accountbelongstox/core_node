# Unified CUDA runtime policy (Windows). Mirrors linux/common/base_libs/cuda_index.sh.

if (-not (Get-Command Resolve-NvidiaSmiExe -ErrorAction SilentlyContinue)) {
    . (Join-Path $PSScriptRoot 'PythonRuntimeCommon.ps1')
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

    if (Get-Command Resolve-NvidiaSmiExe -ErrorAction SilentlyContinue) {
        return Resolve-NvidiaSmiExe
    }

    return $null
}

function Get-NvidiaSmiOutputText {
    param([string]$SmiPath = 'nvidia-smi')
    $exe = Resolve-CudaIndexNvidiaSmiExe -SmiPath $SmiPath
    $output = $null
    $exitCode = 1
    if (-not $exe) { return '' }
    $output = & $exe 2>&1
    $exitCode = $LASTEXITCODE
    if ($exitCode -ne 0) { return '' }
    return ("$output").Trim()
}

function Get-NvidiaSmiCudaVersionString {
    param([string]$Text)
    if ($Text -match 'CUDA Version:\s*([0-9.]+)') {
        return [string]$Matches[1]
    }
    if ($Text -match 'CUDA UMD Version:\s*([0-9.]+)') {
        return [string]$Matches[1]
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
    $exitCode = 1
    $line = $null
    if (-not $exe) { return '' }
    $output = & $exe -L 2>&1
    $exitCode = $LASTEXITCODE
    if ($exitCode -ne 0) { return '' }
    $line = ("$output" -split "`n" | Where-Object { -not [string]::IsNullOrWhiteSpace($_) } | Select-Object -First 1)
    if ($null -eq $line) { return '' }
    $line = ([string]$line).Trim()
    if ($line -notmatch '^GPU\s+\d+:') { return '' }
    return $line
}

function Get-CudaDriverCv {
    $text = Get-NvidiaSmiOutputText
    if (-not $text) { return $null }
    try {
        $ver = Get-NvidiaSmiCudaVersionString -Text $text
        if (-not $ver) { return $null }
        $parts = $ver.Split('.')
        $major = [int]$parts[0]
        $minor = 0
        if ($parts.Length -gt 1) { $minor = [int]$parts[1] }
        return ($major * 100 + $minor)
    } catch {
        return $null
    }
}

function Get-CudaTagFromIndexUrl {
    param([string]$Url)
    if (([string]$Url).ToLowerInvariant() -match '/(cu\d{3})/?(?:$|[?#])') {
        return $Matches[1]
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

    return [PSCustomObject]@{
        Enabled          = $enabled
        GpuPresent       = $gpuPresent
        DriverCv         = $driverCv
        Tag              = if ($tier) { $tier.Tag } else { '' }
        Major            = if ($tier) { $tier.Major } else { 0 }
        ToolkitVersion   = if ($tier) { $tier.ToolkitVersion } else { '' }
        ToolkitDriver    = if ($tier) { $tier.ToolkitDriver } else { '' }
        PaddleVersion    = if ($tier) { $tier.PaddleVersion } else { '' }
        TorchIndexUrl    = $torchUrl
        PaddleIndexUrl   = $paddleUrl
        OverrideConflict = $overrideConflict
        Reason           = $reason
    }
}

function Get-TorchCudaIndexUrl {
    return (Get-CudaRuntimePolicy).TorchIndexUrl
}

function Get-PaddleCudaIndexUrl {
    return (Get-CudaRuntimePolicy).PaddleIndexUrl
}
