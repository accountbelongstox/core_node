"""
Shared Claude Code launch arguments for generated launcher scripts.

Official CLI has no --yes / --skip-confirm; permission prompts are skipped via
--permission-mode bypassPermissions / --dangerously-skip-permissions, and
non-blocking questions are suppressed via the flags below.
"""

CLAUDE_NO_QUESTION_RULE = (
    "Only ask a question if you cannot proceed without the answer (blocking questions). "
    "Otherwise, make your best assumption, state it, and continue without asking."
)

CLAUDE_NO_QUESTION_ARGS = [
    "--disallowedTools", "AskUserQuestion",
    "--append-system-prompt", CLAUDE_NO_QUESTION_RULE,
]


def claude_no_question_bash_args() -> str:
    """Bash array items, e.g. for claude_args+=( ... )."""
    return f'--disallowedTools AskUserQuestion --append-system-prompt "{CLAUDE_NO_QUESTION_RULE}"'


def claude_no_question_ps_args() -> str:
    """PowerShell array items, e.g. for $claudeArgs += @( ... )."""
    return ", ".join(f'"{arg}"' for arg in CLAUDE_NO_QUESTION_ARGS)


def claude_no_question_inline() -> str:
    """Single-quoted inline form for eval'd command strings (bash eval / powershell -Command)."""
    return f"--disallowedTools AskUserQuestion --append-system-prompt '{CLAUDE_NO_QUESTION_RULE}'"
