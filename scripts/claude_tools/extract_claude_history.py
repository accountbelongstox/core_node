#!/usr/bin/env python3
"""Extract Claude Code chat history into readable "history text" files.

Claude Code (the CLI) stores conversations as JSONL transcripts under the user
data directory:

    <claude-dir>/projects/<project-slug>/<session-id>.jsonl   # full chat record
    <claude-dir>/history.jsonl                                # global typed-prompt log

This tool reads those transcripts and writes plain-text history into the user
data directory (default: <claude-dir>/history-export):

    history.txt              combined human-readable transcript (all sessions, chronological)
    prompts.txt              user prompts only (quick to grep / skim)
    sessions/<id>.txt        one transcript per session
    index.txt                session listing with timestamps and sizes

It is stdlib-only (no pip deps) and never modifies the source transcripts.

Usage:
    extract_claude_history.py                 # current project (cwd), default output
    extract_claude_history.py --all-projects  # every project Claude has seen
    extract_claude_history.py --project /path/to/proj --thinking --full-tools
    extract_claude_history.py --out /some/dir --claude-dir ~/.claude
"""
from __future__ import annotations

import argparse
import json
import os
import re
import sys
from datetime import datetime, timezone

# ----------------------------------------------------------------------------- helpers


def claude_dir(explicit: str | None) -> str:
    """Resolve the Claude Code user data directory."""
    if explicit:
        return os.path.abspath(os.path.expanduser(explicit))
    env = os.environ.get("CLAUDE_CONFIG_DIR")
    if env:
        return os.path.abspath(os.path.expanduser(env))
    return os.path.join(os.path.expanduser("~"), ".claude")


def slug_for(path: str) -> str:
    """Reproduce Claude Code's project-dir slug: every non-alphanumeric -> '-'."""
    return re.sub(r"[^a-zA-Z0-9]", "-", os.path.abspath(os.path.expanduser(path)))


def fmt_ts(ts) -> str:
    """Format an ISO-8601 string or epoch (s/ms) timestamp to local time."""
    if ts is None:
        return ""
    try:
        if isinstance(ts, (int, float)):
            secs = ts / 1000.0 if ts > 1e12 else float(ts)
            return datetime.fromtimestamp(secs).strftime("%Y-%m-%d %H:%M:%S")
        s = str(ts).replace("Z", "+00:00")
        dt = datetime.fromisoformat(s)
        if dt.tzinfo:
            dt = dt.astimezone()
        return dt.strftime("%Y-%m-%d %H:%M:%S")
    except Exception:
        return str(ts)


def truncate(text: str, limit: int) -> str:
    if limit <= 0 or len(text) <= limit:
        return text
    return text[:limit] + f"\n        ... [truncated {len(text) - limit} chars]"


def load_jsonl(path: str):
    """Yield parsed objects from a JSONL file, skipping unparsable lines."""
    with open(path, "r", encoding="utf-8", errors="replace") as fh:
        for line in fh:
            line = line.strip()
            if not line:
                continue
            try:
                yield json.loads(line)
            except json.JSONDecodeError:
                continue


# ----------------------------------------------------------------------------- rendering


def stringify_content(content) -> str:
    """Flatten a tool_result/user content value (str or list of blocks) to text."""
    if isinstance(content, str):
        return content
    if isinstance(content, list):
        parts = []
        for b in content:
            if isinstance(b, dict):
                if b.get("type") == "text":
                    parts.append(b.get("text", ""))
                elif b.get("type") == "image":
                    parts.append("[image]")
                else:
                    parts.append(b.get("text", json.dumps(b)[:200]))
            else:
                parts.append(str(b))
        return "\n".join(parts)
    return json.dumps(content)


def classify_user(entry: dict):
    """Return ('prompt'|'tool_result'|'meta', rendered_text) for a user entry."""
    content = entry.get("message", {}).get("content")
    if isinstance(content, list):
        chunks = []
        is_tool_result = False
        for b in content:
            if not isinstance(b, dict):
                chunks.append(str(b))
                continue
            if b.get("type") == "tool_result":
                is_tool_result = True
                chunks.append(stringify_content(b.get("content")))
            elif b.get("type") == "text":
                chunks.append(b.get("text", ""))
            elif b.get("type") == "image":
                chunks.append("[image]")
        kind = "tool_result" if is_tool_result else "prompt"
        return kind, "\n".join(c for c in chunks if c)
    text = content if isinstance(content, str) else stringify_content(content)
    # System-injected command echoes / reminders are meta, not real typed prompts.
    if re.match(r"\s*<(command-name|command-message|local-command|bash-input)", text):
        return "meta", text
    return "prompt", text


def render_session(entries: list, opts) -> tuple[str, list, dict]:
    """Render one session's transcript. Returns (text, prompt_list, meta)."""
    out = []
    prompts = []
    meta = {"session": "", "project": "", "branch": "", "version": "",
            "models": set(), "first_ts": None, "last_ts": None, "title": ""}

    for e in entries:
        t = e.get("type")
        ts = e.get("timestamp")
        if ts:
            meta["last_ts"] = ts
            if meta["first_ts"] is None:
                meta["first_ts"] = ts
        meta["session"] = meta["session"] or e.get("sessionId", "")
        meta["project"] = meta["project"] or e.get("cwd", "")
        meta["branch"] = meta["branch"] or e.get("gitBranch", "")
        meta["version"] = meta["version"] or e.get("version", "")

        if t == "ai-title":
            meta["title"] = e.get("title") or e.get("message", "") or meta["title"]
            continue
        if t == "user":
            side = " (subagent)" if e.get("isSidechain") else ""
            kind, text = classify_user(e)
            text = text.strip()
            if not text:
                continue
            if kind == "prompt":
                prompts.append(text)
                out.append(f"\n[{fmt_ts(ts)}] USER{side}:\n{text}")
            elif kind == "tool_result" and opts.tool_results:
                out.append(f"\n[{fmt_ts(ts)}]   <- tool result:\n"
                           + truncate(text, opts.max_tool))
            elif kind == "meta" and opts.meta:
                out.append(f"\n[{fmt_ts(ts)}] (meta): {truncate(text, 400)}")
        elif t == "assistant":
            msg = e.get("message", {})
            if msg.get("model"):
                meta["models"].add(msg["model"])
            side = " (subagent)" if e.get("isSidechain") else ""
            content = msg.get("content", [])
            if isinstance(content, str):
                content = [{"type": "text", "text": content}]
            for b in content:
                if not isinstance(b, dict):
                    continue
                bt = b.get("type")
                if bt == "text" and b.get("text", "").strip():
                    out.append(f"\n[{fmt_ts(ts)}] ASSISTANT{side}:\n{b['text'].rstrip()}")
                elif bt == "thinking" and opts.thinking and b.get("thinking", "").strip():
                    out.append(f"\n[{fmt_ts(ts)}] ASSISTANT{side} (thinking):\n"
                               + truncate(b["thinking"].rstrip(), opts.max_tool))
                elif bt == "tool_use":
                    inp = json.dumps(b.get("input", {}), ensure_ascii=False)
                    out.append(f"\n[{fmt_ts(ts)}]   -> tool: {b.get('name', '?')}  "
                               + truncate(inp, opts.max_tool))
        elif t == "system" and opts.meta:
            txt = e.get("content") or e.get("message", "")
            if isinstance(txt, str) and txt.strip():
                out.append(f"\n[{fmt_ts(ts)}] (system): {truncate(txt.strip(), 400)}")

    header = [
        "=" * 78,
        f"SESSION : {meta['session']}",
        f"TITLE   : {meta['title']}" if meta["title"] else "",
        f"PROJECT : {meta['project']}",
        f"BRANCH  : {meta['branch']}",
        f"VERSION : {meta['version']}",
        f"MODELS  : {', '.join(sorted(meta['models']))}" if meta["models"] else "",
        f"STARTED : {fmt_ts(meta['first_ts'])}",
        f"ENDED   : {fmt_ts(meta['last_ts'])}",
        f"PROMPTS : {len(prompts)}",
        "=" * 78,
    ]
    text = "\n".join(h for h in header if h) + "\n" + "\n".join(out) + "\n"
    return text, prompts, meta


# ----------------------------------------------------------------------------- main


def collect_sessions(projects_dir: str, slugs):
    """Return {slug: [jsonl paths]} for the requested slugs (or all)."""
    result = {}
    if not os.path.isdir(projects_dir):
        return result
    for slug in sorted(os.listdir(projects_dir)):
        pdir = os.path.join(projects_dir, slug)
        if not os.path.isdir(pdir):
            continue
        if slugs and slug not in slugs:
            continue
        files = [os.path.join(pdir, f) for f in os.listdir(pdir) if f.endswith(".jsonl")]
        if files:
            result[slug] = sorted(files, key=lambda p: os.path.getmtime(p))
    return result


def export_global_prompts(cdir: str, out_dir: str, slugs) -> int:
    """Write the global typed-prompt log (history.jsonl) to prompts_global.txt."""
    src = os.path.join(cdir, "history.jsonl")
    if not os.path.isfile(src):
        return 0
    rows = []
    for d in load_jsonl(src):
        proj = d.get("project", "")
        if slugs and slug_for(proj) not in slugs:
            continue
        rows.append((d.get("timestamp"), proj, d.get("display", "")))
    if not rows:
        return 0
    rows.sort(key=lambda r: r[0] or 0)
    dst = os.path.join(out_dir, "prompts_global.txt")
    with open(dst, "w", encoding="utf-8") as fh:
        fh.write("# Global typed-prompt history (from history.jsonl)\n\n")
        for ts, proj, disp in rows:
            fh.write(f"[{fmt_ts(ts)}] ({proj})\n{disp.strip()}\n\n")
    return len(rows)


def main(argv=None):
    ap = argparse.ArgumentParser(description="Extract Claude Code chat history to text.")
    ap.add_argument("--project", default=os.getcwd(),
                    help="project directory to export (default: cwd)")
    ap.add_argument("--all-projects", action="store_true",
                    help="export every project, not just --project")
    ap.add_argument("--slug", help="explicit project-dir slug (overrides --project)")
    ap.add_argument("--claude-dir", help="Claude user data dir (default: $CLAUDE_CONFIG_DIR or ~/.claude)")
    ap.add_argument("--out", help="output directory (default: <claude-dir>/history-export)")
    ap.add_argument("--thinking", action="store_true", help="include assistant thinking blocks")
    ap.add_argument("--full-tools", action="store_true", help="do not truncate tool IO / thinking")
    ap.add_argument("--no-tool-results", dest="tool_results", action="store_false",
                    help="omit tool result bodies from the transcript")
    ap.add_argument("--meta", action="store_true", help="include meta/system command lines")
    ap.add_argument("--max-tool", type=int, default=2000,
                    help="truncation length for tool IO / thinking (default 2000; 0 = unlimited)")
    opts = ap.parse_args(argv)
    if opts.full_tools:
        opts.max_tool = 0

    cdir = claude_dir(opts.claude_dir)
    projects_dir = os.path.join(cdir, "projects")
    out_dir = os.path.abspath(os.path.expanduser(opts.out)) if opts.out \
        else os.path.join(cdir, "history-export")

    if opts.all_projects:
        slugs = None
    elif opts.slug:
        slugs = {opts.slug}
    else:
        slugs = {slug_for(opts.project)}

    sessions = collect_sessions(projects_dir, slugs)
    if not sessions:
        print(f"No transcripts found under {projects_dir}", file=sys.stderr)
        if slugs:
            print(f"  (looked for slug(s): {', '.join(slugs)})", file=sys.stderr)
            print("  try --all-projects to list everything", file=sys.stderr)
        return 1

    os.makedirs(out_dir, exist_ok=True)
    sess_dir = os.path.join(out_dir, "sessions")
    os.makedirs(sess_dir, exist_ok=True)

    combined, all_prompts, index = [], [], []
    total_sessions = 0
    for slug, files in sessions.items():
        for path in files:
            entries = list(load_jsonl(path))
            if not entries:
                continue
            text, prompts, meta = render_session(entries, opts)
            sid = meta["session"] or os.path.splitext(os.path.basename(path))[0]
            with open(os.path.join(sess_dir, f"{sid}.txt"), "w", encoding="utf-8") as fh:
                fh.write(text)
            combined.append((meta["first_ts"], text))
            for p in prompts:
                all_prompts.append((meta["first_ts"], sid, p))
            index.append((meta["first_ts"], sid, slug, meta["title"],
                          len(prompts), os.path.getsize(path)))
            total_sessions += 1

    combined.sort(key=lambda r: str(r[0]))
    with open(os.path.join(out_dir, "history.txt"), "w", encoding="utf-8") as fh:
        fh.write(f"# Claude Code chat history  (generated {fmt_ts(datetime.now(timezone.utc).isoformat())})\n")
        fh.write(f"# source: {projects_dir}\n# sessions: {total_sessions}\n\n")
        fh.write("\n\n".join(t for _, t in combined))

    all_prompts.sort(key=lambda r: str(r[0]))
    with open(os.path.join(out_dir, "prompts.txt"), "w", encoding="utf-8") as fh:
        fh.write("# User prompts (chronological)\n\n")
        for ts, sid, p in all_prompts:
            fh.write(f"[{fmt_ts(ts)}] {sid}\n{p.strip()}\n\n")

    index.sort(key=lambda r: str(r[0]))
    with open(os.path.join(out_dir, "index.txt"), "w", encoding="utf-8") as fh:
        fh.write("# Session index\n\n")
        for ts, sid, slug, title, npr, size in index:
            fh.write(f"{fmt_ts(ts)}  {sid}  prompts={npr:<4} size={size:>9}  "
                     f"{title or slug}\n")

    nglobal = export_global_prompts(cdir, out_dir, slugs)

    print(f"Exported {total_sessions} session(s) -> {out_dir}")
    print(f"  history.txt        ({len(combined)} sessions, full transcript)")
    print(f"  prompts.txt        ({len(all_prompts)} user prompts)")
    print(f"  sessions/*.txt     (per-session)")
    print(f"  index.txt          (session listing)")
    if nglobal:
        print(f"  prompts_global.txt ({nglobal} entries from history.jsonl)")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
