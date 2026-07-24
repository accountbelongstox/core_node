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
feature_list_output=""
feature_line=""
feature_name=""
feature_line_regex='^([^[:space:]]+)[[:space:]]{2,}(stable|experimental|under[[:space:]]development)[[:space:]]{2,}(true|false)[[:space:]]*$'
model="gpt-5.6-sol"
reasoning_effort="high"
rollout_budget_limit_tokens="${CODEX_ROLLOUT_BUDGET_TOKENS:-100000}"
enabled_features=()
codex_args=()

if [[ ! "$rollout_budget_limit_tokens" =~ ^[1-9][0-9]*$ ]]; then
    rollout_budget_limit_tokens="100000"
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
    --config "features.rollout_budget.limit_tokens=$rollout_budget_limit_tokens"
)

echo ""
echo "============================================================"
echo "codexyolo.sh"
echo "============================================================"

read -r -p "Upgrade Codex CLI via 'pnpm add --global @openai/codex@latest'? [y/N]: " upgrade_choice || upgrade_choice=""
if [ "$upgrade_choice" = "y" ] || [ "$upgrade_choice" = "Y" ]; then
    if ! command -v pnpm >/dev/null 2>&1; then
        echo "[WARN] pnpm is unavailable; keeping the installed Codex CLI."
    else
        echo "[INFO] Upgrading Codex CLI with pnpm..."
        pnpm add --global @openai/codex@latest
        hash -r
        echo "[INFO] Codex CLI upgrade command completed."
    fi
else
    echo "[INFO] Codex CLI upgrade skipped (default N)."
fi

if ! command -v codex >/dev/null 2>&1; then
    echo "[ERROR] codex is not available on PATH."
fi

feature_list_output="$(codex features list 2>/dev/null)"
if [ -n "$feature_list_output" ]; then
    while IFS= read -r feature_line; do
        if [[ "$feature_line" =~ $feature_line_regex ]]; then
            feature_name="${BASH_REMATCH[1]}"
            case "$feature_name" in
                code_mode_only)
                    continue
                    ;;
                shell_zsh_fork|unified_exec_zsh_fork)
                    if ! command -v zsh >/dev/null 2>&1; then
                        continue
                    fi
                    ;;
            esac
            enabled_features+=("$feature_name")
            codex_args+=(--enable "$feature_name")
        fi
    done <<< "$feature_list_output"
else
    echo "[WARN] Feature discovery is unavailable; upgrade Codex to enable all active feature flags."
fi

echo "[INFO] Model: $model ($reasoning_effort)"
echo "[INFO] YOLO: ON; live search: ON; hook trust bypass: ON"
echo "[INFO] Active features enabled: ${#enabled_features[@]}; extra args: $#"
echo "============================================================"
echo ""

exec codex "${codex_args[@]}" "$@"
