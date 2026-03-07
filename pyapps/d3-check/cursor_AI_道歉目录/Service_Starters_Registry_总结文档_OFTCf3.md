# Service Starters Registry — 总结文档 [OFTCf3]

对用户提供的 `<content>`（AI 规则注释 + Service Starters Registry 模块）的简明总结。

## 结构
- **AI 规则**：文件顶部注释块，规定全英文代码、不写测试与文档、不写开发过程总结、变量在文件开头声明、PowerShell 脚本路径与字符串规则、禁止修改规则。
- **模块**：JSDoc 说明为 1:1 移植自 pycore/pythreadpool/service_starters.py；require #@logger；SERVICE_STARTERS 空对象；六个 start* 函数（heartbeat、rpc_v2、speech、ui、timer、electron_ui）；registerServiceStarter、getServiceStarter、getAllServiceNames；module.exports。

## 要点
- **heartbeat**：通过 threadBus.getHeartbeatSystem() 启动，不可用时返回 null。
- **rpc_v2**：ncore/utils/rpc.createExpressServer(port/host/basePath)，默认 58100、0.0.0.0、/rpc，start() 后打 log。
- **speech / ui / timer**：Node 端未实现，仅 logger.warn。
- **electron_ui**：require ncore/utils/electron，launchElectronApp(config)，返回 { launching: true } 或 null。
- **注册**：registerServiceStarter(name, func) 校验类型后写入 SERVICE_STARTERS；getServiceStarter、getAllServiceNames 供查询。

## 用途
作为服务启动函数的集中注册表，供调用方按服务名获取并执行启动逻辑，统一管理 heartbeat、RPC v2、Electron UI 等服务的初始化。
