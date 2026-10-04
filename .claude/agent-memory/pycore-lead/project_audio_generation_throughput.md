---
name: project-audio-generation-throughput
description: 2026-10-03 audio generation audit on node 31a9 + Colab - fan-out lane starvation fix, GPU/VRAM ceiling, Colab restart facts, Laravel language starvation
metadata:
  type: project
---

- Sentence lane fan-out (`_run_audio_synth_lane`) used to end lanes on a momentarily empty queue and never respawned them while one lane kept running, so qwen3tts got one job at a time (~100-125/h). Fixed with busy-lane counter + idle wait on a work signal (laravel_audio_worker.py). Verify with `py-spy dump` (pip install --target in scratchpad works on Windows): expect N `SentenceAudioSynth-*` threads.
- qwen3tts 1.7B on RTX 4060 Laptop 8GB: batch capped at 2 by VRAM (about 1.76 GB per extra item, measured 4.6 GB -> 6.35 GB) and by SM count; ceiling about 240-290 sentences/h. Only a 0.6B model (quality decision) or more VRAM raises it.
- sherpa-onnx Kokoro defaulted to 1 thread; 4 threads = 2x faster per word (bench: 1.62s -> 0.77s).
- Laravel WorkLeaseService fills a claim's budget language by language in declared order (starves later languages); pycore word lane now rotates declared order per claim.
- Colab: runtime had no GPU (usage limit, "Connect without GPU" dialog is auto-confirmed by colab_cli); CPU node does words only. Old Colab runs kept an orphan VM process on old code; `colab_cli restart` gives a fresh clone. Colab 401 on /api/worker/register = unsigned request because CORE_NODE_CLIENT_KEY_1 was not decrypted on that VM; restored from the Drive backup secrets now.
- `chrome_screenshot`/`colab_output` MCP tools ignore a tab id for output and can switch the user's active tab; prefer colab_cli logs.

**Why:** next throughput question should start from these measured ceilings, not rediscover them.
**How to apply:** check the lane thread dump before blaming the engine; do not retune VRAM batch plan without measuring.
