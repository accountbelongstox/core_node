---
name: project-sentence-segmentation
description: 2026-09-30 one shared sentence segmentation contract + Python/PHP/TS adapters; nothing may split sentences with its own regex; where it is wired and the tooling traps met
metadata:
  type: project
---

Sentence splitting is ONE rule set: `config/sentence_segmentation_contract.json` (rules + 57 vectors) with adapters `pycore/pyfoundations/sentence_segmenter.py`, `poly_apps/laravel_main/app/Support/SentenceSegmenter.php` (contract at `dirname(dirname(base_path()))/config`, like `QueueCenterContract`) and `poly_apps/pycore_laravel_wordnew_ui/core/contracts/SentenceSegmenter.ts`. A rule change starts in the JSON with a vector; every adapter must pass all vectors (scratch runners: `run_vectors.py|php`, `run_vectors_ts.cjs` after tsc). Full design: `docs_fix/DESIGN_AUDIO_ORCHESTRATION.md` section 7.

Wired: pycore `text_parsing.split_sentences` (segment FIRST, then `normalize_punctuation` per sentence - normalizing first loses CJK terminals), `orch_sources.build_text_sentences` (`speakable=True`), `orch_books.estimate_sentence_seconds`, `tts_text_chunking` (loads the segmenter by path: staged sibling first, else `pyfoundations/`; the segmenter finds a sibling contract file first, else `config/`); `tts_service_manager` stages segmenter + contract for fishspeech and lists both in the identity scripts of qwen3tts/fishspeech/melotts/voxcpm2. Laravel document controller, article parser (keeps `isSentenceValid`/`modifySentence` as consumer policy), ItTools count. UI `BookStats`, `WordNewArticlePlaybackHighlighter`.

**Why:** every component had its own regex (decimals, IPs, `file.md`, `Dr.`, initials were cut; Laravel dropped terminals; the article parser cut at every comma), so one sentence had different boundaries in queue, store, reader and video.

**How to apply:** never add a sentence-cutting regex anywhere; extend the contract. Known consequence: Laravel document sentence ids now include terminal punctuation (old documents stay idempotent per slot). Out of scope by design: mcp-chrome text chunker, tampermonkey scripts.

Tooling traps seen here: python heredocs in Git Bash lose CJK text and backslashes (matching then fails silently) - write script files with the Write tool; the Edit tool converts a CRLF file to LF (whole-file churn) - after editing a CRLF file, `sed -i 's/$/\r/'` and re-check `git diff --numstat` against `--ignore-space-at-eol`.
