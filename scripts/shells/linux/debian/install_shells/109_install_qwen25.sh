#!/bin/bash
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

SCRIPT_CURRENT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PARENT_DIR_LEVEL_1="$(dirname "$SCRIPT_CURRENT_DIR")"
PARENT_DIR_LEVEL_2="$(dirname "$PARENT_DIR_LEVEL_1")"

source "$PARENT_DIR_LEVEL_2/common/gvar_common.sh"
source "$PARENT_DIR_LEVEL_2/common/venv_python_common.sh"
source "$PARENT_DIR_LEVEL_2/common/common_functions.sh"
# Serialize pip into the shared venv.
PIPLOCK_LIB="$PARENT_DIR_LEVEL_2/common/base_libs/pip_lock.sh"
. "$PIPLOCK_LIB"
# Driver-matched CUDA wheel index (single source of truth).
TORCH_CUDA_IDX_LIB="$PARENT_DIR_LEVEL_2/common/base_libs/cuda_index.sh"
. "$TORCH_CUDA_IDX_LIB"
. "$PARENT_DIR_LEVEL_2/common/base_libs/lib_gpu.sh"
# Idempotent HF weight download (sentinel + curl resume + size verify).
source "$PARENT_DIR_LEVEL_2/common/tts_install_assets_common.sh"

SCRIPT_NAME="[99_install_qwen25]"
MODEL_NAME="Qwen2.5-0.5B-Instruct"
MODEL_PATH="Qwen/Qwen2.5-0.5B-Instruct"
REQUIRED_PYTHON_VERSION="3.8"
TARGET_DIR="${QWEN25_DIR:-$CORE_NODE_CACHE_DIR/pycore/qwen25}"
WEIGHTS_DIR="$TARGET_DIR/weights"
MODEL_SENTINEL="$TARGET_DIR/.model_installed"
WEIGHT_ALLOW="*.bin,*.safetensors,*.pt,*.json,*.txt,*.model,*.vocab"

print_info() {
    echo -e "\033[0;36m$SCRIPT_NAME $1\033[0m"
}

print_success() {
    echo -e "\033[0;32m$SCRIPT_NAME $1\033[0m"
}

print_warning() {
    echo -e "\033[0;33m$SCRIPT_NAME $1\033[0m"
}

print_error() {
    echo -e "\033[0;31m$SCRIPT_NAME $1\033[0m"
}

check_python() {
    local python_cmd="$VENV_PYTHON3"

    if [ ! -x "$python_cmd" ]; then
        print_error "Python is not installed at $python_cmd" >&2
        print_warning "Please install Python 3.8+: $USE_SUDO apt-get install python3 python3-pip" >&2
        return 1
    fi

    echo "[99] $python_cmd --version" >&2
    local python_version=$($python_cmd --version 2>&1)
    print_success "Python is available: $python_version" >&2

    local version_regex="Python ([0-9]+)\.([0-9]+)"
    if [[ $python_version =~ $version_regex ]]; then
        local major="${BASH_REMATCH[1]}"
        local minor="${BASH_REMATCH[2]}"

        if [ "$major" -gt 3 ] || { [ "$major" -eq 3 ] && [ "$minor" -ge 8 ]; }; then
            print_success "Python version is sufficient (3.8+)" >&2
            echo "$python_cmd"
            return 0
        else
            print_error "Python version is too old (need 3.8+, found $major.$minor)" >&2
            return 1
        fi
    fi

    echo "$python_cmd"
    return 0
}

install_dependencies() {
    local python_cmd=$1
    local torch_metadata=""

    print_info "Installing Python dependencies..."
    print_info "Using Python command: $python_cmd"
    print_info "Note: Qwen2.5 requires transformers >= 4.37.0"

    # GPU detection -- same logic as the canonical lib_gpu.sh / *_cpu_guard.sh helpers
    # (nvidia-smi -L; honors TORCH_FORCE_CUDA=1 / CUDA_VISIBLE_DEVICES=-1).
    print_info "Checking for GPU availability..."
    local has_gpu=false
    if gpu_present; then
        has_gpu=true
    fi
    if [ "$has_gpu" = true ]; then
        print_success "NVIDIA GPU detected"
    else
        print_info "No NVIDIA GPU detected, will use CPU version"
    fi
    echo ""

    # REUSE the torch provided by the prerequisite install (13_ensure_python.sh /
    # 11_cuda_nvidia_prereq.sh) whenever it is importable. NEVER uninstall it: that
    # torch may live in system site-packages this venv only reads (so the uninstall is
    # a no-op), and reinstalling just churns versions and risks conflicts with the
    # other model installers that share this venv. Only install torch when it is
    # genuinely absent.
    torch_metadata="$("$VENV_PIP3" show torch 2>/dev/null || true)"
    if [[ "$torch_metadata" == *"Name:"* ]]; then
        print_success "torch metadata is present; preserving the canonical prerequisite build"
        echo ""
    elif [[ "$has_gpu" == true ]]; then
        _qwen_torch_idx="$(torch_cuda_index_url)"
        print_info "torch not found - installing driver-matched GPU torch ($_qwen_torch_idx)..."
        echo ""
        echo "[99] $VENV_PIP3 install torch torchvision torchaudio --index-url $_qwen_torch_idx"
        vpip "$VENV_PIP3" install torch torchvision torchaudio --index-url "$_qwen_torch_idx"
        echo ""
    else
        print_info "torch not found and no GPU - installing CPU torch..."
        echo ""
        echo "[99] $VENV_PIP3 install torch torchvision torchaudio --index-url $AI_TORCH_CPU_INDEX"
        vpip "$VENV_PIP3" install torch torchvision torchaudio --index-url "$AI_TORCH_CPU_INDEX"
        echo ""
    fi

    echo "[99] checking the centralized transformers pin and accelerate"
    if shared_transformers_matches_from_common_functions "$VENV_PYTHON3" && "$VENV_PYTHON3" -c "import accelerate" >/dev/null 2>&1; then
        print_success "transformers and accelerate already installed, skipping installation"
        echo ""
    else
        print_info "Installing transformers and accelerate..."
        echo ""
        ensure_shared_transformers_from_common_functions "$VENV_PYTHON3"
        echo "[99] $VENV_PIP3 install accelerate"
        vpip "$VENV_PIP3" install accelerate
        echo ""
    fi

    print_info "Verifying installation..."
    echo "[99] $VENV_PYTHON3 -c \"import transformers; print('[OK] transformers version:', transformers.__version__)\"" >&2
    local verify_result=$("$VENV_PYTHON3" -c "import transformers; print('[OK] transformers version:', transformers.__version__)" 2>&1)

    if [[ "$verify_result" == *"[OK]"* ]]; then
        print_success "Dependencies installed successfully"
        print_success "$verify_result"
    else
        print_warning "Installation verification failed"
    fi
}

test_model_load() {
    local python_cmd=$1

    print_info "Testing model load (first run will download ~1GB)..."

    local script_dir="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
    local parent_dir_1="$(dirname "$script_dir")"
    local parent_dir_2="$(dirname "$parent_dir_1")"
    local parent_dir_3="$(dirname "$parent_dir_2")"
    local parent_dir_4="$(dirname "$parent_dir_3")"
    local test_script_path="$parent_dir_4/pytools/aitools/qwen25_runner.py"

    if [ ! -f "$test_script_path" ]; then
        print_error "Runner script not found at: $test_script_path"
        return 1
    fi

    print_info "Using shared runner script: $test_script_path"

    echo ""
    echo "[99] $VENV_PYTHON3 $test_script_path"
    "$VENV_PYTHON3" "$test_script_path"
    echo ""

    print_success "========================================"
    print_success "  Model Load Test Passed!"
    print_success "========================================"
    echo ""
}

create_interactive_script() {
    local python_cmd=$1
    local cache_dir="${XDG_CACHE_HOME:-${CORE_NODE_CACHE_DIR:-$HOME/.cache}}/core_node"

    mkdir -p "$cache_dir"

    local script_dir="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
    local parent_dir_1="$(dirname "$script_dir")"
    local parent_dir_2="$(dirname "$parent_dir_1")"
    local parent_dir_3="$(dirname "$parent_dir_2")"
    local parent_dir_4="$(dirname "$parent_dir_3")"
    local test_script_path="$parent_dir_4/pytools/aitools/qwen25_runner.py"

    if [ ! -f "$test_script_path" ]; then
        print_error "Runner script not found at: $test_script_path"
        return
    fi

    local shell_script="$cache_dir/qwen25_chat.sh"
    cat > "$shell_script" << BASH_EOF
#!/bin/bash
echo "========================================"
echo "  Qwen2.5-0.5B-Instruct Interactive Chat"
echo "========================================"
echo ""
echo "Starting chat... Please wait..."
echo ""
echo "[99] $VENV_PYTHON3 $test_script_path --chat"
"$VENV_PYTHON3" "$test_script_path" --chat
echo ""
echo "========================================"
echo "  Chat Ended"
echo "========================================"
echo ""
read -p "Press Enter to close..."
BASH_EOF

    chmod +x "$shell_script"

    print_success "Interactive chat script generated:"
    print_info "  Shell: $shell_script"
    print_info "  Using: $test_script_path"
    echo ""
    print_info "To start chatting, run:"
    print_info "  $shell_script"
}

download_model_weights() {
    print_info "Pre-downloading model weights (idempotent: sentinel + curl resume + size verify)"
    print_info "  weights : $WEIGHTS_DIR"
    print_info "  sentinel: $MODEL_SENTINEL ($([ -f "$MODEL_SENTINEL" ] && echo present || echo absent))"
    mkdir -p "$TARGET_DIR"
    local _model_ready=0 _sentinel_model=""
    if [[ -f "$MODEL_SENTINEL" ]]; then
        _sentinel_model="$(cat "$MODEL_SENTINEL" 2>/dev/null | tr -d '\r\n')"
        if [[ -n "$_sentinel_model" && "$_sentinel_model" == "$MODEL_PATH" ]] && neural_tts_local_weights_ready "$WEIGHTS_DIR" "$MODEL_PATH" "$VENV_PYTHON3" "" "$WEIGHT_ALLOW"; then
            print_success "model weights verified ($MODEL_PATH) - skipping"
            _model_ready=1
        elif [[ -n "$_sentinel_model" && "$_sentinel_model" != "$MODEL_PATH" ]]; then
            print_warning "model changed ($_sentinel_model -> $MODEL_PATH); refreshing weights."
        elif ! neural_tts_local_weights_ready "$WEIGHTS_DIR" "$MODEL_PATH" "$VENV_PYTHON3" "" "$WEIGHT_ALLOW"; then
            print_warning "local weights incomplete or corrupt; repairing download."
        fi
    fi
    if [[ "$_model_ready" -eq 0 ]]; then
        print_info "downloading/repairing model '$MODEL_PATH' (curl, resumable) ..."
        if install_hf_repo_flat "$MODEL_PATH" "$WEIGHTS_DIR" "$MODEL_SENTINEL" "$SCRIPT_NAME " "$WEIGHT_ALLOW" "" "$MODEL_PATH" "$VENV_PYTHON3" \
           && neural_tts_local_weights_ready "$WEIGHTS_DIR" "$MODEL_PATH" "$VENV_PYTHON3" "" "$WEIGHT_ALLOW"; then
            _model_ready=1
            print_success "model '$MODEL_PATH' ready at $WEIGHTS_DIR"
        else
            print_warning "model download not finished; partial files kept at $WEIGHTS_DIR; will RESUME next run."
        fi
    fi
}

main() {
    if [ "$(get_global_var "SKIP_LARGE_MODELS" "false")" = "true" ]; then
        return 0
    fi

    print_info "========================================"
    print_info "  Qwen2.5-0.5B-Instruct Installation"
    print_info "========================================"
    echo ""

    print_info "Model: $MODEL_PATH"
    print_info "Size: ~1GB (0.5B parameters)"
    print_info "Context: 32K tokens"
    print_info "Languages: 29+ (including Chinese, English, etc.)"

    echo ""
    print_info "Checking prerequisites..."

    local python_cmd
    python_cmd=$(check_python)
    if [ -z "$python_cmd" ]; then
        print_error "Python 3.8+ is required but not found"
        return
    fi

    echo ""
    print_info "Step 1: Install Python dependencies"
    install_dependencies "$python_cmd"

    echo ""
    print_info "Step 2: Pre-download model weights (idempotent)"
    download_model_weights

    echo ""
    print_info "Step 3: Test model loading (local weights)"
    test_model_load "$python_cmd"

    echo ""
    print_success "========================================"
    print_success "  Installation Successful!"
    print_success "========================================"
    echo ""
    print_success "Model: $MODEL_PATH"
    print_success "Weights: $WEIGHTS_DIR"

    echo ""
    print_info "Step 4: Create interactive chat"
    create_interactive_script "$python_cmd"

    echo ""
    print_success "Installation completed successfully!"
    print_info "You can run the chat anytime from:"
    print_info "  ${XDG_CACHE_HOME:-${CORE_NODE_CACHE_DIR:-$HOME/.cache}}/core_node/qwen25_chat.sh"
}

main
