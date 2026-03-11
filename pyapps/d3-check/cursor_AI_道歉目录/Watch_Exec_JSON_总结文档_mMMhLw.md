# Watch/Exec JSON 配置 — 总结文档 [mMMhLw]

对用户提供的 `<content>`（文件监视与执行用 JSON 配置）的简明总结。

## 结构
单层 JSON 对象，字段依次为：watch（数组）、ignore（数组）、ext（字符串）、verbose（布尔）、exec（字符串）、restartable（字符串）、colours（布尔）、events（对象）。

## 要点
- **watch**：监听路径 `ncore/`、`apps/`、`main.js`。
- **ignore**：空数组，不忽略任何路径。
- **ext**：`"js,json"`，仅针对 js 与 json 扩展名触发。
- **verbose**：true，输出详细日志。
- **exec**：启动命令 `node ./main.js --app=VoiceStaticServer --word_segmentation=0-30000`，即以 VoiceStaticServer 应用、分词范围 0–30000 运行 main.js。
- **restartable**：`"hr"`，通常表示热重载或重启方式（依具体工具而定）。
- **colours**：true，终端彩色输出。
- **events**：空对象，可扩展事件钩子。

## 用途
作为 nodemon 或类似开发工具的配置文件，在 ncore/、apps/、main.js 等变更时自动重启并执行上述 node 命令，用于开发期 VoiceStaticServer 的本地运行与调试。
