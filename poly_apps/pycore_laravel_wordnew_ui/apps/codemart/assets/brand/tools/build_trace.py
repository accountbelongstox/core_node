from __future__ import annotations
import sys
from datetime import datetime, timezone
from trace_candidate import trace_layers
from forms import *

if __name__ == "__main__":
    out = CANDIDATES_DIR / sys.argv[1]
    layers = trace_layers(source_gray())
    (out).mkdir(parents=True, exist_ok=True)
    (out / "layers.json").write_text(json.dumps(layers))
    print(score_layers(layers))
    write_forms(layers, out)
