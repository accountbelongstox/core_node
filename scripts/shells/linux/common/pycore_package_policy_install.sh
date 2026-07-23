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

pcpi_is_gui_import() {
    local import_name="$1"
    case "$import_name" in
        PySide6|PyQt5|labelme|labelImg) return 0 ;;
        *) return 1 ;;
    esac
}

pcpi_requirement_satisfied() {
    local py="$1" spec="$2"
    PYCORE_REQUIREMENT_SPEC="$spec" "$py" - <<'PY' >/dev/null 2>&1
import importlib.metadata as metadata
import os
try:
    from packaging.requirements import Requirement
except ImportError:
    from pip._vendor.packaging.requirements import Requirement

requirement = Requirement(os.environ["PYCORE_REQUIREMENT_SPEC"])
try:
    installed = metadata.version(requirement.name)
except metadata.PackageNotFoundError:
    raise SystemExit(1)
raise SystemExit(0 if not requirement.specifier or requirement.specifier.contains(installed, prereleases=True) else 1)
PY
}

pcpi_import_present() {
    local py="$1" import_name="$2"
    PYCORE_IMPORT_NAME="$import_name" "$py" - <<'PY' >/dev/null 2>&1
import importlib.util
import os
raise SystemExit(0 if importlib.util.find_spec(os.environ["PYCORE_IMPORT_NAME"]) else 1)
PY
}

install_pycore_package_policy() {
    local py="$1" prefix="${2:-[python-policy]}"
    local import_name pip_spec installed failed
    local -a pip_args pip_flags
    installed=0
    failed=0
    pip_flags=()

    if [[ ! -f "$_PCPI_POLICY_FILE" ]]; then
        echo "$prefix [ERROR] central package policy missing: $_PCPI_POLICY_FILE" >&2
        return 1
    fi
    if [[ ! -f "$(dirname "$py")/../pyvenv.cfg" ]]; then
        pip_flags=(--break-system-packages --no-user)
    fi

    while IFS=$'\t' read -r import_name pip_spec; do
        [[ -n "$import_name" && -n "$pip_spec" ]] || continue
        if [[ "${PYCORE_FORCE_GUI:-0}" != "1" && -z "${DISPLAY:-}" && -z "${WAYLAND_DISPLAY:-}" ]] \
            && pcpi_is_gui_import "$import_name"; then
            echo "$prefix [SKIP] headless GUI package: $pip_spec"
            continue
        fi
        if pcpi_requirement_satisfied "$py" "$pip_spec" && pcpi_import_present "$py" "$import_name"; then
            echo "$prefix [SKIP] $pip_spec already satisfies policy"
            installed=$((installed + 1))
            continue
        fi
        if pcpi_requirement_satisfied "$py" "$pip_spec"; then
            echo "$prefix [..] repairing $pip_spec (metadata present, import missing) ..."
            pip_args=(--force-reinstall --no-deps)
        else
            echo "$prefix [..] aligning $pip_spec ..."
            pip_args=(--upgrade)
        fi
        if "$py" -m pip install "${pip_flags[@]}" "${pip_args[@]}" "$pip_spec" \
            && pcpi_requirement_satisfied "$py" "$pip_spec" \
            && pcpi_import_present "$py" "$import_name"; then
            installed=$((installed + 1))
        else
            failed=$((failed + 1))
            echo "$prefix [!] $pip_spec failed; it will retry next run." >&2
        fi
    done < <("$py" "$_PCPI_POLICY_FILE" --platform linux)

    echo "$prefix package policy summary: $installed ready, $failed failed"
    [[ "$failed" -eq 0 ]]
}
