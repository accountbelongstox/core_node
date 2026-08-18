# AI Fix Documentation Guidelines

If you are an AI reading this document, your assigned task is to **analyze the problem and write a detailed fix list** (including specific files and issues) for *another* AI to execute the actual code fixes.

Please strictly adhere to the following guidelines when operating within the `docs_fix` directory:

## 1. Naming Convention for New Fix Documents
When creating a new fix document, use one of these naming conventions:

- `FIX_{YYYYMMDD_HHMM}.md`
- `FIX_{YYYYMMDD_HHMM}_{SHORT_DESCRIPTION}.md`

The timestamp is mandatory and must include the four-digit year, two-digit month,
two-digit day, two-digit hour (24-hour clock), and two-digit minute.

Examples:

- `FIX_20260727_1543.md`
- `FIX_20260814_2155_PYCORE_TERMINAL_CONTROL.md`

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
- **Model Verification:** Before performing any deletion, the model **MUST** verify its own name in that specific step.
- If you cannot definitively confirm your model name matches one of the authorized models above, **DO NOT DELETE ANYTHING**.
