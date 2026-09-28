#!/bin/bash
# Verification script for TODO fixes

echo "========================================================================"
echo "  Native UI TODO Fixes Verification"
echo "========================================================================"
echo ""

NATIVE_UI_DIR="/mnt/d/programing/core_node/pycore/pyutils/native_ui"
PASS=0
FAIL=0

# Color codes
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Test function
test_check() {
    local test_name="$1"
    local test_command="$2"
    local expected_result="$3"

    echo -n "Checking: $test_name... "

    result=$(eval "$test_command")

    if [ "$result" == "$expected_result" ]; then
        echo -e "${GREEN}PASS${NC}"
        ((PASS++))
        return 0
    else
        echo -e "${RED}FAIL${NC}"
        echo "  Expected: $expected_result"
        echo "  Got: $result"
        ((FAIL++))
        return 1
    fi
}

echo "1. ColorPrint Import Consistency"
echo "========================================================================"

# Test 1.1: No old imports
test_check \
    "No 'from pycore.pyfoundations import ColorPrint'" \
    "grep -r 'from pycore.pyfoundations import ColorPrint' '$NATIVE_UI_DIR' --include='*.py' | wc -l" \
    "0"

# Test 1.2: Count new imports
NEW_IMPORTS=$(grep -r "from pycore import ColorPrint" "$NATIVE_UI_DIR" --include="*.py" | wc -l)
echo -e "Info: Found ${YELLOW}${NEW_IMPORTS}${NC} correct ColorPrint imports"

echo ""
echo "2. TODO Implementation Verification"
echo "========================================================================"

# Test 2.1: ServerManager exists
test_check \
    "ServerManager file exists" \
    "[ -f '$NATIVE_UI_DIR/step2_port_url/server_manager.py' ] && echo 'yes' || echo 'no'" \
    "yes"

# Test 2.2: ServerManager has required classes
test_check \
    "ServerManager class defined" \
    "grep -c 'class ServerManager' '$NATIVE_UI_DIR/step2_port_url/server_manager.py'" \
    "1"

test_check \
    "ServerProcess dataclass defined" \
    "grep -c '@dataclass' '$NATIVE_UI_DIR/step2_port_url/server_manager.py'" \
    "1"

# Test 2.3: URLHandler updated
test_check \
    "_process_nuxt_app implemented (no TODO)" \
    "grep -c 'TODO: Implement Nuxt dev server' '$NATIVE_UI_DIR/step2_port_url/url_handler.py'" \
    "0"

test_check \
    "_process_vue_dist implemented (no TODO)" \
    "grep -c 'TODO: Implement static file server' '$NATIVE_UI_DIR/step2_port_url/url_handler.py'" \
    "0"

# Test 2.4: ServerManager methods
test_check \
    "start_nuxt_dev_server method exists" \
    "grep -c 'def start_nuxt_dev_server' '$NATIVE_UI_DIR/step2_port_url/server_manager.py'" \
    "1"

test_check \
    "start_vue_static_server method exists" \
    "grep -c 'def start_vue_static_server' '$NATIVE_UI_DIR/step2_port_url/server_manager.py'" \
    "1"

test_check \
    "is_port_available method exists" \
    "grep -c 'def is_port_available' '$NATIVE_UI_DIR/step2_port_url/server_manager.py'" \
    "1"

test_check \
    "wait_for_port method exists" \
    "grep -c 'def wait_for_port' '$NATIVE_UI_DIR/step2_port_url/server_manager.py'" \
    "1"

echo ""
echo "3. Export Verification"
echo "========================================================================"

# Test 3.1: step2_port_url/__init__.py exports
test_check \
    "ServerManager exported from step2_port_url" \
    "grep -c 'ServerManager' '$NATIVE_UI_DIR/step2_port_url/__init__.py'" \
    "2"

# Test 3.2: main __init__.py exports
test_check \
    "ServerManager exported from main __init__.py" \
    "grep -c 'ServerManager' '$NATIVE_UI_DIR/__init__.py'" \
    "2"

echo ""
echo "4. Documentation Verification"
echo "========================================================================"

# Test 4.1: Analysis reports exist
test_check \
    "consistency_analysis_report.md exists" \
    "[ -f '$NATIVE_UI_DIR/_analysis/consistency_analysis_report.md' ] && echo 'yes' || echo 'no'" \
    "yes"

test_check \
    "consistency_issues_checklist.md exists" \
    "[ -f '$NATIVE_UI_DIR/_analysis/consistency_issues_checklist.md' ] && echo 'yes' || echo 'no'" \
    "yes"

test_check \
    "TODO_FIX_SUMMARY.md exists" \
    "[ -f '$NATIVE_UI_DIR/_analysis/TODO_FIX_SUMMARY.md' ] && echo 'yes' || echo 'no'" \
    "yes"

test_check \
    "EXECUTIVE_SUMMARY.md exists" \
    "[ -f '$NATIVE_UI_DIR/_analysis/EXECUTIVE_SUMMARY.md' ] && echo 'yes' || echo 'no'" \
    "yes"

echo ""
echo "5. Example Code Verification"
echo "========================================================================"

# Test 5.1: Example file exists
test_check \
    "nuxt_vue_server_example.py exists" \
    "[ -f '$NATIVE_UI_DIR/examples/nuxt_vue_server_example.py' ] && echo 'yes' || echo 'no'" \
    "yes"

echo ""
echo "6. Code Quality Checks"
echo "========================================================================"

# Test 6.1: No obvious syntax errors in ServerManager
test_check \
    "ServerManager syntax valid" \
    "python -m py_compile '$NATIVE_UI_DIR/step2_port_url/server_manager.py' 2>&1 > /dev/null && echo 'valid' || echo 'invalid'" \
    "valid"

# Test 6.2: URLHandler syntax valid
test_check \
    "URLHandler syntax valid" \
    "python -m py_compile '$NATIVE_UI_DIR/step2_port_url/url_handler.py' 2>&1 > /dev/null && echo 'valid' || echo 'invalid'" \
    "valid"

echo ""
echo "========================================================================"
echo "  Test Summary"
echo "========================================================================"
echo -e "Passed: ${GREEN}${PASS}${NC}"
echo -e "Failed: ${RED}${FAIL}${NC}"
echo ""

if [ $FAIL -eq 0 ]; then
    echo -e "${GREEN}[OK] All tests passed! TODO fixes verified successfully.${NC}"
    exit 0
else
    echo -e "${RED}[ERROR] Some tests failed. Please review the failures above.${NC}"
    exit 1
fi
