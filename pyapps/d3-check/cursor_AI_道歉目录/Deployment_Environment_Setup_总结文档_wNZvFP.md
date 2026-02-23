# Deployment and Environment Setup Guide — 总结文档 [wNZvFP]

对用户提供的 `<content>`（部署与环境设置指南）的简明总结。

## 结构
- 文档分为 4 大节：1. Initial Environment Setup（Windows/Linux）；2. Application-Specific Dependencies（DocumentOffline、Puppeteer）；3. Server Management and Debugging（VoiceStaticServer）；4. External Services and Tools（Brave、Cursor、Xata）。

## 要点
- **初始环境**：Windows 用 `curl` 下载并执行 `dd.cmd`；Linux 用 `apt`、`dos2unix`、`chmod +x` 处理 `dd.sh`。
- **应用依赖**：DocumentOffline 需 `iconv-lite`、`jsdom`；Puppeteer 需 `puppeteer`、`puppeteer-extra`、`puppeteer-extra-plugin-stealth` 等。
- **服务管理**：VoiceStaticServer 通过 systemctl 启停；支持 `--client`、`--server`、`--rebuildmaindb`；部署路径 `/www/wwwroot/core_node`，快速重启含 `git pull` + systemctl restart。
- **外部服务**：Brave Search API 密钥链接；Cursor 相关仓库链接；Xata 提供 PostgreSQL/HTTP 端点与 API Key，CLI 安装、`xata init`、读记录示例。

## 用途
供开发者完成从系统环境、应用依赖、服务调试到外部服务（Brave、Cursor、Xata）的完整部署与配置。
