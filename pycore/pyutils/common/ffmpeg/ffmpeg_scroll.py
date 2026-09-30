"""Scrolling caption layout: cards of bilingual lines -> timed ASS cues.

A card is a group of lines shown together (a sentence in both languages, or a
word with its meaning). Cards are stacked in one virtual column; the viewport
offset follows playback so the card being played sits on the focus line, the
cards already played keep scrolling away above it and the cards not played yet
are already visible below it. Every visible line is one cue per time slice
between two breakpoints (a playback boundary or a scroll keyframe), moving
linearly inside the slice, so the whole motion is rendered by libass from a
plain ASS file.
"""

from dataclasses import dataclass
from typing import Dict, List, Sequence, Tuple

from pycore.pyutils.common.ffmpeg.ffmpeg_models import TimedTextCue, TimedTextMotion, TimedTextStyle

STATE_UPCOMING = "upcoming"
STATE_ACTIVE = "active"
STATE_COMPANION = "companion"
STATE_PAST = "past"
STATES = (STATE_UPCOMING, STATE_ACTIVE, STATE_COMPANION, STATE_PAST)

SCROLL_STEP = "step"
SCROLL_SMOOTH = "smooth"

BORDER_OUTLINE = 1
BORDER_BOX = 3

LINE_HEIGHT_FACTOR = 1.36
MIN_FIT_SCALE = 0.55
MIN_SLICE_SECONDS = 0.02
FIRST_FRAME_FADE_MS = 250
ALIGNMENT_MIDDLE_CENTER = 5

_NARROW_CHARS = frozenset("iljtfI.,;:!'|()[]-’ ")
_WIDE_CHARS = frozenset("mwMW@%")


@dataclass(frozen=True)
class ScrollLine:
    text: str
    role: str
    spans: Tuple[Tuple[float, float], ...]


@dataclass(frozen=True)
class ScrollCard:
    lines: Tuple[ScrollLine, ...]


@dataclass(frozen=True)
class ScrollRoleStyle:
    """One line role (sentence_en, word, ...): font, geometry and the colour
    triple (text, outline-or-box, shadow) of every playback state; colours may
    carry an alpha byte (``#RRGGBBAA``, FF = opaque)."""

    font_name: str
    font_size: int
    bold: bool
    border_style: int
    outline: int
    shadow: int
    colors: Dict[str, Tuple[str, str, str]]
    spacing: float = 0.0
    blur: float = 0.0


@dataclass(frozen=True)
class ScrollLayout:
    scroll_mode: str = SCROLL_STEP
    scroll_seconds: float = 0.5
    focus_y: float = 0.42
    column_width: float = 0.8
    card_gap: int = 46
    line_gap: int = 10


class ScrollCueBuilder:
    def build(
        self,
        cards: Sequence[ScrollCard],
        roles: Dict[str, ScrollRoleStyle],
        layout: ScrollLayout,
        resolution: Tuple[int, int],
        duration: float,
    ) -> List[TimedTextCue]:
        width, height = resolution
        max_text_width = int(width * min(0.96, max(0.3, layout.column_width)))
        geometry = self._geometry(cards, roles, layout, max_text_width)
        if not geometry:
            return []
        keyframes = self._keyframes(geometry, layout)
        breakpoints = self._breakpoints(geometry, keyframes, duration)
        focus = height * min(0.9, max(0.1, layout.focus_y))
        center_x = width // 2
        style_cache: Dict[Tuple[str, str], TimedTextStyle] = {}
        cues: List[TimedTextCue] = []
        for start, end in zip(breakpoints, breakpoints[1:]):
            if end - start < MIN_SLICE_SECONDS:
                continue
            middle = (start + end) / 2.0
            offset_start = self._offset(keyframes, start)
            offset_end = self._offset(keyframes, end)
            for card in geometry:
                for line in card["lines"]:
                    y_start = focus + line["center"] - offset_start
                    y_end = focus + line["center"] - offset_end
                    half = line["height"] / 2.0
                    if max(y_start, y_end) + half < 0 or min(y_start, y_end) - half > height:
                        continue
                    state = self._state(card, line, middle)
                    key = (line["role"], state)
                    if key not in style_cache:
                        style_cache[key] = self._style(roles[line["role"]], state)
                    role_style = roles[line["role"]]
                    cues.append(TimedTextCue(
                        start=start,
                        end=end,
                        text=line["text"],
                        style=style_cache[key],
                        motion=TimedTextMotion(
                            (center_x, int(round(y_start))), (center_x, int(round(y_end))), 0, 0,
                        ),
                        fade_in_ms=FIRST_FRAME_FADE_MS if start <= 0 else 0,
                        blur=role_style.blur,
                        scale=line["scale"],
                    ))
        return cues

    # ------------------------------------------------------------------ #
    # geometry                                                            #
    # ------------------------------------------------------------------ #
    def _geometry(
        self,
        cards: Sequence[ScrollCard],
        roles: Dict[str, ScrollRoleStyle],
        layout: ScrollLayout,
        max_text_width: int,
    ) -> List[Dict]:
        geometry: List[Dict] = []
        cursor = 0.0
        for card in cards:
            spans = [span for line in card.lines for span in line.spans if span[1] > span[0]]
            if not spans or not card.lines:
                continue
            laid_out = []
            for line in card.lines:
                role = roles[line.role]
                available = max_text_width - 2 * role.outline
                scale = self.fit_scale(line.text, role.font_size, role.bold, available)
                size = role.font_size * scale
                wrapped = self.wrap(line.text, size, role.bold, available)
                count = wrapped.count("\n") + 1
                laid_out.append({
                    "role": line.role,
                    "text": wrapped,
                    "scale": scale,
                    "spans": tuple(span for span in line.spans if span[1] > span[0]),
                    "height": count * size * LINE_HEIGHT_FACTOR
                    + (2 * role.outline if role.border_style == BORDER_BOX else 0),
                })
            card_height = sum(item["height"] for item in laid_out) + layout.line_gap * (len(laid_out) - 1)
            top = cursor
            inner = top
            for item in laid_out:
                item["center"] = inner + item["height"] / 2.0
                inner += item["height"] + layout.line_gap
            geometry.append({
                "lines": laid_out,
                "start": min(span[0] for span in spans),
                "end": max(span[1] for span in spans),
                "center": top + card_height / 2.0,
            })
            cursor = top + card_height + layout.card_gap
        return geometry

    @staticmethod
    def _keyframes(geometry: List[Dict], layout: ScrollLayout) -> List[Tuple[float, float]]:
        """Piecewise-linear viewport offset: (time, virtual y of the focus line).
        ``step`` holds a card on the focus line and glides to the next one just
        before it is spoken; ``smooth`` never stops gliding between card starts."""
        points: List[Tuple[float, float]] = [(0.0, geometry[0]["center"])]
        for previous, card in zip(geometry, geometry[1:]):
            arrive = max(card["start"], points[-1][0])
            if layout.scroll_mode == SCROLL_SMOOTH:
                depart = points[-1][0]
            else:
                depart = max(points[-1][0], arrive - max(0.05, layout.scroll_seconds))
            if depart > points[-1][0]:
                points.append((depart, previous["center"]))
            points.append((arrive, card["center"]))
        return points

    @staticmethod
    def _breakpoints(geometry: List[Dict], keyframes: List[Tuple[float, float]], duration: float) -> List[float]:
        times = {0.0, max(0.0, duration)}
        times.update(time for time, _offset in keyframes)
        for card in geometry:
            times.update((card["start"], card["end"]))
            for line in card["lines"]:
                for span in line["spans"]:
                    times.update(span)
        return sorted(time for time in times if 0.0 <= time <= duration)

    @staticmethod
    def _offset(keyframes: List[Tuple[float, float]], at: float) -> float:
        if at <= keyframes[0][0]:
            return keyframes[0][1]
        for (t0, o0), (t1, o1) in zip(keyframes, keyframes[1:]):
            if at <= t1:
                return o0 if t1 <= t0 else o0 + (o1 - o0) * (at - t0) / (t1 - t0)
        return keyframes[-1][1]

    @staticmethod
    def _state(card: Dict, line: Dict, at: float) -> str:
        if any(start <= at < end for start, end in line["spans"]):
            return STATE_ACTIVE
        if at < card["start"]:
            return STATE_UPCOMING
        if at < card["end"]:
            return STATE_COMPANION
        return STATE_PAST

    @staticmethod
    def _style(role: ScrollRoleStyle, state: str) -> TimedTextStyle:
        text, outline, back = role.colors[state]
        return TimedTextStyle(
            font_name=role.font_name,
            font_size=role.font_size,
            primary_color=text,
            secondary_color=text,
            outline_color=outline,
            back_color=back,
            bold=role.bold,
            border_style=role.border_style,
            outline=role.outline,
            shadow=role.shadow,
            alignment=ALIGNMENT_MIDDLE_CENTER,
            margin_left=0,
            margin_right=0,
            margin_vertical=0,
            spacing=role.spacing,
        )

    # ------------------------------------------------------------------ #
    # text measure                                                        #
    # ------------------------------------------------------------------ #
    @staticmethod
    def char_width(char: str, font_size: float, bold: bool) -> float:
        code = ord(char)
        if code >= 0x2E80:
            unit = 1.0
        elif char in _NARROW_CHARS:
            unit = 0.32
        elif char in _WIDE_CHARS:
            unit = 0.88
        elif char.isupper():
            unit = 0.7
        else:
            unit = 0.56
        return unit * font_size * (1.07 if bold else 1.0)

    def fit_scale(self, text: str, font_size: float, bold: bool, max_width: float) -> float:
        """Glyph scale (<= 1) that lets the widest unbreakable Latin word (a
        path, an identifier) fit the column instead of being cut in the middle;
        CJK text may break anywhere and is never scaled."""
        widest = max((self.text_width(token, font_size, bold) for token in str(text).split()), default=0.0)
        if widest <= max_width or any(ord(char) >= 0x2E80 for char in str(text)):
            return 1.0
        return max(MIN_FIT_SCALE, max_width / widest)

    def text_width(self, text: str, font_size: float, bold: bool) -> float:
        return sum(self.char_width(char, font_size, bold) for char in text)

    def wrap(self, text: str, font_size: float, bold: bool, max_width: float) -> str:
        """Greedy wrap with explicit newlines (the ASS writer turns them into
        hard breaks and disables automatic wrapping): at spaces for Latin text,
        anywhere for CJK."""
        lines: List[str] = []
        current = ""
        current_width = 0.0
        last_space = -1
        for char in " ".join(str(text).split()):
            width = self.char_width(char, font_size, bold)
            if current and current_width + width > max_width:
                if last_space > 0:
                    lines.append(current[:last_space].rstrip())
                    current = current[last_space + 1:]
                else:
                    lines.append(current)
                    current = ""
                current_width = self.text_width(current, font_size, bold)
                last_space = -1
                if char == " " and not current:
                    continue
            if char == " ":
                last_space = len(current)
            current += char
            current_width += width
        if current:
            lines.append(current)
        return "\n".join(line for line in lines if line) or ""


scroll_cue_builder = ScrollCueBuilder()
