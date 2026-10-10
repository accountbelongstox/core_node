#!/usr/bin/env python3
"""Diablo 4 minimap route-path recognition prototype.

Pipeline:
  1. Locate the minimap ROI (top-right parchment rectangle) or use --roi.
  2. HSV threshold: route dots are near-white (low saturation, high value)
     while the parchment background is tan/brown (higher saturation).
  3. Connected-component filtering by area and circularity -> route dots.
  4. Greedy nearest-neighbor chain starting near the minimap center
     (the player is always at the center of the D4 minimap).
  5. Douglas-Peucker simplification -> sparse waypoints + heading vector.

Usage:
  python d4_minimap_path.py <image> [--roi x,y,w,h] [--out debug.png]
"""

import argparse
import math
import sys

import cv2
import numpy as np

# HSV range for route dot pixels (JPEG blur lifts saturation, so S<90)
DOT_HSV_LO = (0, 0, 210)
DOT_HSV_HI = (179, 90, 255)

# HSV range for the tan/brown parchment minimap background
PARCHMENT_HSV_LO = (10, 40, 80)
PARCHMENT_HSV_HI = (40, 200, 255)

# Connected-component area filter (px^2), scaled to minimap size at runtime
DOT_AREA_MIN_RATIO = 1e-5
DOT_AREA_MAX_RATIO = 8e-4

# Route dots are white cores ringed by a dark outline; parchment highlights
# sit on a bright background. Minimum centerV - ringV contrast:
DOT_OUTLINE_CONTRAST = 60
DOT_RING_KERNEL = 7

# Bottom strip of the detected ROI holds the compass/UI, top strip the
# zone label bar — neither is map
COMPASS_STRIP_RATIO = 0.15
LABEL_STRIP_RATIO = 0.08

# Route dots march at near-uniform spacing along the line. Icon glyph
# fragments cluster tighter than NN_MIN_RATIO*w; unrelated marks sit farther
# than NN_MAX_RATIO*w from any other dot.
NN_MIN_RATIO = 0.025
NN_MAX_RATIO = 0.10
# Graph link distance for grouping dots into chains (fraction of map width)
LINK_RATIO = 0.10
# A real route shows at least this many dots per chain fragment
MIN_CHAIN_DOTS = 4

# Douglas-Peucker epsilon as a fraction of the path length
SIMPLIFY_RATIO = 0.02


def find_minimap_roi(img):
    """Find the minimap as the largest parchment-colored blob in the
    top-right quadrant. Returns (x, y, w, h) or None."""
    h, w = img.shape[:2]
    quadrant = img[0 : h // 2, w // 2 : w]
    hsv = cv2.cvtColor(quadrant, cv2.COLOR_BGR2HSV)
    mask = cv2.inRange(hsv, PARCHMENT_HSV_LO, PARCHMENT_HSV_HI)
    mask = cv2.morphologyEx(mask, cv2.MORPH_CLOSE, np.ones((15, 15), np.uint8))
    contours, _ = cv2.findContours(mask, cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_SIMPLE)
    if not contours:
        return None
    biggest = max(contours, key=cv2.contourArea)
    x, y, cw, ch = cv2.boundingRect(biggest)
    if cw * ch < (w * h) * 0.005:
        return None
    return (x + w // 2, y, cw, ch)


def extract_route_dots(minimap):
    """Threshold bright dots, then keep only components with a dark outline
    ring (route dots) and drop parchment highlights/UI glyphs.
    Returns (centers Nx2 int array, mask)."""
    hsv = cv2.cvtColor(minimap, cv2.COLOR_BGR2HSV)
    mask = cv2.inRange(hsv, DOT_HSV_LO, DOT_HSV_HI)
    value = hsv[:, :, 2]

    mm_area = minimap.shape[0] * minimap.shape[1]
    area_min = max(3.0, mm_area * DOT_AREA_MIN_RATIO)
    area_max = mm_area * DOT_AREA_MAX_RATIO
    ring_kernel = np.ones((DOT_RING_KERNEL, DOT_RING_KERNEL), np.uint8)

    n, labels, stats, centroids = cv2.connectedComponentsWithStats(mask, 8)
    centers = []
    for i in range(1, n):
        area = stats[i, cv2.CC_STAT_AREA]
        if not (area_min <= area <= area_max):
            continue
        bw, bh = stats[i, cv2.CC_STAT_WIDTH], stats[i, cv2.CC_STAT_HEIGHT]
        if bw == 0 or bh == 0:
            continue
        aspect = max(bw, bh) / min(bw, bh)
        if aspect > 2.0:  # dots are roughly round; drops text strokes etc.
            continue
        comp = (labels == i).astype(np.uint8)
        ring = cv2.dilate(comp, ring_kernel) - comp
        if ring.sum() == 0:
            continue
        contrast = value[comp.astype(bool)].mean() - value[ring.astype(bool)].mean()
        if contrast < DOT_OUTLINE_CONTRAST:
            continue
        centers.append(centroids[i])
    if not centers:
        return np.empty((0, 2), dtype=np.int32), mask
    return np.int32(np.array(centers)), mask


def keep_route_chains(centers, map_w):
    """Drop dots that cannot belong to a route: route dots have a neighbor
    at near-uniform spacing and form chains of >= MIN_CHAIN_DOTS dots."""
    if len(centers) < MIN_CHAIN_DOTS:
        return np.empty((0, 2), dtype=np.int32)
    pts = centers.astype(np.float64)
    dist = np.sqrt(((pts[:, None, :] - pts[None, :, :]) ** 2).sum(-1))
    np.fill_diagonal(dist, np.inf)
    nn = dist.min(axis=1)
    in_band = (nn >= NN_MIN_RATIO * map_w) & (nn <= NN_MAX_RATIO * map_w)

    # Union-find over dots linked within LINK_RATIO*w, restricted to in-band dots
    parent = list(range(len(centers)))

    def find(i):
        while parent[i] != i:
            parent[i] = parent[parent[i]]
            i = parent[i]
        return i

    linked = np.where(np.isfinite(dist), dist, np.inf) <= LINK_RATIO * map_w
    for i in range(len(centers)):
        if not in_band[i]:
            continue
        for j in range(i + 1, len(centers)):
            if in_band[j] and linked[i, j]:
                pi, pj = find(i), find(j)
                if pi != pj:
                    parent[pi] = pj

    groups = {}
    for i in range(len(centers)):
        if in_band[i]:
            groups.setdefault(find(i), []).append(i)
    keep = [i for g in groups.values() if len(g) >= MIN_CHAIN_DOTS for i in g]
    if not keep:
        return np.empty((0, 2), dtype=np.int32)
    return centers[keep]


def chain_dots(centers, start):
    """Greedy nearest-neighbor ordering starting from the dot closest to
    `start`. Returns the ordered index list."""
    if len(centers) == 0:
        return []
    remaining = set(range(len(centers)))
    order = []
    cur = min(remaining, key=lambda i: np.hypot(*(centers[i] - start)))
    while True:
        order.append(cur)
        remaining.discard(cur)
        if not remaining:
            break
        cur = min(remaining, key=lambda i: np.hypot(*(centers[i] - centers[cur])))
    return order


def simplify(points, ratio=SIMPLIFY_RATIO):
    """Douglas-Peucker on an ordered polyline (Nx2 int array)."""
    if len(points) < 3:
        return points
    total = sum(math.hypot(*(points[i + 1] - points[i])) for i in range(len(points) - 1))
    eps = max(1.0, total * ratio)
    approx = cv2.approxPolyDP(points.reshape(-1, 1, 2), eps, False)
    return approx.reshape(-1, 2)


def draw_debug(img, roi, centers, path, out_path):
    vis = img.copy()
    x, y, w, h = roi
    cv2.rectangle(vis, (x, y), (x + w, y + h), (0, 255, 255), 2)
    for c in centers:
        cv2.circle(vis, (x + c[0], y + c[1]), 3, (0, 0, 255), -1)
    for i in range(len(path) - 1):
        p1 = (x + int(path[i][0]), y + int(path[i][1]))
        p2 = (x + int(path[i + 1][0]), y + int(path[i + 1][1]))
        cv2.arrowedLine(vis, p1, p2, (0, 255, 0), 2, tipLength=0.3)
    for i, p in enumerate(path):
        cv2.putText(vis, str(i), (x + int(p[0]) + 4, y + int(p[1]) - 4),
                    cv2.FONT_HERSHEY_SIMPLEX, 0.4, (255, 0, 255), 1)
    cv2.imwrite(out_path, vis)


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("image")
    ap.add_argument("--roi", help="minimap rect as x,y,w,h (skips auto-detect)")
    ap.add_argument("--out", default="d4_path_debug.png")
    opt = ap.parse_args()

    img = cv2.imread(opt.image)
    if img is None:
        sys.exit(f"cannot read {opt.image}")

    if opt.roi:
        roi = tuple(int(v) for v in opt.roi.split(","))
    else:
        roi = find_minimap_roi(img)
        if roi is None:
            sys.exit("minimap not found; pass --roi x,y,w,h")
    x, y, w, h = roi
    map_y = y + int(h * LABEL_STRIP_RATIO)
    map_h = int(h * (1 - LABEL_STRIP_RATIO - COMPASS_STRIP_RATIO))
    minimap = img[map_y : map_y + map_h, x : x + w]
    roi = (x, map_y, w, map_h)
    print(f"minimap roi: x={x} y={map_y} w={w} h={map_h}")

    centers, mask = extract_route_dots(minimap)
    centers = keep_route_chains(centers, w)
    print(f"route dots: {len(centers)}")
    if len(centers) == 0:
        cv2.imwrite(opt.out, mask)
        sys.exit(f"no route found; mask written to {opt.out}")

    # Player is at the minimap center in D4; chain from the nearest dot.
    start = np.array([w // 2, map_h // 2])
    order = chain_dots(centers, start)
    ordered = centers[order]
    waypoints = simplify(ordered)
    print(f"waypoints: {len(waypoints)}")
    for p in waypoints:
        print(f"  ({roi[0] + p[0]}, {roi[1] + p[1]})")
    if len(waypoints) >= 2:
        k = min(2, len(waypoints) - 1)
        dx, dy = waypoints[k] - start  # from player toward a point along the route
        heading = math.degrees(math.atan2(-dy, dx))  # 0=east, 90=north
        print(f"heading: {heading:.1f} deg")

    draw_debug(img, roi, centers, ordered, opt.out)
    print(f"debug image: {opt.out}")


if __name__ == "__main__":
    main()
