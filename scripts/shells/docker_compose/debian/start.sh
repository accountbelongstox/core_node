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

CURRENT_DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )"
SHELLS_DIR="${CURRENT_DIR}/shells"

if [ ! -d "$SHELLS_DIR" ]; then
    echo "Directory $SHELLS_DIR does not exist."
    exit 1
fi

find "$SHELLS_DIR" -type f -name "*.sh" -exec chmod +x {} \;

RUN_DIR="${SHELLS_DIR}/run"
if [ -d "$RUN_DIR" ]; then
    for script in $(ls "$RUN_DIR" | sort -V); do
        script_path="$RUN_DIR/$script"
        if [ -x "$script_path" ]; then
            echo "Executing $script_path ..."
            "$script_path"
        else
            echo "Skipping non-executable file: $script_path"
        fi
    done
else
    echo "Directory $RUN_DIR does not exist."
    exit 1
fi

echo "The container will remain running. Use Ctrl+C to stop it."
exec tail -f /dev/null
