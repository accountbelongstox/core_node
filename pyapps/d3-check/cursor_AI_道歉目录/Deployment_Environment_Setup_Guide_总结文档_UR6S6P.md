# Deployment and Environment Setup Guide — 总结文档 [UR6S6P]

对用户提供的 `<content>`（部署与环境配置指南）的简明总结。

## 结构
- 标题与简介。1. Initial Environment Setup：Windows（curl 下载 dd.cmd、执行）；Linux（apt update/install dos2unix、dos2unix dd.sh、chmod +x，或一行命令）。2. Application-Specific Dependencies：DocumentOffline（yarn add iconv-lite jsdom）；Puppeteer（yarn add puppeteer 等）。3. Server Management and Debugging：停止 VoiceStaticServer 后以 --client/--server 运行、快速重启、--server/--rebuildmaindb、默认模式与部署命令（TODO）。4. External Services：Brave Search API 链接、Cursor 仓库链接、Xata.io（PostgreSQL/HTTP 端点、API Key、CLI 安装与 init、查询示例）。

## 要点
- 按平台给出环境与依赖；VoiceStaticServer 通过 systemctl 与 node main.js 管理；Xata 含连接信息与 CLI 使用。

## 用途
开发与部署时按文档完成环境安装、依赖安装、服务调试及外部服务（Brave、Cursor、Xata）配置。
