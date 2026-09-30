# -*- coding: utf-8 -*-
"""Boot verification of the translation engines (cheap: no network)."""

from pycore.pyutils.common.model_boot import model_boot
from pycore.pyutils.common.model_checks import packages_check
from pycore.pyutils.common.model_manifest import CATEGORY_TRANSLATE
from pycore.pyutils.common.model_reasons import MODEL_REASON_PACKAGE_MISSING, model_reason
import pycore.pyutils.translator.translate_manifest as translate_manifest

model_boot.register_checks(CATEGORY_TRANSLATE, tuple(
    (
        entry.id,
        lambda entry=entry: packages_check(
            (entry.pip[0],), model_reason(MODEL_REASON_PACKAGE_MISSING, package=entry.pip[1]),
        ),
    )
    for entry in translate_manifest.TRANSLATE_ENTRIES
))
