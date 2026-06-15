# Directory Tree: pyfoundations

**Path:** `D:\programing\core_node\pycore\pyfoundations`

Layering (STRICT): top-level modules import ONLY `pybasecommon` (+ stdlib);
`pybasecommon` is the stdlib-only kernel that imports nothing outside itself.

```
pyfoundations/
├── pybasecommon/              # KERNEL — stdlib-only, self-contained (internal imports OK)
│   ├── __init__.py
│   ├── color_print.py         # ColorPrint + shared callback registry + stream()
│   ├── commander.py           # Commander — routes live output via ColorPrint.stream
│   ├── safe_subprocess.py
│   ├── encyclopedia.py         # process cache (moved from top-level)
│   └── compute_caps.py         # CUDA/ONNX kernel: CUDADetector, ORT/CnOCR pkgs,
│                               #   is_onnx_cuda_usable/ensure_onnx_cuda_usable, CudaInitializer
│                               #   (merge of cuda_detector + cpu_gpu_packages
│                               #    + onnx_runtime_capability + cuda_initializer)
├── device/
│   ├── __init__.py
│   └── scrcpy_device.py
├── gvar/
│   ├── __init__.py
│   └── global_var_manager.py
├── __init__.py                 # package facade (re-exports submodules)
├── app_launcher.py             # + register_executable_launcher_provider() hook
├── database_base.py
├── event_bus.py
├── file_lock_manager.py        # FileLockManager + SplitFileStore (absorbed)
├── secret_manager.py
├── stdio_utils.py
├── system_info.py
├── system_paths.py             # paths + UserDataStore/get_user_data_store (absorbed)
├── tasks.py                    # Task/TaskState/TaskPriority + GlobalTaskQueue (merged)
├── third_party.py              # dependency manager + HF/OCR provisioning chain:
│                               #   hf_* helpers, PREWARM_SPEC, init_ocr_models_from_hf,
│                               #   OcrInitializer, init_third_party_cnocr (OCR cluster absorbed)
└── thread_bus.py
```

Removed (merged away): `encyclopedia.py` → `pybasecommon/encyclopedia.py`;
`cuda_detector.py`, `cpu_gpu_packages.py`, `onnx_runtime_capability.py`,
`cuda_initializer.py` → `pybasecommon/compute_caps.py`; `ocr_initializer.py`,
`ocr_hf_models.py`, `ocr_prewarm_spec.py`, `huggingface_hub_helper.py` → `third_party.py`;
`task_models.py` + `global_task_queue.py` → `tasks.py`; `split_file_store.py` →
`file_lock_manager.py`; `user_data_store.py` → `system_paths.py`.

---
*Maintained manually to reflect the post-restructure layout.*
