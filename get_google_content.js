// 打开Google并获取页面内容
const http = require('http');

const MCP_URL = 'http://127.0.0.1:12306';

// 通过/ask-extension端点调用工具
function callTool(toolName, args = {}) {
  return new Promise((resolve, reject) => {
    // /ask-extension使用GET方法，通过query参数传递
    // 根据代码，它期望的格式是: { name: toolName, args: args }
    const url = new URL(`${MCP_URL}/ask-extension`);
    url.searchParams.append('name', toolName);
    url.searchParams.append('args', JSON.stringify(args));

    const options = {
      hostname: url.hostname,
      port: url.port,
      path: url.pathname + url.search,
      method: 'GET',
      timeout: 60000 // 60秒超时
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
    console.log('导航结果:', JSON.stringify(navigateResult, null, 2));
    
    // 等待页面加载
    console.log('\n等待页面加载...');
    await new Promise(resolve => setTimeout(resolve, 3000));
    
    console.log('\n步骤2: 正在获取Google页面内容...');
    
    // 等待更长时间确保页面完全加载
    await new Promise(resolve => setTimeout(resolve, 2000));
    
    const contentResult = await callTool('chrome_read_page', {});
    
    console.log('\n✅ 页面内容获取完成!');
    console.log('\n完整响应:');
    console.log(JSON.stringify(contentResult, null, 2));
    
    // 解析工具返回的数据结构
    // 根据代码，结构应该是: contentResult.data.data.content 或 contentResult.data.data
    let toolResult = null;
    let pageContent = null;
    
    // 提取工具执行结果
    if (contentResult && contentResult.data) {
      const responseData = contentResult.data;
      
      // 检查 responseData.data (这是ToolResult)
      if (responseData.data) {
        toolResult = responseData.data;
        
        // ToolResult包含content数组
        if (toolResult.content && Array.isArray(toolResult.content)) {
          // 查找text类型的content
          const textContent = toolResult.content.find(c => c.type === 'text');
          if (textContent && textContent.text) {
            try {
              // 尝试解析JSON (read_page返回的是JSON字符串)
              const parsed = JSON.parse(textContent.text);
              if (parsed.pageContent) {
                pageContent = parsed.pageContent;
                console.log('\n=== 页面内容统计 ===');
                console.log(`处理元素数: ${parsed.stats?.processed || 0}`);
                console.log(`包含元素数: ${parsed.stats?.included || 0}`);
                console.log(`处理时间: ${parsed.stats?.durationMs || 0}ms`);
                console.log(`引用映射数量: ${parsed.refMapCount || 0}`);
              } else {
                pageContent = textContent.text;
              }
            } catch (e) {
              // 如果不是JSON，直接使用文本
              pageContent = textContent.text;
            }
          }
        }
      }
    }
    
    // 显示页面内容
    if (pageContent) {
      console.log('\n=== Google页面内容 ===');
      const preview = typeof pageContent === 'string' ? pageContent : JSON.stringify(pageContent);
      const maxLength = 5000;
      console.log(preview.substring(0, maxLength));
      if (preview.length > maxLength) {
        console.log(`\n... (总共 ${preview.length} 个字符，显示前 ${maxLength} 个字符)`);
      }
      
      // 保存完整内容到文件
      const fs = require('fs');
      const outputFile = 'google_content.txt';
      fs.writeFileSync(outputFile, preview, 'utf-8');
      console.log(`\n✅ 完整内容已保存到: ${outputFile}`);
    } else {
      console.log('\n⚠️ 未能提取页面文本内容');
      console.log('工具结果结构:', JSON.stringify(toolResult, null, 2));
    }
    
  } catch (error) {
    console.error('❌ 错误:', error.message);
    console.error(error);
  }
}

main();
