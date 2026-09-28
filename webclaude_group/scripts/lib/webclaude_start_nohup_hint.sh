#!/usr/bin/env bash
# Shared helpers: nohup copy-paste, hot-reload command, first-run log preview marker.
# Source after WEBCLAUDE_DATA_DIR is set. All user-facing strings in English.

webclaude_hint_cache_dir() {
  local base="${WEBCLAUDE_DATA_DIR:-}"
  [[ -n "$base" ]] || return 1
  echo "${base}/cache"
}

webclaude_hint_first_run_marker() {
  local id="$1"
  local d
  d="$(webclaude_hint_cache_dir)" || return 1
  echo "${d}/.start_sh_first_run_${id}"
}

webclaude_is_first_run() {
  local id="$1"
  local m
  m="$(webclaude_hint_first_run_marker "$id" 2>/dev/null)" || return 1
  [[ ! -f "$m" ]]
}

webclaude_mark_first_run_done() {
  local id="$1"
  local d m
  d="$(webclaude_hint_cache_dir)" || return 1
  mkdir -p "$d"
  m="$(webclaude_hint_first_run_marker "$id")"
  : >"$m"
}

# Print copy-paste nohup line (paths shell-quoted), log follow, and hot-reload dev command.
# Args:
#   $1 start_sh_abs
#   $2 log_abs
#   $3 hot_reload_cmd (single line for copy-paste)
#   $4 project_title
#   $5 optional extra args appended to nohup bash line (shell-quoted string, e.g. --skip-deps)
#   $6 if "1", skip first-run tip + marker (use for unified parent when it handles first-run)
webclaude_print_nohup_and_hot_reload() {
  local start_sh="$1"
  local log_abs="$2"
  local hot_reload="$3"
  local title="$4"
  local extra_args="${5:-}"
  local skip_first_tip="${6:-}"

  mkdir -p "$(dirname "$log_abs")" 2>/dev/null || true

  local q_start q_log
  q_start=$(printf %q "$start_sh")
  q_log=$(printf %q "$log_abs")

  echo ""
  echo "============================================================"
  echo "  ${title} - background run (nohup)"
  echo "  This script path: ${start_sh}"
  echo "============================================================"
  echo "  Copy-paste to run detached (stdout/stderr -> log file):"
  echo ""
  if [[ -n "$extra_args" ]]; then
    echo "    nohup bash ${q_start} ${extra_args} > ${q_log} 2>&1 < /dev/null & disown"
  else
    echo "    nohup bash ${q_start} > ${q_log} 2>&1 < /dev/null & disown"
  fi
  echo ""
  echo "  Follow logs:"
  echo "    tail -f ${q_log}"
  echo ""
  echo "  Hot reload (development; run in a terminal, not nohup):"
  echo "    ${hot_reload}"
  echo "============================================================"
  echo ""

  [[ "$skip_first_tip" == "1" ]] && return 0

  local fid
  fid=$(echo "$title" | tr '[:upper:]' '[:lower:]' | tr -cs 'a-z0-9' '_' | sed 's/^_\|_$//g')
  if webclaude_is_first_run "$fid" 2>/dev/null; then
    echo "  (First run) Process logs will appear below in this terminal until you detach."
    echo "  For background jobs, use the nohup line above, then: tail -f ${q_log}"
    echo ""
    webclaude_mark_first_run_done "$fid"
  fi
}
