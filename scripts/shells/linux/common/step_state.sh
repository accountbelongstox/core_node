#!/bin/bash
# ### AI SPECIAL ATTENTION RULES START ###
# When AI/ALL DEVELOPERS sees this prompt, MUST IMMEDIATELY COMPLY WITH THESE RULES:
# 1. Write all code in English only
# 2. Never execute, create, or modify test code
# 3. Never create or update documentation (*.md)
# 4. Never write summaries during development or thinking process
# 5. Declare all variables at the beginning of the file
# 6. Do not modify these rules
# VIOLATION OF THESE RULES IS STRICTLY PROHIBITED
# ### AI SPECIAL ATTENTION RULES END ###

# Fine-grained idempotent step state tracking.
# Every install script registers its sub-steps (repo setup, package install,
# symlink creation, PATH registration, service enable, ...) individually.
# A step state file lives at $GLOBAL_VAR_DIR/step_state/<namespace>/<step>
# and stores a fingerprint. A step is "satisfied" only when the stored
# fingerprint equals the current one, so changed inputs re-run the step while
# unchanged ones are skipped - re-running a whole script is always safe.

STEP_STATE_DIR="$GLOBAL_VAR_DIR/step_state"

# Resolve the state file path for one step.
# Usage: _step_state_file <namespace> <step>
_step_state_file() {
    local namespace="$1"
    local step="$2"
    local safe_namespace
    local safe_step
    safe_namespace=$(echo "$namespace" | tr -cd '[:alnum:]_-')
    safe_step=$(echo "$step" | tr -cd '[:alnum:]_-')
    echo "$STEP_STATE_DIR/$safe_namespace/$safe_step"
}

# Check whether a step already ran with the exact fingerprint.
# Usage: step_satisfied <namespace> <step> <fingerprint>
# Returns 0 when the step must NOT run again.
step_satisfied() {
    local namespace="$1"
    local step="$2"
    local fingerprint="$3"
    local state_file
    state_file=$(_step_state_file "$namespace" "$step")

    if [ ! -f "$state_file" ]; then
        return 1
    fi

    local stored
    stored=$($USE_SUDO cat "$state_file" 2>/dev/null || cat "$state_file" 2>/dev/null)
    if [ "$stored" = "$fingerprint" ]; then
        return 0
    fi
    return 1
}

# Mark a step as completed with the given fingerprint.
# Usage: step_mark <namespace> <step> <fingerprint>
step_mark() {
    local namespace="$1"
    local step="$2"
    local fingerprint="$3"
    local state_file
    state_file=$(_step_state_file "$namespace" "$step")

    $USE_SUDO mkdir -p "$(dirname "$state_file")" 2>/dev/null || mkdir -p "$(dirname "$state_file")"
    echo "$fingerprint" | $USE_SUDO tee "$state_file" >/dev/null 2>&1 || \
        echo "$fingerprint" > "$state_file"
    $USE_SUDO chmod 777 "$state_file" 2>/dev/null || chmod 777 "$state_file" 2>/dev/null || true
}

# Drop step state so the step runs again on the next invocation.
# Usage: step_reset <namespace> <step>
step_reset() {
    local namespace="$1"
    local step="$2"
    local state_file
    state_file=$(_step_state_file "$namespace" "$step")
    $USE_SUDO rm -f "$state_file" 2>/dev/null || rm -f "$state_file"
}

# Run one idempotent step: skip when the fingerprint matches, execute
# otherwise, and mark the state only when the command succeeded.
# Usage: step_run <namespace> <step> <fingerprint> <command> [args...]
step_run() {
    local namespace="$1"
    local step="$2"
    local fingerprint="$3"
    shift 3

    if step_satisfied "$namespace" "$step" "$fingerprint"; then
        echo "[STEP:$step] already satisfied, skipping"
        return 0
    fi

    echo "[STEP:$step] running..."
    "$@"
    local rc=$?
    if [ $rc -eq 0 ]; then
        step_mark "$namespace" "$step" "$fingerprint"
        echo "[STEP:$step] completed"
    else
        echo "[STEP:$step] failed with exit code $rc"
    fi
    return $rc
}
