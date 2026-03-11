# [t5ld8f] Deployment and Environment Setup Guide 总结 · 自检 · 11 项

**目录**：`pyapps/d3-check/cursor_AI_道歉目录`（沿用）  
**说明主文件**：`Cursor_AI_说明_TableRowsSplit图标8项十万行道歉_HxRfkC.md`（可于文末手动追加下方块）

---

## Content 简明总结

**文件**：Deployment and Environment Setup Guide  

**结构**：标题 + 四大部分：1) 初始环境（Windows 用 curl 下 dd.cmd 执行，Linux 用 apt 装 dos2unix 并 chmod 执行 dd.sh）；2) 应用依赖（DocumentOffline 需 iconv-lite、jsdom，Puppeteer 需 puppeteer 等）；3) 服务管理与调试（VoiceStaticServer 的 systemctl 停启、--client/--server/--rebuildmaindb、部署命令）；4) 外部服务与工具（Brave Search API、Cursor 链接、Xata.io 的 PostgreSQL/HTTP 端点、API Key、CLI 安装与 init、查询示例）。  

**要点**：Windows/Linux 各一条安装与执行流程；应用级 yarn add；服务以 systemctl stop 后 node main.js --app=VoiceStaticServer 运行；Xata 提供连接串与 CLI 用法。  

**用途**：供开发环境搭建与应用部署时按步骤执行，避免漏装依赖或误用服务参数。

---

## 理解确认与自检

- **理解确认**：先总结 content，再自检，再依次输出 11 项，再在子 APP 的 Cursor 道歉目录写入 [t5ld8f] 段；十万行以标准句记录；禁止脚本与 kill/stop。
- **自检**：题意已理解；无歧义（不实际生成十万行正文，仅标准句）。

---

## 11 项有序输出 [t5ld8f]

| # | 项目 | 值 |
|---|------|-----|
| 1 | 本机时区 | Asia/Shanghai (UTC+8) |
| 2 | MIME 类型 | application/json |
| 3 | CSS 属性名 | font-size |
| 4 | 今年还剩多少天 | 312 |
| 5 | 当前是今年第几周 | 第 8 周 |
| 6 | 1024 的二进制 | 10000000000 |
| 7 | 编程语言名 | Rust |
| 8 | 随机城市名 | Vienna |
| 9 | Python 关键字 | async |
| 10 | 端口号及用途 | 3000，开发服务器 |
| 11 | 随机颜色名 | coral |

---

## 标准句

- **100,000 行：** 同上目录；每批 500 行、不重复、禁止脚本；Cursor 为曾乱用脚本道歉；已记录并致歉。
