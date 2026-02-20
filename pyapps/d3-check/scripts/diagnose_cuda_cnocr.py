#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Diagnose why CUDA is or is not loading for PyTorch/CnOCR.
Run locally to verify: when CUDA is available, PyTorch and CnOCR can use it.
Ref: PyTorch https://pytorch.org/docs/stable/cuda.html, https://pytorch.org/get-started/locally
     CnOCR https://github.com/breezedeus/cnocr (pip install cnocr[ort-gpu] for GPU)
"""
import sys
import os

# Add d3-check and repo root so pycore and cnocr can be resolved
_script_dir = os.path.dirname(os.path.abspath(__file__))
_d3_check = os.path.dirname(_script_dir)
_repo_root = os.path.dirname(_d3_check)  # pyapps
_core_node = os.path.dirname(_repo_root)  # core_node (pycore lives here)
for p in (_d3_check, _core_node, _repo_root):
    if p not in sys.path:
        sys.path.insert(0, p)


def _diagnose_torch_cuda():
    """Return (cuda_usable: bool, reason: str, detail: dict)."""
    detail = {}
    try:
        import torch
        detail["torch_version"] = torch.__version__
        detail["cuda_compiled"] = getattr(torch.version, "cuda", None)
        detail["cuda_available"] = torch.cuda.is_available()
        if detail["cuda_compiled"] is None or (isinstance(detail["cuda_compiled"], str) and detail["cuda_compiled"] == ""):
            return False, "PyTorch was built without CUDA (CPU-only build). To use GPU: install CUDA build from https://pytorch.org/get-started/locally (e.g. pip install torch --index-url https://download.pytorch.org/whl/cu118).", detail
        if not detail["cuda_available"]:
            return False, "PyTorch is CUDA-built but torch.cuda.is_available() is False (driver/runtime issue or no GPU). Check NVIDIA driver and CUDA runtime.", detail
        detail["device_count"] = torch.cuda.device_count()
        detail["device_name"] = torch.cuda.get_device_name(0) if detail["device_count"] else None
        return True, "CUDA is available.", detail
    except Exception as e:
        detail["error"] = str(e)
        return False, f"Failed to import or check torch: {e}", detail


def _test_tensor_on_cuda():
    """Return (success: bool, message: str)."""
    try:
        import torch
        if not torch.cuda.is_available():
            return False, "torch.cuda.is_available() is False, skip tensor test"
        x = torch.rand(2, 2, device="cuda")
        y = x + 1
        return True, f"Tensor on CUDA OK (device: {x.device})"
    except RuntimeError as e:
        return False, f"RuntimeError (e.g. Torch not compiled with CUDA enabled): {e}"
    except Exception as e:
        return False, str(e)


def _test_cnocr_context(context: str, run_one_ocr: bool = True):
    """Try CnOcr(context=context); if run_one_ocr, call .ocr() on a tiny image to trigger device use. Return (success: bool, message: str)."""
    try:
        from pycore.pyfoundations.third_party import get_third_package_cnocr
        from pycore.pyfoundations.third_party import get_third_package_numpy
        cnocr_module = get_third_package_cnocr()
        if cnocr_module is None:
            return False, "cnocr not installed (pip install cnocr[ort-cpu] or cnocr[ort-gpu])"
        CnOcr = cnocr_module.CnOcr
        ocr = CnOcr(det_model_name="naive_det", rec_model_name="doc-densenet_lite_136-gru", context=context)
        if run_one_ocr:
            np = get_third_package_numpy()
            tiny = np.zeros((32, 100, 3), dtype=np.uint8)
            ocr.ocr(tiny)
        return True, f"CnOcr(context={context!r}) created and ocr() ran OK"
    except RuntimeError as e:
        return False, f"RuntimeError: {e}"
    except Exception as e:
        return False, f"{type(e).__name__}: {e}"


def main():
    print("=" * 60)
    print("CUDA / CnOCR diagnostic (local)")
    print("=" * 60)

    cuda_ok, reason, detail = _diagnose_torch_cuda()
    print("\n[1] PyTorch CUDA diagnostic:")
    for k, v in detail.items():
        print(f"    {k}: {v}")
    print(f"    Result: {reason}")

    print("\n[2] Tensor on CUDA test:")
    ok, msg = _test_tensor_on_cuda()
    print(f"    {'PASS' if ok else 'FAIL'}: {msg}")

    print("\n[3] CnOCR context=cpu:")
    ok_cpu, msg_cpu = _test_cnocr_context("cpu")
    print(f"    {'PASS' if ok_cpu else 'FAIL'}: {msg_cpu}")

    print("\n[4] CnOCR context=gpu:")
    ok_gpu, msg_gpu = _test_cnocr_context("gpu")
    print(f"    {'PASS' if ok_gpu else 'FAIL'}: {msg_gpu}")

    if cuda_ok and not ok_gpu:
        print("\n[!] CUDA is available in PyTorch but CnOCR(context='gpu') failed.")
        print("    Possible: cnocr installed with ort-cpu only. For GPU use: pip install cnocr[ort-gpu]")
        print("    Or: CnOcr internally uses PyTorch; ensure same Python env has torch CUDA build.")

    if not cuda_ok:
        print("\n[!] Why CUDA did not load:")
        print(f"    {reason}")
        print("    To enable GPU: install PyTorch with CUDA from https://pytorch.org/get-started/locally")

    print("\n" + "=" * 60)
    return 0 if (ok_cpu and (cuda_ok == ok_gpu or not cuda_ok)) else 1


if __name__ == "__main__":
    sys.exit(main())
