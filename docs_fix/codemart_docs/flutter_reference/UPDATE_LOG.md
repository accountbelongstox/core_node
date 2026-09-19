# CodeMart Flutter Reference: Data Center Change Log (Functional)

Functional-only revision: 2026-09-19. Only user-visible behavior changes
are recorded here; no code or architecture.

## 2025-11-07 — Initial unified data center

- Introduced a single data center holding login state, user profile, and
  the active user mode (developer or client) for the whole app.
- Added debug mode with mock accounts and simulated delays so the app can
  be exercised without a backend; the login screen gained quick-login
  entries in debug mode.
- Login and logout now update every page consistently.

## 2025-11-07 — Second update: login flow and state handling

- Login feedback improved: after a successful login the app clearly
  reflects the signed-in user, the loaded profile, and the active mode.
- Mode-aware behavior: pages react immediately when the user switches
  between developer and client mode.
- Profile synchronization: profile edits are visible across the app
  without restarting.
- Debug-mode login made more predictable, with clear success and failure
  outcomes for testers.
