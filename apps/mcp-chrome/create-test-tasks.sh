#!/bin/bash

# Create continuous test tasks for Worker testing
# Creates translation tasks every few seconds

API_URL="http://localhost:9000"
COUNT=0

echo "========================================"
echo "Continuous Task Creator"
echo "API: $API_URL"
echo "Press Ctrl+C to stop"
echo "========================================"
echo ""

# Note: This endpoint requires authentication
# You need to provide a valid token

if [ -z "$AUTH_TOKEN" ]; then
    echo "⚠️  WARNING: AUTH_TOKEN not set"
    echo ""
    echo "To create tasks, you need authentication."
    echo "Usage:"
    echo "  export AUTH_TOKEN='your-token-here'"
    echo "  ./create-test-tasks.sh"
    echo ""
    echo "Or manually create tasks:"
    echo "  curl -X POST $API_URL/api/app_qy_v1/dictionary/tasks/create-explanation \\"
    echo "    -H 'Content-Type: application/json' \\"
    echo "    -H 'Authorization: Bearer YOUR_TOKEN' \\"
    echo "    -d '{\"language\": \"english\", \"limit\": 10, \"is_demo_mode\": true}'"
    exit 1
fi

while true; do
    COUNT=$((COUNT + 1))
    TIMESTAMP=$(date '+%Y-%m-%d %H:%M:%S')

    echo "[$TIMESTAMP] Creating task #$COUNT..."

    RESPONSE=$(curl -s -X POST "$API_URL/api/app_qy_v1/dictionary/tasks/create-explanation" \
        -H "Content-Type: application/json" \
        -H "Authorization: Bearer $AUTH_TOKEN" \
        -d "{
            \"language\": \"english\",
            \"limit\": 10,
            \"is_demo_mode\": true
        }")

    STATUS=$(echo "$RESPONSE" | jq -r '.success' 2>/dev/null)

    if [ "$STATUS" = "true" ]; then
        TASK_ID=$(echo "$RESPONSE" | jq -r '.data.task_id' 2>/dev/null)
        WORD_COUNT=$(echo "$RESPONSE" | jq -r '.data.word_count' 2>/dev/null)
        echo "  ✓ Task created: $TASK_ID ($WORD_COUNT words)"
    else
        MESSAGE=$(echo "$RESPONSE" | jq -r '.message' 2>/dev/null)
        echo "  ✗ Failed: $MESSAGE"
    fi

    echo ""
    sleep 5
done
