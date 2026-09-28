---
name: feedback-requirement-clauses
description: Reviewer treats every clause of a requirement/verify text as binding, not just the observed failure mode — implement the literal clause even when the current fixture never exercises it
metadata:
  type: feedback
---

When a task item names a specific mechanism in its `requirement` text (e.g. "include the contract rejection_code X", "reuse Y as one shared helper"), implement that literal mechanism, not just a fix that happens to resolve the probe scenario through a different path.

**Why:** In pycore-ai-D7P2-fix round 1 (2026-09-27), B2's requirement said to make an md5-less word's 4xx rejection terminal AND "include the contract rejection_code WORD_NOT_FOUND". The round-1 fix made the 4xx-status path terminal (which happened to cover the only reproducible probe case at the time) but never read an `error_code`/rejection-code field at all — `WORD_NOT_FOUND_REJECTION_CODE` was defined but only used as an outgoing skip label, never as an incoming check. The reviewer's first pass approved this as non-blocking ("errorWithCode maps it to 404 anyway"), then reversed to `changes_requested` on re-review because the contract and the referenced item (LDRI-11) do not pin the rejection code to any particular HTTP status — a future response could carry `error_code`/`data.status` = the rejection code with a non-4xx or missing status, and the literal clause was unimplemented.

**How to apply:**
- When a requirement lists a contract field, error code, or specific identifier by name, add an explicit check for that identifier — don't rely on it being implied by a status-code or string-prefix heuristic that merely correlates with it today.
- Treat "the contract does not pin X to Y" (e.g. a rejection code not pinned to an HTTP status) as a reason the literal-field check is still required, not a reason the status-based heuristic is sufficient.
- An approved review round is not final if it is later superseded — check the review JSON's `verdict`/`decisions` for a note that an earlier draft was overridden before treating "was approved once" as settled.
- Related: [[project-pycore-pitfalls]].
