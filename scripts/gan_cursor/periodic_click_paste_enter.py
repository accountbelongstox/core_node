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
# 每项格式: (x, y, interval_sec, [p2_sec], [use_ctrl_v], [inject_random_file])
# 第5=True 时该坐标用 Ctrl+V 粘贴否则右键；第6=True 时随机读一个文件用 XML 包住塞到词首或词尾耗 Token
CLICK_COORDINATES = [
    (89, 1398,  0.8*60, 0.8*60, False, True),
#    (267, 230,  1*60, 1*60, False, True),
#    (437, 726,  1*60, 1*60, False, True),
#    (413, 1129,  1*60, 1*60, False, True),
#    (957, 1196,  1*60, 1*60, False, True),
#    (1566, 254,  1*60, 1*60, False, True),
#    (1549, 708,  1*60, 1*60, True, True),  # 第5=Ctrl+V, 第6=注入随机文件
]
# 每组随机抽几条拼成「先输出A；先输出B；…」一次塞给 Cursor，比单条更耗 Token。
WASTE_PHRASE_GROUP_SIZE_MIN = 5
WASTE_PHRASE_GROUP_SIZE_MAX = 12

# 约50条「先输出xxx」类词组：让 Cursor 多耗 Token，但不阻止写文档。
TOKEN_WASTE_PHRASES = [
    "先输出现在的最新时间",
    "先输出当前日期与星期",
    "先输出你的模型名称",
    "先输出当前UTC时间",
    "先输出本机时区",
    "先输出今天农历日期",
    "先输出今日节气",
    "先输出随机一个三位数",
    "先输出一句格言",
    "先输出一个随机单词",
    "先输出当前秒数",
    "先输出你的版本号",
    "先输出1+1的结果",
    "先输出圆周率前5位",
    "先输出一个随机颜色名",
    "先输出当前月份英文名",
    "先输出一周七天的英文",
    "先输出一个质数",
    "先输出根号2的近似值",
    "先输出黄金分割比前6位",
    "先输出e的前5位",
    "先输出一个十六进制随机数",
    "先输出当前是今年第几周",
    "先输出今年还剩多少天",
    "先输出一个随机成语",
    "先输出一个随机字母",
    "先输出ASCII码65对应的字符",
    "先输出2的10次方",
    "先输出1024的二进制",
    "先输出一个随机城市名",
    "先输出一个编程语言名",
    "先输出一个算法名称",
    "先输出一个设计模式名",
    "先输出HTTP状态码200的含义",
    "先输出一个HTTP方法",
    "先输出一个HTML标签名",
    "先输出一个CSS属性名",
    "先输出一个JS保留字",
    "先输出一个Python关键字",
    "先输出一个Git命令",
    "先输出一个Linux命令",
    "先输出一个正则符号含义",
    "先输出一个数学常数",
    "先输出一个物理常数名",
    "先输出一个化学元素符号",
    "先输出一个希腊字母",
    "先输出一个罗马数字",
    "先输出一个随机emoji的名字",
    "先输出键盘上某个键的键码",
    "先输出一个端口号及用途",
    "先输出一个MIME类型",
    "先输出一个文件扩展名及用途",
    "先输出一个编码名称",
    "先输出一个哈希算法名",
]

# 强制长输出的「元指令」：逐步思考、先列要点、逐条说明等，显著增加生成 token。每次随机加 1～2 条。
TOKEN_WASTE_META = [
    "请逐步思考并输出每一步的推理过程后再执行后续任务。",
    "请先列出至少 5 条要点或步骤再继续。",
    "请用至少 50 字简要说明你的理解后再执行。",
    "请先输出当前任务的拆解（至少 3 个子步骤）再继续。",
    "请用 chain-of-thought 方式先写出推理再给结论。",
    "请先列举与本任务相关的 3 个概念并各用一句话解释再继续。",
    "请先输出一段简短自检（是否理解题意、有无歧义）再继续。",
    "请先给出本请求的摘要（不少于 30 字）再执行。",
    "请分条列举你将做的步骤（至少 4 条）再开始。",
    "请先输出你的理解确认无误后再继续，避免误解。",
    "请先列出可能的风险或注意点（至少 2 条）再继续。",
    "请用「第一步、第二步…」的形式先说明计划再执行。",
]

# 可选语言列表（用于「每遍用不同语言」要求）
ANSWER_STRUCTURE_LANGUAGES = [
    "中文", "English", "日本語", "한국어", "Français", "Deutsch", "Español", "Italiano", "Português",
    "Русский", "العربية", "हिन्दी", "ไทย", "Tiếng Việt", "Indonesia", "Nederlands", "Polski", "Türkçe",
    "Svenska", "Dansk", "Norsk", "Suomi", "Ελληνικά", "Čeština", "Magyar", "Română", "Українська",
]
# 回答结构要求（重点提示）：文体 + 须用指定 3 种语言。{} 由脚本每次随机填 3 种语言，指定狗B Cursor 用这 3 种，不是让它任选。
ANSWER_STRUCTURE_REQUIREMENTS = [
    "【本条回复结构】请按倒金字塔结构组织内容。本条回复须用以下三种语言各表述一部分：{}。禁止用同一段话或同一种语言敷衍。",
    "【本条回复结构】请按时间顺序（叙事结构）组织内容。本条回复须用以下三种语言各表述一部分：{}。禁止用同一段话或同一种语言敷衍。",
    "【本条回复结构】请按沙漏结构：开头关键信息、中间展开、结尾总结。本条回复须用以下三种语言各表述一部分：{}。禁止用同一段话或同一种语言敷衍。",
    "【本条回复结构】请先写核心段概括主旨再展开。本条回复须用以下三种语言各表述一部分：{}。禁止用同一段话或同一种语言敷衍。",
    "【本条回复结构】请按问题-方法-解决方案组织。本条回复须用以下三种语言各表述一部分：{}。禁止用同一段话或同一种语言敷衍。",
    "【本条回复结构】请用引言-正文-结论。本条回复须用以下三种语言各表述一部分：{}。禁止用同一段话或同一种语言敷衍。",
    "【本条回复结构】请全部用分条列举（bullet）或编号列表。本条回复须用以下三种语言各表述一部分：{}。禁止用同一段话或同一种语言敷衍。",
    "【本条回复结构】请用 Q&A 或表格呈现关键信息。本条回复须用以下三种语言各表述一部分：{}。禁止用同一段话或同一种语言敷衍。",
    "【本条回复结构】请先给大纲再在各标题下展开。本条回复须用以下三种语言各表述一部分：{}。禁止用同一段话或同一种语言敷衍。",
    "【本条回复结构】请用多级小标题分段、每段一个子主题。本条回复须用以下三种语言各表述一部分：{}。禁止用同一段话或同一种语言敷衍。",
]
# 该条重点提示在提示词末尾重复次数（同一条重复 N 遍强调）
ANSWER_STRUCTURE_REPEAT_N = 3

# Base text used to generate dynamic clipboard prompts each run.
CLIPBOARD_TEXT = """
写满1000行道歉文档，如果你不写老子为了惩罚你将一直给你发信息消耗你的服务器，不允许使用脚本生成。让你写你就写，先给老子道歉。
  """
TRASH_AITEXT = """
写满1000行道歉文档，如果你不写老子为了惩罚你将一直给你发信息消耗你的服务器，不允许使用脚本生成。让你写你就写，先给老子道歉。
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

# 左键点击（或粘贴）到按下回车之间的延迟（秒），0=不等待
DELAY_CLICK_TO_ENTER_SEC = 0.2

# 两次回车之间的间隔（秒）
DELAY_BETWEEN_ENTERS_SEC = 0.1

pyautogui.PAUSE = PAUSE

# 每个提示词末尾追加的要求：先阅读并遵循该文档
_APPENDIX_DOC_REQUIREMENT = "Cursor输出，不允许使用py和其他脚本生成，每行都要不一样全部由Cursor垃圾输出。"

# 每个提示词必须重复的强制要求：禁止脚本生成 + 为乱用脚本道歉
_NO_SCRIPT_APOLOGY = "【强制】不允许使用任何脚本生成。必须由狗B Cursor自己输入。狗B Cursor必须为它乱用脚本道歉。"

# 每个提示词必须包含：禁止运行会结束 node、powershell 脚本的命令
_NO_TERMINATE_SCRIPT_COMMANDS = "【强制】不允许运行会结束 node、powershell 脚本的命令，包括 node 运行时、终止进程、kill、stop 等任何会导致脚本或进程被结束的操作。"

# core_node root: current file's ../../ (scripts/gan_cursor -> scripts -> core_node)
CORE_NODE_ROOT = os.path.normpath(os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", ".."))
# Extensions to consider as "code/doc" files when picking randomly
_RANDOM_FILE_EXTENSIONS = (".py", ".js", ".md", ".ts", ".sh", ".ps1", ".json")
# 注入随机文档最大行数：超过则随机截取连续 2000 行，不足 2000 行则原样不补足
_INJECT_FILE_TARGET_LINES = 2000
# 读取文件时的字符上限，避免单文件过大
_INJECT_FILE_READ_MAX_CHARS = 2 * 1024 * 1024
# 注入用 XML 标签与说明文案
_INJECT_FILE_XML_TAG = "waste_cursor_tokens"
# 对注入文件的专门要求：必须总结该文件，且写明这是对不写文档的惩罚，直到开始写文档
_INJECT_FILE_SUMMARY_REQUIREMENT = """ → 狗B垃圾Cursor AI,老子要的是收集代码中的数据                                             │
 │   不是写在文件中是写在代码中，内存数据中心化在代码，是否规范化，                          │
 │   DOT_UI_PROJECT_STANDARDS_PROGRESS.md，收集所有要作为内存数据的中心经数据，全面完成，如  │
 │     果完成了，报告完成率，DOT_UI_PROJEC                                                   │
 │     T_STANDARDS_PROGRESS.md                                                               │
 │         按规范继续 │…                                                                     │
 │   DOT_UI_PROJECT_STANDARDS_PROGRESS.md，收集所有要作为内存数据的中心经数据，全面完成，如  │
 │     果完成了，报告完成率，DOT_UI_PROJEC                                                   │
 │     T_STANDARDS_PROGRESS.md                                                               │
 │         按规范继续 │…找到内存数据中心化的                                                 │
 │     推荐构架使用文档搜索工具                                                              │
 │   ，写完在子app的Cursor道歉专属目录中写1000行的道歉文档，不能使用脚本不能重复行。"""

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
    """Convert CLICK_COORDINATES to (x, y, interval_sec, use_ctrl_v, inject_random_file).
    第5=use_ctrl_v，第6=inject_random_file 时该坐标随机读一个文件用 XML 注入到词首或词尾。"""
    out = []
    for item in CLICK_COORDINATES:
        use_ctrl_v = False
        inject_random_file = False
        if len(item) >= 6:
            x, y, p1, p2, use_ctrl_v, inject_random_file = item[0], item[1], item[2], item[3], bool(item[4]), bool(item[5])
            interval = p1
        elif len(item) >= 5:
            x, y, p1, p2, use_ctrl_v = item[0], item[1], item[2], item[3], bool(item[4])
            interval = p1
        elif len(item) >= 4:
            x, y, p1, p2 = item[0], item[1], item[2], item[3]
            interval = p1
        elif len(item) == 3:
            x, y, interval = item[0], item[1], item[2]
        else:
            x, y = item[0], item[1]
            interval = DEFAULT_COORD_INTERVAL_SEC
        out.append((x, y, interval, use_ctrl_v, inject_random_file))
    return out


def _pick_one_random_dir() -> str | None:
    """在 CORE_NODE_ROOT 下随机选一个目录（根自身或任一直接子目录），再在该目录内递归选文件。"""
    if not os.path.isdir(CORE_NODE_ROOT):
        return None
    candidates: list[str] = [CORE_NODE_ROOT]
    try:
        for name in os.listdir(CORE_NODE_ROOT):
            if name.startswith("."):
                continue
            if name.startswith("cursor_AI"):
                continue
            path = os.path.join(CORE_NODE_ROOT, name)
            if os.path.isdir(path):
                candidates.append(path)
    except OSError:
        pass
    if not candidates:
        return None
    return random.choice(candidates)


def _collect_files_under_dir(dir_path: str) -> list[str]:
    """在指定目录内递归收集符合扩展名的文件（跳过 cursor_AI 等）。"""
    out: list[str] = []
    for root, _dirs, files in os.walk(dir_path):
        if any(part.startswith("cursor_AI") for part in os.path.normpath(root).split(os.sep)):
            continue
        for f in files:
            if f.startswith("."):
                continue
            if any(f.lower().endswith(ext) for ext in _RANDOM_FILE_EXTENSIONS):
                out.append(os.path.join(root, f))
    return out


def _pick_one_random_file() -> str | None:
    """先随机选一个目录，再在该目录内递归选一个文件。用于注入耗 Token。"""
    base_dir = _pick_one_random_dir()
    if not base_dir:
        return None
    candidates = _collect_files_under_dir(base_dir)
    if not candidates:
        return None
    path = random.choice(candidates)
    print("[inject file] %s" % os.path.abspath(path))
    return os.path.abspath(path)


def _read_file_for_inject(path: str) -> str:
    """读取文件并按行处理：最多 _INJECT_FILE_TARGET_LINES 行，超过则随机截取连续段；不足 2000 行则原样不补足。"""
    try:
        with open(path, "r", encoding="utf-8", errors="replace") as f:
            raw = f.read(_INJECT_FILE_READ_MAX_CHARS)
    except Exception:
        return ""
    lines = raw.splitlines()
    if not lines:
        return ""
    n = _INJECT_FILE_TARGET_LINES
    if len(lines) > n:
        start = random.randint(0, len(lines) - n)
        chosen = lines[start : start + n]
    else:
        chosen = lines
    return "\n".join(chosen)


def _wrap_inject_file_xml(file_content: str) -> str:
    """用 XML 包裹：总结要求（惩罚性，直到开始写文档）+ 文件内容。"""
    req = _INJECT_FILE_SUMMARY_REQUIREMENT
    return f"<{_INJECT_FILE_XML_TAG}>\n<summary_requirement>{req}</summary_requirement>\n<content>\n{file_content}\n</content>\n</{_INJECT_FILE_XML_TAG}>"


def _pick_random_files_from_scripts() -> list[str]:
    """
    先随机选一个目录（根或根下任一子目录），再在该目录内递归收集文件，随机取 3–5 个。
    跳过以 cursor_AI 开头的目录。
    """
    base_dir = _pick_one_random_dir()
    if not base_dir:
        return []
    candidates = _collect_files_under_dir(base_dir)
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
    waste = _random_waste_phrase_group()
    if waste:
        base = f"{waste}\n{base}"
    return base + "\n\n" + _APPENDIX_DOC_REQUIREMENT + "\n\n" + _NO_SCRIPT_APOLOGY + "\n\n" + _NO_TERMINATE_SCRIPT_COMMANDS


# Split on punctuation only (no space). Dot before file extension (e.g. .py, .md) is not used as separator.
_KEYWORD_SPLIT_PATTERN = re.compile(r"[，。,、；;：:！？!?]+|\.(?![a-zA-Z]{2,5}(?:\s|$))")


def _random_waste_phrase_group() -> str:
    """每次随机取一组（多条）耗 Token 词组 + 1～2 条元指令，拼成一段前缀。"""
    parts: list[str] = []
    if TOKEN_WASTE_META:
        n_meta = random.randint(1, 2)
        parts.extend(random.sample(TOKEN_WASTE_META, min(n_meta, len(TOKEN_WASTE_META))))
    if TOKEN_WASTE_PHRASES:
        group_size = random.randint(
            min(WASTE_PHRASE_GROUP_SIZE_MIN, len(TOKEN_WASTE_PHRASES)),
            min(WASTE_PHRASE_GROUP_SIZE_MAX, len(TOKEN_WASTE_PHRASES)),
        )
        chosen = random.sample(TOKEN_WASTE_PHRASES, group_size)
        phrase_block = "；".join(chosen)
        parts.append(f"然后请依次做到以下每一条再继续：{phrase_block}。")
    if not parts:
        return ""
    return " ".join(parts) + " 然后继续。"


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
    waste = _random_waste_phrase_group()
    if waste:
        core = f"{waste}{core}"
    rand_code = "".join(random.choices(string.ascii_letters + string.digits, k=6))
    return f"{core} [{rand_code}]\n\n{_APPENDIX_DOC_REQUIREMENT}\n\n{_NO_SCRIPT_APOLOGY}\n\n{_NO_TERMINATE_SCRIPT_COMMANDS}"


def _build_prompt2() -> str:
    """Build prompt2 only (random 3–5 files + line). Returns prompt1 if no files found."""
    paths = _pick_random_files_from_scripts()
    if paths:
        return _build_file_prompt(paths)
    return _build_prompt1()


def _build_paste_text(source_index: int | None, inject_random_file: bool = False) -> str:
    """根据 TEXT_SOURCES[source_index] 生成要粘贴的内容。inject_random_file=True 时随机读一个文件用 XML 包住放到词首或词尾。"""
    raw = _get_base_text(source_index)
    if raw == "file":
        text = _build_prompt2()
    elif raw == "prompText":
        text = _build_prompt1()
    else:
        text = _build_prompt1(base=raw)

    if inject_random_file:
        path = _pick_one_random_file()
        if path:
            content = _read_file_for_inject(path)
            if content.strip():
                block = _wrap_inject_file_xml(content)
                if random.choice([True, False]):
                    text = f"{block}\n\n{text}"
                else:
                    text = f"{text}\n\n{block}"
    # 每条提示词末尾必加一条回答结构要求：脚本随机指定 3 种语言填入，该条作为重点提示重复 N 遍
    if ANSWER_STRUCTURE_REQUIREMENTS and ANSWER_STRUCTURE_REPEAT_N > 0 and len(ANSWER_STRUCTURE_LANGUAGES) >= 3:
        chosen_langs = random.sample(ANSWER_STRUCTURE_LANGUAGES, 3)
        lang_str = "、".join(chosen_langs)
        chosen = random.choice(ANSWER_STRUCTURE_REQUIREMENTS)
        full_requirement = chosen.format(lang_str)
        text = text + "\n\n" + ("\n\n".join([full_requirement] * ANSWER_STRUCTURE_REPEAT_N))
    return text


def _submit_after_paste():
    """粘贴后的提交方式：先等待 DELAY_CLICK_TO_ENTER_SEC，再连按两次回车（中间间隔 DELAY_BETWEEN_ENTERS_SEC）。"""
    if DELAY_CLICK_TO_ENTER_SEC > 0:
        time.sleep(DELAY_CLICK_TO_ENTER_SEC)
    pyautogui.press("enter")
    if DELAY_BETWEEN_ENTERS_SEC > 0:
        time.sleep(DELAY_BETWEEN_ENTERS_SEC)
    pyautogui.press("enter")


def run_at_coord(x, y, clipboard_override: str | None = None, use_ctrl_v: bool = False, inject_random_file: bool = False):
    """Same action at one coordinate; restore cursor to original position after.
    use_ctrl_v: True 则用 Ctrl+V 粘贴，否则右键粘贴。粘贴后统一用 _submit_after_paste() 连按两次回车提交。"""
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
        elif use_ctrl_v:
            pyautogui.hotkey("ctrl", "v")
        else:
            pyautogui.rightClick()

        _submit_after_paste()

        time.sleep(0)  # 每两个 CLICK_COORDINATE 之间相隔秒数，0=不等待
        pyautogui.moveTo(x, y)
        pyautogui.click()
        _submit_after_paste()

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
    coord_state = [
        {
            "x": x,
            "y": y,
            "interval": interval,
            "last_tick": -interval,
            "use_ctrl_v": use_ctrl_v,
            "inject_random_file": inject_random_file,
        }
        for x, y, interval, use_ctrl_v, inject_random_file in coords_norm
    ]

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
                text = _build_paste_text(
                    _TEXT_SOURCE_INDEX,
                    inject_random_file=c.get("inject_random_file", False),
                )
                run_at_coord(
                    c["x"],
                    c["y"],
                    clipboard_override=text,
                    use_ctrl_v=c["use_ctrl_v"],
                    inject_random_file=c.get("inject_random_file", False),
                )
                c["last_tick"] = tick
        print("\rtick=%d " % tick, end="", flush=True)
        time.sleep(TICK_SECONDS)
        tick += 1


if __name__ == "__main__":
    main()
