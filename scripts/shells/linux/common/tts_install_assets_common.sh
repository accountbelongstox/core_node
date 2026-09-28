#!/bin/bash
# Resolve pycore/tts_install_assets from install_shells (5 levels below repo root).

TTS_ISOLATED_VENV_READY=0
TTS_NATIVE_BUILD_READY=0
TTS_SOX_READY=0
TTS_HF_REPO_READY=0
NEURAL_TTS_WEIGHTS_READY=0
NEURAL_TTS_LAST_REPORTED_MODEL_PATH=""
HF_AUTH_TOKEN_RESOLVED=0
HF_AUTH_TOKEN_CACHE=""
HF_AUTH_TOKEN_SOURCE=""
HF_CURL_REDIRECT_FLAG="-L"
HF_CURL_AUTH_ARGS=()

_core_node_repo_root_from_tts_common() {
    (cd "$(dirname "${BASH_SOURCE[0]}")/../../../.." && pwd)
}

pycore_repo_root_from_install_shells() {
    local script_dir="$1"
    (cd "$script_dir/../../../../.." && pwd)
}

pycore_tts_install_assets_dir() {
    local script_dir="$1"
    local repo_root
    repo_root="$(pycore_repo_root_from_install_shells "$script_dir")"
    echo "$repo_root/pycore/tts_install_assets"
}

tts_model_tier() {
    local py="$1"
    local script_dir="$2"
    local key="$3"
    local gpu_flag="$4"
    local assets_dir tier_script
    assets_dir="$(pycore_tts_install_assets_dir "$script_dir")"
    tier_script="$assets_dir/tts_model_tiers.py"
    "$py" "$tier_script" resolve "$key" "$gpu_flag" 2>/dev/null
}

tts_official_env_line() {
    local py="$1"
    local script_dir="$2"
    local engine="$3"
    local assets_dir tier_script
    assets_dir="$(pycore_tts_install_assets_dir "$script_dir")"
    tier_script="$assets_dir/tts_model_tiers.py"
    "$py" "$tier_script" official-env "$engine" 2>/dev/null
}

tts_idempotent_msg() {
    local py="$1"
    local script_dir="$2"
    local reason="$3"
    local assets_dir tier_script
    assets_dir="$(pycore_tts_install_assets_dir "$script_dir")"
    tier_script="$assets_dir/tts_model_tiers.py"
    "$py" "$tier_script" idempotent "$reason" 2>/dev/null
}

tts_runtime_policy_run() {
    local py="$1"
    shift
    local repo_root
    repo_root="$(_core_node_repo_root_from_tts_common)"
    (cd "$repo_root" && PYCORE_SKIP_DEP_CHECK=1 "$py" -m pycore.pyutils.common.python_env.runtime_policy "$@")
}

tts_engine_cpu_supported() {
    # CPU-inference support per the canonical engine policy (runtime_policy.py).
    # Fails closed: unknown engines keep skipping on headless GPU-less hosts.
    local py="$1" engine="$2"
    local output=""
    output="$(tts_runtime_policy_run "$py" cpu-supported "$engine" 2>/dev/null)" || return 1
    [[ "$output" == *true* ]]
}

tts_ensure_engine_base_runtime() {
    local py="$1" engine="$2"
    local repo_root runtime_version override_name installer
    repo_root="$(_core_node_repo_root_from_tts_common)"
    override_name="${engine^^}_PYTHON"
    [[ -n "${!override_name:-}" ]] && return 0
    runtime_version="$(PYCORE_SKIP_DEP_CHECK=1 PYCORE_ISOLATED_ROOT="$repo_root" PYCORE_ISOLATED_ENGINE="$engine" "$py" -c 'import os, sys
sys.path.insert(0, os.environ["PYCORE_ISOLATED_ROOT"])
from pycore.pyutils.common.python_env.runtime_policy import engine_spec, engine_isolation_mode, resolve_engine_base_python, ISOLATION_MODE_SELF_CONTAINED
engine = os.environ["PYCORE_ISOLATED_ENGINE"]
sys.stdout.write(str(engine_spec(engine).get("python_recommended", "")) if engine_isolation_mode(engine) == ISOLATION_MODE_SELF_CONTAINED and not resolve_engine_base_python(engine).get("found") else "")')"
    if [[ "$runtime_version" == "3.10" || "$runtime_version" == "3.12" ]]; then
        installer="$repo_root/scripts/shells/linux/debian/install_shells/14_install_python310.sh"
        bash "$installer" --runtime "${runtime_version//./}" >&2
    fi
}

tts_engine_compatible() {
    local py="$1" engine="$2" prefix="${3:-}"
    local python_version result override_name override_python
    python_version="$("$py" -c 'import sys; print(f"{sys.version_info.major}.{sys.version_info.minor}")' 2>/dev/null)"
    if ! result="$(tts_runtime_policy_run "$py" compatibility "$engine" --python-version "$python_version")"; then
        echo "$prefix[SKIP] $engine runtime policy failed." >&2
        return 1
    fi
    if printf '%s' "$result" | grep -q '"compatible": true'; then
        return 0
    fi
    # Isolated engines are gated by their resolved BASE interpreter (engine
    # override, else the registered dedicated Python runtime), never by the host
    # interpreter version.
    if printf '%s' "$result" | grep -q '"isolated": true'; then
        if result="$(tts_runtime_policy_run "$py" base-compatibility "$engine")" \
            && printf '%s' "$result" | grep -q '"compatible": true'; then
            return 0
        fi
    fi
    echo "${prefix}[SKIP] $engine is incompatible with Python $python_version; install its recommended dedicated Python runtime or configure ${engine^^}_PYTHON with a supported interpreter." >&2
    return 1
}

tts_dependency_fingerprint() {
    local py="$1" engine="$2"
    tts_runtime_policy_run "$py" fingerprint "$engine"
}

tts_dependency_stamp_matches() {
    local py="$1" engine="$2" stamp="$3"
    local expected actual
    [[ -f "$stamp" ]] || return 1
    expected="$(tts_dependency_fingerprint "$py" "$engine")"
    actual="$(tr -d '\r\n\ufeff' < "$stamp" 2>/dev/null || true)"
    [[ -n "$expected" && "$actual" == "$expected" ]]
}

tts_engine_health_ok() {
    local py="$1" engine="$2" output
    output="$(tts_runtime_policy_run "$py" health-probe "$engine")"
    [[ "$output" == *"__HEALTH_READY__"* ]]
}

tts_dependencies_ready() {
    local py="$1" engine="$2" stamp="$3"
    tts_dependency_stamp_matches "$py" "$engine" "$stamp"
}

tts_write_dependency_stamp() {
    local py="$1" engine="$2" stamp="$3"
    local expected
    expected="$(tts_dependency_fingerprint "$py" "$engine")"
    [[ -n "$expected" ]] || return 1
    mkdir -p "$(dirname "$stamp")"
    printf '%s\n' "$expected" > "$stamp"
}

tts_ensure_native_build_runtime() {
    local py="$1" engine="$2"
    local repo_root policy_output line base_python base_info base_version include_dir binary
    local missing_packages=()
    TTS_NATIVE_BUILD_READY=0
    repo_root="$(_core_node_repo_root_from_tts_common)"
    base_python=""
    policy_output="$(PYCORE_SKIP_DEP_CHECK=1 PYCORE_ISOLATED_ROOT="$repo_root" PYCORE_ISOLATED_ENGINE="$engine" "$py" -c 'import os, sys
sys.path.insert(0, os.environ["PYCORE_ISOLATED_ROOT"])
from pycore.pyutils.common.python_env.runtime_policy import engine_spec, resolve_engine_base_python
engine = os.environ["PYCORE_ISOLATED_ENGINE"]
if engine_spec(engine).get("linux_native_build", False):
    print("__TTS_BUILD_BASE__" + str(resolve_engine_base_python(engine).get("path") or ""))
else:
    print("__TTS_BUILD_SKIP__")')"
    while IFS= read -r line; do
        case "$line" in
            __TTS_BUILD_SKIP__) TTS_NATIVE_BUILD_READY=1; return ;;
            __TTS_BUILD_BASE__*) base_python="${line#__TTS_BUILD_BASE__}" ;;
        esac
    done <<< "$policy_output"
    if [[ -z "$base_python" || ! -x "$base_python" ]]; then
        echo "[isolated-venv] Native build pending for $engine: dedicated base interpreter or install policy unavailable." >&2
        return
    fi
    base_info="$("$base_python" -c 'import sys, sysconfig; print("%d.%d|%s" % (sys.version_info.major, sys.version_info.minor, sysconfig.get_path("include")))')"
    base_version="${base_info%%|*}"
    include_dir="${base_info#*|}"
    if [[ "$base_info" != *'|'* || -z "$include_dir" ]]; then
        echo "[isolated-venv] Native build pending for $engine: could not resolve Python development headers from $base_python." >&2
        return
    fi
    for binary in gcc g++ make; do
        if [[ ! -x "$(command -v "$binary" || true)" ]]; then
            missing_packages+=(build-essential)
            break
        fi
    done
    [[ -x "$(command -v pkg-config || true)" ]] || missing_packages+=(pkg-config)
    [[ -f "$include_dir/Python.h" ]] || missing_packages+=("python${base_version}-dev")
    if [[ "${#missing_packages[@]}" -gt 0 ]]; then
        if [[ ! -x "$(command -v apt-get || true)" ]]; then
            echo "[isolated-venv] Native build pending for $engine: install ${missing_packages[*]}; apt-get is unavailable." >&2
            return
        fi
        echo "[isolated-venv] Installing missing native build prerequisites: ${missing_packages[*]}"
        if ! $USE_SUDO apt-get update || ! $USE_SUDO env DEBIAN_FRONTEND=noninteractive apt-get install -y --no-install-recommends "${missing_packages[@]}"; then
            echo "[isolated-venv] Native build prerequisite installation failed for $engine; existing venv and models are retained." >&2
            return
        fi
    fi
    for binary in gcc g++ make pkg-config; do
        if [[ ! -x "$(command -v "$binary" || true)" ]]; then
            echo "[isolated-venv] Native build pending for $engine: $binary is unavailable." >&2
            return
        fi
    done
    if [[ ! -f "$include_dir/Python.h" ]]; then
        echo "[isolated-venv] Native build pending for $engine: restore the matching Python.h under $include_dir for $base_python." >&2
        return
    fi
    TTS_NATIVE_BUILD_READY=1
}

tts_provision_isolated_venv() {
    local py="$1" engine="$2" force="${3:-0}"
    shift 3 2>/dev/null || shift $#
    local repo_root force_value result_file provision_state packages_env
    TTS_ISOLATED_VENV_READY=0
    tts_ensure_engine_base_runtime "$py" "$engine"
    tts_ensure_native_build_runtime "$py" "$engine"
    [[ "$TTS_NATIVE_BUILD_READY" == "1" ]] || return 0
    repo_root="$(_core_node_repo_root_from_tts_common)"
    force_value="0"
    [[ "$force" == "1" ]] && force_value="1"
    packages_env=""
    if [[ "$#" -gt 0 ]]; then
        packages_env="$(printf '%s\n' "$@")"
    fi
    result_file="$(mktemp)"
    PYCORE_SKIP_DEP_CHECK=1 PYCORE_ISOLATED_ROOT="$repo_root" \
    PYCORE_ISOLATED_ENGINE="$engine" \
    PYCORE_ISOLATED_FORCE="$force_value" \
    PYCORE_ISOLATED_PACKAGES="$packages_env" \
    PYCORE_ISOLATED_RESULT_FILE="$result_file" \
    "$py" -c 'import os, sys
from pathlib import Path
sys.path.insert(0, os.environ["PYCORE_ISOLATED_ROOT"])
from pycore.pyutils.common.python_env import isolated_venv
packages_raw = os.environ.get("PYCORE_ISOLATED_PACKAGES", "")
pip_packages = [item for item in packages_raw.split("\n") if item] or None
result = isolated_venv.ensure_venv(
    os.environ["PYCORE_ISOLATED_ENGINE"],
    pip_packages=pip_packages,
    force=os.environ.get("PYCORE_ISOLATED_FORCE") == "1",
)
Path(os.environ["PYCORE_ISOLATED_RESULT_FILE"]).write_text(
    "ready" if result else "not-ready",
    encoding="ascii",
)'
    provision_state="$(tr -d '\r\n' < "$result_file" 2>/dev/null || true)"
    rm -f -- "$result_file"
    [[ "$provision_state" == "ready" ]] && TTS_ISOLATED_VENV_READY=1
    :
}

tts_resolve_isolated_python() {
    local py="$1" engine="$2"
    local repo_root
    repo_root="$(_core_node_repo_root_from_tts_common)"
    PYCORE_SKIP_DEP_CHECK=1 PYCORE_ISOLATED_ROOT="$repo_root" PYCORE_ISOLATED_ENGINE="$engine" \
    "$py" -c 'import os, sys
sys.path.insert(0, os.environ["PYCORE_ISOLATED_ROOT"])
from pycore.pyutils.common.python_env import isolated_venv
print(isolated_venv.resolve_python(os.environ["PYCORE_ISOLATED_ENGINE"]) or "")' 2>/dev/null
}

tts_probe_isolated_venv_provisioned() {
    local py="$1" engine="$2"
    local repo_root probe_output line
    repo_root="$(_core_node_repo_root_from_tts_common)"
    TTS_ISOLATED_VENV_READY=0
    probe_output="$(PYCORE_SKIP_DEP_CHECK=1 PYCORE_ISOLATED_ROOT="$repo_root" PYCORE_ISOLATED_ENGINE="$engine" "$py" -c 'import os, sys
sys.path.insert(0, os.environ["PYCORE_ISOLATED_ROOT"])
from pycore.pyutils.common.python_env import isolated_venv
print("__VENV_READY__" if isolated_venv.venv_provisioned(os.environ["PYCORE_ISOLATED_ENGINE"]) else "__VENV_NOT_READY__")')"
    while IFS= read -r line; do
        [[ "$line" == '__VENV_READY__' || "$line" == '__VENV_NOT_READY__' ]] || echo "[isolated-venv] postcondition probe: $line" >&2
    done <<< "$probe_output"
    [[ "$probe_output" == *"__VENV_READY__"* ]] && TTS_ISOLATED_VENV_READY=1
    :
}

_tts_assets_common_dir="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
# shellcheck source=torch_cuda_install.sh
. "$_tts_assets_common_dir/torch_cuda_install.sh"

ensure_sox_on_path() {
    local prefix="${1:-}"
    TTS_SOX_READY=0
    if command -v sox >/dev/null 2>&1; then
        echo "${prefix}[idempotent] SoX on PATH: $(command -v sox)"
        TTS_SOX_READY=1
        return 0
    fi
    if command -v apt-get >/dev/null 2>&1; then
        local sudo_cmd=""
        if [ "$(id -u)" -ne 0 ] && command -v sudo >/dev/null 2>&1; then
            sudo_cmd="sudo"
        fi
        echo "${prefix}[..] apt: sox (pysox/qwen-tts runtime binary) ..."
        $sudo_cmd apt-get install -y sox >/dev/null 2>&1 || true
    fi
    if command -v sox >/dev/null 2>&1; then
        echo "${prefix}[OK] SoX on PATH: $(command -v sox)"
        TTS_SOX_READY=1
        return 0
    fi
    echo "${prefix}[!] SoX NOT on PATH - pysox (qwen-tts tokenizer) warns at import. Install: apt install sox" >&2
    return 1
}

prereq_install_probe() {
    local py="$1"
    local prefix="$2"
    shift 2 || true
    local absent_ok=0
    local absent_note=""
    local failed=0
    local mod probe_output args=()
    if [[ "${1:-}" == "--absent-ok" ]]; then
        absent_ok=1
        absent_note="${2:-}"
        shift 2
    fi
    args=("$@")
    if [[ "${#args[@]}" -gt 0 ]]; then
        echo "${prefix}[idempotent-probe] running post-install verification ..."
    fi
    if [[ -z "$py" ]] || ! command -v "$py" >/dev/null 2>&1; then
        if [[ "$absent_ok" -eq 1 ]]; then
            echo "${prefix}[idempotent-probe] SKIP interpreter (${absent_note:-explicitly skipped})"
            return 0
        fi
        echo "${prefix}[idempotent-probe] FAIL Python interpreter is unavailable" >&2
        return 1
    fi
    for mod in "${args[@]}"; do
        probe_output="$("$py" -c "import importlib.util; print('__IMPORT_OK__' if importlib.util.find_spec('$mod') else '__IMPORT_MISSING__')" 2>/dev/null)"
        if [[ "$probe_output" == *"__IMPORT_OK__"* ]]; then
            echo "${prefix}[idempotent-probe] OK  import $mod"
        elif [[ "$absent_ok" -eq 1 ]]; then
            if [[ -n "$absent_note" ]]; then
                echo "${prefix}[idempotent-probe] SKIP import $mod ($absent_note)"
            else
                echo "${prefix}[idempotent-probe] SKIP import $mod"
            fi
        else
            echo "${prefix}[idempotent-probe] FAIL import $mod" >&2
            failed=1
        fi
    done
    return "$failed"
}

complete_prereq_step() {
    local py="$1"
    local prefix="$2"
    shift 2 || true
    if prereq_install_probe "$py" "$prefix" "$@"; then
        exit 0
    fi
    exit 1
}

fail_prereq_step() {
    local py="$1"
    local prefix="$2"
    shift 2 || true
    prereq_install_probe "$py" "$prefix" "$@" || true
    exit 1
}

_hf_mirror_base() {
    if [[ -n "${HF_ENDPOINT:-}" ]]; then printf '%s' "${HF_ENDPOINT%/}"; return 0; fi
    if [[ -n "${GPTSOVITS_MIRROR:-}" ]]; then printf '%s' "${GPTSOVITS_MIRROR%/}"; return 0; fi
    printf '%s' "https://hf-mirror.com"
}

_hf_trim() {
    local s="$1"
    s="${s#"${s%%[![:space:]]*}"}"
    s="${s%"${s##*[![:space:]]}"}"
    printf '%s' "$s"
}

_hf_secret_raw_dir() {
    # Raw secret store under the core_node root; same convention as
    # pyfoundations.secret_manager and scripts/pytools/aitools/hf_secret.py.
    local root raw_dir
    root="$(_core_node_repo_root_from_tts_common)"
    raw_dir="$root/.secret_keys/.secret_ignore"
    [[ -d "$raw_dir" ]] && printf '%s' "$raw_dir"
}

_hf_read_secret_first_line() {
    # First non-empty stripped line of a raw secret file (BOM-aware); fails on error.
    local path="$1" content="" line=""
    [[ -f "$path" ]] || return 1
    content="$(cat "$path" 2>/dev/null)" || return 1
    content="${content#$'\xef\xbb\xbf'}"
    while IFS= read -r line; do
        line="${line%$'\r'}"
        line="$(_hf_trim "$line")"
        if [[ -n "$line" ]]; then
            printf '%s' "$line"
            return 0
        fi
    done <<< "$content"
    return 1
}

_hf_token_candidates() {
    # Ordered "source<TAB>token" list: env first (explicit operator choice), then
    # EVERY .secret_keys/.secret_ignore/HF_TOKEN_<index> (auto-discovered in
    # numeric order, not capped at 5), then the bare HF_TOKEN file. Duplicates
    # are removed, order preserved.
    local token="" raw_dir="" f="" name=""
    local -A seen=()
    local -a indexed=()
    token="$(_hf_trim "${HF_TOKEN:-}")"
    if [[ -n "$token" ]]; then
        seen[$token]=1
        printf 'env:HF_TOKEN\t%s\n' "$token"
    fi
    token="$(_hf_trim "${HUGGING_FACE_HUB_TOKEN:-}")"
    if [[ -n "$token" && -z "${seen[$token]:-}" ]]; then
        seen[$token]=1
        printf 'env:HUGGING_FACE_HUB_TOKEN\t%s\n' "$token"
    fi
    raw_dir="$(_hf_secret_raw_dir)"
    if [[ -n "$raw_dir" ]]; then
        for f in "$raw_dir"/HF_TOKEN_*; do
            [[ -f "$f" ]] || continue
            name="$(basename "$f")"
            [[ "$name" =~ ^HF_TOKEN_[0-9]+$ ]] || continue
            indexed+=("$f")
        done
        if [[ "${#indexed[@]}" -gt 0 ]]; then
            while IFS= read -r name; do
                f="$raw_dir/$name"
                token="$(_hf_trim "$(_hf_read_secret_first_line "$f" 2>/dev/null || true)")"
                if [[ -n "$token" && -z "${seen[$token]:-}" ]]; then
                    seen[$token]=1
                    printf '%s\t%s\n' "$name" "$token"
                fi
            done < <(printf '%s\n' "${indexed[@]##*/}" | sort -t_ -k2,2n)
        fi
        if [[ -f "$raw_dir/HF_TOKEN" ]]; then
            token="$(_hf_trim "$(_hf_read_secret_first_line "$raw_dir/HF_TOKEN" 2>/dev/null || true)")"
            if [[ -n "$token" && -z "${seen[$token]:-}" ]]; then
                seen[$token]=1
                printf 'HF_TOKEN\t%s\n' "$token"
            fi
        fi
    fi
}

_hf_token_whoami() {
    # 'ok' = valid (HTTP 200); 'rejected' = 401/403; 'unverifiable' = network/tooling.
    local token="$1" code=""
    if ! command -v curl >/dev/null 2>&1; then
        printf 'unverifiable'
        return 0
    fi
    code="$(curl -s -o /dev/null -w '%{http_code}' --connect-timeout 15 --header "Authorization: Bearer $token" 'https://huggingface.co/api/whoami-v2' 2>/dev/null)" || code=""
    case "$code" in
        200) printf 'ok' ;;
        401|403) printf 'rejected' ;;
        *) printf 'unverifiable' ;;
    esac
}

resolve_hf_auth_token() {
    # First usable hf_* token wins; rejected ones fall through to the next
    # candidate. Result is cached per process and the pick is printed (masked)
    # once. A resolved token is exported to HF_TOKEN so child processes (pip,
    # huggingface_hub, fish-speech, the urllib catalog walker) inherit the auth.
    # The token is returned on stdout; diagnostics go to stderr.
    local line="" source="" token="" suffix="" probe=""
    if [[ "$HF_AUTH_TOKEN_RESOLVED" == "1" ]]; then
        printf '%s' "$HF_AUTH_TOKEN_CACHE"
        return 0
    fi
    HF_AUTH_TOKEN_RESOLVED=1
    HF_AUTH_TOKEN_CACHE=""
    while IFS=$'\t' read -r source token; do
        [[ -n "$token" ]] || continue
        suffix="${token: -4}"
        if [[ "$token" != hf_* ]]; then
            echo "[hf] $source (...$suffix) is not an hf_* token; skipped" >&2
            continue
        fi
        probe="$(_hf_token_whoami "$token")"
        if [[ "$probe" == "ok" ]]; then
            HF_AUTH_TOKEN_CACHE="$token"
            HF_AUTH_TOKEN_SOURCE="$source"
            echo "[hf] HF auth: using $source (...$suffix); whoami OK" >&2
            break
        fi
        if [[ "$probe" == "rejected" ]]; then
            echo "[hf] $source (...$suffix) rejected by Hugging Face (401/403); trying next candidate" >&2
            continue
        fi
        HF_AUTH_TOKEN_CACHE="$token"
        HF_AUTH_TOKEN_SOURCE="$source"
        echo "[hf] whoami unverifiable (network); using $source (...$suffix) unvalidated" >&2
        break
    done < <(_hf_token_candidates)
    if [[ -z "$HF_AUTH_TOKEN_CACHE" ]]; then
        echo "[hf] no usable HF token (env + .secret_keys HF_TOKEN_*); Hub downloads stay anonymous" >&2
    else
        export HF_TOKEN="$HF_AUTH_TOKEN_CACHE"
    fi
    printf '%s' "$HF_AUTH_TOKEN_CACHE"
}

_hf_repo_existence() {
    # exists | missing | unknown. A 404 from the repo API is the only
    # 'missing' verdict; network errors and auth failures return 'unknown' so
    # a transient outage never clears an operator's explicit override.
    local repo="$1" base code mirror saw_missing=0
    command -v curl >/dev/null 2>&1 || { printf 'unknown'; return 0; }
    resolve_hf_auth_token >/dev/null
    _hf_curl_auth_setup
    local bases=("https://huggingface.co")
    mirror="$(_hf_mirror_base)"
    [[ -n "$mirror" && "$mirror" != "${bases[0]}" ]] && bases+=("$mirror")
    for base in "${bases[@]}"; do
        code="$(curl -s -o /dev/null -w '%{http_code}' "$HF_CURL_REDIRECT_FLAG" --connect-timeout 15 "${HF_CURL_AUTH_ARGS[@]}" "${base%/}/api/models/${repo}" 2>/dev/null)" || continue
        case "$code" in
            200) printf 'exists'; return 0 ;;
            404) saw_missing=1 ;;
        esac
    done
    [[ "$saw_missing" -eq 1 ]] && { printf 'missing'; return 0; }
    printf 'unknown'
}

_hf_curl_auth_setup() {
    # Populates HF_CURL_AUTH_ARGS / HF_CURL_REDIRECT_FLAG from the resolved token.
    # Plain -L drops Authorization on the cross-host 308 to huggingface.co
    # (hf-mirror repo APIs), producing 401 on gated repos; --location-trusted
    # implies -L and forwards the header to the redirect target.
    HF_CURL_AUTH_ARGS=()
    HF_CURL_REDIRECT_FLAG="-L"
    if [[ -n "$HF_AUTH_TOKEN_CACHE" ]]; then
        HF_CURL_AUTH_ARGS=(--header "Authorization: Bearer $HF_AUTH_TOKEN_CACHE")
        HF_CURL_REDIRECT_FLAG="--location-trusted"
    fi
}

_hf_glob_match() {
    local name="$1" pat="$2"
    [[ "$pat" == "*" ]] && return 0
    case "$name" in $pat) return 0 ;; esac
    return 1
}

_hf_allow_match() {
    # HF allow-list contract shared by the downloader and the readiness verifiers:
    # an empty pattern list matches everything, otherwise any glob hit qualifies.
    local name="$1" pat=""
    shift || true
    [[ "$#" -eq 0 ]] && return 0
    for pat in "$@"; do
        pat="$(echo "$pat" | xargs)"
        if _hf_glob_match "$name" "$pat"; then return 0; fi
    done
    return 1
}

_hf_repo_catalog() {
    local repo="$1" mirror
    mirror="$(_hf_mirror_base)"
    python3 -c 'import json,os,sys,urllib.request

repo=sys.argv[1]
bases=[sys.argv[2], sys.argv[3]]
token=os.environ.get("HF_TOKEN") or os.environ.get("HUGGING_FACE_HUB_TOKEN") or ""

class HfRedirectHandler(urllib.request.HTTPRedirectHandler):
    # urllib follows 301/302/303/307 natively; hf-mirror.com answers the tree
    # API with 308 Permanent Redirect, which older Pythons (e.g. the dedicated
    # 3.10 runtime) do not follow. redirect_request carries request headers to
    # the target, so the Authorization header survives the mirror 308.
    def http_error_308(self, req, fp, code, msg, headers):
        return self.http_error_307(req, fp, code, msg, headers)

opener=urllib.request.build_opener(HfRedirectHandler())

def fetch_tree(base, subpath=""):
    path=f"/api/models/{repo}/tree/main"
    if subpath:
        path += f"/{subpath}"
    url=base.rstrip("/") + path
    req=urllib.request.Request(url)
    if token:
        req.add_header("Authorization", f"Bearer {token}")
    with opener.open(req, timeout=30) as resp:
        return json.load(resp)

def walk(base):
    out={}
    pending=[""]
    while pending:
        sub=pending.pop()
        try:
            entries=fetch_tree(base, sub)
        except Exception:
            continue
        for entry in entries:
            name=entry.get("path") or ""
            if not name:
                continue
            # The HF tree API always returns repo-root-relative paths, also for
            # subdirectory queries - never re-prefix them with the subpath.
            if entry.get("type") == "directory":
                pending.append(name)
                continue
            size=int(entry.get("size") or 0)
            lfs=entry.get("lfs") or {}
            if size <= 0 and lfs:
                size=int(lfs.get("size") or 0)
            out[name]=size
    return out

selected={}
for base in bases:
    if not base:
        continue
    catalog=walk(base)
    if catalog:
        selected=catalog
        break
for name,size in sorted(selected.items()):
    print(f"{name}\t{size}")' "$repo" "https://huggingface.co" "$mirror"
}

_hf_catalog_size() {
    local repo="$1" name="$2"
    local row sz
    while IFS=$'\t' read -r row sz; do
        [[ "$row" == "$name" ]] || continue
        printf '%s' "${sz:-0}"
        return 0
    done < <(_hf_repo_catalog "$repo" || true)
    printf '0'
}

_hf_list_repo_files() {
    local repo="$1" row sz
    while IFS=$'\t' read -r row sz; do
        [[ -n "$row" ]] && printf '%s\n' "$row"
    done < <(_hf_repo_catalog "$repo" || true)
}

_hf_file_complete() {
    local path="$1" expected="${2:-0}"
    [[ -f "$path" ]] || return 1
    if [[ "$expected" -gt 0 ]]; then
        local have
        have="$(wc -c < "$path" 2>/dev/null | tr -d ' ')"
        [[ "${have:-0}" -ge "$expected" ]]
        return
    fi
    [[ -s "$path" ]]
}

_backup_install_asset_path() {
    local path="$1" prefix="${2:-}"
    local parent leaf stamp backup suffix target
    [[ -e "$path" ]] || return 0
    parent="$(dirname "$path")"
    leaf="$(basename "$path")"
    stamp="$(date +%Y%m%d_%H%M%S)"
    backup="${parent}/.backup_${stamp}"
    suffix=0
    while [[ -e "$backup" ]]; do
        suffix=$((suffix + 1))
        backup="${parent}/.backup_${stamp}_${suffix}"
    done
    mkdir -p "$backup"
    target="${backup}/${leaf}"
    mv -f "$path" "$target"
    echo "${prefix}[backup] moved ${path} -> ${target}"
}

_hf_download_file() {
    local repo="$1" name="$2" out="$3" mirror="$4" prefix="$5" catalog_bytes="${6:-0}"
    local url parent expected have py="${7:-python3}"
    mirror="${mirror:-$(_hf_mirror_base)}"
    _hf_curl_auth_setup
    parent="$(dirname "$out")"
    mkdir -p "$parent"
    url="${mirror%/}/${repo}/resolve/main/${name}"
    expected="$catalog_bytes"
    if [[ -s "$out" && "${expected:-0}" -le 0 ]]; then
        have="$(wc -c < "$out" 2>/dev/null | tr -d ' ')"
        echo "${prefix}[idempotent] local file found: ${out} (${have:-0} bytes); remote lookup skipped"
        return 0
    fi
    if [[ "${expected:-0}" -le 0 ]]; then
        expected="$(curl -fsI "$HF_CURL_REDIRECT_FLAG" --connect-timeout 30 "${HF_CURL_AUTH_ARGS[@]}" "$url" 2>/dev/null | awk 'tolower($1)=="content-length:" {print $2}' | tr -d '\r' | tail -n1)"
    fi
    if [[ -f "$out" && "${expected:-0}" -gt 0 ]]; then
        have="$(wc -c < "$out" 2>/dev/null | tr -d ' ')"
        if [[ "${have:-0}" -gt 0 && "${have:-0}" -lt "${expected:-0}" ]]; then
            echo "${prefix}[resume] continuing incomplete ${name} (${have} / ${expected} bytes)"
        fi
    fi
    if _hf_file_complete "$out" "${expected:-0}"; then
        echo "${prefix}[idempotent] skipping: ${name}"
        return 0
    fi
    if ! command -v curl >/dev/null 2>&1; then
        echo "${prefix}[!] curl missing; cannot download ${name}" >&2
        return 1
    fi
    # --retry-all-errors covers connection drops (curl 56) that plain --retry
    # skips; --speed-limit aborts stalled transfers so the retry kicks in.
    # curl -s is silent, so a multi-GB transfer looks frozen in no-TTY installer
    # logs; run curl in the background and poll the output size for live progress.
    curl -fsS "$HF_CURL_REDIRECT_FLAG" -C - --retry 5 --retry-delay 2 --retry-all-errors \
        --connect-timeout 30 --speed-time 30 --speed-limit 1024 \
        "${HF_CURL_AUTH_ARGS[@]}" -o "$out" "$url" &
    local curl_pid=$!
    local last_reported=-1
    while kill -0 "$curl_pid" 2>/dev/null; do
        sleep 10
        have=0
        [[ -f "$out" ]] && have="$(wc -c < "$out" 2>/dev/null | tr -d ' ')"
        have="${have:-0}"
        [[ "$have" == "$last_reported" ]] && continue
        last_reported="$have"
        if [[ "${expected:-0}" -gt 0 ]]; then
            echo "${prefix}[download] ${name}: $((have / 1048576)) / $((expected / 1048576)) MB"
        else
            echo "${prefix}[download] ${name}: $((have / 1048576)) MB"
        fi
    done
    wait "$curl_pid" || return 1
    if ! _hf_file_complete "$out" "${expected:-0}"; then
        return 1
    fi
    return 0
}

# Read a model sentinel written by EITHER OS and print the bare value: strips
# a leading UTF-8 BOM (Windows PowerShell `Set-Content -Encoding utf8` emits
# BOM + CRLF) and the trailing CR/LF. `tr -d` cannot do this: GNU tr has no
# \u escape, so `tr -d '\r\n\ufeff'` silently deletes the LETTERS u/f/e from
# the model id instead of the BOM bytes.
_hf_read_sentinel() {
    local path="$1"
    [[ -f "$path" ]] || return 1
    sed -e '1s/^\xef\xbb\xbf//' -e 's/\r$//' "$path" 2>/dev/null | head -n1
}

# Resolve the newest local HF hub snapshot dir for a repo ('' + rc 1 when absent):
# $HF_HUB_CACHE/models--<org>--<name>/snapshots/<rev>. The hub cache is shared
# with Windows (D:\www\cache\huggingface\hub == /www/www/cache/huggingface/hub),
# so a repo fetched by EITHER OS (transformers runtime, hf CLI, or the other
# side's installer) is found here.
_hf_hub_repo_snapshot_dir() {
    local repo="$1" hub_root="" repo_dir="" snap=""
    hub_root="${HF_HUB_CACHE:-${HUGGINGFACE_HUB_CACHE:-${HF_HOME:+$HF_HOME/hub}}}"
    [[ -n "$hub_root" ]] || return 1
    repo_dir="${hub_root%/}/models--${repo//\//--}"
    [[ -d "$repo_dir/snapshots" ]] || return 1
    snap="$(ls -1t "$repo_dir/snapshots" 2>/dev/null | head -n1)"
    [[ -n "$snap" && -d "$repo_dir/snapshots/$snap" ]] || return 1
    printf '%s\n' "$repo_dir/snapshots/$snap"
    return 0
}

# Reuse a repo already present in the HF HUB cache by MATERIALIZING the
# allow-listed files into the flat dest: plain copies dereferencing the hub's
# blob symlinks (cp -L), never new symlinks -- a cache shared across operating
# systems must stay plain files (official HF_HUB_DISABLE_SYMLINKS guidance:
# symlinks created on one OS are not always traversable on the other). Files
# already present at the dest are kept (resume semantics). Returns 0 only when
# the dest afterwards satisfies the OFFLINE readiness contract (config.json +
# at least one nonzero allow-listed weight file); the caller then writes the
# sentinel. On any gap it returns 1 and the caller falls through to the normal
# resumable download, which also completes the partially materialized tree.
_hf_flat_materialize_from_hub() {
    local repo="$1" dest="$2" allow_raw="$3" prefix="$4" py="${5:-python3}"
    local snap_dir="" src="" rel="" copied=0
    local -a allow=()
    IFS=',' read -r -a allow <<< "$allow_raw"
    snap_dir="$(_hf_hub_repo_snapshot_dir "$repo")" || return 1
    [[ -f "$snap_dir/config.json" ]] || return 1
    while IFS= read -r -d '' src; do
        rel="${src#"$snap_dir"/}"
        _hf_allow_match "$rel" "${allow[@]}" || continue
        # Resume semantics: skip only a byte-complete copy; a partial file
        # (e.g. an interrupted earlier materialize) is re-copied in full.
        if [[ -f "${dest%/}/$rel" ]]; then
            local dst_size="" src_size=""
            dst_size="$(wc -c < "${dest%/}/$rel" 2>/dev/null | tr -d ' ')"
            src_size="$(wc -c < "$src" 2>/dev/null | tr -d ' ')"
            [[ "${src_size:-0}" -gt 0 && "${dst_size:-0}" == "${src_size:-0}" ]] && continue
        fi
        mkdir -p "${dest%/}/$(dirname "$rel")" 2>/dev/null || true
        cp -L "$src" "${dest%/}/$rel" 2>/dev/null || return 1
        copied=$((copied + 1))
    done < <(find "$snap_dir" \( -type f -o -type l \) -print0 2>/dev/null)
    if neural_tts_local_weights_ready "$dest" "" "$py" "" "$allow_raw"; then
        echo "${prefix}[reuse] materialized ${copied} file(s) from shared HF hub cache: $snap_dir (no download)"
        return 0
    fi
    return 1
}

install_hf_repo_flat() {
    local repo="$1" dest="$2" sentinel="$3" prefix="$4"
    shift 4 || true
    local allow_raw="${1:-*}" mirror="${2:-$(_hf_mirror_base)}" sentinel_value="${3:-$repo}" py="${4:-python3}" reconcile="${5:-0}"
    local -a allow=()
    TTS_HF_REPO_READY=0
    local name all_ok=1 count=0 total=0 catalog_bytes=0 local_bytes=0
    IFS=',' read -r -a allow <<< "$allow_raw"
    mkdir -p "$dest"
    if [[ "$reconcile" -ne 1 && -f "$sentinel" ]] && neural_tts_local_weights_ready "$dest" "$repo" "$py" "" "$allow_raw"; then
        local_bytes="$(find "$dest" -type f \( -name '*.safetensors' -o -name '*.bin' -o -name '*.pt' \) -printf '%s\n' 2>/dev/null | awk '{sum += $1} END {print sum + 0}')"
        printf '%s\n' "$sentinel_value" > "$sentinel"
        echo "${prefix}[idempotent] local model found: ${dest} (${local_bytes} bytes); remote lookup skipped"
        TTS_HF_REPO_READY=1
        return 0
    fi
    # Cross-layout reuse (Windows <-> Linux dual-boot, transformers runtime):
    # the SAME repo may already sit in the shared HF HUB cache even though this
    # flat dest/sentinel was never populated (e.g. the other OS fetched it via
    # the hub layout only -- observed: nllb200/qwen25 flat weights empty while
    # models--facebook--nllb-200-distilled-600M / models--Qwen--Qwen2.5-0.5B-
    # Instruct sit complete in the hub). Materialize from the hub snapshot --
    # same-disk copy, no network -- before any remote lookup.
    if _hf_flat_materialize_from_hub "$repo" "$dest" "$allow_raw" "$prefix" "$py"; then
        printf '%s\n' "$sentinel_value" > "$sentinel"
        TTS_HF_REPO_READY=1
        return 0
    fi
    resolve_hf_auth_token >/dev/null
    mapfile -t names < <(_hf_list_repo_files "$repo" || true)
    total="${#names[@]}"
    if [[ "$total" -eq 0 ]]; then
        echo "${prefix}[!] could not list repo files for ${repo}" >&2
        return 1
    fi
    local -a wanted=()
    for name in "${names[@]}"; do
        [[ -z "$name" ]] && continue
        local matched=0 pat
        for pat in "${allow[@]}"; do
            pat="$(echo "$pat" | xargs)"
            if _hf_glob_match "$name" "$pat"; then matched=1; break; fi
        done
        [[ "$matched" -eq 1 ]] || continue
        count=$((count + 1))
        wanted+=("$name")
    done
    echo "${prefix}[..] ${count} of ${total} files matched allow-list (mirror ${mirror})"

    # Gated-repo preflight: e.g. fishaudio checkpoints are gated ("gated":"auto"),
    # so anonymous downloads 401 on EVERY file. Detect once with a HEAD probe and
    # say exactly what to do instead of failing each file with a bare curl error.
    _hf_curl_auth_setup
    if [[ "${#wanted[@]}" -gt 0 ]] && command -v curl >/dev/null 2>&1; then
        local probe_url probe_code
        probe_url="${mirror%/}/${repo}/resolve/main/${wanted[0]}"
        probe_code="$(curl -s -o /dev/null -w '%{http_code}' -I "$HF_CURL_REDIRECT_FLAG" --connect-timeout 15 "${HF_CURL_AUTH_ARGS[@]}" "$probe_url" 2>/dev/null || true)"
        if [[ "$probe_code" == "401" || "$probe_code" == "403" ]]; then
            if [[ -n "$HF_AUTH_TOKEN_CACHE" ]]; then
                echo "${prefix}[!] ${repo} is gated and the configured HF token (${HF_AUTH_TOKEN_SOURCE}) has no access (HTTP ${probe_code}); accept the license at https://huggingface.co/${repo} with that account." >&2
            else
                echo "${prefix}[!] ${repo} is a gated repo (HTTP ${probe_code}); accept the license at https://huggingface.co/${repo}, then add an hf_* token as .secret_keys/.secret_ignore/HF_TOKEN_<index> and re-run." >&2
            fi
            return 1
        fi
    fi

    for name in "${wanted[@]}"; do
        catalog_bytes="$(_hf_catalog_size "$repo" "$name")"
        if ! _hf_download_file "$repo" "$name" "${dest%/}/${name}" "$mirror" "$prefix" "$catalog_bytes" "$py"; then
            all_ok=0
        fi
    done
    if [[ "$all_ok" -eq 1 && "$count" -gt 0 ]]; then
        printf '%s\n' "$sentinel_value" > "$sentinel"
        TTS_HF_REPO_READY=1
        return 0
    fi
    rm -f "$sentinel"
    return 1
}

neural_tts_local_weights_ready() {
    # Readiness == the installer's download contract: only allow-listed files are
    # verified. Foreign weight files under the weights dir (legacy layouts, other
    # engines) are ignored; when the HF catalog is reachable, every allow-listed
    # catalog weight file must also be present locally at full size.
    local dir="$1" repo="${2:-}" py="${3:-python3}" required_manifest="${4:-}" allow_raw="${5:-*}"
    local catalog="" expected=0 f="" file_size=0 rel="" total_bytes=0 weight_count=0
    local required_path="" entry="" entry_size=0 entry_path=""
    local -a allow=()
    NEURAL_TTS_WEIGHTS_READY=0
    IFS=',' read -r -a allow <<< "$allow_raw"
    [[ -d "$dir" ]] || return 1
    find "$dir" -type f -name 'config.json' 2>/dev/null | grep -q . || return 1
    if [[ -n "$repo" ]]; then
        resolve_hf_auth_token >/dev/null
        catalog="$(_hf_repo_catalog "$repo" 2>/dev/null | tr -d '\r' || true)"
    fi
    if [[ -n "$required_manifest" ]]; then
        while IFS= read -r required_path; do
            required_path="${required_path%$'\r'}"
            [[ -n "$required_path" && "$required_path" != \#* ]] || continue
            [[ -s "${dir%/}/$required_path" ]] || return 1
        done < "$required_manifest"
    fi
    if [[ -n "$catalog" ]]; then
        while IFS=$'\t' read -r entry entry_size; do
            [[ -n "$entry" ]] || continue
            case "$entry" in
                *.safetensors|*.bin|*.pt|*.pth) ;;
                *) continue ;;
            esac
            _hf_allow_match "$entry" "${allow[@]}" || continue
            entry_path="${dir%/}/$entry"
            [[ -f "$entry_path" ]] || return 1
            file_size="$(wc -c < "$entry_path" 2>/dev/null | tr -d ' ')"
            [[ "${file_size:-0}" -gt 0 ]] || return 1
            [[ "${entry_size:-0}" -le 0 || "${file_size:-0}" -ge "${entry_size:-0}" ]] || return 1
        done <<< "$catalog"
    fi
    while IFS= read -r -d '' f; do
        rel="${f#"${dir%/}/"}"
        _hf_allow_match "$rel" "${allow[@]}" || continue
        weight_count=$((weight_count + 1))
        [[ -s "$f" ]] || return 1
        file_size="$(wc -c < "$f" 2>/dev/null | tr -d ' ')"
        expected="$(printf '%s\n' "$catalog" | awk -F '\t' -v key="$rel" '$1 == key { print $2; exit }')"
        expected="${expected:-0}"
        [[ "$expected" -le 0 || "${file_size:-0}" -ge "$expected" ]] || return 1
        total_bytes=$((total_bytes + ${file_size:-0}))
    done < <(find "$dir" -type f \( -name '*.safetensors' -o -name '*.bin' -o -name '*.pt' -o -name '*.pth' \) -print0 2>/dev/null)
    if [[ "$weight_count" -gt 0 ]]; then
        if [[ "$NEURAL_TTS_LAST_REPORTED_MODEL_PATH" != "$dir" ]]; then
            echo "[model-cache] local model found: $dir (${total_bytes} bytes)"
            NEURAL_TTS_LAST_REPORTED_MODEL_PATH="$dir"
        fi
        NEURAL_TTS_WEIGHTS_READY=1
        return 0
    fi
    return 1
}

_whisper_model_url() {
    case "$1" in
        tiny) echo 'https://openaipublic.azureedge.net/main/whisper/models/65147644a51805b8a4949454ea3baf911679d133517d4a5ebc44089d984332b/tiny.pt' ;;
        tiny.en) echo 'https://openaipublic.azureedge.net/main/whisper/models/65147644a51805b8a4949454ea3baf911679d133517d4a5ebc44089d984332b/tiny.en.pt' ;;
        base) echo 'https://openaipublic.azureedge.net/main/whisper/models/139c1045a4878f4603a1285e1630e4931b2ae6f634be1141045b1f1797c7435/base.pt' ;;
        base.en) echo 'https://openaipublic.azureedge.net/main/whisper/models/25a8656b74f98eb9848ed2ceccc261d8628bba9ed516e8a86ac9738c6f1765c/base.en.pt' ;;
        small) echo 'https://openaipublic.azureedge.net/main/whisper/models/9ecf779972d90ba49c06d968637d720dd632c55bbf88496611daf2114e9031bf/small.pt' ;;
        small.en) echo 'https://openaipublic.azureedge.net/main/whisper/models/9ecf779972d90ba49c06d968637d720dd632c55bbf88496611daf2114e9031bf/small.en.pt' ;;
        medium) echo 'https://openaipublic.azureedge.net/main/whisper/models/345ae4da62f9b3d59415adc60127b97c714f32e89e936602e85993674d08dcb1/medium.pt' ;;
        medium.en) echo 'https://openaipublic.azureedge.net/main/whisper/models/d7440d1dc186f76616474e89803ba5a0c5763e2bcf4f8d3a0ea7741dde9c265/medium.en.pt' ;;
        large-v2) echo 'https://openaipublic.azureedge.net/main/whisper/models/81f7c96c852ee8fc532187b61f875ceec1a1baeda7af2a7ab0e9a6395ad8a89d/large-v2.pt' ;;
        large-v3|large) echo 'https://openaipublic.azureedge.net/main/whisper/models/e5b1a8937a99fd112907ae80315fedda765a69cfd366fb9bce46bada3b0d6010/large-v3.pt' ;;
        *) return 1 ;;
    esac
}

install_whisper_model_weights() {
    local model="$1" cache_dir="$2" prefix="$3" py="${4:-}"
    local url out expected local_bytes
    # The installed whisper package is the single source of truth for model
    # URLs (OpenAI rotates the hash segment); the shell table is a fallback.
    url=""
    if [[ -n "$py" ]] && command -v "$py" >/dev/null 2>&1; then
        url="$("$py" -c "import whisper; print(whisper._MODELS.get('$model', ''))" 2>/dev/null | tr -d '\r\n' || true)"
    fi
    if [[ -z "$url" ]]; then
        url="$(_whisper_model_url "$model")" || {
            echo "${prefix}[!] unknown whisper model '${model}'" >&2
            return 1
        }
    fi
    mkdir -p "$cache_dir"
    out="${cache_dir%/}/${model}.pt"
    if [[ -s "$out" ]]; then
        local_bytes="$(wc -c < "$out" 2>/dev/null | tr -d ' ')"
        echo "${prefix}[idempotent] local whisper model found: ${out} (${local_bytes:-0} bytes); remote lookup skipped"
        return 0
    fi
    expected="$(curl -fsI --connect-timeout 30 "$url" 2>/dev/null | awk 'tolower($1)=="content-length:" {print $2}' | tr -d '\r' | tail -n1)"
    if _hf_file_complete "$out" "${expected:-0}"; then
        echo "${prefix}[idempotent] skipping: whisper ${model} already cached"
        return 0
    fi
    if ! command -v curl >/dev/null 2>&1; then
        echo "${prefix}[!] curl missing; cannot download whisper ${model}" >&2
        return 1
    fi
    echo "${prefix}[..] downloading whisper '${model}' -> ${out}"
    curl -fsSL -C - --retry 5 --retry-delay 2 --retry-all-errors \
        --connect-timeout 30 --speed-time 30 --speed-limit 1024 -o "$out" "$url"
    _hf_file_complete "$out" "${expected:-0}"
}
