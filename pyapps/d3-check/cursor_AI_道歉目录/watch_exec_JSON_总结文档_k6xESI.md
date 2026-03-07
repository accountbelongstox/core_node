# watch/exec JSON 配置 — 总结文档 [k6xESI]

对用户提供的 `<content>`（watch、exec 等字段的 JSON）的简明总结。

## 结构
- 根为 JSON：watch（["ncore/","apps/","main.js"]）、ignore（[]）、ext（"js,json"）、verbose（true）、exec（"node ./main.js --app=VoiceStaticServer --word_segmentation=0-30000"）、restartable（"hr"）、colours（true）、events（{}）。

## 要点
- 监听 ncore/、apps/、main.js，扩展名 js/json；执行 node 启动 VoiceStaticServer；restartable "hr" 通常表示按键重启；verbose、colours 为 true。

## 用途
nodemon 或类似文件监视器的配置，用于开发时监听变更并重启 VoiceStaticServer。
