# -*- coding: utf-8 -*-
"""
OcrInitializer class + CUDA/OCR singletons + init entry points.

Prerequisite installers own package repair; runtime code only probes and uses ORT.
"""

from typing import Any, Callable, Dict, Optional

from pycore.pyfoundations.pybasecommon.color_print import ColorPrint
from pycore.pyfoundations.pybasecommon.compute_caps import (
    CudaInitializer,
    is_onnx_cuda_usable,
)

from ._pip_runner import _is_pip_package_installed
from ._torch_cuda import _print_cuda_support_prompt
from ._hf_helpers import (
    get_third_package_cnocr,
    get_third_package_huggingface_hub,
    _ensure_huggingface_cli_on_path,
)
from ._ocr_models import (
    init_ocr_models_from_hf,
    PREWARM_LANGUAGES,
    prewarm_det_rec_for_lang,
    REC_MORE_CONFIGS_CNOCR,
)


class OcrInitializer:
    """
    Single entry for OCR init: download from HF -> load cnocr -> prewarm.
    CUDA/ORT probing is done by CudaInitializer.run() first. Package mutation is
    intentionally excluded from runtime initialization.
    """

    def __init__(
        self,
        *,
        get_cnocr: Callable[[], Any],
    ):
        self._get_cnocr = get_cnocr
        self._done = False
        self._prewarmed: Dict[str, Any] = {}

    def _use_gpu_for_ort(self) -> bool:
        """True if we should use GPU for OCR (install and context). Uses ORT CUDA capability when available."""
        return is_onnx_cuda_usable()

    def run(self) -> bool:
        """
        Run full OCR init once: HF download -> load cnocr -> prewarm.
        Assumes CudaInitializer.run() already called (ONNX switch + CUDA prompt and device line done there). Returns True if cnocr is available and prewarm completed.
        """
        if self._done:
            return self._get_cnocr() is not None
        self._done = True
        try:
            init_ocr_models_from_hf(
                cnstd=True,
                cnocr=True,
                use_gpu=self._use_gpu_for_ort(),
            )
        except Exception as e:
            ColorPrint.gray("[OcrInitializer] HF init: %s" % e)
        cnocr_module = self._get_cnocr()
        if cnocr_module is None:
            return False
        self._prewarm(cnocr_module)
        return True

    def _prewarm(self, cnocr_module: Any) -> None:
        """Build zh/en/cht CnOcr instances from spec. Use GPU context only when is_onnx_cuda_usable() is True.
        rec_more_configs from REC_MORE_CONFIGS_CNOCR so rapidocr has font_path."""
        CnOcr = cnocr_module.CnOcr
        use_gpu = self._use_gpu_for_ort()
        ctx = "gpu" if use_gpu else "cpu"
        for lang in PREWARM_LANGUAGES:
            det, rec_order = prewarm_det_rec_for_lang(lang, use_gpu)
            inst = None
            for rec in rec_order:
                try:
                    inst = CnOcr(
                        det_model_name=det,
                        rec_model_name=rec,
                        context=ctx,
                        rec_more_configs=REC_MORE_CONFIGS_CNOCR,
                    )
                    ColorPrint.blue("[CnOCR] Prewarmed %s: det=%s rec=%s context=%s" % (lang, det, rec, ctx))
                    break
                except Exception as e:
                    ColorPrint.gray("[CnOCR] Prewarm %s (%s+%s): %s" % (lang, det, rec, e))
            self._prewarmed[lang] = inst

    def get_prewarmed(self, lang: str) -> Optional[Any]:
        """Return prewarmed CnOcr for lang ('zh', 'en', 'cht') or None."""
        return self._prewarmed.get(lang)


# CUDA init probes the installer-managed CUDA/ORT environment before OCR init.
_cuda_initializer = CudaInitializer(
    print_cuda_prompt=_print_cuda_support_prompt,
    log=lambda msg: ColorPrint.blue(msg),
    is_pip_package_installed=_is_pip_package_installed,
)

# OCR init only downloads models and creates providers; it never changes packages.
_ocr_initializer = OcrInitializer(
    get_cnocr=get_third_package_cnocr,
)


def get_cnocr_prewarmed(lang: str):
    """Return prewarmed CnOcr for lang: 'zh', 'en', 'cht'. None if not available."""
    return _ocr_initializer.get_prewarmed(lang)


def init_third_party_cnocr() -> bool:
    """
    Ensure huggingface_hub then run CUDA init once (ONNX switch + system GPU + ensure_onnx_cuda_usable), then OCR init once:
    download from HF -> load cnocr -> prewarm zh/en/cht. Whole project has only this path for CUDA/ORT init.
    Official: det default ch_PP-OCRv5_det; zh v5/server, en en_PP-OCRv4/v3, cht chinese_cht_PP-OCRv3.
    """
    hub = get_third_package_huggingface_hub()
    if hub is not None:
        _ensure_huggingface_cli_on_path()
    _cuda_initializer.run()
    return _ocr_initializer.run()
