"""Parametric path model for the hand-built candidate: segments, fillets, rasterizing and SVG export."""
from __future__ import annotations

import math

import cv2
import numpy as np
from shapely.geometry import LineString
from shapely.ops import unary_union

KAPPA = 0.5522847498
SUPERSAMPLE = 8
FLATTEN_STEPS = 14


def pt(x, y):
    return (float(x), float(y))


def rounded_poly(vertices, radii):
    """Closed path through `vertices` with a cubic fillet of radius r at each vertex."""
    n = len(vertices)
    segs = []
    first = True
    for i in range(n):
        v = np.array(vertices[i], dtype=float)
        prev = np.array(vertices[i - 1], dtype=float)
        nxt = np.array(vertices[(i + 1) % n], dtype=float)
        r = abs(radii[i])
        din = v - prev
        dout = nxt - v
        lin, lout = np.linalg.norm(din), np.linalg.norm(dout)
        if r < 1e-6 or lin < 1e-9 or lout < 1e-9:
            segs.append(("M" if first else "L", tuple(v)))
            first = False
            continue
        r_in = min(r, lin / 2)
        r_out = min(r, lout / 2)
        a = v - din / lin * r_in
        b = v + dout / lout * r_out
        c1 = a + (v - a) * KAPPA
        c2 = b + (v - b) * KAPPA
        segs.append(("M" if first else "L", tuple(a)))
        first = False
        segs.append(("C", tuple(c1), tuple(c2), tuple(b)))
    segs.append(("Z",))
    return segs


def rrect(x0, y0, x1, y1, r):
    return rounded_poly([(x0, y0), (x1, y0), (x1, y1), (x0, y1)], [r] * 4)


def ellipse_path(cx, cy, rx, ry, rot=0.0):
    c, s = math.cos(rot), math.sin(rot)
    def tf(px, py):
        return (cx + px * c - py * s, cy + px * s + py * c)
    k = KAPPA
    segs = [("M", tf(rx, 0))]
    for (p1, p2, p3) in (((rx, k * ry), (k * rx, ry), (0, ry)), ((-k * rx, ry), (-rx, k * ry), (-rx, 0)),
                         ((-rx, -k * ry), (-k * rx, -ry), (0, -ry)), ((k * rx, -ry), (rx, -k * ry), (rx, 0))):
        segs.append(("C", tf(*p1), tf(*p2), tf(*p3)))
    segs.append(("Z",))
    return segs


def flatten(segs):
    """Subpaths as lists of points."""
    subs, cur, last = [], [], None
    for s in segs:
        if s[0] == "M":
            if cur:
                subs.append(cur)
            cur = [s[1]]
            last = s[1]
        elif s[0] == "L":
            cur.append(s[1])
            last = s[1]
        elif s[0] == "C":
            p0 = np.array(last)
            p1, p2, p3 = (np.array(q) for q in s[1:])
            for t in np.linspace(0, 1, FLATTEN_STEPS + 1)[1:]:
                u = 1 - t
                cur.append(tuple(u ** 3 * p0 + 3 * u * u * t * p1 + 3 * u * t * t * p2 + t ** 3 * p3))
            last = s[3]
        elif s[0] == "Z":
            if cur:
                subs.append(cur)
            cur = []
    if cur:
        subs.append(cur)
    return subs


def path_d(segs, ndigits=2):
    f = lambda p: f"{p[0]:.{ndigits}f} {p[1]:.{ndigits}f}"
    out = []
    for s in segs:
        if s[0] in ("M", "L"):
            out.append(f"{s[0]}{f(s[1])}")
        elif s[0] == "C":
            out.append(f"C{f(s[1])} {f(s[2])} {f(s[3])}")
        else:
            out.append("Z")
    return "".join(out)


class Element:
    """One drawable: a fill path (even-odd) or a stroked centerline, with tone and opacity."""

    def __init__(self, name, builder, p0, kind="fill", tone="black", group="glyph", extra=None):
        self.name, self.builder, self.p, self.kind, self.tone, self.group = name, builder, np.array(p0, dtype=float), kind, tone, group
        self.extra = extra or {}

    def segs(self, p=None):
        return self.builder(self.p if p is None else p)

    def polygons(self, p=None):
        segs = self.segs(p)
        if self.kind == "fill":
            return [np.array(s) for s in flatten(segs) if len(s) >= 3]
        width = abs(self.extra["width"](self.p if p is None else p)) if callable(self.extra.get("width")) else self.extra["width"]
        lines = [LineString(s) for s in flatten(segs) if len(s) >= 2]
        geom = unary_union([ln.buffer(width / 2, cap_style=2, join_style=2, mitre_limit=3) for ln in lines])
        polys = list(geom.geoms) if hasattr(geom, "geoms") else [geom]
        rings = []
        for poly in polys:
            rings.append(np.array(poly.exterior.coords))
            rings.extend(np.array(r.coords) for r in poly.interiors)
        return rings


def rasterize(elements, window, params=None, sigma=0.85):
    """Darkness image (1 = ink) of `elements` over window=(x0,y0,x1,y1) in source px, blurred like the source."""
    x0, y0, x1, y1 = window
    w, h = x1 - x0, y1 - y0
    canvas = np.zeros((h * SUPERSAMPLE, w * SUPERSAMPLE), np.float32)
    shift = 4
    for idx, el in enumerate(elements):
        p = el.p if params is None or idx not in params else params[idx]
        mask = np.zeros(canvas.shape, np.uint8)
        polys = el.polygons(p)
        if not polys:
            continue
        pts = [np.round((poly - [x0, y0]) * SUPERSAMPLE * (1 << shift)).astype(np.int32) for poly in polys]
        cv2.fillPoly(mask, pts, 1, lineType=cv2.LINE_8, shift=shift)
        alpha = float(el.extra.get("alpha", 1.0)) if not callable(el.extra.get("alpha")) else float(el.extra["alpha"](p))
        tone = 1.0 if el.tone == "black" else 0.0
        m = mask.astype(np.float32) * alpha
        canvas = canvas * (1 - m) + tone * m
    if sigma > 0:
        canvas = cv2.GaussianBlur(canvas, (0, 0), sigma * SUPERSAMPLE)
    return cv2.resize(canvas, (w, h), interpolation=cv2.INTER_AREA)


def arc_segs(cx, cy, rx, ry, a0, a1):
    """Cubic segments (without the M) for an elliptical arc from angle a0 to a1 in degrees (y down)."""
    n = max(1, int(math.ceil(abs(a1 - a0) / 90.0)))
    step = math.radians(a1 - a0) / n
    k = 4.0 / 3.0 * math.tan(step / 4.0)
    segs = []
    t = math.radians(a0)
    for _ in range(n):
        t2 = t + step
        p0 = (cx + rx * math.cos(t), cy + ry * math.sin(t))
        p3 = (cx + rx * math.cos(t2), cy + ry * math.sin(t2))
        c1 = (p0[0] - k * rx * math.sin(t), p0[1] + k * ry * math.cos(t))
        c2 = (p3[0] + k * rx * math.sin(t2), p3[1] - k * ry * math.cos(t2))
        segs.append(("C", c1, c2, p3))
        t = t2
    return segs


def arc_start(cx, cy, rx, ry, a0):
    t = math.radians(a0)
    return (cx + rx * math.cos(t), cy + ry * math.sin(t))
