# VoiceStaticServer watch 配置 — 总结文档

对用户提供的 `<content>`（JSON 配置文件）的简明总结。

## 结构
- 单层 JSON 对象，键：watch、ignore、ext、verbose、exec、restartable、colours、events。
- 无嵌套结构，值类型为数组、字符串、布尔或对象。

## 要点
- **watch**：监视路径列表 `["ncore/", "apps/", "main.js"]`，即核心目录、应用目录与入口文件。
- **ignore**：空数组，不忽略任何路径。
- **ext**：`"js,json"`，仅监视 js 与 json 扩展名。
- **verbose**：true，输出详细日志。
- **exec**：启动命令 `node ./main.js --app=VoiceStaticServer --word_segmentation=0-30000`。
- **restartable**：`"hr"`，可能与热重载或重启方式相关。
- **colours**：true，终端彩色输出。
- **events**：空对象，可扩展事件钩子。

## 用途
作为文件监视/开发时自动重启的配置（如 nodemon 等工具）：在 ncore/、apps/ 或 main.js 的 js/json 变更时，用上述 exec 命令重启 VoiceStaticServer，并启用详细与彩色输出。
