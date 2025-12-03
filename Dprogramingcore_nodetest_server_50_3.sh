#!/bin/bash
# Test API Server 192.168.50.3:9000

SERVER="http://192.168.50.3:9000"
OUTPUT="D:/programing/core_node/server_50_3_test_results.txt"

echo "========================================" > "$OUTPUT"
echo "API Server Test: 192.168.50.3:9000" >> "$OUTPUT"
echo "Test Time: $(date)" >> "$OUTPUT"
echo "========================================" >> "$OUTPUT"
echo "" >> "$OUTPUT"

# Test 1: Queue endpoint
echo "TEST 1: GET /api/mcp/v1/voice-subtitle/queue" >> "$OUTPUT"
echo "---" >> "$OUTPUT"
curl -s -w "\nHTTP Status: %{http_code}\n" "$SERVER/api/mcp/v1/voice-subtitle/queue" >> "$OUTPUT" 2>&1
echo "" >> "$OUTPUT"
echo "" >> "$OUTPUT"

# Test 2: Categories endpoint
echo "TEST 2: GET /api/mcp/v1/voice-subtitle/categories" >> "$OUTPUT"
echo "---" >> "$OUTPUT"
curl -s -w "\nHTTP Status: %{http_code}\n" "$SERVER/api/mcp/v1/voice-subtitle/categories" >> "$OUTPUT" 2>&1
echo "" >> "$OUTPUT"
echo "" >> "$OUTPUT"

# Test 3: Filter by category
echo "TEST 3: GET /api/mcp/v1/voice-subtitle/queue/filter-by-category?category=normal" >> "$OUTPUT"
echo "---" >> "$OUTPUT"
curl -s -w "\nHTTP Status: %{http_code}\n" "$SERVER/api/mcp/v1/voice-subtitle/queue/filter-by-category?category=normal" >> "$OUTPUT" 2>&1
echo "" >> "$OUTPUT"
echo "" >> "$OUTPUT"

# Test 4: Latest items
echo "TEST 4: GET /api/mcp/v1/voice-subtitle/queue/latest?limit=5" >> "$OUTPUT"
echo "---" >> "$OUTPUT"
curl -s -w "\nHTTP Status: %{http_code}\n" "$SERVER/api/mcp/v1/voice-subtitle/queue/latest?limit=5" >> "$OUTPUT" 2>&1
echo "" >> "$OUTPUT"
echo "" >> "$OUTPUT"

# Test 5: Today items
echo "TEST 5: GET /api/mcp/v1/voice-subtitle/queue/filter-by-today" >> "$OUTPUT"
echo "---" >> "$OUTPUT"
curl -s -w "\nHTTP Status: %{http_code}\n" "$SERVER/api/mcp/v1/voice-subtitle/queue/filter-by-today" >> "$OUTPUT" 2>&1
echo "" >> "$OUTPUT"
echo "" >> "$OUTPUT"

# Test 6: Ping
echo "TEST 6: GET /api/mcp/v1/voice-subtitle/ping" >> "$OUTPUT"
echo "---" >> "$OUTPUT"
curl -s -w "\nHTTP Status: %{http_code}\n" "$SERVER/api/mcp/v1/voice-subtitle/ping" >> "$OUTPUT" 2>&1
echo "" >> "$OUTPUT"
echo "" >> "$OUTPUT"

echo "========================================" >> "$OUTPUT"
echo "Tests completed!" >> "$OUTPUT"
echo "========================================" >> "$OUTPUT"

cat "$OUTPUT"
