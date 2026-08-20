#!/bin/bash
# Resolve pycore/tts_install_assets from install_shells (5 levels below repo root).

TTS_ISOLATED_VENV_READY=0
NEURAL_TTS_LAST_REPORTED_MODEL_PATH=""

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
    (cd "$repo_root" && "$py" -m pycore.pyutils.common.python_env.runtime_policy "$@")
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
    override_name="${engine^^}_PYTHON"
    override_python="${!override_name:-}"
    if [[ -n "$override_python" && -x "$override_python" ]]; then
        python_version="$("$override_python" -c 'import sys; print(f"{sys.version_info.major}.{sys.version_info.minor}")' 2>/dev/null)"
        if ! result="$(tts_runtime_policy_run "$py" compatibility "$engine" --python-version "$python_version")"; then
            echo "$prefix[SKIP] $engine runtime policy failed for override interpreter." >&2
            return 1
        fi
        if printf '%s' "$result" | grep -q '"compatible": true'; then
            return 0
        fi
    fi
    echo "${prefix}[SKIP] $engine is incompatible with Python $python_version; configure ${engine^^}_PYTHON with a supported interpreter." >&2
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

tts_provision_isolated_venv() {
    local py="$1" engine="$2" force="${3:-0}"
    local repo_root force_value probe_output
    repo_root="$(_core_node_repo_root_from_tts_common)"
    force_value="0"
    [[ "$force" == "1" ]] && force_value="1"
    TTS_ISOLATED_VENV_READY=0
    PYCORE_ISOLATED_ROOT="$repo_root" \
    PYCORE_ISOLATED_ENGINE="$engine" \
    PYCORE_ISOLATED_FORCE="$force_value" \
    "$py" -c 'import os, sys
sys.path.insert(0, os.environ["PYCORE_ISOLATED_ROOT"])
from pycore.pyutils.common.python_env import isolated_venv
isolated_venv.ensure_venv(
    os.environ["PYCORE_ISOLATED_ENGINE"],
    force=os.environ.get("PYCORE_ISOLATED_FORCE") == "1",
)'
    probe_output="$(PYCORE_ISOLATED_ROOT="$repo_root" PYCORE_ISOLATED_ENGINE="$engine" "$py" -c 'import os, sys
sys.path.insert(0, os.environ["PYCORE_ISOLATED_ROOT"])
from pycore.pyutils.common.python_env import isolated_venv
print("__VENV_READY__" if isolated_venv.venv_ready(os.environ["PYCORE_ISOLATED_ENGINE"]) else "__VENV_NOT_READY__")' 2>/dev/null)"
    [[ "$probe_output" == *"__VENV_READY__"* ]] && TTS_ISOLATED_VENV_READY=1
    :
}

tts_resolve_isolated_python() {
    local py="$1" engine="$2"
    local repo_root
    repo_root="$(_core_node_repo_root_from_tts_common)"
    PYCORE_ISOLATED_ROOT="$repo_root" PYCORE_ISOLATED_ENGINE="$engine" \
    "$py" -c 'import os, sys
sys.path.insert(0, os.environ["PYCORE_ISOLATED_ROOT"])
from pycore.pyutils.common.python_env import isolated_venv
print(isolated_venv.resolve_python(os.environ["PYCORE_ISOLATED_ENGINE"]) or "")' 2>/dev/null
}

tts_probe_isolated_venv_provisioned() {
    local py="$1" engine="$2"
    local repo_root probe_output
    repo_root="$(_core_node_repo_root_from_tts_common)"
    TTS_ISOLATED_VENV_READY=0
    probe_output="$(PYCORE_ISOLATED_ROOT="$repo_root" PYCORE_ISOLATED_ENGINE="$engine" "$py" -c 'import os, sys
sys.path.insert(0, os.environ["PYCORE_ISOLATED_ROOT"])
from pycore.pyutils.common.python_env import isolated_venv
print("__VENV_READY__" if isolated_venv.venv_ready(os.environ["PYCORE_ISOLATED_ENGINE"]) else "__VENV_NOT_READY__")' 2>/dev/null)"
    [[ "$probe_output" == *"__VENV_READY__"* ]] && TTS_ISOLATED_VENV_READY=1
    :
}

_tts_assets_common_dir="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
# shellcheck source=torch_cuda_install.sh
. "$_tts_assets_common_dir/torch_cuda_install.sh"

ensure_sox_on_path() {
    local prefix="${1:-}"
    if command -v sox >/dev/null 2>&1; then
        echo "${prefix}[idempotent] SoX on PATH: $(command -v sox)"
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
    python3 -c 'import json,sys,urllib.request

repo=sys.argv[1]
bases=[sys.argv[2], sys.argv[3]]

def fetch_tree(base, subpath=""):
    path=f"/api/models/{repo}/tree/main"
    if subpath:
        path += f"/{subpath}"
    url=base.rstrip("/") + path
    with urllib.request.urlopen(url, timeout=30) as resp:
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
        expected="$(curl -fsI --connect-timeout 30 "$url" 2>/dev/null | awk 'tolower($1)=="content-length:" {print $2}' | tr -d '\r' | tail -n1)"
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
    curl -fsSL -C - --retry 3 --connect-timeout 30 -o "$out" "$url" || return 1
    if ! _hf_file_complete "$out" "${expected:-0}"; then
        return 1
    fi
    return 0
}

install_hf_repo_flat() {
    local repo="$1" dest="$2" sentinel="$3" prefix="$4"
    shift 4 || true
    local allow_raw="${1:-*}" mirror="${2:-$(_hf_mirror_base)}" sentinel_value="${3:-$repo}" py="${4:-python3}" reconcile="${5:-0}"
    local -a allow=()
    local name all_ok=1 count=0 total=0 catalog_bytes=0 local_bytes=0
    IFS=',' read -r -a allow <<< "$allow_raw"
    mkdir -p "$dest"
    if [[ "$reconcile" -ne 1 && -f "$sentinel" ]] && neural_tts_local_weights_ready "$dest" "$repo" "$py" "" "$allow_raw"; then
        local_bytes="$(find "$dest" -type f \( -name '*.safetensors' -o -name '*.bin' -o -name '*.pt' \) -printf '%s\n' 2>/dev/null | awk '{sum += $1} END {print sum + 0}')"
        printf '%s\n' "$sentinel_value" > "$sentinel"
        echo "${prefix}[idempotent] local model found: ${dest} (${local_bytes} bytes); remote lookup skipped"
        return 0
    fi
    mapfile -t names < <(_hf_list_repo_files "$repo" || true)
    total="${#names[@]}"
    if [[ "$total" -eq 0 ]]; then
        echo "${prefix}[!] could not list repo files for ${repo}" >&2
        return 1
    fi
    for name in "${names[@]}"; do
        [[ -z "$name" ]] && continue
        local matched=0 pat
        for pat in "${allow[@]}"; do
            pat="$(echo "$pat" | xargs)"
            if _hf_glob_match "$name" "$pat"; then matched=1; break; fi
        done
        [[ "$matched" -eq 1 ]] || continue
        count=$((count + 1))
        catalog_bytes="$(_hf_catalog_size "$repo" "$name")"
        if ! _hf_download_file "$repo" "$name" "${dest%/}/${name}" "$mirror" "$prefix" "$catalog_bytes" "$py"; then
            all_ok=0
        fi
    done
    echo "${prefix}[..] ${count} of ${total} files matched allow-list (mirror ${mirror})"
    if [[ "$all_ok" -eq 1 && "$count" -gt 0 ]]; then
        printf '%s\n' "$sentinel_value" > "$sentinel"
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
    IFS=',' read -r -a allow <<< "$allow_raw"
    [[ -d "$dir" ]] || return 1
    find "$dir" -type f -name 'config.json' 2>/dev/null | grep -q . || return 1
    if [[ -n "$repo" ]]; then
        catalog="$(_hf_repo_catalog "$repo" 2>/dev/null | tr -d '\r' || true)"
    fi
    if [[ -n "$required_manifest" ]]; then
        while IFS= read -r required_path; do
            [[ -n "$required_path" && "$required_path" != \#* ]] || continue
            [[ -s "${dir%/}/$required_path" ]] || return 1
        done < "$required_manifest"
    fi
    if [[ -n "$catalog" ]]; then
        while IFS=$'\t' read -r entry entry_size; do
            [[ -n "$entry" ]] || continue
            case "$entry" in
                *.safetensors|*.bin|*.pt) ;;
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
    done < <(find "$dir" -type f \( -name '*.safetensors' -o -name '*.bin' -o -name '*.pt' \) -print0 2>/dev/null)
    if [[ "$weight_count" -gt 0 ]]; then
        if [[ "$NEURAL_TTS_LAST_REPORTED_MODEL_PATH" != "$dir" ]]; then
            echo "[model-cache] local model found: $dir (${total_bytes} bytes)"
            NEURAL_TTS_LAST_REPORTED_MODEL_PATH="$dir"
        fi
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
        medium) echo 'https://openaipublic.azureedge.net/main/whisper/models/345ae4da62f9b3d59415adc60127b97c714f32e89f0c00d4a6021bbea85ae283/medium.pt' ;;
        medium.en) echo 'https://openaipublic.azureedge.net/main/whisper/models/d7440d1dc186f76616474e89803ba5a0c5763e2bcf4f8d3a0ea7741dde9c265/medium.en.pt' ;;
        large-v2) echo 'https://openaipublic.azureedge.net/main/whisper/models/81f7c96c852ee8fc532187b61f875ceec1a1baeda7af2a7ab0e9a6395ad8a89d/large-v2.pt' ;;
        large-v3|large) echo 'https://openaipublic.azureedge.net/main/whisper/models/e5b1a8937a99fd112907ae80315fedda765a69cfd366fb9bce46bada3b0d6010/large-v3.pt' ;;
        *) return 1 ;;
    esac
}

install_whisper_model_weights() {
    local model="$1" cache_dir="$2" prefix="$3"
    local url out expected local_bytes
    url="$(_whisper_model_url "$model")" || {
        echo "${prefix}[!] unknown whisper model '${model}'" >&2
        return 1
    }
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
    curl -fsSL -C - --retry 3 --connect-timeout 30 -o "$out" "$url"
    _hf_file_complete "$out" "${expected:-0}"
}
