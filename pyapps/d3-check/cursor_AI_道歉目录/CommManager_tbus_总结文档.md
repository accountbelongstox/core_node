# CommManager (tbus) — 总结文档

对用户提供的 `<content>`（GameAISDK CommManager 类）的简明总结。

## 结构
- Python 文件：编码与 GPLv3 注释；sys.path 解析（向上找含 pycore 的目录，最多 12 层）；import configparser、tbus、ColorPrint、Define。类 CommManager：__init__(runType)、Initialize(configFile)、SendTo、SendMsgToIOService、RecvMsg、Finish、_LoadTbusConfig（静态）。

## 要点
- **Initialize**：_LoadTbusConfig 读 [BusConf] 各 Addr；tbus.GetAddress 得 selfAddr、IOAddr、Reg1/2、UI1/2、Agent1/2；任一为 None 则报错并 return False；tbus.Init(selfAddr, configFile) 后按 runType 设置 __recvAddrsSet、__recvAgentAddrsSet（UI_AI 含 IO/Reg/UI/Agent，AI 含 IO/Reg/Agent，UI 含 IO/UI）。
- **收发**：SendTo/SendMsgToIOService 调 tbus.SendTo；RecvMsg 遍历 recvAddrsSet 与 recvAgentAddrsSet 调 tbus.RecvFrom。Finish 调 tbus.Exit。注意 Reg2Addr 当前用 GameReg1Addr，应为 GameReg2Addr。
- **用途**：GameAISDK 中封装 tbus 的通信层，供 MC 与 IO、GameReg、UI、Agent 等组件通信。
