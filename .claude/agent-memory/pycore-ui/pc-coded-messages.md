---
name: pc-coded-messages
description: How pycore-manager localizes pycore codes (errorCodes, ttsReasons, audioOrchestration.messages) and why the locale composition matters
metadata:
  type: project
---

pycore-manager localizes pycore codes through one helper set in `apps/pycore-manager/utils/pcErrorCodes.ts`: `pcCodeText(prefix, code, params)`, `pcErrorCodeText`, `pcFailureMessage` (reads `error_code`, then a code-valued `error`), `pcCaughtErrorMessage` with `PcLocalizedError`, and `pcTtsReasonText`. Orchestration log and progress lines go through `orchCodedMessage` in `pages/audio-orchestration/orchShared.ts`.

**Why:** the pc locale is a shallow spread of Core, Features and Pages (`pc-locales/en.ts`). A second `errorCodes` object in Features would overwrite the Core one. Route and error codes therefore stay in `PcEnCore`/`PcZhCore` `errorCodes`. Features carries `ttsReasons` and `audioOrchestration.messages`/`messageValues`.

**How to apply:** add the key for a new pycore code in both en and zh (`pcZh` is typed against `pcEn`, so tsc catches a missing zh key). To check coverage, dump the composed locale with bun (`bun run` a scratch file that imports `pc-locales/en.ts`/`zh.ts`), then diff it against the codes grepped from pycore. Never render `error.message` or `payload.error` directly.
