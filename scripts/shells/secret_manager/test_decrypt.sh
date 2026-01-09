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

# Test script to diagnose decryption issues
# Usage: bash test_decrypt.sh [password]

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
CORE_NODE_DIR="$(cd "$SCRIPT_DIR/../../.." && pwd)"
ENCRYPTED_FILE="$CORE_NODE_DIR/.secret_keys/already_encrypted/DNSPOD_EMAILS.js"
TEST_PASSWORD="${1:-}"

echo "==================================="
echo "Secret Decryption Test"
echo "==================================="
echo "Script Directory: $SCRIPT_DIR"
echo "Core Node Directory: $CORE_NODE_DIR"
echo "Encrypted File: $ENCRYPTED_FILE"
echo ""

# Check if encrypted file exists
if [ ! -f "$ENCRYPTED_FILE" ]; then
    echo "ERROR: Encrypted file not found!"
    echo "Expected location: $ENCRYPTED_FILE"
    exit 1
fi
echo "[OK] Encrypted file exists"

# Check file size and permissions
echo "File info:"
ls -lh "$ENCRYPTED_FILE"
echo ""

# Check if node is available
if ! command -v node &>/dev/null; then
    echo "ERROR: node command not found"
    exit 1
fi
echo "[OK] Node.js found: $(node --version)"
echo ""

# Check if password provided
if [ -z "$TEST_PASSWORD" ]; then
    echo "Please enter test password:"
    read -s TEST_PASSWORD
    echo ""
fi

# Test password hint
echo "==================================="
echo "Testing password hint..."
echo "==================================="
node "$ENCRYPTED_FILE" show
echo ""

# Create temp directory
TEMP_DIR=$(mktemp -d)
echo "==================================="
echo "Testing decryption..."
echo "==================================="
echo "Temp directory: $TEMP_DIR"
echo "Command: node \"$ENCRYPTED_FILE\" pwd \"[HIDDEN]\" \"$TEMP_DIR\""
echo ""

# Run decryption
echo "Executing decryption..."
OUTPUT=$(node "$ENCRYPTED_FILE" pwd "$TEST_PASSWORD" "$TEMP_DIR" 2>&1)
EXIT_CODE=$?

echo "Exit code: $EXIT_CODE"
echo "Output:"
echo "$OUTPUT"
echo ""

# Check output file
EXPECTED_FILE="$TEMP_DIR/DNSPOD_EMAILS"
if [ -f "$EXPECTED_FILE" ]; then
    echo "[OK] Decrypted file created: $EXPECTED_FILE"
    echo "File size: $(stat -c%s "$EXPECTED_FILE" 2>/dev/null || stat -f%z "$EXPECTED_FILE" 2>/dev/null) bytes"
    echo "First 50 characters of content:"
    head -c 50 "$EXPECTED_FILE"
    echo ""
else
    echo "[ERROR] Decrypted file NOT created"
    echo "Expected: $EXPECTED_FILE"
    echo "Directory contents:"
    ls -la "$TEMP_DIR"
fi

# Cleanup
rm -rf "$TEMP_DIR"
echo ""
echo "Test completed."
