# claude_tools

Utilities for working with Claude Code (the CLI) local data.

## extract_claude_history

Extracts Claude Code chat history — **user prompts and the full chat record**
(assistant replies, tool calls, tool results) — from the JSONL transcripts that
Claude Code keeps in the user data directory, and writes plain-text history
files back into that same user data directory.

### Where Claude Code stores data

```
<claude-dir>/projects/<project-slug>/<session-id>.jsonl   full per-session chat record
<claude-dir>/history.jsonl                                global typed-prompt log
```

`<claude-dir>` is `$CLAUDE_CONFIG_DIR` if set, otherwise `~/.claude`.
The `<project-slug>` is the absolute project path with every non-alphanumeric
character replaced by `-` (e.g. `/mnt/dev_nvme0n1p1/programing/core_node`
becomes `-mnt-dev-nvme0n1p1-programing-core-node`).

### Usage

```bash
# Current project (cwd) -> <claude-dir>/history-export/
./extract_claude_history.sh

# Every project Claude has ever seen
./extract_claude_history.sh --all-projects

# Include assistant "thinking" blocks and don't truncate tool IO
./extract_claude_history.sh --thinking --full-tools

# A specific project / output dir
./extract_claude_history.sh --project /path/to/proj --out /tmp/claude-hist
```

The `.py` can be run directly; the `.sh` is just a convenience wrapper.
Stdlib-only (no pip dependencies). Source transcripts are never modified.

### Output (under `<claude-dir>/history-export/`)

| file | contents |
|------|----------|
| `history.txt` | combined human-readable transcript of all sessions, chronological |
| `prompts.txt` | user prompts only (quick to grep / skim) |
| `prompts_global.txt` | typed-prompt log from `history.jsonl` |
| `sessions/<id>.txt` | one transcript per session |
| `index.txt` | session listing (time, id, prompt count, size, title) |

### Options

| flag | meaning |
|------|---------|
| `--project DIR` | project to export (default: cwd) |
| `--all-projects` | export every project |
| `--slug SLUG` | target an explicit project-dir slug |
| `--claude-dir DIR` | Claude user data dir (default `$CLAUDE_CONFIG_DIR` or `~/.claude`) |
| `--out DIR` | output directory (default `<claude-dir>/history-export`) |
| `--thinking` | include assistant thinking blocks |
| `--full-tools` | do not truncate tool IO / thinking |
| `--no-tool-results` | omit tool result bodies |
| `--meta` | include meta/system command lines |
| `--max-tool N` | truncation length for tool IO / thinking (default 2000; 0 = unlimited) |
