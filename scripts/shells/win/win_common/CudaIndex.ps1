# Driver-matched CUDA wheel index URLs (Windows). Mirrors linux/common/base_libs/cuda_index.sh.

if (-not (Get-Command Resolve-NvidiaSmiExe -ErrorAction SilentlyContinue)) {
    . (Join-Path $PSScriptRoot 'PythonRuntimeCommon.ps1')
}

function Resolve-CudaIndexNvidiaSmiExe {
    param([string]$SmiPath = 'nvidia-smi')

    if ($SmiPath -and (Test-Path -LiteralPath $SmiPath)) {
        return (Resolve-Path -LiteralPath $SmiPath).Path
    }

    $cmd = Get-Command $SmiPath -ErrorAction SilentlyContinue
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
    if (-not $exe) { return '' }
    return ("$(& $exe 2>&1)").Trim()
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
    if (-not $exe) { return '' }
    $output = & $exe -L 2>&1
    $line = ("$output" -split "`n" | Where-Object { -not [string]::IsNullOrWhiteSpace($_) } | Select-Object -First 1)
    if ($null -eq $line) { return '' }
    return ([string]$line).Trim()
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

function Get-TorchCudaIndexUrl {
    if ($env:PYTORCH_CUDA_INDEX_URL) { return $env:PYTORCH_CUDA_INDEX_URL }
    $tag = 'cu124'
    $cv = Get-CudaDriverCv
    if ($null -ne $cv) {
        if ($cv -ge 1300) { $tag = 'cu130' }
        elseif ($cv -ge 1208) { $tag = 'cu128' }
        elseif ($cv -ge 1206) { $tag = 'cu126' }
        elseif ($cv -ge 1204) { $tag = 'cu124' }
        elseif ($cv -ge 1201) { $tag = 'cu121' }
        elseif ($cv -ge 1108) { $tag = 'cu118' }
    }
    return "https://download.pytorch.org/whl/$tag"
}

function Get-PaddleCudaIndexUrl {
    if ($env:PADDLE_CUDA_INDEX_URL) { return $env:PADDLE_CUDA_INDEX_URL }
    $tag = 'cu126'
    $cv = Get-CudaDriverCv
    if ($null -ne $cv) {
        if ($cv -ge 1300) { $tag = 'cu130' }
        elseif ($cv -ge 1209) { $tag = 'cu129' }
        elseif ($cv -ge 1206) { $tag = 'cu126' }
        elseif ($cv -ge 1108) { $tag = 'cu118' }
    }
    return "https://www.paddlepaddle.org.cn/packages/stable/$tag/"
}
