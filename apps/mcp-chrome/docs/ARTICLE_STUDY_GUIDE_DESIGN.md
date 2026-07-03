# Article Study Guide — Multi-Provider Prompt & Automation Design

Popup path: **Extensions tab → Article Study Guide**
(`entrypoints/popup/components/extensions/ArticleStudyGuide.vue`)

## 1. Purpose

Paste an article, pick a provider (Gemini / ChatGPT / Grok / Copilot), pick
target languages + per-language options, click **Test**. The panel drives a
live tab for the chosen provider with a built-in, XML-like prompt and
displays the structured reply: sentence-by-sentence translation alignment
plus (per language, opt-in) phonetics/liaison marks, a sentence-structure
label, alternate phrasings, a short-phrase list, a word list, and grammar
points.

This is one of two "per-feature built-in-prompt tests" hardcoded in the
extension (the other is the NotebookLM words/sentences → dialogue test in
`NotebookLMPanel.vue`). Both are code-level presets today; the longer-term
plan (see Task Center pipeline notes) is a DB-backed preset library where some
prompts stay hardcoded (like these) and others become editable rows.

## 2. Same logic, different UI automation — the shared job base

All four providers use **the exact same job/poll logic**; only the DOM
selectors (input box, send, response container) differ per site. That shared
logic lives in one place: `entrypoints/background/tools/browser/web-chat-job-base.ts`
(`WebChatJobToolBase`). Each provider tool is a thin subclass that supplies a
`jobConfig` (host/URL, content-script files, action names, storage key) —
see `gemini-web.ts`, `chatgpt-web.ts`, `grok-web.ts`, `copilot-web.ts`.

```ts
interface WebChatJobConfig {
  providerLabel: string;   // log label, e.g. 'Gemini Web'
  providerHost: string;    // e.g. 'gemini.google.com'
  providerUrl: string;     // e.g. 'https://gemini.google.com/app'
  helperFiles: string[];   // content-script files to inject, in order
  submitAction: string;    // e.g. 'geminiSubmitPrompt'
  peekAction: string;      // e.g. 'geminiPeekReply'
  jobsStorageKey: string;  // chrome.storage.session key for this provider's jobs
}
```

`WebChatJobToolBase` provides `start()`, `status()`, and a default `execute()`
(built from `start`+`status`, satisfying `BaseBrowserToolExecutor`'s abstract
method) — Gemini and ChatGPT override `execute()` with their own richer,
audio-capable version used elsewhere (`ai_web_worker_service`/`test`); Grok
and Copilot don't need that and simply inherit the default.

Background message bridge is likewise factored into one place:
`entrypoints/background/web-chat-job-listener-factory.ts`
(`createWebChatJobListener(messageType, tool, label)`). Each provider's
listener file (`gemini-text-listener.ts`, `chatgpt-text-listener.ts`,
`grok-text-listener.ts`, `copilot-text-listener.ts`) is just that factory
bound to its own message type — all registered in `background/index.ts`.

| provider | message type            | content-script helper           |
|----------|--------------------------|----------------------------------|
| Gemini   | `gemini_text_service`    | `gemini-web-helper.js`          |
| ChatGPT  | `chatgpt_text_service`   | `chatgpt-web-helper.js`         |
| Grok     | `grok_text_service`      | `grok-web-helper.js`            |
| Copilot  | `copilot_text_service`   | `copilot-web-helper.js`         |

Message contract (identical for every provider):

| action  | request                    | response (`result`)                                                        |
|---------|-----------------------------|------------------------------------------------------------------------------|
| `start` | `{ prompt, timeoutMs? }`    | `{ ok, jobId, tabId, status:'generating' }` or `{ ok:false, error }`         |
| `status`| `{ jobId }`                 | `{ ok, status:'generating'\|'done'\|'failed'\|'unknown', answer?, error? }`  |

## 3. Why a job/poll architecture

A Chrome browser-action **popup is destroyed whenever it loses focus**
(clicking into the provider's tab, for example). A single blocking
`chrome.runtime.sendMessage` that awaits the *entire* automation loses its
response the moment the popup closes mid-wait. So, exactly like
`gemini-image.ts`'s image generation flow, the flow is split into two phases:
`start` submits and returns a `jobId` in a few seconds; `status` re-collects
from the still-open tab and can be polled again anytime, including after the
popup reopens or the MV3 service worker restarts (the job index is persisted
to `chrome.storage.session`, one key per provider).

**Stability detection is tracked ACROSS polls, not within one poll.** A long
structured reply can keep streaming for tens of seconds. Each `status` call
does one instant, non-blocking peek (`<provider>PeekReply` in the content
script — no internal wait loop) of the current response text, and the job
stores `lastSnapshot`/`stableRounds`: unchanged text vs. the previous poll
increments `stableRounds`; a change resets it. Reaching `STABLE_ROUNDS_REQUIRED`
(2) consecutive unchanged polls marks the job `done`. (An earlier version
tried to detect 3 consecutive stable reads *within a single 4-second call* —
that restarts its stability search from scratch on every poll, so a reply
still growing at the moment any given poll starts could never accumulate 3
stable reads in that one narrow window, and the job sat at `generating`
indefinitely.) `status()` also re-injects the content script defensively on
every poll (cheap no-op if already active) so a service-worker restart or tab
reload mid-poll doesn't strand the job.

**A poll that finds fresh content is never failed by the deadline check.**
`job.deadline` is computed once, at `start()` time, from `timeoutMs`. If the
popup stays closed for longer than that (Chrome destroys it on blur; the user
may not reopen it for a while), the first re-poll after reopening can land
well past `deadline` even though the reply finished ages ago and is sitting
there, fully stable, in the tab. `status()` only fails on `Date.now() >
job.deadline` when that SAME poll also found nothing (`!hasBlock || !text`) —
a poll that read real content always gets to feed the stability counter
first, so a late reconnect can still confirm and return the answer instead of
being told it "timed out" for a reply that had, in fact, long since finished.

The popup composable (`useArticleStudyGuide.ts`) persists the in-flight job as
one atomic `{jobId, provider}` value via `usePersistedRef` (two separate
persisted refs could restore out of order on mount, racing which provider a
resumed poll uses). On mount, if a job is restored, a watcher resumes polling
automatically — so closing and reopening the popup does not lose the result,
even though the popup window itself cannot be prevented from closing on blur.
For a window that never blurs, use the header's "open in a tab" button (works
for every panel, not just this one).

`languages` / `sourceLanguageSkipExpressions` are **intentionally NOT
persisted** (plain `ref`, not `usePersistedRef`): an earlier version did
persist them, and a toggle left on from a prior test session silently
overrode the current code defaults on every subsequent popup open, which read
as "the default is wrong" even though the code was correct. This panel always
starts from the current `DEFAULT_GEMINI_TRANSLATE_LANGUAGES` on each open.

## 4. Per-provider selectors (verified live via MCP browser inspection)

### Gemini (`gemini.google.com`)
Input: `rich-textarea .ql-editor[contenteditable="true"]` (deep-shadow query).
Response blocks: `message-content` / `.model-response-text` / `model-response`.

### ChatGPT (`chatgpt.com`)
Input: `#prompt-textarea[contenteditable="true"]`. Assistant turns:
`[data-message-author-role="assistant"]`.

### Grok (`grok.com`)
Input: `div[contenteditable="true"][role="textbox"][aria-label="Ask Grok anything"]`
inside `div[data-testid="chat-input"]`. User message: `[data-testid="user-message"]`.
Assistant message: `[data-testid="assistant-message"]`. No Send button is
present while the input is empty — Enter is the reliable submit path
(`grok-web-helper.js` tries a best-effort button search first, then falls
back to Enter).

### Copilot (`copilot.microsoft.com`)
Input: `#userInput` (textarea). Assistant message: `[data-testid="ai-message"]`.
Same no-visible-Send-button situation as Grok — Enter fallback.

**Canvas ("Open page") handling** — Copilot sometimes renders a long
structured reply as a separate "page" instead of inline chat text, exposed as
a button inside the assistant message whose text contains "Open page" (its
full text is the page title concatenated with "Open page", e.g.
`"Article Study GuideOpen page"`). Clicking it (human-simulated, via the
shared `web-ops.js` `humanClick` — real click events, not just `.click()`)
navigates to a canvas view with:
- Title: `h1[aria-label^="Page title:"]`
- Content: `div[aria-label="Page content"][contenteditable="true"]`

`copilot-web-helper.js`'s `peekReply` first checks turn freshness the same
way every other provider does (`assistantTurns().length > before`) — the
provider tab is reused across jobs, so a canvas page left open by an
*earlier* job must not be read as the current job's answer. Only once a new
turn exists for this job does it check for an already-open canvas page (the
original chat DOM is gone once navigated in); if none exists yet, it looks
for the "Open page" trigger inside the latest assistant message, human-clicks
it if found, and reports not-yet-ready for that round so the *next* poll
picks up the newly-mounted page content. This logic is entirely a
content-script concern — `CopilotWebTool` itself needs no special-casing
beyond its `jobConfig`, matching "same logic, only the UI operation differs."

**Closing the canvas after extraction** — `CopilotWebTool`'s `jobConfig` sets
`cleanupAction: 'copilotClosePage'` (the only provider that does; the field is
optional on `WebChatJobConfig`). Once `web-chat-job-base.ts`'s `status()`
confirms a job `done`, it fires this action at the tab fire-and-forget (never
lets a cleanup failure affect the already-collected answer). `copilotClosePage`
best-effort-clicks whatever close/back/dismiss control it finds scoped to the
canvas page container; if none is found, it no-ops and leaves the page open
rather than guess with `history.back()` and risk navigating out of Copilot
entirely. Its selector is an educated guess, not live-verified like the ones
above — closing keeps the (reused) tab clean between jobs and removes any
chance of a second, stale page node ever coexisting with a new one.

## 5. Per-language options data model

`entrypoints/popup/composables/promptPresets.ts`:

```ts
interface GeminiTranslateLangOption {
  code: string;            // 'en' | 'zh' | 'ja' | 'ko' | 'fr' | 'de' | 'es' | 'ru'
  label: string;           // display name
  phonetics: boolean;      // append connected-reading / IPA marks per sentence
  sentencePattern: boolean;// append a short grammatical sentence-structure label per sentence
  shortPhrases: boolean;   // emit an exhaustive "SHORT PHRASES ({CODE})" section
  words: boolean;          // emit an exhaustive "WORDS ({CODE})" section
  grammarPoints: boolean;  // emit an exhaustive "GRAMMAR POINTS ({CODE})" section
  expressions: boolean;    // append EXPR2..EXPRk alternate phrasings per sentence
  expressionsCount: number;// total phrasings incl. the sentence itself (>=2 when expressions=true)
}
```

Default config (`DEFAULT_GEMINI_TRANSLATE_LANGUAGES`):

| lang | phonetics | sentencePattern | shortPhrases | words | grammarPoints | expressions | expressionsCount |
|------|-----------|------------------|--------------|-------|----------------|-------------|-------------------|
| EN   | ✓         | ✓                | ✓            | –     | ✓              | ✓           | 3                 |
| ZH   | –         | –                | –            | –     | –              | –           | –                 |

Global flag `sourceLanguageSkipExpressions` (default `true`): alternate
phrasings only make sense for a *translated* language, not the article's own
original language, so when set, the AI is instructed to skip `EXPRk` output
for whichever selected language matches the article's detected source
language, even if that language has `expressions=true`.

## 6. Abstract prompt template (placeholders)

The runtime builder (`buildGeminiArticleTranslatePrompt`) fills this shape.
`{{...}}` marks a substitution point; the `<language>` line repeats once per
configured language. Note this is **XML-LIKE, not strict/valid XML** —
attributes are unquoted, there is no CDATA wrapping and no entity-escaping.
The consumer is an LLM, not an XML parser, so strict escaping only adds
visual noise; the tags + an explicit `<instructions>` block still keep the
reply far more consistently formatted across runs than plain prose.

```
<task type=article_study_guide>
<config>
<languages>
<language code={{CODE}} phonetics={{BOOL}} sentencePattern={{BOOL}}
          shortPhrases={{BOOL}} words={{BOOL}} grammarPoints={{BOOL}}
          expressions={{BOOL}} expressionsCount={{INT}} />
{{...one <language> line per selected language...}}
</languages>
<sourceLanguageSkipExpressions>{{BOOL}}</sourceLanguageSkipExpressions>
</config>
<instructions>
{{fixed instruction text — see source; explains the per-sentence-number
  interleaved grouping, the PATTERN/PHONETICS/EXPRk suffix rules (required
  every sentence when enabled, not just "sometimes"), and the exhaustive
  SHORT PHRASES / WORDS / GRAMMAR POINTS section rules}}
</instructions>
<article>
{{ARTICLE_TEXT}}
</article>
</task>
```

## 7. Required reply format

Sentences are grouped **by sentence number first, then by language** — every
selected language's line for sentence 1 appears together, then sentence 2,
and so on. This is NOT one block per language; language blocks are only used
for the extra sections at the end.

```
EN(1) <sentence> | PATTERN: <label> | PHONETICS: <marks> | EXPR2: <alt> | EXPR3: <alt>
ZH(1) <sentence>
EN(2) <sentence> | PATTERN: <label> | PHONETICS: <marks> | EXPR2: <alt> | EXPR3: <alt>
ZH(2) <sentence>
...

SHORT PHRASES (EN)
- <phrase> — <meaning>
[... every notable phrase across every EN sentence, not a sample ...]

GRAMMAR POINTS (EN)
- <point>
[... every distinct grammar point across every EN sentence, not a top-5 summary ...]
```

Rules:
- `<CODE>(n)` numbering is identical across every language, so `EN(n)` and
  `ZH(n)` always refer to the same original sentence — sentence n's lines
  (one per configured language, in `<config><languages>` order) are emitted
  back to back before sentence n+1 starts.
- `| PATTERN: ...` is **required for every sentence** (not skippable) when
  that language's `sentencePattern=true` — a short label for the sentence's
  grammatical structure (e.g. "not only...but also", "S+V+O",
  "if-conditional").
- `| PHONETICS: ...` is **required for every sentence** when that language's
  `phonetics=true`.
- `| EXPRk: ...` (k = 2..`expressionsCount`) appears only when
  `expressions=true` for that language, and — when
  `sourceLanguageSkipExpressions=true` — only for languages that are not the
  article's detected source language. `EXPR1` is the sentence itself and is
  never repeated as a suffix.
- `SHORT PHRASES` / `WORDS` / `GRAMMAR POINTS` are **exhaustive**, not a
  curated top-N sample — every phrase/word/grammar point found across every
  sentence of that language, covering the whole article. Each appears once
  per language that requested it, after ALL sentence-number groups, in the
  same language order as `<config><languages>`.
- No commentary outside these sections.

## 8. Related preset

`buildNotebookLmDialoguePrompt` (same file) — a fixed prompt asking NotebookLM
to weave a given list of words/sentences into a short two-speaker dialogue,
wired into the existing free-form "Ask" box in `NotebookLMPanel.vue` as a
separate "Dialogue test" section.
