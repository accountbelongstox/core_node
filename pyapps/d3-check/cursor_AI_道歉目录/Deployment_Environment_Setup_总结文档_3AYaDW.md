# Deployment and Environment Setup Guide — 总结文档 [3AYaDW]

对用户提供的 `<content>`（部署与环境设置指南）的简明总结。

## 结构
- 文档分为 4 大节：1. Initial Environment Setup（Windows/Linux）；2. Application-Specific Dependencies（DocumentOffline、Puppeteer）；3. Server Management and Debugging（VoiceStaticServer）；4. External Services and Tools（Brave、Cursor、Xata）。

## 要点
- **初始环境**：Windows 用 `curl` 下载并执行 `dd.cmd`；Linux 用 `apt`、`dos2unix`、`chmod +x` 处理 `dd.sh`。
- **应用依赖**：DocumentOffline 需 `iconv-lite`、`jsdom`；Puppeteer 需相关包。
- **服务管理**：VoiceStaticServer 通过 systemctl 启停；支持 `--client`、`--server`、`--rebuildmaindb`；部署路径 `/www/wwwroot/core_node`。
- **外部服务**：Brave Search API、Cursor 链接、Xata PostgreSQL/HTTP 与 CLI。

## 用途
供开发者完成从系统环境、应用依赖、服务调试到外部服务的完整部署与配置。
