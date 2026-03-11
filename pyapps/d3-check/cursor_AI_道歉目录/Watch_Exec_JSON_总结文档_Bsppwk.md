# Watch/Exec JSON 配置 — 总结文档 [Bsppwk]

对用户提供的 `<content>`（文件监视与执行用 JSON 配置）的简明总结。

## 结构
- 单层 JSON 对象。
- 字段：watch、ignore、ext、verbose、exec、restartable、colours、events。

## 要点
- watch：["ncore/", "apps/", "main.js"]。
- ignore：[]。
- ext："js,json"。
- verbose：true。
- exec：node ./main.js --app=VoiceStaticServer --word_segmentation=0-30000。
- restartable："hr"。
- colours：true。
- events：{}。

## 用途
- 作为 nodemon 或类似工具的配置，监听 ncore/、apps/、main.js 的 js/json 变更并自动重启，运行 VoiceStaticServer（分词 0–30000）。
