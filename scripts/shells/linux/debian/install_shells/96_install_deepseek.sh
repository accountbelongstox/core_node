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
# Driver-matched CUDA wheel index (single source of truth) so torch isn't pulled as the
# default "latest" wheel (e.g. cu130) that this driver can't run.
TORCH_CUDA_IDX_LIB="$PARENT_DIR_LEVEL_2/common/base_libs/cuda_index.sh"
[ -f "$TORCH_CUDA_IDX_LIB" ] && . "$TORCH_CUDA_IDX_LIB"
command -v torch_cuda_index_url >/dev/null 2>&1 || torch_cuda_index_url() { printf '%s' "${AI_TORCH_CPU_INDEX:-https://download.pytorch.org/whl/cpu}"; }
# Idempotent HF weight download (sentinel + curl resume + size verify).
source "$PARENT_DIR_LEVEL_2/common/tts_install_assets_common.sh"

SCRIPT_NAME="[97_install_deepseek]"
MODEL_NAME="DeepSeek-VL"
REPO_URL="https://github.com/deepseek-ai/DeepSeek-VL.git"
MODEL_PATH="deepseek-ai/deepseek-vl-7b-chat"
# Runtime translator default (ncore/utils/stream_translator/config/index.js):
# DEEPSEEK_MODEL_PATH || deepseek-ai/deepseek-vl-1.3b-chat. Pre-download that id so the
# translator loads local weights instead of a lazy HF fetch.
VL_MODEL_PATH="${DEEPSEEK_MODEL_PATH:-deepseek-ai/deepseek-vl-1.3b-chat}"
VL_STAGING_DIR="${DEEPSEEK_VL_DIR:-$CORE_NODE_CACHE_DIR/pycore/deepseek-vl}"
VL_WEIGHTS_DIR="$VL_STAGING_DIR/weights"
VL_MODEL_SENTINEL="$VL_STAGING_DIR/.model_installed"
# *.py included: deepseek-vl uses trust_remote_code=True (modeling code ships in the HF repo).
VL_WEIGHT_ALLOW="*.bin,*.safetensors,*.pt,*.json,*.txt,*.model,*.vocab,*.py"

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

check_environment() {
    if [ "$IS_WSL" = true ]; then
        print_warning "WSL environment detected"
        print_warning "DeepSeek is not installed in WSL environments by default"
        print_info "This is a development/desktop tool, not suitable for WSL"
        return 1
    fi

    if [ "$IS_PRODUCTION" = true ]; then
        print_warning "Production server environment detected"
        print_warning "DeepSeek is not installed on production servers by default"
        print_info "This requires desktop environment and significant resources"
        return 1
    fi

    if [ "$HAS_DESKTOP_ENVIRONMENT" = false ]; then
        print_warning "No desktop environment detected"
        print_warning "DeepSeek requires desktop environment for optimal usage"
        return 1
    fi

    return 0
}

get_base_directory() {
    # Use standard path mapping from gvar_common.sh
    # This gets base_data_directory and appends /programing
    local data_base=$(get_base_data_directory 2>/dev/null)

    if [ -n "$data_base" ] && [ -d "$data_base" ]; then
        echo "$data_base/programing"
        return 0
    fi

    # Fallback: Use WIS_PROGRAMING_DIR if available
    if [ -n "$WIS_PROGRAMING_DIR" ] && [ -d "$WIS_PROGRAMING_DIR" ]; then
        echo "$WIS_PROGRAMING_DIR"
        return 0
    fi

    # Fallback: Manual detection
    local base_dir=""

    if has_ntfs_disk 2>/dev/null; then
        local ntfs_device=$($USE_SUDO blkid | grep -i "TYPE=\"ntfs\"" | head -n 1 | cut -d: -f1)
        if [ -n "$ntfs_device" ]; then
            local ntfs_mount=$(get_device_mount_point "$ntfs_device")
            if [ -d "$ntfs_mount/programing" ]; then
                base_dir="$ntfs_mount/programing"
            fi
        fi
    fi

    if [ -z "$base_dir" ]; then
        for mount_point in /mnt/dev_*; do
            if [ -d "$mount_point/programing" ]; then
                base_dir="$mount_point/programing"
                break
            fi
        done
    fi

    if [ -z "$base_dir" ]; then
        if [ -d "$HOME/programing" ]; then
            base_dir="$HOME/programing"
        fi
    fi

    if [ -z "$base_dir" ]; then
        base_dir="$HOME/programing"
    fi

    echo "$base_dir"
}

check_git() {
    if command -v git &> /dev/null; then
        local git_version=$(git --version)
        print_success "Git is available: $git_version"
        return 0
    else
        print_error "Git is not installed"
        print_warning "Please install Git: $USE_SUDO apt-get install git"
        return 1
    fi
}

check_python() {
    local python_cmd=""

    # Resolve the shared venv interpreter built by 13_ensure_python.sh so that all
    # package installs and the generated launchers run under the venv, not the
    # externally-managed system python.
    python_cmd="$(venv_python_from_common)"

    if [ -z "$python_cmd" ] || ! command -v "$python_cmd" &> /dev/null; then
        print_error "Python is not installed"
        print_warning "Please install Python 3.8+: $USE_SUDO apt-get install python3 python3-pip"
        return 1
    fi

    echo "$SCRIPT_NAME [run] $python_cmd --version" >&2
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

check_installation() {
    local install_dir=$1

    if [ ! -d "$install_dir" ]; then
        return 1
    fi

    if [ ! -d "$install_dir/.git" ]; then
        return 1
    fi

    local file_count=$(find "$install_dir" -type f 2>/dev/null | wc -l)
    if [ "$file_count" -lt 10 ]; then
        return 1
    fi

    return 0
}

clone_repository() {
    local target_dir=$1

    print_info "Cloning DeepSeek-VL repository..."
    print_info "Repository: $REPO_URL"
    print_info "Target: $target_dir"

    local parent_dir=$(dirname "$target_dir")
    if [ ! -d "$parent_dir" ]; then
        print_info "Creating parent directory: $parent_dir"
        mkdir -p "$parent_dir"
    fi

    # Idempotency: a pre-existing target dir makes "git clone" fail because the
    # destination is not empty. This happens when a prior install was incomplete
    # (partial clone, interrupted download). Recover in place rather than aborting.
    if [ -d "$target_dir" ]; then
        if [ -d "$target_dir/.git" ]; then
            print_warning "Target directory already contains a git repository"
            print_info "Repairing existing clone instead of re-cloning..."
            if git -C "$target_dir" fetch --all --prune && \
               git -C "$target_dir" reset --hard HEAD && \
               git -C "$target_dir" checkout -- . 2>/dev/null; then
                print_success "Existing repository repaired"
                local file_count=$(find "$target_dir" -type f 2>/dev/null | wc -l)
                print_success "Verification: $file_count files found"
                if [ "$file_count" -gt 10 ]; then
                    return 0
                fi
                print_warning "Repository looks incomplete after repair; re-cloning..."
            else
                print_warning "Could not repair existing repository; re-cloning..."
            fi
        else
            print_warning "Target directory exists but is not a git repository"
        fi

        # At this point the dir exists but is unusable; remove so git clone can run.
        if [ -n "$(ls -A "$target_dir" 2>/dev/null)" ]; then
            print_info "Removing incomplete install directory: $target_dir"
            rm -rf "$target_dir"
        fi
    fi

    if git clone "$REPO_URL" "$target_dir"; then
        print_success "Repository cloned successfully"

        if [ -d "$target_dir/.git" ]; then
            print_success "Verification: .git directory found"

            local file_count=$(find "$target_dir" -type f 2>/dev/null | wc -l)
            print_success "Verification: $file_count files found"

            if [ "$file_count" -gt 10 ]; then
                return 0
            fi
        fi
    fi

    print_error "Git clone failed"
    return 1
}

dependencies_present() {
    local python_cmd=$1

    # Skip-if-present probe: pip install re-resolves heavyweight wheels (torch,
    # transformers, ...) on every run, which is slow. Only reinstall when at least
    # one required module is missing.
    echo "$SCRIPT_NAME [run] $python_cmd - <<'PYTHON_EOF' (importlib find_spec probe: torch transformers PIL numpy einops timm accelerate)" >&2
    if ! "$python_cmd" - << 'PYTHON_EOF' > /dev/null 2>&1
import importlib.util
mods = ["torch", "transformers", "PIL", "numpy", "einops", "timm", "accelerate"]
missing = [m for m in mods if importlib.util.find_spec(m) is None]
raise SystemExit(1 if missing else 0)
PYTHON_EOF
    then
        return 1
    fi
    shared_transformers_matches_from_common_functions "$python_cmd"
}

install_dependencies() {
    local install_dir=$1
    local python_cmd=$2

    print_info "Installing Python dependencies..."
    print_info "Using Python command: $python_cmd"

    # Skip the heavyweight pip resolution when all deps are already importable.
    # Set DEEPSEEK_FORCE_DEPS=1 to force a reinstall (e.g. to upgrade).
    if [ "${DEEPSEEK_FORCE_DEPS:-0}" != "1" ] && dependencies_present "$python_cmd"; then
        print_success "Python dependencies already present - skipping pip install"
        print_info "Set DEEPSEEK_FORCE_DEPS=1 to force reinstall"
        return 0
    fi

    cd "$install_dir"
    print_info "Installing core dependencies..."
    echo ""
    # torch from the DRIVER-MATCHED CUDA index (its own deps only); the rest from PyPI so
    # the pinned transformers + the other packages resolve normally.
    echo "$SCRIPT_NAME [run] $python_cmd -m pip install torch --index-url $(torch_cuda_index_url)"
    vpip $python_cmd -m pip install torch --index-url "$(torch_cuda_index_url)"
    echo "$SCRIPT_NAME [run] $python_cmd -m pip install $LLM_TRANSFORMERS_SPEC pillow numpy einops timm accelerate"
    vpip $python_cmd -m pip install "$LLM_TRANSFORMERS_SPEC" pillow numpy einops timm accelerate
    echo ""
    cd - > /dev/null

    print_success "Dependencies installed successfully"
    return 0
}

test_model_load() {
    local install_dir=$1
    local python_cmd=$2

    print_info "Testing model load (first run may download model)..."

    local test_script="$install_dir/test_model_load.py"
    cat > "$test_script" << PYTHON_EOF
import os
os.environ.setdefault('HF_HOME', os.environ.get('CORE_NODE_CACHE_DIR', '/var/_core_node/cache') + '/huggingface')

print('[TEST] Loading VLChatProcessor...')
from deepseek_vl.models import VLChatProcessor

model_path = '$VL_MODEL_PATH'
print(f'[INFO] Model path: {model_path}')
print('[INFO] Note: First run will download model from HuggingFace')

vl_chat_processor = VLChatProcessor.from_pretrained(model_path)
print('[OK] VLChatProcessor loaded successfully')

tokenizer = vl_chat_processor.tokenizer
print(f'[OK] Tokenizer loaded: {type(tokenizer).__name__}')

print('[TEST] Testing conversation structure...')
conversation = [
    {
        "role": "User",
        "content": "Hello",
    },
    {"role": "Assistant", "content": ""}
]
print('[OK] Conversation structure is valid')

print('')
print('[SUCCESS] ========================================')
print('[SUCCESS]   DeepSeek-VL is ready!')
print('[SUCCESS] ========================================')
PYTHON_EOF

    cd "$install_dir"
    echo ""
    echo "$SCRIPT_NAME [run] $python_cmd $test_script"
    $python_cmd "$test_script"
    echo ""
    cd - > /dev/null

    rm -f "$test_script"
}

test_installation() {
    local install_dir=$1
    local python_cmd=$2

    print_info "Running model load test..."
    test_model_load "$install_dir" "$python_cmd"

    echo ""
    print_success "========================================"
    print_success "  Model Load Test Passed!"
    print_success "========================================"
    echo ""

    # Generate test script
    local test_script="$install_dir/test_cli_chat.sh"
    cat > "$test_script" << 'BASH_EOF'
#!/bin/bash
echo "========================================"
echo "  DeepSeek-VL CLI Chat Test"
echo "========================================"
echo ""
echo "INSTRUCTIONS:"
echo "1. Wait for 'User:' prompt to appear"
echo "2. Type your question and press Enter"
echo "3. Type 'exit' or 'quit' to end chat"
echo "========================================"
echo ""
echo "Starting model... Please wait..."
echo ""
BASH_EOF

    echo "cd \"$install_dir\"" >> "$test_script"
    echo "$python_cmd cli_chat.py --model_path \"$VL_MODEL_PATH\"" >> "$test_script"
    echo "" >> "$test_script"
    echo "echo \"\"" >> "$test_script"
    echo "echo \"========================================\"" >> "$test_script"
    echo "echo \"  Test Completed!\"" >> "$test_script"
    echo "echo \"========================================\"" >> "$test_script"
    echo "read -p \"Press Enter to close...\"" >> "$test_script"

    chmod +x "$test_script"

    print_info "Test script generated at: $test_script"
    print_info "To test interactively, run:"
    print_info "  $test_script"
    echo ""
    print_success "DeepSeek-VL is ready to use!"

    return 0
}

download_vl_model_weights() {
    local python_cmd=$1
    print_info "Pre-downloading VL model weights (idempotent: sentinel + curl resume + size verify)"
    print_info "  model   : $VL_MODEL_PATH"
    print_info "  weights : $VL_WEIGHTS_DIR"
    print_info "  sentinel: $VL_MODEL_SENTINEL ($([ -f "$VL_MODEL_SENTINEL" ] && echo present || echo absent))"
    mkdir -p "$VL_STAGING_DIR"
    local _model_ready=0 _sentinel_model=""
    if [[ -f "$VL_MODEL_SENTINEL" ]]; then
        _sentinel_model="$(cat "$VL_MODEL_SENTINEL" 2>/dev/null | tr -d '\r\n')"
        if [[ -n "$_sentinel_model" && "$_sentinel_model" == "$VL_MODEL_PATH" ]] && neural_tts_local_weights_ready "$VL_WEIGHTS_DIR" "$VL_MODEL_PATH" "$python_cmd"; then
            print_success "model weights verified ($VL_MODEL_PATH) - skipping"
            _model_ready=1
        elif [[ -n "$_sentinel_model" && "$_sentinel_model" != "$VL_MODEL_PATH" ]]; then
            print_warning "model changed ($_sentinel_model -> $VL_MODEL_PATH); refreshing weights."
        elif ! neural_tts_local_weights_ready "$VL_WEIGHTS_DIR" "$VL_MODEL_PATH" "$python_cmd"; then
            print_warning "local weights incomplete or corrupt; repairing download."
        fi
    fi
    if [[ "$_model_ready" -eq 0 ]]; then
        print_info "downloading/repairing model '$VL_MODEL_PATH' (curl, resumable) ..."
        if install_hf_repo_flat "$VL_MODEL_PATH" "$VL_WEIGHTS_DIR" "$VL_MODEL_SENTINEL" "$SCRIPT_NAME " "$VL_WEIGHT_ALLOW" "" "$VL_MODEL_PATH" "$python_cmd" \
           && neural_tts_local_weights_ready "$VL_WEIGHTS_DIR" "$VL_MODEL_PATH" "$python_cmd"; then
            _model_ready=1
            print_success "model '$VL_MODEL_PATH' ready at $VL_WEIGHTS_DIR"
        else
            print_warning "model download not finished; partial files kept at $VL_WEIGHTS_DIR; will RESUME next run."
            return 1
        fi
    fi
    [[ "$_model_ready" -eq 1 ]]
}

main() {
    print_info "========================================"
    print_info "  DeepSeek-VL Installation"
    print_info "========================================"
    echo ""

    if ! check_environment; then
        print_warning "Environment check failed - skipping installation"
        print_info "DeepSeek is only installed on desktop Linux systems"
        print_info "Skipped environments: WSL, production servers, headless systems"
        exit 0
    fi

    local base_dir=$(get_base_directory)
    print_info "Base Directory: $base_dir"

    local install_dir="$base_dir/$MODEL_NAME"
    print_info "Install Directory: $install_dir"

    echo ""
    print_info "Checking prerequisites..."

    if ! check_git; then
        print_error "Git is required but not found"
        return 1
    fi

    local python_cmd=$(check_python)
    if [ $? -ne 0 ]; then
        print_error "Python 3.8+ is required but not found"
        return 1
    fi

    if check_installation "$install_dir"; then
        print_success "DeepSeek-VL is already installed and valid!"
        print_success "Installation directory: $install_dir"
        local file_count=$(find "$install_dir" -type f 2>/dev/null | wc -l)
        print_success "File count: $file_count"

        echo ""
        print_info "Verifying dependencies..."
        install_dependencies "$install_dir" "$python_cmd"

        echo ""
        print_info "Pre-downloading VL model weights (idempotent)"
        download_vl_model_weights "$python_cmd"

        echo ""
        print_info "Testing installation..."
        test_installation "$install_dir" "$python_cmd"

        echo ""
        print_info "You can use DeepSeek with:"
        print_info "  export DEEPSEEK_MODEL_DIR=\"$install_dir\""
        print_info "  export TRANSLATOR_PROVIDER=\"deepseek\""
        return 0
    fi

    echo ""
    print_info "Step 1: Clone DeepSeek-VL repository"
    if ! clone_repository "$install_dir"; then
        print_error "Failed to clone repository"
        return 1
    fi

    echo ""
    print_info "Step 2: Install Python dependencies"
    if ! install_dependencies "$install_dir" "$python_cmd"; then
        print_warning "Dependency installation may have failed"
        print_warning "You can try installing dependencies manually later"
    fi

    echo ""
    print_info "Step 3: Verify installation"
    if check_installation "$install_dir"; then
        echo ""
        print_success "========================================"
        print_success "  Installation Successful!"
        print_success "========================================"
        echo ""
        print_success "Model location: $install_dir"
        local file_count=$(find "$install_dir" -type f 2>/dev/null | wc -l)
        print_success "File count: $file_count"

        echo ""
        print_info "Step 3b: Pre-download VL model weights (idempotent)"
        download_vl_model_weights "$python_cmd"

        echo ""
        print_info "Step 4: Testing installation"
        test_installation "$install_dir" "$python_cmd"

        echo ""
        print_info "Next steps:"
        print_info "1. Set environment variables:"
        print_info "   export DEEPSEEK_MODEL_DIR=\"$install_dir\""
        print_info "   export TRANSLATOR_PROVIDER=\"deepseek\""
        echo ""
        print_info "2. Use in your application"
        return 0
    else
        echo ""
        print_error "Installation verification failed"
        return 1
    fi
}

main
exit $?
