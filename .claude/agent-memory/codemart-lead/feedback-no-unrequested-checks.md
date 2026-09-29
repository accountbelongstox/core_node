---
name: feedback-no-unrequested-checks
description: Do not run tsc, route:list, API probes or builds on idle/resume unless a dispatched task or the user asks; combined checks belong to a task
metadata:
  type: feedback
---

Run combined checks (tsc, php artisan route:list, in-process API probes, builds) only inside a dispatched task whose verification asks for them, or when the user asks. Never run them on your own initiative while idle or after resuming.

**Why:** On 2026-09-28, after a usage-limit reset, I planned a "group merge" check run. ca-orchestrator stopped it and cited AGENTS.md: tests, builds and services run only on request. With about 28 team sessions on the host, free RAM is also often below 3 GB.

**How to apply:** On resume, read the reports and reviews, tell ca-orchestrator you are ready, tell idle members to hold, and wait. Carried items stay on hold until ca-orchestrator dispatches the user's next task. Related: [[verify-in-process-without-writes]].
