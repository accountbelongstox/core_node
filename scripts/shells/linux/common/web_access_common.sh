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

WEB_ACCESS_COMMON_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

# shellcheck source=/dev/null
source "$WEB_ACCESS_COMMON_DIR/service_contract_common.sh"
# shellcheck source=/dev/null
source "$WEB_ACCESS_COMMON_DIR/file_ops_common.sh"

WEB_ACCESS_REPO_ROOT="$(cd "$WEB_ACCESS_COMMON_DIR/../../../.." && pwd)"
WEB_ACCESS_CORE_NODE_DIR="${CORE_NODE_DIR:-$WEB_ACCESS_REPO_ROOT}"
WEB_ACCESS_SOURCE_FILE="$WEB_ACCESS_CORE_NODE_DIR/config/service_contract.json"
WEB_ACCESS_GLOBAL_VAR_DIR="${CORE_NODE_DATA_DIR:-$(sc_get paths.core_node_data_dir_posix)}/$(sc_get paths.global_var_dir_name)"
WEB_ACCESS_PREFIX_FILE="$WEB_ACCESS_GLOBAL_VAR_DIR/DOMAIN_API_REGION_PREFIX"
WEB_ACCESS_CONFIG_FILE="$WEB_ACCESS_GLOBAL_VAR_DIR/$(sc_get files.web_access_config)"
WEB_ACCESS_DEFAULT_PREFIX=""
WEB_ACCESS_DOMAINS=""
WEB_ACCESS_BROWSER_HOSTS=""
WEB_ACCESS_LARAVEL_HOSTS=""
WEB_ACCESS_PYCORE_HOSTS=""
WEB_ACCESS_HOSTS_JSON=""
WEB_ACCESS_SERVICE_HOST_KEYS_JSON=""
WEB_ACCESS_ALLOWED_HOSTS=""
WEB_ACCESS_CORS_ORIGINS=""
WEB_ACCESS_API_REGION_PREFIX=""
WEB_ACCESS_RENDERED=""
WEB_ACCESS_CONFIG_READY="no"
WEB_ACCESS_CONFIG_CHANGED="false"

web_access_unique_lines() {
    awk 'NF && !seen[$0]++'
}

web_access_valid_hosts() {
    local host=""

    while IFS= read -r host || [ -n "$host" ]; do
        host="$(printf '%s' "$host" | tr -d '\0\r ' | tr '[:upper:]' '[:lower:]')"
        if [[ "$host" =~ ^[a-z0-9]([a-z0-9.-]*[a-z0-9])?$ ]]; then
            printf '%s\n' "$host"
        fi
    done
}

web_access_source_value() {
    local key="$1"

    if command -v node >/dev/null 2>&1; then
        node -e 'const c=JSON.parse(require("fs").readFileSync(process.argv[1],"utf8"));const v=process.argv[2].split(".").reduce((o,p)=>(o==null?o:o[p]),c);process.stdout.write(typeof v==="string"?v:"");' "$WEB_ACCESS_SOURCE_FILE" "$key" 2>/dev/null
        return
    fi
    if command -v php >/dev/null 2>&1; then
        WEB_ACCESS_ARG_FILE="$WEB_ACCESS_SOURCE_FILE" WEB_ACCESS_ARG_KEY="$key" php_script_run '$c=json_decode(file_get_contents(getenv("WEB_ACCESS_ARG_FILE")),true);foreach(explode(".",getenv("WEB_ACCESS_ARG_KEY")) as $p){$c=is_array($c)&&array_key_exists($p,$c)?$c[$p]:null;}echo is_string($c)?$c:"";' 2>/dev/null
    fi
}

web_access_source_list() {
    local key="$1"

    if command -v node >/dev/null 2>&1; then
        node -e 'const c=JSON.parse(require("fs").readFileSync(process.argv[1],"utf8"));const v=process.argv[2].split(".").reduce((o,p)=>(o==null?o:o[p]),c);process.stdout.write(Array.isArray(v)&&v.every(x=>typeof x==="string"&&x!=="")?v.join("\n"):"");' "$WEB_ACCESS_SOURCE_FILE" "$key" 2>/dev/null
        return
    fi
    if command -v php >/dev/null 2>&1; then
        WEB_ACCESS_ARG_FILE="$WEB_ACCESS_SOURCE_FILE" WEB_ACCESS_ARG_KEY="$key" php_script_run '$c=json_decode(file_get_contents(getenv("WEB_ACCESS_ARG_FILE")),true);foreach(explode(".",getenv("WEB_ACCESS_ARG_KEY")) as $p){$c=is_array($c)&&array_key_exists($p,$c)?$c[$p]:null;}echo is_array($c)&&count(array_filter($c,fn($v)=>!is_string($v)||$v===""))===0?implode("\n",$c):"";' 2>/dev/null
    fi
}

web_access_source_json() {
    local key="$1"

    if command -v node >/dev/null 2>&1; then
        node -e 'const c=JSON.parse(require("fs").readFileSync(process.argv[1],"utf8"));const v=process.argv[2].split(".").reduce((o,p)=>(o==null?o:o[p]),c);process.stdout.write(v&&typeof v==="object"?JSON.stringify(v):"");' "$WEB_ACCESS_SOURCE_FILE" "$key" 2>/dev/null
        return
    fi
    if command -v php >/dev/null 2>&1; then
        WEB_ACCESS_ARG_FILE="$WEB_ACCESS_SOURCE_FILE" WEB_ACCESS_ARG_KEY="$key" php_script_run '$c=json_decode(file_get_contents(getenv("WEB_ACCESS_ARG_FILE")),true);foreach(explode(".",getenv("WEB_ACCESS_ARG_KEY")) as $p){$c=is_array($c)&&array_key_exists($p,$c)?$c[$p]:null;}echo is_array($c)?json_encode($c,JSON_UNESCAPED_SLASHES):"";' 2>/dev/null
    fi
}

web_access_source_hosts() {
    local service="$1"

    if command -v node >/dev/null 2>&1; then
        node -e 'const c=JSON.parse(require("fs").readFileSync(process.argv[1],"utf8"));const keys=c.access?.service_host_keys?.[process.argv[2]];process.stdout.write(Array.isArray(keys)&&keys.every(k=>typeof c.hosts?.[k]==="string")?keys.map(k=>c.hosts[k]).join("\n"):"");' "$WEB_ACCESS_SOURCE_FILE" "$service" 2>/dev/null
        return
    fi
    if command -v php >/dev/null 2>&1; then
        WEB_ACCESS_ARG_FILE="$WEB_ACCESS_SOURCE_FILE" WEB_ACCESS_ARG_SERVICE="$service" php_script_run '$c=json_decode(file_get_contents(getenv("WEB_ACCESS_ARG_FILE")),true);$keys=$c["access"]["service_host_keys"][getenv("WEB_ACCESS_ARG_SERVICE")]??null;$hosts=$c["hosts"]??null;echo is_array($keys)&&is_array($hosts)&&count(array_filter($keys,fn($k)=>!is_string($k)||!isset($hosts[$k])||!is_string($hosts[$k])))===0?implode("\n",array_map(fn($k)=>$hosts[$k],$keys)):"";' 2>/dev/null
    fi
}

web_access_load_sources() {
    local domain=""
    local prefix=""

    WEB_ACCESS_DOMAINS=""
    WEB_ACCESS_BROWSER_HOSTS=""
    WEB_ACCESS_LARAVEL_HOSTS=""
    WEB_ACCESS_PYCORE_HOSTS=""
    WEB_ACCESS_HOSTS_JSON="$(web_access_source_json hosts)"
    WEB_ACCESS_SERVICE_HOST_KEYS_JSON="$(web_access_source_json access.service_host_keys)"
    WEB_ACCESS_DEFAULT_PREFIX="$(web_access_source_value access.default_api_region_prefix)"
    if [[ ! "$WEB_ACCESS_DEFAULT_PREFIX" =~ ^[a-z0-9][a-z0-9-]{0,30}$ ]]; then
        WEB_ACCESS_DEFAULT_PREFIX=""
    fi
    WEB_ACCESS_API_REGION_PREFIX="$WEB_ACCESS_DEFAULT_PREFIX"

    if [ -f "$WEB_ACCESS_PREFIX_FILE" ]; then
        prefix="$(tr -d '\0\r\n ' < "$WEB_ACCESS_PREFIX_FILE")"
        if [[ "$prefix" =~ ^[a-z0-9][a-z0-9-]{0,30}$ ]]; then
            WEB_ACCESS_API_REGION_PREFIX="$prefix"
        fi
    fi

    while IFS= read -r domain; do
        domain="$(printf '%s' "$domain" | tr -d '\0\r ' | tr '[:upper:]' '[:lower:]')"
        if [[ "$domain" =~ ^([a-z0-9]([a-z0-9-]*[a-z0-9])?\.)+[a-z]{2,63}$ ]]; then
            WEB_ACCESS_DOMAINS="${WEB_ACCESS_DOMAINS}${domain}"$'\n'
        fi
    done <<< "$(web_access_source_list access.root_domains)"
    WEB_ACCESS_DOMAINS="$(printf '%s' "$WEB_ACCESS_DOMAINS" | web_access_unique_lines)"

    WEB_ACCESS_BROWSER_HOSTS="$(web_access_source_hosts browserAccess | web_access_valid_hosts | web_access_unique_lines)"
    WEB_ACCESS_LARAVEL_HOSTS="$(web_access_source_hosts laravelApi | web_access_valid_hosts | web_access_unique_lines)"
    WEB_ACCESS_PYCORE_HOSTS="$(web_access_source_hosts pycore | web_access_valid_hosts | web_access_unique_lines)"
}

web_access_resolve() {
    local domain=""
    local host=""
    local prefix=""
    local ui_port=""

    web_access_load_sources
    prefix="$WEB_ACCESS_API_REGION_PREFIX"
    ui_port="$(sc_require ports.nexus_dash_frontend)"
    WEB_ACCESS_ALLOWED_HOSTS="$({
        while IFS= read -r host; do
            [ -z "$host" ] && continue
            printf '%s\n' "$host"
        done <<< "$WEB_ACCESS_BROWSER_HOSTS"$'\n'"$WEB_ACCESS_LARAVEL_HOSTS"$'\n'"$WEB_ACCESS_PYCORE_HOSTS"
        while IFS= read -r domain; do
            [ -z "$domain" ] && continue
            printf '%s\n' "$domain" "www.$domain" "$prefix.$domain" "www.$prefix.$domain" "api.$prefix.$domain"
        done <<< "$WEB_ACCESS_DOMAINS"
    } | web_access_unique_lines)"

    WEB_ACCESS_CORS_ORIGINS="$({
        while IFS= read -r host; do
            [ -z "$host" ] && continue
            printf 'http://%s:%s\nhttp://%s\nhttps://%s\n' "$host" "$ui_port" "$host" "$host"
        done <<< "$WEB_ACCESS_BROWSER_HOSTS"
        while IFS= read -r domain; do
            [ -z "$domain" ] && continue
            for host in "$domain" "www.$domain" "$prefix.$domain" "www.$prefix.$domain" "api.$prefix.$domain"; do
                printf 'http://%s\nhttps://%s\n' "$host" "$host"
            done
        done <<< "$WEB_ACCESS_DOMAINS"
    } | web_access_unique_lines)"
}

web_access_json_array() {
    local values="$1"
    local value=""
    local separator=""

    printf '['
    while IFS= read -r value; do
        [ -z "$value" ] && continue
        printf '%s"%s"' "$separator" "$value"
        separator=','
    done <<< "$values"
    printf ']'
}

web_access_render() {
    local domains_json=""
    local hosts_json=""
    local origins_json=""

    domains_json="$(web_access_json_array "$WEB_ACCESS_DOMAINS")"
    hosts_json="$(web_access_json_array "$WEB_ACCESS_ALLOWED_HOSTS")"
    origins_json="$(web_access_json_array "$WEB_ACCESS_CORS_ORIGINS")"
    printf -v WEB_ACCESS_RENDERED '{\n  "apiRegionPrefix": "%s",\n  "domains": %s,\n  "hosts": %s,\n  "serviceHostKeys": %s,\n  "allowedHosts": %s,\n  "corsOrigins": %s\n}' \
        "$WEB_ACCESS_API_REGION_PREFIX" "$domains_json" "$WEB_ACCESS_HOSTS_JSON" "$WEB_ACCESS_SERVICE_HOST_KEYS_JSON" "$hosts_json" "$origins_json"
}

web_access_config_ensure() {
    local existing=""
    local write_output=""

    WEB_ACCESS_CONFIG_READY="no"
    WEB_ACCESS_CONFIG_CHANGED="false"
    web_access_resolve
    if [ -z "$WEB_ACCESS_DEFAULT_PREFIX" ] || [ -z "$WEB_ACCESS_DOMAINS" ] \
        || [ -z "$WEB_ACCESS_HOSTS_JSON" ] || [ -z "$WEB_ACCESS_SERVICE_HOST_KEYS_JSON" ] \
        || [ -z "$WEB_ACCESS_ALLOWED_HOSTS" ] || [ -z "$WEB_ACCESS_CORS_ORIGINS" ] \
        || [ -z "$WEB_ACCESS_BROWSER_HOSTS" ] || [ -z "$WEB_ACCESS_LARAVEL_HOSTS" ] \
        || [ -z "$WEB_ACCESS_PYCORE_HOSTS" ]; then
        echo "[web-access] [FAIL] Global web access JSON is incomplete: $WEB_ACCESS_SOURCE_FILE" >&2
        return
    fi
    web_access_render
    if [ -f "$WEB_ACCESS_CONFIG_FILE" ]; then
        existing="$(cat "$WEB_ACCESS_CONFIG_FILE")"
    fi
    if [ "$existing" != "$WEB_ACCESS_RENDERED" ]; then
        WEB_ACCESS_CONFIG_CHANGED="true"
    fi
    write_output="$(printf '%s\n' "$WEB_ACCESS_RENDERED" | write_file_if_changed "$WEB_ACCESS_CONFIG_FILE")"
    echo "$write_output" >&2

    existing=""
    if [ -f "$WEB_ACCESS_CONFIG_FILE" ]; then
        existing="$(cat "$WEB_ACCESS_CONFIG_FILE")"
    fi
    if [ "$existing" = "$WEB_ACCESS_RENDERED" ]; then
        WEB_ACCESS_CONFIG_READY="yes"
    else
        echo "[web-access] [FAIL] Runtime access config did not converge: $WEB_ACCESS_CONFIG_FILE" >&2
    fi
}

web_access_config_list() {
    local key="$1"

    web_access_config_ensure
    if [ "$WEB_ACCESS_CONFIG_READY" != "yes" ]; then
        return
    fi
    case "$key" in
        allowedHosts) printf '%s' "$WEB_ACCESS_ALLOWED_HOSTS" | tr '\n' ' ' ;;
        corsOrigins) printf '%s' "$WEB_ACCESS_CORS_ORIGINS" | tr '\n' ' ' ;;
    esac
}

web_access_first_domain() {
    web_access_resolve
    printf '%s\n' "$WEB_ACCESS_DOMAINS" | sed -n '1p'
}
