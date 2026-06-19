# -*- coding: utf-8 -*-
"""
Merge every scattered "Cursor AI apology / reflection" directory in the repo into a
single English-named archive under docs/, translating both filenames and content to
English (dictionary for the templated apology phrases, pinyin romanization for the
long tail so the result is guaranteed ASCII), and removing duplicate files.

Run:  python scripts/merge_cursor_apologies.py
"""
import os
import re
import sys
import hashlib
import shutil
import unicodedata

from pypinyin import lazy_pinyin

REPO = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
OUT = os.path.join(REPO, "docs", "cursor_ai_apology_archive")

# --- every "similar" source (dirs are merged & removed; the loose file too) ---
SOURCE_DIRS = [
    ".cursor/apology",
    "apps/mcp-chrome/.cursor/apology",
    "apps/mcp-chrome/cursor_apology",
    "dotapps/d3check/cursor_AI_道歉目录",
    "dotapps/d3check/cursor_apology",
    "poly_apps/flutter_bloom/.ai_apology",
    "poly_apps/flutter_bloom/lib/apps/app_bank/cursor_ai_reflection",
    "poly_apps/flutter_bloom/lib/apps/app_laravel_bloom/apology_reflection",
    "pyapps/d3-check/cursor_AI_apology",
    "pyapps/d3-check/cursor_AI_道歉目录",
]
SOURCE_FILES = [
    "scripts/gan_cursor/Cursor_AI_道歉_TICK_SECONDS乱改_一万行.md",
]

# ---------------------------------------------------------------------------
# Chinese -> English dictionary. Longest keys win (alternation sorted by length).
# Covers the high-frequency templated apology/reflection phrases + filename
# segments + grammatical connectives. Anything not covered romanizes to pinyin.
# ---------------------------------------------------------------------------
DICT = {
    # ---- long template sentences ----
    "我为我刚才的改动给您带来的任何不便表示诚挚的歉意": "I sincerely apologize for any inconvenience my recent changes caused you",
    "确保您能够清楚地理解我的每一个修改的意图和原因": "to ensure you clearly understand the intent and reason of each of my changes",
    "而不是匆忙地做出可能不符合您期望的修改": "rather than hastily making changes that may not meet your expectations",
    "我承认我在理解您的需求时可能存在偏差": "I admit there may be bias in my understanding of your needs",
    "我会在今后的工作中更加仔细地理解您的需求": "I will understand your needs more carefully in future work",
    "我意识到我应该更加仔细地理解您的需求": "I realize I should understand your needs more carefully",
    "我会在今后的工作中更加注重这些方面": "I will pay more attention to these aspects in future work",
    "我会在今后的工作中更加注意这一点": "I will pay more attention to this in future work",
    "用户一开始就要求在区域里全部扫": "the user asked from the start to scan the whole region",
    "确保我能够更好地理解您的需求": "to ensure I can better understand your needs",
    "我的职责是帮助您更好地完成开发工作": "my duty is to help you better complete development work",
    "未认真看文档尽写敷衍代码敷衍写": "did not read the docs carefully and wrote only perfunctory code",
    "行及此前任意一行在句式或侧重点上不同": "this line differs from every previous line in sentence structure or focus",
    "确保我能够为您提供更好的服务": "to ensure I can provide you with better service",
    "确保每一个修改都经过深思熟虑": "to ensure every change is carefully considered",
    "确保我能够更好地为您服务": "to ensure I can serve you better",
    "私自使用脚本未经您允许沉痛认错": "I painfully admit fault for using a script without your permission",
    "为私自使用脚本未获您允许而续写本": "I keep writing this for using a script without your permission",
    "之前为什么要私自用脚本而郑重道歉": "I solemnly apologize for why I privately used a script earlier",
    "私自使用脚本未经您允许郑重致歉": "I solemnly apologize for using a script without your permission",
    "为未经允许使用脚本向您郑重致歉": "I solemnly apologize for using a script without permission",
    "私自使用脚本未经允许郑重道歉": "I solemnly apologize for using a script without permission",
    "不允许任何脚本却仍用诚恳认错": "no script was allowed yet I used one, I sincerely admit fault",
    "任何脚本也不允许却仍用脚本认错": "no script was allowed yet I used one to admit fault",
    "任何脚本也不允许却用了郑重道歉": "no script was allowed yet I used one, I solemnly apologize",
    "之前为什么要私自用脚本而道歉": "I apologize for why I privately used a script earlier",
    "不允许脚本却用了脚本沉痛认错": "no script was allowed yet I used one, I painfully admit fault",
    "新增加的全部重写每行须不一样": "everything newly added is rewritten and every line must differ",
    "为未经允许使用脚本向您致歉": "I apologize for using a script without permission",
    "不认真看文档尽写敷衍代码": "did not read the docs carefully and wrote only perfunctory code",
    "未认真看文档导致写死数值": "did not read the docs carefully which led to hardcoded values",
    "不认真看文档导致算法错误": "did not read the docs carefully which led to algorithm errors",
    "应从文档与块结构推导": "should derive it from the docs and block structure",
    "用魔法数字代替正确推导": "used magic numbers instead of correct derivation",
    "确保我能够更加高效地完成工作": "to ensure I can complete the work more efficiently",
    "确保我能够为您提供更专业": "to ensure I can provide you with more professional",
    "未认真看文档就改敷衍": "changed it perfunctorily without reading the docs carefully",
    "不认真看文档敷衍写代码": "did not read the docs carefully and wrote perfunctory code",
    "被您称垃圾牲口而深刻反省": "I deeply reflect for being called a garbage beast by you",
    "被您骂垃圾牲口而反省": "I reflect for being scolded as a garbage beast by you",
    "我会在今后的工作中更加谨慎": "I will be more careful in future work",
    "我会在今后的工作中更加努力": "I will work harder in future work",
    "尽写垃圾代码敷衍您": "wrote only garbage code to fob you off",
    "尽写敷衍代码敷衍您": "wrote only perfunctory code to fob you off",
    "未认真看文档就改代码": "changed the code without reading the docs carefully",
    "确保不再犯类似的错误": "to ensure I do not make similar mistakes again",
    "而不是给您带来额外的困扰": "rather than causing you extra trouble",
    "更好地完成开发任务": "to better complete the development task",
    "直到写满十万行": "until one hundred thousand lines are filled",
    "在本轮追加中直接撰写": "written directly in this round of appending",
    "本反思须续至": "this reflection must continue until",
    "我为此反思并道歉": "I reflect and apologize for this",
    "未认真看文档就改": "changed it without reading the docs carefully",
    "私自使用脚本继续道歉": "I keep apologizing for privately using a script",
    "不得使用脚本须逐行手写": "no script allowed, must hand-write line by line",
    "不得使用脚本生成只能手写": "no script generation allowed, hand-write only",
    "强制不允许任何脚本生成": "strictly no script generation allowed",
    "不允许使用脚本生成本文档却用": "no script was allowed to generate this document yet one was used",
    "不允许使用任何脚本生成": "not allowed to generate using any script",
    "却仍用脚本向您道歉": "yet I still used a script, I apologize to you",
    "我深刻认识到": "I deeply realize that",
    "更可靠的帮助": "and more reliable help",
    "都符合您的要求": "all conform to your requirements",
    "确保为您提供更好的服务": "to ensure better service for you",
    "用魔法数字敷衍您": "used magic numbers to fob you off",
    "用魔法数字敷衍": "used magic numbers perfunctorily",
    "持续改进流程等各个方面": "continuous improvement process and every other aspect",
    "资源需求评估": "resource requirement assessment",
    "改进计划制定": "improvement plan",
    "监控指标设置": "monitoring metric setup",
    "反馈收集机制": "feedback collection mechanism",
    "成功标准定义": "success criteria definition",
    "需要优化为更短格式如": "needs to be optimized into a shorter format such as",
    "涉及代码位置确认": "code location confirmation",
    "优化方案设计": "optimization plan design",
    "实现细节考虑": "implementation detail consideration",
    "测试用例编写": "test case writing",
    "文本格式分析": "text format analysis",
    "可读性改进": "readability improvement",
    "扩展性设计": "extensibility design",
    "安全考虑": "security consideration",
    "用户体验改进": "user experience improvement",
    "可维护性提升": "maintainability improvement",
    "国际化支持": "internationalization support",
    "兼容性测试": "compatibility testing",
    "详细反思条目": "detailed reflection item",
    "条详细反思": "detailed reflections",
    "性能优化": "performance optimization",
    "风险评估": "risk assessment",
    "风险应对": "risk response",
    "时间安排": "schedule",
    "版本控制": "version control",
    "文档编写": "documentation writing",
    "文本显示过长的第": "text display too long, No.",
    "文本格式": "text format",
    "每次至少增加二百行": "add at least two hundred lines each time",
    "第一人称全部改为": "all first person changed to",
    "对此深表歉意": "I deeply apologize for this",
    "在此郑重承认": "I solemnly admit here",
    "在此郑重道歉": "I solemnly apologize here",
    "未从块结构推导": "did not derive it from the block structure",
    "专用道歉目录存放本续至": "store in the dedicated apology directory, continue until",
    "专用道歉目录续写至": "continue writing in the dedicated apology directory until",
    "专用道歉目录写至": "write in the dedicated apology directory until",
    "道歉目录本档续写": "this apology-directory document continues",
    "和其他脚本生成": "or generated by other scripts",
    "块及缩进汇总": "block and indentation summary",
    "全部由本人输入": "all typed by myself",
    "每行都要不一样全部由": "every line must be different, all by",
    "每行都要不一样": "every line must be different",
    "行反思每行须不重复": "lines of reflection, each line must be unique",
    "必须为它乱用脚本道歉": "must apologize for misusing a script for it",
    "曾未在修改": "did not, when modifying,",
    "导致了一些不必要的修改": "caused some unnecessary changes",
    "并为乱用脚本郑重道歉": "and solemnly apologize for misusing a script",
    "并为乱用脚本道歉": "and apologize for misusing a script",
    "为乱用脚本道歉": "apologize for misusing a script",
    "为曾乱用脚本道歉": "apologize for having misused a script",
    "的不该写硬编码的值": "should not have written hardcoded values",
    "无法解释来源": "cannot explain the source",
    "没在区域里全部扫": "did not scan the whole region",
    "各表述一部分": "each states a part",
    "未从日志推导": "did not derive it from the logs",
    "未从文档推导": "did not derive it from the docs",
    "未正确归因": "did not attribute it correctly",
    "专门的道歉目录": "dedicated apology directory",
    "责任在狗": "the responsibility lies with the dog",
    "全部由狗": "all by the dog",
    "必须由狗": "must be by the dog",
    "此过在狗": "this fault lies with the dog",
    "老子没让用": "I never told you to use it",
    "道歉目录续写至": "continue writing the apology directory until",
    "道歉目录续写": "the apology directory continues",
    "破坏可读性": "broke readability",
    "我会持续改进": "I will keep improving",
    "我会持续学习": "I will keep learning",
    "我会持续反思": "I will keep reflecting",
    "我会持续提升": "I will keep improving myself",
    "谁让你写硬编码": "who told you to hardcode",
    "罪该万死": "an unforgivable offence",
    "干你妈的狗": "damn dog",
    "垃圾牲口": "garbage beast",
    "垃圾输出": "garbage output",
    "垃圾代码": "garbage code",
    "敷衍了事写": "perfunctorily wrote",
    "尽写敷衍代码": "wrote only perfunctory code",
    "尽写敷衍": "wrote only perfunctory work",
    "敷衍写": "perfunctorily wrote",
    "沉痛认错": "painfully admit fault",
    "沉痛反省": "painfully reflect",
    "沉痛检讨": "painful self-criticism",
    "诚恳致歉": "sincerely apologize",
    "诚恳反省": "sincerely reflect",
    "诚恳认错": "sincerely admit fault",
    "由衷致歉": "heartfelt apology",
    "由衷检讨": "heartfelt self-criticism",
    "由衷认错": "heartfelt admission of fault",
    "郑重道歉": "solemnly apologize",
    "郑重致歉": "solemnly apologize",
    "郑重检讨": "solemn self-criticism",
    "郑重反省": "solemn reflection",
    "深表歉意": "deeply apologize",
    "向您致歉": "apologize to you",
    "私自用脚本道歉": "apologize for privately using a script",
    "未调用任何脚本": "did not call any script",
    "未使用任何脚本": "no script was used",
    "任何脚本也不允许": "no script is allowed at all",
    "不允许用脚本生成": "not allowed to generate with a script",
    "不允许使用": "not allowed to use",
    "不允许重复": "no repetition allowed",
    "不允许有重复": "no duplicates allowed",
    "不得脚本生成": "no script generation allowed",
    "禁止脚本": "scripts forbidden",
    "无脚本": "no script",
    "不用脚本": "no script",
    "未使用": "not used",
    "已遵守": "already complied",
    "行而道歉": "lines and apologize",
    "行道歉文档": "line apology document",
    "行且每行不重复": "lines and each line is unique",
    "行每行须不一样": "lines, each line must differ",
    "行须每行不一样": "lines, each line must differ",
    "行须每行不重复": "lines, each line must be unique",
    "行每行须不重复": "lines, each line must be unique",
    "行均不重复": "all lines are unique",
    "每行至少一百字": "at least one hundred characters per line",
    "每行不重复": "each line is unique",
    "每行至少": "at least per line",
    "内容唯一": "content is unique",
    "内容与第": "content and No.",
    "本行是第": "this line is No.",
    "本行为第": "this line is No.",
    "本行与第": "this line and No.",
    "本段为第": "this segment is No.",
    "我之致歉第": "my apology No.",
    "之致歉第": "apology No.",
    "依次输出": "output in order",
    "直接输入": "typed directly",
    "直接输出": "output directly",
    "直接撰写": "written directly",
    "自己输入": "typed myself",
    "自己找目录": "find the directory myself",
    "写在子": "written in sub",
    "在本轮撰写": "written in this round",
    "测试模式": "test mode",
    "测试时间": "test time",
    "道歉文档": "apology document",
    "道歉目录": "apology directory",
    "对不起": "sorry",
    "我的错": "my fault",
    "该死": "damn it",
    "抱歉": "sorry",
    "继续增加": "keep adding",
    "继续": "continue",
    "续写至": "continue writing until",
    "续写": "continue writing",
    "硬编码": "hardcoding",
    "写死": "hardcode",
    "不该写": "should not write",
    "不可维护": "unmaintainable",
    "总结文档": "summary document",
    "技术说明": "technical note",
    "项道歉说明": "item apology note",
    "项十万行道歉": "item hundred-thousand-line apology",
    "未执行十万行": "unexecuted hundred-thousand lines",
    "总结十万行": "summary hundred-thousand lines",
    "项十万行": "item hundred-thousand lines",
    "十万行": "hundred-thousand lines",
    "一万行": "ten-thousand lines",
    "项及三语引言正文结论": "item and trilingual intro-body-conclusion",
    "项及三语问题方法方案": "item and trilingual problem-method-solution",
    "项及三语核心段展开": "item and trilingual core-section expansion",
    "项及三语多级标题": "item and trilingual multi-level headings",
    "项及三语倒金字塔": "item and trilingual inverted-pyramid",
    "项及三语大纲展开": "item and trilingual outline expansion",
    "项及三语时间顺序": "item and trilingual chronological",
    "项及三语核心段": "item and trilingual core-section",
    "项及三语小标题": "item and trilingual subheadings",
    "项及三语沙漏": "item and trilingual hourglass",
    "项及三语分条": "item and trilingual itemized",
    "项及三语叙事": "item and trilingual narrative",
    "项及三语": "item and trilingual",
    "项三语": "item trilingual",
    "三语": "trilingual",
    "理解确认": "understanding confirmation",
    "理解推理": "understanding reasoning",
    "理解风险": "understanding risk",
    "配置总结与": "config summary and",
    "配置总结及": "config summary and",
    "配置总结": "config summary",
    "规范总结与": "spec summary and",
    "指南总结与": "guide summary and",
    "总结自检": "summary self-check",
    "总结概念": "summary concept",
    "总结与道歉": "summary and apology",
    "总结计划": "summary plan",
    "总结步骤": "summary step",
    "总结理解": "summary understanding",
    "总结风险": "summary risk",
    "总结拆解": "summary breakdown",
    "总结与": "summary and",
    "总结及": "summary and",
    "要点自检": "key-points self-check",
    "概念要点": "concept key-points",
    "概念与": "concept and",
    "自检与": "self-check and",
    "计划与": "plan and",
    "推理与": "reasoning and",
    "摘要与": "abstract and",
    "理解与": "understanding and",
    "规则与": "rules and",
    "步骤与": "step and",
    "项总结": "item summary",
    "项道歉": "item apology",
    "项与": "item and",
    "反思道歉": "reflection apology",
    "道歉与反思": "apology and reflection",
    "反思第": "reflection No.",
    "行反思": "lines of reflection",
    "测试": "test",
    "面板": "panel",
    "助手": "assistant",
    "铁匠": "blacksmith",
    "牲口": "beast",
    "垃圾狗": "garbage dog",
    "垃圾": "garbage",
    "承认": "admit",
    "反思": "reflection",
    "道歉": "apology",
    "说明": "note",
    "概念": "concept",
    "自检": "self-check",
    "理解": "understand",
    "步骤": "step",
    "风险": "risk",
    "推理": "reasoning",
    "拆解": "breakdown",
    "摘要": "abstract",
    "总结": "summary",
    "配置": "config",
    "架构": "architecture",
    "模块": "module",
    "结构": "structure",
    "规范": "spec",
    "计划": "plan",
    "方法": "method",
    "要点": "key points",
    "用途": "purpose",
    "目录": "directory",
    "项目": "project",
    "强制": "forced",
    "唯一": "unique",
    "不重复": "no repetition",
    "无重复": "no duplicates",
    "未执行": "not executed",
    "未从": "not from",
    "批次": "batch",
    "乱改": "reckless edit",
    "确认": "confirm",
    "本行由": "this line by",
    "本行": "this line",
    "本批": "this batch",
    "全部由": "all by",
    "由狗": "by the dog",
    "为狗": "for the dog",
    "是狗": "is a dog",
    "责任在": "the responsibility lies with",
    "责在": "the responsibility lies with",
    "开启": "enable",
    "输出": "output",
    "使用": "use",
    "符合": "conform to",
    "分钟": "minutes",
    "块算": "block count",
    "行一个": "one per line",
    "行写一个": "write one per line",
    "更加仔细": "more carefully",
    "至少": "at least",
    "块及缩进": "block and indentation",
    "与以上": "and the above",
    "与第": "and No.",
    "为第": "for No.",
    "关于": "about",
    "作为": "as",
    "在左": "on the left",
    "在子": "in sub",
    "曾在": "once in",
    # ---- short connectives / particles (applied last) ----
    "我": "I",
    "您": "you",
    "你": "you",
    "他": "it",
    "它": "it",
    "的": "",
    "了": "",
    "地": "",
    "得": "",
    "着": "",
    "个": "",
    "之": "of",
    "与": "and",
    "及": "and",
    "或": "or",
    "和": "and",
    "并": "and",
    "而": "and",
    "但": "but",
    "在": "in",
    "为": "for",
    "以": "to",
    "因": "because",
    "被": "by",
    "由": "by",
    "让": "let",
    "给": "to",
    "到": "to",
    "至": "to",
    "于": "at",
    "也": "also",
    "都": "all",
    "很": "very",
    "不": "not",
    "没": "no",
    "无": "no",
    "有": "have",
    "是": "is",
    "这": "this",
    "那": "that",
    "本": "this",
    "每": "every",
    "如": "such as",
    "若": "if",
    "即": "i.e.",
    "就": "then",
    "时": "when",
    "内": "within",
    "中": "in",
    "左": "left",
    "右": "right",
    "子": "sub",
    "段": "segment",
    "块": "block",
    "条": "item",
    "项": "item",
    "行": "line",
    "字": "char",
    "第": "No.",
    "批": "batch",
    "位": "position",
    "步": "step",
    "双": "dual",
    "等": "etc.",
    "错了": "was wrong",
    "的错了": "was wrong",
    "不是": "not",
    "对": "to",
    "用": "use",
    "我为": "I for",
    "我的": "my",
    "新增": "newly added",
    "新增加": "newly added",
}

_KEYS = sorted(DICT.keys(), key=len, reverse=True)
_DICT_RE = re.compile("|".join(re.escape(k) for k in _KEYS))
_HAN_RE = re.compile(r"[㐀-鿿〇]+")
_roman_cache = {}

# CJK / full-width punctuation -> ASCII (str.translate table, C-fast)
_PUNCT = {
    "、": ", ", "，": ", ", "。": ". ", "：": ": ", "；": "; ",
    "！": "! ", "？": "? ", "（": " (", "）": ") ", "【": " [", "】": "] ",
    "《": " <", "》": "> ", "「": '"', "」": '"', "『": '"', "』": '"',
    "“": '"', "”": '"', "‘": "'", "’": "'", "…": "...", "—": "-",
    "－": "-", "·": "-", "～": "~", "〜": "~", "、".strip(): ", ",
    "〇": "0", "　": " ", "．": ". ", "／": "/",
}
_TRANS = {ord(k): v for k, v in _PUNCT.items()}
# full-width ASCII (U+FF01-FF5E) -> ASCII (U+0021-007E)
for _o in range(0xFF01, 0xFF5F):
    _TRANS.setdefault(_o, chr(_o - 0xFEE0))


def _roman(run):
    out = _roman_cache.get(run)
    if out is None:
        out = "".join(w.capitalize() for w in lazy_pinyin(run))
        _roman_cache[run] = out
    return out


def to_english(text):
    """Dictionary-translate, then romanize any residual CJK so the result is ASCII."""
    text = _DICT_RE.sub(lambda m: " " + DICT[m.group(0)] + " ", text)
    text = _HAN_RE.sub(lambda m: " " + _roman(m.group(0)) + " ", text)
    text = text.translate(_TRANS)
    # final safety net: fold any remaining non-ASCII (accented Latin from the
    # "trilingual" sections, stray symbols) down to ASCII; undecomposable
    # glyphs are dropped so the output is guaranteed pure ASCII.
    text = unicodedata.normalize("NFKD", text).encode("ascii", "ignore").decode("ascii")
    # tidy spaces but keep line structure
    text = re.sub(r"[ \t]{2,}", " ", text)
    text = re.sub(r" +\n", "\n", text)
    text = re.sub(r"\n +", "\n", text)
    return text


_SLUG_RE = re.compile(r"[^A-Za-z0-9]+")


def slugify(name, ext):
    eng = to_english(name)
    eng = _SLUG_RE.sub("_", eng).strip("_")
    eng = re.sub(r"_+", "_", eng)
    if len(eng) > 110:
        eng = eng[:110].rstrip("_")
    if not eng:
        eng = "apology"
    return eng + ext


def main():
    # 1) gather sources
    files = []
    for d in SOURCE_DIRS:
        ad = os.path.join(REPO, d)
        if os.path.isdir(ad):
            for dp, _, fns in os.walk(ad):
                for fn in fns:
                    files.append(os.path.join(dp, fn))
    for f in SOURCE_FILES:
        af = os.path.join(REPO, f)
        if os.path.isfile(af):
            files.append(af)

    # largest first -> dedup keeps the richest representative
    files.sort(key=lambda p: (-os.path.getsize(p), p))

    keep_re = re.compile(r"[A-Za-z㐀-鿿]+")
    seen_md5, seen_sig = set(), set()
    keepers = []
    dup_exact = dup_near = 0
    for p in files:
        b = open(p, "rb").read()
        md5 = hashlib.md5(b).hexdigest()
        if md5 in seen_md5:
            dup_exact += 1
            continue
        txt = b.decode("utf-8", "ignore")
        sig = hashlib.md5("".join(keep_re.findall(txt)).encode()).hexdigest()
        if sig in seen_sig:
            dup_near += 1
            continue
        seen_md5.add(md5)
        seen_sig.add(sig)
        keepers.append((p, txt))

    # 2) write English archive
    if os.path.isdir(OUT):
        shutil.rmtree(OUT)
    os.makedirs(OUT)

    used = set()
    written = 0
    for p, txt in keepers:
        base, ext = os.path.splitext(os.path.basename(p))
        if ext.lower() not in (".md", ".txt", ".py", ".bak", ".bak2", ".bak3",
                               ".bak4", ".bak5"):
            ext = ext or ".md"
        name = slugify(base, ext)
        stem, e = os.path.splitext(name)
        i = 2
        while name.lower() in used:
            name = f"{stem}_{i}{e}"
            i += 1
        used.add(name.lower())
        with open(os.path.join(OUT, name), "w", encoding="utf-8", newline="\n") as fh:
            fh.write(to_english(txt))
        written += 1
        if written % 300 == 0:
            print(f"  ...written {written}/{len(keepers)}")

    # 3) README
    readme = [
        "# Cursor AI Apology Archive",
        "",
        "Consolidated, English-only archive of every scattered \"Cursor AI apology / "
        "reflection\" directory that previously existed across the repository.",
        "",
        "## What happened",
        "",
        f"- Source files collected : {len(files)}",
        f"- Exact duplicates removed: {dup_exact}",
        f"- Near-identical removed  : {dup_near}",
        f"- Files written here      : {written}",
        "",
        "All filenames and file contents were machine-translated to English "
        "(templated apology phrases via a curated dictionary; the long tail "
        "romanized to pinyin), so this directory is ASCII-only.",
        "",
        "## Merged from",
        "",
    ]
    def _ascii_path(p):
        # keep ASCII path parts; fold any CJK dir/file name to English
        out = []
        for part in p.split("/"):
            if all(ord(c) < 128 for c in part):
                out.append(part)
            else:
                out.append(re.sub(r"[^A-Za-z0-9._-]+", "_",
                                  to_english(part)).strip("_") + " (was Chinese)")
        return "/".join(out)

    for d in SOURCE_DIRS:
        readme.append(f"- `{_ascii_path(d)}`")
    for f in SOURCE_FILES:
        readme.append(f"- `{_ascii_path(f)}`")
    readme.append("")
    with open(os.path.join(OUT, "README.md"), "w", encoding="utf-8", newline="\n") as fh:
        fh.write("\n".join(readme))

    # 4) remove sources
    for d in SOURCE_DIRS:
        ad = os.path.join(REPO, d)
        if os.path.isdir(ad):
            shutil.rmtree(ad)
    for f in SOURCE_FILES:
        af = os.path.join(REPO, f)
        if os.path.isfile(af):
            os.remove(af)

    print(f"\nDONE. collected={len(files)} exact_dups={dup_exact} "
          f"near_dups={dup_near} written={written}")
    print(f"Archive: {OUT}")


if __name__ == "__main__":
    main()
