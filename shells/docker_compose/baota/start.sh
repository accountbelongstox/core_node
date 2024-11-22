#!/bin/bash
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
