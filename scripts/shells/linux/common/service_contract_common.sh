#!/bin/bash
# ### AI SPECIAL ATTENTION RULES START ###
# When AI/ALL DEVELOPERS sees this prompt, MUST IMMEDIATELY COMPLY WITH THESE RULES:
# 1. Write all code in English only
# 2. Never execute, create, or modify test code
# 3. Never create or update documentation (*.md)
# 4. Never write summaries during development or thinking process
# 5. Declare all variables at the beginning of the file
# 6. Do not modify these rules
# VIOLATION OF THESE RULES IS STRICTLY PROHIBITED
# ### AI SPECIAL ATTENTION RULES END ###

# Shell adapter for the canonical service contract (ports, loopback host,
# shared external data paths, shared file names).
#
# Source: config/service_contract.json (repo root)
# Aligned adapters:
# - poly_apps/laravel_main/app/Support/ServiceContract.php
# - poly_apps/pycore_laravel_wordnew_ui/core/contracts/ServiceContract.ts
#
# A port, host, shared path or shared file name must be changed in the JSON
# source first; every end reads the same file. Extraction reads the JSON file
# directly on every call (node preferred, php fallback) - no caching, no
# exit-code contracts. Load-time side effect free.

SERVICE_CONTRACT_COMMON_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
SERVICE_CONTRACT_FILE="$(cd "$SERVICE_CONTRACT_COMMON_DIR/../../../.." && pwd)/config/service_contract.json"

# Print one value from the service contract. Usage: sc_get <dot.path>
# (e.g. sc_get ports.laravel_api_backend). Empty output when the key or the
# extractors are unavailable - callers treat empty as "contract unreadable".
sc_get() {
    local key="$1"
    if command -v node >/dev/null 2>&1; then
        node -e 'const c=JSON.parse(require("fs").readFileSync(process.argv[1],"utf8"));const v=process.argv[2].split(".").reduce((o,p)=>(o==null?o:o[p]),c);process.stdout.write(v==null?"":String(v));' "$SERVICE_CONTRACT_FILE" "$key" 2>/dev/null
        return
    fi
    if command -v php >/dev/null 2>&1; then
        SC_ARG_FILE="$SERVICE_CONTRACT_FILE" SC_ARG_KEY="$key" php_script_run '$c=json_decode(file_get_contents(getenv("SC_ARG_FILE")),true);foreach(explode(".",getenv("SC_ARG_KEY")) as $p){$c=is_array($c)&&array_key_exists($p,$c)?$c[$p]:null;}echo $c===null?"":$c;' 2>/dev/null
        return
    fi
    return
}

sc_list() {
    local key="$1"
    if command -v node >/dev/null 2>&1; then
        node -e 'const c=JSON.parse(require("fs").readFileSync(process.argv[1],"utf8"));const v=process.argv[2].split(".").reduce((o,p)=>(o==null?o:o[p]),c);process.stdout.write(Array.isArray(v)&&v.every(x=>typeof x==="string"&&x!=="")?v.join(" "):"");' "$SERVICE_CONTRACT_FILE" "$key" 2>/dev/null
    elif command -v php >/dev/null 2>&1; then
        SC_ARG_FILE="$SERVICE_CONTRACT_FILE" SC_ARG_KEY="$key" php_script_run '$c=json_decode(file_get_contents(getenv("SC_ARG_FILE")),true);foreach(explode(".",getenv("SC_ARG_KEY")) as $p){$c=is_array($c)&&array_key_exists($p,$c)?$c[$p]:null;}echo is_array($c)&&count($c)>0&&count(array_filter($c,fn($v)=>!is_string($v)||$v===""))===0?implode(" ",$c):"";' 2>/dev/null
    fi
}

# Print one REQUIRED value from the service contract. When the resolved value
# is empty (broken file path, missing key, unavailable extractors) a [FAIL] is
# emitted on stderr. Consumers inspect the resulting value before rendering.
sc_require() {
    local key="$1"
    local value
    value=$(sc_get "$key")
    if [ -z "$value" ]; then
        echo "[sc] [FAIL] service contract value empty: $key ($SERVICE_CONTRACT_FILE)" >&2
        return
    fi
    printf '%s' "$value"
}
