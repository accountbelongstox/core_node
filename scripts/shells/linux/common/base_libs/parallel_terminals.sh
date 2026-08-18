#!/usr/bin/env bash
# parallel_terminals.sh — reusable engine to run a GROUP of installers, each in its OWN
# live terminal (tmux pane / pop-up window / bg+tail), so their model DOWNLOADS overlap.
# Completion is detected by per-task `.done` SENTINEL files, NEVER by exit codes — every
# task streams its own log and is judged visually. The shared pip lock (pip_lock.sh, wired
# into the installers) serializes their pip steps into the one venv.
#
# Reused by both parallel groups (TTS/STT and the LLM stack) — no duplicated machinery.
#
# Caller contract: set GROUP (human label), GROUP_SLUG (path/session slug), PT_PYTHON,
# PT_MODE (auto|windows|tmux|bg), PT_COMMON_DIR, PT_RUN_GUARDS (0/1), PT_DRY_RUN (0/1);
# then `pt_add_task LABEL SHORT CMD` for each engine; then `pt_run`.

PT_LABELS=()
PT_SHORTS=()
PT_CMDS=()
PT_RUNDIR=""
PT_LOGDIR=""
PT_DONEDIR=""
PT_N=0
PT_SESSION=""
PT_EMULATOR=""
PT_I=0
PT_GROUP_LOCK=""

pt_add_task() { PT_LABELS+=("$1"); PT_SHORTS+=("$2"); PT_CMDS+=("$3"); }

# Generate one self-contained runner per task. Each streams to its log via tee and drops a
# `.done` sentinel on completion regardless of exit status (we wait on sentinels, not codes).
pt_write_task_scripts() {
    local idx label short cmd path
    for idx in "${!PT_LABELS[@]}"; do
        label="${PT_LABELS[$idx]}"; short="${PT_SHORTS[$idx]}"; cmd="${PT_CMDS[$idx]}"
        path="$PT_RUNDIR/task_${label}.sh"
        {
            echo "#!/usr/bin/env bash"
            echo "set -uo pipefail"
            echo "LOG='$PT_LOGDIR/${label}.log'"
            echo "DONE='$PT_DONEDIR/${label}.done'"
            echo "{"
            echo "  echo '============================================================'"
            echo "  echo '[$label] START : $short'"
            echo "  echo '============================================================'"
            echo "  $cmd"
            echo "  rc=\$?"
            echo "  echo"
            echo "  echo \"[$label] DONE (exit \$rc) — independent task; see the driver summary.\""
            echo "} 2>&1 | tee \"\$LOG\""
            echo ": > \"\$DONE\""
        } > "$path"
        chmod +x "$path" 2>/dev/null || true
        # Pre-create the log so bg-mode `tail -F .../*.log` matches a real file immediately.
        : > "$PT_LOGDIR/${label}.log" 2>/dev/null || true
    done
}

pt_find_emulator() {
    local e
    for e in x-terminal-emulator xfce4-terminal qterminal konsole gnome-terminal xterm kitty; do
        command -v "$e" >/dev/null 2>&1 && { echo "$e"; return 0; }
    done
    return 1
}

pt_launch_windows() {
    local idx label path hold
    for idx in "${!PT_LABELS[@]}"; do
        label="${PT_LABELS[$idx]}"; path="$PT_RUNDIR/task_${label}.sh"
        hold="bash '$path'; echo; read -rp '[$label] Enter to close ' _"
        # Per-emulator flags are NOT universal (qterminal/konsole have no -T; kitty has no
        # -e). The default `-e bash -c` covers x-terminal-emulator/qterminal/xfce4/xterm;
        # the title is shown by the runner's own START banner.
        case "$PT_EMULATOR" in
            gnome-terminal) gnome-terminal --title="${GROUP_SLUG:-job}:$label" -- bash -c "$hold" >/dev/null 2>&1 & ;;
            kitty)          kitty --title "${GROUP_SLUG:-job}:$label" bash -c "$hold" >/dev/null 2>&1 & ;;
            konsole)        konsole -p "tabtitle=$label" -e bash -c "$hold" >/dev/null 2>&1 & ;;
            *)              "$PT_EMULATOR" -e bash -c "$hold" >/dev/null 2>&1 & ;;
        esac
        sleep 0.2
    done
    echo "[i] Launched $PT_N native terminal windows (one per task)."
}

pt_launch_tmux() {
    local idx label path
    PT_SESSION="${GROUP_SLUG:-parallel}_$$"
    tmux new-session -d -s "$PT_SESSION" -x 220 -y 50 2>/dev/null || { echo "[!] tmux session failed."; return 1; }
    tmux set-window-option -t "$PT_SESSION" remain-on-exit on 2>/dev/null || true
    for idx in "${!PT_LABELS[@]}"; do
        label="${PT_LABELS[$idx]}"; path="$PT_RUNDIR/task_${label}.sh"
        if [[ "$idx" -gt 0 ]]; then
            tmux split-window -t "$PT_SESSION" 2>/dev/null || true
            tmux select-layout -t "$PT_SESSION" tiled >/dev/null 2>&1 || true
        fi
        tmux send-keys -t "$PT_SESSION" "bash '$path'" C-m 2>/dev/null || true
    done
    tmux select-layout -t "$PT_SESSION" tiled >/dev/null 2>&1 || true
    tmux set-window-option -t "$PT_SESSION" remain-on-exit on 2>/dev/null || true
    echo "[i] Launched $PT_N tmux panes in session '$PT_SESSION'."
    echo "    Watch live:   tmux attach -t $PT_SESSION       (detach with Ctrl-b then d)"
}

pt_launch_bg() {
    local idx label path
    for idx in "${!PT_LABELS[@]}"; do
        label="${PT_LABELS[$idx]}"; path="$PT_RUNDIR/task_${label}.sh"
        setsid bash "$path" >/dev/null 2>&1 < /dev/null &
    done
    echo "[i] Launched $PT_N background jobs; streaming all logs below (Ctrl-C stops watching, installs continue)."
}

# Wait on the `.done` sentinels (NOT exit codes). In bg mode, stream all logs live.
pt_wait_for_done() {
    local done_n=0 waited=0 max=21600 tailpid=""
    if [[ "$PT_MODE" == "bg" ]]; then
        ( tail -n +1 -F "$PT_LOGDIR"/*.log 2>/dev/null & echo $! > "$PT_RUNDIR/.tailpid" ) ; tailpid="$(cat "$PT_RUNDIR/.tailpid" 2>/dev/null || echo)"
    fi
    while :; do
        done_n=$(find "$PT_DONEDIR" -maxdepth 1 -name '*.done' 2>/dev/null | wc -l | tr -d ' ')
        [[ "$done_n" -ge "$PT_N" ]] && break
        [[ "$waited" -ge "$max" ]] && { echo "[!] Timeout after ${max}s with $done_n/$PT_N done; leaving the rest running."; break; }
        [[ "$PT_MODE" != "bg" ]] && printf '\r[..] %s/%s tasks finished (waiting; live output in the panes/windows) ' "$done_n" "$PT_N"
        sleep 3; waited=$((waited+3))
    done
    [[ -n "$tailpid" ]] && kill "$tailpid" 2>/dev/null || true
    echo
}

# Post-phase CPU/GPU guards (serial; the parallel phase is over). Opt-in via PT_RUN_GUARDS.
pt_run_guards() {
    [[ "${PT_RUN_GUARDS:-0}" -eq 1 ]] || return 0
    echo "[..] torch CPU/GPU guard (repair-only)"
    TCG_REPAIR_ONLY=1 bash "$PT_COMMON_DIR/torch_cpu_guard.sh" --python "$PT_PYTHON"
    echo "[..] onnxruntime CPU/GPU guard (repair-only)"
    OCG_REPAIR_ONLY=1 bash "$PT_COMMON_DIR/onnxruntime_cpu_guard.sh" --python "$PT_PYTHON"
}

pt_summary() {
    local idx label log last
    echo "============================================================"
    echo " ${GROUP:-Parallel} install summary  (logs: $PT_LOGDIR)"
    echo "============================================================"
    for idx in "${!PT_LABELS[@]}"; do
        label="${PT_LABELS[$idx]}"; log="$PT_LOGDIR/${label}.log"
        last="$(grep -aE '\[OK\]|\[X\]|\[!\]|DONE \(exit' "$log" 2>/dev/null | tail -n1)"
        printf '  %-18s %s\n' "$label" "${last:-<no output captured>}"
    done
    echo "============================================================"
}

# Orchestrate: set up the run area, pick the mode, write runners, launch, wait, guard, sum.
pt_run() {
    PT_N=${#PT_LABELS[@]}
    if [[ "$PT_N" -eq 0 ]]; then echo "[!] No tasks to run."; return 0; fi

    PT_RUNDIR="${CORE_NODE_DATA_DIR:-/var/_core_node}/${GROUP_SLUG:-parallel}/run_$$"
    if ! mkdir -p "$PT_RUNDIR" 2>/dev/null; then
        PT_RUNDIR="${TMPDIR:-/tmp}/core_node_${GROUP_SLUG:-parallel}/run_$$"
        mkdir -p "$PT_RUNDIR" 2>/dev/null || true
    fi
    PT_LOGDIR="$PT_RUNDIR/logs"; PT_DONEDIR="$PT_RUNDIR/done"
    mkdir -p "$PT_LOGDIR" "$PT_DONEDIR" 2>/dev/null || true

    echo "============================================================"
    echo " Parallel install driver — ${GROUP:-parallel}"
    echo "============================================================"
    echo "  python   : $PT_PYTHON"
    echo "  tasks    : ${PT_LABELS[*]}"
    echo "  run dir  : $PT_RUNDIR"

    if [[ "$PT_MODE" == "auto" ]]; then
        if [[ -n "${DISPLAY:-}" || -n "${WAYLAND_DISPLAY:-}" ]] && pt_find_emulator >/dev/null 2>&1; then
            PT_MODE="windows"
        elif command -v tmux >/dev/null 2>&1; then
            PT_MODE="tmux"
        else
            PT_MODE="bg"
        fi
    fi
    echo "  mode     : $PT_MODE"

    pt_write_task_scripts

    if [[ "${PT_DRY_RUN:-0}" -eq 1 ]]; then
        echo "[dry-run] task runners written under $PT_RUNDIR (not launched). Plan:"
        for PT_I in "${!PT_LABELS[@]}"; do printf '  %-18s -> %s\n' "${PT_LABELS[$PT_I]}" "${PT_SHORTS[$PT_I]}"; done
        return 0
    fi

    # Coarse advisory lock: only ONE parallel group may install into the shared venv at a
    # time. Different groups (and TTS's opt-in MeloTTS/GPT-SoVITS) pin conflicting package
    # versions; running two at once would scramble the venv. Non-blocking -> fail fast.
    PT_GROUP_LOCK="${CORE_NODE_DATA_DIR:-/var/_core_node}/locks/parallel_group.lock"
    mkdir -p "$(dirname "$PT_GROUP_LOCK")" 2>/dev/null || true
    : > "$PT_GROUP_LOCK" 2>/dev/null || true
    if command -v flock >/dev/null 2>&1; then
        exec 9>"$PT_GROUP_LOCK" 2>/dev/null || true
        if ! flock -n 9; then
            echo "[!] Another parallel install group is already running (lock: $PT_GROUP_LOCK)."
            echo "    Two groups installing into the one shared venv would fight over package"
            echo "    versions (e.g. transformers). Wait for it to finish, then re-run."
            return 1
        fi
    fi

    case "$PT_MODE" in
        windows) PT_EMULATOR="$(pt_find_emulator)" && pt_launch_windows || { echo "[!] no emulator; falling back"; PT_MODE="tmux"; command -v tmux >/dev/null 2>&1 && pt_launch_tmux || { PT_MODE="bg"; pt_launch_bg; }; } ;;
        tmux)    command -v tmux >/dev/null 2>&1 && pt_launch_tmux || { echo "[!] tmux missing; falling back to bg"; PT_MODE="bg"; pt_launch_bg; } ;;
        bg)      pt_launch_bg ;;
        *)       echo "[!] unknown mode '$PT_MODE'; using bg"; PT_MODE="bg"; pt_launch_bg ;;
    esac

    pt_wait_for_done
    pt_run_guards
    pt_summary
    echo "[OK] ${GROUP:-Parallel} phase complete. The shared pip lock kept the venv consistent; downloads ran concurrently."
}
