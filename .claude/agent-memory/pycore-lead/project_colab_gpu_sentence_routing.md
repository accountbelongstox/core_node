---
name: project-colab-gpu-sentence-routing
description: 2026-10-04 sentence-lane language routing (Colab GPU takes zh, desktop keeps en), Colab runner stale-boot fix, T4 fp16, regpu; live-unverified GPU branch
metadata:
  type: project
---

- Routing is by DECLARATION, not order: Laravel pass 1 splits a claim evenly over the open declared languages, so order only matters in pass 2. Policy lives in `config/queue_center_contract.json` `work_leases.sentence_language_focus` and `pyctl/tts/audio_lane_language_focus.py` (`SentenceLanguageFocus`, composed into `AudioLaneLeases`). Colab (notebook) with GPU declares only zh; desktop declares all en-first and drops zh while an online GPU notebook peer declares it (GET work_nodes?online=1, cached 60 s, fails open); a narrowed claim with no rows widens the next claim.
- A Colab without GPU pins sentence=kokoro (not in SENTENCE_QUALITY_ENGINES), so the sentence capability is empty and it claims words only; no extra code.
- qwen3tts server dtype was hard-coded bfloat16; T4 (sm75) now gets float16 via `_model_dtype` in tts_install_assets/qwen3tts_api_server.py. fp16 quality/NaN on T4 is untested.
- `colab_cli start` booted flag: stale-output baseline (`_fresh_output`); `regpu` (Disconnect and delete runtime via `[command=powerwash-current-vm]`) is opt-in and untested live. Notebook metadata already requests accelerator GPU / T4; a CPU runtime stays CPU until deleted.
- The Colab tab's JS can hang (every chrome_javascript call times out at 30 s) while the pycore process keeps leasing; judge Colab by /api/work/nodes heartbeat, not the tab.
- Scratch probes: do not run python from the scratchpad root, it contains an mcp.py that shadows the mcp package; use a subfolder.

**Why:** user wants the local 4060 (about 200/h) to keep en while Colab's T4 does the 37k+ zh backlog.
**How to apply:** if zh stalls with a Colab GPU online, check the node's declared languages in /api/work/nodes first. See [[project-audio-generation-throughput]].
