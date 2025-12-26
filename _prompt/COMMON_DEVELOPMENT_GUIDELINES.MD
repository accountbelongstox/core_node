# Common Development Guidelines

> **Last Updated**: 2025-01-XX
> **Purpose**: General development standards and best practices for all projects

---

## Core Principles

### 1. Error Detection and Output

- **Do NOT use exit code detection**
- **Do NOT use return values**
- **Rely on direct output and result detection**
- For installation detection, check binaries directly
- For success detection, rely on the output from the execution

### 2. Path Management

- **Use relative paths based on file location**
- **Do NOT hardcode paths**
- All paths should be dynamically resolved relative to the script location

### 3. Variable Exchange System

- **Use plain text files for variable exchange**
- **Do NOT use JSON as variable exchange system**
- **Do NOT embed Python code snippets in PowerShell scripts**

### 4. Code Reusability

- **Always analyze existing code before adding new code**
- **Only add necessary differential code**
- **Check for reusable content before writing new code**
- **Enhance existing code rather than creating new versions**
- **Reject multiple versions or multiple definitions of the same functionality**

### 5. Code Quality

- **Scan for global/local variable confusion**
- **Scan for code reuse and duplicate definitions**
- **Use the optimal reuse solution based on architecture**
- **Reject multiple versions or multiple definitions of the same functionality**

### 6. Real-time Output

- **Output all information in real-time**
- **Do NOT use exit code detection**
- **Do NOT use return values**
- **Rely on direct output and result detection**

### 7. Idempotency

- **Scripts must be idempotent**
- **Repeated runs should fix all issues**
- **Even if installation succeeds, still fix each step**
- **Repeated runs should fix each step individually**
- **Do NOT skip steps because one step completed successfully**
- **Do NOT skip other steps because one step succeeded**

### 8. Code Language

- **All code must be in English**
- **No Chinese comments or variable names**

---

## Frontend Development Guidelines

### State Management

- Create unified state center
- Multi-API test center (see `development-guides/MULTI_API_URL_SYSTEM.md`)
- Centralize multi-language support
- Centralize storage management
- Centralize model data management
- Bind login state and data, settings center data to storage center
- Immediately refresh page when settings center modifies state (e.g., language, dark/light mode)

### Code Organization

- **Import all packages at file header**
- **Centralize storage management**
- **Centralize model data management**
- **Reuse code, multi-file design**
- **Reuse components**
- **Prohibit code accumulation**
- **Before completing a feature, scan for existing functionality that can be extended or reused**

### AI Studio

- Check for incomplete pages and continue completion
- Extend existing pages rather than deleting them
- Use and display mock data

---

## Script Development Guidelines

### Restrictions

- **Do NOT write patch scripts**
- **Do NOT operate local services**
- **Only view source code**
- **Scripts must be idempotent**
- **Repeated runs should fix all issues**
- **Even if installation succeeds, still fix each step**
- **Repeated runs should fix each step individually**
- **Do NOT skip steps because one step completed successfully**
- **Do NOT skip other steps because one step succeeded**
- **All code must be in English**

---

## Summary

These guidelines ensure:
- **Consistency**: All code follows the same standards
- **Maintainability**: Code is reusable and well-organized
- **Reliability**: Scripts are idempotent and handle errors properly
- **Clarity**: All code and comments are in English

