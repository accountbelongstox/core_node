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
# Serialize pip into the shared venv (safe under the LLM parallel group). Defensive.
PIPLOCK_LIB="$PARENT_DIR_LEVEL_2/common/base_libs/pip_lock.sh"
. "$PIPLOCK_LIB"
# Idempotent HF weight download (sentinel + curl resume + size verify).
source "$PARENT_DIR_LEVEL_2/common/tts_install_assets_common.sh"

SCRIPT_NAME="[100_install_nllb200]"
MODEL_NAME="NLLB-200"
MODEL_PATH="facebook/nllb-200-distilled-600M"
REQUIRED_PYTHON_VERSION="3.8"
TARGET_DIR="${NLLB200_DIR:-$CORE_NODE_CACHE_DIR/pycore/nllb200}"
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
        print_error "Python is not installed at $python_cmd"
        print_warning "Please install Python 3.8+: $USE_SUDO apt-get install python3 python3-pip"
        return 1
    fi

    echo "$SCRIPT_NAME $python_cmd --version" >&2
    local python_version=$($python_cmd --version 2>&1)
    print_success "Python is available: $python_version"

    local version_regex="Python ([0-9]+)\.([0-9]+)"
    if [[ $python_version =~ $version_regex ]]; then
        local major="${BASH_REMATCH[1]}"
        local minor="${BASH_REMATCH[2]}"

        if [ "$major" -ge 3 ] && [ "$minor" -ge 8 ]; then
            print_success "Python version is sufficient (3.8+)"
            echo "$python_cmd"
            return 0
        else
            print_error "Python version is too old (need 3.8+, found $major.$minor)"
            return 1
        fi
    fi

    echo "$python_cmd"
    return 0
}

install_dependencies() {
    local python_cmd=$1

    print_info "Installing Python dependencies..."
    print_info "Using Python command: $python_cmd"
    print_info "Note: NLLB-200 requires transformers and sentencepiece"

    # GPU detection -- same logic as the canonical lib_gpu.sh / *_cpu_guard.sh helpers
    # (nvidia-smi -L; honors TORCH_FORCE_CUDA=1 / CUDA_VISIBLE_DEVICES=-1).
    print_info "Checking for GPU availability..."
    local has_gpu=false
    if [ "${TORCH_FORCE_CUDA:-0}" = "1" ]; then
        has_gpu=true
    elif [ "${CUDA_VISIBLE_DEVICES:-}" = "-1" ]; then
        has_gpu=false
    elif command -v nvidia-smi >/dev/null 2>&1 && nvidia-smi -L >/dev/null 2>&1; then
        has_gpu=true
    fi
    if [ "$has_gpu" = true ]; then
        print_success "NVIDIA GPU detected"
    else
        print_info "No NVIDIA GPU detected, will use CPU version"
    fi
    echo ""

    # Note: NLLB-200 works well with CPU, no need for GPU-specific torch
    print_info "Installing transformers, sentencepiece, and protobuf..."
    echo ""
    # Preserve the shared transformers distribution; pip installs only missing packages.
    print_and_run_from_common vpip "$VENV_PYTHON3" -m pip install "$LLM_TRANSFORMERS_SPEC" sentencepiece protobuf sacremoses
    echo ""

    print_info "Verifying installation..."
    echo "$SCRIPT_NAME $VENV_PYTHON3 -c \"import transformers; import sentencepiece; print('[OK] transformers version:', transformers.__version__); print('[OK] sentencepiece installed')\"" >&2
    local verify_result=$("$VENV_PYTHON3" -c "import transformers; import sentencepiece; print('[OK] transformers version:', transformers.__version__); print('[OK] sentencepiece installed')" 2>&1)

    if [[ "$verify_result" == *"[OK]"* ]]; then
        print_success "Dependencies installed successfully"
        print_success "$verify_result"
    else
        print_warning "Installation verification failed"
    fi
}

test_model_load() {
    local python_cmd=$1

    print_info "Testing model load (first run will download ~1.2GB)..."

    local script_dir="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
    local parent_dir_1="$(dirname "$script_dir")"
    local parent_dir_2="$(dirname "$parent_dir_1")"
    local parent_dir_3="$(dirname "$parent_dir_2")"
    local parent_dir_4="$(dirname "$parent_dir_3")"
    local runner_script_path="$parent_dir_4/pytools/aitools/nllb200_tester.py"

    if [ ! -f "$runner_script_path" ]; then
        print_error "Runner script not found at: $runner_script_path"
        return
    fi

    print_info "Using shared tester script: $runner_script_path"

    echo ""
    print_and_run_from_common "$VENV_PYTHON3" "$runner_script_path"
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
    local runner_script_path="$parent_dir_4/pytools/aitools/nllb200_translator.py"

    if [ ! -f "$runner_script_path" ]; then
        print_error "Translator script not found at: $runner_script_path"
        return 1
    fi

    local shell_script="$cache_dir/nllb200_translate.sh"
    cat > "$shell_script" << BASH_EOF
#!/bin/bash
echo "========================================"
echo "  NLLB-200 Translation Tool"
echo "  196 Languages Support"
echo "========================================"
echo ""
echo "Starting translator... Please wait..."
echo ""
echo "[run] $VENV_PYTHON3 $runner_script_path"
$VENV_PYTHON3 "$runner_script_path"
echo ""
echo "========================================"
echo "  Translation Ended"
echo "========================================"
echo ""
read -p "Press Enter to close..."
BASH_EOF

    chmod +x "$shell_script"

    print_success "Interactive translation script generated:"
    print_info "  Shell: $shell_script"
    print_info "  Using: $runner_script_path"
    echo ""
    print_info "To start translating, run:"
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
    print_info "  NLLB-200 Installation"
    print_info "========================================"
    echo ""

    print_info "Model: $MODEL_PATH"
    print_info "Size: ~1.2GB (600M parameters distilled)"
    print_info "Languages: 196 languages"
    print_info "Type: Machine Translation"

    echo ""
    print_info "Checking prerequisites..."

    local python_cmd=$(check_python)
    if [ $? -ne 0 ]; then
        print_error "Python 3.8+ is required but not found"
        return 1
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
    print_info "Step 4: Create interactive translator"
    create_interactive_script "$python_cmd"

    echo ""
    print_success "Installation completed successfully!"
    print_info "You can run the translator anytime from:"
    print_info "  ${XDG_CACHE_HOME:-${CORE_NODE_CACHE_DIR:-$HOME/.cache}}/core_node/nllb200_translate.sh"

    return 0
}

main
exit $?
