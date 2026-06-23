# GameAISDK agent instructions

Canonical: **`docs/CODE_STANDARDS.md`**. Rule: `.cursor/rules/game-aisdk.mdc`.

- **Imports:** At file top; platform-specific after guard. No import in except; fix circular refs by structure.
- **Exceptions:** Concrete types only; handlers log and re-raise or return clear result; no no-op catch.
- **Language:** Code, comments, docstrings, logs in English; UI strings and config keys unchanged.
- **Third-party:** `pycore.pyfoundations.third_party` getters only; call at top level.
- **pycore sys.path:** Before any pycore import, ensure the directory containing `pycore` is on `sys.path` (walk up from `__file__`, then `sys.path.insert(0, _dir)`).
- **Docs:** Key points only.


**Git:** `git commit` only (local) — no rollback, no other git ops, no push unless asked. Otherwise edit code freely.
