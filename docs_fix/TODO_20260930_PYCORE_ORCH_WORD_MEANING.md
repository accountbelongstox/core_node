# TODO: pycore orchestration - read the word's Chinese meaning

Status: pending development (wordnew client composer implements it).
Source: docs_fix/REQUIREMENTS_20260930_WORDNEW_CLIENT_ORCHESTRATION.md section 4.4 (B2).

## Requirement

A word step of the orchestration pattern may carry `meaning: true` (default
pattern: `config/audio_orchestration_contract.json`). After each word clip the
word's short Chinese meaning is read (a zh clip), before the next word.

## Current pycore behaviour

- `orch_service._normalize_pattern` keeps only `type` / `times`: the flag is
  dropped when a task is saved.
- `orch_generate.build_sentence_items` emits word items only; no meaning item.
- `orch_video.build_cards` already shows the meaning line (ECDICT
  `short_meaning`), but it is never spoken.

## To implement

1. Keep `meaning` (bool) in `_normalize_pattern` and the task record.
2. In `build_sentence_items`, after each word item emit
   `{kind: "sentence", language: "zh", text: short_meaning(ECDICT), meaning_of: word}`
   when the step has `meaning`; skip empty meanings.
3. Resolve these like sentence resources (central sentence cache -> Laravel ->
   local synthesis); the resource identity is the shared one (sha256 of
   kind:language:content_id).
4. `orch_video.build_cards`: attach a `meaning_of` clip to its word card
   (meaning line spans = those clips), as the client stage does
   (`shared/orchestration/orchStageLayout.ts`).
5. Timeline entries carry `meaning_of` so Laravel / wordnew players can highlight.
