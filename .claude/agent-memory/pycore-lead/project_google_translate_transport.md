---
name: project-google-translate-transport
description: 2026-10-04 Google Translate findings - googletrans version does not matter, TLS stack does; keyless clients5 batch endpoint is the reliable path; NIV zh backfill driver
metadata:
  type: project
---

- googletrans 4.0.2 is the only release importable on Py3.13 + httpx 0.28 (3.x/4.0.0rc1 pull old httpx that imports removed `cgi`; 4.0.1 imports `ProxiesTypes` that httpx>=0.28 dropped). Its gtx endpoint (translate.googleapis.com) answers 429 for some clients' TLS handshake: Windows python313 (OpenSSL 3.0.21) and every curl got 429, Python 3.11/3.13 with OpenSSL 3.5.7 (uv build, Linux server) got 200 from the same IPs. deep-translator (/m endpoint) and the webapp token path were 429 everywhere tried.
- googletrans 4.0.2 default `raise_exception=False` returns the ORIGINAL text as the "translation" on a 429 (DUMMY_DATA). pycore now passes `raise_exception=True`.
- Reliable path: `POST https://clients5.google.com/translate_a/t?client=dict-chrome-ex&sl&tl` with repeated `q=` fields (batch of 50 in about 1s, no tk token, works on Windows and the server). Implemented in `pycore/pyutils/translator/google_batch_client.py`, used first by `GoogleTranslator.translate_batch`; googletrans is the second step; the task chain (`task_capability_chains`) falls through local_ai/ecdict/wordnet/ai.
- Laravel `GoogleTranslateClient` already used the same endpoint as fallback; 2026-10-04 added `translateBatch` single-request chunks + a 10 min cache flag that skips the 429ing primary. stichoza/google-translate-php v5.3.5 also works on the server but is single-text and adds a dependency, so it was not adopted.
- NIV zh backfill = `python -m pycore.pyctl.translation.study_gen_backfill --source-key <key> --languages zh --workers 5` (claim/submit/release of /api/app_qy_v1/study-gen, client key). Marks segments done with languages_done=[zh] only. Plan zh clips appear only after an authenticated plan status read runs syncMembership (auth:sanctum route; client key cannot call it).

**Why:** user wanted fast Google translation built in; version choice was the wrong variable.
**How to apply:** before touching Google translation, test the transport from this host (curl is NOT representative); keep the batch client first. See [[project-pycore-pitfalls]].
