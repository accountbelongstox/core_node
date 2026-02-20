// 使用MCP协议获取Google页面内容
const { Client } = require('@modelcontextprotocol/sdk/client/index.js');
const { StreamableHTTPClientTransport } = require('@modelcontextprotocol/sdk/client/streamableHttp.js');

const MCP_URL = 'http://127.0.0.1:12306/mcp';

async function main() {
  let client;
  try {
    console.log('步骤1: 创建MCP客户端...');
    client = new Client(
      {
        name: 'get-google-content',
        version: '1.0.0'
      },
      {
        capabilities: {}
      }
    );

    console.log('步骤2: 连接到Chrome MCP Server...');
    const transport = new StreamableHTTPClientTransport(new URL(MCP_URL));
    await client.connect(transport);
    console.log('✅ 连接成功!');

    // 等待连接稳定
    await new Promise(resolve => setTimeout(resolve, 1000));

    console.log('\n步骤3: 打开Google...');
    const navigateResult = await client.callTool({
      name: 'chrome_navigate',
      arguments: {
        url: 'https://www.google.com'
      }
    });
    console.log('✅ Google已打开');
    console.log('导航结果:', JSON.stringify(navigateResult, null, 2));

    // 等待页面加载
    console.log('\n等待页面加载...');
    await new Promise(resolve => setTimeout(resolve, 3000));

    console.log('\n步骤4: 获取Google页面内容...');
    const readResult = await client.callTool({
      name: 'chrome_read_page',
      arguments: {}
    });
    
    console.log('\n✅ 页面内容获取完成!');
    
    // 解析结果
    if (readResult.content && Array.isArray(readResult.content)) {
      const textContent = readResult.content.find(c => c.type === 'text');
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
      console.log('\n完整结果:', JSON.stringify(readResult, null, 2));
    }
    
  } catch (error) {
    console.error('❌ 错误:', error.message);
    if (error.stack) {
      console.error(error.stack);
    }
  } finally {
    if (client) {
      await client.close();
      console.log('\n✅ MCP客户端已关闭');
    }
  }
}

main();
