# ExpressServer 类总结文档

本文档对用户提供的 `<content>`（ExpressServer 类）做简明总结。

## 结构概览
- **依赖**：logger、expressProvider、rpcCommon、StaticServer、WsManager、RouterManager、UploadTools、StaticPathResolver、http、os。
- **导出**：class ExpressServer，module.exports = ExpressServer。

## 要点
- **构造**：config/server/started 初始化；挂载 StaticServer、WsManager、RouterManager、UploadTools；若传入 config 则 rpcCommon.setConfig；app 来自 expressProvider.getExpressApp()。
- **getLocalIp()**：遍历 os.networkInterfaces()，返回首个 family===IPv4 且 !internal 的 address，否则 "127.0.0.1"。
- **start(config)**：已启动则 warn 并返回；合并 subAppManager 的 config 与 STATIC_PATHS；无 STATIC_PATHS 时用 staticPathResolver 默认路径；依次 await routerManager.start、staticServer.start、wsManager.start；HTTP_PORT 默认 3000，HTTP_HOST 默认 '0.0.0.0'；若有 expressProvider.getServerApp() 则在其上 listen，否则 app.listen；成功后 logger.success 打印 HTTP/WS 地址，started=true。
- **stop()**：wsManager.stop()；若 server 存在则 server.close()；started=false。
- **Getter 与委托**：getApp、getServer、getConfig、getRouterManager、getStaticServer、getWsManager、getUploadTools；broadcastWs、sendToWsClient、getWebSocketServer、getHttpServer 委托给 wsManager。

## 用途
作为基于 Express 的 HTTP + WebSocket 服务封装，统一路由、静态资源、上传工具与 WebSocket 的启动、停止与访问，便于在 RPC/子应用架构下复用。
