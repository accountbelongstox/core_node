apps\mcp-chrome 找到该项目，并调用MCP查看官方文档，这个是原项目的 文档 apps\mcp-chrome\README.md 现在已经进行了修改。

 现在找到windows的 map path web 以及 linux的 同样的map path web，映射本项目的根目录 ，之后修改扩展，改为不启动 npm install -g mcp-chrome-bridge ，而是启动本项目的编译（非调试）


再次确保当我编译完成后，直接导入chrome extentins，就能直接工作，所有 路径 都是自动处理并映射 的，同时支持 windows/liunx。而不要移动任何文件。都是直接在源码中运行。中扩展恢复API的选项，同时，恢复 后的API是和域名同源，也就是浏览器访问那个URL就是那个，有可能 是IP有可能是域名，是一个自支区取的方法 提供，而不是字符串。

.output 将输出修改到 www/programing/_build_dir 
注意目录是自动创建的，同时是根据相对路径，而不是硬编码，在windows和liunx下都
一样，服务端不变，只改extension输出目录，方便导入 

找到 ./scripts/shells/linux   / common / get real user
  sh，得到实际用户，在编译脚本下调用，在root下创建时会自动修正权限为普通用户，
  同时编译过以后也要修正权限。
  
  编译都是在root下运行，对行创建目录你使用sudu，之后修正权限 。

  ./apps/mcp-chrome/scripts/start.sh
apps\mcp-chrome  扩展是如何让服务启动，以及最后AI是如何连上MCP的，整体分析一下工作原理并给出详细报告。


基于深度分析，让我详细解释整个系统的工作流程：

  ---
  1️⃣ 扩展如何启动服务

  启动流程时序图：

  用户点击Connect按钮
      ↓
  [Popup UI] testNativeConnection()
      ↓ chrome.runtime.sendMessage({ type: 'connectNative', port: 12306 })
      ↓
  [Background] chrome.runtime.onMessage.addListener()
      ↓ 接收到'connectNative'消息
      ↓
  [Background] connectNativeHost(12306)
      ↓ chrome.runtime.connectNative('com.chromemcp.nativehost')
      ↓
  [Chrome浏览器] 查找Native Messaging Host配置
      ↓ 读取:
  ~/.config/google-chrome/NativeMessagingHosts/com.chromemcp.nativehost.json
      ↓ path: /www/programing/core_node/apps/mcp-chrome/app/native-server/dis
  t/run_host.sh
      ↓
  [Chrome浏览器] 启动Node.js进程
      ↓ 执行: run_host.sh → node index.js
      ↓
  [Native Server] index.js 启动
      ↓ 创建server和nativeMessagingHost实例
      ↓ nativeMessagingHost.start() 监听stdin
      ↓
  [Background] nativePort.postMessage({ type: 'start', payload: { port: 12306
   } })
      ↓ 通过stdin发送START消息
      ↓
  [Native Server] handleMessage(START)
      ↓ 调用 startServer(12306)
      ↓ fastify.listen({ port: 12306, host: '127.0.0.1' })
      ↓
  [HTTP Server] 启动成功，监听 http://127.0.0.1:12306
      ↓
  [Native Server] sendMessage({ type: 'server_started', payload: { port:
  12306 } })
      ↓ 通过stdout返回启动成功消息
      ↓
  [Background] nativePort.onMessage.addListener()
      ↓ 接收SERVER_STARTED消息
      ↓ 更新 currentServerStatus = { isRunning: true, port: 12306 }
      ↓ broadcastServerStatusChange() 广播状态
      ↓
  [Popup UI] 接收状态更新
      ↓ 显示"Service running on port 12306"
      ✓ 启动完成

  ---
  2️⃣ AI如何连上MCP

  MCP连接流程：

  [Claude/AI客户端] 读取MCP配置
      ↓
  配置文件：
  {
    "mcpServers": {
      "chrome": {
        "type": "streamable-http",
        "url": "http://127.0.0.1:12306/mcp"
      }
    }
  }
      ↓
  [AI客户端] 发送 initialize 请求
      ↓ POST http://127.0.0.1:12306/mcp
      ↓ Body: { jsonrpc: '2.0', method: 'initialize', ... }
      ↓
  [Fastify Server] POST /mcp 路由
      ↓ 检查 mcp-session-id header (首次为undefined)
      ↓ 检测到 initialize 请求
      ↓
  [Server] 创建新会话
      ↓ sessionId = randomUUID()
      ↓ transport = new StreamableHTTPServerTransport(...)
      ↓ transportsMap.set(sessionId, transport)
      ↓
  [Server] 连接MCP Server
      ↓ await getMcpServer().connect(transport)
      ↓ 返回capabilities (tools列表)
      ↓
  [AI客户端] 收到initialize响应
      ↓ 保存 mcp-session-id
      ↓ 连接建立成功
      ✓

  后续请求：
  [AI客户端] 调用工具
      ↓ POST /mcp
      ↓ Headers: mcp-session-id: <uuid>
      ↓ Body: { method: 'tools/call', params: { name: 'screenshot', ... } }
      ↓
  [Server] 查找会话
      ↓ transport = transportsMap.get(sessionId)
      ↓ 路由到已建立的MCP连接
      ↓
  [MCP Server] 处理工具调用
      ↓ 通过Native Messaging发送到Chrome Extension
      ↓ Extension执行浏览器操作
      ↓ 返回结果
      ↓
  [AI客户端] 接收工具执行结果
      ✓


在面板中调整出设置中心,用设置API切换API.以及是否开始本地任务(请求API的任务
在本地完成,以及暂停,)注意使用使用统一的状态中心,之后对面板整体规范,不要东一块
西一块没有关联. 