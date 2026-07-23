#!/usr/bin/env bash
# ---------------------------------------------------------------------------
# paddle_cpu_guard.sh - Idempotent PaddlePaddle CPU/GPU build guard (Linux).
#
# On Linux x86_64, `pip install paddlepaddle-gpu` from the wrong CUDA index or
# installing GPU wheels on a CPU-only host wastes disk and breaks OCR. Several
# install paths pull paddle transitively (paddleocr, paddlex), so this guard is
# reused at key points — same policy as torch_cpu_guard.sh.
#
#   GPU present + driver usable -> paddlepaddle-gpu from driver-matched index.
#   NO GPU                      -> paddlepaddle from the CPU index; uninstall GPU pkg.
#   Already correct             -> no-op.
#
# Safe to SOURCE (pcg_* functions) or RUN directly. Python 3.12/3.13 on
# Debian/Ubuntu/Kali (system interpreter or $VENV_PYTHON3 venv). Introduced at:
#   - scripts/shells/linux/debian/install_shells/14_install_python_prereq_packages.sh
#   - scripts/shells/linux/common/iniscripts/prepare.sh (repair-only)
#
# Usage:
#   bash paddle_cpu_guard.sh
#   bash paddle_cpu_guard.sh --python /path
#   bash paddle_cpu_guard.sh --repair-only
#   source paddle_cpu_guard.sh; pcg_ensure_paddle_build
#
# Env overrides:
#   PADDLE_FORCE_CUDA=1   treat as GPU present
#   PCG_PYTHON=<path>     interpreter (same as --python)
#   PCG_REPAIR_ONLY=1     same as --repair-only
# ---------------------------------------------------------------------------

PCG_CPU_INDEX_URL="https://www.paddlepaddle.org.cn/packages/stable/cpu/"
PCG_PADDLE_VERSION="${PCG_PADDLE_VERSION:-}"

_PCG_PIPLOCK="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)/base_libs/pip_lock.sh"
[ -f "$_PCG_PIPLOCK" ] && . "$_PCG_PIPLOCK"
command -v vpip >/dev/null 2>&1 || vpip() { "$@"; }

_PCG_CUDAIDX="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)/base_libs/cuda_index.sh"
[ -f "$_PCG_CUDAIDX" ] && . "$_PCG_CUDAIDX"
command -v paddle_cuda_index_url >/dev/null 2>&1 || paddle_cuda_index_url() { printf '%s' "${AI_PADDLE_CPU_INDEX:-https://www.paddlepaddle.org.cn/packages/stable/cpu/}"; }
PCG_CPU_INDEX_URL="${AI_PADDLE_CPU_INDEX:-$PCG_CPU_INDEX_URL}"

pcg_expected_version() {
    local tag version first_row
    [[ -n "$PCG_PADDLE_VERSION" ]] && { printf '%s' "$PCG_PADDLE_VERSION"; return 0; }
    tag="$(cuda_policy_tag)"
    if [[ -n "$tag" ]]; then
        version="$(cuda_policy_field paddle_version "$tag")"
        [[ -n "$version" ]] && { printf '%s' "$version"; return 0; }
    fi
    first_row="${AI_CUDA_TIERS%%,*}"
    IFS=':' read -r _ _ _ _ _ version <<< "$first_row"
    printf '%s' "$version"
}

pcg_resolve_python() {
    local p="${PCG_PYTHON:-}"
    if [[ -n "$p" ]]; then printf '%s' "$p"; return 0; fi
    for p in python3 python; do
        if command -v "$p" >/dev/null 2>&1; then command -v "$p"; return 0; fi
    done
    return 1
}

pcg_pip_sysflags() {
    local py="$1" flags=()
    if [ ! -f "$(dirname "$py")/../pyvenv.cfg" ]; then
        flags=(--break-system-packages --no-user)
    fi
    printf '%s\n' "${flags[@]}"
}

pcg_gpu_present() {
    [[ "${PADDLE_FORCE_CUDA:-0}" == "1" ]] && return 0
    command -v nvidia-smi >/dev/null 2>&1 && nvidia-smi -L >/dev/null 2>&1
}

# Echo paddle build state: "" (missing), "cpu", or "gpu".
pcg_paddle_build_state() {
    local py="$1" output
    output="$("$py" - <<'PY' 2>/dev/null
import paddle
print("__PADDLE_GPU__" if paddle.device.is_compiled_with_cuda() else "__PADDLE_CPU__")
PY
)" || return 0
    [[ "$output" == *"__PADDLE_GPU__"* ]] && { printf '%s' "gpu"; return 0; }
    [[ "$output" == *"__PADDLE_CPU__"* ]] && printf '%s' "cpu"
}

pcg_paddle_dist_present() {
    local py="$1"
    "$py" - <<'PY' 2>/dev/null
import importlib.metadata as metadata
for name in ("paddlepaddle-gpu", "paddlepaddle"):
    try:
        metadata.distribution(name)
        raise SystemExit(0)
    except metadata.PackageNotFoundError:
        pass
raise SystemExit(1)
PY
}

pcg_paddle_requirements_satisfied() {
    local py="$1"
    "$py" - <<'PY' 2>/dev/null
import importlib.metadata as metadata
try:
    from packaging.markers import default_environment
    from packaging.requirements import Requirement
except ImportError:
    from pip._vendor.packaging.markers import default_environment
    from pip._vendor.packaging.requirements import Requirement

for name in ("paddlepaddle-gpu", "paddlepaddle"):
    try:
        dist = metadata.distribution(name)
        break
    except metadata.PackageNotFoundError:
        continue
else:
    raise SystemExit(1)

environment = default_environment()
for raw in dist.requires or ():
    requirement = Requirement(raw)
    if requirement.marker and not requirement.marker.evaluate(environment):
        continue
    try:
        installed = metadata.version(requirement.name)
    except metadata.PackageNotFoundError:
        raise SystemExit(1)
    if requirement.specifier and not requirement.specifier.contains(installed, prereleases=True):
        raise SystemExit(1)
raise SystemExit(0)
PY
}

# 0 when a GPU paddle build can see at least one CUDA device.
pcg_paddle_cuda_usable() {
    local py="$1"
    "$py" - >/dev/null 2>&1 <<'PY'
import sys
try:
    import paddle
    sys.exit(0 if paddle.device.is_compiled_with_cuda() and paddle.device.cuda.device_count() > 0 else 1)
except Exception:
    sys.exit(1)
PY
}

pcg_paddle_cuda_state() {
    local py="$1"
    "$py" - <<'PY' 2>/dev/null
import sys
try:
    import paddle
    sys.stdout.write(str(paddle.version.cuda() or ""))
except Exception:
    sys.stdout.write("")
PY
}

pcg_cuda_state_tag() {
    local state="${1:-}" major minor
    major="${state%%.*}"
    minor="${state#*.}"
    minor="${minor%%.*}"
    if [[ "$major" =~ ^[0-9]+$ && "$minor" =~ ^[0-9]+$ ]]; then
        printf 'cu%s%s' "$major" "$minor"
    fi
}

pcg_installed_version() {
    local py="$1"
    "$py" -m pip show paddlepaddle-gpu paddlepaddle 2>/dev/null |
        awk '/^Version:/{print $2; exit}'
}

pcg_uninstall_paddle_packages() {
    local py="$1"
    vpip "$py" -m pip uninstall -y paddlepaddle paddlepaddle-gpu >/dev/null 2>&1 || true
}

pcg_install_cpu_paddle() {
    local py="$1" flags=() version
    read -ra flags <<< "$(pcg_pip_sysflags "$py")"
    version="$(pcg_expected_version)"
    # Plain install: no --ignore-installed/--force-reinstall. Paddle's deps (numpy>=1.21,
    # protobuf, pillow, ...) are loosely pinned and already satisfied by the venv / inherited
    # system site-packages, so pip skips them; force-reinstall re-downloaded + reinstalled
    # numpy/protobuf/pillow every run, churning shared deps and racing the torch bundle. The
    # build-switch path calls pcg_uninstall_paddle_packages first, so this still swaps cleanly.
    vpip "$py" -m pip install "${flags[@]}" \
        --index-url "$PCG_CPU_INDEX_URL" "paddlepaddle==${version}"
}

pcg_install_gpu_paddle() {
    local py="$1" flags=() idx version
    read -ra flags <<< "$(pcg_pip_sysflags "$py")"
    idx="$(paddle_cuda_index_url)"
    version="$(pcg_expected_version)"
    # The official wheel owns its user-space CUDA dependencies. This does not replace the
    # NVIDIA driver or a system CUDA toolkit, and a healthy installation is never repeated.
    echo "[paddle-guard] Installing the official self-contained Python CUDA runtime dependencies once; this does not replace the NVIDIA driver or system CUDA Toolkit."
    vpip "$py" -m pip install "${flags[@]}" \
        --index-url "$idx" "paddlepaddle-gpu==${version}"
}

pcg_ensure_paddle_build() {
    local py state repair_only="${PCG_REPAIR_ONLY:-0}" policy_tag cuda_state installed_tag expected_version installed_version dist_present=0
    if ! py="$(pcg_resolve_python)"; then
        echo "[paddle-guard] No python interpreter found; skipping." >&2
        return 0
    fi
    state="$(pcg_paddle_build_state "$py")"
    pcg_paddle_dist_present "$py" && dist_present=1

    if pcg_gpu_present; then
        policy_tag="$(cuda_policy_tag)"
        if [[ -z "$policy_tag" ]]; then
            echo "[paddle-guard] GPU present but no common CUDA tier supports this driver; leaving paddle unchanged."
            return 0
        fi
        expected_version="$(pcg_expected_version)"
        if [[ -z "$state" ]]; then
            if [[ "$repair_only" == "1" ]]; then
                echo "[paddle-guard] GPU present, no usable Paddle import (repair-only) -> no package mutation."
            elif [[ "$dist_present" -eq 0 ]]; then
                echo "[paddle-guard] GPU present, Paddle is absent -> installing the driver-compatible GPU wheel and its Python runtime libraries."
                pcg_install_gpu_paddle "$py" || return 1
            elif [[ "$(pcg_installed_version "$py")" != "$expected_version" ]]; then
                echo "[paddle-guard] Paddle metadata exists but its version differs from $expected_version -> repairing."
                pcg_uninstall_paddle_packages "$py"
                pcg_install_gpu_paddle "$py" || return 1
            elif ! pcg_paddle_requirements_satisfied "$py"; then
                echo "[paddle-guard] Paddle installation was interrupted or has missing declared dependencies -> resuming dependency repair."
                pcg_install_gpu_paddle "$py" || return 1
            else
                echo "[paddle-guard] Paddle package and declared dependencies are present, but import still fails; leaving them unchanged to prevent a reinstall loop."
            fi
            return 0
        fi
        if [[ "$state" == "cpu" ]]; then
            echo "[paddle-guard] GPU present but paddle is CPU build -> switching to GPU build."
            pcg_uninstall_paddle_packages "$py"
            pcg_install_gpu_paddle "$py" || return 1
            return 0
        fi
        cuda_state="$(pcg_paddle_cuda_state "$py")"
        installed_tag="$(pcg_cuda_state_tag "$cuda_state")"
        installed_version="$(pcg_installed_version "$py")"
        if [[ "$installed_tag" != "$policy_tag" || "$installed_version" != "$expected_version" ]]; then
            echo "[paddle-guard] paddle ${installed_tag:-unknown}/${installed_version:-unknown} differs from $policy_tag/$expected_version -> aligning."
            pcg_uninstall_paddle_packages "$py"
            pcg_install_gpu_paddle "$py" || return 1
            return 0
        fi
        if pcg_paddle_cuda_usable "$py"; then
            echo "[paddle-guard] GPU present, canonical $policy_tag paddle is usable; no change."
        else
            echo "[paddle-guard] Canonical $policy_tag paddle is installed but CUDA cannot initialize; leaving it unchanged to avoid a reinstall loop."
        fi
        return 0
    fi

    case "$state" in
        "")
            if [[ "$repair_only" == "1" ]]; then
                echo "[paddle-guard] No GPU, no usable Paddle import (repair-only) -> no package mutation."
            elif [[ "$dist_present" -eq 0 ]]; then
                echo "[paddle-guard] No GPU, Paddle is absent -> installing CPU build."
                pcg_install_cpu_paddle "$py" || return 1
            elif [[ "$(pcg_installed_version "$py")" != "$(pcg_expected_version)" ]]; then
                echo "[paddle-guard] Paddle metadata exists but the CPU version differs from policy -> repairing."
                pcg_uninstall_paddle_packages "$py"
                pcg_install_cpu_paddle "$py" || return 1
            elif ! pcg_paddle_requirements_satisfied "$py"; then
                echo "[paddle-guard] Paddle CPU installation has missing declared dependencies -> resuming dependency repair."
                pcg_install_cpu_paddle "$py" || return 1
            else
                echo "[paddle-guard] Paddle CPU package and declared dependencies are present, but import still fails; leaving them unchanged to prevent a reinstall loop."
            fi
            ;;
        "cpu")
            expected_version="$(pcg_expected_version)"
            installed_version="$(pcg_installed_version "$py")"
            if [[ "$installed_version" == "$expected_version" ]]; then
                echo "[paddle-guard] No GPU, paddle already CPU build; ok."
            else
                echo "[paddle-guard] No GPU, paddle version drift -> aligning to $expected_version."
                pcg_uninstall_paddle_packages "$py"
                pcg_install_cpu_paddle "$py" || return 1
            fi
            ;;
        "gpu")
            echo "[paddle-guard] No GPU but paddle GPU build -> switching to CPU build."
            pcg_uninstall_paddle_packages "$py"
            pcg_install_cpu_paddle "$py" || return 1
            ;;
    esac
    return 0
}

if [[ "${BASH_SOURCE[0]}" == "${0}" ]]; then
    while [[ $# -gt 0 ]]; do
        case "$1" in
            --python)      PCG_PYTHON="$2"; shift 2 ;;
            --repair-only) PCG_REPAIR_ONLY=1; shift ;;
            *) shift ;;
        esac
    done
    pcg_ensure_paddle_build
fi
