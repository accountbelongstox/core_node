#!/usr/bin/env bash
# Repair the policy-selected ONNX Runtime package without modifying CUDA wheels.

OCG_COMMON_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
OCG_CUDA_INDEX="$OCG_COMMON_DIR/base_libs/cuda_index.sh"
OCG_CPU_PKG="onnxruntime"
OCG_GPU_PKG="onnxruntime-gpu"
. "$OCG_CUDA_INDEX"
OCG_ORT_CUDA_MAJOR="${AI_ONNXRUNTIME_CUDA_MAJOR:-12}"

ocg_resolve_python() {
    local candidate path
    candidate="${OCG_PYTHON:-}"
    path=""
    if [[ -n "$candidate" ]]; then
        path="$candidate"
    else
        for candidate in python3 python; do
            path="$(command -v "$candidate" 2>/dev/null)"
            [[ -n "$path" ]] && break
        done
    fi
    printf '%s' "$path"
}

ocg_gpu_present_value() {
    local nvidia_smi output present
    nvidia_smi="$(command -v nvidia-smi 2>/dev/null)"
    output=""
    present=0
    if [[ "${TORCH_FORCE_CUDA:-0}" == "1" || "${OCG_FORCE_GPU:-0}" == "1" ]]; then
        present=1
    elif [[ -n "$nvidia_smi" ]]; then
        output="$("$nvidia_smi" -L 2>&1)"
        [[ "$output" == GPU\ * ]] && present=1
    fi
    printf '%s' "$present"
}

ocg_package_present_value() {
    local metadata package_name py present
    py="$1"
    package_name="$2"
    metadata="$("$py" -m pip show "$package_name" 2>/dev/null)"
    present=0
    [[ "$metadata" == *"Name:"* ]] && present=1
    printf '%s' "$present"
}

ocg_module_ready_value() {
    local output py ready
    py="$1"
    output="$("$py" -c "import onnxruntime as ort; ort.get_available_providers(); print('__ORT_READY__')" 2>/dev/null)"
    ready=0
    [[ "$output" == *"__ORT_READY__"* ]] && ready=1
    printf '%s' "$ready"
}

ocg_ensure_onnx_runtime() {
    local gpu_present module_ready other_installed other_pkg policy_major policy_tag py repair_only target_installed target_pkg
    py="$(ocg_resolve_python)"
    repair_only="${OCG_REPAIR_ONLY:-0}"
    if [[ -z "$py" ]]; then
        echo "[onnx-guard] Python is unavailable; prerequisite repair is deferred."
    else
        gpu_present="$(ocg_gpu_present_value)"
        policy_tag="$(cuda_policy_tag 2>/dev/null)"
        policy_major="$(cuda_policy_field major "$policy_tag" 2>/dev/null)"
        target_pkg="$OCG_CPU_PKG"
        other_pkg="$OCG_GPU_PKG"
        if [[ "$gpu_present" == "1" && "$policy_major" == "$OCG_ORT_CUDA_MAJOR" ]]; then
            target_pkg="$OCG_GPU_PKG"
            other_pkg="$OCG_CPU_PKG"
        fi

        target_installed="$(ocg_package_present_value "$py" "$target_pkg")"
        other_installed="$(ocg_package_present_value "$py" "$other_pkg")"
        module_ready="$(ocg_module_ready_value "$py")"
        if [[ "$target_installed" == "1" && "$module_ready" == "1" ]]; then
            echo "[onnx-guard] [SKIP] $target_pkg is importable."
        elif [[ "$repair_only" == "1" && "$target_installed" != "1" && "$other_installed" != "1" ]]; then
            echo "[onnx-guard] No ONNX Runtime metadata exists; nothing to repair."
        else
            echo "[onnx-guard] Repairing ONNX Runtime package/module state with $target_pkg."
            if [[ "$other_installed" == "1" ]]; then
                "$py" -m pip uninstall -y "$other_pkg"
            fi
            if [[ "$target_installed" == "1" ]]; then
                "$py" -m pip uninstall -y "$target_pkg"
            fi
            "$py" -m pip install --break-system-packages "$target_pkg"
            module_ready="$(ocg_module_ready_value "$py")"
            if [[ "$module_ready" == "1" ]]; then
                echo "[onnx-guard] [OK] $target_pkg is importable."
            else
                echo "[onnx-guard] [!] ONNX Runtime remains unavailable; it will retry next run."
            fi
        fi
    fi
}

if [[ "${BASH_SOURCE[0]}" == "${0}" ]]; then
    while [[ $# -gt 0 ]]; do
        case "$1" in
            --python) OCG_PYTHON="$2"; shift 2 ;;
            --repair-only) OCG_REPAIR_ONLY=1; shift ;;
            *) shift ;;
        esac
    done
    ocg_ensure_onnx_runtime
fi
