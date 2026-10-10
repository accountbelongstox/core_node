"""Generate or refresh brand candidates and the manifest. Older candidates stay; only the ids named on the command line are rebuilt.

Usage: python build_candidates.py [--only a-potrace-r1,b-hand-r1,...] [--default <id>]
"""
from __future__ import annotations

import argparse
from datetime import datetime, timezone

from brand_common import *
from forms import *

SRC_MARK_BBOX = MARK_BBOX
RASTER_FILL = 0.0


def now() -> str:
    return datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ")


def vector_a(tool: str, **kw):
    from trace_candidate import trace_layers
    return lambda: trace_layers(source_gray(), tool=tool, **kw)


def vector_b():
    from build_handbuilt import layers
    return layers()


VECTOR = {
    "a-potrace-r1": dict(method="A", round=1, tool="potrace", note="potrace on an 8x bicubic upscale, default smoothing", build=vector_a("potrace")),
    "a-potrace-r2": dict(method="A", round=2, tool="potrace", note="potrace, stronger blur and curve smoothing", build=vector_a("potrace", blur=2.2, alphamax=1.25, opttol=0.8)),
    "a-vtracer-r1": dict(method="A", round=1, tool="vtracer", note="vtracer spline mode on the same upscaled binary regions", build=vector_a("vtracer")),
    "b-hand-r1": dict(method="B", round=1, tool="geometry-fit", note="rounded rects, fillets, mirrored Bezier head and stroked letters fitted to the source by pixel diff", build=vector_b),
}


def load_manifest() -> dict:
    if MANIFEST.exists():
        return json.loads(MANIFEST.read_text())
    return {"version": 1, "source": {"file": "source/codemart-logo-source.jpg", "width": SRC_W, "height": SRC_H}, "default": None, "candidates": []}


def upsert(manifest: dict, entry: dict) -> None:
    manifest["candidates"] = [c for c in manifest["candidates"] if c["id"] != entry["id"]] + [entry]


def build_vector(cid: str, spec: dict) -> dict:
    layers = spec["build"]()
    out = CANDIDATES_DIR / cid
    files = write_forms(layers, out)
    (out / "layers.json").write_text(json.dumps(layers))
    return {"id": cid, "method": spec["method"], "round": spec["round"], "tool": spec["tool"], "kind": "vector", "status": "ok",
            "created_at": now(), "note": spec["note"], "score": score_layers(layers), "files": files}


def align_raster(path: Path) -> Image.Image:
    """Fit the candidate's ink bbox into the source mark box on a source-sized white canvas (marks only)."""
    img = Image.open(path).convert("L")
    arr = np.array(img, dtype=np.float32)
    ink = arr < 90
    ys, xs = np.where(ink)
    crop = img.crop((xs.min(), ys.min(), xs.max() + 1, ys.max() + 1))
    x0, y0, x1, y1 = SRC_MARK_BBOX
    scale = min((x1 - x0) / crop.width, (y1 - y0) / crop.height)
    size = (max(1, round(crop.width * scale)), max(1, round(crop.height * scale)))
    canvas = Image.new("L", (SRC_W, SRC_H), 255)
    canvas.paste(crop.resize(size, Image.LANCZOS), (x0 + (x1 - x0 - size[0]) // 2, y0 + (y1 - y0 - size[1]) // 2))
    return canvas


def build_raster(cid: str, method: str, round_: int, tool: str, note: str, raw: Path) -> dict:
    out = CANDIDATES_DIR / cid
    out.mkdir(parents=True, exist_ok=True)
    arr = np.array(Image.open(raw).convert("L"), dtype=np.float32)
    ys, xs = np.where(arr < 90)
    pad = 12
    box = (max(0, xs.min() - pad), max(0, ys.min() - pad), min(arr.shape[1], xs.max() + pad), min(arr.shape[0], ys.max() + pad))
    Image.open(raw).convert("RGB").crop(box).save(out / "mark.png")
    score = score_gray(np.array(align_raster(raw), dtype=np.float32))
    return {"id": cid, "method": method, "round": round_, "tool": tool, "kind": "raster", "status": "ok", "created_at": now(), "note": note,
            "score": score, "files": {"mark": {"png": "mark.png"}}}


def unavailable(cid: str, method: str, round_: int, tool: str, note: str) -> dict:
    return {"id": cid, "method": method, "round": round_, "tool": tool, "kind": "raster", "status": "unavailable", "created_at": now(), "note": note, "score": None, "files": {}}


def pick_default(manifest: dict) -> None:
    ranked = [c for c in manifest["candidates"] if c["status"] == "ok" and c["kind"] == "vector" and {"mark", "lockup", "text"} <= set(c["files"])]
    ranked.sort(key=lambda c: c["score"]["score"], reverse=True)
    manifest["ranking"] = [c["id"] for c in sorted([c for c in manifest["candidates"] if c["status"] == "ok"], key=lambda c: c["score"]["score"], reverse=True)]
    if ranked:
        manifest["default"] = ranked[0]["id"]


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--only", default="")
    parser.add_argument("--default", default="")
    parser.add_argument("--records", action="store_true", help="refresh the raster/unavailable records")
    args = parser.parse_args()
    manifest = load_manifest()
    only = {s for s in args.only.split(",") if s}
    for cid, spec in VECTOR.items():
        if not only or cid in only:
            entry = build_vector(cid, spec)
            upsert(manifest, entry)
            print(cid, entry["score"])
    if args.records or (only and "records" in only):
        raw = CANDIDATES_DIR / "c-gateway-r1" / "raw.png"
        if raw.exists():
            upsert(manifest, build_raster("c-gateway-r1", "C", 1, "pycore ai_gateway (cloudflare sdxl, text prompt only)",
                                          "text-to-image only; the gateway accepts no reference image, so the result is an unfaithful monkey and has no text", raw))
        for cid, tool in (("c-chatgpt-r1", "ChatGPT via mcp-chrome"), ("c-gemini-r1", "Gemini via mcp-chrome")):
            upsert(manifest, unavailable(cid, "C", 1, tool, "mcp-chrome endpoint 127.0.0.1:12306 was not listening, so the signed-in Chrome could not be driven"))
    pick_default(manifest)
    if args.default:
        manifest["default"] = args.default
    MANIFEST.write_text(json.dumps(manifest, indent=1, ensure_ascii=False))
    print("default", manifest["default"])
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
