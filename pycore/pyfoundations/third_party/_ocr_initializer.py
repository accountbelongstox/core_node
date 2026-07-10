# -*- coding: utf-8 -*-
"""
OcrInitializer class + CUDA/OCR singletons + init entry points.

Companion to compute_caps.CudaInitializer (same DI pattern). Assumes
CudaInitializer.run() already done (ONNX switch + CUDA readiness). Callers inject
get_cnocr, run_pip_uninstall, run_pip_install, clear_cnocr_cache,
is_pip_package_installed.

The whole project has only this path for CUDA/ORT init: init_third_party_cnocr().
"""

from typing import Any, Dict, Optional, Callable, Tuple

from pycore.pyfoundations.pybasecommon.color_print import ColorPrint
from pycore.pyfoundations.pybasecommon.compute_caps import (
    CudaInitializer,
    CUDADetector,
    is_onnx_cuda_usable,
    get_ort_install_package,
    last_ort_install_ran,
    ORT_CPU_PKG,
    ORT_GPU_PKG,
)

from ._pip_runner import (
    _run_pip_uninstall,
    _run_pip_install_for_ocr,
    _run_pip_install_for_ocr_force,
    _clear_cnocr_cache,
    _is_pip_package_installed,
    _verify_onnx_import,
    _fix_ort_dependency_conflicts,
)
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
    ONNX switch and ensure_onnx_cuda_usable are done by CudaInitializer.run() (predecessor). Run once per process (guarded).
    Caller injects get_cnocr, run_pip_uninstall, run_pip_install, clear_cnocr_cache, is_pip_package_installed.
    """

    def __init__(
        self,
        *,
        get_cnocr: Callable[[], Any],
        run_pip_uninstall: Callable[[str], None],
        run_pip_install: Callable[[str, Optional[str]], None],  # (package_name, index_url=None)
        clear_cnocr_cache: Callable[[], None],
        is_pip_package_installed: Callable[[str], bool],
        verify_onnx_import: Optional[Callable[[], bool]] = None,
        run_pip_install_force: Optional[Callable[[str], None]] = None,
    ):
        self._get_cnocr = get_cnocr
        self._run_pip_uninstall = run_pip_uninstall
        self._run_pip_install = run_pip_install
        self._clear_cnocr_cache = clear_cnocr_cache
        self._is_pip_package_installed = is_pip_package_installed
        self._verify_onnx_import = verify_onnx_import if verify_onnx_import is not None else (lambda: True)
        self._run_pip_install_force = run_pip_install_force
        self._done = False
        self._prewarmed: Dict[str, Any] = {}

    def _use_gpu_for_ort(self) -> bool:
        """True if we should use GPU for OCR (install and context). Uses ORT CUDA capability when available."""
        return is_onnx_cuda_usable()

    def _need_onnx_runtime_switch(self) -> Tuple[bool, bool]:
        """
        Return (need_uninstall_other, need_install_target).
        When both False, no switch needed (target already active).
        Install choice: system GPU (CUDADetector) so we install onnxruntime-gpu when NVIDIA present.
        """
        use_gpu = CUDADetector.is_cuda_available()
        cpu_installed = self._is_pip_package_installed(ORT_CPU_PKG)
        gpu_installed = self._is_pip_package_installed(ORT_GPU_PKG)
        if use_gpu:
            need_uninstall = cpu_installed
            need_install = not gpu_installed
        else:
            need_uninstall = gpu_installed
            need_install = not cpu_installed
        return need_uninstall, need_install

    def _ensure_onnx_runtime_switch(self) -> None:
        """
        Uninstall the other runtime only if installed; install target only if missing.
        Target: OCR on CUDA 12 (PyPI onnxruntime-gpu). When installing gpu, always use PyPI (CUDA 12).
        CUDA 12 DLLs (cublasLt64_12 etc.) are provided by ensure_onnx_cuda_usable via nvidia-cublas-cu12.
        When switching to GPU: install (if needed) then verify import works; only then uninstall CPU so we never leave ORT broken.
        """
        use_gpu = CUDADetector.is_cuda_available()
        gpu_installed = self._is_pip_package_installed(ORT_GPU_PKG)

        need_uninstall, need_install = self._need_onnx_runtime_switch()
        target_pkg = get_ort_install_package()

        if not need_uninstall and not need_install:
            ColorPrint.blue("[HF] No ONNX runtime switch needed (target already active).")
            if use_gpu and not self._verify_onnx_import():
                ColorPrint.blue("[HF] ORT GPU import check failed; force-reinstalling onnxruntime-gpu...")
                if self._run_pip_install_force is not None:
                    self._run_pip_install_force(target_pkg)
                    if not self._verify_onnx_import():
                        ColorPrint.yellow("[HF] ORT GPU still not importable; installing onnxruntime (CPU) so app can run.")
                        self._run_pip_install(ORT_CPU_PKG)
                        self._clear_cnocr_cache()
                else:
                    ColorPrint.yellow("[HF] ORT GPU import check failed; install onnxruntime (CPU) manually if needed.")
            return

        if use_gpu and need_uninstall and need_install:
            # CPU installed, GPU not: pip usually requires uninstall CPU before installing GPU. Uninstall -> install -> verify; if verify fails restore CPU.
            ColorPrint.blue("[HF] Uninstalling CPU-only onnxruntime before installing ort-gpu...")
            self._run_pip_uninstall(ORT_CPU_PKG)
            ColorPrint.blue("[HF] Installing onnxruntime-gpu[cuda,cudnn] for ort-gpu (CUDA 12)...")
            self._run_pip_install(target_pkg)
            if not self._verify_onnx_import():
                ColorPrint.yellow("[HF] ORT GPU import check failed after install; restoring onnxruntime (CPU) so app can run.")
                self._run_pip_install(ORT_CPU_PKG)
            self._clear_cnocr_cache()
            return
        if need_install and not (use_gpu and need_uninstall):
            if use_gpu:
                ColorPrint.blue("[HF] Installing onnxruntime-gpu[cuda,cudnn] for ort-gpu (CUDA 12)...")
            else:
                ColorPrint.blue("[HF] Installing onnxruntime for ort-cpu...")
            self._run_pip_install(target_pkg)

        if need_uninstall and use_gpu and not need_install:
            # GPU already installed, CPU also listed by pip. Do NOT uninstall CPU here: both packages
            # provide the same module name "onnxruntime" and share the same site-packages path;
            # uninstalling onnxruntime (CPU) would remove the module files and break the current
            # process (e.g. module has no attribute get_available_providers). Ensure import works
            # and optionally force-reinstall GPU so disk state is correct; leave CPU package as-is.
            if not self._verify_onnx_import():
                if self._run_pip_install_force is not None:
                    ColorPrint.blue("[HF] ORT GPU import check failed; force-reinstalling onnxruntime-gpu...")
                    self._run_pip_install_force(target_pkg)
                    if not self._verify_onnx_import():
                        ColorPrint.yellow("[HF] ORT GPU still not importable after reinstall; installing onnxruntime (CPU) so app can run.")
                        self._run_pip_install(ORT_CPU_PKG)
                        self._clear_cnocr_cache()
                else:
                    ColorPrint.yellow("[HF] ORT GPU import check failed; install onnxruntime (CPU) manually if needed.")
            # Skip CPU uninstall: avoid breaking shared onnxruntime module used by ort-gpu.
        elif need_uninstall and not use_gpu:
            ColorPrint.blue("[HF] Uninstalling onnxruntime-gpu before using ort-cpu...")
            self._run_pip_uninstall(ORT_GPU_PKG)

        if need_uninstall or need_install:
            self._clear_cnocr_cache()

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


# CUDA init: single entry for whole project (system GPU info + ORT version switch + ensure ORT CUDA). Runs before OCR init.
def _run_ort_version_switch_for_cuda() -> None:
    """Run ONNX runtime switch once: uninstall the other (cpu/gpu), install target (gpu uses PyPI CUDA 12 with [cuda,cudnn])."""
    _ocr_initializer._ensure_onnx_runtime_switch()

_cuda_initializer = CudaInitializer(
    print_cuda_prompt=_print_cuda_support_prompt,
    run_pip_install=_run_pip_install_for_ocr,
    log=lambda msg: ColorPrint.blue(msg),
    run_ort_version_switch=_run_ort_version_switch_for_cuda,
    is_pip_package_installed=_is_pip_package_installed,
)

# OCR init: single entry via OcrInitializer (uninstall other / install target only when needed; skip when no switch). Requires CudaInitializer.run() as predecessor.
_ocr_initializer = OcrInitializer(
    get_cnocr=get_third_package_cnocr,
    run_pip_uninstall=_run_pip_uninstall,
    run_pip_install=_run_pip_install_for_ocr,
    clear_cnocr_cache=_clear_cnocr_cache,
    is_pip_package_installed=_is_pip_package_installed,
    verify_onnx_import=_verify_onnx_import,
    run_pip_install_force=_run_pip_install_for_ocr_force,
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
    if last_ort_install_ran():
        _fix_ort_dependency_conflicts()
    return _ocr_initializer.run()
