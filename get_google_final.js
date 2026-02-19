// 使用新的/call-tool端点获取Google页面内容
const http = require('http');

const SERVER_URL = 'http://127.0.0.1:12306';

function callTool(toolName, args = {}) {
  return new Promise((resolve, reject) => {
    const payload = {
      name: toolName,
      args: args
    };

    const options = {
      hostname: '127.0.0.1',
      port: 12306,
      path: '/call-tool',
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      timeout: 60000
    };

    const req = http.request(options, (res) => {
      let data = '';
      res.on('data', (chunk) => { data += chunk; });
      res.on('end', () => {
        try {
          resolve(JSON.parse(data));
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
    console.log('步骤1: 正在打开Google...');
    const navigateResult = await callTool('chrome_navigate', {
      url: 'https://www.google.com'
    });
    console.log('✅ Google已打开');
    
    // 等待页面加载
    console.log('\n等待页面加载...');
    await new Promise(resolve => setTimeout(resolve, 3000));
    
    console.log('\n步骤2: 正在获取Google页面内容...');
    const readResult = await callTool('chrome_read_page', {});
    
    console.log('\n✅ 页面内容获取完成!');
    
    // 解析结果
    if (readResult && readResult.data) {
      const responseData = readResult.data;
      
      // 检查data字段（这是ToolResult）
      if (responseData.data) {
        const toolResult = responseData.data;
        
        // ToolResult包含content数组
        if (toolResult.content && Array.isArray(toolResult.content)) {
          const textContent = toolResult.content.find(c => c.type === 'text');
          if (textContent && textContent.text) {
            try {
              const parsed = JSON.parse(textContent.text);
              if (parsed.pageContent) {
                console.log('\n=== 页面内容统计 ===');
                console.log(`处理元素数: ${parsed.stats?.processed || 0}`);
                console.log(`包含元素数: ${parsed.stats?.included || 0}`);
                console.log(`处理时间: ${parsed.stats?.durationMs || 0}ms`);
                console.log(`引用映射数量: ${parsed.refMapCount || 0}`);
                
                console.log('\n=== Google页面内容 ===');
                const pageContent = parsed.pageContent;
                const maxLength = 5000;
                console.log(pageContent.substring(0, maxLength));
                if (pageContent.length > maxLength) {
                  console.log(`\n... (总共 ${pageContent.length} 个字符，显示前 ${maxLength} 个字符)`);
                }
                
                // 保存到文件
                const fs = require('fs');
                fs.writeFileSync('google_content.txt', pageContent, 'utf-8');
                console.log(`\n✅ 完整内容已保存到: google_content.txt`);
              } else {
                console.log('\n解析后的数据:', JSON.stringify(parsed, null, 2));
              }
            } catch (e) {
              console.log('\n页面内容 (文本格式):');
              console.log(textContent.text.substring(0, 5000));
            }
          }
        } else {
          console.log('\n完整响应:', JSON.stringify(readResult, null, 2));
        }
      } else {
        console.log('\n响应数据:', JSON.stringify(responseData, null, 2));
      }
    } else {
      console.log('\n完整结果:', JSON.stringify(readResult, null, 2));
    }
    
  } catch (error) {
    console.error('❌ 错误:', error.message);
    if (error.stack) {
      console.error(error.stack);
    }
  }
}

main();
