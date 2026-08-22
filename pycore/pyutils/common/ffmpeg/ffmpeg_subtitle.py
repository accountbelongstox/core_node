import os
import re
from pathlib import Path
from typing import Iterable, Optional

from pycore.pyutils.common.ffmpeg.ffmpeg_models import TimedTextCue, TimedTextStyle


_HEX_COLOR_PATTERN = re.compile(r"^#?([0-9A-Fa-f]{6})([0-9A-Fa-f]{2})?$")


class ASSSubtitleWriter:
    def materialize(
        self,
        cues: Iterable[TimedTextCue],
        output_path: str | Path,
        resolution: tuple[int, int],
    ) -> Optional[Path]:
        renderable_cues = tuple(
            cue for cue in cues
            if cue.text.strip() and cue.end > cue.start and cue.end > 0
        )
        if not renderable_cues:
            return None
        output = Path(output_path).expanduser().resolve()
        content = self.serialize(renderable_cues, resolution)
        if output.is_file() and output.read_text(encoding="utf-8") == content:
            return output
        output.parent.mkdir(parents=True, exist_ok=True)
        temporary = output.with_name(f"{output.name}.partial")
        temporary.write_text(content, encoding="utf-8", newline="\n")
        os.replace(temporary, output)
        return output

    def serialize(
        self,
        cues: Iterable[TimedTextCue],
        resolution: tuple[int, int],
    ) -> str:
        cue_tuple = tuple(cues)
        width, height = resolution
        style_names: dict[TimedTextStyle, str] = {}
        style_lines = []
        event_lines = []
        for cue in cue_tuple:
            if cue.style not in style_names:
                style_name = f"Style{len(style_names) + 1:04d}"
                style_names[cue.style] = style_name
                style_lines.append(self._style_line(style_name, cue.style))
            event_lines.append(self._event_line(cue, style_names[cue.style]))
        lines = [
            "[Script Info]",
            "ScriptType: v4.00+",
            f"PlayResX: {width}",
            f"PlayResY: {height}",
            "WrapStyle: 2",
            "ScaledBorderAndShadow: yes",
            "",
            "[V4+ Styles]",
            "Format: Name, Fontname, Fontsize, PrimaryColour, SecondaryColour, OutlineColour, BackColour, Bold, Italic, Underline, StrikeOut, ScaleX, ScaleY, Spacing, Angle, BorderStyle, Outline, Shadow, Alignment, MarginL, MarginR, MarginV, Encoding",
            *style_lines,
            "",
            "[Events]",
            "Format: Layer, Start, End, Style, Name, MarginL, MarginR, MarginV, Effect, Text",
            *event_lines,
            "",
        ]
        return "\n".join(lines)

    def force_style(self, style: TimedTextStyle) -> str:
        fields = (
            f"FontName={self._field(style.font_name)}",
            f"FontSize={max(1, style.font_size)}",
            f"PrimaryColour={self._ass_color(style.primary_color, '#FFFFFF')}",
            f"SecondaryColour={self._ass_color(style.secondary_color, '#FFFFFF')}",
            f"OutlineColour={self._ass_color(style.outline_color, '#000000')}",
            f"BackColour={self._ass_color(style.back_color, '#00000080')}",
            f"Bold={-1 if style.bold else 0}",
            f"Italic={-1 if style.italic else 0}",
            f"Underline={-1 if style.underline else 0}",
            f"StrikeOut={-1 if style.strikeout else 0}",
            f"BorderStyle={style.border_style}",
            f"Outline={max(0, style.outline)}",
            f"Shadow={max(0, style.shadow)}",
            f"Alignment={min(9, max(1, style.alignment))}",
            f"MarginL={max(0, style.margin_left)}",
            f"MarginR={max(0, style.margin_right)}",
            f"MarginV={max(0, style.margin_vertical)}",
        )
        return ",".join(fields)

    def _style_line(self, name: str, style: TimedTextStyle) -> str:
        values = (
            name,
            self._field(style.font_name),
            str(max(1, style.font_size)),
            self._ass_color(style.primary_color, "#FFFFFF"),
            self._ass_color(style.secondary_color, "#FFFFFF"),
            self._ass_color(style.outline_color, "#000000"),
            self._ass_color(style.back_color, "#00000080"),
            str(-1 if style.bold else 0),
            str(-1 if style.italic else 0),
            str(-1 if style.underline else 0),
            str(-1 if style.strikeout else 0),
            "100", "100", "0", "0",
            str(style.border_style),
            str(max(0, style.outline)),
            str(max(0, style.shadow)),
            str(min(9, max(1, style.alignment))),
            str(max(0, style.margin_left)),
            str(max(0, style.margin_right)),
            str(max(0, style.margin_vertical)),
            "1",
        )
        return f"Style: {','.join(values)}"

    def _event_line(self, cue: TimedTextCue, style_name: str) -> str:
        start = self._timestamp(max(0.0, cue.start))
        end = self._timestamp(max(0.0, cue.end))
        position = ""
        if cue.style.position is not None:
            x, y = cue.style.position
            position = f"{{\\pos({x},{y})}}"
        text = position + self._text(cue.text)
        return f"Dialogue: {max(0, cue.layer)},{start},{end},{style_name},,0,0,0,,{text}"

    @staticmethod
    def _timestamp(seconds: float) -> str:
        centiseconds = int(round(seconds * 100))
        hours, remainder = divmod(centiseconds, 360000)
        minutes, remainder = divmod(remainder, 6000)
        whole_seconds, fraction = divmod(remainder, 100)
        return f"{hours}:{minutes:02d}:{whole_seconds:02d}.{fraction:02d}"

    @staticmethod
    def _field(value: str) -> str:
        return value.replace(",", " ").replace("\r", " ").replace("\n", " ").strip()

    @staticmethod
    def _text(value: str) -> str:
        normalized = value.replace("\r\n", "\n").replace("\r", "\n")
        escaped = normalized.replace("\\", "\\\\").replace("{", "\\{").replace("}", "\\}")
        return escaped.replace("\n", "\\N")

    @staticmethod
    def _ass_color(value: str, default: str) -> str:
        match = _HEX_COLOR_PATTERN.fullmatch(value.strip())
        if match is None:
            match = _HEX_COLOR_PATTERN.fullmatch(default)
        rgb = match.group(1).upper()
        alpha = match.group(2)
        red, green, blue = rgb[0:2], rgb[2:4], rgb[4:6]
        ass_alpha = 0 if alpha is None else 255 - int(alpha, 16)
        return f"&H{ass_alpha:02X}{blue}{green}{red}"


ass_subtitle_writer = ASSSubtitleWriter()
