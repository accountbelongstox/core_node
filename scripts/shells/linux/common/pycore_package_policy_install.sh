#!/usr/bin/env bash
# Idempotent installer for the central pycore Python package policy.

_PCPI_COMMON_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
_PCPI_ROOT_DIR="$(cd "$_PCPI_COMMON_DIR/../../../.." && pwd)"
_PCPI_POLICY_FILE="$_PCPI_ROOT_DIR/pycore/pyfoundations/python_package_policy.py"

pcpi_package_base() {
    local spec="$1" base
    base="${spec%%\[*}"
    base="${base%%[<>=!~]*}"
    printf '%s' "$base"
}

pcpi_package_key() {
    local name="$1"
    name="${name,,}"
    name="${name//_/-}"
    name="${name//./-}"
    printf '%s' "$name"
}

pcpi_metadata_snapshot() {
    local py="$1"
    "$py" - <<'PY'
import importlib.metadata as metadata

names = {
    (distribution.metadata.get("Name") or "").strip().lower()
    for distribution in metadata.distributions()
}
print("\n".join(sorted(name for name in names if name)))
PY
}

pcpi_is_gui_import() {
    local import_name="$1"
    case "$import_name" in
        PySide6|PyQt5|labelme|labelImg) return 0 ;;
        *) return 1 ;;
    esac
}

pcpi_requirement_satisfied() {
    local py="$1" spec="$2" probe_output
    probe_output="$(PYCORE_REQUIREMENT_SPEC="$spec" "$py" - <<'PY' 2>/dev/null
import importlib.metadata as metadata
import os
try:
    from packaging.requirements import Requirement
except ImportError:
    from pip._vendor.packaging.requirements import Requirement

requirement = Requirement(os.environ["PYCORE_REQUIREMENT_SPEC"])
try:
    metadata.distribution(requirement.name)
except metadata.PackageNotFoundError:
    print("__PIP_MISSING__")
else:
    print("__PIP_PRESENT__")
PY
    )"
    [[ "$probe_output" == *"__PIP_PRESENT__"* ]]
}

pcpi_import_present() {
    local py="$1" import_name="$2" probe_output
    probe_output="$(PYCORE_IMPORT_NAME="$import_name" "$py" - <<'PY' 2>/dev/null
import importlib.util
import os
print("__IMPORT_PRESENT__" if importlib.util.find_spec(os.environ["PYCORE_IMPORT_NAME"]) else "__IMPORT_MISSING__")
PY
    )"
    [[ "$probe_output" == *"__IMPORT_PRESENT__"* ]]
}

install_pycore_package_policy() {
    local py="$1" prefix="${2:-[python-policy]}" package_set="${3:-installer}"
    local base import_name index key name pip_spec ready skipped failed
    local -a pip_flags pip_specs missing_specs
    local -A installed
    pip_specs=()
    missing_specs=()
    ready=0
    skipped=0
    failed=0
    pip_flags=()

    # Venv detection must resolve symlinks ONE hop at a time and stop at the
    # first location carrying pyvenv.cfg: a venv's bin/python3 is itself a
    # symlink to the base interpreter, so full `readlink -f` jumps PAST the venv.
    local py_walk="$py"
    local py_dir=""
    local py_guard=0
    local py_is_venv=0
    while [ $py_guard -lt 10 ]; do
        py_guard=$((py_guard + 1))
        py_dir="$(dirname "$py_walk")"
        if [[ -f "$py_dir/../pyvenv.cfg" ]]; then
            py_is_venv=1
            break
        fi
        if [[ -L "$py_walk" ]]; then
            py_walk="$(readlink "$py_walk")"
            case "$py_walk" in
                /*) ;;
                *) py_walk="$py_dir/$py_walk" ;;
            esac
        else
            break
        fi
    done
    if [[ "$py_is_venv" -eq 0 ]]; then
        pip_flags=(--break-system-packages --no-user)
    fi

    while IFS=$'\t' read -r import_name pip_spec; do
        [[ -n "$import_name" && -n "$pip_spec" ]] || continue
        if [[ "${PYCORE_FORCE_GUI:-0}" != "1" && -z "${DISPLAY:-}" && -z "${WAYLAND_DISPLAY:-}" ]] \
            && pcpi_is_gui_import "$import_name"; then
            skipped=$((skipped + 1))
            continue
        fi
        pip_specs+=("$pip_spec")
    done < <("$py" "$_PCPI_POLICY_FILE" --platform linux --set "$package_set")

    while IFS= read -r name; do
        [[ -n "$name" ]] || continue
        key="$(pcpi_package_key "$name")"
        installed["$key"]=1
    done < <(pcpi_metadata_snapshot "$py")

    for index in "${!pip_specs[@]}"; do
        base="$(pcpi_package_base "${pip_specs[$index]}")"
        key="$(pcpi_package_key "$base")"
        if [[ -n "${installed[$key]:-}" ]]; then
            ready=$((ready + 1))
        else
            missing_specs+=("${pip_specs[$index]}")
        fi
    done

    if [[ "${#missing_specs[@]}" -eq 0 ]]; then
        echo "$prefix [SKIP] $package_set: $ready packages ready, $skipped headless skipped"
    else
        echo "$prefix [..] installing ${#missing_specs[@]} missing $package_set package(s): ${missing_specs[*]}"
        "$py" -m pip install "${pip_flags[@]}" "${missing_specs[@]}"

        installed=()
        while IFS= read -r name; do
            [[ -n "$name" ]] || continue
            key="$(pcpi_package_key "$name")"
            installed["$key"]=1
        done < <(pcpi_metadata_snapshot "$py")

        # Fine-grained recovery: a single unbuildable package (e.g. evdev needing
        # kernel headers) aborts pip's whole batch transaction, which would fail
        # every other missing package with it. Retry the still-missing ones one
        # by one so each failure is isolated. Real-time output per package.
        local -a retry_specs=()
        for pip_spec in "${missing_specs[@]}"; do
            base="$(pcpi_package_base "$pip_spec")"
            key="$(pcpi_package_key "$base")"
            if [[ -z "${installed[$key]:-}" ]]; then
                retry_specs+=("$pip_spec")
            fi
        done
        if [[ "${#retry_specs[@]}" -gt 0 ]]; then
            echo "$prefix [..] batch incomplete; retrying ${#retry_specs[@]} package(s) individually: ${retry_specs[*]}"
            for pip_spec in "${retry_specs[@]}"; do
                echo "$prefix [..] pip install $pip_spec"
                "$py" -m pip install "${pip_flags[@]}" "$pip_spec" || true
            done
            installed=()
            while IFS= read -r name; do
                [[ -n "$name" ]] || continue
                key="$(pcpi_package_key "$name")"
                installed["$key"]=1
            done < <(pcpi_metadata_snapshot "$py")
        fi

        ready=0
        failed=0
        for pip_spec in "${pip_specs[@]}"; do
            base="$(pcpi_package_base "$pip_spec")"
            key="$(pcpi_package_key "$base")"
            if [[ -n "${installed[$key]:-}" ]]; then
                ready=$((ready + 1))
            else
                failed=$((failed + 1))
            fi
        done
        echo "$prefix package policy summary: $ready ready, $failed failed, $skipped headless skipped"
    fi
}
