"""Build the three logo forms (mark, lockup, text) from a candidate's layers; render and score them.

A layer set is {"mark": [el], "glyph": [el], "sub": [el]} where el = {"d", "kind": fill|stroke, "width", "alpha", "transform"}.
"""
from __future__ import annotations

from brand_common import *

PAD = 8
MARK_BBOX = (148, 10, 320, 135)
LOCKUP_BBOX = (148, 10, 580, 135)
TEXT_BBOX = (361, 11, 580, 127)
FORM_BBOX = {"mark": MARK_BBOX, "lockup": LOCKUP_BBOX, "text": TEXT_BBOX}
FORM_GROUPS = {"mark": ("mark",), "lockup": ("mark", "glyph", "sub"), "text": ("glyph", "sub")}
VARIANTS = ("ink", "white", "current")
SUB_ALPHA_DEFAULT = 0.396


def hex_gray(alpha: float) -> str:
    v = round(255 * (1 - alpha))
    return f"#{v:02x}{v:02x}{v:02x}"


def element_svg(el: dict, group: str, variant: str) -> str:
    alpha = el.get("alpha", SUB_ALPHA_DEFAULT if group == "sub" else 1.0) if group == "sub" else 1.0
    if variant == "ink":
        color = hex_gray(alpha) if group == "sub" else "#000000"
        opacity = ""
    else:
        color = "#ffffff" if variant == "white" else "currentColor"
        opacity = f' {"stroke" if el.get("kind") == "stroke" else "fill"}-opacity="{alpha:.3f}"' if group == "sub" else ""
    transform = f' transform="{el["transform"]}"' if el.get("transform") else ""
    if el.get("kind") == "stroke":
        return (f'<path fill="none" stroke="{color}"{opacity} stroke-width="{el["width"]:.3f}" stroke-linejoin="miter" '
                f'stroke-miterlimit="3"{transform} d="{el["d"]}"/>')
    return f'<path fill="{color}"{opacity} fill-rule="evenodd"{transform} d="{el["d"]}"/>'


def layer_group(layers: dict, group: str, variant: str) -> str:
    return "".join(element_svg(el, group, variant) for el in layers[group])


def form_svg(layers: dict, form: str, variant: str = "ink", background: str | None = None) -> str:
    x0, y0, x1, y1 = FORM_BBOX[form]
    x0, y0, x1, y1 = x0 - PAD, y0 - PAD, x1 + PAD, y1 + PAD
    body = "".join(f'<g id="{g}">{layer_group(layers, g, variant)}</g>' for g in FORM_GROUPS[form])
    bg = f'<rect x="{x0}" y="{y0}" width="{x1 - x0}" height="{y1 - y0}" fill="{background}"/>' if background else ""
    return (f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="{x0} {y0} {x1 - x0} {y1 - y0}">'
            f'<title>CodeMart</title>{bg}{body}</svg>')


def full_canvas_svg(layers: dict) -> str:
    body = "".join(layer_group(layers, g, "ink") for g in ("mark", "glyph", "sub"))
    return f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 {SRC_W} {SRC_H}"><rect width="{SRC_W}" height="{SRC_H}" fill="#fff"/>{body}</svg>'


def score_gray_big(big: np.ndarray) -> dict:
    small = np.array(Image.fromarray(big.astype(np.uint8)).resize((SRC_W, SRC_H), Image.BOX), dtype=np.float32)
    return score_gray(small)


def score_layers(layers: dict) -> dict:
    return score_gray_big(flatten_gray(render_svg(full_canvas_svg(layers), SRC_W * SCORE_SCALE)))


def write_forms(layers: dict, out: Path) -> dict:
    out.mkdir(parents=True, exist_ok=True)
    files = {}
    for form in FORM_BBOX:
        for variant in VARIANTS:
            suffix = "" if variant == "ink" else f"-{variant}"
            (out / f"{form}{suffix}.svg").write_text(form_svg(layers, form, variant), encoding="utf-8")
        render_svg(form_svg(layers, form, "ink"), 1024).save(out / f"{form}.png")
        files[form] = {"svg": f"{form}.svg", "png": f"{form}.png", "white": f"{form}-white.svg", "current": f"{form}-current.svg"}
    return files
