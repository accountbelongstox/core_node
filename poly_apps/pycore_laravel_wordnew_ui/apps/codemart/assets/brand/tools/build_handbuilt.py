"""Method B: hand-built geometry (rounded rects, fillets, mirrored Bezier head, stroked letters) fitted to the source by pixel diff."""
from __future__ import annotations

import json
import sys

import numpy as np
from scipy.optimize import minimize

import handbuilt_fit as hf
import handbuilt_shapes as hs
from brand_common import BRAND_DIR
from geom import path_d

PARAMS_FILE = BRAND_DIR / "tools" / "handbuilt_params.json"
ROUNDS = 4
SIGMA = 0.93
GLYPH_WINDOW = (355, 5, 585, 110)
SUB_WINDOW = (355, 106, 585, 132)
MARK_WINDOW = (140, 0, 335, 140)


def free_indices(el):
    if el.name in ("mark_head", "mark_face"):
        return [i for i in range(len(el.p)) if i % 4 != 3]
    return None


def fit_scalar(keys, store, els, window):
    x0 = np.array([store[k] for k in keys])

    def loss(x):
        for k, v in zip(keys, x):
            store[k] = float(v)
        return hf.total_loss(els, window)

    res = minimize(loss, x0, method="Powell", options={"xtol": 1e-3, "ftol": 1e-8})
    for k, v in zip(keys, res.x):
        store[k] = float(v)


def fit_all() -> dict:
    hs.SIGMA = SIGMA
    glyph, sub, mark = hs.glyph_elements(), hs.sub_elements(), hs.mark_elements()
    for _ in range(ROUNDS):
        for el in glyph:
            hf.fit([el], glyph)
        for el in sub:
            hf.fit([el], sub, margin=3)
        fit_scalar(["yt", "yb"], hs.SHARED, sub, SUB_WINDOW)
        fit_scalar(["c"], hs.MARK, mark, MARK_WINDOW)
        for el in mark:
            hf.fit([el], mark, margin=3, free_idx=free_indices(el))
    return {
        "glyph": {e.name: e.p.tolist() for e in glyph},
        "sub": {e.name: e.p.tolist() for e in sub},
        "mark": {e.name: e.p.tolist() for e in mark},
        "shared": hs.SHARED, "axis": hs.MARK,
        "loss": {"glyph": hf.total_loss(glyph, GLYPH_WINDOW), "sub": hf.total_loss(sub, SUB_WINDOW), "mark": hf.total_loss(mark, MARK_WINDOW)},
    }


def load_elements(params: dict):
    hs.SHARED.update(params["shared"])
    hs.MARK.update(params["axis"])
    groups = {"glyph": hs.glyph_elements(), "sub": hs.sub_elements(), "mark": hs.mark_elements()}
    for key, els in groups.items():
        for e in els:
            e.p = np.array(params[key][e.name])
    return groups


def to_layers(groups: dict) -> dict:
    ears, head, face, eyes = groups["mark"]
    mark_head = path_d(head.segs()) + path_d(face.segs()) + path_d(eyes.segs())
    return {
        "mark": [{"d": path_d(ears.segs()), "kind": "fill"}, {"d": mark_head, "kind": "fill"}],
        "glyph": [{"d": path_d(e.segs()), "kind": "fill"} for e in groups["glyph"]],
        "sub": [{"d": path_d(e.segs()), "kind": "stroke", "width": hs.SHARED["w"], "alpha": hs.SHARED["alpha"]} for e in groups["sub"]],
    }


def layers() -> dict:
    return to_layers(load_elements(json.loads(PARAMS_FILE.read_text())))


if __name__ == "__main__":
    params = fit_all()
    PARAMS_FILE.write_text(json.dumps(params, indent=1))
    print(params["loss"], params["shared"], params["axis"])
