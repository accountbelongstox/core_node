# Deployment and Environment Setup Guide — 总结文档 [WJ6NEg]

对用户提供的 `<content>`（部署与环境配置指南）的简明总结。

## 结构
- **1. Initial Environment Setup**：Windows 用 curl 下载 dd.cmd 并执行；Linux 安装 dos2unix、对 dd.sh 执行 dos2unix 与 chmod +x，或使用给出的一行命令。
- **2. Application-Specific Dependencies**：DocumentOffline 需 yarn add iconv-lite jsdom；Puppeteer 需 puppeteer、puppeteer-extra、puppeteer-extra-plugin-stealth、@puppeteer/browsers、user-agents。
- **3. Server Management and Debugging**：停止 VoiceStaticServer-node.service 后以 --client/--server 或默认模式运行 main.js；快速重启为 git pull + systemctl restart；参数含 --server、--rebuildmaindb；部署命令含 --service --server + systemctl restart。
- **4. External Services and Tools**：Brave Search API 密钥链接；Cursor 相关仓库链接；Xata.io 的 PostgreSQL/HTTP 端点与 API Key、CLI 安装、xata init、getXataClient 查询示例。

## 要点
- 环境：dd.cmd（Windows）、dd.sh（Linux）为初始脚本入口。
- 应用依赖：按应用分别 yarn add。
- VoiceStaticServer：systemctl 管理服务；node main.js --app=VoiceStaticServer 支持 --client、--server、--rebuildmaindb、--service。
- Xata：提供连接字符串与 CLI 使用步骤。

## 用途
为开发环境准备、应用依赖安装、VoiceStaticServer 部署与调试及 Brave/Xata 等外部服务配置提供步骤说明。
