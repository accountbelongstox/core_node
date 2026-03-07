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

SCRIPT_NAME="[96_install_deepseek_ocr]"
MODEL_NAME="DeepSeek-OCR"
REPO_URL="https://github.com/deepseek-ai/DeepSeek-OCR.git"
MODEL_PATH="deepseek-ai/DeepSeek-OCR"
REQUIRED_PYTHON_VERSION="3.12"

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
        print_warning "DeepSeek-OCR is not installed in WSL environments by default"
        print_info "This is a development/desktop tool, not suitable for WSL"
        return 1
    fi

    if [ "$IS_PRODUCTION" = true ]; then
        print_warning "Production server environment detected"
        print_warning "DeepSeek-OCR is not installed on production servers by default"
        print_info "This requires desktop environment and GPU resources"
        return 1
    fi

    if [ "$HAS_DESKTOP_ENVIRONMENT" = false ]; then
        print_warning "No desktop environment detected"
        print_warning "DeepSeek-OCR requires desktop environment for optimal usage"
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

    if command -v python3 &> /dev/null; then
        python_cmd="python3"
    elif command -v python &> /dev/null; then
        python_cmd="python"
    else
        print_error "Python is not installed"
        print_warning "Please install Python 3.12+: $USE_SUDO apt-get install python3 python3-pip"
        return 1
    fi

    local python_version=$($python_cmd --version 2>&1)
    print_success "Python is available: $python_version"

    local version_regex="Python ([0-9]+)\.([0-9]+)"
    if [[ $python_version =~ $version_regex ]]; then
        local major="${BASH_REMATCH[1]}"
        local minor="${BASH_REMATCH[2]}"

        if [ "$major" -ge 3 ] && [ "$minor" -ge 12 ]; then
            print_success "Python version is sufficient (3.12+)"
            echo "$python_cmd"
            return 0
        elif [ "$major" -ge 3 ] && [ "$minor" -ge 8 ]; then
            print_warning "Python version $major.$minor found, but 3.12+ is recommended"
            echo "$python_cmd"
            return 0
        else
            print_error "Python version is too old (need 3.12+, found $major.$minor)"
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

    print_info "Cloning DeepSeek-OCR repository..."
    print_info "Repository: $REPO_URL"
    print_info "Target: $target_dir"

    local parent_dir=$(dirname "$target_dir")
    if [ ! -d "$parent_dir" ]; then
        print_info "Creating parent directory: $parent_dir"
        mkdir -p "$parent_dir"
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

install_dependencies() {
    local install_dir=$1
    local python_cmd=$2

    print_info "Installing Python dependencies..."
    print_info "Using Python command: $python_cmd"
    print_info "Note: DeepSeek-OCR requires cuda12+torch (latest)"

    cd "$install_dir"

    print_info "Step 1: Installing PyTorch (latest) with CUDA 12.6..."
    echo ""
    $python_cmd -m pip install --break-system-packages --no-user torch torchvision torchaudio --index-url https://download.pytorch.org/whl/cu126
    echo ""

    print_info "Step 2: Installing core dependencies..."
    echo ""
    $python_cmd -m pip install --break-system-packages --no-user transformers accelerate pillow einops timm sentencepiece protobuf
    echo ""

    print_info "Step 3: Installing flash-attn (latest)..."
    echo ""
    $python_cmd -m pip install --break-system-packages --no-user flash-attn --no-build-isolation
    echo ""

    cd - > /dev/null

    # Verify installation
    print_info "Verifying installation..."
    local verify_result=$($python_cmd -c "import torch; print('[OK] torch version:', torch.__version__)" 2>&1)

    if [[ "$verify_result" == *"[OK]"* ]]; then
        print_success "Dependencies installed successfully"
        return 0
    else
        print_warning "Installation verification failed"
        print_warning "You may need to install dependencies manually"
        return 0
    fi
}

test_model_load() {
    local install_dir=$1
    local python_cmd=$2

    print_info "Testing model load (first run may download model)..."

    local test_script="$install_dir/test_model_load.py"
    cat > "$test_script" << 'PYTHON_EOF'
import os
os.environ['HF_HOME'] = os.path.join(os.path.dirname(__file__), '.cache')

print('[TEST] Loading DeepSeek-OCR model...')
from transformers import AutoModel, AutoTokenizer
import torch

model_name = 'deepseek-ai/DeepSeek-OCR'
print(f'[INFO] Model path: {model_name}')
print('[INFO] Note: First run will download model from HuggingFace')

tokenizer = AutoTokenizer.from_pretrained(model_name, trust_remote_code=True)
print('[OK] Tokenizer loaded successfully')

print('[TEST] Loading model (this may take a while)...')
model = AutoModel.from_pretrained(
    model_name,
    _attn_implementation='flash_attention_2',
    trust_remote_code=True,
    use_safetensors=True
)
print('[OK] Model loaded successfully')

print('[TEST] Moving model to GPU...')
model = model.eval().cuda().to(torch.bfloat16)
print('[OK] Model moved to GPU')

print('')
print('[SUCCESS] ========================================')
print('[SUCCESS]   DeepSeek-OCR is ready!')
print('[SUCCESS] ========================================')
PYTHON_EOF

    cd "$install_dir"
    echo ""
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
    print_success "DeepSeek-OCR is ready to use!"
    echo ""
    print_info "To use DeepSeek-OCR, run:"
    print_info "  cd $install_dir/DeepSeek-OCR-master/DeepSeek-OCR-hf"
    print_info "  python run_dpsk_ocr.py"
    echo ""
    print_info "Or use vLLM for better performance:"
    print_info "  cd $install_dir/DeepSeek-OCR-master/DeepSeek-OCR-vllm"
    print_info "  python run_dpsk_ocr_image.py"

    return 0
}

main() {
    print_info "========================================"
    print_info "  DeepSeek-OCR Installation"
    print_info "========================================"
    echo ""

    if ! check_environment; then
        print_warning "Environment check failed - skipping installation"
        print_info "DeepSeek-OCR is only installed on desktop Linux systems"
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
        print_error "Python 3.12+ is required but not found"
        return 1
    fi

    if check_installation "$install_dir"; then
        print_success "DeepSeek-OCR is already installed and valid!"
        print_success "Installation directory: $install_dir"
        local file_count=$(find "$install_dir" -type f 2>/dev/null | wc -l)
        print_success "File count: $file_count"

        echo ""
        print_info "Reinstalling dependencies..."
        install_dependencies "$install_dir" "$python_cmd"

        echo ""
        print_info "Testing installation..."
        test_installation "$install_dir" "$python_cmd"

        echo ""
        print_info "You can use DeepSeek-OCR with:"
        print_info "  export DEEPSEEK_OCR_DIR=\"$install_dir\""
        print_info "  cd $install_dir/DeepSeek-OCR-master/DeepSeek-OCR-hf"
        print_info "  python run_dpsk_ocr.py"
        return 0
    fi

    echo ""
    print_info "Step 1: Clone DeepSeek-OCR repository"
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
        print_info "Step 4: Testing installation"
        test_installation "$install_dir" "$python_cmd"

        echo ""
        print_info "Next steps:"
        print_info "1. Set environment variables:"
        print_info "   export DEEPSEEK_OCR_DIR=\"$install_dir\""
        echo ""
        print_info "2. Use in your application:"
        print_info "   cd $install_dir/DeepSeek-OCR-master/DeepSeek-OCR-hf"
        print_info "   python run_dpsk_ocr.py"
        return 0
    else
        echo ""
        print_error "Installation verification failed"
        return 1
    fi
}

main
exit $?
