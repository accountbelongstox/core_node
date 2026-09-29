# FIX 2026-09-30 — Share the display GPU with local models (VRAM headroom)

## Finding
- pyservice never resets or reloads the GPU driver (no `nvidia-smi -r`, `modprobe -r`, DM restart). `memory_gate.reclaim_vram` only stops pycore's own child processes and is opt-in.
- The real display risk: local model servers (qwen3tts, chattts) let the CUDA caching allocator take all free VRAM of the card that also drives the desktop. The compositor/browser then cannot allocate and the screen freezes or goes black. Launch floors only checked free VRAM against the model minimum, never left room for the display.
- Not reproducible on `debian-cpu` (Intel iGPU only); the NVIDIA host is `debian-gpu`.

## Official guidance used
- PyTorch CUDA notes: the caching allocator keeps memory reserved and never returns it to other GPU applications without `empty_cache()`; `torch.cuda.set_per_process_memory_fraction(fraction, device)` caps the allocator and raises OOM inside that process instead.
- NVIDIA driver persistence docs: when X runs on the GPU the driver stays initialized from boot to shutdown, so nothing on Linux needs a driver reload for display + compute sharing.
- NVIDIA/CUDA: a GPU driving a display is subject to a kernel watchdog (~5-10 s); the fully isolated setup is display on the iGPU and NVIDIA headless (PRIME render offload docs).
- Ollama `OLLAMA_GPU_OVERHEAD` reserves VRAM but is reported ignored by the llama-server runner (ollama#18679); not relied on.

## Change
- `network_constants.py`: `GPU_DISPLAY_RESERVE_MIN_MB=1024`, `GPU_DISPLAY_RESERVE_RATIO=0.10`, `PYCORE_GPU_DISPLAY_RESERVE_MB` (0 disables), `PYCORE_GPU_MEMORY_FRACTION`.
- `memory_gate.py`: `display_reserve_mb()` (only when nvidia-smi `display_active=Enabled`; headless GPUs reserve 0) and `gpu_memory_env()`.
- `tts_service_manager.py`: launch floor now counts free VRAM minus the display reserve; qwen3tts and chattts servers receive `PYCORE_GPU_MEMORY_FRACTION`.
- `tts_server_common.apply_gpu_memory_fraction` (stdlib helper) applied before model load in `qwen3tts_api_server.py` and `chattts_api_server.py`.

## Verified
- py_compile clean; fake `nvidia-smi` (display_active=Enabled, 8188 MiB): reserve 1024 MiB, fraction 0.875; `PYCORE_GPU_DISPLAY_RESERVE_MB=0` returns empty.
- Not run on a real NVIDIA host.

## Open
- In-process engines (parler, bark, faster-whisper) and Ollama are not capped; route through the same helper if they show display stalls.
- Best isolation remains display on the iGPU with the NVIDIA card headless.
