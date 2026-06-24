# Handoff — mcp-chrome web-translate (Gemini / ChatGPT) bridge

> Standalone handoff doc for the next AI/engineer. Self-contained: it states the blocker,
> the goal, the exact files to touch, and the cross-stack contract to integrate with.
> Nothing here has been applied to the extension yet.

## 0. Goal (from the feature request)

mcp-chrome should mirror the pycore "translation assist": translate a (non-English) prompt to
English. **It must NOT call an AI API** — instead it should **drive the Gemini and ChatGPT WEB
pages** (type the prompt, submit, read the reply) via content-script automation. The ask is **two
operation libraries**, one per site.

## 1. BLOCKER — resolve first (build is currently broken)

Four files under `app/chrome-extension/` contain **unresolved git merge-conflict markers**
(`<<<<<<<` / `=======` / `>>>>>>>`); the extension will not build until they are resolved:

- `app/chrome-extension/entrypoints/background/services/bing-dictionary-worker-service.ts` (~L354-388)
- `app/chrome-extension/entrypoints/background/services/task-center/SimpleWorkerBase.ts` (~L37-65, `CHROME_FAST_CAPABILITIES`)
- `app/chrome-extension/entrypoints/background/services/task-center/init-processors.ts`
- `app/chrome-extension/entrypoints/popup/components/extensions/TaskDetailModal.vue`

Resolve these (reconcile both sides; do not blindly pick one) before adding anything below.

## 2. Task-center status — already mounted (the old note was stale)

The popup task-center IS wired: `entrypoints/popup/App.vue` has a "Tasks" tab →
`TaskCenterPanel.vue` → `UnifiedTaskCenter.vue` → `TaskDetailModal.vue`, backed by
`composables/useTaskCenter.ts` and `background/services/task-center/*` + `task-center-listener.ts`.
No mounting work is needed. (`advanced-control-panel/App.tsx` is a separate React mockup with fake
data — not the runtime popup.)

## 3. Add the two web-operation libraries

Model them on the existing **page-driving** tools (NOT the inline `chrome.scripting.executeScript`
style of `deepseek.ts`):

- Templates to copy: `app/chrome-extension/entrypoints/background/tools/browser/gemini-image.ts`
  and `.../notebooklm.ts`, with their paired injected helpers in
  `app/chrome-extension/entrypoints/inject-scripts/gemini-image-helper.js`.
- Create:
  - `tools/browser/gemini-web.ts` + `inject-scripts/gemini-web-helper.js` (gemini.google.com)
  - `tools/browser/chatgpt-web.ts` + `inject-scripts/chatgpt-web-helper.js` (chatgpt.com)
- Each helper is an IIFE with a load-guard, a `*_ping`→`pong` handshake, and a `submitPrompt`
  action: deep-query (shadow-DOM-piercing) the prompt textarea, set value + dispatch input, click
  send, then poll for the streamed answer to settle and return its text.

## 4. Rewire the worker

`app/chrome-extension/entrypoints/background/services/web-ai-translate-worker-service.ts` currently
drives **DeepSeek** (`tools/browser/deepseek.ts`). Replace/extend the send-prompt call (around L20/L95)
with the new Gemini/ChatGPT web tool (add provider selection). Keep its existing
`buildPrompt`/`parsePairs`/fail-soft contract. Optionally register a dedicated processor in
`task-center/init-processors.ts` (mirror `WebAiTranslateProcessor.ts`) and init it in
`background/index.ts`.

## 5. Cross-stack contract to integrate with (already implemented Laravel/pycore side)

The Laravel/pycore pipeline this should plug into is the `prompt_translation` global task
(see `development-guides/cross-docs/AI_PROMPT_ASSIST_TRANSLATION_PIPELINE.md`):

- Pull a `prompt_translation` task (execution_type `remote_translation`, `capability=null`).
- Payload: `{ prompt_id, text, source_lang, want_audio, variants }`.
- POST result to `/api/worker/tasks/result`:
  `{ task_id, worker_id, status:'completed', result:{ prompt_id, detected_language, english,
  cleaned, variants:[3] } }`. (`english` is required by `validateResultShape`.)
  Audio is optional for the chrome worker (pycore handles TTS).

## 6. Risks

- Gemini/ChatGPT DOMs are unstable/obfuscated and require an authenticated, logged-in browser
  tab; selectors must be resilient (role/aria + text fallbacks) and time-bounded.
- Respect the task-center claim/lease model so a slow web turn is not reclaimed mid-flight.
