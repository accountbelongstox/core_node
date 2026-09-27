---
name: dual-boot-parity-ledger-can-lag-code
description: The dual-boot drive-layout parity row (SPW-035) can describe an older directive (D27) after the code has already moved to a newer one (D28/D30) — verify against current contract/code, don't trust the row text
metadata:
  type: project
---

The dual-boot 3-drive-layout requirement (`docs_fix/REQUIREMENTS_20260927_DUAL_BOOT_DRIVE_LAYOUT.md` §1) gets amended same-day, repeatedly (D24 -> D26 -> D27 -> D28 -> D30 all landed 2026-09-27). Each amendment can reshape `config/service_contract.json#paths.drive_layout` (keys added, removed, or turned into per-OS objects) and the fenced `.ps1` files, but the parity ledger row (`.claude/agents_shared/shell_parity/windows.md`, SPW-035) is not guaranteed to be rewritten in the same pass — it can still describe the previous directive (e.g. still say "no trees root, D27-only" with a note that D28 "needs its own fenced task") even after a later task already implemented that next directive in the actual `.ps1` files.

**Why:** found this directly: SPW-035 described D27 (`CN_TREE_ROOT` removed, no junctions) and flagged D28 (junctions via `CN_TREES_ROOT`) as future work, but `SharedCacheEnv.ps1` and `ProjectTreeCommon.ps1` already fully implemented D28/D30 (`CN_TREES_ROOT`, the junction state machine) in an already-committed same-day commit. Trusting the ledger text alone would have led to redoing already-correct work or misreporting status to the orchestrator.

**How to apply:** on any dual-boot-layout task, read the current `config/service_contract.json#paths.drive_layout` and the actual `.ps1` code first; treat the ledger row as a claim to verify, not ground truth. If `git diff`/`git log` on the fenced files shows a clean tree at a recent same-day commit, the "make the files coherent" instruction may already be satisfied — check for a stale ledger row (obsolete "not implemented yet" notes, outdated global list, wrong template description) before assuming code work remains. See [[shared-cache-env-load-side-effects]].
