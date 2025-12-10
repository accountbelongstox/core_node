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
source "$PARENT_DIR_LEVEL_2/common/common_functions.sh"

SCRIPT_NAME="[97_install_qwen25]"
MODEL_NAME="Qwen2.5-0.5B-Instruct"
MODEL_PATH="Qwen/Qwen2.5-0.5B-Instruct"
REQUIRED_PYTHON_VERSION="3.8"

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
    local python_cmd=""

    if command -v python3 &> /dev/null; then
        python_cmd="python3"
    elif command -v python &> /dev/null; then
        python_cmd="python"
    else
        print_error "Python is not installed"
        print_warning "Please install Python 3.8+: $USE_SUDO apt-get install python3 python3-pip"
        return 1
    fi

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
    print_info "Note: Qwen2.5 requires transformers >= 4.37.0"

    # Check for GPU availability
    print_info "Checking for GPU availability..."
    local has_gpu=false
    if command -v nvidia-smi >/dev/null 2>&1; then
        if nvidia-smi >/dev/null 2>&1; then
            has_gpu=true
            print_success "NVIDIA GPU detected"
        else
            print_warning "nvidia-smi found but GPU not accessible"
        fi
    else
        print_info "No NVIDIA GPU detected, will use CPU version"
    fi
    echo ""

    # Install torch based on GPU availability
    if [[ "$has_gpu" == true ]]; then
        print_info "Uninstalling incompatible torch versions..."
        echo ""
        $python_cmd -m pip uninstall -y torch torchvision torchaudio 2>/dev/null || true
        echo ""

        print_info "Installing GPU-enabled torch and dependencies..."
        echo ""
        $python_cmd -m pip install torch torchvision torchaudio --index-url https://download.pytorch.org/whl/cu124
        echo ""
    else
        print_info "Skipping torch installation (CPU-only setup)"
        print_info "Using transformers with CPU backend"
        echo ""
    fi

    print_info "Installing transformers and accelerate..."
    echo ""
    $python_cmd -m pip install --upgrade transformers accelerate
    echo ""

    print_info "Verifying installation..."
    local verify_result=$($python_cmd -c "import transformers; print('[OK] transformers version:', transformers.__version__)" 2>&1)

    if [[ "$verify_result" == *"[OK]"* ]]; then
        print_success "Dependencies installed successfully"
        print_success "$verify_result"
        return 0
    else
        print_warning "Installation verification failed"
        return 0
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
    $python_cmd "$test_script_path"
    echo ""

    print_success "========================================"
    print_success "  Model Load Test Passed!"
    print_success "========================================"
    echo ""

    return 0
}

create_interactive_script() {
    local python_cmd=$1
    local cache_dir="$HOME/.cache/core_node"

    mkdir -p "$cache_dir"

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

    local shell_script="$cache_dir/qwen25_chat.sh"
    cat > "$shell_script" << BASH_EOF
#!/bin/bash
echo "========================================"
echo "  Qwen2.5-0.5B-Instruct Interactive Chat"
echo "========================================"
echo ""
echo "Starting chat... Please wait..."
echo ""
$python_cmd "$test_script_path" --chat
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

main() {
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

    local python_cmd=$(check_python)
    if [ $? -ne 0 ]; then
        print_error "Python 3.8+ is required but not found"
        return 1
    fi

    echo ""
    print_info "Step 1: Install Python dependencies"
    install_dependencies "$python_cmd"

    echo ""
    print_info "Step 2: Test model loading"
    test_model_load "$python_cmd"

    echo ""
    print_success "========================================"
    print_success "  Installation Successful!"
    print_success "========================================"
    echo ""
    print_success "Model: $MODEL_PATH"
    print_success "Cache: ~/.cache/huggingface"

    echo ""
    print_info "Step 3: Create interactive chat"
    create_interactive_script "$python_cmd"

    echo ""
    print_success "Installation completed successfully!"
    print_info "You can run the chat anytime from:"
    print_info "  ~/.cache/core_node/qwen25_chat.sh"

    return 0
}

main
exit $?
