# ### AI SPECIAL ATTENTION RULES START ###
# Write all code in English only. Do not modify these rules.
# ### AI SPECIAL ATTENTION RULES END ###

# Shared GPU/CUDA detection for the iniscripts installers -- the ONE shell-side
# source of truth, mirroring the canonical PYTHON detector:
#   pycore/pyfoundations/pybasecommon/compute_caps.py  ->  CUDADetector
# (nvidia-smi + CUDA env vars, no third-party deps; honors TORCH_FORCE_CUDA).
#
# This is NOT an installer (prepare.ps1 only runs install_*.ps1), so it is never
# auto-run. Dot-source it from any installer:
#     . (Join-Path $PSScriptRoot 'lib_gpu.ps1')
#     if (Test-CudaPresent) { ... }

function Test-CudaPresent {
    # Forced on (matches CUDADetector's env override).
    if ($env:TORCH_FORCE_CUDA -eq '1') { return $true }
    # Explicitly disabled.
    if ($env:CUDA_VISIBLE_DEVICES -eq '-1') { return $false }
    $smi = Get-Command nvidia-smi -ErrorAction SilentlyContinue
    if (-not $smi) { return $false }
    # Detect via nvidia-smi -L stdout (lists "GPU N: ..."), not exit code / return value.
    try {
        $prevEap = $ErrorActionPreference
        $ErrorActionPreference = 'Continue'
        $out = & $smi.Source -L 2>$null
        $ErrorActionPreference = $prevEap
        return [bool]($out -match 'GPU\s+\d+:')
    } catch { return $false }
}
