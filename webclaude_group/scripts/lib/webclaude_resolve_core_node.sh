#!/usr/bin/env bash
# Resolve full core_node checkout: directory containing this marker (proves scripts tree exists).
# webclaude_group alone under e.g. /www/wwwroot/webclaude_group has parent != core_node.

WEBCLAUDE_CORE_NODE_MARKER="scripts/shells/linux/debian/install_shells/54_install_golang22.sh"

# Echo absolute core_node path; exit 0 if found, 1 otherwise.
# $1 = directory to walk upward from (e.g. webclaude_group or gateway repo root)
# $2 = webclaude_group root for sibling .../core_node check (optional; pass "" to skip)
webclaude_print_resolved_core_node() {
  local walk_from="${1:-.}"
  local group_root="${2:-}"
  local cand="" d="" i=0

  for cand in "${WEBCLAUDE_CORE_NODE:-}" "${CORE_NODE:-}"; do
    [[ -z "$cand" ]] && continue
    cand="$(cd "$cand" 2>/dev/null && pwd)" || continue
    if [[ -f "$cand/$WEBCLAUDE_CORE_NODE_MARKER" ]]; then
      echo "$cand"
      return 0
    fi
  done

  # webclaude_group as root when shells are vendored/copied to webclaude_group/scripts/shells/...
  if [[ -n "$group_root" ]] && [[ -f "$group_root/$WEBCLAUDE_CORE_NODE_MARKER" ]]; then
    echo "$(cd "$group_root" && pwd)"
    return 0
  fi

  # Parent of webclaude_group (e.g. wwwroot) with flat scripts/shells tree (no core_node subfolder)
  if [[ -n "$group_root" ]]; then
    local pr
    pr="$(cd "$group_root/.." 2>/dev/null && pwd)" || pr=""
    if [[ -n "$pr" ]] && [[ -f "$pr/$WEBCLAUDE_CORE_NODE_MARKER" ]]; then
      echo "$pr"
      return 0
    fi
  fi

  d="$(cd "$walk_from" 2>/dev/null && pwd)" || return 1
  for ((i = 0; i < 16; i++)); do
    if [[ -f "$d/$WEBCLAUDE_CORE_NODE_MARKER" ]]; then
      echo "$d"
      return 0
    fi
    [[ "$d" == "/" ]] && break
    d="$(dirname "$d")"
  done

  if [[ -n "$group_root" ]] && [[ -f "$group_root/../core_node/$WEBCLAUDE_CORE_NODE_MARKER" ]]; then
    echo "$(cd "$group_root/../core_node" && pwd)"
    return 0
  fi

  return 1
}
