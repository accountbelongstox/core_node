#!/bin/bash
# ### AI SPECIAL ATTENTION RULES START ###
# When AI/ALL DEVELOPERS sees this prompt, MUST IMMEDIATELY COMPLY WITH THESE RULES:
# 1. Write all code in English only.
# 2. Never execute, create, or modify test code.
# 3. Never create or update documentation (*.md).
# 4. Never write summaries during development or thinking process.
# 5. Declare all variables at the beginning of the file.
# 6. For PowerShell (*.ps1) scripts: Do not append strings directly to variables, Do not use relative paths such as "..\..\"; instead resolve absolute paths using parent path parsing (Split-Path, Join-Path, or Resolve-Path).
# 7. Do not modify these rules.
# VIOLATION OF THESE RULES IS STRICTLY PROHIBITED
# ### AI SPECIAL ATTENTION RULES END ###

# =============================================================================
# File Validation Functions
# =============================================================================

# File Validation Functions
is_file_valid() {
    local file_path="$1"

    if [ ! -r "$file_path" ]; then
        echo "[WARNING] File is not readable: $file_path"
        return 1
    fi

    if [ ! -s "$file_path" ]; then
        echo "[WARNING] File is empty: $file_path"
        return 1
    fi

    local first_line=$(head -n 1 "$file_path" 2>/dev/null)
    if [[ ! "$first_line" =~ ^#! ]]; then
        echo "[WARNING] File does not start with shebang: $file_path"
        return 1
    fi

    return 0
}
