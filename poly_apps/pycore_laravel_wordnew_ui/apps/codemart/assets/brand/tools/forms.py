"""Build the three logo forms (mark, lockup, text) from a candidate's layers; render and score them."""
from __future__ import annotations

from brand_common import *

PAD = 8
MARK_BBOX = (148, 10, 320, 135)
LOCKUP_BBOX = (148, 10, 580, 135)
TEXT_BBOX = (361, 11, 580, 127)
FORM_BBOX = {"mark": MARK_BBOX, "lockup": LOCKUP_BBOX, "text": TEXT_BBOX}


def groups(layers: dict, variant: str = "ink") -> dict:
    """Each group is an SVG fragment in source pixel space. `ink` = fixed colors, `current` = currentColor."""
    colors = {"mark": MARK_COLOR, "glyph": GLYPH_COLOR, "sub": SUB_COLOR}
    if variant == "current":
        colors = {"mark": "currentColor", "glyph": "currentColor", "sub": "currentColor"}
    out = {}
    for key, color in colors.items():
        extra = ' opacity="0.45"' if (variant == "current" and key == "sub") else ""
        out[key] = f'<path fill="{color}" fill-rule="evenodd"{extra} d="{layers[key]}"/>'
    return out


def form_svg(layers: dict, form: str, variant: str = "ink", background: str | None = None) -> str:
    g = groups(layers, variant)
    x0, y0, x1, y1 = FORM_BBOX[form]
    x0, y0, x1, y1 = x0 - PAD, y0 - PAD, x1 + PAD, y1 + PAD
    if form == "mark":
        body = f'<g id="mark">{g["mark"]}</g>'
    elif form == "text":
        body = f'<g id="glyph">{g["glyph"]}</g><g id="sub">{g["sub"]}</g>'
    else:
        body = f'<g id="mark">{g["mark"]}</g><g id="glyph">{g["glyph"]}</g><g id="sub">{g["sub"]}</g>'
    bg = f'<rect x="{x0}" y="{y0}" width="{x1 - x0}" height="{y1 - y0}" fill="{background}"/>' if background else ""
    return f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="{x0} {y0} {x1 - x0} {y1 - y0}">{bg}{body}</svg>'


def full_canvas_svg(layers: dict) -> str:
    g = groups(layers)
    return f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 {SRC_W} {SRC_H}"><rect width="{SRC_W}" height="{SRC_H}" fill="#fff"/>{g["mark"]}{g["glyph"]}{g["sub"]}</svg>'


def score_layers(layers: dict) -> dict:
    big = flatten_gray(render_svg(full_canvas_svg(layers), SRC_W * SCORE_SCALE))
    small = np.array(Image.fromarray(big.astype(np.uint8)).resize((SRC_W, SRC_H), Image.BOX), dtype=np.float32)
    return score_gray(small)


def write_forms(layers: dict, out: Path, sizes=(16, 32, 64, 192, 512)) -> dict:
    out.mkdir(parents=True, exist_ok=True)
    files = {}
    for form in FORM_BBOX:
        svg = form_svg(layers, form)
        (out / f"{form}.svg").write_text(svg, encoding="utf-8")
        (out / f"{form}-current.svg").write_text(form_svg(layers, form, "current"), encoding="utf-8")
        files[form] = f"{form}.svg"
        render_svg(svg, 1024).save(out / f"{form}.png")
    return files
