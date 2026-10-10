"""Pixel-diff fitting of the hand-built geometry against the source (blurred rasterization, Powell)."""
from __future__ import annotations

import sys
import time

import numpy as np
from scipy.optimize import minimize

from brand_common import source_gray
import handbuilt_shapes as hs
from geom import rasterize

TARGET = 1.0 - source_gray() / 255.0


def poly_bbox(el):
    pts = np.vstack(el.polygons())
    return pts.min(axis=0), pts.max(axis=0)


def window_for(els, margin=4):
    lo = np.min([poly_bbox(e)[0] for e in els], axis=0)
    hi = np.max([poly_bbox(e)[1] for e in els], axis=0)
    return (int(max(0, lo[0] - margin)), int(max(0, lo[1] - margin)), int(min(619, hi[0] + margin + 1)), int(min(162, hi[1] + margin + 1)))


def overlapping(all_els, window):
    out = []
    for e in all_els:
        lo, hi = poly_bbox(e)
        if hi[0] >= window[0] - 2 and lo[0] <= window[2] + 2 and hi[1] >= window[1] - 2 and lo[1] <= window[3] + 2:
            out.append(e)
    return out


def fit(free, all_els, margin=4, extra_shared=None, maxiter=4000):
    window = window_for(free, margin)
    ctx = overlapping(all_els, window)
    x0, y0, x1, y1 = window
    target = TARGET[y0:y1, x0:x1]
    sizes = [len(e.p) for e in free]
    start = np.concatenate([e.p for e in free])

    def apply(x):
        off = 0
        for e, n in zip(free, sizes):
            e.p = x[off:off + n]
            off += n

    def loss(x):
        apply(x)
        return float(np.sum((rasterize(ctx, window, sigma=hs.SIGMA) - target) ** 2))

    res = minimize(loss, start, method="Powell", options={"xtol": 1e-3, "ftol": 1e-7, "maxiter": maxiter})
    apply(res.x)
    return res.fun


def total_loss(els, window):
    x0, y0, x1, y1 = window
    return float(np.sum((rasterize(els, window, sigma=hs.SIGMA) - TARGET[y0:y1, x0:x1]) ** 2))
