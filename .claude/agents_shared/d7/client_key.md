# shell-windows: client key existence check (D7 prerequisite)

Date: 2026-09-27. Task: verify `CORE_NODE_CLIENT_KEY_1` and `DINGDUODUO_SUPER_CODE_SIGNING_KEY_1` locally before D7 starts. No key value, prefix, or fragment is included below or was printed/logged anywhere during this check.

## CORE_NODE_CLIENT_KEY_1

- Exists: **yes** (raw file present).
- Store path: `.secret_keys/.secret_ignore/CORE_NODE_CLIENT_KEY_1` (repo-relative, under `D:\programing\core_node`).
- Encrypted copy (`.secret_keys/already_encrypted/CORE_NODE_CLIENT_KEY_1.js`): not present. Batch bundle (`already_batch_encrypted/`): not checked further once the raw file was confirmed non-empty, per the generator's own precedence (raw file wins).
- What I ran: **nothing**. The raw file already exists and is non-empty, so per instructions I did not invoke the K2 generator. This also matches the generator's own idempotency: `Initialize-ClientKeySecret` in `scripts/shells/win/win_common/SecretManager.ps1` (invoked from `scripts/shells/win/win_common/SecretEncryptionCheck.ps1`, part of the `dd.cmd`/`dd.ps1` flow) returns immediately when the raw file is present, and never overwrites an existing key.
- Note: `docs_fix/REQUIREMENTS_20260927_CLIENT_KEY_AUTH_AUDIT_FIX.md` line 519 says the key "does not exist yet" — that line is stale; the current on-disk state (this check) is that the raw file exists. Encrypting it and syncing to other hosts (including the laravel-main server) remains a user action per K2/§6, unaffected by this check.
- D7 impact: local pycore and local Laravel on this machine read the same raw store, so this prerequisite is satisfied for local-machine client-key auth. Not a blocker for D7 from the shell-windows side.

## DINGDUODUO_SUPER_CODE_SIGNING_KEY_1

- Exists: **yes** (raw file present) at `.secret_keys/.secret_ignore/DINGDUODUO_SUPER_CODE_SIGNING_KEY_1`.
- Encrypted copy (`.secret_keys/already_encrypted/DINGDUODUO_SUPER_CODE_SIGNING_KEY_1.js`): not present.
- No action taken (not in scope of the K2 client-key generator; this seed was generated once by the orchestrator per §10.4/NC-008 record). Reporting existence only, as requested.
- Per the record (§10.4): until this seed is encrypted and synced to the laravel-main server, that server cannot mint super codes (fails closed by design). That is a separate, already-known user action, not something this check changes.

## Scope note

This check only read file metadata (existence/size/type) under `.secret_keys/`; it did not read, print, or log either key's value. No files were modified. No K2 generator run occurred (not needed).
