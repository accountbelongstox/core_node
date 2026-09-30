# -*- coding: utf-8 -*-
"""Translation engine declarations: the ONE place translator facts live."""

from pycore.pyutils.common.model_manifest import (
    CATEGORY_TRANSLATE,
    RUNTIME_CLOUD,
    ModelEntry,
    model_manifest,
)

TRANSLATE_ENTRIES = (
    ModelEntry(
        "google", CATEGORY_TRANSLATE, RUNTIME_CLOUD,
        note="Free Google translation (googletrans)",
        concurrency="cloud", pip=("googletrans", "googletrans"),
        library_name="google_translate", library_kind="pip", cloud=True,
    ),
)

model_manifest.register(TRANSLATE_ENTRIES)
