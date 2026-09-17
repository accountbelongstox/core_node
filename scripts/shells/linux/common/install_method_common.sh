#!/bin/bash
# install_method_common.sh - Per-engine install-method selection (native/docker).
#
# Contract (plan steps 16-17):
#   * Idempotency is per minimal operation, not a global entry: a saved valid
#     choice is reused verbatim with NO countdown and NO rewrite; only the first
#     selection or an explicit --reselect shows the 20s timed prompt; a timeout
#     commits exactly the displayed default; B/Q cancels without writing.
#   * Every engine owns its own keys - one global backend never overrides all:
#       TTS_<ENGINE>_INSTALL_METHOD         native|docker
#       TTS_<ENGINE>_INSTALL_METHOD_SOURCE  explicit|timeout_default
#       TTS_<ENGINE>_INSTALL_METHOD_BACKENDS  supported-set snapshot (config version)
#       TTS_<ENGINE>_BACKEND                backend actually used by the install
#   * State flows only through gvar_common.sh set_var/get_var (file store),
#     never through return codes or transient environment variables.
#
# API:
#   install_method_select <engine> [--supported "native docker"]
#       [--recommended <b>] [--recommendation-source "<text>"]
#       [--default <b>] [--method <b>] [--reselect]
#     Prints the chosen method on stdout; prompts go to /dev/tty.
#     Return: 0 = method printed, 10 = user cancelled (nothing written).
#   install_method_record_backend <engine> <backend>
#     Writes TTS_<ENGINE>_BACKEND only when the value actually changes.

INSTALL_METHOD_CONFIG_VERSION="1"

# Self-sufficient state store: source gvar_common.sh when the caller has not.
if ! declare -F get_var >/dev/null 2>&1; then
    . "$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)/gvar_common.sh"
fi

_install_method_key() {
    local engine="$1" suffix="$2" upper
    upper="$(printf '%s' "$engine" | tr '[:lower:]' '[:upper:]')"
    printf 'TTS_%s_%s' "$upper" "$suffix"
}

_install_method_supported_contains() {
    local supported="$1" candidate="$2" item
    for item in $supported; do
        [[ "$item" == "$candidate" ]] && return 0
    done
    return 1
}

# Write a gvar key only when the value differs (content-equal writes are not
# idempotent: they bump mtimes and can mask "no change" audits). The write is
# silenced (3rd arg): callers capture this library's stdout as the chosen
# method, so persistence logs must not pollute it.
_install_method_set_var_if_changed() {
    local key="$1" value="$2" current
    current="$(get_var "$key" "")"
    [[ "$current" == "$value" ]] && return 0
    set_var "$key" "$value" false
}

_install_method_persist() {
    local engine="$1" method="$2" source="$3" supported="$4"
    _install_method_set_var_if_changed "$(_install_method_key "$engine" INSTALL_METHOD)" "$method"
    _install_method_set_var_if_changed "$(_install_method_key "$engine" INSTALL_METHOD_SOURCE)" "$source"
    _install_method_set_var_if_changed "$(_install_method_key "$engine" INSTALL_METHOD_BACKENDS)" "v${INSTALL_METHOD_CONFIG_VERSION}:${supported}"
}

install_method_record_backend() {
    local engine="$1" backend="$2"
    _install_method_set_var_if_changed "$(_install_method_key "$engine" BACKEND)" "$backend"
}

_install_method_prompt() {
    # Interactive timed choice on /dev/tty. Echoes the selected method on stdout.
    local engine="$1" supported="$2" recommended="$3" rec_source="$4" default_backend="$5"
    local -a options=()
    local item idx=0 default_idx=0 remaining=0 deadline=0 now=0 key="" seq="" selected=""
    local prompt_drawn=0

    for item in $supported; do
        options+=("$item")
        [[ "$item" == "$default_backend" ]] && default_idx=$idx
        idx=$((idx + 1))
    done
    selected=$default_idx

    {
        printf '\n============================================================\n'
        printf ' Install method for engine: %s (platform: linux)\n' "$engine"
        printf '============================================================\n'
        if [[ -n "$recommended" && -n "$rec_source" ]]; then
            printf ' Recommendation: %s\n   source: %s\n' "$recommended" "$rec_source"
        fi
        idx=0
        for item in "${options[@]}"; do
            printf '   [%d] %s%s%s\n' "$((idx + 1))" "$item" \
                "$([[ "$item" == "$recommended" ]] && printf ' (recommended)')" \
                "$([[ $idx -eq $default_idx ]] && printf ' (default)')"
            idx=$((idx + 1))
        done
        printf ' Keys: number/n/d = switch, Enter = confirm highlighted, B/Q = cancel (no write)\n'
    } > /dev/tty

    deadline=$(( $(date +%s) + 20 ))
    while :; do
        now=$(date +%s)
        remaining=$(( deadline - now ))
        [[ $remaining -lt 0 ]] && remaining=0
        # Redraw the countdown line so the committed item is always the displayed one.
        printf '\r Select [%s] %s -> auto-confirm in %2ds (Enter = confirm)   ' \
            "$((selected + 1))" "${options[$selected]}" "$remaining" > /dev/tty
        prompt_drawn=1
        [[ $remaining -le 0 ]] && break
        key="" seq=""
        # read succeeds on a keypress (Enter -> empty key) and fails on the 1s
        # poll tick; only a successful read is interpreted.
        if ! read -r -s -n 1 -t 1 key < /dev/tty; then
            continue
        fi
        case "$key" in
            "") break ;;  # Enter = confirm the highlighted (displayed) item.
            [1-9])
                idx=$((10#$key - 1))
                [[ $idx -ge 0 && $idx -lt ${#options[@]} ]] && selected=$idx
                ;;
            n|N|d|D)
                [[ "$key" =~ ^[nN]$ ]] && item="native" || item="docker"
                for idx in "${!options[@]}"; do
                    [[ "${options[$idx]}" == "$item" ]] && selected=$idx
                done
                ;;
            b|B|q|Q)
                printf '\n Cancelled; no install method was written.\n' > /dev/tty
                return 10
                ;;
            $'\x1b')
                # Arrow keys arrive as ESC [ A/B; consume the rest of the sequence.
                read -r -s -n 2 -t 1 seq < /dev/tty || seq=""
                case "$seq" in
                    "[A"|"[D") selected=$(( selected > 0 ? selected - 1 : ${#options[@]} - 1 )) ;;
                    "[B"|"[C") selected=$(( (selected + 1) % ${#options[@]} )) ;;
                esac
                ;;
        esac
    done
    [[ $prompt_drawn -eq 1 ]] && printf '\n' > /dev/tty
    printf '%s' "${options[$selected]}"
    return 0
}

install_method_select() {
    local engine="${1:-}"
    shift || true
    local supported="native"
    local recommended=""
    local recommendation_source=""
    local default_backend="native"
    local explicit_method=""
    local reselect=0
    local key="" saved="" chosen="" prompt_tty_ok=1

    while [[ $# -gt 0 ]]; do
        case "$1" in
            --supported)            supported="$2"; shift 2 ;;
            --recommended)          recommended="$2"; shift 2 ;;
            --recommendation-source) recommendation_source="$2"; shift 2 ;;
            --default)              default_backend="$2"; shift 2 ;;
            --method)               explicit_method="$2"; shift 2 ;;
            --reselect)             reselect=1; shift ;;
            *) shift ;;
        esac
    done

    if [[ -z "$engine" ]]; then
        echo "[install-method] engine name is required" >&2
        return 1
    fi
    if ! _install_method_supported_contains "$supported" "$default_backend"; then
        echo "[install-method] default '$default_backend' is not in the supported set '$supported'" >&2
        return 1
    fi

    # 1) Explicit caller choice: validate, persist, return (no countdown).
    if [[ -n "$explicit_method" ]]; then
        if ! _install_method_supported_contains "$supported" "$explicit_method"; then
            echo "[install-method] explicit method '$explicit_method' is not supported for $engine ($supported)" >&2
            return 1
        fi
        _install_method_persist "$engine" "$explicit_method" "explicit" "$supported"
        printf '%s' "$explicit_method"
        return 0
    fi

    # 2) Saved valid choice: reuse verbatim; never re-prompt, never rewrite.
    key="$(_install_method_key "$engine" INSTALL_METHOD)"
    saved="$(get_var "$key" "")"
    if [[ $reselect -eq 0 && -n "$saved" ]]; then
        if _install_method_supported_contains "$supported" "$saved"; then
            printf '%s' "$saved"
            return 0
        fi
        echo "[install-method] saved method '$saved' for $engine is no longer supported ($supported); re-selecting." >&2
    fi

    # 2b) Single-option engines: no meaningful choice exists, so the only
    # supported backend is persisted directly (no countdown noise).
    local option_count=0 option_item=""
    for option_item in $supported; do option_count=$((option_count + 1)); done
    if [[ $option_count -eq 1 && $reselect -eq 0 ]]; then
        _install_method_persist "$engine" "$default_backend" "timeout_default" "$supported"
        printf '%s' "$default_backend"
        return 0
    fi

    # 3) First selection (or reselect): 20s monotonic countdown on /dev/tty.
    if [[ ! -r /dev/tty ]] || ! ( : < /dev/tty ) 2>/dev/null; then
        prompt_tty_ok=0
    fi
    if [[ $prompt_tty_ok -eq 0 ]]; then
        # No input channel exists: apply the same 20s auto-default rule without
        # blocking forever and without consuming an upper menu's input.
        echo "[install-method] no TTY; auto-selecting default '$default_backend' for $engine (20s rule, non-interactive)." >&2
        _install_method_persist "$engine" "$default_backend" "timeout_default" "$supported"
        printf '%s' "$default_backend"
        return 0
    fi

    chosen="$(_install_method_prompt "$engine" "$supported" "$recommended" "$recommendation_source" "$default_backend")" || return $?
    if [[ "$chosen" == "$default_backend" ]]; then
        _install_method_persist "$engine" "$chosen" "timeout_default" "$supported"
    else
        _install_method_persist "$engine" "$chosen" "explicit" "$supported"
    fi
    printf '%s' "$chosen"
    return 0
}
