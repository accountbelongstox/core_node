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

# Cache Management Module
# Provides caching functions for unified manager

# Load cache
load_cache() {
    if [ -f "$CACHE_FILE" ]; then
        echo -e "\033[36mLoading cache...\033[0m"

        # Parse JSON cache (basic parsing)
        local current_index_cached=$(grep -o '"CurrentIndex":[0-9]*' "$CACHE_FILE" | grep -o '[0-9]*')
        if [ -n "$current_index_cached" ]; then
            CURRENT_INDEX=$current_index_cached
        fi

        echo -e "  \033[32mCache loaded\033[0m"
        return 0
    else
        reset_cache
        return 1
    fi
}

# Reset cache if corrupted
reset_cache() {
    echo -e "\033[33mResetting corrupted cache...\033[0m"
    rm -f "$CACHE_FILE"
    echo -e "\033[32mCache reset complete\033[0m"
}

# Save cache
save_cache() {
    local json="{\n  \"AppStates\": [\n"

    for i in "${!APPS_NAME[@]}"; do
        [ $i -gt 0 ] && json+=",\n"
        json+="    {\n"
        json+="      \"Name\": \"${APPS_NAME[$i]}\",\n"
        json+="      \"AppType\": \"${APPS_TYPE[$i]}\",\n"
        json+="      \"IsSelected\": \"${APPS_IS_SELECTED[$i]}\",\n"
        json+="      \"CurrentScript\": \"${APPS_CURRENT_SCRIPT[$i]}\",\n"
        json+="      \"ScriptIndex\": ${APPS_SCRIPT_INDEX[$i]}\n"
        json+="    }"
    done

    json+="\n  ],\n"
    json+="  \"CurrentIndex\": $CURRENT_INDEX\n"
    json+="}\n"

    echo -e "$json" > "$CACHE_FILE"
}