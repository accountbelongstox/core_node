# -*- coding: utf-8 -*-
"""
Video presets of the audio-orchestration output.

A preset is one JSON-serializable settings document (fonts, sizes, colours,
scroll behaviour, languages, background). Built-in presets ship with the code
and are read-only; user presets live in ``video_presets.json`` next to the task
records. Every settings document passes through ``sanitize`` before it is
stored or rendered, so the renderer only ever sees clamped, complete values.

Default look: a white canvas, serif sentence captions with a thin outline, and
word "chips" (opaque boxed text) with the Chinese meaning underneath in a
different font, every card bilingual (English + Chinese) unless the preset
restricts ``languages`` to one of them.
"""

import re
import shutil
import sys
import uuid
from pathlib import Path
from typing import Any, Dict, List, Optional

from pycore.pyctl.audio_orchestration import orch_store
from pycore.pyutils.common.ffmpeg.ffmpeg_command import (
    BACKGROUND_KIND_COLOR,
    BACKGROUND_KIND_IMAGE,
    BACKGROUND_KIND_VIDEO,
)
from pycore.pyutils.common.ffmpeg.ffmpeg_scroll import SCROLL_SMOOTH, SCROLL_STEP

DEFAULT_PRESET_ID = "clean_white"
PRESET_VERSION = 1
LANGUAGES_BOTH = "both"
LANGUAGES_EN = "en"
LANGUAGES_ZH = "zh"
LANGUAGE_CHOICES = (LANGUAGES_BOTH, LANGUAGES_EN, LANGUAGES_ZH)
SCROLL_CHOICES = (SCROLL_STEP, SCROLL_SMOOTH)
BACKGROUND_CHOICES = (BACKGROUND_KIND_COLOR, BACKGROUND_KIND_IMAGE, BACKGROUND_KIND_VIDEO)
IMAGE_EXTENSIONS = (".png", ".jpg", ".jpeg", ".webp", ".bmp")
VIDEO_EXTENSIONS = (".mp4", ".mov", ".mkv", ".webm", ".avi", ".m4v")
MAX_USER_PRESETS = 50
MAX_NAME_LENGTH = 60
MAX_FONT_LENGTH = 60
_COLOR_RE = re.compile(r"^#[0-9A-Fa-f]{6}([0-9A-Fa-f]{2})?$")
_ID_RE = re.compile(r"[^a-z0-9_]+")

WINDOWS_FONT_DIRECTORY = "C:/Windows/Fonts"
LINUX_FONT_DIRECTORIES = ("/usr/share/fonts", "/usr/local/share/fonts")

# family -> (file that proves it on Windows, is CJK capable, is serif)
_WINDOWS_FONTS = {
    "Microsoft YaHei": ("msyh.ttc", True, False),
    "Microsoft YaHei UI": ("msyh.ttc", True, False),
    "SimHei": ("simhei.ttf", True, False),
    "SimSun": ("simsun.ttc", True, True),
    "KaiTi": ("simkai.ttf", True, True),
    "FangSong": ("simfang.ttf", True, True),
    "Segoe UI": ("segoeui.ttf", False, False),
    "Arial": ("arial.ttf", False, False),
    "Verdana": ("verdana.ttf", False, False),
    "Calibri": ("calibri.ttf", False, False),
    "Trebuchet MS": ("trebuc.ttf", False, False),
    "Bahnschrift": ("bahnschrift.ttf", False, False),
    "Georgia": ("georgia.ttf", False, True),
    "Times New Roman": ("times.ttf", False, True),
    "Cambria": ("cambria.ttc", False, True),
    "Comic Sans MS": ("comic.ttf", False, False),
    "Impact": ("impact.ttf", False, False),
    "Consolas": ("consola.ttf", False, False),
}
_LINUX_FONTS = {
    "Noto Sans CJK SC": (True, False),
    "Noto Serif CJK SC": (True, True),
    "WenQuanYi Micro Hei": (True, False),
    "DejaVu Sans": (False, False),
    "DejaVu Serif": (False, True),
    "Liberation Sans": (False, False),
    "Liberation Serif": (False, True),
}
_PREFERRED_EN_SERIF = ("Georgia", "Times New Roman", "Noto Serif CJK SC", "DejaVu Serif", "Liberation Serif")
_PREFERRED_EN_SANS = ("Segoe UI", "Arial", "Noto Sans CJK SC", "DejaVu Sans", "Liberation Sans")
_PREFERRED_ZH = ("Microsoft YaHei", "SimHei", "Noto Sans CJK SC", "WenQuanYi Micro Hei")


def _installed_families() -> List[Dict[str, Any]]:
    families: List[Dict[str, Any]] = []
    if sys.platform == "win32":
        for family, (file_name, cjk, serif) in _WINDOWS_FONTS.items():
            families.append({
                "family": family, "cjk": cjk, "serif": serif,
                "available": (Path(WINDOWS_FONT_DIRECTORY) / file_name).is_file(),
            })
        return families
    roots = [Path(root) for root in LINUX_FONT_DIRECTORIES if Path(root).is_dir()]
    names = " ".join(
        path.name.lower() for root in roots for path in root.rglob("*") if path.suffix.lower() in (".ttf", ".otf", ".ttc")
    )
    for family, (cjk, serif) in _LINUX_FONTS.items():
        token = re.sub(r"[^a-z]", "", family.lower())
        families.append({
            "family": family, "cjk": cjk, "serif": serif,
            "available": token in re.sub(r"[^a-z ]", "", names).replace(" ", ""),
        })
    return families


def font_catalog() -> Dict[str, Any]:
    return {
        "fonts": _installed_families(),
        "fonts_directory": fonts_directory(),
    }


def fonts_directory() -> Optional[str]:
    if sys.platform == "win32":
        return WINDOWS_FONT_DIRECTORY if Path(WINDOWS_FONT_DIRECTORY).is_dir() else None
    return next((root for root in LINUX_FONT_DIRECTORIES if Path(root).is_dir()), None)


def _first_available(preferred: tuple) -> str:
    available = {entry["family"] for entry in _installed_families() if entry["available"]}
    return next((family for family in preferred if family in available), preferred[0])


def default_settings() -> Dict[str, Any]:
    """The Clean White look on this machine's best available fonts."""
    return {
        "version": PRESET_VERSION,
        "languages": LANGUAGES_BOTH,
        "fps": 30,
        "show_progress_bar": True,
        "progress_color": "#4F46E5",
        "opacity_upcoming": 0.78,
        "opacity_past": 0.4,
        "layout": {
            "scroll_mode": SCROLL_STEP,
            "scroll_seconds": 0.55,
            "focus_y": 0.42,
            "column_width": 0.8,
            "card_gap": 54,
            "line_gap": 12,
        },
        "sentence": {
            "font_en": _first_available(_PREFERRED_EN_SERIF),
            "font_zh": _first_available(_PREFERRED_ZH),
            "size_en": 48,
            "size_zh": 38,
            "bold": True,
            "text": "#1E293B",
            "active": "#0B57D0",
            "outline_color": "#FFFFFF",
            "outline": 2,
        },
        "word": {
            "font_en": _first_available(_PREFERRED_EN_SANS),
            "font_zh": _first_available(_PREFERRED_ZH),
            "size_en": 44,
            "size_zh": 32,
            "bold": True,
            "text": "#3730A3",
            "active": "#FFFFFF",
            "box": "#E0E7FF",
            "box_active": "#4F46E5",
            "box_padding": 14,
            "meaning": "#64748B",
            "meaning_active": "#4F46E5",
        },
        "background": {
            "kind": BACKGROUND_KIND_COLOR,
            "color": "#FFFFFF",
            "path": "",
            "dim": 0.35,
        },
    }


def _theme(name: str, patch: Dict[str, Any]) -> Dict[str, Any]:
    settings = default_settings()
    for group, values in patch.items():
        if isinstance(values, dict):
            settings[group].update(values)
        else:
            settings[group] = values
    return {"id": _ID_RE.sub("_", name.lower()), "name": name, "builtin": True, "settings": settings}


def builtin_presets() -> List[Dict[str, Any]]:
    return [
        {"id": DEFAULT_PRESET_ID, "name": "Clean White", "builtin": True, "settings": default_settings()},
        _theme("Night Study", {
            "progress_color": "#38BDF8",
            "opacity_past": 0.35,
            "sentence": {"text": "#E2E8F0", "active": "#7DD3FC", "outline_color": "#020617"},
            "word": {
                "text": "#C7D2FE", "active": "#0F172A", "box": "#1E293B", "box_active": "#FBBF24",
                "meaning": "#94A3B8", "meaning_active": "#FBBF24",
            },
            "background": {"kind": BACKGROUND_KIND_COLOR, "color": "#0B1220"},
        }),
        _theme("Warm Paper", {
            "progress_color": "#B45309",
            "sentence": {"text": "#3F2F1F", "active": "#B45309", "outline_color": "#FFF7E6"},
            "word": {
                "text": "#7C2D12", "active": "#FFFFFF", "box": "#FDE7C7", "box_active": "#C2410C",
                "meaning": "#8A6D4B", "meaning_active": "#C2410C",
            },
            "background": {"kind": BACKGROUND_KIND_COLOR, "color": "#FFF7E6"},
        }),
    ]


# --------------------------------------------------------------------------- #
# sanitize                                                                     #
# --------------------------------------------------------------------------- #
def _number(value: Any, default: float, low: float, high: float) -> float:
    if isinstance(value, bool) or not isinstance(value, (int, float, str)):
        return default
    text = str(value).strip()
    if not re.fullmatch(r"-?\d+(\.\d+)?", text):
        return default
    return min(high, max(low, float(text)))


def _integer(value: Any, default: int, low: int, high: int) -> int:
    return int(round(_number(value, default, low, high)))


def _color(value: Any, default: str) -> str:
    text = str(value or "").strip()
    return text.upper() if _COLOR_RE.fullmatch(text) else default


def _choice(value: Any, choices: tuple, default: str) -> str:
    return value if value in choices else default


def _font(value: Any, default: str) -> str:
    text = re.sub(r"[,{}\\\r\n]", " ", str(value or "")).strip()[:MAX_FONT_LENGTH]
    return text or default


def _flag(value: Any, default: bool) -> bool:
    return value if isinstance(value, bool) else default


def _managed_background(value: Any) -> str:
    """A background path is only accepted inside the managed background folder
    (``import_background`` puts files there): a preset must never make ffmpeg
    read an arbitrary local file, whoever supplied the settings."""
    text = str(value or "").strip()
    if not text:
        return ""
    managed = orch_store.video_backgrounds_dir().resolve()
    candidate = Path(text).resolve()
    return str(candidate) if candidate.parent == managed and background_kind_of(text) else ""


def sanitize(raw: Any) -> Dict[str, Any]:
    """Complete, clamped settings: unknown keys are dropped, missing or invalid
    values fall back to the defaults."""
    base = default_settings()
    source = raw if isinstance(raw, dict) else {}
    layout_in = source.get("layout") if isinstance(source.get("layout"), dict) else {}
    sentence_in = source.get("sentence") if isinstance(source.get("sentence"), dict) else {}
    word_in = source.get("word") if isinstance(source.get("word"), dict) else {}
    background_in = source.get("background") if isinstance(source.get("background"), dict) else {}
    layout, sentence, word, background = base["layout"], base["sentence"], base["word"], base["background"]
    path = _managed_background(background_in.get("path"))
    kind = _choice(background_in.get("kind"), BACKGROUND_CHOICES, background["kind"])
    return {
        "version": PRESET_VERSION,
        "languages": _choice(source.get("languages"), LANGUAGE_CHOICES, base["languages"]),
        "fps": _choice(_integer(source.get("fps"), base["fps"], 15, 60), (15, 24, 25, 30, 50, 60), base["fps"]),
        "show_progress_bar": _flag(source.get("show_progress_bar"), base["show_progress_bar"]),
        "progress_color": _color(source.get("progress_color"), base["progress_color"]),
        "opacity_upcoming": _number(source.get("opacity_upcoming"), base["opacity_upcoming"], 0.1, 1.0),
        "opacity_past": _number(source.get("opacity_past"), base["opacity_past"], 0.05, 1.0),
        "layout": {
            "scroll_mode": _choice(layout_in.get("scroll_mode"), SCROLL_CHOICES, layout["scroll_mode"]),
            "scroll_seconds": _number(layout_in.get("scroll_seconds"), layout["scroll_seconds"], 0.1, 3.0),
            "focus_y": _number(layout_in.get("focus_y"), layout["focus_y"], 0.15, 0.85),
            "column_width": _number(layout_in.get("column_width"), layout["column_width"], 0.4, 0.95),
            "card_gap": _integer(layout_in.get("card_gap"), layout["card_gap"], 10, 200),
            "line_gap": _integer(layout_in.get("line_gap"), layout["line_gap"], 0, 60),
        },
        "sentence": {
            "font_en": _font(sentence_in.get("font_en"), sentence["font_en"]),
            "font_zh": _font(sentence_in.get("font_zh"), sentence["font_zh"]),
            "size_en": _integer(sentence_in.get("size_en"), sentence["size_en"], 18, 110),
            "size_zh": _integer(sentence_in.get("size_zh"), sentence["size_zh"], 16, 100),
            "bold": _flag(sentence_in.get("bold"), sentence["bold"]),
            "text": _color(sentence_in.get("text"), sentence["text"]),
            "active": _color(sentence_in.get("active"), sentence["active"]),
            "outline_color": _color(sentence_in.get("outline_color"), sentence["outline_color"]),
            "outline": _integer(sentence_in.get("outline"), sentence["outline"], 0, 8),
        },
        "word": {
            "font_en": _font(word_in.get("font_en"), word["font_en"]),
            "font_zh": _font(word_in.get("font_zh"), word["font_zh"]),
            "size_en": _integer(word_in.get("size_en"), word["size_en"], 18, 110),
            "size_zh": _integer(word_in.get("size_zh"), word["size_zh"], 16, 90),
            "bold": _flag(word_in.get("bold"), word["bold"]),
            "text": _color(word_in.get("text"), word["text"]),
            "active": _color(word_in.get("active"), word["active"]),
            "box": _color(word_in.get("box"), word["box"]),
            "box_active": _color(word_in.get("box_active"), word["box_active"]),
            "box_padding": _integer(word_in.get("box_padding"), word["box_padding"], 4, 40),
            "meaning": _color(word_in.get("meaning"), word["meaning"]),
            "meaning_active": _color(word_in.get("meaning_active"), word["meaning_active"]),
        },
        "background": {
            "kind": kind if kind == BACKGROUND_KIND_COLOR or path else BACKGROUND_KIND_COLOR,
            "color": _color(background_in.get("color"), background["color"]),
            "path": path,
            "dim": _number(background_in.get("dim"), background["dim"], 0.0, 0.9),
        },
    }


# --------------------------------------------------------------------------- #
# store                                                                        #
# --------------------------------------------------------------------------- #
def _state() -> Dict[str, Any]:
    stored = orch_store.load_video_presets()
    presets = stored.get("presets") if isinstance(stored.get("presets"), dict) else {}
    return {"active": str(stored.get("active") or DEFAULT_PRESET_ID), "presets": presets}


def _known_ids() -> List[str]:
    return [preset["id"] for preset in builtin_presets()] + list(_state()["presets"])


def list_presets() -> Dict[str, Any]:
    state = _state()
    presets = [
        {"id": preset["id"], "name": preset["name"], "builtin": True, "settings": sanitize(preset["settings"])}
        for preset in builtin_presets()
    ]
    presets.extend(
        {"id": preset_id, "name": str(entry.get("name") or preset_id), "builtin": False,
         "settings": sanitize(entry.get("settings"))}
        for preset_id, entry in state["presets"].items() if isinstance(entry, dict)
    )
    active = state["active"] if state["active"] in {preset["id"] for preset in presets} else DEFAULT_PRESET_ID
    return {"success": True, "active": active, "presets": presets, "default_settings": default_settings(), **font_catalog()}


def resolve_settings(preset_id: str = "") -> Dict[str, Any]:
    """Sanitized settings of ``preset_id`` (empty = the active preset)."""
    listing = list_presets()
    wanted = str(preset_id or "").strip() or listing["active"]
    found = next((preset for preset in listing["presets"] if preset["id"] == wanted), None)
    if found is None:
        found = next(preset for preset in listing["presets"] if preset["id"] == listing["active"])
    return found["settings"]


def save_preset(preset_id: str, name: str, settings: Any, activate: bool = False) -> Dict[str, Any]:
    """Create (empty ``preset_id``) or overwrite a user preset."""
    clean_name = str(name or "").strip()[:MAX_NAME_LENGTH]
    if not clean_name:
        return {"success": False, "error": "ORCH_VIDEO_PRESET_NAME_REQUIRED"}
    state = _state()
    preset_id = str(preset_id or "").strip()
    if preset_id in [preset["id"] for preset in builtin_presets()]:
        return {"success": False, "error": "ORCH_VIDEO_PRESET_BUILTIN_READONLY"}
    if not preset_id:
        if len(state["presets"]) >= MAX_USER_PRESETS:
            return {"success": False, "error": "ORCH_VIDEO_PRESET_LIMIT"}
        preset_id = "preset_" + uuid.uuid4().hex[:10]
    state["presets"][preset_id] = {"name": clean_name, "settings": sanitize(settings)}
    if activate:
        state["active"] = preset_id
    if not orch_store.save_video_presets(state):
        return {"success": False, "error": "ORCH_VIDEO_PRESET_SAVE_FAILED"}
    return {**list_presets(), "preset_id": preset_id}


def delete_preset(preset_id: str) -> Dict[str, Any]:
    state = _state()
    preset_id = str(preset_id or "").strip()
    if preset_id not in state["presets"]:
        return {"success": False, "error": "ORCH_VIDEO_PRESET_NOT_FOUND"}
    state["presets"].pop(preset_id)
    if state["active"] == preset_id:
        state["active"] = DEFAULT_PRESET_ID
    if not orch_store.save_video_presets(state):
        return {"success": False, "error": "ORCH_VIDEO_PRESET_SAVE_FAILED"}
    return list_presets()


def activate_preset(preset_id: str) -> Dict[str, Any]:
    preset_id = str(preset_id or "").strip()
    if preset_id not in _known_ids():
        return {"success": False, "error": "ORCH_VIDEO_PRESET_NOT_FOUND"}
    state = _state()
    state["active"] = preset_id
    if not orch_store.save_video_presets(state):
        return {"success": False, "error": "ORCH_VIDEO_PRESET_SAVE_FAILED"}
    return list_presets()


# --------------------------------------------------------------------------- #
# background media                                                             #
# --------------------------------------------------------------------------- #
def background_kind_of(path: str) -> str:
    suffix = Path(path).suffix.lower()
    if suffix in IMAGE_EXTENSIONS:
        return BACKGROUND_KIND_IMAGE
    if suffix in VIDEO_EXTENSIONS:
        return BACKGROUND_KIND_VIDEO
    return ""


def import_background(source_path: str) -> Dict[str, Any]:
    """Copy a local image or video into the managed background folder (so the
    preset keeps working when the original moves) and return its stored path
    and kind."""
    source = Path(str(source_path or "").strip().strip('"'))
    kind = background_kind_of(str(source))
    if not kind:
        return {"success": False, "error": "ORCH_VIDEO_BACKGROUND_UNSUPPORTED"}
    if not source.is_file():
        return {"success": False, "error": "ORCH_VIDEO_BACKGROUND_NOT_FOUND"}
    target = orch_store.video_backgrounds_dir() / f"{uuid.uuid4().hex[:12]}{source.suffix.lower()}"
    shutil.copy2(str(source), str(target))
    return {"success": True, "path": str(target), "kind": kind, "name": source.name}


__all__ = [
    "DEFAULT_PRESET_ID",
    "LANGUAGES_BOTH",
    "LANGUAGES_EN",
    "LANGUAGES_ZH",
    "activate_preset",
    "background_kind_of",
    "default_settings",
    "delete_preset",
    "font_catalog",
    "fonts_directory",
    "import_background",
    "list_presets",
    "resolve_settings",
    "sanitize",
    "save_preset",
]
