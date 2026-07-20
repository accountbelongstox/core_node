#!/bin/bash
# Resolve pycore/tts_install_assets from install_shells (5 levels below repo root).

pycore_repo_root_from_install_shells() {
    local script_dir="$1"
    (cd "$script_dir/../../../../../.." && pwd)
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
    echo "${prefix}[!] SoX NOT on PATH — pysox (qwen-tts tokenizer) warns at import. Install: apt install sox" >&2
    return 1
}

prereq_install_probe() {
    local py="$1"
    local prefix="$2"
    shift 2 || true
    local absent_ok=0
    local absent_note=""
    local mod args=()
    if [[ "${1:-}" == "--absent-ok" ]]; then
        absent_ok=1
        absent_note="${2:-}"
        shift 2
    fi
    args=("$@")
    echo "${prefix}[idempotent-probe] running post-install verification ..."
    for mod in "${args[@]}"; do
        if "$py" -c "import importlib.util,sys; sys.exit(0 if importlib.util.find_spec('$mod') else 1)" 2>/dev/null; then
            echo "${prefix}[idempotent-probe] OK  import $mod"
        elif [[ "$absent_ok" -eq 1 ]]; then
            if [[ -n "$absent_note" ]]; then
                echo "${prefix}[idempotent-probe] SKIP import $mod ($absent_note)"
            else
                echo "${prefix}[idempotent-probe] SKIP import $mod"
            fi
        else
            echo "${prefix}[idempotent-probe] FAIL import $mod" >&2
        fi
    done
}

complete_prereq_step() {
    local py="$1"
    local prefix="$2"
    shift 2 || true
    prereq_install_probe "$py" "$prefix" "$@"
    exit 0
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
            full=name if not sub else f"{sub}/{name}"
            if entry.get("type") == "directory":
                pending.append(full)
                continue
            size=int(entry.get("size") or 0)
            lfs=entry.get("lfs") or {}
            if size <= 0 and lfs:
                size=int(lfs.get("size") or 0)
            out[full]=size
    return out

for base in bases:
    if not base:
        continue
    catalog=walk(base)
    if catalog:
        for name,size in sorted(catalog.items()):
            print(f"{name}\t{size}")
        sys.exit(0)
sys.exit(1)' "$repo" "https://huggingface.co" "$mirror"
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
        return $?
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
    case "$name" in
        *.safetensors)
            if ! _test_safetensors_readable "$out" "$py"; then
                echo "${prefix}[!] ${name} failed safetensors verify; backing up for retry" >&2
                _backup_install_asset_path "$out" "$prefix"
                return 1
            fi
            ;;
    esac
    return 0
}

install_hf_repo_flat() {
    local repo="$1" dest="$2" sentinel="$3" prefix="$4"
    shift 4 || true
    local allow_raw="${1:-*}" mirror="${2:-$(_hf_mirror_base)}" sentinel_value="${3:-$repo}" py="${4:-python3}"
    local -a allow=()
    local name all_ok=1 count=0 total=0 catalog_bytes=0
    IFS=',' read -r -a allow <<< "$allow_raw"
    mkdir -p "$dest"
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

_test_safetensors_readable() {
    local path="$1" py="${2:-python3}"
    [[ -f "$path" ]] || return 1
    command -v "$py" >/dev/null 2>&1 || return 0
    "$py" -c "from safetensors import safe_open; f=safe_open('$path', framework='pt'); _=f.keys()" >/dev/null 2>&1
}

_core_node_repo_root_from_tts_common() {
    (cd "$(dirname "${BASH_SOURCE[0]}")/../../../.." && pwd)
}

_invoke_qwen3tts_weights_ready_check() {
    local dir="$1" repo="${2:-}" py="${3:-python3}"
    local repo_root
    [[ -d "$dir" ]] || return 1
    command -v "$py" >/dev/null 2>&1 || return 2
    repo_root="$(_core_node_repo_root_from_tts_common)"
    "$py" -c "import sys
from pathlib import Path
sys.path.insert(0, r'''$repo_root''')
from pycore.pyutils.tts.qwen3tts_weights import local_weights_ready
sys.exit(0 if local_weights_ready(Path(r'''$dir'''), r'''$repo''') else 1)" >/dev/null 2>&1
}

neural_tts_local_weights_ready() {
    local dir="$1" repo="${2:-}" py="${3:-python3}"
    local rel expected have rc
    _invoke_qwen3tts_weights_ready_check "$dir" "$repo" "$py"
    rc=$?
    if [[ "$rc" -eq 0 ]]; then return 0; fi
    if [[ "$rc" -eq 1 ]]; then return 1; fi

    [[ -d "$dir" ]] || return 1
    find "$dir" -type f -name 'config.json' 2>/dev/null | grep -q . || return 1
    local weight_count=0
    while IFS= read -r -d '' f; do
        weight_count=$((weight_count + 1))
        if [[ -n "$repo" ]]; then
            rel="${f#${dir%/}/}"
            expected="$(_hf_catalog_size "$repo" "$rel")"
            if [[ "${expected:-0}" -gt 0 ]]; then
                have="$(wc -c < "$f" 2>/dev/null | tr -d ' ')"
                [[ "${have:-0}" -ge "${expected:-0}" ]] || return 1
            elif [[ ! -s "$f" ]]; then
                return 1
            fi
        elif [[ ! -s "$f" ]]; then
            return 1
        fi
        case "$f" in
            *.safetensors) _test_safetensors_readable "$f" "$py" || return 1 ;;
        esac
    done < <(find "$dir" -type f \( -name '*.safetensors' -o -name '*.bin' -o -name '*.pt' \) -print0 2>/dev/null)
    [[ "$weight_count" -gt 0 ]]
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
    local url out expected
    url="$(_whisper_model_url "$model")" || {
        echo "${prefix}[!] unknown whisper model '${model}'" >&2
        return 1
    }
    mkdir -p "$cache_dir"
    out="${cache_dir%/}/${model}.pt"
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
