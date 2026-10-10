"""Method C (gateway): ask the pycore text-to-image gateway for a faithful HD reproduction; image input is not supported by the gateway, so the prompt describes the source exactly."""
from __future__ import annotations

import base64
import sys

from brand_common import *

REPO_ROOT = BRAND_DIR.parents[5]
PROMPT = (
    "Exact faithful high resolution reproduction of a minimalist brand logo on a pure white background, "
    "horizontal lockup, black only plus light gray small caps. Left: a solid black monkey head mark, front view, "
    "wide rounded dome head with one small pointed tuft at the top center, two round ring ears on the left and right "
    "(black ring with small white hole), a large white oval face area with a heart shaped upper edge (two soft lobes meeting "
    "in a small downward notch at the top center), two tiny round black dots as eyes, thick black chin outline. "
    "Right: the two Chinese characters 码市 in a bold geometric sans style with squared stroke ends, then below them the "
    "wide letter spaced thin light gray text CODE MART. No gradients, no shadows, no extra elements, flat vector, centered, wide 4:1 banner."
)


def main() -> int:
    sys.path.insert(0, str(REPO_ROOT))
    from pycore.pyctl.ai.ai_gateway import generate_image
    out = Path(sys.argv[1])
    out.mkdir(parents=True, exist_ok=True)
    result = generate_image(PROMPT, size="4:1", source="codemart_logo", provider=sys.argv[2] if len(sys.argv) > 2 else None)
    (out / "gateway-result.json").write_text(json.dumps({k: v for k, v in result.items() if k != "image_base64"}, ensure_ascii=False, indent=1))
    if not result.get("success"):
        print("FAILED", result.get("error"))
        return 1
    (out / "raw.png").write_bytes(base64.b64decode(result["image_base64"]))
    print("OK", result.get("provider"), result.get("model"))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
