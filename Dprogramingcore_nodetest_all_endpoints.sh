#!/bin/bash
# API Endpoints Testing Script

BASE_LOCAL="http://localhost:59000"
BASE_REMOTE="http://192.168.50.2:9000/api/mcp/v1"
OUTPUT_DIR="D:/programing/core_node/api_test_results"

mkdir -p "$OUTPUT_DIR"

echo "=== Testing All API Endpoints ==="
echo ""

# 1. Queue Management Endpoints
echo "1. Testing GET /voice-subtitle/queue"
curl -s "$BASE_LOCAL/voice-subtitle/queue" > "$OUTPUT_DIR/local_queue.json"
curl -s "$BASE_REMOTE/voice-subtitle/queue" > "$OUTPUT_DIR/remote_queue.json"

echo "2. Testing GET /voice-subtitle/queue/latest"
curl -s "$BASE_LOCAL/voice-subtitle/queue/latest?limit=5" > "$OUTPUT_DIR/local_queue_latest.json"
curl -s "$BASE_REMOTE/voice-subtitle/queue/latest?limit=5" > "$OUTPUT_DIR/remote_queue_latest.json"

echo "3. Testing GET /voice-subtitle/queue/filter-by-today"
curl -s "$BASE_LOCAL/voice-subtitle/queue/filter-by-today" > "$OUTPUT_DIR/local_queue_today.json"
curl -s "$BASE_REMOTE/voice-subtitle/queue/filter-by-today" > "$OUTPUT_DIR/remote_queue_today.json"

echo "4. Testing GET /voice-subtitle/queue/filter-by-category"
curl -s "$BASE_LOCAL/voice-subtitle/queue/filter-by-category?category=normal" > "$OUTPUT_DIR/local_queue_category.json"
curl -s "$BASE_REMOTE/voice-subtitle/queue/filter-by-category?category=normal" > "$OUTPUT_DIR/remote_queue_category.json"

echo "5. Testing GET /voice-subtitle/categories"
curl -s "$BASE_LOCAL/voice-subtitle/categories" > "$OUTPUT_DIR/local_categories.json"
curl -s "$BASE_REMOTE/voice-subtitle/categories" > "$OUTPUT_DIR/remote_categories.json"

echo ""
echo "All tests completed! Results saved to: $OUTPUT_DIR"
