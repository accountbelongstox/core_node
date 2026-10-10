"""Hand-built CodeMart logo geometry: elements, initial measurements read from the source, and shared sub-text parameters."""
from __future__ import annotations

import math

from geom import *

SHARED = {"yt": 111.8, "yb": 125.2, "w": 1.6, "alpha": 0.5}
SIGMA = 0.85


def rect_element(name, x0, y0, x1, y1, r=1.0, group="glyph"):
    return Element(name, lambda p: rrect(*p), [x0, y0, x1, y1, r], group=group)


def diagonal_builder(p):
    xlt, xrt, yt, tlx, tly, trx, try_, l1, l2, r1, r2 = p
    h = tly - yt
    return [("M", (xlt, yt)),
            ("C", (xlt + l1, yt + h * 0.4), (tlx + l2, tly - h * 0.35), (tlx, tly)),
            ("L", (trx, try_)),
            ("C", (trx + r2, try_ - (try_ - yt) * 0.35), (xrt + r1, yt + (try_ - yt) * 0.4), (xrt, yt)),
            ("Z",)]


def ma_middle_builder(p):
    xL, yT, xR1, yH, xRR, yBot, xBl, yBt, xRI, yHB, rc1, R2, rc2, R1 = p
    return rounded_poly([(xL, yT), (xR1, yT), (xR1, yH), (xRR, yH), (xRR, yBot), (xBl, yBot), (xBl, yBt), (xRI, yBt), (xRI, yHB), (xL, yHB)],
                        [1, 1, rc1, 1, R2, 1, 1, rc2, 0.3, R1])


def hook_builder(p):
    xa, yT, xb, yBot, xl, yBt, R, rc = p
    return rounded_poly([(xa, yT), (xb, yT), (xb, yBot), (xl, yBot), (xl, yBt), (xa, yBt)], [1, 1, R, 1, 1, rc])


def peak_builder(p):
    xl, xr, xt, yt, yb, d1, d2x, d2y = p
    return [("M", (xl, yb)), ("C", (xl + d1, yb), (xt - d2x, yt + d2y), (xt, yt)),
            ("C", (xt + d2x, yt + d2y), (xr - d1, yb), (xr, yb)), ("L", (xr, yb + 4)), ("L", (xl, yb + 4)), ("Z",)]


def stem_builder(p):
    x0, x1, y0, y1, a1, b1, a2, b2, a3, b3, r = p
    cuts = [y0, a1, b1, a2, b2, a3, b3, y1]
    segs = []
    for i in range(0, 8, 2):
        top, bottom = cuts[i], cuts[i + 1]
        segs += rrect(x0, top, x1, bottom, r if i == 6 else 0.0)
    return segs


def glyph_elements():
    els = [
        rect_element("ma_a_bar", 363, 20.5, 397, 27.2),
        Element("ma_a_diag", diagonal_builder, [374.5, 384.5, 24, 361, 59.5, 364, 63.5, 0, 0, 0, 0]),
        rect_element("ma_b_hook_h", 374.5, 58.5, 391.5, 64.0),
        rect_element("ma_b_hook_v", 385.0, 58.5, 391.5, 78.5),
        rect_element("ma_c_foot_v", 363, 81, 369, 100.5),
        rect_element("ma_c_foot_h", 363, 94.5, 380, 100.5),
        rect_element("ma_d_top_h", 402, 17.5, 443.5, 24.5),
        rect_element("ma_d_top_v", 434, 17.5, 443.5, 47.5),
        Element("ma_e_body", ma_middle_builder, [403.5, 30, 413.5, 54, 449.5, 102.5, 422, 96, 440, 59.8, 4, 8, 3, 7]),
        rect_element("ma_f_bar", 400, 72.8, 434.5, 79.8, 1.5),
        rect_element("shi_bar", 490, 21.5, 580, 30.2),
        Element("shi_peak", peak_builder, [524.5, 545.5, 535.5, 11.0, 25, 6, 2, 6]),
        Element("shi_stem", stem_builder, [529.7, 540.6, 29, 31.3, 32.7, 35.8, 37.2, 41.2, 42.8, 104.5, 0.8]),
        rect_element("shi_l_v", 497, 39.5, 508, 93.5),
        rect_element("shi_l_h", 497, 39.5, 524, 47),
        rect_element("shi_r_h", 546.8, 39.5, 574.5, 47),
        Element("shi_r_hook", hook_builder, [564.5, 39.5, 574.5, 92.3, 551.5, 85, 10, 2.5]),
    ]
    return els


def letter_C(p):
    cx, rx, g = p
    cy, ry = (SHARED["yt"] + SHARED["yb"]) / 2, (SHARED["yb"] - SHARED["yt"]) / 2
    return [("M", arc_start(cx, cy, rx, ry, -g))] + arc_segs(cx, cy, rx, ry, -g, -(360 - g))


def letter_O(p):
    cx, rx = p
    cy, ry = (SHARED["yt"] + SHARED["yb"]) / 2, (SHARED["yb"] - SHARED["yt"]) / 2
    return [("M", arc_start(cx, cy, rx, ry, 0))] + arc_segs(cx, cy, rx, ry, 0, 360) + [("Z",)]


def letter_D(p):
    x0, x1, r = p
    yt, yb = SHARED["yt"], SHARED["yb"]
    return rounded_poly([(x0, yt), (x1, yt), (x1, yb), (x0, yb)], [0, r, r, 0])


def letter_E(p):
    x0, x1, xm = p
    yt, yb = SHARED["yt"], SHARED["yb"]
    ym = (yt + yb) / 2
    return [("M", (x1, yt)), ("L", (x0, yt)), ("L", (x0, yb)), ("L", (x1, yb)), ("M", (x0, ym)), ("L", (xm, ym))]


def letter_M(p):
    x0, x1, vy = p
    yt, yb = SHARED["yt"], SHARED["yb"]
    return [("M", (x0, yb)), ("L", (x0, yt)), ("L", ((x0 + x1) / 2, vy)), ("L", (x1, yt)), ("L", (x1, yb))]


def letter_A(p):
    x0, x1, xa, ycb = p
    yt, yb = SHARED["yt"], SHARED["yb"]
    t = (yb - ycb) / (yb - yt)
    return [("M", (x0, yb)), ("L", (xa, yt)), ("L", (x1, yb)), ("M", (x0 + (xa - x0) * t, ycb)), ("L", (x1 - (x1 - xa) * t, ycb))]


def letter_R(p):
    x0, x1, xb, ymid, legx = p
    yt, yb = SHARED["yt"], SHARED["yb"]
    rr = (ymid - yt) / 2
    return ([("M", (x0, yb)), ("L", (x0, yt)), ("L", (xb - rr, yt))] + arc_segs(xb - rr, yt + rr, rr, rr, -90, 90)
            + [("L", (x0, ymid)), ("M", (legx, ymid)), ("L", (x1, yb))])


def letter_T(p):
    x0, x1 = p
    yt, yb = SHARED["yt"], SHARED["yb"]
    xs = (x0 + x1) / 2
    return [("M", (x0, yt)), ("L", (x1, yt)), ("M", (xs, yt)), ("L", (xs, yb))]


def sub_elements():
    spec = [
        ("C", letter_C, [367.8, 5.4, 38]), ("O", letter_O, [394, 6.2]), ("D", letter_D, [415.8, 426.7, 5]),
        ("E", letter_E, [442.3, 451.7, 450.5]), ("M", letter_M, [490.8, 503.2, 120.5]),
        ("A", letter_A, [518.8, 531.2, 525, 121.5]), ("R", letter_R, [545.8, 555.7, 555.3, 118.3, 551]),
        ("T", letter_T, [569.8, 579.7]),
    ]
    return [Element(f"sub_{n}", fn, p0, kind="stroke", group="sub",
                    extra={"width": lambda p: SHARED["w"], "alpha": lambda p: SHARED["alpha"]}) for n, fn, p0 in spec]
