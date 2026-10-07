# -*- coding: utf-8 -*-
"""
Video output of the audio orchestration.

A finished segment (assembled audio + per-clip ``timeline``) is rendered as a
720p video: the segment audio over a white (or image / video) canvas with the
sentences and words scrolling as bilingual cards. The card being played sits on
the focus line, played cards keep scrolling away above it and cards not played
yet are already visible below it (``pyutils/common/ffmpeg/ffmpeg_scroll``).

Everything visual comes from a preset (``orch_video_presets``); the shared
ffmpeg library builds the ASS file and the command and runs it.
"""

import base64
import hashlib
import os
from pathlib import Path
from typing import Any, Callable, Dict, List, Optional, Tuple

from pycore.pyctl.audio_orchestration import orch_contract, orch_store, orch_video_presets as presets
from pycore.pyfoundations.pybasecommon.color_print import ColorPrint
from pycore.pyutils.common.ffmpeg.ffmpeg_command import (
    BACKGROUND_KIND_COLOR,
    ffmpeg_command_builder,
)
from pycore.pyutils.common.ffmpeg.ffmpeg_models import SubtitleRenderSource, VideoBackground
from pycore.pyutils.common.ffmpeg.ffmpeg_runner import ffmpeg_runner
from pycore.pyutils.common.ffmpeg.ffmpeg_scroll import (
    BORDER_BOX,
    BORDER_OUTLINE,
    STATE_ACTIVE,
    STATE_COMPANION,
    STATE_PAST,
    STATE_UPCOMING,
    ScrollCard,
    ScrollLayout,
    ScrollLine,
    ScrollRoleStyle,
    scroll_cue_builder,
)
from pycore.pyutils.common.ffmpeg.ffmpeg_subtitle import ass_subtitle_writer
from pycore.pyutils.translator.dictionary import dictionary_service

VIDEO_RESOLUTION = (1280, 720)
VIDEO_EXTENSION = ".mp4"
ERROR_NO_TIMELINE = "orch_video_no_timeline"
ERROR_NO_MANIFEST = "orch_video_no_manifest"
ERROR_NO_AUDIO = "orch_video_no_audio"
ERROR_NO_CARDS = "orch_video_no_cards"
ERROR_RENDER_FAILED = "orch_video_render_failed"
ROLE_SENTENCE_EN = "sentence_en"
ROLE_SENTENCE_ZH = "sentence_zh"
ROLE_WORD = "word"
ROLE_WORD_MEANING = "word_meaning"
LANGUAGE_EN = "en"
LANGUAGE_ZH = "zh"
MAX_MEANING_SENSES = 2
MAX_MEANING_CHARS = 26
PROGRESS_TRACK_OPACITY = 0.16
SHADOW_COLOR = "#0F172A30"
PREVIEW_DIR = "video_preview"
# Sample content of the preset preview (ASCII escapes keep the source ASCII).
PREVIEW_SAMPLE = (
    ("sentence", "Learning a language is a journey, not a race.",
     "\u5b66\u4e60\u8bed\u8a00\u662f\u4e00\u6bb5\u65c5\u7a0b\uff0c\u800c\u4e0d\u662f\u4e00\u573a\u6bd4\u8d5b\u3002"),
    ("word", "journey", "\u65c5\u7a0b"),
    ("sentence", "Keep going and enjoy every step.",
     "\u7ee7\u7eed\u524d\u8fdb\uff0c\u4eab\u53d7\u6bcf\u4e00\u6b65\u3002"),
)


# --------------------------------------------------------------------------- #
# style                                                                        #
# --------------------------------------------------------------------------- #
def _alpha(color: str, opacity: float) -> str:
    """``#RRGGBB`` with an alpha byte (FF = opaque)."""
    return f"{color[:7]}{int(round(min(1.0, max(0.0, opacity)) * 255)):02X}"


def role_styles(settings: Dict[str, Any]) -> Dict[str, ScrollRoleStyle]:
    upcoming = float(settings["opacity_upcoming"])
    past = float(settings["opacity_past"])
    sentence, word = settings["sentence"], settings["word"]
    outline_color = sentence["outline_color"]

    def sentence_role(font: str, size: int) -> ScrollRoleStyle:
        return ScrollRoleStyle(
            font_name=font, font_size=size, bold=bool(sentence["bold"]),
            border_style=BORDER_OUTLINE, outline=int(sentence["outline"]), shadow=1,
            colors={
                STATE_UPCOMING: (_alpha(sentence["text"], upcoming), _alpha(outline_color, upcoming), SHADOW_COLOR),
                STATE_ACTIVE: (sentence["active"], outline_color, SHADOW_COLOR),
                STATE_COMPANION: (sentence["text"], outline_color, SHADOW_COLOR),
                STATE_PAST: (_alpha(sentence["text"], past), _alpha(outline_color, past), SHADOW_COLOR),
            },
        )

    chip_states = {
        STATE_UPCOMING: (_alpha(word["text"], upcoming), _alpha(word["box"], upcoming), "#00000000"),
        STATE_ACTIVE: (word["active"], word["box_active"], "#00000000"),
        STATE_COMPANION: (word["active"], word["box_active"], "#00000000"),
        STATE_PAST: (_alpha(word["text"], past), _alpha(word["box"], past), "#00000000"),
    }
    meaning_states = {
        STATE_UPCOMING: (_alpha(word["meaning"], upcoming), _alpha(outline_color, upcoming), SHADOW_COLOR),
        STATE_ACTIVE: (word["meaning_active"], outline_color, SHADOW_COLOR),
        STATE_COMPANION: (word["meaning_active"], outline_color, SHADOW_COLOR),
        STATE_PAST: (_alpha(word["meaning"], past), _alpha(outline_color, past), SHADOW_COLOR),
    }
    return {
        ROLE_SENTENCE_EN: sentence_role(sentence["font_en"], int(sentence["size_en"])),
        ROLE_SENTENCE_ZH: sentence_role(sentence["font_zh"], int(sentence["size_zh"])),
        ROLE_WORD: ScrollRoleStyle(
            font_name=word["font_en"], font_size=int(word["size_en"]), bold=bool(word["bold"]),
            border_style=BORDER_BOX, outline=int(word["box_padding"]), shadow=0, colors=chip_states,
        ),
        ROLE_WORD_MEANING: ScrollRoleStyle(
            font_name=word["font_zh"], font_size=int(word["size_zh"]), bold=False,
            border_style=BORDER_OUTLINE, outline=1, shadow=1, colors=meaning_states,
        ),
    }


def scroll_layout(settings: Dict[str, Any]) -> ScrollLayout:
    layout = settings["layout"]
    return ScrollLayout(
        scroll_mode=str(layout["scroll_mode"]),
        scroll_seconds=float(layout["scroll_seconds"]),
        focus_y=float(layout["focus_y"]),
        column_width=float(layout["column_width"]),
        card_gap=int(layout["card_gap"]),
        line_gap=int(layout["line_gap"]),
    )


def video_background(settings: Dict[str, Any]) -> VideoBackground:
    background = settings["background"]
    path = Path(str(background["path"])) if background["path"] else None
    if background["kind"] != BACKGROUND_KIND_COLOR and path is not None and path.is_file():
        return VideoBackground(
            kind=background["kind"], color=background["color"], source=path,
            dim_opacity=float(background["dim"]),
        )
    return VideoBackground(color=background["color"])


# --------------------------------------------------------------------------- #
# cards                                                                        #
# --------------------------------------------------------------------------- #
def _normalize(text: Any) -> str:
    return " ".join(str(text or "").split())


def _sentence_index(sentences: List[Dict[str, Any]]) -> Dict[str, Dict[str, Any]]:
    """Any text of a sentence (its own language or a translation) -> the sentence
    record, so a spoken clip finds the sentence it belongs to."""
    index: Dict[str, Dict[str, Any]] = {}
    for sentence in sentences:
        texts = [sentence.get("text"), *(sentence.get("languages") or {}).values()]
        for text in texts:
            key = _normalize(text)
            if key:
                index.setdefault(key, sentence)
    return index


def short_meaning(translation: Optional[str]) -> str:
    """One concise Chinese gloss of an ECDICT translation column."""
    if not translation:
        return ""
    first = str(translation).splitlines()[0].strip()
    parts = [part.strip() for part in first.replace(";", ",").replace("\uff1b", ",").replace("\uff0c", ",").split(",") if part.strip()]
    return ", ".join(parts[:MAX_MEANING_SENSES])[:MAX_MEANING_CHARS]


def _sentence_texts(sentence: Optional[Dict[str, Any]], spoken: Dict[str, str]) -> Dict[str, str]:
    """English / Chinese text of one card: the sentence record first, the
    spoken clip texts as the fallback for a sentence without a translation."""
    texts: Dict[str, str] = {}
    languages = (sentence or {}).get("languages") or {}
    for language in (LANGUAGE_EN, LANGUAGE_ZH):
        text = _normalize(languages.get(language)) or _normalize(spoken.get(language))
        if not text and sentence is not None and str(sentence.get("language") or "") == language:
            text = _normalize(sentence.get("text"))
        if text:
            texts[language] = text
    return texts


def build_cards(
    items: List[Dict[str, Any]],
    timeline: List[Dict[str, Any]],
    sentences: List[Dict[str, Any]],
    languages: str,
) -> List[ScrollCard]:
    """Group consecutive clips of the same sentence (or repeats of the same
    word or phrase) into one bilingual card; each line keeps the playback spans
    of the clips that speak it. A phrase card is a word-style chip with its
    spoken Chinese meaning (a clip carrying ``meaning_of``) underneath."""
    index = _sentence_index(sentences)
    by_seq = {str(sentence.get("seq")): sentence for sentence in sentences if sentence.get("seq") is not None}
    meanings: Dict[str, str] = {}
    groups: List[Dict[str, Any]] = []
    for item, entry in zip(items, timeline):
        span = (float(entry.get("start_ms") or 0) / 1000.0, float(entry.get("end_ms") or 0) / 1000.0)
        text = _normalize(item.get("text"))
        language = LANGUAGE_ZH if str(item.get("language") or "").lower().startswith(LANGUAGE_ZH) else LANGUAGE_EN
        meaning_of = _normalize(item.get("meaning_of"))
        if meaning_of and groups and groups[-1]["text"].lower() == meaning_of.lower():
            groups[-1]["meaning"] = text
            groups[-1]["all"].append(span)
            continue
        if item.get("kind") == "word":
            key: Tuple[str, str] = ("word", text.lower())
            sentence = None
        elif item.get("kind") == orch_contract.PHRASE_KIND:
            key = (orch_contract.PHRASE_KIND, text.lower())
            sentence = None
        else:
            # The clip's own sentence: by the sentence seq the manifest stamped
            # on the item, else by any of its texts.
            sentence = by_seq.get(str(item.get("seq"))) or index.get(text)
            key = ("sentence", str(sentence.get("seq")) if sentence is not None and sentence.get("seq") is not None else text)
        if groups and groups[-1]["key"] == key:
            group = groups[-1]
        else:
            group = {"key": key, "kind": key[0], "sentence": sentence, "text": text, "meaning": "",
                     "spoken": {}, "spans": {LANGUAGE_EN: [], LANGUAGE_ZH: []}, "all": []}
            groups.append(group)
        group["spoken"].setdefault(language, text)
        group["spans"][language].append(span)
        group["all"].append(span)

    cards: List[ScrollCard] = []
    for group in groups:
        lines: List[ScrollLine] = []
        if group["kind"] == "word":
            word = group["text"]
            if word not in meanings:
                meanings[word] = short_meaning(dictionary_service.translate(word, LANGUAGE_ZH))
            if languages != presets.LANGUAGES_ZH or not meanings[word]:
                lines.append(ScrollLine(word, ROLE_WORD, tuple(group["all"])))
            if languages != presets.LANGUAGES_EN and meanings[word]:
                lines.append(ScrollLine(meanings[word], ROLE_WORD_MEANING, tuple(group["all"])))
        elif group["kind"] == orch_contract.PHRASE_KIND:
            meaning = group["meaning"]
            if languages != presets.LANGUAGES_ZH or not meaning:
                lines.append(ScrollLine(group["text"], ROLE_WORD, tuple(group["all"])))
            if languages != presets.LANGUAGES_EN and meaning:
                lines.append(ScrollLine(meaning, ROLE_WORD_MEANING, tuple(group["all"])))
        else:
            texts = _sentence_texts(group["sentence"], group["spoken"])
            for language, role in ((LANGUAGE_EN, ROLE_SENTENCE_EN), (LANGUAGE_ZH, ROLE_SENTENCE_ZH)):
                if language not in texts or (languages not in (presets.LANGUAGES_BOTH, language) and texts):
                    continue
                lines.append(ScrollLine(texts[language], role, tuple(group["spans"][language])))
            if not lines and texts:
                language = next(iter(texts))
                lines.append(ScrollLine(
                    texts[language],
                    ROLE_SENTENCE_ZH if language == LANGUAGE_ZH else ROLE_SENTENCE_EN,
                    tuple(group["all"]),
                ))
        if lines:
            cards.append(ScrollCard(tuple(lines)))
    return cards


# --------------------------------------------------------------------------- #
# render                                                                       #
# --------------------------------------------------------------------------- #
def _compose(
    cards: List[ScrollCard],
    settings: Dict[str, Any],
    duration: float,
    ass_path: Path,
) -> Optional[Path]:
    cues = scroll_cue_builder.build(cards, role_styles(settings), scroll_layout(settings), VIDEO_RESOLUTION, duration)
    return ass_subtitle_writer.materialize(cues, ass_path, VIDEO_RESOLUTION)


def render_segment(
    audio_path: Path,
    output_path: Path,
    ass_path: Path,
    items: List[Dict[str, Any]],
    timeline: List[Dict[str, Any]],
    sentences: List[Dict[str, Any]],
    settings: Dict[str, Any],
    duration_ms: Optional[int],
    should_stop: Optional[Callable[[], bool]] = None,
    progress_callback: Optional[Callable[[Any], None]] = None,
) -> Dict[str, Any]:
    """Render one segment video. Returns ``{success, cards}`` or
    ``{success: False, error}`` (an ``ERROR_*`` code)."""
    if not timeline or len(timeline) != len(items):
        return {"success": False, "error": ERROR_NO_TIMELINE}
    cards = build_cards(items, timeline, sentences, str(settings["languages"]))
    duration = max(float(duration_ms or 0) / 1000.0, float(timeline[-1].get("end_ms") or 0) / 1000.0)
    ass = _compose(cards, settings, duration, ass_path)
    if ass is None:
        return {"success": False, "error": ERROR_NO_CARDS}
    track = f"0x{settings['progress_color'][1:7]}@{PROGRESS_TRACK_OPACITY}"
    arguments = ffmpeg_command_builder.compose_audio_canvas(
        audio_path, duration, VIDEO_RESOLUTION,
        subtitle_sources=(SubtitleRenderSource(path=ass),),
        fonts_directory=presets.fonts_directory(),
        show_progress=bool(settings["show_progress_bar"]),
        frame_rate=int(settings["fps"]),
        progress_track_color=track,
        progress_fill_color=str(settings["progress_color"]),
        background=video_background(settings),
    )
    partial = output_path.with_name(f"{output_path.stem}.partial{VIDEO_EXTENSION}")
    result = ffmpeg_runner.run_ffmpeg((*arguments, str(partial)), progress_callback, should_stop)
    if not result.success or not partial.is_file() or partial.stat().st_size == 0:
        if partial.is_file():
            partial.unlink()
        ColorPrint.yellow(f"[AudioOrch] video render failed for {output_path.name}: {result.error_code} {result.stderr[-400:]}")
        return {"success": False, "error": ERROR_RENDER_FAILED, "stopped": result.stopped}
    os.replace(str(partial), str(output_path))
    return {"success": True, "cards": len(cards)}


def preview(settings: Any) -> Dict[str, Any]:
    """One PNG frame of the given settings on sample content: a sentence already
    played (top), a word being played (focus line) and the next sentence still
    to play (bottom)."""
    clean = presets.sanitize(settings)
    en_span, zh_span, word_span, next_span = (0.0, 1.5), (1.5, 3.0), (3.2, 4.4), (4.8, 6.4)
    sentence_a, word, sentence_b = PREVIEW_SAMPLE
    both = clean["languages"]
    cards = [
        ScrollCard(tuple(line for line in (
            ScrollLine(sentence_a[1], ROLE_SENTENCE_EN, (en_span,)) if both != presets.LANGUAGES_ZH else None,
            ScrollLine(sentence_a[2], ROLE_SENTENCE_ZH, (zh_span,)) if both != presets.LANGUAGES_EN else None,
        ) if line is not None)),
        ScrollCard(tuple(line for line in (
            ScrollLine(word[1], ROLE_WORD, (word_span,)) if both != presets.LANGUAGES_ZH else None,
            ScrollLine(word[2], ROLE_WORD_MEANING, (word_span,)) if both != presets.LANGUAGES_EN else None,
        ) if line is not None)),
        ScrollCard(tuple(line for line in (
            ScrollLine(sentence_b[1], ROLE_SENTENCE_EN, (next_span,)) if both != presets.LANGUAGES_ZH else None,
            ScrollLine(sentence_b[2], ROLE_SENTENCE_ZH, (next_span,)) if both != presets.LANGUAGES_EN else None,
        ) if line is not None)),
    ]
    at_seconds = 3.8
    directory = orch_store.base_dir() / PREVIEW_DIR
    directory.mkdir(parents=True, exist_ok=True)
    key = hashlib.sha1(repr(sorted(clean.items(), key=lambda item: item[0])).encode("utf-8")).hexdigest()[:16]
    png = directory / f"preview_{key}.png"
    if not png.is_file():
        ass = _compose(cards, clean, 7.0, directory / f"preview_{key}.ass")
        if ass is None:
            return {"success": False, "error": ERROR_NO_CARDS}
        arguments = ffmpeg_command_builder.compose_frame_preview(
            at_seconds, VIDEO_RESOLUTION, (SubtitleRenderSource(path=ass),), png,
            fonts_directory=presets.fonts_directory(), frame_rate=int(clean["fps"]),
            background=video_background(clean),
        )
        result = ffmpeg_runner.run_ffmpeg(arguments)
        if not result.success or not png.is_file():
            ColorPrint.yellow(f"[AudioOrch] video preview failed: {result.error_code} {result.stderr[-400:]}")
            return {"success": False, "error": ERROR_RENDER_FAILED}
    encoded = base64.b64encode(png.read_bytes()).decode("ascii")
    return {
        "success": True,
        "width": VIDEO_RESOLUTION[0],
        "height": VIDEO_RESOLUTION[1],
        "image": f"data:image/png;base64,{encoded}",
        "path": str(png),
    }


__all__ = [
    "ERROR_NO_AUDIO",
    "ERROR_NO_CARDS",
    "ERROR_NO_MANIFEST",
    "ERROR_NO_TIMELINE",
    "ERROR_RENDER_FAILED",
    "VIDEO_EXTENSION",
    "VIDEO_RESOLUTION",
    "build_cards",
    "preview",
    "render_segment",
    "role_styles",
    "short_meaning",
]
