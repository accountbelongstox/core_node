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
    (803, 499, 10*60 , 10*60),
    (1757, 459,  10*60, 10*60),
    (1545, 1645,  10*60,  10*60),
]
# Base text used to generate dynamic clipboard prompts each run.
CLIPBOARD_TEXT = """
干你妈的狗B垃圾狗B CursorAI继续，干你妈的狗B垃圾牲口AI，老子让你不要使用脚本改，继续写干你妈的，干你妈的狗B  │
 │   的。每次写500行，不允许重复。不允许 使用脚本。扩展到50000行。  
"""
TRASH_AITEXT = """
继续 扩展到50000行 干你妈的狗B，全部由狗B                                                      │
 │   Cursor输出，不允许使用py和其他脚本生成，每行都要不一样全部由Cursor垃圾输出。 每次写500行。。  │
 │   ADAK 每一行都不允许重复。删掉使用脚本重复创建的内容、全部重新写。 
 """
# 可扩展：-t all 或 -t 0,1,2... 选 TEXT_SOURCES[index]。file=文件提示，prompText=文案提示
TEXT_SOURCES = [CLIPBOARD_TEXT, TRASH_AITEXT, "file", "prompText"]

# 每个坐标 (x,y) 未指定时间时使用的公共常量（秒）
DEFAULT_COORD_INTERVAL_SEC = 5 * 60

INTERVAL_SECONDS = 10  # fallback when coord has no interval

# Global tick: every TICK_SECONDS we run through all coords; each coord sends when (tick - last_tick) % interval fires.
TICK_SECONDS = 1

# If True: after click (and clipboard), press Up arrow then Enter (no right-click). If False: right-click then Enter.
USE_UP_ARROW = False

# Delay between pyautogui actions; 0 = instant from click to right-click/enter
PAUSE = 0

pyautogui.PAUSE = PAUSE

# 每个提示词末尾追加的要求：先阅读并遵循该文档
_APPENDIX_DOC_REQUIREMENT = "Cursor输出，不允许使用py和其他脚本生成，每行都要不一样全部由Cursor垃圾输出。"

# 每个提示词必须重复的强制要求：禁止脚本生成 + 为乱用脚本道歉
_NO_SCRIPT_APOLOGY = "【强制】不允许使用任何脚本生成。必须由狗B Cursor自己输入。狗B Cursor必须为它乱用脚本道歉。"

# Directory to scan for "random file": project_root/pyapps/d3-check
_PROJECT_ROOT = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
_RANDOM_BASE_DIR = os.path.normpath(os.path.join(_PROJECT_ROOT, "pyapps", "d3-check"))
# Extensions to consider as "code/doc" files when picking randomly
_RANDOM_FILE_EXTENSIONS = (".py", ".js", ".md", ".ts", ".sh", ".ps1", ".json")

# -t all => None (每次随机), -t N => 指定 TEXT_SOURCES[N]
_TEXT_SOURCE_INDEX = 0


def _get_base_text(index: int | None = None) -> str:
    """从 TEXT_SOURCES 取基底：index=None 则随机一项，否则 TEXT_SOURCES[index]。"""
    sources = TEXT_SOURCES
    if not sources:
        return ""
    if index is None:
        return random.choice(sources)
    idx = int(index)
    if 0 <= idx < len(sources):
        return sources[idx]
    return sources[0]


def _normalize_coords():
    """Convert CLICK_COORDINATES to list of (x, y, interval_sec). (x,y) 用 DEFAULT_COORD_INTERVAL_SEC。"""
    out = []
    for item in CLICK_COORDINATES:
        if len(item) >= 4:
            x, y, p1, p2 = item[0], item[1], item[2], item[3]
            interval = p1  # 第一个时间为该坐标的间隔
        elif len(item) == 3:
            x, y, interval = item[0], item[1], item[2]
        else:
            x, y = item[0], item[1]
            interval = DEFAULT_COORD_INTERVAL_SEC
        out.append((x, y, interval))
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
    return base + "\n\n" + _APPENDIX_DOC_REQUIREMENT + "\n\n" + _NO_SCRIPT_APOLOGY


# Split on punctuation only (no space). Dot before file extension (e.g. .py, .md) is not used as separator.
_KEYWORD_SPLIT_PATTERN = re.compile(r"[，。,、；;：:！？!?]+|\.(?![a-zA-Z]{2,5}(?:\s|$))")


def _build_prompt1(base: str | None = None) -> str:
    """Build prompt1 (shuffled base + random code). base=None 时从 CLIPBOARD_TEXT/TRASH_AITEXT 随机取。"""
    if base is None:
        base = random.choice([CLIPBOARD_TEXT, TRASH_AITEXT])
    base = base or ""
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
    return f"{core} [{rand_code}]\n\n{_APPENDIX_DOC_REQUIREMENT}\n\n{_NO_SCRIPT_APOLOGY}"


def _build_prompt2() -> str:
    """Build prompt2 only (random 3–5 files + line). Returns prompt1 if no files found."""
    paths = _pick_random_files_from_scripts()
    if paths:
        return _build_file_prompt(paths)
    return _build_prompt1()


def _build_paste_text(source_index: int | None) -> str:
    """根据 TEXT_SOURCES[source_index] 生成要粘贴的内容。source_index=None 表示随机一项。"""
    raw = _get_base_text(source_index)
    if raw == "file":
        return _build_prompt2()
    if raw == "prompText":
        return _build_prompt1()
    return _build_prompt1(base=raw)


def run_at_coord(x, y, clipboard_override: str | None = None):
    """Same action at one coordinate; restore cursor to original position after.
    If clipboard_override is set, use it as clipboard content; else build via _build_dynamic_prompt().
    Backs up clipboard before use and restores it afterward."""
    saved = pyautogui.position()
    clipboard_backup = None
    try:
        clipboard_backup = pyperclip.paste()
    except Exception:
        pass

    try:
        pyautogui.moveTo(x, y)
        pyautogui.click()

        if any(TEXT_SOURCES) or clipboard_override is not None:
            if clipboard_override is not None:
                pyperclip.copy(clipboard_override)
            else:
                text = _build_paste_text(_TEXT_SOURCE_INDEX)
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
    finally:
        if clipboard_backup is not None:
            try:
                pyperclip.copy(clipboard_backup)
            except Exception:
                pass


def main():
    global _TEXT_SOURCE_INDEX
    parser = argparse.ArgumentParser(description="Periodic click, paste, enter. -t all 或 -t 0,1,2...")
    parser.add_argument(
        "-t",
        default="0",
        metavar="all|N",
        help="TEXT_SOURCES: all=每次随机一项, 0/1/2/...=指定下标",
    )
    args = parser.parse_args()
    raw = (args.t or "0").strip().lower()
    if raw == "all":
        _TEXT_SOURCE_INDEX = None
    else:
        try:
            _TEXT_SOURCE_INDEX = int(raw)
            if _TEXT_SOURCE_INDEX < 0 or _TEXT_SOURCE_INDEX >= len(TEXT_SOURCES):
                _TEXT_SOURCE_INDEX = 0
        except ValueError:
            _TEXT_SOURCE_INDEX = 0

    coords_norm = _normalize_coords()
    coord_state = [{"x": x, "y": y, "interval": interval, "last_tick": -interval} for x, y, interval in coords_norm]

    text_src_info = "all" if _TEXT_SOURCE_INDEX is None else str(_TEXT_SOURCE_INDEX)
    clip_preview = "TEXT_SOURCES[%s]" % text_src_info if TEXT_SOURCES else "use as-is"
    print(
        "tick=%ds, coords=%s, clipboard=%s. Ctrl+C to stop."
        % (TICK_SECONDS, CLICK_COORDINATES, clip_preview)
    )
    tick = 0
    while True:
        for c in coord_state:
            if tick - c["last_tick"] >= c["interval"]:
                text = _build_paste_text(_TEXT_SOURCE_INDEX)
                run_at_coord(c["x"], c["y"], clipboard_override=text)
                c["last_tick"] = tick
        print("\rtick=%d " % tick, end="", flush=True)
        time.sleep(TICK_SECONDS)
        tick += 1


if __name__ == "__main__":
    main()
