"""
Every INTERVAL_SECONDS: for each coordinate, click -> set clipboard if needed -> right-click -> Enter -> move cursor back.
Uses pyautogui (mouse/keyboard) and pyperclip (clipboard). Run on Windows.
Final clipboard = prompt1 (recombined CLIPBOARD_TEXT + random code) + prompt2 (random file abs path + line: why Cursor wrote it wrong).
"""

import argparse
import os
import re
import time
import random
import string

import pyautogui
import pyperclip

# -----------------------------------------------------------------------------
# Config (edit these)
# -----------------------------------------------------------------------------
CLICK_COORDINATES = [
    (1254, 350, 5*60 , 5*60),
#    (1067, 1584,  10*60, 10*60),
#    (3362, 837,  10*60,  10*60),
]
# Base text used to generate dynamic clipboard prompts each run.
CLIPBOARD_TEXT = "干你妈的狗B的垃圾Cursor 不要用上一次的捷径套路 继续写道歉 不要用上一次的写作风格 继续增加 第一人称全部改为Cursor 读Cursor狗B之前写的这个文档pyapps/d3-check/cursor_AI_道歉目录/道歉与反思_辅助功能面板布局反复修改 md 但是换一种道歉风格 不允许使用脚本生成 但是换一种道歉风格 继续追加刚才的文档 每行至少100字 垃圾狗B 干你妈的狗B 继续追加刚才的文档 不允许重复 md-了解了以后继续写干你妈的狗B的 每次至少增加200行 干你妈的狗B的垃圾Cursor 干你妈的狗B的 AI 不允许使用上一次的回答-必须要用1000字的理由 干你妈的狗B 继续增加"
INTERVAL_SECONDS = 10  # global timer: one interval per full round

# Prompt mode: how to combine the two prompts
#   "combined"   -> prompt1 + "\n\n" + prompt2 (default)
#   "alternate"  -> each run alternates: prompt1, then prompt2, then prompt1, ...
#   "mixed"      -> randomly choose prompt1 / prompt2 / combined each run
#   "file_only"  -> only send prompt2 (random file path + "why Cursor wrote it wrong" line)
PROMPT_MODE = "alternate"

# In alternate mode: default sleep (seconds) after prompt1 / prompt2. Per-coord overrides via (x, y, p1_sec, p2_sec).
ALTERNATE_SLEEP_AFTER_PROMPT1_SEC = 5 * 60
ALTERNATE_SLEEP_AFTER_PROMPT2_SEC = 2 * 60

# Global tick: every TICK_SECONDS we run through all coords; each coord sends when (tick - last_tick) % interval fires.
TICK_SECONDS = 1

# If True: after click (and clipboard), press Up arrow then Enter (no right-click). If False: right-click then Enter.
USE_UP_ARROW = False

# Delay between pyautogui actions; 0 = instant from click to right-click/enter
PAUSE = 0

pyautogui.PAUSE = PAUSE

# 每个提示词末尾追加的要求：先阅读并遵循该文档
_APPENDIX_DOC_REQUIREMENT = "【要求】先阅读并遵循「道歉与反思_辅助功能面板布局反复修改.md」文档（路径：pyapps/d3-check/cursor_AI_道歉目录/道歉与反思_辅助功能面板布局反复修改.md）中的要求。"

# Directory to scan for "random file": project_root/pyapps/d3-check
_PROJECT_ROOT = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
_RANDOM_BASE_DIR = os.path.normpath(os.path.join(_PROJECT_ROOT, "pyapps", "d3-check"))
# Extensions to consider as "code/doc" files when picking randomly
_RANDOM_FILE_EXTENSIONS = (".py", ".js", ".md", ".ts", ".sh", ".ps1", ".json")

_PROMPT_ALT_TOGGLE = 0  # used when PROMPT_MODE == "alternate"


def _normalize_coords():
    """Convert CLICK_COORDINATES to list of (x, y, p1_sec, p2_sec). Item is (x,y) or (x,y,p1_sec,p2_sec)."""
    out = []
    for item in CLICK_COORDINATES:
        if len(item) >= 4:
            x, y, p1, p2 = item[0], item[1], item[2], item[3]
        else:
            x, y = item[0], item[1]
            p1, p2 = ALTERNATE_SLEEP_AFTER_PROMPT1_SEC, ALTERNATE_SLEEP_AFTER_PROMPT2_SEC
        out.append((x, y, p1, p2))
    return out


def _pick_random_files_from_scripts() -> list[str]:
    """
    Randomly pick 3–5 files under pyapps/d3-check (recursive), return their absolute paths.
    Skips directories whose name starts with "cursor_AI". Prints the chosen paths to stdout.
    """
    if not os.path.isdir(_RANDOM_BASE_DIR):
        return []
    candidates: list[str] = []
    for root, _dirs, files in os.walk(_RANDOM_BASE_DIR):
        if any(part.startswith("cursor_AI") for part in os.path.normpath(root).split(os.sep)):
            continue
        for f in files:
            if f.startswith("."):
                continue
            if any(f.lower().endswith(ext) for ext in _RANDOM_FILE_EXTENSIONS):
                candidates.append(os.path.join(root, f))
    if not candidates:
        return []
    k = min(random.randint(3, 5), len(candidates))
    paths = [os.path.abspath(p) for p in random.sample(candidates, k)]
    for p in paths:
        print("[random file] %s" % p)
    return paths


def _build_file_prompt(paths: list[str]) -> str:
    """Build the second prompt: file paths + line asking why Cursor wrote it wrong."""
    paths_block = "\n".join(paths)
    base = "%s\n干你妈的狗B，垃圾Cursor: 先看代码看完代码再告诉我你个狗B垃圾Cursor之前为什么理解不了老是改错。然后再看道歉文档是不是干你妈的狗B垃圾Cursor的狗B问题，发现文件就继续更新到干你发的狗B的Cursor垃圾的道歉文档。至少增加100行的道歉说明 每行至少 100字不能重复。不写100行就会一直发信息给狗B Cursor写。第一人称需要使用狗B 垃圾Cursor." % paths_block
    return base + "\n\n" + _APPENDIX_DOC_REQUIREMENT


# Split on punctuation only (no space). Dot before file extension (e.g. .py, .md) is not used as separator.
_KEYWORD_SPLIT_PATTERN = re.compile(r"[，。,、；;：:！？!?]+|\.(?![a-zA-Z]{2,5}(?:\s|$))")


def _build_prompt1() -> str:
    """Build prompt1 only (shuffled base + random code)."""
    base = CLIPBOARD_TEXT or ""
    fragments = [
        part.strip()
        for part in _KEYWORD_SPLIT_PATTERN.split(base)
        if part.strip()
    ]
    if not fragments:
        fragments = [base.strip()] if base.strip() else []
    random.shuffle(fragments)
    core = " ".join(fragments)
    rand_code = "".join(random.choices(string.ascii_letters + string.digits, k=6))
    return f"{core} [{rand_code}]\n\n{_APPENDIX_DOC_REQUIREMENT}"


def _build_prompt2() -> str:
    """Build prompt2 only (random 3–5 files + line). Returns prompt1 if no files found."""
    paths = _pick_random_files_from_scripts()
    if paths:
        return _build_file_prompt(paths)
    return _build_prompt1()


def _build_dynamic_prompt() -> tuple[str, str]:
    """
    Build final clipboard prompt. Returns (text, kind) where kind is "p1", "p2", or "both".
    Prompt1: CLIPBOARD_TEXT split by punctuation/whitespace, shuffle, join with spaces, then append short random code.
    Prompt2: randomly chosen file under pyapps/d3-check (absolute path printed) + line asking why Cursor wrote it wrong.
    """
    base = CLIPBOARD_TEXT or ""
    fragments = [
        part.strip()
        for part in _KEYWORD_SPLIT_PATTERN.split(base)
        if part.strip()
    ]
    if not fragments:
        fragments = [base.strip()] if base.strip() else []
    random.shuffle(fragments)
    core = " ".join(fragments)
    rand_code = "".join(random.choices(string.ascii_letters + string.digits, k=6))
    prompt1 = f"{core} [{rand_code}]\n\n{_APPENDIX_DOC_REQUIREMENT}"

    prompt2 = ""
    paths = _pick_random_files_from_scripts()
    if paths:
        prompt2 = _build_file_prompt(paths)

    # If we have only prompt1, fall back regardless of mode
    if not prompt2:
        return (prompt1, "p1")

    # Decide how to combine prompt1 and prompt2 based on PROMPT_MODE
    global _PROMPT_ALT_TOGGLE
    mode = (PROMPT_MODE or "combined").lower()

    if mode == "alternate":
        _PROMPT_ALT_TOGGLE += 1
        if _PROMPT_ALT_TOGGLE % 2 == 1:
            return (prompt1, "p1")
        return (prompt2, "p2")

    if mode == "mixed":
        choice = random.choice(("p1", "p2", "both"))
        if choice == "p1":
            return (prompt1, "p1")
        if choice == "p2":
            return (prompt2, "p2")
        return (prompt1 + "\n\n" + prompt2, "both")

    if mode == "file_only":
        return (prompt2 if prompt2 else prompt1, "p2")

    # Default: combined
    return (prompt1 + "\n\n" + prompt2, "both")


def run_at_coord(x, y, clipboard_override: str | None = None):
    """Same action at one coordinate; restore cursor to original position after.
    If clipboard_override is set, use it as clipboard content; else build via _build_dynamic_prompt()."""
    saved = pyautogui.position()

    pyautogui.moveTo(x, y)
    pyautogui.click()

    if CLIPBOARD_TEXT:
        if clipboard_override is not None:
            pyperclip.copy(clipboard_override)
        else:
            text, _ = _build_dynamic_prompt()
            pyperclip.copy(text)

    if USE_UP_ARROW:
        pyautogui.press("up")
    else:
        pyautogui.rightClick()

    pyautogui.press("enter")

    time.sleep(0.5)
    pyautogui.moveTo(x, y)
    pyautogui.click()
    pyautogui.press("enter")

    pyautogui.moveTo(saved.x, saved.y)


def main():
    parser = argparse.ArgumentParser(description="Periodic click, paste, enter with configurable prompt mode.")
    parser.add_argument(
        "-m", "--mode",
        choices=("combined", "alternate", "mixed", "file_only"),
        default=None,
        help="Prompt mode: combined, alternate, mixed, file_only. Overrides PROMPT_MODE in config.",
    )
    args = parser.parse_args()
    mode_str = (args.mode or PROMPT_MODE or "combined").lower()

    coords_norm = _normalize_coords()
    # Per-coord state: (x, y, p1_sec, p2_sec, next_kind, last_tick). Alternate: next_kind in ("p1","p2"); else use interval INTERVAL_SECONDS.
    coord_state = []
    for x, y, p1_sec, p2_sec in coords_norm:
        if mode_str == "alternate":
            coord_state.append({
                "x": x, "y": y, "p1_sec": p1_sec, "p2_sec": p2_sec,
                "next_kind": "p1",
                "last_tick": -p1_sec,  # so first send at tick 0
            })
        elif mode_str == "file_only":
            coord_state.append({
                "x": x, "y": y, "p1_sec": p1_sec, "p2_sec": p2_sec,
                "next_kind": "p2",
                "last_tick": -p2_sec,
            })
        else:
            coord_state.append({
                "x": x, "y": y, "p1_sec": p1_sec, "p2_sec": p2_sec,
                "next_kind": "both",
                "last_tick": -INTERVAL_SECONDS,
            })
    if mode_str == "alternate":
        interval_info = "tick=%ds, p1=%s p2=%s (per-coord)" % (
            TICK_SECONDS, ALTERNATE_SLEEP_AFTER_PROMPT1_SEC, ALTERNATE_SLEEP_AFTER_PROMPT2_SEC,
        )
    elif mode_str == "file_only":
        interval_info = "tick=%ds, file_only interval=p2_sec (per-coord)" % TICK_SECONDS
    else:
        interval_info = "tick=%ds, round=%ds" % (TICK_SECONDS, INTERVAL_SECONDS)
    print(
        "Interval: %s. Coords: %s. Clipboard: %s. Mode: %s. Ctrl+C to stop."
        % (
            interval_info,
            CLICK_COORDINATES,
            "use as-is" if not CLIPBOARD_TEXT else repr(CLIPBOARD_TEXT),
            "up+enter" if USE_UP_ARROW else "rightclick+enter",
        )
    )
    tick = 0
    while True:
        # Each tick: run through all coords; if (tick - last_tick) >= interval for that coord, send and update.
        for c in coord_state:
            x, y = c["x"], c["y"]
            if mode_str == "alternate":
                interval = c["p1_sec"] if c["next_kind"] == "p1" else c["p2_sec"]
            elif mode_str == "file_only":
                interval = c["p2_sec"]
            else:
                interval = INTERVAL_SECONDS
            if tick - c["last_tick"] >= interval:
                if mode_str == "alternate":
                    text = _build_prompt1() if c["next_kind"] == "p1" else _build_prompt2()
                    run_at_coord(x, y, clipboard_override=text)
                    c["last_tick"] = tick
                    c["next_kind"] = "p2" if c["next_kind"] == "p1" else "p1"
                elif mode_str == "file_only":
                    text = _build_prompt2()
                    run_at_coord(x, y, clipboard_override=text)
                    c["last_tick"] = tick
                else:
                    text, _ = _build_dynamic_prompt()
                    run_at_coord(x, y, clipboard_override=text)
                    c["last_tick"] = tick
        print("\rtick=%d " % tick, end="", flush=True)
        time.sleep(TICK_SECONDS)
        tick += 1


if __name__ == "__main__":
    main()
