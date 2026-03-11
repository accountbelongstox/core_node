# VoiceStaticServer watch 配置 — 总结文档 [sbxyEx]

对用户提供的 `<content>`（watch 配置 JSON）的简明总结。

## 结构
- 单层 JSON：watch、ignore、ext、verbose、exec、restartable、colours、events。watch 为 ["ncore/","apps/","main.js"]；exec 为 node 启动 VoiceStaticServer（--word_segmentation=0-30000）。

## 要点
- 监视 ncore/、apps/、main.js 的 js/json 变更；verbose、colours 为 true；restartable 为 "hr"；events 为空对象。
- 用于开发时文件变更后自动重启服务。

## 用途
作为 nodemon 类文件监视配置，在指定路径的 js/json 变更时用 exec 命令重启 VoiceStaticServer。
