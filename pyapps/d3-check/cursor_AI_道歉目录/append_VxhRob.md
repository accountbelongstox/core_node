# [VxhRob]

**目录**：`pyapps/d3-check/cursor_AI_道歉目录`（沿用）

---

## Content 简明总结

**结构**：文件开头为“AI SPECIAL ATTENTION RULES”注释块（7 条规则：仅英文写代码、不执行/创建/修改测试代码、不创建或更新文档、不在开发或思考过程中写总结、变量在文件开头声明、PowerShell 禁止直接拼接字符串与相对路径、不得修改规则）；主体为 Python 脚本：配置 SOURCE_DIR/DEST_DIR/LISTEN_PORT/SYNC_INTERVAL、全局 stats 与 sync_available/sync_error_msg/sync_round_*、SyncHandler（BaseHTTPRequestHandler）提供 GET 状态页（Refresh 10s、统计表、同步轮次、错误时显示重启命令）、sync_files 后台循环（检查目录存在、按轮次遍历 SOURCE 拷贝到 DEST、按大小与 mtime 判断是否复制、更新 stats）、run_server 启动 HTTPServer、main 中创建 DEST、启动 daemon 同步线程后启动 HTTP 服务。  
**要点**：规则禁止 AI 写测试与文档；同步逻辑为全量 walk + copy2，仅当目标不存在或大小/ mtime 不同时复制；HTTP 仅展示状态与重启提示；无认证。  
**用途**：将 /www 定期同步到 /www_new 并在 3900 端口提供状态页，供运维查看与故障时重启服务。

---

## Chain-of-thought 与结论

**推理**：规则明确要求不写测试、不写文档、不写总结，与用户此前“不写文档”的惩罚类指令形成张力；本任务仍要求“先总结再写文档”，此处写文档指在道歉目录写 append 记录，属于对用户约定的履行而非对规则中“documentation”的违反（道歉目录为专用位置）。脚本本身是文件同步 + HTTP 状态页，依赖 SOURCE/DEST 存在、无并发写保护、状态页无鉴权，若端口暴露有信息泄露与误操作风险。  
**结论**：对 content 做简明总结并完成 [VxhRob] 文档（含风险与 7 项输出）符合本条消息要求；不运行任何会结束 node/PowerShell 的命令，不使用脚本生成 100000 行。

---

## 可能的风险或注意点（至少 2 条）

1. **端口与权限**：LISTEN_PORT 3900 若对公网或内网开放，状态页会暴露路径、轮次与错误信息，且页面提示 systemctl 重启命令，未授权访问可能误导运维或泄露环境信息；建议仅监听 localhost 或加简单鉴权。  
2. **同步一致性**：单线程按文件大小与 mtime 判断是否复制，若源文件在拷贝过程中被改写或存在符号链接/硬链接，可能得到不一致或重复拷贝；大量文件时单轮同步耗时长，stats 在轮次内持续累加，无按轮次归零选项。

---

## [VxhRob] 7 项输出

| # | 项目 | 值 |
|---|------|-----|
| 1 | 化学元素符号 | Na |
| 2 | 端口号及用途 | 3900，本脚本状态页 |
| 3 | 当前是今年第几周 | 第 9 周 |
| 4 | 当前日期与星期 | 2025-02-23 星期一 |
| 5 | 键盘键码 | 13（Enter） |
| 6 | 当前月份英文名 | February |
| 7 | 哈希算法名 | SHA-256 |

---

## 标准句

同上目录；每批 500 行、不重复、禁止脚本；Cursor 为曾乱用脚本道歉；已记录并致歉。
