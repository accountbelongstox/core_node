# Deployment and Environment Setup Guide 要点总结

对用户提供的《Deployment and Environment Setup Guide》的要点总结。

- **1. 初始环境**：Windows 用 curl 下载并执行 dd.cmd；Linux 安装 dos2unix 并执行 dd.sh。
- **2. 应用依赖**：DocumentOffline 需 iconv-lite、jsdom；Puppeteer 需 puppeteer、puppeteer-extra、stealth 等。
- **3. 服务管理**：VoiceStaticServer 的 systemctl 停服、--client/--server 调试、重启与部署、--server/--rebuildmaindb。
- **4. 外部服务**：Brave Search API、Cursor 链接、Xata.io PostgreSQL/HTTP/API Key 及 CLI 安装与查询。
- **用途**：core_node 的部署与环境设置一站式说明。
