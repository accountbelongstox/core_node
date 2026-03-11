# -*- coding: utf-8 -*-
"""
OCR initialization class: single entry for HF download and zh/en/cht prewarm.
Assumes CUDA init already done (CudaInitializer.run() as predecessor): ONNX switch, system GPU info,
and ORT CUDA readiness are handled there. Here we only: download from HF -> load cnocr -> prewarm.
Callers inject get_cnocr, run_pip_uninstall, run_pip_install, clear_cnocr_cache, is_pip_package_installed.
"""
from __future__ import annotations

from typing import Callable, Optional, Any

from pycore.pyfoundations.color_print import ColorPrint
from pycore.pyfoundations.cpu_gpu_packages import (
    ORT_CPU_PKG,
    ORT_GPU_PKG,
    get_ort_install_package,
)
from pycore.pyfoundations.cuda_detector import CUDADetector
from pycore.pyfoundations.onnx_runtime_capability import is_onnx_cuda_usable
from pycore.pyfoundations.ocr_hf_models import init_ocr_models_from_hf
from pycore.pyfoundations.ocr_prewarm_spec import (
    PREWARM_LANGUAGES,
    REC_MORE_CONFIGS_CNOCR,
    prewarm_det_rec_for_lang,
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
        self._prewarmed: dict[str, Any] = {}

    def _use_gpu_for_ort(self) -> bool:
        """True if we should use GPU for OCR (install and context). Uses ORT CUDA capability when available."""
        return is_onnx_cuda_usable()

    def _need_onnx_runtime_switch(self) -> tuple[bool, bool]:
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
        rec_more_configs from REC_MORE_CONFIGS_CNOCR (ocr_prewarm_spec) so rapidocr has font_path."""
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
