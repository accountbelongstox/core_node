# vortex report — client key auth and audit fixes (2026-09-27)

## Task ids
| Task | Theme | Findings | Status |
|---|---|---|---|
| vortex-1 | Simulated account money math | FU-033 | fixed, approved (reviews/vortex-1.json) |
| vortex-2 | Chart request race | FU-038 | fixed, approved (reviews/vortex-2.json) |
| vortex-3 | i18n: locale keys instead of inline dictionaries | FU-042 (vortex part) | fixed, approved (reviews/vortex-3.json) |
| vortex-4 | OKX credential exposure (UI side) | frontend-ui cross-scope `okx/reveal_credentials` (PR-001 surface) | fixed, approved (reviews/vortex-4.json) |
| vortex-5 | K7/K6 rejection notice instead of "unreachable" | lead item B9 | fixed (shared route), approved incl. the kind-to-code map revision (reviews/vortex-5.json) |

## Findings
- FU-033 fixed: positions store margin; close credits `(margin + qty × (exit − entry)) × (1 − fee)`; net worth = cash + Σ isolated equity; ROI uses margin; the ledger shows margin per position.
- FU-038 fixed: request sequence ref in `openChart`; `closeChart` invalidates in-flight responses.
- FU-042 fixed: the inline dictionaries of VortexApp, OkxQuantPanel, OkxAccountPanel and OkxBacktestPanel, the English-only toasts and the other literal UI text moved to `apps/vortex/vx-locales/{en,zh}.ts` under the `vx` namespace. Trade times are stored as epoch ms and formatted with the UI language (was hardcoded `'zh-CN'`). The inline Japanese (ja) dictionary was removed (team-lead decision): the shared UiI18n serves en/zh only, so ja falls back to en like every other end.
- reveal_credentials (UI side) fixed: no full-key reveal; the KEY card shows only `api_key_masked`; `revealCredentials` removed from `VortexPycoreContract.ts`. pycore removes or gates the route; no pycore handler for any `okx/*` route was found in this repo.
- Laravel route table: laravel found no vortex caller of a gated Laravel route; Vortex calls only pycore.
- vortex-5 (B9): shared `classifyPycoreAccess(error?)` in `core/integrations/pycore/pycoreAccess.ts`, built on the contract codes (`CLIENT_KEY_ERROR_CODES` list and `LOCAL_RPC_ERROR_CODES` kind-to-code map from `core/contracts/ServiceContract.ts`; local RPC kinds are the contract map's keys) and the shared page helpers. Kinds: host_forbidden, origin_forbidden, client_key_rejected (with code), relay_only, origin_not_allowed (with ports), unreachable. `VortexPycoreNotice` replaces the three panels' "unreachable" banners; it names the rejection, points to the HTTPS relay entry, and shows relay_only / origin_not_allowed before any request while pycore is not connected. Real network failures keep each panel's own unreachable text. pycore-manager was told to switch PcRpcAccessBanner to the classifier (pycore-manager-8).

## Changed files
- `poly_apps/pycore_laravel_wordnew_ui/apps/vortex/VortexApp.tsx`
- `poly_apps/pycore_laravel_wordnew_ui/apps/vortex/OkxBacktestPanel.tsx`
- `poly_apps/pycore_laravel_wordnew_ui/apps/vortex/OkxQuantPanel.tsx`
- `poly_apps/pycore_laravel_wordnew_ui/apps/vortex/OkxAccountPanel.tsx`
- `poly_apps/pycore_laravel_wordnew_ui/apps/vortex/api/VortexPycoreContract.ts`
- `poly_apps/pycore_laravel_wordnew_ui/apps/vortex/vx-locales/en.ts` (new)
- `poly_apps/pycore_laravel_wordnew_ui/apps/vortex/vx-locales/zh.ts` (new)
- `poly_apps/pycore_laravel_wordnew_ui/apps/vortex/vx-locales/index.ts` (new)
- `poly_apps/pycore_laravel_wordnew_ui/shell/shell-i18n.ts` (one line: `'vx'` in `EndNamespace`; temporary writer assigned by team-lead, requirements §6)
- `poly_apps/pycore_laravel_wordnew_ui/apps/vortex/VortexPycoreNotice.tsx` (new, vortex-5)
- `poly_apps/pycore_laravel_wordnew_ui/apps/vortex/api/index.ts` (vortex-5)
- `poly_apps/pycore_laravel_wordnew_ui/core/integrations/pycore/pycoreAccess.ts` (new, vortex-5; temporary writer, requirements §6)
- `poly_apps/pycore_laravel_wordnew_ui/core/integrations/pycore/index.ts` (one export line, vortex-5; temporary writer)
- `poly_apps/pycore_laravel_wordnew_ui/core/contracts/ServiceContract.ts` (two exports, vortex-5; temporary writer)

## Static checks
- `tsc --noEmit -p tsconfig.json` (no emit): exits 0 for the whole project after vortex-5.
- Scratchpad key check: en/zh key parity, matching `{{}}` placeholders, every `t('…')` key used by the vortex files exists.

## Blockers
- None.

## Next owner
- vortex-1..vortex-5 are all approved; nothing is queued for vortex.
- pycore: `pycore/pyutils/common/local_rpc_guard.py:30-31` still hardcodes the two local RPC codes instead of reading `client_key_auth.local_rpc.error_codes` (reviewer note).
- pycore-manager: pycore-manager-8, switch PcRpcAccessBanner to `classifyPycoreAccess`.
- pycore: confirm where `okx/reveal_credentials` is served and that it is removed or gated (the reviewer also found no `okx/*` server under pycore/ or pyapps/). The UI no longer calls it.
