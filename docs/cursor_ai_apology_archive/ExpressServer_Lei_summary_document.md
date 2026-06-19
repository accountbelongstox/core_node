# ExpressServer Lei summary document 

this WenDang to use HuTiGong `<content>` (ExpressServer Lei ) ZuoJianMing summary . 

## structure GaiLan 
- ** YiLai **: logger, expressProvider, rpcCommon, StaticServer, WsManager, RouterManager, UploadTools, StaticPathResolver, http, os. 
- ** DaoChu **: class ExpressServer, module.exports = ExpressServer. 

## key points 
- ** GouZao **: config/server/started ChuShiHua ; GuaZai StaticServer, WsManager, RouterManager, UploadTools; if ChuanRu config Ze rpcCommon.setConfig; app LaiZi expressProvider.getExpressApp(). 
- **getLocalIp()**: BianLi os.networkInterfaces(), FanHuiShou family===IPv4 Qie !internal address, FouZe "127.0.0.1". 
- **start(config)**: YiQiDongZe warn and FanHui ; He and subAppManager config and STATIC_PATHS; no STATIC_PATHS when use staticPathResolver MoRenLuJing ; YiCi await routerManager.start, staticServer.start, wsManager.start; HTTP_PORT MoRen 3000, HTTP_HOST MoRen '0.0.0.0'; if have expressProvider.getServerApp() Ze in QiShang listen, FouZe app.listen; ChengGongHou logger.success DaYin HTTP/WS Zhi , started=true. 
- **stop()**: wsManager.stop(); if server Cun in Ze server.close(); started=false. 
- **Getter and WeiTuo **: getApp, getServer, getConfig, getRouterManager, getStaticServer, getWsManager, getUploadTools; broadcastWs, sendToWsClient, getWebSocketServer, getHttpServer WeiTuo to wsManager. 

## purpose 
as Ji at Express HTTP + WebSocket FuWuFengZhuang , TongYiLu by , JingTaiZiYuan , ShangChuanGongJu and WebSocket QiDong , TingZhi and FangWen , Bian at in RPC/ sub Ying use architecture XiaFu use . 
