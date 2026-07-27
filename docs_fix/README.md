# AI Fix Documentation Guidelines

If you are an AI reading this document, your assigned task is to **analyze the problem and write a detailed fix list** (including specific files and issues) for *another* AI to execute the actual code fixes.

Please strictly adhere to the following guidelines when operating within the `docs_fix` directory:

## 1. Naming Convention for New Fix Documents
When creating a new fix document, you MUST use the following naming convention:
`FIX_{time}.md` (e.g., `FIX_20260727_1543.md`).

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
To reduce context window usage, old fix documents where the code has been successfully repaired and verified should be simplified or deleted.

**CRITICAL DELETION RESTRICTION:**
- **ONLY** the following models are authorized to delete documents or remove analysis sections from old documents:
  - `claude fable`
  - `kimi-k3`
  - `gpt-5.6-sol`
- **Model Verification:** Before performing any deletion, the model **MUST** verify its own name in that specific step.
- If you cannot definitively confirm your model name matches one of the authorized models above, **DO NOT DELETE ANYTHING**.
