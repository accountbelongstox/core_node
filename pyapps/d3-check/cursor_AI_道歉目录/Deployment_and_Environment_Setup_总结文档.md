# Deployment and Environment Setup Guide 总结文档

本文档为对用户提供的《Deployment and Environment Setup Guide》内容的简明总结与索引，便于快速查阅。

## 结构概览
- **第 1 部分**：初始环境（Windows：curl + dd.cmd；Linux：dos2unix + dd.sh）。
- **第 2 部分**：应用依赖（DocumentOffline：iconv-lite、jsdom；Puppeteer 相关包）。
- **第 3 部分**：服务管理与调试（VoiceStaticServer 的 systemctl、--client/--server、重启与部署命令及参数）。
- **第 4 部分**：外部服务与工具（Brave Search API、Cursor 链接、Xata.io 连接与 CLI 用法）。

## 要点速查
- 环境脚本：Windows 用 `dd.cmd`，Linux 用 `dd.sh`（需 dos2unix）。
- 服务调试：先 `systemctl stop VoiceStaticServer-node.service`，再以 `--client` 或 `--server` 运行 main.js。
- 服务参数：`--server` 以服务端模式启动，`--rebuildmaindb` 重建主库。
- Xata：提供 PostgreSQL 与 HTTP 端点及 API Key；CLI 通过 `xata init` 与生成代码进行查询。

## 用途
为 core_node 项目提供从环境初始化、依赖安装、本机/服务器运行与调试到外部 API/数据库配置的一站式部署与环境设置说明。
