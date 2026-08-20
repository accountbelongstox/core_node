#!/bin/bash
# ### AI SPECIAL ATTENTION RULES START ###
# When AI/ALL DEVELOPERS sees this prompt, MUST IMMEDIATELY COMPLY WITH THESE RULES:
# 1. Write all code in English only.
# 2. Never execute, create, or modify test code.
# 3. Never create or update documentation (*.md).
# 4. Never write summaries during development or thinking process.
# 5. Declare all variables at the beginning of the file.
# 6. For PowerShell (*.ps1) scripts: Do not append strings directly to variables, Do not use relative paths such as "..\..\"; instead resolve absolute paths using parent path parsing (Split-Path, Join-Path, or Resolve-Path).
# 7. Do not modify these rules.
# VIOLATION OF THESE RULES IS STRICTLY PROHIBITED
# ### AI SPECIAL ATTENTION RULES END ###

upgrade_choice=""
current_version_output=""
latest_version_output=""
version_gap_large="0"
script_dir_path=""
script_source_path=""
scripts_dir_path=""
core_node_path=""
mcp_chrome_path=""
mcp_chrome_node_modules_path=""
mcp_chrome_shared_artifact_path=""
mcp_chrome_native_artifact_path=""
mcp_chrome_extension_manifest_path=""
mcp_chrome_register_script_path=""
mcp_chrome_supervisor_script_path=""
mcp_chrome_dev_log_path=""
mcp_chrome_linux_common_dir=""
mcp_chrome_gvar_common_path=""
mcp_chrome_venv_python_common_path=""
mcp_chrome_python_path=""
mcp_chrome_url="http://127.0.0.1:12306/mcp"
mcp_chrome_port="12306"
mcp_chrome_port_ready=0
mcp_chrome_port_wait_count=0
mcp_chrome_needs_build=0
mcp_chrome_enabled=0
model="gpt-5.6-sol"
reasoning_effort="high"
codex_args=()
resume_requested=0
resume_argument=""
codex_home_path=""
thread_writer_locks_path=""
thread_writer_lock_count=0

script_source_path="${BASH_SOURCE[0]}"
if [ -L "$script_source_path" ]; then
    script_source_path="$(readlink -f "$script_source_path" 2>/dev/null || echo "$script_source_path")"
fi
script_dir_path="$(cd "$(dirname "$script_source_path")" && pwd)"
scripts_dir_path="$(dirname "$script_dir_path")"
core_node_path="$(dirname "$scripts_dir_path")"
mcp_chrome_path="$core_node_path/apps/mcp-chrome"
mcp_chrome_node_modules_path="$mcp_chrome_path/node_modules"
mcp_chrome_shared_artifact_path="$mcp_chrome_path/packages/shared/dist/index.js"
mcp_chrome_native_artifact_path="$mcp_chrome_path/app/native-server/dist/index.js"
mcp_chrome_extension_manifest_path="$mcp_chrome_path/.output/build_extension/manifest.json"
mcp_chrome_register_script_path="$mcp_chrome_path/scripts/register-local-dev.cjs"
mcp_chrome_supervisor_script_path="$mcp_chrome_path/scripts/service_supervisor.py"
mcp_chrome_dev_log_path="/tmp/mcp-chrome-codexyolo.log"
mcp_chrome_linux_common_dir="$core_node_path/scripts/shells/linux/common"
mcp_chrome_gvar_common_path="$mcp_chrome_linux_common_dir/gvar_common.sh"
mcp_chrome_venv_python_common_path="$mcp_chrome_linux_common_dir/venv_python_common.sh"
source "$mcp_chrome_gvar_common_path"
source "$mcp_chrome_venv_python_common_path"
mcp_chrome_python_path="$VENV_PYTHON3"
if [ "${HAS_DESKTOP_ENVIRONMENT:-false}" = "true" ]; then
    mcp_chrome_enabled=1
fi

codex_args=(
    --yolo
    --dangerously-bypass-hook-trust
    --search
    --model "$model"
    --config "model_reasoning_effort=\"$reasoning_effort\""
    --config "plan_mode_reasoning_effort=\"$reasoning_effort\""
    --config "agents.default_subagent_model=\"$model\""
    --config "agents.default_subagent_reasoning_effort=\"$reasoning_effort\""
)

for resume_argument in "$@"; do
    if [ "$resume_argument" = "resume" ] || [ "$resume_argument" = "--resume" ]; then
        resume_requested=1
        break
    fi
done
if [ "$resume_requested" -eq 1 ]; then
    codex_home_path="${CODEX_HOME:-$HOME/.codex}"
    thread_writer_locks_path="$codex_home_path/thread-writer-locks"
    if [ -d "$thread_writer_locks_path" ]; then
        while IFS= read -r -d '' resume_argument; do
            rm -f -- "$resume_argument"
            thread_writer_lock_count=$((thread_writer_lock_count + 1))
        done < <(find "$thread_writer_locks_path" -maxdepth 1 -type f -name '*.lock' ! -name '.coordination.lock' -print0)
        if [ "$thread_writer_lock_count" -gt 0 ]; then
            echo "[INFO] Cleared $thread_writer_lock_count Codex thread writer lock file(s) before resume."
        fi
    fi
fi

echo ""
echo "============================================================"
echo "codexyolo.sh"
echo "============================================================"

if ! command -v codex >/dev/null 2>&1; then
    echo "[ERROR] codex is not available on PATH."
    exit 1
fi
if command -v node >/dev/null 2>&1 && command -v pnpm >/dev/null 2>&1; then
    current_version_output="$(codex --version 2>/dev/null || true)"
    latest_version_output="$(pnpm view @openai/codex version 2>/dev/null || true)"
    version_gap_large="$(node -e '
const currentInput = process.argv[1];
const latestInput = process.argv[2];
const parseVersion = (value) => {
    const tokens = value.trim().split(/\s+/);
    for (const token of tokens) {
        const candidate = token.startsWith("v") ? token.slice(1) : token;
        const parts = candidate.split(".");
        const valid = parts.length === 3 && parts.every((part) => part.length > 0 && [...part].every((character) => character >= "0" && character <= "9"));
        if (valid) {
            return parts.map(Number);
        }
    }
    return null;
};
const current = parseVersion(currentInput);
const latest = parseVersion(latestInput);
const newer = current !== null && latest !== null && (latest[0] > current[0] || (latest[0] === current[0] && (latest[1] > current[1] || (latest[1] === current[1] && latest[2] > current[2]))));
const large = newer && (latest[0] > current[0] || latest[1] > current[1]);
process.stdout.write(large ? "1" : "0");
' "$current_version_output" "$latest_version_output" 2>/dev/null || true)"
fi
if [ "$version_gap_large" = "1" ]; then
    printf '\033[33mUpgrade Codex CLI via '\''pnpm add --global @openai/codex@latest'\''? [N/y]: \033[0m'
    read -r upgrade_choice || upgrade_choice=""
fi
if [ "$upgrade_choice" = "y" ] || [ "$upgrade_choice" = "Y" ]; then
    echo "[INFO] Upgrading Codex CLI with pnpm..."
    pnpm add --global @openai/codex@latest
    hash -r
    echo "[INFO] Codex CLI upgrade command completed."
elif [ "$version_gap_large" = "1" ]; then
    echo "[INFO] Codex CLI upgrade skipped."
fi

if [ "$mcp_chrome_enabled" -eq 1 ]; then
if [ ! -f "$mcp_chrome_shared_artifact_path" ] ||
    [ ! -f "$mcp_chrome_native_artifact_path" ] ||
    [ ! -f "$mcp_chrome_extension_manifest_path" ]; then
    mcp_chrome_needs_build=1
fi

if ! command -v node >/dev/null 2>&1; then
    echo "[ERROR] node is required to install Chrome MCP."
    exit 1
fi
if { [ ! -d "$mcp_chrome_node_modules_path" ] || [ "$mcp_chrome_needs_build" -eq 1 ]; } &&
    ! command -v pnpm >/dev/null 2>&1; then
    echo "[ERROR] pnpm is required to install Chrome MCP."
    exit 1
fi

echo "[INFO] Ensuring Chrome MCP is installed..."
if [ ! -d "$mcp_chrome_node_modules_path" ]; then
    echo "[INFO] Installing Chrome MCP dependencies..."
    (
        cd "$mcp_chrome_path"
        pnpm install
    )
fi
if [ "$mcp_chrome_needs_build" -eq 1 ]; then
    echo "[INFO] Building missing Chrome MCP artifacts..."
    (
        cd "$mcp_chrome_path"
        pnpm run build:all
    )
fi
(
    cd "$mcp_chrome_path"
    node "$mcp_chrome_register_script_path"
)

codex mcp add chrome --url "$mcp_chrome_url"
echo "[INFO] Chrome MCP registered in Codex."

echo "[INFO] Ensuring the singleton Chrome MCP supervisor is running..."
if [ "$mcp_chrome_needs_build" -eq 1 ] || [ "$mcp_chrome_port_ready" -eq 0 ]; then
    "$mcp_chrome_python_path" "$mcp_chrome_supervisor_script_path" --project-root "$mcp_chrome_path" --watch-mode dev --recover-on-start >"$mcp_chrome_dev_log_path" 2>&1 &
else
    "$mcp_chrome_python_path" "$mcp_chrome_supervisor_script_path" --project-root "$mcp_chrome_path" --watch-mode dev >"$mcp_chrome_dev_log_path" 2>&1 &
fi
while [ "$mcp_chrome_port_ready" -eq 0 ] && [ "$mcp_chrome_port_wait_count" -lt 60 ]; do
    sleep 0.5
    if (echo >"/dev/tcp/127.0.0.1/$mcp_chrome_port") >/dev/null 2>&1; then
        mcp_chrome_port_ready=1
    fi
    mcp_chrome_port_wait_count=$((mcp_chrome_port_wait_count + 1))
done
if [ "$mcp_chrome_port_ready" -eq 1 ]; then
    echo "[INFO] Chrome MCP is listening on 127.0.0.1:$mcp_chrome_port."
else
    echo "[WARN] Chrome MCP did not become ready; reload the unpacked extension once."
fi
else
    echo "[INFO] No desktop environment; skipping Chrome MCP setup (no install, no build, no registration)."
fi

echo "[INFO] Model: $model ($reasoning_effort)"
echo "[INFO] YOLO: ON; live search: ON; hook trust bypass: ON"
echo "[INFO] Codex feature defaults preserved; extra args: $#"
echo "============================================================"
echo ""

exec codex "${codex_args[@]}" "$@"
