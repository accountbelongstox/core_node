# FIX 2026-10-01 — delivery batch 500, git-ignored sources, tailnet `/pycore-api`, Windows 175 stderr

## 1. `POST /api/app_qy_v1/delivery/batch` → 500

### Symptom

pycore log: `[laravel] POST https://api.si.12gm.com/api/app_qy_v1/delivery/batch -> 500 (30939ms) success=False`; every batched audio delivery retried forever (`audio_resource_delivery._deliver_resources` marks the whole batch `OUTCOME_RETRY` on failure).

### Root cause

An unfinished refactor moved the delivery literals into `config/queue_center_contract.json#delivery`, but the callers were not updated:

| Location | Stale call | Runtime error |
|---|---|---|
| `AppQyV1DeliveryCtl::registerBatch` | `parseMediaKey($key)` (signature is now `parseMediaKey($key, $kind)`) | `ArgumentCountError` on every manifest |
| `AppQyV1DeliveryBatchService::storeItem` | same | every stored item |
| `AppQyV1DeliveryBatchService::purgeExpired` | `self::RETENTION_SECONDS` (removed) | new batch registration |
| `AppQyV1DeliveryBatchService::view` | `self::STATE_DONE` (removed) | status polls |
| `AppQyV1DeliveryBatchService::store*` | `self::STATUS_*` (removed) | every item result |

The 30.9 s duration is not explained by these errors (they fail immediately); check `storage/logs/laravel.log` on the server (PHP `max_execution_time` 30 s is the likely match).

### Fix

- Service uses the contract accessors only: `itemStatus()`, `state('done')`, `retentionSeconds()`; `parseMediaKey($key, $state['kind'])`.
- Word keys without an md5 (`<lang>:text:<cleaned_word>`, contract `word_identity.fallback_when_md5_absent`, `applies_to: delivery_word_key`) were never routed: `storeWord()` now calls `storeCleanedWordAudioBytesDetailed()` (item `cleaned_word` = spelling) when the parsed hash is empty.
- Controller: `parseMediaKey($key, $kind)`; its duplicated `ERROR_*` literals replaced by `AppQyV1DeliveryBatchService::errorCode(...)`.
- `lang/{en,zh_CN}/delivery.php` `invalid_key` names the text-key form.

## 2. Source code in git-ignored paths

### Symptom

Server Vite: `Failed to resolve import "./ai/test/PcTestPopup" from "apps/pycore-manager/components/PcTestPopupContext.tsx"`.

### Root cause

Commit `6d6dc3ccb` moved UI code into `components/ai/test/`, matched by `.gitignore` `**/test/`; the files existed only on the Windows workstation. A repo-wide scan (`git ls-files -o -i --exclude-standard --directory`) found five more imported pycore modules in the same state.

### Fix (copy to tracked names; originals left in place, now unused; `.gitignore` unchanged)

| Ignored source | Tracked copy | Rule |
|---|---|---|
| `poly_apps/pycore_laravel_wordnew_ui/apps/pycore-manager/components/ai/test/*.tsx` | `components/ai/probe/*.tsx` | `**/test/` |
| `pycore/pyctl/ai_hub/test_history.py`, `test_record.py`, `test_service.py` | `probe_history.py`, `probe_record.py`, `probe_service.py` | `**/test_*.py` |
| `pycore/pyctl/stt/test_service.py` | `pycore/pyctl/stt/probe_service.py` | `**/test_*.py` |
| `pycore/pyutils/frontend_launcher/output_capturer.py` | `process_output_capturer.py` | `**/output_*` |

All importers updated (UI: `PcTestPopupContext`, `PcModelRow`, `PcProvidersView`; pycore: `hub_service`, `catalog_service`, `local_engine_service`, `stt/status_service`, `ai/image_service`, `local_ai_chat_routes`, `local_llm_status_routes`, `nuxt_launcher`). Not imported, left as is: `pyapps/d3-check/scripts/test_*.py`, `scripts/pytools/.../test_gen.py`, Android `src/test/`.

Rule: before creating a file, `git check-ignore -v --no-index <path>` must print nothing.

## 3. Tailnet `/pycore-api` → pycore 59000

- `config/service_contract.json#access.tailnet.pycore_path`: `/pycore` → `/pycore-api` (pairs with `/laravel-api`). Windows 175 (`FrankenPhpManager.ps1`), Linux 175 (`frankenphp_domain_common.sh`) and the UI (`pycoreTarget.ts` `PROXY_PATH`) read this one value; the route file is content-hash idempotent.
- Renamed rather than mounted twice: two pycore mounts in one site would declare the same named matchers twice.
- `/pycore/` is no longer proxied (falls through to the UI). Saved `/pycore` targets must switch.
- Windows logs the pycore mount line (Linux already did); locale texts, comments and `LARAVEL_GUIDE.md` updated.
- Verified on `desktop-1l9k06n`: `https://desktop-1l9k06n.thresher-python.ts.net/pycore-api/api/status` → 200, identical to `http://127.0.0.1:59000/api/status`.
- Pending: each Linux host re-runs `175_laravel_main_start.sh --domains-only`.

## 4. Windows 175 `-CertificatesOnly` aborts

| Function | Cause | Fix |
|---|---|---|
| `Invoke-FrankenPhpCertificateRenewal` | read `MainDomain` on Posh-ACME certificate objects (only orders carry it; certificates have `Subject`/`AllSANs`) → strict-mode `PropertyNotFoundStrict` | iterate `Get-PAOrder -List`, fetch `Get-PACertificate -MainDomain -Name` per order |
| `Ensure-FrankenPhpLanLocalCertificates` | `mkcert`/`tailscale` progress on stderr → `NativeCommandError` under a caller's `Stop` | function-scoped `$ErrorActionPreference = 'Continue'` |
| `Invoke-FrankenPhpReload` | `frankenphp reload` JSON logs on stderr, same error | function-scoped `Continue`, output via `Write-Host`, exit code checked |

Same PS 5.1 pattern fixed in `GitSyncCommon.ps1` (`git pull` progress printed as an error block): the pull runs under a local `Continue` and each line is stringified.
