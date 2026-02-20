// 直接调用native-messaging-host来执行工具
// 通过修改/ask-extension端点或创建新的端点来使用CALL_TOOL消息类型

const http = require('http');

// 创建一个新的HTTP端点来调用工具（如果不存在的话）
// 或者直接使用native-messaging-host的功能

// 由于/ask-extension使用process_data，我们需要找到另一种方法
// 让我们尝试直接调用native-messaging-host的sendRequestToExtensionAndWait方法
// 但这需要访问服务器内部，所以我们需要通过HTTP API

// 实际上，最好的方法是创建一个新的HTTP端点
// 但既然我们不能修改服务器代码，让我们尝试使用/messages端点

function callToolViaMessages(sessionId, toolName, args = {}) {
  return new Promise((resolve, reject) => {
    // /messages端点需要sessionId，但我们没有
    // 让我们尝试使用/mcp端点，但需要先初始化
    
    const payload = {
      jsonrpc: '2.0',
      id: 1,
      method: 'tools/call',
      params: {
        name: toolName,
        arguments: args
      }
    };

    const options = {
      hostname: '127.0.0.1',
      port: 12306,
      path: '/mcp',
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json, text/event-stream'
      },
      timeout: 60000
    };

    const req = http.request(options, (res) => {
      let data = '';
      const sessionIdHeader = res.headers['mcp-session-id'];
      
      res.on('data', (chunk) => { data += chunk; });
      res.on('end', () => {
        try {
          const result = JSON.parse(data);
          if (sessionIdHeader && result.error) {
            // 如果有错误但获得了sessionId，尝试使用这个sessionId再次调用
            resolve({ sessionId: sessionIdHeader, error: result });
          } else {
            resolve(result);
          }
        } catch (e) {
          resolve(data);
        }
      });
    });

    req.on('error', reject);
    req.on('timeout', () => {
      req.destroy();
      reject(new Error('Request timeout'));
    });
    req.write(JSON.stringify(payload));
    req.end();
  });
}

async function main() {
  try {
    console.log('尝试通过MCP协议调用工具...');
    
    // 先尝试初始化（可能会失败因为已有连接）
    const initResult = await callToolViaMessages(null, 'chrome_navigate', { url: 'https://www.google.com' });
    
    if (initResult.sessionId) {
      console.log('获得sessionId:', initResult.sessionId);
      // 使用这个sessionId调用工具
    } else if (initResult.error) {
      console.log('初始化失败（预期中，因为已有连接）:', initResult.error.message);
      console.log('\n由于MCP服务器已有活动连接，无法创建新会话。');
      console.log('建议：');
      console.log('1. 通过Chrome扩展的popup界面调用工具');
      console.log('2. 或者重启MCP服务器以释放现有连接');
      console.log('3. 或者使用其他MCP客户端（如Claude Desktop）来调用工具');
    } else {
      console.log('结果:', JSON.stringify(initResult, null, 2));
    }
    
  } catch (error) {
    console.error('❌ 错误:', error.message);
  }
}

main();
