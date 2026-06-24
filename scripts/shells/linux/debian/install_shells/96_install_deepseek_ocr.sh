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
[ -f "$PIPLOCK_LIB" ] && . "$PIPLOCK_LIB"
command -v vpip >/dev/null 2>&1 || vpip() { "$@"; }
# torch build guard (CPU vs CUDA wheels) - reused so we never force the ~4.3G
# nvidia-* CUDA stack onto a GPU-less desktop. Provides tcg_gpu_present etc.
source "$PARENT_DIR_LEVEL_2/common/torch_cpu_guard.sh"

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

    echo "[run] $python_cmd --version" >&2
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

    # Idempotency: if a git checkout already exists, update it in place instead of
    # cloning over a non-empty directory (which git refuses, leaving a partial install
    # that never converges). Fall back to a fresh clone only into an empty/absent dir.
    if [ -d "$target_dir/.git" ]; then
        print_info "Existing checkout found; updating in place (git fetch/reset)..."
        if git -C "$target_dir" remote set-url origin "$REPO_URL" 2>/dev/null \
            && git -C "$target_dir" fetch --depth 1 origin 2>/dev/null; then
            local default_branch
            default_branch=$(git -C "$target_dir" remote show origin 2>/dev/null \
                | sed -n 's/.*HEAD branch: //p' | head -n 1)
            [ -z "$default_branch" ] && default_branch="main"
            git -C "$target_dir" checkout "$default_branch" 2>/dev/null || true
            git -C "$target_dir" reset --hard "origin/$default_branch" 2>/dev/null || true
        else
            print_warning "Update fetch failed; keeping existing checkout as-is"
        fi

        local file_count=$(find "$target_dir" -type f 2>/dev/null | wc -l)
        print_success "Verification: $file_count files found"
        if [ "$file_count" -gt 10 ]; then
            print_success "Repository ready (updated existing checkout)"
            return 0
        fi
        print_error "Existing checkout looks incomplete"
        return 1
    fi

    if [ -d "$target_dir" ] && [ -n "$(ls -A "$target_dir" 2>/dev/null)" ]; then
        print_warning "Target directory exists and is non-empty but is not a git checkout"
        print_warning "Refusing to clone over it; remove it manually to reinstall: $target_dir"
        return 1
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

# Resolve the SHARED project virtualenv interpreter built by 13_ensure_python.sh
# at "$COMPILE_DIR/python3_venv" (exposed as $VENV_PYTHON3 by venv_python_common.sh).
# All install scripts must install INTO this single venv -- never a per-install
# fork or the externally-managed system python with --break-system-packages
# (PEP 668), which scatters packages to ~/.local / /usr/local on Debian/Kali.
# Echoes the venv python path on success; non-zero on failure.
get_venv_python() {
    local base_python=$2

    if [ -x "$VENV_PYTHON3" ]; then
        echo "$VENV_PYTHON3"
        return 0
    fi

    echo "[run] $base_python -c \"import venv\"" >&2
    if ! "$base_python" -c "import venv" >/dev/null 2>&1; then
        print_warning "python venv module not available" >&2
        print_warning "Install it with: $USE_SUDO apt-get install -y python3-venv" >&2
        return 1
    fi

    # The shared venv is normally created by 13_ensure_python.sh; only create it
    # here (with --system-site-packages) if that step has not run yet.
    print_info "Creating shared virtualenv: $VENV_DIR" >&2
    echo "[run] $base_python -m venv --system-site-packages $VENV_DIR" >&2
    if "$base_python" -m venv --system-site-packages "$VENV_DIR" >&2; then
        if [ -x "$VENV_PYTHON3" ]; then
            echo "[run] $VENV_PYTHON3 -m pip install --upgrade pip" >&2
            vpip "$VENV_PYTHON3" -m pip install --upgrade pip >/dev/null 2>&1 || true
            echo "$VENV_PYTHON3"
            return 0
        fi
    fi

    print_warning "Failed to create shared virtualenv" >&2
    return 1
}

# True only when flash-attn can actually build AND run on this host. The source build
# requires the system CUDA toolkit (nvcc) MAJOR version to equal torch's compiled CUDA
# major -- torch._check_cuda_version aborts the wheel build otherwise (e.g. nvcc 12.2
# vs torch cu130 -> "detected CUDA version mismatches the version used to compile
# PyTorch"). flash-attn is an OPTIONAL speedup (the model falls back to eager
# attention), so a mismatch/CPU-build is a SKIP, not a failure. This avoids the
# ~30-minute doomed source build that otherwise always fails on a mismatched stack.
flash_attn_cuda_compatible() {
    local py="$1" nvcc nvcc_major torch_cuda torch_major
    # Resolve nvcc the SAME way torch's build_ext does (CUDA_HOME first) so the gate
    # reflects the toolchain the build will actually use; fall back to PATH/usual path.
    if [ -n "${CUDA_HOME:-}" ] && [ -x "${CUDA_HOME}/bin/nvcc" ]; then
        nvcc="${CUDA_HOME}/bin/nvcc"
    else
        nvcc="$(command -v nvcc 2>/dev/null || echo "/usr/local/cuda/bin/nvcc")"
    fi
    nvcc_major="$("$nvcc" --version 2>/dev/null | grep -oE 'release [0-9]+' | grep -oE '[0-9]+' | head -1)"
    torch_cuda="$("$py" -c 'import torch; print(torch.version.cuda or "")' 2>/dev/null)"
    torch_major="${torch_cuda%%.*}"
    if [ -z "$nvcc_major" ]; then
        print_warning "  flash-attn: no usable nvcc (CUDA toolkit) found -> skipping build"
        return 1
    fi
    if [ -z "$torch_major" ]; then
        print_warning "  flash-attn: torch has no CUDA build (torch.version.cuda is None) -> skipping build"
        return 1
    fi
    if [ "$nvcc_major" != "$torch_major" ]; then
        print_warning "  flash-attn: CUDA major mismatch (nvcc ${nvcc_major}.x vs torch cu${torch_cuda}) -> skipping build"
        print_info "  Align them (install torch built for CUDA ${nvcc_major}.x, or a CUDA ${torch_major}.x toolkit), then re-run."
        return 1
    fi
    return 0
}

install_dependencies() {
    local install_dir=$1
    local python_cmd=$2

    print_info "Installing Python dependencies..."

    # Install INTO the shared venv ($VENV_PYTHON3) built by 13_ensure_python.sh.
    # No system-python fallback and no PEP 668 escape flags: the venv is not
    # externally managed, so --break-system-packages/--no-user are unnecessary
    # and would scatter packages outside the venv.
    local venv_python
    venv_python=$(get_venv_python "$install_dir" "$python_cmd")
    if [ -z "$venv_python" ] || [ ! -x "$venv_python" ]; then
        print_error "Shared virtualenv interpreter not available; cannot install dependencies"
        print_warning "Run 13_ensure_python.sh first to build $VENV_DIR"
        return 1
    fi
    print_info "Using shared virtualenv interpreter: $venv_python"
    DEEPSEEK_OCR_PYTHON="$venv_python"
    # vpip prefix serializes every "${pip_install[@]}" call (torch / requirements /
    # flash-attn) through the shared lock so the parallel LLM group can't corrupt the venv.
    local pip_install=(vpip "$venv_python" -m pip install)
    local run_python="$DEEPSEEK_OCR_PYTHON"

    cd "$install_dir" || return 1

    # GPU detection (shared torch guard). Only an NVIDIA CUDA host gets the CUDA
    # torch wheel + flash-attn source build; a generic desktop gets the CPU build,
    # which avoids ~4.3G of nvidia-* wheels and an impossible flash-attn compile.
    local has_gpu=false
    if tcg_gpu_present; then
        has_gpu=true
    fi

    # REUSE the torch provided by the prerequisite install (13_ensure_python.sh /
    # 13_cuda_nvidia_prereq.sh) when it is importable; never reinstall it (avoids
    # version churn and conflicts in the shared venv). Only install torch if absent.
    if "$run_python" -c "import torch" >/dev/null 2>&1; then
        if [ "$has_gpu" = true ] && ! "$run_python" -c "import torch; assert torch.cuda.is_available()" >/dev/null 2>&1; then
            # torch imports but its CUDA build cannot init on THIS driver (e.g. a too-new wheel
            # such as cu130 on a 12.4 driver). Reusing it makes DeepSeek-OCR silently fall back to
            # CPU AND leaves the worker re-triggering reinstalls, so uninstall the stale build (so
            # it stops shadowing) and reinstall the driver-matched wheel.
            _ocr_torch_idx="$(torch_cuda_index_url)"
            print_warning "Step 1: existing torch ($("$run_python" -c 'import torch; print(torch.__version__)' 2>/dev/null)) cannot use CUDA on this driver - reinstalling driver-matched build ($_ocr_torch_idx)..."
            echo ""
            vpip "$venv_python" -m pip uninstall -y torch torchvision torchaudio >/dev/null 2>&1 || true
            echo "[run] ${pip_install[*]} torch torchvision torchaudio --index-url $_ocr_torch_idx --force-reinstall"
            "${pip_install[@]}" torch torchvision torchaudio --index-url "$_ocr_torch_idx" --force-reinstall
            echo ""
        else
            print_success "Step 1: Reusing existing torch ($("$run_python" -c 'import torch; print(torch.__version__)' 2>/dev/null)); skipping torch install"
            echo ""
        fi
    elif [ "$has_gpu" = true ]; then
        # cu124 (CUDA 12.x major) rather than cu126: it runs on the common 12.x
        # drivers (cu126 needs a >=12.6 driver) and its major-12 matches a CUDA 12.x
        # toolkit, which is what flash-attn's source build requires.
        # Driver-matched CUDA wheel (single source of truth: base_libs/torch_cuda_index.sh,
        # provided here via torch_cpu_guard.sh). Yields cu124 on a 12.4 driver; cu126 needs
        # a >=12.6 driver. major-12 still matches a CUDA 12.x toolkit for flash-attn's build.
        _ocr_torch_idx="$(torch_cuda_index_url)"
        print_info "Step 1: torch not found - installing driver-matched CUDA PyTorch ($_ocr_torch_idx)..."
        echo ""
        echo "[run] ${pip_install[*]} torch torchvision torchaudio --index-url $_ocr_torch_idx"
        "${pip_install[@]}" torch torchvision torchaudio --index-url "$_ocr_torch_idx"
        echo ""
    else
        print_warning "Step 1: torch not found, no NVIDIA GPU - installing CPU PyTorch build..."
        print_info "DeepSeek-OCR's bundled run scripts expect a CUDA GPU; CPU torch is"
        print_info "installed so dependencies resolve, but the model run will need a GPU."
        echo ""
        echo "[run] ${pip_install[*]} torch torchvision torchaudio --index-url https://download.pytorch.org/whl/cpu"
        "${pip_install[@]}" torch torchvision torchaudio --index-url https://download.pytorch.org/whl/cpu
        echo ""
    fi

    print_info "Step 2: Installing core dependencies (official pinned set)..."
    echo ""
    # Official DeepSeek-OCR deps (repo requirements.txt + README). transformers and
    # tokenizers are PINNED because the model's trust_remote_code modeling file targets
    # those exact versions; addict + easydict are imported by that remote code, so
    # omitting them yields "ImportError: ... requires addict" at model load. Prefer the
    # repo's own requirements.txt (authoritative), then enforce the pins + runtime extras.
    local req_file="$install_dir/requirements.txt"
    if [ -f "$req_file" ]; then
        echo "[run] ${pip_install[*]} -r $req_file"
        "${pip_install[@]}" -r "$req_file"
    fi
    local core_deps=(
        "$LLM_TRANSFORMERS_SPEC" tokenizers==0.20.3
        addict easydict einops PyMuPDF img2pdf Pillow numpy
        accelerate timm sentencepiece protobuf
    )
    echo "[run] ${pip_install[*]} ${core_deps[*]}"
    "${pip_install[@]}" "${core_deps[@]}"
    echo ""

    if [ "$has_gpu" = true ] && flash_attn_cuda_compatible "$run_python"; then
        print_info "Step 3: Installing flash-attn==2.7.3 (CUDA source build)..."
        echo ""
        # ninja makes the CUDA build use the fast parallel backend; without it the
        # build falls back to the very slow distutils path (official flash-attn guidance).
        echo "[run] ${pip_install[*]} ninja"
        "${pip_install[@]}" ninja || print_warning "ninja install failed; flash-attn build will be slow"
        echo "[run] ${pip_install[*]} flash-attn==2.7.3 --no-build-isolation"
        if "${pip_install[@]}" flash-attn==2.7.3 --no-build-isolation; then
            print_success "flash-attn installed"
        else
            print_warning "flash-attn build failed -> continuing without it (model uses eager attention)"
        fi
        echo ""
    else
        print_warning "Step 3: Skipping flash-attn (optional CUDA speedup; needs a usable GPU + nvcc CUDA major == torch CUDA major)"
        print_info "The model still runs via eager attention. To add it later on a matching CUDA host:"
        print_info "  $run_python -m pip install flash-attn==2.7.3 --no-build-isolation"
        echo ""
    fi

    cd - > /dev/null

    # Verify installation
    print_info "Verifying installation..."
    echo "[run] $run_python -c \"import torch; print('[OK] torch version:', torch.__version__)\"" >&2
    local verify_result=$("$run_python" -c "import torch; print('[OK] torch version:', torch.__version__)" 2>&1)

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

    # Prefer the shared venv interpreter used by install_dependencies, if present.
    local run_python="${DEEPSEEK_OCR_PYTHON:-$python_cmd}"
    if [ -x "$VENV_PYTHON3" ]; then
        run_python="$VENV_PYTHON3"
    fi

    print_info "Testing model load (first run may download model)..."

    local test_script="$install_dir/test_model_load.py"
    cat > "$test_script" << 'PYTHON_EOF'
import os
os.environ.setdefault('HF_HOME', os.environ.get('CORE_NODE_CACHE_DIR', '/var/_core_node/cache') + '/huggingface')

print('[TEST] Loading DeepSeek-OCR model...')
from transformers import AutoModel, AutoTokenizer
import torch

model_name = 'deepseek-ai/DeepSeek-OCR'
print(f'[INFO] Model path: {model_name}')
print('[INFO] Note: First run will download model from HuggingFace')

# flash_attention_2 only works on a CUDA GPU; fall back to eager attention
# (and CPU) on a generic desktop so the load test does not hard-crash.
has_cuda = torch.cuda.is_available()
attn_impl = 'flash_attention_2' if has_cuda else 'eager'
print(f'[INFO] CUDA available: {has_cuda} -> attn_implementation={attn_impl}')

tokenizer = AutoTokenizer.from_pretrained(model_name, trust_remote_code=True)
print('[OK] Tokenizer loaded successfully')

print('[TEST] Loading model (this may take a while)...')
model = AutoModel.from_pretrained(
    model_name,
    _attn_implementation=attn_impl,
    trust_remote_code=True,
    use_safetensors=True
)
print('[OK] Model loaded successfully')

if has_cuda:
    print('[TEST] Moving model to GPU...')
    model = model.eval().cuda().to(torch.bfloat16)
    print('[OK] Model moved to GPU')
else:
    print('[WARN] No CUDA GPU detected - keeping model on CPU (eval only)')
    model = model.eval()

print('')
print('[SUCCESS] ========================================')
print('[SUCCESS]   DeepSeek-OCR is ready!')
print('[SUCCESS] ========================================')
PYTHON_EOF

    # Authenticate to the HF Hub from the project secret store so the model download
    # is not a rate-limited "unauthenticated" request (HF_TOKEN_1..5 then HF_TOKEN).
    local hf_token
    hf_token="$(get_secret_key_indexed_from_common_functions HF_TOKEN)"
    if [ -n "$hf_token" ]; then
        export HF_TOKEN="$hf_token"
        export HUGGING_FACE_HUB_TOKEN="$hf_token"
        print_info "HF Hub token loaded from .secret_keys/.secret_ignore"
    else
        print_warning "No HF_TOKEN in .secret_keys; HF Hub download will be unauthenticated"
    fi

    cd "$install_dir"
    echo ""
    echo "[run] $run_python $test_script"
    "$run_python" "$test_script"
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
    print_usage_instructions "$install_dir"

    return 0
}

# Print run instructions using the run-script directories that actually exist in
# the checkout (resolved at runtime, so the guidance can never point at a missing
# path). Falls back to the documented layout if nothing is found.
print_usage_instructions() {
    local install_dir=$1
    local run_python="${DEEPSEEK_OCR_PYTHON:-python}"
    [ -x "$VENV_PYTHON3" ] && run_python="$VENV_PYTHON3"

    local hf_dir vllm_dir
    hf_dir=$(dirname "$(find "$install_dir" -name run_dpsk_ocr.py 2>/dev/null | head -n 1)" 2>/dev/null)
    vllm_dir=$(dirname "$(find "$install_dir" -name run_dpsk_ocr_image.py 2>/dev/null | head -n 1)" 2>/dev/null)
    [ -z "$hf_dir" ] || [ "$hf_dir" = "." ] && hf_dir="$install_dir/DeepSeek-OCR-master/DeepSeek-OCR-hf"
    [ -z "$vllm_dir" ] || [ "$vllm_dir" = "." ] && vllm_dir="$install_dir/DeepSeek-OCR-master/DeepSeek-OCR-vllm"

    print_info "To use DeepSeek-OCR (Transformers/HF), run:"
    print_info "  cd $hf_dir"
    print_info "  $run_python run_dpsk_ocr.py"
    echo ""
    print_info "Or use vLLM for better performance:"
    print_info "  cd $vllm_dir"
    print_info "  $run_python run_dpsk_ocr_image.py"
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
        print_usage_instructions "$install_dir"
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
        print_usage_instructions "$install_dir"
        return 0
    else
        echo ""
        print_error "Installation verification failed"
        return 1
    fi
}

main
exit $?
