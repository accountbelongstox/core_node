---
name: feedback-battlenet-no-restart-during-login
description: d3d4tester must never close/restart Battle.net while the user is logging in, on the security check, e-mail wait or code page; UI-derived region must come only from main-UI ids
metadata:
  type: feedback
---
Never close or restart Battle.net while the client is logging in or waiting for the user (security check, e-mail / verification code). All kills go through `BattlenetManager.Close`, which re-probes and refuses unless forced by an explicit user click.

**Why:** 2026-10-03 the guard restarted Battle.net in a loop while the user was entering the e-mailed code; the user was furious ("说了不要重启"). Root cause: the login popup (`LoginPopupWindow`, also used for the global security check) was treated as a CN region signal, so "ensure region first" restarted the client every 120 s.

**How to apply:** any new restart/timeout rule must check `BattlenetClientStatus.IsWaitingForUser` (or rely on `Close`); only main-UI tab ids (`game-nav-btn-D3CN`/`D4CN`, `ntes`) may decide the UI region — never login forms or popups. Validate new Battle.net signals with `scripts/bnprobe.ps1` live scans + `--replay` before shipping. Related: [[project-gitsync-autocommit]].
