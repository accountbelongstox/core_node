# Deployment and Environment Setup Guide — 总结文档 [mqkeHZ]

对用户提供的 `<content>`（部署与环境配置指南）的简明总结。

## 结构
1. Initial Environment Setup（Windows：curl 下载 dd.cmd 并执行；Linux：dos2unix + chmod +x dd.sh）。2. Application-Specific Dependencies（DocumentOffline：iconv-lite、jsdom；Puppeteer 相关包）。3. Server Management and Debugging（VoiceStaticServer 停止/以 client/server 或默认运行、快速重启、--server/--rebuildmaindb、部署命令）。4. External Services（Brave Search API、Cursor 链接、Xata.io 连接与 CLI 用法）。

## 要点
- 环境：dd.cmd（Windows）、dd.sh（Linux）为初始入口。
- 应用依赖：按应用 yarn add。
- VoiceStaticServer：systemctl 管理；node main.js --app=VoiceStaticServer 支持 --client、--server、--rebuildmaindb、--service。
- Xata：提供连接字符串与 CLI（npm install @xata.io/cli、xata init、getXataClient）示例。

## 用途
为开发环境准备、应用依赖安装、VoiceStaticServer 部署与调试及 Brave/Xata 等外部服务配置提供步骤说明。
