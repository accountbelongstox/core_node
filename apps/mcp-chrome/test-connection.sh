#!/bin/bash

echo "🧪 Testing Chrome MCP Server Connection..."
echo ""

# Wait a moment for user to click extension icon
echo "⏳ Please click the Chrome extension icon now to start the server..."
echo "   (Waiting 10 seconds...)"
sleep 10

echo ""
echo "📡 Checking if port 12306 is listening..."
if lsof -i :12306 > /dev/null 2>&1; then
    echo "✅ Port 12306 is LISTENING!"
    echo ""
    lsof -i :12306
    echo ""
else
    echo "❌ Port 12306 is NOT listening"
    echo "   Make sure you clicked the extension icon"
    exit 1
fi

echo ""
echo "📨 Testing MCP endpoint..."
response=$(curl -s -w "\n%{http_code}" -X POST http://127.0.0.1:12306/mcp \
    -H "Content-Type: application/json" \
    -d '{
        "jsonrpc": "2.0",
        "id": 1,
        "method": "initialize",
        "params": {
            "protocolVersion": "2024-11-05",
            "capabilities": {},
            "clientInfo": {
                "name": "test-client",
                "version": "1.0.0"
            }
        }
    }')

http_code=$(echo "$response" | tail -n1)
body=$(echo "$response" | head -n-1)

if [ "$http_code" = "200" ]; then
    echo "✅ MCP Server responded successfully!"
    echo ""
    echo "Response:"
    echo "$body" | jq '.' 2>/dev/null || echo "$body"
    echo ""
    echo "🎉 Chrome MCP Server is working correctly!"
    echo ""
    echo "🔌 You can now connect from:"
    echo "   • Claude Desktop"
    echo "   • MCP Inspector"
    echo "   • Any MCP-compatible client"
    echo ""
    echo "   Connection URL: http://127.0.0.1:12306/mcp"
else
    echo "❌ MCP Server returned HTTP $http_code"
    echo ""
    echo "Response:"
    echo "$body"
    exit 1
fi
