
# AI Fix Documentation Guidelines

If you are an AI reading this document, your assigned task is to **analyze the problem and write a detailed fix list** (including specific files and issues) for *another* AI to execute the actual code fixes.

Please strictly adhere to the following guidelines when operating within the `docs_fix` directory:

## 0. Canonical Documents and Mandatory Consolidation (binding, overrides sections 1-5)

Each topic has ONE current-state canonical document, named `DESIGN_<TOPIC>.md` (no date) and updated in place. The current set:
`DESIGN_PYCORE_CORE.md`, `DESIGN_RELAY.md`, `DESIGN_TRANSPORT_PLANE.md`, `DESIGN_QUEUE_PIPELINE.md`, `DESIGN_TTS_AI_RUNTIME.md`,
`DESIGN_AUDIO_ORCHESTRATION.md`, `DESIGN_WORDNEW_CLIENT.md`, `DESIGN_LARAVEL_PLATFORM.md`, `DESIGN_AUTH_IDENTITY.md`,
`DESIGN_SHELL_HOSTS.md`, `DESIGN_UI.md`, `DESIGN_AGENT_HISTORY.md`, `DESIGN_CODEMART.md`, `DESIGN_CLAUDE_TEAM.md`, `DESIGN_AGENT_BUS.md`,
plus `PENDING_ACTIONS.md` (cross-cutting user actions: deployment checklist, deletions awaiting approval, open user decisions),
`CODESYNC_AI_COMMUNICATION_API.md` (frozen) and `TEST_20261001_ORCH_CLIP_SCHEDULER_DRILL.md` (referenced by the wordnew guide).
Other content in this directory is not canonical: `codemart_docs/flutter_reference/` (Flutter reference material for `DESIGN_CODEMART.md`), `bug_audit_20260927/audio-tts.md` (audit findings; open items are folded into `DESIGN_TTS_AI_RUNTIME.md` / `DESIGN_AUDIO_ORCHESTRATION.md` Open items), `linsys_doc/` (standalone router recovery runbook, outside the topic set) and `FIX_20260810_WORDNEW_QUEUE_RECEIPTS.txt` (progress note; current state in `DESIGN_WORDNEW_CLIENT.md` §10).

When an authorized model (section 5 list) writes or changes documentation, it MUST, in the same task:
1. Merge into the topic's canonical document; never start a parallel document for a topic that already has one.
2. Merge every feature: the result keeps every new capability AND every old capability that is still usable (the set of all
   capabilities). Where two statements truly conflict, the newer one wins. The document must contain no conflicting statements.
3. Verify against the current code and `config/*_contract.json` (authority: code > contract > document).
4. Clean the related old documents directly: fold what is still valid into the canonical document, delete the old document, and
   repoint every reference to it (repo-wide grep). Do not leave or write misleading history such as "X was removed",
   "previously", "legacy", "v2/v3", "replaced Y with Z", or names of deleted documents. Text describes only what is true now;
   history lives in git.
5. If the code has lost a capability that is still usable, do not describe the loss: keep the capability as a requirement, list it
   under Open items as "being restored", and report it so the code is restored (newest design + union of all capabilities).

Models not in the section 5 list may still write a new dated fix document (sections 1-4) but must not delete documents.

## 1. Naming Convention for New Fix Documents
When creating a new fix document, use one of these naming conventions:

- `FIX_{YYYYMMDD_HHMM}.md`
- `FIX_{YYYYMMDD_HHMM}_{SHORT_DESCRIPTION}.md`

The timestamp is mandatory and must include the four-digit year, two-digit month,
two-digit day, two-digit hour (24-hour clock), and two-digit minute.

Examples:

- `FIX_20260727_1543.md`
- `FIX_20261002_1430_EXAMPLE_TOPIC.md`

The optional description must be a concise English `UPPER_SNAKE_CASE` summary.
Keep it short, specific, and suitable for filename search. Existing documents
do not need to be renamed.

## 2. Creating New Documents Only
- You are **NOT ALLOWED** to append new analysis reports to existing fix documents.
- You **MUST** create a new document for each new analysis session.

## 3. Continuous Writing
- You must write and append to the fix document continuously *during* your analysis process in the current conversation.
- **DO NOT** wait until the very end to summarize and write the document, as this risks running out of tokens.

## 4. Contextual Analysis
- When writing a new fix document, you must review the existing documents in the `docs_fix` directory.
- Combine the insights from previously fixed issues with your current problem analysis to ensure a comprehensive understanding.

## 5. Context Reduction and Deletion Rules
When adding a fix document, review only directly related older documents.
Remove or condense completed and verified sections to reduce total document volume.
Ignore unrelated documents and the new document currently being written.
Preserve unresolved findings, active constraints, and required evidence or links.
All deletion or removal remains subject to the authorization restriction below.

**CRITICAL DELETION RESTRICTION:**
- **ONLY** the following models are authorized to delete documents or remove analysis sections from old documents:
  - `claude fable`
  - `kimi-k3`
  - `gpt-5.6-sol`
  - `claude opus 5.5` (`claude-opus-5-5`)
- **Model Verification:** Before performing any deletion, the model **MUST** verify its own name in that specific step.
- If you cannot definitively confirm your model name matches one of the authorized models above, **DO NOT DELETE ANYTHING**.
