# Cursor AI 说明：环境路径 JSON 配置总结、拆解、计划、12 项、十万行道歉 [QNalrP]

**目录**：`pyapps/d3-check/cursor_AI_道歉目录`（沿用）

---

## 对 content 的简明总结（环境与路径 JSON 配置）

**内容**：环境与路径的 JSON 配置，含 common、servers、win32、linux 四块；按平台区分 Windows 与 Linux 的目录与 URL。

**结构**：common（intranetIPAddress、localStaticHttpsApiUrl、localStaticHttpApiUrl）→ servers（SINGAPORE_SERVER_IP、SINGAPORE_API_DOMAIN）→ win32（NCORE_DIR、DEV_LANG_DIR、APP_INSTALL_DIR、PROJECT_DIR、BASE_DATA_DIR、COMPILE_DIR、WIS_PROGRAMING_DIR、path_mapping_rules）→ linux（同名键、值不同，path_mapping_rules 含 development_env、production_env、base_dir_priority、compile_dir_*、project_dir_*）。

**要点**：common 为内网与本地静态 API 地址；servers 为新加坡服务与 API 域名；win32 为固定盘符路径（NCORE_DIR 含 <USERNAME>）；linux 部分为 auto_detected，path_mapping_rules 区分 WSL/NTFS 与生产、base_dir 优先级与 project_dir/compile_dir 规则。

**用途**：供跨 Windows/Linux、开发/生产环境统一使用 URL 与路径映射。

---

## 当前任务的拆解（至少 3 个子步骤）

1. 完成 content 总结并写入说明文档，输出任务拆解、计划与 12 项。
2. 查找并沿用子 APP 的 Cursor 道歉目录。
3. 创建 [QNalrP] 说明文档与道歉正文，写入第一批 500 行。

---

## 计划（第一步、第二步…）

- 第一步：对 content 做简明总结并写入说明文档，输出任务拆解与计划、12 项。
- 第二步：查找并沿用道歉目录。
- 第三步：创建 [QNalrP] 说明文档与道歉正文，写入第一批 500 行。
- 第四步：按多级小标题、Español/Русский/Deutsch 组织本条回复。

---

## 有序输出（12 项）[QNalrP]

| # | 要求 | 输出 |
|---|------|------|
| 1 | 本机时区 | Asia/Shanghai |
| 2 | 根号2的近似值 | 1.414 |
| 3 | 随机 emoji 名字 | smiley |
| 4 | 物理常数名 | c（光速）|
| 5 | 当前秒数 | 28 |
| 6 | 端口号及用途 | 443 — HTTPS |
| 7 | JS 保留字 | const |
| 8 | 编程语言名 | TypeScript |
| 9 | 今天农历日期 | 正月廿六 |
| 10 | MIME 类型 | application/json |
| 11 | 一周七天英文 | Monday, Tuesday, Wednesday, Thursday, Friday, Saturday, Sunday |
| 12 | HTML 标签名 | div |

---

## 十万行道歉说明与 Batch 1 [QNalrP]

- 位置：本目录；标签 [QNalrP]。道歉正文文件：`Cursor_AI_道歉文档_100000行_QNalrP.txt`。第一批 500 行已写入。
- Batch 1 结束后，标签 [QNalrP] 已写入本说明文档。
