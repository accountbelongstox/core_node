#!/bin/bash
# Auto Fix Context7 MCP Server

set -e

# Configuration
MAX_RETRIES=${MAX_RETRIES:-3}
RETRY_DELAY=${RETRY_DELAY:-2}
FORCE_REINSTALL=${FORCE_REINSTALL:-false}

# Clear NPX cache
clear_npx_cache() {
    if [ -d "$HOME/.npm/_npx" ]; then
        rm -rf "$HOME/.npm/_npx"
    fi
    npm cache clean --force 2>/dev/null || true
}

# Test Context7 installation
test_context7_installation() {
    timeout 10 npx -y @upstash/context7-mcp --version >/dev/null 2>&1
}

# Install Context7
install_context7() {
    if [ "$FORCE_REINSTALL" = "true" ]; then
        clear_npx_cache
    fi
    
    timeout 30 npx -y @upstash/context7-mcp@latest >/dev/null 2>&1
}

# Start Context7 server
start_context7_server() {
    exec npx -y @upstash/context7-mcp
}

# Main function
main() {
    for attempt in $(seq 1 $MAX_RETRIES); do
        if test_context7_installation; then
            start_context7_server
            return
        fi
        
        clear_npx_cache
        
        if install_context7; then
            if test_context7_installation; then
                start_context7_server
                return
            fi
        fi
        
        if [ $attempt -lt $MAX_RETRIES ]; then
            sleep $RETRY_DELAY
        fi
    done
    
    exit 1
}

main "$@"
