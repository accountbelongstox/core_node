#!/bin/bash

LARAVEL_DIR="/www/programing/core_node/poly_apps/laravel_main"
STARTUP_LOG="/tmp/laravel_startup.log"
SYSTEMD_LOG="/tmp/laravel_systemd_startup.log"
TEST_LOG="/tmp/startup_test.log"

TEST_URL="http://192.168.50.2:9000/#"
SERVICE_NAME="octane-poly-9000.service"

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

log_test() {
    local level="$1"
    local message="$2"
    local timestamp=$(date '+%Y-%m-%d %H:%M:%S')

    echo "[${timestamp}] [${level}] ${message}" >> "$TEST_LOG"

    case "$level" in
        "INFO")
            echo -e "${BLUE}[INFO]${NC} ${message}"
            ;;
        "SUCCESS")
            echo -e "${GREEN}[SUCCESS]${NC} ${message}"
            ;;
        "ERROR")
            echo -e "${RED}[ERROR]${NC} ${message}"
            ;;
        "WARN")
            echo -e "${YELLOW}[WARN]${NC} ${message}"
            ;;
    esac
}

echo "" > "$TEST_LOG"

log_test "INFO" "========================================="
log_test "INFO" "Laravel Octane Startup Flow Test"
log_test "INFO" "========================================="

log_test "INFO" "Step 1: Checking if service exists"
if systemctl list-unit-files | grep -q "$SERVICE_NAME"; then
    log_test "SUCCESS" "Service $SERVICE_NAME exists"
else
    log_test "ERROR" "Service $SERVICE_NAME not found"
    exit 1
fi

log_test "INFO" "Step 2: Stopping service"
systemctl stop "$SERVICE_NAME" 2>&1 | tee -a "$TEST_LOG"
sleep 2

log_test "INFO" "Step 3: Clearing old logs"
echo "" > "$STARTUP_LOG"
echo "" > "$SYSTEMD_LOG"

log_test "INFO" "Step 4: Starting service"
START_TIME=$(date +%s)
systemctl start "$SERVICE_NAME"

log_test "INFO" "Step 5: Waiting for service to become active"
TIMEOUT=30
ELAPSED=0
while [ $ELAPSED -lt $TIMEOUT ]; do
    if systemctl is-active --quiet "$SERVICE_NAME"; then
        log_test "SUCCESS" "Service is active (took ${ELAPSED}s)"
        break
    fi
    sleep 1
    ELAPSED=$((ELAPSED + 1))
done

if [ $ELAPSED -ge $TIMEOUT ]; then
    log_test "ERROR" "Service did not become active within ${TIMEOUT}s"
    systemctl status "$SERVICE_NAME" | tee -a "$TEST_LOG"
    exit 1
fi

log_test "INFO" "Step 6: Checking service status"
systemctl status "$SERVICE_NAME" --no-pager | tee -a "$TEST_LOG"

log_test "INFO" "Step 7: Testing HTTP connectivity (waiting for port)"
TIMEOUT=30
ELAPSED=0
while [ $ELAPSED -lt $TIMEOUT ]; do
    if nc -z 192.168.50.2 9000 2>/dev/null; then
        log_test "SUCCESS" "Port 9000 is listening (took ${ELAPSED}s)"
        break
    fi
    sleep 1
    ELAPSED=$((ELAPSED + 1))
done

if [ $ELAPSED -ge $TIMEOUT ]; then
    log_test "ERROR" "Port 9000 is not listening after ${TIMEOUT}s"
    ss -tlnp | grep 9000 | tee -a "$TEST_LOG"
    exit 1
fi

log_test "INFO" "Step 8: Making test HTTP request"
HTTP_RESPONSE=$(curl -s -w "\n%{http_code}" "$TEST_URL" 2>&1)
HTTP_CODE=$(echo "$HTTP_RESPONSE" | tail -n 1)
HTTP_BODY=$(echo "$HTTP_RESPONSE" | head -n -1)

log_test "INFO" "HTTP Status Code: $HTTP_CODE"

if [ "$HTTP_CODE" = "200" ]; then
    log_test "SUCCESS" "Received HTTP 200 OK"
else
    log_test "ERROR" "Received HTTP $HTTP_CODE (expected 200)"
fi

log_test "INFO" "Step 9: Checking HTML content"
if echo "$HTTP_BODY" | grep -q "<!DOCTYPE html>"; then
    log_test "SUCCESS" "HTML content detected"
    CONTENT_LENGTH=$(echo "$HTTP_BODY" | wc -c)
    log_test "INFO" "HTML content length: $CONTENT_LENGTH bytes"
else
    log_test "ERROR" "No HTML content in response"
    log_test "INFO" "Response body preview:"
    echo "$HTTP_BODY" | head -n 20 | tee -a "$TEST_LOG"
fi

log_test "INFO" "Step 10: Checking for common HTML elements"
if echo "$HTTP_BODY" | grep -q "<html"; then
    log_test "SUCCESS" "Found <html> tag"
fi

if echo "$HTTP_BODY" | grep -q "<head"; then
    log_test "SUCCESS" "Found <head> tag"
fi

if echo "$HTTP_BODY" | grep -q "<body"; then
    log_test "SUCCESS" "Found <body> tag"
fi

END_TIME=$(date +%s)
TOTAL_TIME=$((END_TIME - START_TIME))

log_test "INFO" "========================================="
log_test "INFO" "Total startup time: ${TOTAL_TIME}s"
log_test "INFO" "========================================="

log_test "INFO" "Step 11: Displaying startup logs"
if [ -f "$STARTUP_LOG" ]; then
    log_test "INFO" "Laravel Startup Log:"
    cat "$STARTUP_LOG" | tee -a "$TEST_LOG"
else
    log_test "WARN" "No Laravel startup log found at $STARTUP_LOG"
fi

if [ -f "$SYSTEMD_LOG" ]; then
    log_test "INFO" "Systemd Startup Log:"
    cat "$SYSTEMD_LOG" | tee -a "$TEST_LOG"
else
    log_test "WARN" "No systemd startup log found at $SYSTEMD_LOG"
fi

log_test "INFO" "========================================="
log_test "INFO" "Test log saved to: $TEST_LOG"
log_test "INFO" "View startup monitor at: http://192.168.50.2:9000/startup-monitor/view"
log_test "INFO" "========================================="
